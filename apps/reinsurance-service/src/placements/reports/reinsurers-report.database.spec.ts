import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, ClientConfig } from 'pg';
import {
  Prisma,
  PrismaClient,
  PlacementStatus,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsurersReportService } from './reinsurers-report.service';

// Opt-in only: never use the application's DATABASE_URL or a remote database.
const databaseUrl = process.env.REPORTS_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

function localDatabaseConfig(value: string): ClientConfig {
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^\/irisk_reports_test_[a-zA-Z0-9_]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'REPORTS_TEST_DATABASE_URL must target an explicit local irisk_reports_test_ database without URL options',
    );
  }
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: false,
    connectionTimeoutMillis: 3000,
    options: '-c statement_timeout=10000',
  };
}

const identifier = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Query-only fixture schema: scalar columns come from the generated Prisma models,
 * with native Decimal precision from schema.prisma. Relations are not installed:
 * these tests exercise real PostgreSQL parsing, joins, grouping and Prisma result
 * decoding, not operational write workflows. No archive tables/migrations are used.
 */
async function installReportSchema(client: Client) {
  const schema = readFileSync(
    resolve(__dirname, '../../../prisma/schema.prisma'),
    'utf8',
  );
  const names = [
    'Placement',
    'Counterparty',
    'RiskType',
    'RiskClass',
    'PlacementParticipant',
    'PlacementClosing',
    'PlacementEndorsement',
    'PlacementEndorsementParticipant',
    'PlacementEndorsementClosing',
    'PlacementPayment',
  ];
  const models = Prisma.dmmf.datamodel.models.filter((model) =>
    names.includes(model.name),
  );
  const usedEnums = new Set(
    models.flatMap((model) =>
      model.fields
        .filter((field) => field.kind === 'enum')
        .map((field) => field.type),
    ),
  );
  await client.query('CREATE SCHEMA "reinsurance"');
  for (const item of Prisma.dmmf.datamodel.enums.filter((item) =>
    usedEnums.has(item.name),
  )) {
    await client.query(
      `CREATE TYPE "reinsurance".${identifier(item.dbName ?? item.name)} AS ENUM (${item.values.map((value) => `'${value.name.replace(/'/g, "''")}'`).join(',')})`,
    );
  }
  for (const model of models) {
    const body = schema.match(
      new RegExp(`model ${model.name} \\{([\\s\\S]*?)\\n\\}`),
    )?.[1];
    if (!body) throw new Error(`Missing Prisma model ${model.name}`);
    const columns = model.fields
      .filter((field) => field.kind !== 'object')
      .map((field) => {
        const declaration = body
          .split('\n')
          .find((line) => new RegExp(`^\\s*${field.name}\\s`).test(line));
        const decimal = declaration?.match(/@db.Decimal\((\d+),\s*(\d+)\)/);
        const sqlType =
          field.kind === 'enum'
            ? `"reinsurance".${identifier(field.type)}`
            : (
                {
                  String: 'text',
                  DateTime: 'timestamp(3)',
                  Decimal: decimal
                    ? `numeric(${decimal[1]},${decimal[2]})`
                    : 'numeric',
                  Boolean: 'boolean',
                  Int: 'integer',
                  BigInt: 'bigint',
                  Float: 'double precision',
                  Json: 'jsonb',
                } as Record<string, string>
              )[field.type];
        if (!sqlType || field.isList)
          throw new Error(
            `Unsupported fixture field ${model.name}.${field.name}`,
          );
        return `${identifier(field.dbName ?? field.name)} ${sqlType}${field.isId ? ' PRIMARY KEY' : ''}`;
      });
    await client.query(
      `CREATE TABLE "reinsurance".${identifier(model.dbName ?? model.name)} (${columns.join(',')})`,
    );
  }
}

