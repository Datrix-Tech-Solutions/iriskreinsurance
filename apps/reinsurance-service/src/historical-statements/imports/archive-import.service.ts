import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  writeFile,
  unlink,
} from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Actor } from '../loader/database';
import { validateDataset } from '../loader/dataset';
import {
  bytesSha,
  CONTRACT,
  sha,
  SourceFileInput,
  ValidatedDataset,
} from '../loader/source-contract';
import { HistoricalStatementsAccessClient } from '../historical-statements-access.client';
import { ArchiveImportExecutor } from './archive-import.executor';
import { ArchivePublishDto } from './archive-import.dto';
import { archiveStorageRoot, removeIncoming } from './archive-import.storage';

export interface ImportIdentity {
  actor: Actor;
  token: string;
}
type ImportState =
  | 'VALIDATING'
  | 'STAGING'
  | 'READY'
  | 'PUBLISHING'
  | 'FAILED'
  | 'PUBLISHED'
  | 'SUPERSEDED';
interface UploadMetadata {
  index: number;
  kind: 'INSURER' | 'REINSURER';
  year: number;
}
interface ImportJob {
  importId: string;
  tenantId: string;
  datasetVersion: string;
  status: ImportState;
  datasetId: string | null;
  duplicateUpload: boolean;
  currentPublishedDatasetId: string | null;
  fileRowCounts: Record<string, number>;
  files: SourceFileInput[];
  insurerRowCount: number;
  reinsurerRowCount: number;
  warnings: { code: string; count: number }[];
  errors: string[];
  createdByUserId: string;
  createdAt: string;
}
export const ARCHIVE_UPLOAD_DATASET_KEY = 'historical-statements-2021-2025';

export function uploadMetadata(raw: string, count: number): UploadMetadata[] {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequestException('ARCHIVE_INVALID_METADATA');
  }
  if (!Array.isArray(value) || value.length !== 10 || count !== 10)
    throw new BadRequestException('ARCHIVE_TEN_WORKBOOKS_REQUIRED');
  const identities = new Set<string>(),
    indexes = new Set<number>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new BadRequestException('ARCHIVE_INVALID_METADATA');
    const row = item as Record<string, unknown>;
    if (
      Object.keys(row).sort().join(',') !== 'index,kind,year' ||
      !Number.isInteger(row.index) ||
      Number(row.index) < 0 ||
      Number(row.index) >= 10 ||
      (row.kind !== 'INSURER' && row.kind !== 'REINSURER') ||
      !Number.isInteger(row.year) ||
      Number(row.year) < 2021 ||
      Number(row.year) > 2025
    )
      throw new BadRequestException('ARCHIVE_INVALID_METADATA');
    const identity = `${row.kind}:${String(row.year)}`;
    if (identities.has(identity) || indexes.has(Number(row.index)))
      throw new BadRequestException('ARCHIVE_DUPLICATE_FILE_METADATA');
    identities.add(identity);
    indexes.add(Number(row.index));
    return { index: Number(row.index), kind: row.kind, year: Number(row.year) };
  });
}

