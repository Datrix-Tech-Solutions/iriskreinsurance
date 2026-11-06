import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, ClientConfig } from 'pg';
import { PrismaClient } from '../../prisma/generated/client';

// Deliberately no DATABASE_URL fallback. The main agent provisions a fresh database.
const archiveUrl = process.env.ARCHIVE_TEST_DATABASE_URL;
const databaseDescribe = archiveUrl ? describe : describe.skip;
const migrationName = '20261105130000_add_historical_statement_archive';
const migrationRoot = resolve(__dirname, '../../prisma/migrations');
const actor = 'test-admin';
const now = '2026-11-05T13:00:00.000Z';
const precise = '-123456789012345.123456789012';
const sheetName = 'Brokerage Statement';
const tables = {
  load: 'historical_statement_load',
  file: 'historical_statement_file',
  insurer: 'historical_insurer_statement',
  reinsurer: 'historical_reinsurer_statement',
  link: 'historical_statement_link',
} as const;
type RecordData = Record<string, unknown>;
type Status =
  | 'STAGING'
  | 'READY'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'FAILED'
  | 'ROLLED_BACK';
type Fixture = {
  load: RecordData;
  files: RecordData[];
  insurer: RecordData;
  reinsurer: RecordData;
  link: RecordData;
};
const ident = (value: string) => `"${value.replace(/"/g, '""')}"`;
const table = (name: string) => `"reinsurance".${ident(name)}`;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const event = (status: Status) => ({ status, actorUserId: actor, at: now });
const jsonValue = (value: unknown) =>
  value !== null && typeof value === 'object' ? JSON.stringify(value) : value;

function safeConfig(value: string): ClientConfig {
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !/^\/irisk_archive_m1_[a-zA-Z0-9_]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'ARCHIVE_TEST_DATABASE_URL requires explicit localhost/127.0.0.1 and irisk_archive_m1_ database; query parameters and fragments are forbidden',
    );
  }
  // Construct fields explicitly so query parameters / PGHOST cannot redirect a connection.
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username) || 'archive_test',
    password: decodeURIComponent(url.password),
    ssl: false,
    connectionTimeoutMillis: 3000,
    application_name: 'archive-m1-jest',
    options: '-c statement_timeout=5000 -c lock_timeout=3000',
  };
}

function cells(sourceRow: number): RecordData[] {
  return Array.from({ length: 29 }, (_, index) => {
    const columnIndex = index + 1;
    const columnLetter =
      columnIndex <= 26
        ? String.fromCharCode(64 + columnIndex)
        : `A${String.fromCharCode(38 + columnIndex)}`;
    return {
      columnIndex,
      columnLetter,
      sourceAddress: `${columnLetter}${sourceRow}`,
      state: 'VALUE',
      type: 'INLINE_STRING',
      xmlValue: 'synthetic',
      resolvedText: 'synthetic',
      styleIndex: null,
      formula: null,
      formulaAttributes: null,
      cachedValue: null,
      ...(index === 0
        ? {
            type: 'NUMBER',
            xmlValue: precise,
            resolvedText: precise,
            styleIndex: 1,
          }
        : {}),
      ...(index === 1
        ? {
            type: 'FORMULA',
            xmlValue: null,
            formula: 'A2*1',
            formulaAttributes: { t: 'normal' },
            cachedValue: precise,
          }
        : {}),
      ...(index === 2
        ? { state: 'BLANK', type: null, xmlValue: null, resolvedText: null }
        : {}),
      ...(index === 3
        ? { state: 'MISSING', type: null, xmlValue: null, resolvedText: null }
        : {}),
    };
  });
}

