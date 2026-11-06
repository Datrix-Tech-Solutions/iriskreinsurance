import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  realpath,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  ArchiveImportService,
  ImportIdentity,
  uploadMetadata,
} from './archive-import.service';
import { ArchiveImportExecutor } from './archive-import.executor';
import { HistoricalStatementsAccessClient } from '../historical-statements-access.client';
import { Actor } from '../loader/database';
import { ValidatedDataset } from '../loader/source-contract';
import { Plan } from '../loader/lifecycle';
import { workbook } from '../loader/test-fixtures';
import { validateDataset } from '../loader/dataset';

const tenantId = '11111111-1111-4111-8111-111111111111',
  userId = '22222222-2222-4222-8222-222222222222';
const descriptors = Array.from({ length: 10 }, (_, index) => ({
  index,
  year: 2021 + Math.floor(index / 2),
  kind: index % 2 ? ('REINSURER' as const) : ('INSURER' as const),
}));
const identity: ImportIdentity = {
  actor: { tenantId, userId, tenantSlug: 'synthetic' },
  token: 'synthetic-session-not-persisted',
};
describe('Archive upload orchestration (synthetic files only)', () => {
  let root: string, service: ArchiveImportService;
  const access = { getAccess: jest.fn() };
  const executor = {
    preflight: jest.fn(),
    plan: jest.fn(),
    execute: jest.fn<
      Promise<{ loadId: string; outcome: string }>,
      [ValidatedDataset, Plan, string, string?]
    >(),
    status: jest.fn(),
    currentPublication: jest.fn(),
    existingVersion: jest.fn(),
  };
  let dataset: ValidatedDataset | undefined;
  let current: string | null;
  let published: boolean;
  let duplicate: boolean;
  const loadId = '33333333-3333-4333-8333-333333333333';
  beforeEach(async () => {
    root = await realpath(
      await mkdtemp(join(tmpdir(), 'archive-upload-test-')),
    );
    process.env.HISTORICAL_STATEMENTS_UPLOAD_ROOT = root;
    await mkdir(join(root, 'incoming'), { mode: 0o700 });
    jest.resetAllMocks();
    current = null;
    published = false;
    duplicate = false;
    dataset = undefined;
    access.getAccess.mockResolvedValue({
      tenantId,
      userId,
      enabled: true,
      canView: true,
      canExport: true,
      canImport: true,
    });
    executor.preflight.mockResolvedValue(undefined);
    executor.existingVersion.mockResolvedValue(null);
    executor.plan.mockImplementation(
      (
        d: ValidatedDataset,
        actor: Actor,
        stageOnly: boolean,
      ): Promise<Plan> => {
        dataset = d;
        return Promise.resolve<Plan>({
          planVersion: 'historical-archive-plan/v1',
          loaderVersion: 'synthetic',
          loaderBuildSha256: 'synthetic',
          contractVersion: d.manifest.contractVersion,
          operation: 'apply',
          generatedAt: new Date().toISOString(),
          actor,
          identity: {
            environment: 'local',
            host: '127.0.0.1',
            port: 5432,
            database: 'synthetic',
            schema: 'reinsurance',
            role: 'writer',
            readRole: 'reader',
            purpose: 'ARCHIVE',
          },
          datasetKey: d.manifest.datasetKey,
          datasetVersion: d.manifest.datasetVersion,
          contentManifestSha256: d.contentManifestSha256,
          currentLoadId: current,
          existingLoadId: stageOnly && !duplicate ? null : loadId,
          existingStatus: stageOnly && !duplicate ? null : 'READY',
          action: stageOnly && !duplicate ? 'CREATE' : 'RESUME',
          counts: {},
          stageOnly,
          blockers: [],
        });
      },
    );
    executor.execute.mockImplementation((_d: ValidatedDataset, p: Plan) => {
      published = !p.stageOnly;
      return Promise.resolve({
        loadId,
        outcome: p.stageOnly ? 'READY_UNPUBLISHED' : 'PUBLISHED',
      });
    });
    executor.status.mockImplementation(() =>
      Promise.resolve({
        status: published ? 'PUBLISHED' : 'READY',
        datasetVersion: dataset?.manifest.datasetVersion,
      }),
    );
    executor.currentPublication.mockImplementation(() =>
      Promise.resolve(current),
    );
    service = new ArchiveImportService(
      access as unknown as HistoricalStatementsAccessClient,
      executor as unknown as ArchiveImportExecutor,
    );
  });
  afterEach(async () => {
    delete process.env.HISTORICAL_STATEMENTS_UPLOAD_ROOT;
    await rm(root, { recursive: true, force: true });
  });
  async function files() {
    return Promise.all(
      descriptors.map(async (d) => {
        const path = join(root, 'incoming', randomUUID());
        await writeFile(path, workbook(d.kind, `${d.kind}-${d.year}`), {
          mode: 0o600,
        });
        return {
          path,
          originalname: `${d.year}-${d.kind}.xlsx`,
        } as Express.Multer.File;
      }),
    );
  }
  async function ready() {
    const created = await service.submit(
      identity,
      JSON.stringify(descriptors),
      await files(),
    );
    for (let i = 0; i < 100; i++) {
      const status = await service.status(identity, created.importId);
      if (
        status.status === 'READY' ||
        status.status === 'FAILED' ||
        status.status === 'SUPERSEDED'
      )
        return status;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Synthetic worker did not finish');
  }
  async function settled(id: string) {
    for (let i = 0; i < 100; i++) {
      const result = await service.status(identity, id);
      if (['PUBLISHED', 'FAILED'].includes(result.status)) return result;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Synthetic publication did not finish');
  }
  it('stages ten source-faithful files asynchronously with nonfatal anomalies and no publication', async () => {
    const result = await ready();
    expect(result).toMatchObject({
      status: 'READY',
      publicationPermitted: true,
      insurerRowCount: 10,
      reinsurerRowCount: 10,
      totalRowCount: 20,
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(dataset?.links).toEqual([]);
    expect(dataset?.files[0].rows.map((r) => r.sourceRow)).toEqual([2, 3]);
    expect(dataset?.files[0].rows[0].fields.sumInsured100).toBe(
      '-123456789012345.123456789012',
    );
    expect(
      dataset?.files.find((f) => f.input.kind === 'REINSURER')?.rows[0].fields,
    ).toMatchObject({
      paidWhtFirst: '12.34',
      paidWhtSecond: '56.78',
      offerStatus: 'PENDING',
    });
    expect(executor.execute.mock.calls[0][1]).toMatchObject({
      stageOnly: true,
    });
    expect(await readdir(join(root, 'incoming'))).toEqual([]);
    const metadata = await readFile(
      join(root, tenantId, result.importId, 'status.json'),
      'utf8',
    );
    expect(metadata).not.toContain(identity.token);
    // Default CLI certification remains strict for this different synthetic corpus.
    const original = await validateDataset({
      sourceRoot: join(root, tenantId, result.importId),
      manifestFile: join(root, tenantId, result.importId, 'manifest.json'),
    });
    expect(original.discrepancies.length).toBeGreaterThan(0);
  });
  it('rejects foreign tenant identity and disabled/revoked import permission before any execution', async () => {
    for (const override of [
      { tenantId: randomUUID() },
      { canImport: false },
      { enabled: false },
    ]) {
      access.getAccess.mockResolvedValue({
        tenantId,
        userId,
        enabled: true,
        canImport: true,
        ...override,
      });
      await expect(
        service.submit(identity, JSON.stringify(descriptors), await files()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(executor.preflight).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });
  it('hides a different tenant’s import ID', async () => {
    const result = await ready();
    const otherId = randomUUID();
    access.getAccess.mockResolvedValue({
      tenantId: otherId,
      userId,
      enabled: true,
      canImport: true,
    });
    await expect(
      service.status(
        { ...identity, actor: { ...identity.actor, tenantId: otherId } },
        result.importId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects duplicate content, metadata identities and tenant injection', async () => {
    const f = await files();
    await writeFile(f[1].path, await readFile(f[0].path));
    await expect(
      service.submit(identity, JSON.stringify(descriptors), f),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(() =>
      uploadMetadata(
        JSON.stringify(descriptors.map((d) => ({ ...d, tenantId }))),
        10,
      ),
    ).toThrow();
    expect(() =>
      uploadMetadata(
        JSON.stringify([...descriptors.slice(0, 9), descriptors[0]]),
        10,
      ),
    ).toThrow();
    expect(executor.execute).not.toHaveBeenCalled();
  });
  it('fails malformed workbooks without leaking parser content or writing archive rows', async () => {
    const f = await files();
    await writeFile(f[0].path, Buffer.from('PK malformed synthetic file'));
    const initial = await service.submit(
      identity,
      JSON.stringify(descriptors),
      f,
    );
    const result = await settled(initial.importId);
    expect(result.errors).toEqual(['ARCHIVE_VALIDATION_FAILED']);
    expect(executor.execute).not.toHaveBeenCalled();
  });
  it('rechecks stored workbook hashes before publication', async () => {
    const result = await ready();
    await writeFile(
      join(
        root,
        tenantId,
        result.importId,
        'INSURER-2021',
        '2021-INSURER.xlsx',
      ),
      workbook('INSURER', 'tampered'),
    );
    await service.publish(identity, result.importId, {
      datasetVersion: result.datasetVersion,
      approvalRef: 'Synthetic operator approval',
    });
    const failed = await settled(result.importId);
    expect(failed.status).toBe('FAILED');
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });
  it('detects a duplicate upload and reuses its immutable dataset version', async () => {
    const first = await ready();
    duplicate = true;
    const second = await ready();
    expect(second.datasetVersion).toBe(first.datasetVersion);
    expect(second.duplicateUpload).toBe(true);
    expect(second.datasetId).toBe(first.datasetId);
    expect(second.totalRowCount).toBe(20);
  });
  it('does not republish a duplicate of superseded content', async () => {
    const first = await ready();
    executor.plan.mockImplementation(
      (d: ValidatedDataset, actor: Actor, stageOnly: boolean) => {
        const plan: Plan = {
          planVersion: 'historical-archive-plan/v1',
          loaderVersion: 'synthetic',
          loaderBuildSha256: 'synthetic',
          contractVersion: d.manifest.contractVersion,
          operation: 'apply',
          generatedAt: new Date().toISOString(),
          actor,
          identity: {
            environment: 'local',
            host: '127.0.0.1',
            port: 1,
            database: 'synthetic',
            schema: 'reinsurance',
            role: 'writer',
            readRole: 'reader',
            purpose: 'ARCHIVE',
          },
          datasetKey: d.manifest.datasetKey,
          datasetVersion: d.manifest.datasetVersion,
          contentManifestSha256: d.contentManifestSha256,
          currentLoadId: randomUUID(),
          existingLoadId: loadId,
          existingStatus: 'SUPERSEDED',
          action: 'SKIP',
          counts: {},
          stageOnly,
          blockers: [],
        };
        return Promise.resolve(plan);
      },
    );
    executor.execute.mockResolvedValue({ loadId, outcome: 'IDEMPOTENT_SKIP' });
    executor.status.mockResolvedValue({ status: 'SUPERSEDED' });
    const second = await ready();
    expect(second.datasetVersion).toBe(first.datasetVersion);
    expect(second).toMatchObject({
      status: 'SUPERSEDED',
      duplicateUpload: true,
      publicationPermitted: false,
    });
  });
  it('preserves an existing immutable CLI version for identical source content', async () => {
    executor.existingVersion.mockResolvedValue('reviewed-v1');
    duplicate = true;
    const result = await ready();
    expect(result.datasetVersion).toBe('reviewed-v1');
    expect(result.duplicateUpload).toBe(true);
    expect(dataset?.manifest.datasetVersion).toBe('reviewed-v1');
  });
  it('requires the exact version and explicit current publication for replacement', async () => {
    const result = await ready();
    current = randomUUID();
    await expect(
      service.publish(identity, result.importId, {
        datasetVersion: 'wrong',
        approvalRef: 'Synthetic',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.publish(identity, result.importId, {
        datasetVersion: result.datasetVersion,
        approvalRef: 'Synthetic',
      }),
    ).rejects.toThrow('ARCHIVE_EXPLICIT_REPLACEMENT_REQUIRED');
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });
  it('publishes only after explicit confirmation and duplicate publish is idempotent', async () => {
    const result = await ready(),
      dto = {
        datasetVersion: result.datasetVersion,
        approvalRef: 'Synthetic explicit all-unlinked publication approval',
      };
    await service.publish(identity, result.importId, dto);
    expect((await settled(result.importId)).status).toBe('PUBLISHED');
    await service.publish(identity, result.importId, dto);
    expect(executor.execute).toHaveBeenCalledTimes(2);
  });
  it('serializes simultaneous publication requests', async () => {
    const result = await ready(),
      dto = { datasetVersion: result.datasetVersion, approvalRef: 'Synthetic' };
    const attempts = await Promise.allSettled([
      service.publish(identity, result.importId, dto),
      service.publish(identity, result.importId, dto),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    await settled(result.importId);
    expect(executor.execute).toHaveBeenCalledTimes(2);
  });
});