@Injectable()
export class ArchiveImportService {
  private readonly tasks: (() => Promise<void>)[] = [];
  private working = false;
  private readonly active = new Set<string>();
  constructor(
    private readonly access: HistoricalStatementsAccessClient,
    private readonly executor: ArchiveImportExecutor,
  ) {}
  private async authorize(identity: ImportIdentity) {
    const result = await this.access.getAccess(identity.token);
    if (
      result.tenantId !== identity.actor.tenantId ||
      result.userId !== identity.actor.userId ||
      !result.enabled ||
      result.canImport !== true
    )
      throw new ForbiddenException('ARCHIVE_IMPORT_DENIED');
  }
  private async directory(tenantId: string, id: string) {
    if (!/^[a-f\d-]{36}$/i.test(tenantId) || !/^[a-f\d-]{36}$/i.test(id))
      throw new NotFoundException('ARCHIVE_IMPORT_NOT_FOUND');
    return join(await archiveStorageRoot(), tenantId, id);
  }
  private async save(job: ImportJob) {
    const dir = await this.directory(job.tenantId, job.importId),
      tmp = join(dir, `status-${randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(job), { mode: 0o600, flag: 'wx' });
    await rename(tmp, join(dir, 'status.json'));
  }
  private async job(identity: ImportIdentity, id: string): Promise<ImportJob> {
    const dir = await this.directory(identity.actor.tenantId, id);
    try {
      const value = JSON.parse(
        await readFile(join(dir, 'status.json'), 'utf8'),
      ) as ImportJob;
      if (value.tenantId !== identity.actor.tenantId || value.importId !== id)
        throw new Error();
      return value;
    } catch {
      throw new NotFoundException('ARCHIVE_IMPORT_NOT_FOUND');
    }
  }
  private reserve(key: string) {
    if (this.active.has(key))
      throw new ConflictException('ARCHIVE_IMPORT_BUSY');
    if (this.active.size >= 4)
      throw new HttpException('ARCHIVE_IMPORT_QUEUE_FULL', 429);
    this.active.add(key);
  }
  private enqueue(key: string, task: () => Promise<void>, reserved = false) {
    if (!reserved) this.reserve(key);
    this.tasks.push(async () => {
      try {
        await task();
      } finally {
        this.active.delete(key);
      }
    });
    this.drain();
  }
  private drain() {
    if (this.working) return;
    const next = this.tasks.shift();
    if (!next) return;
    this.working = true;
    setImmediate(() => {
      void next()
        .catch(() => undefined)
        .finally(() => {
          this.working = false;
          this.drain();
        });
    });
  }
  private response(job: ImportJob) {
    return {
      importId: job.importId,
      datasetKey: ARCHIVE_UPLOAD_DATASET_KEY,
      currentPublishedDatasetId: job.currentPublishedDatasetId,
      datasetVersion: job.datasetVersion,
      datasetId: job.datasetId,
      status: job.status,
      insurerRowCount: job.insurerRowCount,
      reinsurerRowCount: job.reinsurerRowCount,
      totalRowCount: job.insurerRowCount + job.reinsurerRowCount,
      duplicateUpload: job.duplicateUpload,
      reportingYears: [...new Set(job.files.map((f) => f.year))].sort(),
      files: job.files.map((f) => ({
        fileName: basename(f.path),
        kind: f.kind,
        year: f.year,
        sha256: f.sha256,
        rowCount: job.fileRowCounts[f.sha256] ?? null,
      })),
      warnings: job.warnings,
      errors: job.errors,
      publicationPermitted: job.status === 'READY',
    };
  }
  async submit(
    identity: ImportIdentity,
    metadata: string,
    files: Express.Multer.File[],
  ) {
    let reservation: string | undefined;
    let queued = false;
    try {
      await this.authorize(identity);
      if (this.active.size >= 4)
        throw new HttpException('ARCHIVE_IMPORT_QUEUE_FULL', 429);
      const descriptors = uploadMetadata(metadata, files.length);
      await this.executor.preflight(identity.actor);
      const id = randomUUID(),
        dir = await this.directory(identity.actor.tenantId, id);
      this.reserve(id);
      reservation = id;
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const stored: SourceFileInput[] = [];
      for (const descriptor of descriptors) {
        const file = files[descriptor.index];
        if (
          !file ||
          !/\.xlsx$/i.test(file.originalname) ||
          file.originalname !== basename(file.originalname) ||
          file.originalname.includes('\\') ||
          [...file.originalname].some(
            (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
          ) ||
          file.originalname.length > 180
        )
          throw new BadRequestException('ARCHIVE_INVALID_WORKBOOK_NAME');
        const sub = `${descriptor.kind}-${descriptor.year}`;
        await mkdir(join(dir, sub), { mode: 0o700 });
        const path = join(sub, file.originalname);
        await chmod(file.path, 0o600);
        await rename(file.path, join(dir, path));
        const bytes = await readFile(join(dir, path));
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
          throw new BadRequestException('ARCHIVE_INVALID_XLSX');
        stored.push({
          path,
          kind: descriptor.kind,
          year: descriptor.year,
          sha256: bytesSha(bytes),
          rawStorageProvider: 'PRIVATE_ARCHIVE_VOLUME',
          rawStorageKey: `${identity.actor.tenantId}/${id}/${path}`,
        });
      }
      if (new Set(stored.map((f) => f.sha256)).size !== 10)
        throw new BadRequestException('ARCHIVE_DUPLICATE_WORKBOOK_CONTENT');
      const version =
        'sha256-' +
        sha(
          stored
            .map(({ kind, year, sha256 }) => ({ kind, year, sha256 }))
            .sort((a, b) =>
              `${a.kind}:${a.year}`.localeCompare(`${b.kind}:${b.year}`),
            ),
        );
      await writeFile(
        join(dir, 'manifest.json'),
        JSON.stringify({
          contractVersion: CONTRACT,
          datasetKey: ARCHIVE_UPLOAD_DATASET_KEY,
          datasetVersion: version,
          tenantId: identity.actor.tenantId,
          allUnlinked: true,
          files: stored,
        }),
        { mode: 0o600, flag: 'wx' },
      );
      const job: ImportJob = {
        importId: id,
        tenantId: identity.actor.tenantId,
        datasetVersion: version,
        datasetId: null,
        status: 'VALIDATING',
        duplicateUpload: false,
        currentPublishedDatasetId: null,
        fileRowCounts: {},
        files: stored,
        insurerRowCount: 0,
        reinsurerRowCount: 0,
        warnings: [],
        errors: [],
        createdByUserId: identity.actor.userId,
        createdAt: new Date().toISOString(),
      };
      await this.save(job);
      this.enqueue(id, () => this.process(identity, job), true);
      queued = true;
      return this.response(job);
    } finally {
      if (reservation && !queued) this.active.delete(reservation);
      await removeIncoming(files);
    }
  }
  private async validate(job: ImportJob): Promise<ValidatedDataset> {
    const dir = await this.directory(job.tenantId, job.importId);
    return validateDataset({
      manifestFile: join(dir, 'manifest.json'),
      sourceRoot: dir,
      tenantId: job.tenantId,
      sourceProfile: 'uploaded',
    });
  }
  private async process(
    identity: ImportIdentity,
    job: ImportJob,
    publication?: ArchivePublishDto,
  ) {
    const dir = await this.directory(job.tenantId, job.importId);
    // Filesystem lock complements the existing database dataset advisory lock.
    // Never remove a possibly live lock on another instance automatically.
    let lock: Awaited<ReturnType<typeof open>> | undefined;
    let phase = 'AUTHORIZATION';
    try {
      lock = await open(join(dir, 'execution.lock'), 'wx', 0o600);
      await this.authorize(identity);
      phase = 'VALIDATION';
      const dataset = await this.validate(job);
      phase = 'DATABASE_PLAN';
      if (!publication) {
        const existingVersion = await this.executor.existingVersion(
          dataset,
          identity.actor,
        );
        if (
          existingVersion &&
          existingVersion !== dataset.manifest.datasetVersion
        ) {
          // Content identity excludes version. Preserve a prior CLI/API version,
          // rather than manufacturing a duplicate version of identical content.
          dataset.manifest.datasetVersion = existingVersion;
          job.datasetVersion = existingVersion;
          await writeFile(
            join(dir, 'manifest.json'),
            JSON.stringify(dataset.manifest),
            { mode: 0o600 },
          );
        }
      }
      job.fileRowCounts = Object.fromEntries(
        dataset.files.map((f) => [f.sha256, f.rows.length]),
      );
      const observations = dataset.observations;
      job.insurerRowCount = observations.insurerRows;
      job.reinsurerRowCount = observations.reinsurerRows;
      job.warnings = Object.entries(observations)
        .filter(
          ([key, value]) =>
            value > 0 &&
            !['totalRows', 'insurerRows', 'reinsurerRows'].includes(key),
        )
        .map(([code, count]) => ({ code, count }));
      const plan = await this.executor.plan(
        dataset,
        identity.actor,
        !publication,
      );
      job.currentPublishedDatasetId = plan.currentLoadId;
      if (publication && plan.existingLoadId !== job.datasetId)
        throw new ConflictException('ARCHIVE_IMPORT_STATE_CHANGED');
      job.duplicateUpload = !publication && plan.existingLoadId !== null;
      job.status = publication ? 'PUBLISHING' : 'STAGING';
      await this.save(job);
      await this.authorize(identity);
      phase = 'EXECUTION';
      const result = await this.executor.execute(
        dataset,
        plan,
        publication?.approvalRef ??
          `Authenticated archive upload ${job.importId}: staging only`,
        publication?.replaceDatasetId,
      );
      job.datasetId = result.loadId;
      job.status =
        result.outcome === 'PUBLISHED' ||
        (result.outcome === 'IDEMPOTENT_SKIP' &&
          plan.existingStatus === 'PUBLISHED')
          ? 'PUBLISHED'
          : 'READY';
      if (
        result.outcome === 'IDEMPOTENT_SKIP' &&
        plan.existingStatus === 'SUPERSEDED'
      )
        job.status = 'SUPERSEDED';
      job.errors = [];
    } catch {
      // Do not expose parser cell values, credentials, SQL errors or stack traces.
      if (lock) {
        job.status = 'FAILED';
        job.errors = [`ARCHIVE_${phase}_FAILED`];
      }
    } finally {
      if (lock) {
        try {
          await this.save(job);
        } finally {
          await lock.close();
          await unlink(join(dir, 'execution.lock'));
        }
      }
    }
  }
  async status(identity: ImportIdentity, id: string) {
    await this.authorize(identity);
    const job = await this.job(identity, id);
    if (job.datasetId) {
      job.currentPublishedDatasetId = await this.executor.currentPublication(
        identity.actor,
      );
      const load = await this.executor.status(identity.actor, job.datasetId);
      if (load.status === 'PUBLISHED') job.status = 'PUBLISHED';
      else if (load.status === 'SUPERSEDED') job.status = 'SUPERSEDED';
      else if (load.status !== 'READY' && job.status === 'READY')
        job.status = 'FAILED';
    }
    return this.response(job);
  }
  async publish(
    identity: ImportIdentity,
    id: string,
    confirmation: ArchivePublishDto,
  ) {
    await this.authorize(identity);
    // Resolve inside the authenticated tenant before creating a filesystem claim.
    const initial = await this.job(identity, id);
    if (confirmation.datasetVersion !== initial.datasetVersion)
      throw new ConflictException('ARCHIVE_DATASET_VERSION_CHANGED');
    if (initial.status === 'PUBLISHED') return this.status(identity, id);
    const dir = await this.directory(identity.actor.tenantId, id),
      claimPath = join(dir, 'publication-request.lock');
    let claim: Awaited<ReturnType<typeof open>>;
    try {
      claim = await open(claimPath, 'wx', 0o600);
    } catch {
      throw new ConflictException('ARCHIVE_IMPORT_BUSY');
    }
    let queued = false;
    let reserved = false;
    try {
      const job = await this.job(identity, id);
      if (job.status !== 'READY' || !job.datasetId || this.active.has(id))
        throw new ConflictException('ARCHIVE_IMPORT_NOT_READY');
      if (this.active.size >= 4)
        throw new HttpException('ARCHIVE_IMPORT_QUEUE_FULL', 429);
      const load = await this.executor.status(identity.actor, job.datasetId);
      if (load.status === 'PUBLISHED') {
        job.status = 'PUBLISHED';
        await this.save(job);
        return this.response(job);
      }
      if (
        load.status !== 'READY' ||
        load.datasetVersion !== confirmation.datasetVersion
      )
        throw new ConflictException('ARCHIVE_IMPORT_STATE_CHANGED');
      const currentLoadId = await this.executor.currentPublication(
        identity.actor,
      );
      if (
        currentLoadId &&
        currentLoadId !== job.datasetId &&
        confirmation.replaceDatasetId !== currentLoadId
      )
        throw new ConflictException('ARCHIVE_EXPLICIT_REPLACEMENT_REQUIRED');
      this.reserve(id);
      reserved = true;
      job.status = 'PUBLISHING';
      await this.save(job);
      this.enqueue(
        id,
        async () => {
          try {
            await this.process(identity, job, confirmation);
          } finally {
            await claim.close();
            await unlink(claimPath);
          }
        },
        true,
      );
      queued = true;
      return this.response(job);
    } finally {
      if (!queued) {
        if (reserved) this.active.delete(id);
        await claim.close();
        await unlink(claimPath);
      }
    }
  }
}