async function insert(
  client: Client,
  name: string,
  data: RecordData,
  schema = 'reinsurance',
) {
  const keys = Object.keys(data);
  await client.query(
    `INSERT INTO ${ident(schema)}.${ident(name)} (${keys.map(ident).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
    keys.map((key) => jsonValue(data[key])),
  );
}
async function update(
  client: Client,
  name: string,
  id: unknown,
  patch: RecordData,
) {
  const keys = Object.keys(patch);
  return client.query(
    `UPDATE ${table(name)} SET ${keys.map((key, i) => `${ident(key)}=$${i + 2}`).join(',')} WHERE "id"=$1`,
    [id, ...keys.map((key) => jsonValue(patch[key]))],
  );
}

// Snapshot every pre-existing relation, its complete columns/constraints/indexes/
// triggers/policies, plus namespaces, enum labels and functions. Archive additions
// are excluded only by their names; any alteration to an operational object stays visible.
async function operationalSnapshot(client: Client) {
  const catalog = await client.query<{ entry: unknown }>(`
    SELECT entry FROM (SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,
      'record',to_jsonb(c),
      'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0),
      'defaults',(SELECT jsonb_agg(pg_get_expr(d.adbin,d.adrelid) ORDER BY d.adnum) FROM pg_attrdef d WHERE d.adrelid=c.oid),
      'constraints',(SELECT jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
      'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid) FROM pg_index i WHERE i.indrelid=c.oid),
      'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid),
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid)) AS entry
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
      AND c.relname NOT LIKE 'historical_%'
    UNION ALL
    SELECT jsonb_build_object('kind','namespace','record',to_jsonb(n)) FROM pg_namespace n
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
    UNION ALL
    SELECT jsonb_build_object('kind','enum','schema',n.nspname,'name',t.typname,
      'labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid))
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE t.typtype='e' AND n.nspname NOT LIKE 'pg_%' AND t.typname NOT LIKE 'HistoricalStatement%'
    UNION ALL
    SELECT jsonb_build_object('kind','function','definition',pg_get_functiondef(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND p.proname NOT LIKE 'historical_%'
    ) snapshot ORDER BY entry::text
  `);
  const relations = await client.query<{ schema: string; name: string }>(`
    SELECT n.nspname AS schema,c.relname AS name FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%'
      AND n.nspname<>'information_schema' AND c.relname NOT LIKE 'historical_%'
    ORDER BY n.nspname,c.relname
  `);
  const data: Record<string, unknown> = {};
  for (const row of relations.rows) {
    const result = await client.query<{ rows: unknown }>(
      `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM ${ident(row.schema)}.${ident(row.name)} t`,
    );
    data[`${row.schema}.${row.name}`] = result.rows[0].rows;
  }
  return { catalog: catalog.rows.map((row) => row.entry), data };
}

databaseDescribe(
  'Historical statement archive PostgreSQL constraints (explicit opt-in)',
  () => {
    let db: Client;
    let config: ClientConfig;
    let baseline: Awaited<ReturnType<typeof operationalSnapshot>>;
    let initialized = false;

    beforeAll(async () => {
      config = safeConfig(archiveUrl!);
      db = new Client(config);
      await db.connect();
      const identity = await db.query<{ database: string; address: string }>(
        'SELECT current_database() AS database, host(inet_server_addr()) AS address',
      );
      expect(identity.rows[0].database).toBe(config.database);
      expect(identity.rows[0].address).toMatch(/^(127\.0\.0\.1|::1)$/);
      const existing = await db.query(`
      SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%'
      AND nspname NOT IN ('information_schema','public')
    `);
      expect(existing.rows).toEqual([]);
      const objects = await db.query(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
    `);
      expect(objects.rows).toEqual([]);
      const migrations = readdirSync(migrationRoot)
        .filter((name) => /^\d/.test(name))
        .sort();
      expect(migrations.at(-1)).toBe(migrationName);
      for (const name of migrations.filter((name) => name !== migrationName)) {
        await db.query(
          readFileSync(resolve(migrationRoot, name, 'migration.sql'), 'utf8'),
        );
      }
      await insert(db, 'Currency', {
        id: 'archive-test-currency-sentinel',
        tenantId: 'synthetic-tenant',
        isoCode: 'ZZZ',
        name: 'Synthetic sentinel',
        symbol: 'ZZ',
        exchangeRateToBase: '1.234567',
        isBaseCurrency: false,
        isActive: true,
        displayOrder: 7,
        createdByUserId: actor,
        updatedByUserId: actor,
        updatedAt: now,
      });
      baseline = await operationalSnapshot(db);
      await db.query(
        readFileSync(
          resolve(migrationRoot, migrationName, 'migration.sql'),
          'utf8',
        ),
      );
      expect(await operationalSnapshot(db)).toEqual(baseline);
      initialized = true;
    }, 60000);

    beforeEach(async () => {
      await db.query('BEGIN');
    });
    afterEach(async () => {
      if (db) await db.query('ROLLBACK');
    });
    afterAll(async () => {
      if (!db) return;
      try {
        await db.query('ROLLBACK');
        if (initialized)
          expect(await operationalSnapshot(db)).toEqual(baseline);
      } finally {
        await db.end();
      }
    });

    async function rejects(action: () => Promise<unknown>, code: string) {
      await db.query('SAVEPOINT expected_rejection');
      try {
        await expect(action()).rejects.toMatchObject({ code });
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT expected_rejection');
        await db.query('RELEASE SAVEPOINT expected_rejection');
      }
    }

    async function fixture(overrides: RecordData = {}): Promise<Fixture> {
      const id = randomUUID();
      const load: RecordData = {
        id,
        tenantId: 'tenant-a',
        datasetKey: `synthetic-${id}`,
        datasetVersion: id,
        contentManifestSha256: hash(id),
        contractVersion: 'test-v1',
        parserVersion: 'test-v1',
        loaderVersion: 'test-v1',
        status: 'STAGING',
        validationSummary: {},
        progress: {},
        lifecycleEvents: [event('STAGING')],
        createdByUserId: actor,
        updatedAt: now,
        ...overrides,
      };
      const files = (['INSURER', 'REINSURER'] as const).map((kind) => ({
        id: randomUUID(),
        tenantId: load.tenantId,
        loadId: id,
        kind,
        year: 2021,
        originalFileName: `synthetic-${kind}.xlsx`,
        byteSize: '100',
        sha256: hash(`${id}-${kind}`),
        sheetName,
        sheetXmlPath: 'xl/worksheets/sheet1.xml',
        headerSha256: hash(`header-${kind}`),
        headerCells: cells(1),
        workbookMetadata: {},
        physicalRowCount: 4,
        businessRowCount: 1,
        sourceColumnCount: 29,
        rawStorageProvider: 'synthetic',
        rawStorageKey: `synthetic/${id}/${kind}`,
        createdByUserId: actor,
      }));
      load.sourceManifest = overrides.sourceManifest ?? {
        files: files.map((file) => ({
          sha256: file.sha256,
          kind: file.kind,
          year: file.year,
          sheetName: file.sheetName,
          headerSha256: file.headerSha256,
        })),
      };
      await insert(db, tables.load, load);
      for (const file of files) await insert(db, tables.file, file);
      const row = (file: RecordData): RecordData => ({
        id: randomUUID(),
        tenantId: load.tenantId,
        loadId: id,
        fileId: file.id,
        year: 2021,
        sourceRow: 2,
        rowSha256: hash(`row-${String(file.id)}`),
        rawCells: cells(2),
        qualityFlags: [],
        policySearch: 'synthetic-policy',
        insuredSearch: 'synthetic-insured',
        businessSearch: 'synthetic-business',
        counterpartySearch: 'synthetic-counterparty',
        reinsuredSearch: '',
        searchText: 'synthetic',
        createdByUserId: actor,
        currency: 'ZZZ',
        premium100: precise,
      });
      const insurer: RecordData = { ...row(files[0]), matchId: `match-${id}` };
      const reinsurer = row(files[1]);
      await insert(db, tables.insurer, insurer);
      await insert(db, tables.reinsurer, reinsurer);
      const link: RecordData = {
        id: randomUUID(),
        tenantId: load.tenantId,
        loadId: id,
        matchId: insurer.matchId,
        insurerRowId: insurer.id,
        reinsurerRowId: reinsurer.id,
        basis: 'SUPPLIED_AUTHORITATIVE',
        approvalRef: 'synthetic-approval',
        evidence: { synthetic: true },
        evidenceSha256: hash('synthetic-evidence'),
        approvedByUserId: actor,
        approvedAt: now,
        createdByUserId: actor,
      };
      await insert(db, tables.link, link);
      return { load, files, insurer, reinsurer, link };
    }

    async function transition(
      client: Client,
      f: Fixture,
      status: Status,
      patch: RecordData = {},
    ) {
      const previous = await client.query<{ lifecycleEvents: unknown[] }>(
        `SELECT "lifecycleEvents" FROM ${table(tables.load)} WHERE id=$1`,
        [f.load.id],
      );
      const metadata: Partial<Record<Status, RecordData>> = {
        READY: {
          readyAt: now,
          validationSummary: {
            validated: true,
            fileCount: 2,
            insurerRowCount: 1,
            reinsurerRowCount: 1,
            linkCount: 1,
          },
        },
        PUBLISHED: {
          publishedAt: now,
          publishedByUserId: actor,
          publicationApprovalRef: 'synthetic-publication-approval',
        },
        SUPERSEDED: { supersededAt: now },
        FAILED: {
          failedAt: now,
          errorSummary: { reason: 'synthetic failure' },
        },
        ROLLED_BACK: {
          rolledBackAt: now,
          rolledBackByUserId: actor,
          rollbackReason: 'synthetic rollback',
        },
      };
      await update(client, tables.load, f.load.id, {
        status,
        lifecycleEvents: [...previous.rows[0].lifecycleEvents, event(status)],
        ...metadata[status],
        ...patch,
      });
    }
    async function publish(f: Fixture) {
      await transition(db, f, 'READY');
      await transition(db, f, 'PUBLISHED');
    }
    async function erase(client: Client, f: Fixture) {
      for (const name of [
        tables.link,
        tables.insurer,
        tables.reinsurer,
        tables.file,
      ]) {
        await client.query(`DELETE FROM ${table(name)} WHERE "loadId"=$1`, [
          f.load.id,
        ]);
      }
    }
    async function counts(client: Client, f: Fixture) {
      const result: Record<string, number> = {};
      for (const [kind, name] of Object.entries(tables)) {
        const resultSet = await client.query<{ count: string }>(
          `SELECT count(*) AS count FROM ${table(name)} WHERE ${kind === 'load' ? 'id' : '"loadId"'}=$1`,
          [f.load.id],
        );
        result[kind] = Number(resultSet.rows[0].count);
      }
      return result;
    }

    it('preserves operational schema definitions and every operational row', async () => {
      expect(await operationalSnapshot(db)).toEqual(baseline);
    });

    it('keeps every incoming and outgoing archive FK entirely within the archive', async () => {
      const result = await db.query<{
        source: string;
        target: string;
        source_schema: string;
        target_schema: string;
        delete_action: string;
      }>(`
      SELECT a.relname AS source,b.relname AS target,na.nspname AS source_schema,nb.nspname AS target_schema,k.confdeltype AS delete_action
      FROM pg_constraint k JOIN pg_class a ON a.oid=k.conrelid JOIN pg_class b ON b.oid=k.confrelid
      JOIN pg_namespace na ON na.oid=a.relnamespace JOIN pg_namespace nb ON nb.oid=b.relnamespace
      WHERE k.contype='f' AND (a.relname LIKE 'historical_%' OR b.relname LIKE 'historical_%')
    `);
      expect(result.rows).toHaveLength(5);
      for (const fk of result.rows) {
        expect(Object.values(tables)).toContain(fk.source);
        expect(Object.values(tables)).toContain(fk.target);
        expect(fk.source_schema).toBe('reinsurance');
        expect(fk.target_schema).toBe('reinsurance');
        expect(fk.delete_action).toBe('r');
      }
    });

    it('adds Auth entitlement default false for both existing and new tenants in this database only', async () => {
      await db.query('CREATE SCHEMA "w_auth"');
      await db.query(
        'CREATE TABLE "w_auth"."Tenant" ("id" text PRIMARY KEY,"name" text NOT NULL)',
      );
      await insert(
        db,
        'Tenant',
        { id: 'existing', name: 'Synthetic existing' },
        'w_auth',
      );
      await db.query(
        readFileSync(
          resolve(
            __dirname,
            '../../../auth-service/prisma/migrations/20261105120000_add_historical_statements_entitlement/migration.sql',
          ),
          'utf8',
        ),
      );
      await insert(
        db,
        'Tenant',
        { id: 'new', name: 'Synthetic new' },
        'w_auth',
      );
      const result = await db.query(
        'SELECT "id","historicalStatementsEnabled" FROM "w_auth"."Tenant" ORDER BY id',
      );
      expect(result.rows).toEqual([
        { id: 'existing', historicalStatementsEnabled: false },
        { id: 'new', historicalStatementsEnabled: false },
      ]);
      await rejects(
        () =>
          db.query(
            'UPDATE "w_auth"."Tenant" SET "historicalStatementsEnabled"=NULL',
          ),
        '23502',
      );
    });

    it.each(['insurer', 'reinsurer'] as const)(
      'rejects %s tenant, dataset/load, year and file-kind mismatches',
      async (kind) => {
        const f = await fixture();
        const other = await fixture({ tenantId: 'tenant-b' });
        const sameTenant = await fixture();
        const row = f[kind];
        for (const patch of [
          { tenantId: 'tenant-b' },
          { loadId: other.load.id },
          { fileId: sameTenant.files[0].id },
          { year: 2022 },
          { fileId: f.files[kind === 'insurer' ? 1 : 0].id },
        ]) {
          await rejects(
            () =>
              insert(db, tables[kind], {
                ...row,
                id: randomUUID(),
                sourceRow: 3,
                rawCells: cells(3),
                ...patch,
              }),
            '23503',
          );
        }
      },
    );

    it('rejects files attached across tenant/load boundaries', async () => {
      const f = await fixture();
      await rejects(
        () =>
          insert(db, tables.file, {
            ...f.files[0],
            id: randomUUID(),
            tenantId: 'tenant-b',
          }),
        '23503',
      );
    });

    it.each(['insurer', 'reinsurer'] as const)(
      'rejects duplicate physical %s rows and out-of-range source rows',
      async (kind) => {
        const f = await fixture();
        await rejects(
          () => insert(db, tables[kind], { ...f[kind], id: randomUUID() }),
          '23505',
        );
        await rejects(
          () =>
            insert(db, tables[kind], {
              ...f[kind],
              id: randomUUID(),
              sourceRow: 5,
              rawCells: cells(5),
            }),
          '23514',
        );
      },
    );

    it('rejects duplicate reinsurer links, duplicate match maps and wrong match groups', async () => {
      const f = await fixture();
      await rejects(
        () => insert(db, tables.link, { ...f.link, id: randomUUID() }),
        '23505',
      );
      await rejects(
        () =>
          insert(db, tables.insurer, {
            ...f.insurer,
            id: randomUUID(),
            sourceRow: 3,
            rawCells: cells(3),
          }),
        '23505',
      );
      await rejects(
        () =>
          insert(db, tables.link, {
            ...f.link,
            id: randomUUID(),
            matchId: 'wrong-group',
          }),
        '23514',
      );
    });

    it.each(['tenantId', 'loadId', 'insurerRowId', 'reinsurerRowId'])(
      'rejects link %s map mismatches',
      async (key) => {
        const f = await fixture();
        const other = await fixture({ tenantId: 'tenant-b' });
        const values: Record<string, unknown> = {
          tenantId: 'tenant-b',
          loadId: other.load.id,
          insurerRowId: other.insurer.id,
          reinsurerRowId: other.reinsurer.id,
        };
        await rejects(
          () =>
            insert(db, tables.link, {
              ...f.link,
              id: randomUUID(),
              [key]: values[key],
            }),
          key === 'tenantId' || key === 'loadId'
            ? '23503'
            : key === 'insurerRowId'
              ? '23514'
              : '23503',
        );
      },
    );

    it.each(['datasetVersion', 'contentManifestSha256'])(
      'uniquely identifies a tenant/dataset by %s',
      async (key) => {
        const f = await fixture();
        await rejects(
          () => fixture({ datasetKey: f.load.datasetKey, [key]: f.load[key] }),
          '23505',
        );
        await fixture({
          tenantId: 'tenant-b',
          datasetKey: f.load.datasetKey,
          [key]: f.load[key],
        });
      },
    );

    it.each(['insurer', 'reinsurer'] as const)(
      'round-trips negative and 15-integer/12-fraction decimals and all 29 raw %s cells exactly',
      async (kind) => {
        const f = await fixture();
        const result = await db.query<{
          premium: string;
          rawCells: unknown;
          headers: unknown;
        }>(
          `SELECT r."premium100"::text AS premium,r."rawCells",f."headerCells" AS headers FROM ${table(tables[kind])} r JOIN ${table(tables.file)} f ON f.id=r."fileId" WHERE r.id=$1`,
          [f[kind].id],
        );
        expect(result.rows[0]).toEqual({
          premium: precise,
          rawCells: cells(2),
          headers: cells(1),
        });
      },
    );

    it('enforces published immutability through the generated Prisma 5.22 client and preserves exact decimals', async () => {
      const f = await fixture();
      await publish(f);
      await db.query('COMMIT');
      const url = new URL('postgresql://127.0.0.1');
      url.hostname = String(config.host);
      url.port = String(config.port);
      url.username = String(config.user);
      url.password = String(config.password ?? '');
      url.pathname = `/${String(config.database)}`;
      url.searchParams.set('schema', 'reinsurance');
      const prisma = new PrismaClient({
        datasources: { db: { url: url.toString() } },
      });
      try {
        const row = await prisma.historicalInsurerStatement.findUniqueOrThrow({
          where: { id: String(f.insurer.id) },
        });
        expect(row.premium100?.toFixed(12)).toBe(precise);
        expect(row.rawCells).toEqual(cells(2));
        await expect(
          prisma.historicalInsurerStatement.update({
            where: { id: row.id },
            data: { premium100: '1' },
          }),
        ).rejects.toThrow('Historical statement source content is immutable');
      } finally {
        await prisma.$disconnect();
        await db.query('BEGIN');
        await transition(db, f, 'ROLLED_BACK');
        await erase(db, f);
        await db.query('SET CONSTRAINTS ALL IMMEDIATE');
        await db.query('COMMIT');
        await db.query('BEGIN');
      }
    });

    it.each(['0001-01-01', '0099-12-31', '0001-01-01 BC'])(
      'preserves low-year / BCE DATE %s without JavaScript Date coercion',
      async (date) => {
        const f = await fixture();
        const row = {
          ...f.reinsurer,
          id: randomUUID(),
          sourceRow: 3,
          rawCells: cells(3),
          offerDate: date,
          closedDate: date,
          startDate: date,
          endDate: date,
        };
        await insert(db, tables.reinsurer, row);
        const result = await db.query(
          `SELECT "offerDate"::text AS offer,"closedDate"::text AS closed,"startDate"::text AS start,"endDate"::text AS end FROM ${table(tables.reinsurer)} WHERE id=$1`,
          [row.id],
        );
        expect(result.rows[0]).toEqual({
          offer: date,
          closed: date,
          start: date,
          end: date,
        });
      },
    );

    it.each([
      ['length', (raw: RecordData[]) => raw.slice(1)],
      [
        'address',
        (raw: RecordData[]) => [
          { ...raw[0], sourceAddress: 'A999' },
          ...raw.slice(1),
        ],
      ],
      [
        'missing contract key',
        (raw: RecordData[]) => [
          { ...raw[0], cachedValue: undefined },
          ...raw.slice(1),
        ],
      ],
      [
        'numeric lexeme',
        (raw: RecordData[]) => [{ ...raw[0], xmlValue: 12.5 }, ...raw.slice(1)],
      ],
      [
        'column index type',
        (raw: RecordData[]) => [
          { ...raw[0], columnIndex: '1' },
          ...raw.slice(1),
        ],
      ],
      [
        'style index type',
        (raw: RecordData[]) => [
          { ...raw[0], styleIndex: '1' },
          ...raw.slice(1),
        ],
      ],
    ] as const)('rejects malformed raw cell %s', async (_label, change) => {
      const f = await fixture();
      await rejects(
        () =>
          insert(db, tables.reinsurer, {
            ...f.reinsurer,
            id: randomUUID(),
            sourceRow: 3,
            rawCells: change(cells(3)),
          }),
        '23514',
      );
    });

    it.each([
      { sourceColumnCount: 28 },
      { year: 2020 },
      { year: 2026 },
      { byteSize: '0' },
      { businessRowCount: -1 },
      { physicalRowCount: 1 },
      { sheetName: 'Wrong sheet' },
      { sha256: 'invalid' },
      { headerSha256: 'INVALID' },
      { headerCells: cells(2) },
    ])('rejects invalid file provenance %j', async (patch) => {
      const f = await fixture();
      await rejects(
        () =>
          insert(db, tables.file, {
            ...f.files[0],
            id: randomUUID(),
            sha256: hash(randomUUID()),
            ...patch,
          }),
        '23514',
      );
    });

    it.each(['STAGING', 'PUBLISHED', 'SUPERSEDED'] as const)(
      'blocks every file, row and link UPDATE in %s',
      async (status) => {
        const f = await fixture();
        if (status !== 'STAGING') await publish(f);
        if (status === 'SUPERSEDED') {
          const replacement = await fixture({ datasetKey: f.load.datasetKey });
          await transition(db, replacement, 'READY');
          await transition(db, f, 'SUPERSEDED', {
            supersededByLoadId: replacement.load.id,
          });
        }
        for (const [kind, record] of [
          ['file', f.files[0]],
          ['insurer', f.insurer],
          ['reinsurer', f.reinsurer],
          ['link', f.link],
        ] as const) {
          await rejects(
            () =>
              update(db, tables[kind], record.id, {
                createdByUserId: 'changed',
              }),
            '55000',
          );
        }
        for (const patch of [
          { tenantId: 'changed' },
          { datasetKey: 'changed' },
          { datasetVersion: 'changed' },
          { contentManifestSha256: hash('changed') },
          { sourceManifest: { files: [] } },
          { parserVersion: 'changed' },
          { createdByUserId: 'changed' },
        ]) {
          await rejects(
            () => update(db, tables.load, f.load.id, patch),
            '55000',
          );
        }
      },
    );

    it.each(['READY', 'PUBLISHED', 'SUPERSEDED'] as const)(
      'blocks inserts and deletes in %s',
      async (status) => {
        const f = await fixture();
        await transition(db, f, 'READY');
        if (status !== 'READY') await transition(db, f, 'PUBLISHED');
        if (status === 'SUPERSEDED') {
          const replacement = await fixture({ datasetKey: f.load.datasetKey });
          await transition(db, replacement, 'READY');
          await transition(db, f, 'SUPERSEDED', {
            supersededByLoadId: replacement.load.id,
          });
        }
        await rejects(
          () =>
            insert(db, tables.reinsurer, {
              ...f.reinsurer,
              id: randomUUID(),
              sourceRow: 3,
              rawCells: cells(3),
            }),
          '55000',
        );
        await rejects(
          () =>
            db.query(`DELETE FROM ${table(tables.link)} WHERE id=$1`, [
              f.link.id,
            ]),
          '55000',
        );
      },
    );

    it.each([
      'fileCount',
      'insurerRowCount',
      'reinsurerRowCount',
      'linkCount',
      'validated',
    ])('rejects READY with false %s', async (key) => {
      const f = await fixture();
      const summary = {
        validated: true,
        fileCount: 2,
        insurerRowCount: 1,
        reinsurerRowCount: 1,
        linkCount: 1,
        [key]: key === 'validated' ? false : 999,
      };
      await rejects(
        () => transition(db, f, 'READY', { validationSummary: summary }),
        '23514',
      );
    });

    it('rejects READY with a mismatched manifest descriptor', async () => {
      const f = await fixture({
        sourceManifest: {
          files: [
            {
              sha256: hash('wrong'),
              kind: 'INSURER',
              year: 2021,
              sheetName,
              headerSha256: hash('wrong'),
            },
            {
              sha256: hash('wrong2'),
              kind: 'REINSURER',
              year: 2021,
              sheetName,
              headerSha256: hash('wrong2'),
            },
          ],
        },
      });
      await rejects(() => transition(db, f, 'READY'), '23514');
    });

    it('rejects READY when per-file business counts disagree with otherwise correct global counts', async () => {
      const f = await fixture();
      await insert(db, tables.reinsurer, {
        ...f.reinsurer,
        id: randomUUID(),
        sourceRow: 3,
        rawCells: cells(3),
      });
      await rejects(
        () =>
          transition(db, f, 'READY', {
            validationSummary: {
              validated: true,
              fileCount: 2,
              insurerRowCount: 1,
              reinsurerRowCount: 2,
              linkCount: 1,
            },
          }),
        '23514',
      );
    });

    it('requires append-only events and exactly one new event per state transition', async () => {
      const f = await fixture();
      await rejects(
        () => update(db, tables.load, f.load.id, { lifecycleEvents: [] }),
        '55000',
      );
      await rejects(
        () =>
          update(db, tables.load, f.load.id, {
            lifecycleEvents: [
              { ...event('STAGING'), actorUserId: 'rewritten' },
            ],
          }),
        '55000',
      );
      await rejects(
        () =>
          transition(db, f, 'READY', { lifecycleEvents: [event('STAGING')] }),
        '23514',
      );
      await rejects(
        () =>
          transition(db, f, 'READY', {
            lifecycleEvents: [event('STAGING'), event('READY'), event('READY')],
          }),
        '23514',
      );
      await rejects(
        () =>
          transition(db, f, 'READY', {
            lifecycleEvents: [
              event('STAGING'),
              { ...event('READY'), at: 'not-a-date' },
            ],
          }),
        '22007',
      );
      await transition(db, f, 'READY');
      await rejects(
        () => update(db, tables.load, f.load.id, { validationSummary: {} }),
        '55000',
      );
      await rejects(
        () =>
          update(db, tables.load, f.load.id, {
            lifecycleEvents: [event('STAGING'), event('READY'), event('READY')],
          }),
        '55000',
      );
    });

    it.each([
      { readyAt: null },
      {
        lifecycleEvents: [
          event('STAGING'),
          { ...event('READY'), actorUserId: '' },
        ],
      },
      { lifecycleEvents: [event('STAGING'), event('PUBLISHED')] },
    ])('rejects invalid READY audit %j', async (patch) => {
      const f = await fixture();
      await rejects(() => transition(db, f, 'READY', patch), '23514');
    });

    it.each([
      { publishedAt: null },
      { publicationApprovalRef: '' },
      { publishedByUserId: 'wrong-actor' },
    ])(
      'requires publication approval, actor and timestamp %j',
      async (patch) => {
        const f = await fixture();
        await transition(db, f, 'READY');
        await rejects(() => transition(db, f, 'PUBLISHED', patch), '23514');
      },
    );

    it('rejects illegal transitions, same-state audit mutation and deletion of Load provenance', async () => {
      const f = await fixture();
      await rejects(() => transition(db, f, 'PUBLISHED'), '23514');
      await rejects(
        () => update(db, tables.load, f.load.id, { publishedAt: now }),
        '55000',
      );
      await rejects(
        () =>
          db.query(`DELETE FROM ${table(tables.load)} WHERE id=$1`, [
            f.load.id,
          ]),
        '55000',
      );
      await publish(f);
      await rejects(() => transition(db, f, 'STAGING'), '23514');
      await rejects(
        () =>
          update(db, tables.load, f.load.id, {
            publicationApprovalRef: 'changed',
          }),
        '55000',
      );
    });

    it('supports audited FAILED recovery to STAGING and rejects incomplete failure provenance', async () => {
      const f = await fixture();
      await rejects(
        () => transition(db, f, 'FAILED', { failedAt: null }),
        '23514',
      );
      await rejects(
        () => transition(db, f, 'FAILED', { errorSummary: null }),
        '23514',
      );
      await transition(db, f, 'FAILED');
      await transition(db, f, 'STAGING');
      await publish(f);
      const result = await db.query<{ lifecycleEvents: unknown[] }>(
        `SELECT "lifecycleEvents" FROM ${table(tables.load)} WHERE id=$1`,
        [f.load.id],
      );
      expect(result.rows[0].lifecycleEvents).toEqual(
        ['STAGING', 'FAILED', 'STAGING', 'READY', 'PUBLISHED'].map((status) =>
          event(status as Status),
        ),
      );
    });

    it('enforces one PUBLISHED version per tenant/dataset while allowing independent tenants/datasets', async () => {
      const f = await fixture();
      const next = await fixture({ datasetKey: f.load.datasetKey });
      await publish(f);
      await transition(db, next, 'READY');
      await rejects(() => transition(db, next, 'PUBLISHED'), '23505');
      await publish(
        await fixture({ tenantId: 'tenant-b', datasetKey: f.load.datasetKey }),
      );
      await publish(await fixture());
    });

    it('rejects supersession by another tenant, another dataset or a STAGING version', async () => {
      const f = await fixture();
      await publish(f);
      for (const overrides of [
        { tenantId: 'tenant-b', datasetKey: f.load.datasetKey },
        {},
        { datasetKey: f.load.datasetKey },
      ]) {
        const other = await fixture(overrides);
        if (overrides.tenantId || !overrides.datasetKey)
          await transition(db, other, 'READY');
        await rejects(
          () =>
            transition(db, f, 'SUPERSEDED', {
              supersededByLoadId: other.load.id,
            }),
          '23514',
        );
      }
    });

    it('replaces publication atomically and restores the prior publication on transaction failure', async () => {
      const old = await fixture();
      const next = await fixture({ datasetKey: old.load.datasetKey });
      await publish(old);
      await transition(db, next, 'READY');
      await db.query('SAVEPOINT replacement');
      await transition(db, old, 'SUPERSEDED', {
        supersededByLoadId: next.load.id,
      });
      await transition(db, next, 'PUBLISHED');
      let result = await db.query(
        `SELECT id FROM ${table(tables.load)} WHERE "tenantId"=$1 AND "datasetKey"=$2 AND status='PUBLISHED'`,
        [old.load.tenantId, old.load.datasetKey],
      );
      expect(result.rows).toEqual([{ id: next.load.id }]);
      await db.query('ROLLBACK TO SAVEPOINT replacement');
      result = await db.query(
        `SELECT id FROM ${table(tables.load)} WHERE "tenantId"=$1 AND "datasetKey"=$2 AND status='PUBLISHED'`,
        [old.load.tenantId, old.load.datasetKey],
      );
      expect(result.rows).toEqual([{ id: old.load.id }]);
      await transition(db, old, 'SUPERSEDED', {
        supersededByLoadId: next.load.id,
      });
      await transition(db, next, 'PUBLISHED');
      await db.query('RELEASE SAVEPOINT replacement');
    });

    it('rolls back only archive links → rows → files atomically while retaining Load/audit and operational data', async () => {
      const f = await fixture();
      await publish(f);
      const before = await counts(db, f);
      await db.query('SAVEPOINT archive_rollback');
      await transition(db, f, 'ROLLED_BACK');
      await erase(db, f);
      await db.query('SET CONSTRAINTS ALL IMMEDIATE');
      expect(await counts(db, f)).toEqual({
        load: 1,
        file: 0,
        insurer: 0,
        reinsurer: 0,
        link: 0,
      });
      await db.query('ROLLBACK TO SAVEPOINT archive_rollback');
      expect(await counts(db, f)).toEqual(before);
      await transition(db, f, 'ROLLED_BACK');
      await erase(db, f);
      await db.query('SET CONSTRAINTS ALL IMMEDIATE');
      await rejects(
        () => update(db, tables.load, f.load.id, { progress: {} }),
        '55000',
      );
      await rejects(
        () =>
          insert(db, tables.reinsurer, { ...f.reinsurer, id: randomUUID() }),
        '55000',
      );
      const result = await db.query(
        `SELECT status,"sourceManifest","lifecycleEvents","rollbackReason" FROM ${table(tables.load)} WHERE id=$1`,
        [f.load.id],
      );
      expect(result.rows[0]).toMatchObject({
        status: 'ROLLED_BACK',
        sourceManifest: f.load.sourceManifest,
        rollbackReason: 'synthetic rollback',
        lifecycleEvents: ['STAGING', 'READY', 'PUBLISHED', 'ROLLED_BACK'].map(
          (status) => event(status as Status),
        ),
      });
      expect(await operationalSnapshot(db)).toEqual(baseline);
    });

    it('rejects rollback commit with untouched or partially deleted content via the deferred constraint', async () => {
      // Separate transactions are essential: this tests COMMIT rather than forcing
      // the constraint early. Persist only this synthetic fixture to the disposable DB.
      const f = await fixture();
      await publish(f);
      await db.query('COMMIT');
      for (const partial of [false, true]) {
        await db.query('BEGIN');
        await transition(db, f, 'ROLLED_BACK');
        if (partial)
          await db.query(
            `DELETE FROM ${table(tables.link)} WHERE "loadId"=$1`,
            [f.load.id],
          );
        await expect(db.query('COMMIT')).rejects.toMatchObject({
          code: '23514',
        });
        await db.query('ROLLBACK');
        expect(await counts(db, f)).toEqual({
          load: 1,
          file: 2,
          insurer: 1,
          reinsurer: 1,
          link: 1,
        });
        const status = await db.query<{ status: Status }>(
          `SELECT status FROM ${table(tables.load)} WHERE id=$1`,
          [f.load.id],
        );
        expect(status.rows[0].status).toBe('PUBLISHED');
      }
      await db.query('BEGIN');
      await transition(db, f, 'ROLLED_BACK');
      await erase(db, f);
      await db.query('COMMIT');
      expect(await counts(db, f)).toEqual({
        load: 1,
        file: 0,
        insurer: 0,
        reinsurer: 0,
        link: 0,
      });
      await db.query('BEGIN');
    });

    it.each(Object.values(tables))(
      'rejects TRUNCATE %s even with CASCADE',
      async (name) => {
        await rejects(
          () => db.query(`TRUNCATE ${table(name)} CASCADE`),
          '55000',
        );
      },
    );

    it.each(['writer-first', 'publisher-first'] as const)(
      'serializes concurrent content and publication: %s',
      async (ordering) => {
        const f = await fixture();
        await db.query('COMMIT');
        const writer = new Client(config);
        const publisher = new Client(config);
        await writer.connect();
        await publisher.connect();
        try {
          await writer.query("SET statement_timeout='1200ms'");
          await publisher.query("SET statement_timeout='1200ms'");
          await writer.query('BEGIN');
          await publisher.query('BEGIN');
          if (ordering === 'writer-first') {
            // An extra uncommitted row invalidates the previously expected counts.
            // The publication path must wait for this parent lock before checking them.
            await insert(writer, tables.reinsurer, {
              ...f.reinsurer,
              id: randomUUID(),
              sourceRow: 3,
              rawCells: cells(3),
            });
            await expect(
              transition(publisher, f, 'READY'),
            ).rejects.toMatchObject({ code: '57014' });
            await publisher.query('ROLLBACK');
            await writer.query('COMMIT');
            await publisher.query('BEGIN');
            await expect(
              transition(publisher, f, 'READY'),
            ).rejects.toMatchObject({ code: '23514' });
          } else {
            await transition(publisher, f, 'READY');
            await transition(publisher, f, 'PUBLISHED');
            await expect(
              insert(writer, tables.reinsurer, {
                ...f.reinsurer,
                id: randomUUID(),
                sourceRow: 3,
                rawCells: cells(3),
              }),
            ).rejects.toMatchObject({ code: '57014' });
            await writer.query('ROLLBACK');
            await publisher.query('COMMIT');
            await writer.query('BEGIN');
            await expect(
              insert(writer, tables.reinsurer, {
                ...f.reinsurer,
                id: randomUUID(),
                sourceRow: 3,
                rawCells: cells(3),
              }),
            ).rejects.toMatchObject({ code: '55000' });
          }
        } finally {
          await writer.query('ROLLBACK');
          await publisher.query('ROLLBACK');
          await writer.end();
          await publisher.end();
          await db.query('BEGIN');
        }
        const result = await db.query<{ status: Status }>(
          `SELECT status FROM ${table(tables.load)} WHERE id=$1`,
          [f.load.id],
        );
        expect(result.rows[0].status).toBe(
          ordering === 'publisher-first' ? 'PUBLISHED' : 'STAGING',
        );
        expect((await counts(db, f)).reinsurer).toBe(
          ordering === 'publisher-first' ? 1 : 2,
        );
      },
      10000,
    );
  },
);
