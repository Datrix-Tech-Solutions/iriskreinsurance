import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { readFile, writeFile, copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runArchiveCli } from '../cli/historical-statements';
import { resolve, join } from 'node:path';
import {
  Actor,
  ArchiveDatabase,
  ARCHIVE_TABLES,
  DatabaseIdentity,
} from './database';
import {
  applyDataset,
  planApply,
  planRollback,
  rollbackDataset,
  WriteApproval,
  Plan,
} from './lifecycle';
import { sha, ValidatedDataset, SHEET } from './source-contract';
import { syntheticDataset, workbook } from './test-fixtures';
import { ConfigService } from '@nestjs/config';
import { ArchiveImportExecutor } from '../imports/archive-import.executor';
import { bytesSha, CONTRACT } from './source-contract';
import { validateDataset } from './dataset';

const url = process.env.ARCHIVE_LOADER_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('Archive loader disposable database lifecycle', () => {
  let admin: Client,
    identity: DatabaseIdentity,
    reader: ArchiveDatabase,
    writer: ArchiveDatabase;
  const actor: Actor = {
    tenantId: 'archive-test-tenant',
    tenantSlug: 'archive-test',
    userId: 'archive-test-admin',
    allowUnentitledLocalTest: true,
  };
  const approval = (plan: Plan): WriteApproval => ({
    reviewedPlan: plan,
    approvedPlanSha256: sha(plan),
    expectedManifestSha256: plan.contentManifestSha256,
    confirmTenantId: actor.tenantId,
    confirmDataset: `${plan.datasetKey}@${plan.datasetVersion}`,
    approvalRef: 'SYNTHETIC LOCAL TEST APPROVAL',
    expectedCurrentLoadId: plan.currentLoadId,
    allowArchiveWrite: true,
    ...(plan.currentLoadId ? { replaceLoadId: plan.currentLoadId } : {}),
    ...(plan.existingLoadId ? { resumeLoadId: plan.existingLoadId } : {}),
    ...(plan.loadId ? { confirmLoadId: plan.loadId } : {}),
  });
  const fixture = async () => {
    const f = await syntheticDataset(randomUUID());
    f.data.manifest.datasetKey = 'test-' + randomUUID();
    return f;
  };
  const apply = async (d: ValidatedDataset, stageOnly = false) => {
    const plan = await planApply(reader, d, actor, stageOnly);
    return applyDataset(writer, d, plan, approval(plan));
  };
  beforeAll(async () => {
    const u = new URL(url!);
    if (
      !['127.0.0.1', 'localhost'].includes(u.hostname) ||
      !/^\/irisk_archive_m2a_[a-z0-9_]+$/.test(u.pathname) ||
      u.search ||
      u.hash
    )
      throw new Error(
        'Disposable localhost irisk_archive_m2a_ database required',
      );
    admin = new Client({
      host: u.hostname,
      port: Number(u.port),
      database: u.pathname.slice(1),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      ssl: false,
    });
    await admin.connect();
    const { rows } = await admin.query(
      "SELECT nspname FROM pg_namespace WHERE nspname IN ('reinsurance','w_auth')",
    );
    if (rows.length)
      throw new Error(
        'Integration database must be fresh; never reset an existing database',
      );
    const migrations = resolve(__dirname, '../../../prisma/migrations');
    for (const name of readdirSync(migrations)
      .filter((n) => /^\d/.test(n))
      .sort())
      await admin.query(
        readFileSync(join(migrations, name, 'migration.sql'), 'utf8'),
      );
    await admin.query(
      `CREATE SCHEMA w_auth; CREATE TABLE w_auth."Tenant" (id text PRIMARY KEY,slug text,status text,"historicalStatementsEnabled" boolean,"moduleConfig" jsonb,"featureConfig" jsonb);CREATE TABLE w_auth."User" (id text PRIMARY KEY,"tenantId" text,role text,status text);INSERT INTO w_auth."Tenant" VALUES ('archive-test-tenant','archive-test','ACTIVE',false,'{"operations":true}','{"operations":{"reinsurance":true}}');INSERT INTO w_auth."User" VALUES ('archive-test-admin','archive-test-tenant','TENANT_ADMIN','ACTIVE')`,
    );
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8),
      loadRole = 'archive_loader_' + suffix,
      readRole = 'archive_reader_' + suffix;
    await admin.query(
      `CREATE ROLE ${loadRole} LOGIN PASSWORD 'synthetic_archive_only'; CREATE ROLE ${readRole} LOGIN PASSWORD 'synthetic_archive_only';REVOKE CREATE ON SCHEMA public FROM PUBLIC;GRANT USAGE ON SCHEMA reinsurance,w_auth TO ${loadRole},${readRole};GRANT SELECT ON w_auth."Tenant",w_auth."User" TO ${loadRole},${readRole}`,
    );
    for (const t of ARCHIVE_TABLES)
      await admin.query(
        `GRANT SELECT ON reinsurance."${t}" TO ${readRole};GRANT SELECT,INSERT,${t === 'historical_statement_load' ? 'UPDATE' : 'DELETE'} ON reinsurance."${t}" TO ${loadRole}`,
      );
    identity = {
      environment: 'local',
      host: u.hostname,
      port: Number(u.port),
      database: u.pathname.slice(1),
      schema: 'reinsurance',
      role: loadRole,
      readRole,
      purpose: 'DISPOSABLE_TEST',
    };
    const dbUrl = (role: string) =>
      `postgresql://${role}:synthetic_archive_only@${u.hostname}:${u.port}${u.pathname}`;
    reader = new ArchiveDatabase(dbUrl(readRole), identity, 'read');
    writer = new ArchiveDatabase(dbUrl(loadRole), identity, 'write');
    await reader.connect();
    await writer.connect();
  }, 60000);
  afterAll(async () => {
    await reader?.close();
    await writer?.close();
    await admin?.end();
  });
  it('enforces reader/loader privileges and disabled entitlement except exact disposable opt-in', async () => {
    await reader.verifyPrivileges(false);
    await writer.verifyPrivileges(true);
    await admin.query(
      `GRANT UPDATE ON reinsurance.historical_insurer_statement TO ${identity.role}`,
    );
    await expect(writer.verifyPrivileges(true)).rejects.toThrow('privileges');
    await admin.query(
      `REVOKE UPDATE ON reinsurance.historical_insurer_statement FROM ${identity.role}`,
    );
    await admin.query(
      `GRANT INSERT (id) ON reinsurance.historical_insurer_statement TO ${identity.readRole}`,
    );
    await expect(reader.verifyPrivileges(false)).rejects.toThrow('privileges');
    await admin.query(
      `REVOKE INSERT (id) ON reinsurance.historical_insurer_statement FROM ${identity.readRole}`,
    );

    await expect(reader.verifyPrivileges(true)).rejects.toThrow();
    await expect(
      writer.query('UPDATE reinsurance."Placement" SET status=status'),
    ).rejects.toThrow('permission denied');
    await expect(
      reader.query('DELETE FROM reinsurance.historical_insurer_statement'),
    ).rejects.toThrow('permission denied');
    await expect(
      reader.verifyActor({ ...actor, allowUnentitledLocalTest: false }),
    ).rejects.toThrow('disabled');
    await expect(
      reader.verifyActor({ ...actor, tenantId: 'forged' }),
    ).rejects.toThrow('exact');
    expect(
      (
        await admin.query<{ historicalStatementsEnabled: boolean }>(
          'SELECT "historicalStatementsEnabled" FROM w_auth."Tenant"',
        )
      ).rows,
    ).toEqual([{ historicalStatementsEnabled: false }]);
  });
  it('stages all rows, preserves decimals/dates/duplicates, publishes only complete content and skips identical renamed files', async () => {
    const { data, root } = await fixture();
    const result = await apply(data);
    expect(result.outcome).toBe('PUBLISHED');
    const [{ amount, date, count }] = await reader.query<{
      amount: string;
      date: string;
      count: string;
    }>(
      `SELECT min("sumInsured100")::text AS amount,min("endDate")::text AS date,count(*)::text AS count FROM reinsurance.historical_insurer_statement WHERE "loadId"=$1`,
      [result.loadId],
    );
    expect(amount).toBe('-123456789012345.123456789012');
    expect(date).toBe('0021-02-01');
    expect(count).toBe('10');
    for (const f of data.files) {
      const renamed = join(root, 'renamed-' + f.fileName);
      await copyFile(f.input.path, renamed);
      f.input.path = renamed;
      f.fileName = 'renamed-' + f.fileName;
    }
    expect((await apply(data)).outcome).toBe('IDEMPOTENT_SKIP');
  });
  it('rejects changed content under the same immutable version and stale approvals', async () => {
    const { data } = await fixture();
    await apply(data);
    data.contentManifestSha256 = 'a'.repeat(64);
    expect((await planApply(reader, data, actor)).action).toBe('CONFLICT');
    const fresh = (await fixture()).data,
      plan = await planApply(reader, fresh, actor);
    await expect(
      applyDataset(writer, fresh, plan, {
        ...approval(plan),
        confirmTenantId: 'other',
      }),
    ).rejects.toThrow('mismatch');
  });
  it('resumes verified bounded staging after interruption without duplicated rows', async () => {
    const { data } = await fixture(),
      plan = await planApply(reader, data, actor);
    await expect(
      applyDataset(writer, data, plan, approval(plan), {
        batchSize: 1,
        interruptAfterBatches: 1,
      }),
    ).rejects.toThrow('interruption');
    const next = await planApply(reader, data, actor);
    expect(next).toMatchObject({ action: 'RESUME', existingStatus: 'FAILED' });
    expect(
      (await applyDataset(writer, data, next, approval(next))).outcome,
    ).toBe('PUBLISHED');
    const [{ count }] = await reader.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM reinsurance.historical_insurer_statement WHERE "loadId"=$1',
      [next.existingLoadId],
    );
    expect(count).toBe('10');
  });
  it('refuses changed staged typed values before resuming or publication', async () => {
    const { data } = await fixture(),
      plan = await planApply(reader, data, actor);
    await expect(
      applyDataset(writer, data, plan, approval(plan), {
        batchSize: 1,
        interruptAfterBatches: 1,
      }),
    ).rejects.toThrow();
    data.files[0].rows[0].fields.facPremium = '999';
    const next = await planApply(reader, data, actor);
    await expect(
      applyDataset(writer, data, next, approval(next)),
    ).rejects.toThrow(/typed field|search metadata/);
  });
  it('atomically supersedes the old visible dataset and rejects a stale publication plan', async () => {
    const { data: one } = await fixture();
    const old = await apply(one);
    const { data: two } = await fixture();
    two.manifest.datasetKey = one.manifest.datasetKey;
    const stale = await planApply(reader, two, actor);
    const missingReplacement = approval(stale);
    delete missingReplacement.replaceLoadId;
    await expect(
      applyDataset(writer, two, stale, missingReplacement),
    ).rejects.toThrow('replacement load confirmation');
    const next = await apply(two);
    expect(next.outcome).toBe('PUBLISHED');
    const states = await reader.query<{ id: string; status: string }>(
      'SELECT id,status FROM reinsurance.historical_statement_load WHERE "tenantId"=$1 AND "datasetKey"=$2',
      [actor.tenantId, one.manifest.datasetKey],
    );
    expect(states.find((x) => x.id === old.loadId)?.status).toBe('SUPERSEDED');
    expect(states.filter((x) => x.status === 'PUBLISHED')).toHaveLength(1);
    await expect(
      applyDataset(writer, two, stale, approval(stale)),
    ).rejects.toThrow('changed');
  });
  it('rolls back supersession when replacement publication fails inside the transaction', async () => {
    const { data: one } = await fixture();
    const old = await apply(one);
    const { data: two } = await fixture();
    two.manifest.datasetKey = one.manifest.datasetKey;
    await admin.query(
      `CREATE FUNCTION reinsurance.archive_test_publication_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='PUBLISHED' AND NEW."publicationApprovalRef"='synthetic force failure' THEN RAISE EXCEPTION 'simulated publication failure'; END IF;RETURN NEW;END $$;CREATE TRIGGER archive_test_publication_failure BEFORE UPDATE ON reinsurance.historical_statement_load FOR EACH ROW EXECUTE FUNCTION reinsurance.archive_test_publication_failure()`,
    );
    try {
      const plan = await planApply(reader, two, actor);
      await expect(
        applyDataset(writer, two, plan, {
          ...approval(plan),
          approvalRef: 'synthetic force failure',
        }),
      ).rejects.toThrow('simulated publication failure');
      expect(
        (
          await reader.query<{ status: string }>(
            'SELECT status FROM reinsurance.historical_statement_load WHERE id=$1',
            [old.loadId],
          )
        )[0].status,
      ).toBe('PUBLISHED');
      expect((await planApply(reader, two, actor)).existingStatus).toBe(
        'FAILED',
      );
    } finally {
      await admin.query(
        'DROP TRIGGER archive_test_publication_failure ON reinsurance.historical_statement_load;DROP FUNCTION reinsurance.archive_test_publication_failure()',
      );
    }
  });
  it('rejects concurrent loaders before any staging writes and releases dataset locks', async () => {
    const { data } = await fixture();
    const plan = await planApply(reader, data, actor);
    await reader.locked(actor.tenantId, data.manifest.datasetKey, async () => {
      await expect(
        applyDataset(writer, data, plan, approval(plan)),
      ).rejects.toThrow('locked');
    });
    expect((await apply(data)).outcome).toBe('PUBLISHED');
  });
  it('stores approved links and their exact evidence, and refuses invalid cross-tenant/dataset links', async () => {
    const { data } = await fixture(),
      ce = data.files[0],
      re = data.files[1];
    const ref = (f: typeof ce) => ({
      fileSha256: f.sha256,
      sheet: SHEET,
      sourceRow: 2,
      rowSha256: f.rows[0].rowSha256,
    });
    data.links = [
      {
        matchId: 'approved-synthetic',
        insurer: ref(ce),
        reinsurers: [ref(re)],
        basis: 'APPROVED_CANDIDATE',
        approvalRef: 'synthetic approval only',
        approvedByUserId: actor.userId,
        approvedAt: '2026-11-05T00:00:00.000Z',
        evidence: { synthetic: true },
      },
    ];
    data.manifest.allUnlinked = false;
    data.contentManifestSha256 = sha(data.links);
    const r = await apply(data);
    expect((await apply(data)).outcome).toBe('IDEMPOTENT_SKIP');
    const [{ count }] = await reader.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM reinsurance.historical_statement_link WHERE "loadId"=$1',
      [r.loadId],
    );
    expect(count).toBe('1');
    await expect(
      writer.query(
        'UPDATE reinsurance.historical_statement_link SET "tenantId"=$1 WHERE "loadId"=$2',
        ['other', r.loadId],
      ),
    ).rejects.toThrow();
  });
  it('rolls back only the confirmed tenant/load, retains manifests/events, and is explicitly repeatable', async () => {
    const { data } = await fixture();
    const r = await apply(data);
    const plan = await planRollback(reader, actor, r.loadId);
    await expect(
      rollbackDataset(writer, plan, {
        ...approval(plan),
        confirmLoadId: 'wrong',
      }),
    ).rejects.toThrow('confirmation');
    expect((await rollbackDataset(writer, plan, approval(plan))).outcome).toBe(
      'ROLLED_BACK',
    );
    for (const t of ARCHIVE_TABLES.filter(
      (x) => x !== 'historical_statement_load',
    ))
      expect(
        (
          await reader.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM reinsurance."${t}" WHERE "tenantId"=$1 AND "loadId"=$2`,
            [actor.tenantId, r.loadId],
          )
        )[0].count,
      ).toBe('0');
    const [retained] = await reader.query<{
      sourceManifest: {
        files: {
          byteSize: string;
          physicalRowCount: number;
          businessRowCount: number;
          headerCells: unknown[];
          workbookMetadata: unknown;
        }[];
      };
    }>(
      'SELECT "sourceManifest" FROM reinsurance.historical_statement_load WHERE id=$1',
      [r.loadId],
    );
    expect(retained.sourceManifest.files).toHaveLength(10);
    expect(retained.sourceManifest.files[0]).toMatchObject({
      byteSize: String(data.files[0].byteSize),
      physicalRowCount: 3,
      businessRowCount: 2,
    });
    expect(retained.sourceManifest.files[0].headerCells).toHaveLength(29);
    const again = await planRollback(reader, actor, r.loadId);
    expect(
      (await rollbackDataset(writer, again, approval(again))).outcome,
    ).toBe('ALREADY_ROLLED_BACK');
    expect(
      (
        await reader.query<{ status: string }>(
          'SELECT status FROM reinsurance.historical_statement_load WHERE id=$1',
          [r.loadId],
        )
      )[0].status,
    ).toBe('ROLLED_BACK');
    await expect(
      planRollback(reader, { ...actor, tenantId: 'other' }, r.loadId),
    ).rejects.toThrow();
  });
  it('never writes operational tables or enables tenant access', async () => {
    const tables = (
      await admin.query<{ name: string }>(
        `SELECT tablename AS name FROM pg_tables WHERE schemaname='reinsurance' AND tablename NOT LIKE 'historical_%'`,
      )
    ).rows;
    for (const { name } of tables) {
      const result = await admin.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM reinsurance."${name.replace(/"/g, '""')}"`,
      );
      expect(result.rows[0].count).toBe('0');
    }
    expect(
      (
        await admin.query<{ historicalStatementsEnabled: boolean }>(
          'SELECT "historicalStatementsEnabled" FROM w_auth."Tenant"',
        )
      ).rows[0].historicalStatementsEnabled,
    ).toBe(false);
  });
  const corpus =
    process.env.ARCHIVE_SOURCE_MANIFEST_FILE && process.env.ARCHIVE_SOURCE_ROOT
      ? it
      : it.skip;
  corpus(
    'retains all 16,521 real source rows in an UNPUBLISHED disposable load then archive-only rollback',
    async () => {
      const data = await validateDataset({
        manifestFile: process.env.ARCHIVE_SOURCE_MANIFEST_FILE!,
        sourceRoot: process.env.ARCHIVE_SOURCE_ROOT!,
      });
      expect(data.discrepancies).toEqual([]);
      const outputRoot = await mkdtemp(
        join(tmpdir(), 'irisk-archive-cli-test-'),
      );
      const identityFile = join(outputRoot, 'identity.json');
      await writeFile(identityFile, JSON.stringify(identity), { mode: 0o600 });
      const args = [
        '--identity-file',
        identityFile,
        '--environment',
        'local',
        '--tenant-id',
        actor.tenantId,
        '--tenant-slug',
        actor.tenantSlug,
        '--import-user-id',
        actor.userId,
        '--allow-unentitled-local-test',
        '--stage-only',
        '--manifest-file',
        process.env.ARCHIVE_SOURCE_MANIFEST_FILE!,
        '--source-root',
        process.env.ARCHIVE_SOURCE_ROOT!,
      ];
      const env = {
        ARCHIVE_READ_DATABASE_URL: `postgresql://${identity.readRole}:synthetic_archive_only@${identity.host}:${identity.port}/${identity.database}`,
        ARCHIVE_WRITE_DATABASE_URL: `postgresql://${identity.role}:synthetic_archive_only@${identity.host}:${identity.port}/${identity.database}`,
      };
      const planFile = join(outputRoot, 'plan.json');
      await runArchiveCli(
        ['--mode', 'dry-run', ...args, '--output-file', planFile],
        env,
      );
      const reviewed: unknown = JSON.parse(await readFile(planFile, 'utf8'));
      if (!reviewed || typeof reviewed !== 'object' || !('plan' in reviewed))
        throw new Error('Missing CLI plan');
      const reviewedPlan = reviewed.plan as Plan;
      const resultFile = join(outputRoot, 'apply.json');
      await runArchiveCli(
        [
          '--mode',
          'apply',
          ...args,
          '--output-file',
          resultFile,
          '--allow-archive-write',
          '--reviewed-plan-file',
          planFile,
          '--approved-plan-sha256',
          sha(reviewedPlan),
          '--expected-manifest-sha256',
          reviewedPlan.contentManifestSha256,
          '--confirm-tenant-id',
          actor.tenantId,
          '--confirm-dataset',
          `${reviewedPlan.datasetKey}@${reviewedPlan.datasetVersion}`,
          '--approval-ref',
          'UNPUBLISHED DISPOSABLE TEST ONLY',
          '--expected-current-load-id',
          'NONE',
        ],
        env,
      );
      const result: unknown = JSON.parse(await readFile(resultFile, 'utf8'));
      if (!result || typeof result !== 'object' || !('result' in result))
        throw new Error('Missing CLI result');
      const r = result.result as {
        loadId: string;
        outcome: string;
        counts: Record<string, number>;
      };
      expect(r.outcome).toBe('READY_UNPUBLISHED');
      expect(r.counts).toMatchObject({
        insurerRows: 4358,
        reinsurerRows: 12163,
      });
      const plan = await planRollback(reader, actor, r.loadId);
      expect(
        (await rollbackDataset(writer, plan, approval(plan))).outcome,
      ).toBe('ROLLED_BACK');
      if (process.env.ARCHIVE_TEST_EVIDENCE_FILE)
        await writeFile(
          process.env.ARCHIVE_TEST_EVIDENCE_FILE,
          JSON.stringify(
            {
              timezone: process.env.TZ,
              postgres: (await admin.query('SHOW server_version')).rows,
              load: r,
              rollback: 'ROLLED_BACK',
              unpublished: true,
              observations: data.observations,
              sourceHashes: data.files.map((f) => ({
                name: f.fileName,
                sha256: f.sha256,
                unchanged: true,
              })),
              operationalWrites: 0,
              tenantEnabled: false,
            },
            null,
            2,
          ),
          { mode: 0o600 },
        );
    },
    180000,
  );
  it('stages and atomically publishes uploaded synthetic workbooks through restricted executor roles', async () => {
    // Proposed Auth permission migration is additive, exercised only here.
    await admin.query(
      `CREATE TYPE w_auth."PermissionAction" AS ENUM ('VIEW','CREATE','EDIT','DELETE','APPROVE','RUN','EXPORT','ASSIGN')`,
    );
    await admin.query(
      readFileSync(
        resolve(
          __dirname,
          '../../../../auth-service/prisma/migrations/20261106160000_add_historical_statement_import_permission/migration.sql',
        ),
        'utf8',
      ),
    );
    const enumValues = await admin.query<{ action: string }>(
      `SELECT unnest(enum_range(NULL::w_auth."PermissionAction"))::text AS action`,
    );
    expect(enumValues.rows.map((row) => row.action)).toContain('IMPORT');
    const root = await mkdtemp(join(tmpdir(), 'archive-api-db-'));
    const files = [];
    for (let year = 2021; year <= 2025; year++)
      for (const kind of ['INSURER', 'REINSURER'] as const) {
        const bytes = workbook(kind, `api-${kind}-${year}`),
          path = `${kind}-${year}.xlsx`;
        await writeFile(join(root, path), bytes);
        files.push({ path, kind, year, sha256: bytesSha(bytes) });
      }
    await writeFile(
      join(root, 'manifest.json'),
      JSON.stringify({
        contractVersion: CONTRACT,
        datasetKey: 'historical-statements-2021-2025',
        datasetVersion: 'synthetic-api-v1',
        tenantId: actor.tenantId,
        allUnlinked: true,
        files,
      }),
    );
    const data = await validateDataset({
      sourceRoot: root,
      manifestFile: join(root, 'manifest.json'),
      sourceProfile: 'uploaded',
    });
    expect(data.discrepancies).toEqual([]);
    const identityPath = join(root, 'identity.json');
    await writeFile(
      identityPath,
      JSON.stringify({ ...identity, purpose: 'ARCHIVE' }),
    );
    const settings: Record<string, string> = {
      ARCHIVE_DATABASE_IDENTITY_FILE: identityPath,
      ARCHIVE_READ_DATABASE_URL: `postgresql://${identity.readRole}:synthetic_archive_only@${identity.host}:${identity.port}/${identity.database}`,
      ARCHIVE_WRITE_DATABASE_URL: `postgresql://${identity.role}:synthetic_archive_only@${identity.host}:${identity.port}/${identity.database}`,
    };
    const executor = new ArchiveImportExecutor(new ConfigService(settings));
    const currentActor = {
      tenantId: actor.tenantId,
      tenantSlug: actor.tenantSlug,
      userId: actor.userId,
    };
    await admin.query(
      `UPDATE w_auth."Tenant" SET "historicalStatementsEnabled"=true WHERE id=$1`,
      [actor.tenantId],
    );
    try {
      await executor.preflight(currentActor);
      expect(await executor.existingVersion(data, currentActor)).toBeNull();
      const operationalBefore = await admin.query(
        `SELECT (SELECT count(*) FROM reinsurance."Placement")::int AS placements,(SELECT count(*) FROM reinsurance."PlacementPayment")::int AS payments`,
      );
      const stagePlan = await executor.plan(data, currentActor, true);
      const staged = await executor.execute(
        data,
        stagePlan,
        'Synthetic upload: staging only',
      );
      expect(staged.outcome).toBe('READY_UNPUBLISHED');
      expect(await executor.existingVersion(data, currentActor)).toBe(
        'synthetic-api-v1',
      );
      expect((await executor.status(currentActor, staged.loadId)).status).toBe(
        'READY',
      );
      expect(await executor.currentPublication(currentActor)).toBeNull();
      const publishPlan = await executor.plan(data, currentActor, false);
      await executor.execute(
        data,
        publishPlan,
        'Synthetic explicit all-unlinked approval',
      );
      expect((await executor.status(currentActor, staged.loadId)).status).toBe(
        'PUBLISHED',
      );
      const rows = await admin.query(
        `SELECT (SELECT count(*) FROM reinsurance.historical_insurer_statement WHERE "loadId"=$1)::int AS insurers,(SELECT count(*) FROM reinsurance.historical_reinsurer_statement WHERE "loadId"=$1)::int AS reinsurers`,
        [staged.loadId],
      );
      expect(rows.rows[0]).toEqual({ insurers: 10, reinsurers: 10 });
      const replacementRoot = join(root, 'replacement');
      await import('node:fs/promises').then((fs) => fs.mkdir(replacementRoot));
      const replacementFiles = [];
      for (const file of files) {
        const bytes = workbook(
          file.kind,
          `replacement-${file.kind}-${file.year}`,
        );
        await writeFile(join(replacementRoot, file.path), bytes);
        replacementFiles.push({ ...file, sha256: bytesSha(bytes) });
      }
      await writeFile(
        join(replacementRoot, 'manifest.json'),
        JSON.stringify({
          ...data.manifest,
          datasetVersion: 'synthetic-api-v2',
          files: replacementFiles,
        }),
      );
      const replacementData = await validateDataset({
        sourceRoot: replacementRoot,
        manifestFile: join(replacementRoot, 'manifest.json'),
        sourceProfile: 'uploaded',
      });
      const replacementStage = await executor.plan(
        replacementData,
        currentActor,
        true,
      );
      const replacement = await executor.execute(
        replacementData,
        replacementStage,
        'Synthetic replacement staging only',
      );
      expect((await executor.status(currentActor, staged.loadId)).status).toBe(
        'PUBLISHED',
      );
      expect(
        (await executor.status(currentActor, replacement.loadId)).status,
      ).toBe('READY');
      await expect(
        executor.execute(
          replacementData,
          await executor.plan(replacementData, currentActor, false),
          'Unconfirmed replacement',
        ),
      ).rejects.toThrow('ARCHIVE_EXPLICIT_REPLACEMENT_REQUIRED');
      const repeat = await executor.plan(data, currentActor, false);
      expect(
        (await executor.execute(data, repeat, 'Synthetic retry')).outcome,
      ).toBe('IDEMPOTENT_SKIP');
      expect(
        await admin
          .query<{
            placements: number;
            payments: number;
          }>(
            `SELECT (SELECT count(*) FROM reinsurance."Placement")::int AS placements,(SELECT count(*) FROM reinsurance."PlacementPayment")::int AS payments`,
          )
          .then((r) => r.rows),
      ).toEqual(operationalBefore.rows);
      await expect(
        executor.status(
          { ...currentActor, tenantId: 'other-tenant' },
          staged.loadId,
        ),
      ).rejects.toThrow();
    } finally {
      await admin.query(
        `UPDATE w_auth."Tenant" SET "historicalStatementsEnabled"=false WHERE id=$1`,
        [actor.tenantId],
      );
    }
  }, 60000);
});
