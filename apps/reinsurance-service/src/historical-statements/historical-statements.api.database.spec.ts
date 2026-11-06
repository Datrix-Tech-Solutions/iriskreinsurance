import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { request } from 'node:http';
import { Readable } from 'node:stream';
import * as jwt from 'jsonwebtoken';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { HistoricalStatementsRepository } from './historical-statements.repository';
import { HistoricalStatementsModule } from './historical-statements.module';
import { HistoricalStatementsAccessClient } from './historical-statements-access.client';
import { syntheticDataset } from './loader/test-fixtures';
import { rowRecords } from './loader/lifecycle';
import { sha } from './loader/source-contract';

const testUrl = process.env.ARCHIVE_API_TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;
type Json = Record<string, unknown>;
suite('Historical statement API with real disposable Prisma/PostgreSQL', () => {
  let admin: Client, prisma: PrismaService, app: INestApplication, base: string;
  let own: { id: string; ce: string[]; re: string[] },
    other: typeof own,
    hidden: typeof own;
  let access = {
    tenantId: 'tenant-a',
    userId: 'archive-admin',
    enabled: true,
    canView: true,
    canExport: true,
  };
  const secret = 'synthetic-archive-api-tests-only',
    previous = process.env.JWT_SECRET;
  const accessClient = { getAccess: jest.fn(() => Promise.resolve(access)) };
  const token = () =>
    jwt.sign(
      {
        sub: 'archive-admin',
        tenantId: 'tenant-a',
        role: 'EMPLOYEE',
        moduleConfig: { operations: true },
        featureConfig: { operations: { reinsurance: true } },
      },
      secret,
      { expiresIn: '5m' },
    );
  async function get(path: string, authenticated = true) {
    return new Promise<{
      status: number;
      headers: Record<string, unknown>;
      bytes: Buffer;
      body: Json;
    }>((res, rej) => {
      const req = request(
        new URL('/api/historical-statements/' + path, base),
        {
          headers: authenticated ? { authorization: 'Bearer ' + token() } : {},
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on('data', (b: Buffer) => chunks.push(b));
          r.on('error', rej);
          r.on('end', () => {
            const bytes = Buffer.concat(chunks);
            res({
              status: r.statusCode ?? 0,
              headers: r.headers,
              bytes,
              body: r.headers['content-type']?.includes('json')
                ? (JSON.parse(bytes.toString('utf8')) as Json)
                : {},
            });
          });
        },
      );
      req.on('error', rej);
      req.end();
    });
  }
  async function insert(table: string, rows: Json[]) {
    if (
      ![
        'historical_statement_load',
        'historical_statement_file',
        'historical_insurer_statement',
        'historical_reinsurer_statement',
        'historical_statement_link',
      ].includes(table)
    )
      throw new Error('Nonarchive fixture target');
    await admin.query(
      `INSERT INTO reinsurance."${table}" SELECT * FROM jsonb_populate_recordset(NULL::reinsurance."${table}",$1::jsonb)`,
      [JSON.stringify(rows)],
    );
  }
  async function fixture(tenant: string, publish: boolean) {
    const { data } = await syntheticDataset('api-v1', tenant),
      id = randomUUID(),
      now = '2026-11-05T00:00:00.000Z',
      actor = {
        tenantId: tenant,
        tenantSlug: tenant,
        userId: 'synthetic-admin',
      };
    const ce: string[] = [],
      re: string[] = [],
      files: Json[] = [],
      insurers: Json[] = [],
      reinsurers: Json[] = [];
    for (const f of data.files) {
      for (const r of f.rows) {
        if (f.input.year === 2021 && f.input.kind === 'INSURER') {
          const values = {
            policyNumber: 'POLICY%_2021',
            insuredName:
              r.sourceRow === 2
                ? '=HYPERLINK("https://invalid.example","x")'
                : 'Synthetic Person',
            facPremium: r.sourceRow === 2 ? '2' : '10',
            paymentStatus: r.sourceRow === 2 ? 'PAID' : 'PARTPAYMENT',
          };
          for (const [k, v] of Object.entries(values)) {
            r.fields[k] = v;
            const keys = [
              'policyNumber',
              'insurerName',
              'insuredName',
              'businessName',
              'offerDate',
              'closedDate',
              'startDate',
              'endDate',
              'currency',
              'sumInsured100',
              'premium100',
              'facShare',
              'facSumInsured',
              'facPremium',
              'paidFacPremium',
              'insurerCommissionPercent',
              'paidCommission',
              'netPremiumDueBroker',
              'netPremiumDueBrokerPaid',
              'brokerage',
              'brokeragePaid',
              'wht',
              'paidWht',
              'nicLevy',
              'paidNic',
              'netPremiumDueReinsurer',
              'netPremiumPaid',
              'offerStatus',
              'paymentStatus',
            ];
            r.rawCells[keys.indexOf(k)].resolvedText = v;
          }
          r.rowSha256 = sha(r.rawCells);
        }
      }
      const rows = rowRecords(data, id, f, actor);
      (f.input.kind === 'INSURER' ? insurers : reinsurers).push(...rows);
      (f.input.kind === 'INSURER' ? ce : re).push(...rows.map((r) => r.id));
      files.push({
        id: rows[0].fileId,
        tenantId: tenant,
        loadId: id,
        kind: f.input.kind,
        year: f.input.year,
        originalFileName: f.fileName,
        byteSize: String(f.byteSize),
        sha256: f.sha256,
        sheetName: f.sheetName,
        sheetXmlPath: f.sheetXmlPath,
        headerSha256: f.headerSha256,
        headerCells: f.headerCells,
        workbookMetadata: f.workbookMetadata,
        physicalRowCount: f.physicalRowCount,
        businessRowCount: f.rows.length,
        sourceColumnCount: 29,
        rawStorageProvider: 'SYNTHETIC_TEST_ONLY',
        rawStorageKey: 'not-a-client-file',
        createdByUserId: actor.userId,
        importedAt: now,
        createdAt: now,
      });
    }
    insurers[0].matchId = 'synthetic-approved';
    const ev = (status: string) => ({
      status,
      actorUserId: actor.userId,
      at: now,
    });
    await insert('historical_statement_load', [
      {
        id,
        tenantId: tenant,
        datasetKey: id,
        datasetVersion: 'v1',
        contentManifestSha256: sha(id),
        contractVersion: 'historical-statements/2021-2025/v1',
        parserVersion: 'synthetic',
        loaderVersion: 'synthetic',
        status: 'STAGING',
        sourceManifest: {
          files: files.map((f) => ({
            sha256: f.sha256,
            kind: f.kind,
            year: f.year,
            sheetName: f.sheetName,
            headerSha256: f.headerSha256,
          })),
        },
        validationSummary: {},
        progress: {},
        lifecycleEvents: [ev('STAGING')],
        createdByUserId: actor.userId,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await insert('historical_statement_file', files);
    await insert('historical_insurer_statement', insurers);
    await insert('historical_reinsurer_statement', reinsurers);
    await insert(
      'historical_statement_link',
      re.slice(0, 2).map((reId) => ({
        id: randomUUID(),
        tenantId: tenant,
        loadId: id,
        matchId: 'synthetic-approved',
        insurerRowId: ce[0],
        reinsurerRowId: reId,
        basis: 'SUPPLIED_AUTHORITATIVE',
        approvalRef: 'synthetic test approval',
        evidence: { synthetic: true },
        evidenceSha256: sha({ synthetic: true }),
        approvedByUserId: actor.userId,
        approvedAt: now,
        createdByUserId: actor.userId,
        createdAt: now,
      })),
    );
    const events = [ev('STAGING'), ev('READY')];
    await admin.query(
      'UPDATE reinsurance.historical_statement_load SET status=\'READY\',"readyAt"=$2,"validationSummary"=$3::jsonb,"lifecycleEvents"=$4::jsonb WHERE id=$1',
      [
        id,
        now,
        JSON.stringify({
          validated: true,
          fileCount: 10,
          insurerRowCount: 10,
          reinsurerRowCount: 10,
          linkCount: 2,
        }),
        JSON.stringify(events),
      ],
    );
    if (publish) {
      events.push(ev('PUBLISHED'));
      await admin.query(
        'UPDATE reinsurance.historical_statement_load SET status=\'PUBLISHED\',"publishedAt"=$2,"publishedByUserId"=$3,"publicationApprovalRef"=\'synthetic test\',"lifecycleEvents"=$4::jsonb WHERE id=$1',
        [id, now, actor.userId, JSON.stringify(events)],
      );
    }
    return { id, ce, re };
  }
  beforeAll(async () => {
    const u = new URL(testUrl!);
    if (
      !['127.0.0.1', 'localhost'].includes(u.hostname) ||
      !/^\/irisk_archive_m2b_[a-z0-9_]+$/.test(u.pathname) ||
      u.search ||
      u.hash
    )
      throw new Error(
        'Fresh disposable localhost archive API database required',
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
    expect(
      (
        await admin.query(
          "SELECT nspname FROM pg_namespace WHERE nspname='reinsurance'",
        )
      ).rows,
    ).toHaveLength(0);
    await admin.query('CREATE SCHEMA reinsurance');
    await admin.query(
      readFileSync(
        resolve(
          __dirname,
          '../../prisma/migrations/20261105130000_add_historical_statement_archive/migration.sql',
        ),
        'utf8',
      ),
    );
    own = await fixture('tenant-a', true);
    other = await fixture('tenant-b', true);
    hidden = await fixture('tenant-a', false);
    prisma = new PrismaService({ datasources: { db: { url: testUrl! } } });
    process.env.JWT_SECRET = secret;
    const m = await Test.createTestingModule({
      imports: [HistoricalStatementsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(HistoricalStatementsAccessClient)
      .useValue(accessClient)
      .compile();
    app = m.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  }, 60000);
  beforeEach(() => {
    access = {
      tenantId: 'tenant-a',
      userId: 'archive-admin',
      enabled: true,
      canView: true,
      canExport: true,
    };
    accessClient.getAccess.mockClear();
  });
  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await admin?.end();
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  it('lists only published own-tenant datasets and paginates full-filter totals', async () => {
    const datasets = await get('datasets');
    expect(datasets.status).toBe(200);
    expect((datasets.body.items as Json[]).map((r) => r.id)).toEqual([own.id]);
    const one = await get(
        `insurers?datasetId=${own.id}&page=1&limit=1&year=2021&sortBy=facPremium&sortOrder=asc`,
      ),
      two = await get(
        `insurers?datasetId=${own.id}&page=2&limit=1&year=2021&sortBy=facPremium&sortOrder=asc`,
      );
    expect(one.status).toBe(200);
    expect(one.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect((one.body.items as Json[])[0].facPremium).toBe('2.000000000000');
    expect((two.body.items as Json[])[0].facPremium).toBe('10.000000000000');
    expect(one.headers['cache-control']).toBe('private,no-store');
  });
  it('parameterizes literal policy/name searches, statuses, currency and inclusive dates', async () => {
    const cases = [
      ['policyNumber=' + encodeURIComponent('POLICY%_'), 2],
      ['search=' + encodeURIComponent('Synthetic Person'), 1],
      ['insured=Synthetic%20Person', 1],
      ['insurer=cedant', 10],
      ['businessName=motor', 10],
      ['paymentStatus=paid', 1],
      ['offerStatus=OPEN', 10],
      ['currency=ghs', 10],
      ['closedDateFrom=2025-02-01&closedDateTo=2025-02-01', 10],
      ['closedDateFrom=2025-02-02', 0],
      ['year=2021&offerDateFrom=1970-01-01&offerDateTo=1970-01-01', 2],
      ['policyNumber=' + encodeURIComponent("' OR true --"), 0],
    ] as const;
    for (const [query, total] of cases) {
      const r = await get(`insurers?datasetId=${own.id}&${query}`);
      expect(r.status).toBe(200);
      expect((r.body.meta as Json).total).toBe(total);
    }
    const empty = await get(`insurers?datasetId=${own.id}&year=2021&page=100`);
    expect(empty.body.items).toEqual([]);
    expect((empty.body.meta as Json).total).toBe(2);
  });
  it('serves positive reinsurer searches and source-Reinsured facets with kind-specific fields', async () => {
    const result = await get(
      `reinsurers?datasetId=${own.id}&year=2021&insurer=cedant&reinsurer=reinsurer&currency=usd&offerStatus=pending&sortBy=paidWhtSecond&sortOrder=asc`,
    );
    expect(result.status).toBe(200);
    expect((result.body.meta as Json).total).toBe(2);
    expect((result.body.items as Json[])[0]).toMatchObject({
      reinsuredName: 'Cedant',
      reinsurerName: 'Reinsurer',
      paidWhtSecond: '56.780000000000',
    });
    const facets = await get(
      `facets?datasetId=${own.id}&kind=REINSURER&year=2021`,
    );
    expect(facets.status).toBe(200);
    expect(facets.body).toMatchObject({
      years: [2021],
      currencies: ['USD'],
      insurers: ['Cedant'],
      reinsurers: ['Reinsurer'],
    });
  });
  it('preserves exact negative decimals, distant dates, both WHT fields and 29 original cells', async () => {
    const ce = await get(`insurers/${own.ce[0]}?datasetId=${own.id}`),
      re = await get(`reinsurers/${own.re[0]}?datasetId=${own.id}`);
    expect(ce.status).toBe(200);
    expect(ce.body.sumInsured100).toBe('-123456789012345.123456789012');
    expect(ce.body.endDate).toBe('0021-02-01');
    expect(ce.body.offerDate).toBe('1970-01-01');
    expect(ce.body.originalColumns).toHaveLength(29);
    expect(ce.body.qualityWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'REVERSED_COVERAGE' }),
      ]),
    );
    expect(re.body).toMatchObject({
      paidWhtFirst: '12.340000000000',
      paidWhtSecond: '56.780000000000',
    });
    if (process.env.ARCHIVE_API_EXAMPLES_FILE)
      writeFileSync(
        process.env.ARCHIVE_API_EXAMPLES_FILE,
        JSON.stringify(
          {
            insurer: ce.body,
            reinsurer: re.body,
            list: (
              await get(
                `insurers?datasetId=${own.id}&year=2021&limit=1&sortBy=facPremium&sortOrder=asc`,
              )
            ).body,
            linked: (
              await get(`insurers/${own.ce[0]}/reinsurers?datasetId=${own.id}`)
            ).body,
            facets: (await get(`facets?datasetId=${own.id}&year=2021`)).body,
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
  });
  it('follows approved one-to-many links only and explicitly marks unmatched rows', async () => {
    const linked = await get(
      `insurers/${own.ce[0]}/reinsurers?datasetId=${own.id}&limit=1`,
    );
    expect(linked.status).toBe(200);
    expect(linked.body.state).toBe('LINKED');
    expect(linked.body.items).toHaveLength(1);
    expect((linked.body.meta as Json).total).toBe(2);
    const parent = await get(
      `reinsurers/${own.re[0]}/insurer?datasetId=${own.id}`,
    );
    expect(parent.body.state).toBe('LINKED');
    expect(((parent.body.item as Json).statement as Json).id).toBe(own.ce[0]);
    expect(
      (await get(`insurers/${own.ce[1]}/reinsurers?datasetId=${own.id}`)).body,
    ).toMatchObject({ state: 'UNLINKED', items: [] });
    expect(
      (await get(`reinsurers/${own.re[2]}/insurer?datasetId=${own.id}`)).body,
    ).toMatchObject({ state: 'UNLINKED', item: null });
    expect(
      (
        (await get(`insurers?datasetId=${own.id}&reinsurer=Reinsurer`)).body
          .meta as Json
      ).total,
    ).toBe(1);
  });
  it('returns filtered facets, isolated to source kind and approved associations', async () => {
    const facets = await get(`facets?datasetId=${own.id}&year=2021`);
    expect(facets.status).toBe(200);
    expect(facets.body.years).toEqual([2021]);
    expect(facets.body.currencies).toEqual(['GHS']);
    expect(facets.body.reinsurers).toEqual(['Reinsurer']);
    const empty = await get(`facets?datasetId=${own.id}&policyNumber=missing`);
    expect(empty.body.years).toEqual([]);
  });
  it.each([
    'insurers',
    'reinsurers',
    'facets',
    'insurers/export.xlsx',
    'reinsurers/export.xlsx',
  ])('hides foreign and unpublished datasets on %s', async (route) => {
    for (const id of [other.id, hidden.id])
      expect((await get(`${route}?datasetId=${id}`)).status).toBe(404);
  });
  it('hides foreign-tenant and wrong-dataset row IDs and links', async () => {
    for (const path of [
      `insurers/${other.ce[0]}`,
      `reinsurers/${other.re[0]}`,
      `insurers/${other.ce[0]}/reinsurers`,
      `reinsurers/${other.re[0]}/insurer`,
      `insurers/${hidden.ce[0]}`,
    ])
      expect((await get(path + `?datasetId=${own.id}`)).status).toBe(404);
  });
  it('enforces fresh VIEW and VIEW+EXPORT decisions on real routes', async () => {
    expect((await get(`insurers?datasetId=${own.id}`, false)).status).toBe(401);
    access.canExport = false;
    expect((await get(`insurers?datasetId=${own.id}`)).status).toBe(200);
    expect((await get(`insurers/export.xlsx?datasetId=${own.id}`)).status).toBe(
      403,
    );
    access.canView = false;
    access.canExport = true;
    expect(
      (await get(`reinsurers/export.xlsx?datasetId=${own.id}`)).status,
    ).toBe(403);
    access.canView = true;
    access.enabled = false;
    expect((await get('datasets')).status).toBe(403);
  });
  it('rejects forged selectors, invalid date ranges, sort SQL, missing datasets and excessive pages', async () => {
    for (const suffix of [
      '&tenantId=tenant-b',
      '&userId=someone',
      '&limit=201',
      '&page=0',
      '&year=2026',
      '&sortBy=DROP_TABLE',
      '&closedDateFrom=2025-02-29',
      '&offerDateFrom=2025-03-01&offerDateTo=2025-01-01',
      '&sortBy=reinsurerName',
    ])
      expect((await get(`insurers?datasetId=${own.id}${suffix}`)).status).toBe(
        400,
      );
    expect((await get('insurers')).status).toBe(400);
    expect(
      (await get(`insurers/export.xlsx?datasetId=${own.id}&page=1`)).status,
    ).toBe(400);
  });
  it('exports valid filtered XLSX text cells, preserving both WHT columns and formula safety', async () => {
    const result = await get(
      `insurers/export.xlsx?datasetId=${own.id}&year=2021&sortBy=facPremium&sortOrder=asc`,
    );
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(result.bytes.subarray(0, 2).toString()).toBe('PK');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.read(Readable.from([result.bytes]));
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(1).cellCount).toBe(29);
    expect(sheet.getCell('J2').value).toBe('-123456789012345.123456789012');
    expect(sheet.getCell('C2').value).toBe(
      '=HYPERLINK("https://invalid.example","x")',
    );
    expect(sheet.getCell('C2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('N2').value).toBe('2');
    const re = await get(
      `reinsurers/export.xlsx?datasetId=${own.id}&year=2021`,
    );
    const reBook = new ExcelJS.Workbook();
    await reBook.xlsx.read(Readable.from([re.bytes]));
    expect(reBook.worksheets[0].getCell('V1').value).toBe('Paid WHT');
    expect(reBook.worksheets[0].getCell('W1').value).toBe('Paid WHT');
    expect(reBook.worksheets[0].getCell('V2').value).toBe('12.34');
    expect(reBook.worksheets[0].getCell('W2').value).toBe('56.78');
    const empty = await get(
      `insurers/export.xlsx?datasetId=${own.id}&policyNumber=missing`,
    );
    const emptyBook = new ExcelJS.Workbook();
    await emptyBook.xlsx.read(Readable.from([empty.bytes]));
    expect(emptyBook.worksheets[0].rowCount).toBe(1);
  });
  it('registers all routes, exact field DTOs and security in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth(undefined, 'access-token').build(),
    );
    for (const path of [
      '/datasets',
      '/insurers',
      '/reinsurers',
      '/insurers/{id}',
      '/reinsurers/{id}',
      '/insurers/{id}/reinsurers',
      '/reinsurers/{id}/insurer',
      '/facets',
      '/insurers/export.xlsx',
      '/reinsurers/export.xlsx',
    ])
      expect(
        document.paths['/api/historical-statements' + path]?.get,
      ).toBeDefined();
    expect(document.components?.schemas?.ArchiveReinsurerRowDto).toHaveProperty(
      'properties.paidWhtSecond',
    );
  });
  it('enforces PostgreSQL read-only mode even when a future callback attempts an update', async () => {
    const repository = app.get<HistoricalStatementsRepository>(
      HistoricalStatementsRepository,
    );
    await expect(
      repository.read(
        'tenant-a',
        (tx) =>
          tx.$executeRaw`UPDATE reinsurance.historical_statement_load SET "updatedAt"=now()`,
      ),
    ).rejects.toThrow(/read-only transaction/);
  });
  it('needs no operational tables and performs no archive mutations', async () => {
    const tables = (
      await admin.query<{ name: string }>(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname='reinsurance'",
      )
    ).rows.map((r) => r.name);
    expect(tables.sort()).toEqual([
      'historical_insurer_statement',
      'historical_reinsurer_statement',
      'historical_statement_file',
      'historical_statement_link',
      'historical_statement_load',
    ]);
    expect(
      (
        await admin.query<{ total: string }>(
          'SELECT count(*)::text AS total FROM reinsurance.historical_insurer_statement',
        )
      ).rows[0].total,
    ).toBe('30');
  });
});