databaseDescribe('Reinsurers report real PostgreSQL', () => {
  let pg: Client;
  let prisma: PrismaClient;
  let service: ReinsurersReportService;
  const tenant = randomUUID();
  const otherTenant = randomUUID();
  const reinsurer = randomUUID();
  const secondReinsurer = randomUUID();

  async function insert(table: string, values: Record<string, string | null>) {
    const keys = Object.keys(values);
    await pg.query(
      `INSERT INTO "reinsurance".${identifier(table)} (${keys.map(identifier).join(',')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(',')})`,
      Object.values(values),
    );
  }

  async function placement(tenantId: string, currency: string, label: string) {
    const id = randomUUID();
    await insert('Placement', {
      id,
      tenantId,
      reference: label,
      policyNumber: label,
      title: 'Synthetic report fixture',
      currency,
      status: 'CLOSED',
      inceptionDate: '2026-01-01',
      createdAt: '2026-01-01',
    });
    return id;
  }

  async function closing(
    tenantId: string,
    placementId: string,
    counterpartyId: string,
    gross: string,
    net: string,
    sumInsured: string,
    role: 'REINSURER' | 'CO_REINSURER' = 'REINSURER',
  ) {
    const participantId = randomUUID();
    await insert('PlacementParticipant', {
      id: participantId,
      tenantId,
      placementId,
      counterpartyId,
      role,
      status: 'CLOSED',
    });
    await insert('PlacementClosing', {
      id: randomUUID(),
      tenantId,
      placementId,
      participantId,
      status: 'CONFIRMED',
      sumInsuredSnapshot: sumInsured,
      grossPremium: gross,
      commissionAmount: String(Number(gross) / 10),
      brokerageAmount: String(Number(gross) / 10),
      netPremium: net,
      createdAt: '2026-01-01',
    });
    return participantId;
  }

  beforeAll(async () => {
    const config = localDatabaseConfig(databaseUrl!);
    pg = new Client(config);
    await pg.connect();
    // Refuse an existing schema rather than dropping or overwriting any data.
    const existing = await pg.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='reinsurance') AS exists",
    );
    if (existing.rows[0].exists)
      throw new Error('Integration tests require a fresh disposable database');
    await installReportSchema(pg);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    service = new ReinsurersReportService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
    await insert('Counterparty', {
      id: reinsurer,
      tenantId: tenant,
      name: 'Synthetic Alpha Re',
    });
    await insert('Counterparty', {
      id: secondReinsurer,
      tenantId: tenant,
      name: 'Synthetic Beta Re',
    });
    const first = await placement(tenant, 'GHS', 'SYNTHETIC-GHS-1');
    const firstParticipant = await closing(
      tenant,
      first,
      reinsurer,
      '500',
      '400',
      '50000',
    );
    // Same reinsurer, separate participant: placement count must remain one.
    await closing(
      tenant,
      first,
      reinsurer,
      '250',
      '200',
      '25000',
      'CO_REINSURER',
    );
    const betaParticipant = await closing(
      tenant,
      first,
      secondReinsurer,
      '250',
      '200',
      '25000',
    );
    const second = await placement(tenant, 'GHS', 'SYNTHETIC-GHS-2');
    await closing(tenant, second, reinsurer, '200', '160', '20000');
    const third = await placement(tenant, 'USD', 'SYNTHETIC-USD');
    await closing(tenant, third, reinsurer, '100', '80', '10000');
    for (const [participantId, counterpartyId, amount, status] of [
      [firstParticipant, reinsurer, '100', 'BANK_CONFIRMED'],
      [firstParticipant, reinsurer, '20', 'RECORDED'],
      [betaParticipant, secondReinsurer, '50', 'BANK_CONFIRMED'],
    ]) {
      await insert('PlacementPayment', {
        id: randomUUID(),
        tenantId: tenant,
        placementId: first,
        participantId,
        counterpartyId,
        type: 'REINSURER_DISBURSEMENT',
        status,
        currency: 'GHS',
        amount,
      });
    }
    const external = await placement(
      otherTenant,
      'GHS',
      'SYNTHETIC-OTHER-TENANT',
    );
    const externalRe = randomUUID();
    await insert('Counterparty', {
      id: externalRe,
      tenantId: otherTenant,
      name: 'Synthetic isolated reinsurer',
    });
    await closing(
      otherTenant,
      external,
      externalRe,
      '999999',
      '799999',
      '99999999',
    );
  }, 30000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pg?.end();
  });

  it('executes list and full summary with distinct placements and separate currencies', async () => {
    const result = await service.findReinsurers(tenant, {
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.meta.total).toBe(2);
    const alpha = result.items.find((row) => row.reinsurerId === reinsurer)!;
    expect(alpha.placementCount).toBe(3);
    expect(alpha.participantCount).toBe(4);
    expect(alpha.payableByCurrency).toEqual([
      { currency: 'GHS', amount: 760 },
      { currency: 'USD', amount: 80 },
    ]);
    expect(result.summary.totalPlacements).toBe(3);
    expect(result.summary.totalParticipants).toBe(5);
    expect(result.summary.totalsByCurrency).toEqual([
      expect.objectContaining({
        currency: 'GHS',
        placementCount: 2,
        participantCount: 4,
        sumInsured: 120000,
        cededPremium: 1200,
        payable: 960,
        disbursed: 150,
        outstanding: 810,
        pending: 20,
      }),
      expect.objectContaining({
        currency: 'USD',
        placementCount: 1,
        participantCount: 1,
        sumInsured: 10000,
        cededPremium: 100,
        payable: 80,
        disbursed: 0,
        outstanding: 80,
      }),
    ]);
  });

  it('filters currency, lifecycle and dates in PostgreSQL without changing money definitions', async () => {
    const result = await service.findReinsurers(tenant, {
      currency: ['GHS'],
      placementStatus: [PlacementStatus.CLOSED],
      dateFrom: '2026-01-01',
      dateTo: '2026-01-01',
    });
    expect(result.summary.totalPlacements).toBe(2);
    expect(result.summary.totalParticipants).toBe(4);
    expect(result.summary.totalsByCurrency).toHaveLength(1);
    expect(
      result.items.find((row) => row.reinsurerId === reinsurer)?.placementCount,
    ).toBe(2);
  });

  it('paginates rows independently of full filtered summary totals', async () => {
    const first = await service.findReinsurers(tenant, {
      page: 1,
      limit: 1,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    const second = await service.findReinsurers(tenant, {
      page: 2,
      limit: 1,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(first.items.map((row) => row.reinsurerId)).toEqual([reinsurer]);
    expect(second.items.map((row) => row.reinsurerId)).toEqual([
      secondReinsurer,
    ]);
    expect(first.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(second.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(first.summary).toEqual(second.summary);
  });

  it('executes CSV and XLS with the same per-currency counts and amounts as the API', async () => {
    const query = { currency: ['GHS'], reinsurerId: [reinsurer] };
    const result = await service.findReinsurers(tenant, query);
    const csv = await service.exportReinsurersCsv(tenant, query);
    const excel = await service.exportReinsurersExcel(tenant, query);
    expect(result.items[0].placementCount).toBe(2);
    expect(csv.trim().split('\n')).toEqual([
      'Reinsurer,Currency,Placements,Participants,Ceded Premium,Payable,Disbursed,Outstanding,Pending',
      'Synthetic Alpha Re,GHS,2,3,950,760,100,660,20',
    ]);
    expect(excel).toContain(
      '<td>Synthetic Alpha Re</td><td>GHS</td><td>2</td><td>3</td>',
    );
    expect(excel).toContain(
      '<td>950</td><td>760</td><td>100</td><td>660</td><td>20</td>',
    );
  });

  it('returns successful empty results and header-only exports for an empty tenant', async () => {
    const emptyTenant = randomUUID();
    const result = await service.findReinsurers(emptyTenant, {});
    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.summary.totalPlacements).toBe(0);
    expect(result.summary.totalsByCurrency).toEqual([]);
    expect(
      (await service.exportReinsurersCsv(emptyTenant, {})).trim().split('\n'),
    ).toHaveLength(1);
    expect(await service.exportReinsurersExcel(emptyTenant, {})).toContain(
      '<td>Reinsurer</td>',
    );
  });

  it('does not include another tenant and excludes date-filtered empty results', async () => {
    const other = await service.findReinsurers(otherTenant, {});
    expect(other.meta.total).toBe(1);
    expect(other.items[0].name).toBe('Synthetic isolated reinsurer');
    const excluded = await service.findReinsurers(tenant, {
      dateFrom: '2027-01-01',
    });
    expect(excluded.items).toEqual([]);
    expect(excluded.summary.totalsByCurrency).toEqual([]);
  });
});
