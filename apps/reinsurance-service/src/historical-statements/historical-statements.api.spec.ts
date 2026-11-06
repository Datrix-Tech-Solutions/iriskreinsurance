import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as ExcelJS from 'exceljs';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  HistoricalStatementsRepository,
  ArchiveSelection,
} from './historical-statements.repository';
import {
  HistoricalStatementsService,
  statementJson,
} from './historical-statements.service';
import {
  ArchiveListQueryDto,
  ArchiveExportQueryDto,
  ArchivePageQueryDto,
  StatementKind,
  validArchiveDate,
} from './dto/historical-statements-query.dto';
import {
  CE_FIELDS,
  CE_HEADERS,
  RE_HEADERS,
  RawCell,
  column,
} from './loader/source-contract';
const scope: ArchiveSelection = {
  tenantId: 'tenant-test',
  dataset: {
    id: 'published-test',
    datasetKey: 'test',
    datasetVersion: 'v1',
    status: 'PUBLISHED',
    publishedAt: '2026-11-05T00:00:00.000Z',
    contractVersion: 'test',
    fileCount: 10,
    insurerRowCount: 4358,
    reinsurerRowCount: 12163,
    linkCount: 0,
  },
};
const raw = (values: readonly string[], row = 2): RawCell[] =>
  values.map((v, i) => ({
    columnIndex: i + 1,
    columnLetter: column(i + 1),
    sourceAddress: column(i + 1) + row,
    state: 'VALUE',
    type: 'INLINE_STRING',
    xmlValue: null,
    resolvedText: v,
    styleIndex: null,
    formula: null,
    formulaAttributes: null,
    cachedValue: null,
  }));
const values = CE_FIELDS.map((f) =>
  f === 'sumInsured100'
    ? '-123456789012345.123456789012'
    : f === 'policyNumber'
      ? '=1+1'
      : 'value',
);
const row = {
  id: 'test-row',
  datasetId: scope.dataset.id,
  year: 2025,
  sourceRow: 2,
  rowSha256: 'x',
  sourceFileName: 'synthetic.xlsx',
  sourceSheetName: 'Brokerage Statement',
  qualityWarnings: [],
  ...Object.fromEntries(CE_FIELDS.map((f, i) => [f, values[i]])),
  rawCells: raw(values),
  headerCells: raw(CE_HEADERS, 1),
};
describe('Historical archive API repository and bounded export', () => {
  const tx = {
    $executeRaw: jest
      .fn<Promise<number>, [TemplateStringsArray]>()
      .mockResolvedValue(0),
    $queryRaw: jest.fn<Promise<unknown[]>, [Prisma.Sql]>(),
  };
  const prisma = {
    $transaction: jest.fn((fn: (v: unknown) => unknown) => fn(tx)),
  };
  const repository = new HistoricalStatementsRepository(
    prisma as unknown as PrismaService,
  );
  beforeEach(() => jest.clearAllMocks());
  it('uses a READ ONLY repeatable-read snapshot and refuses absent tenant context', async () => {
    await repository.read(scope.tenantId, () => Promise.resolve('ok'));
    expect(tx.$executeRaw.mock.calls[0][0]).toEqual([
      'SET TRANSACTION READ ONLY',
    ]);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5000,
      timeout: 60000,
    });
    await expect(repository.read('', () => Promise.resolve())).rejects.toThrow(
      'Tenant-scoped',
    );
  });
  it('builds bound, literal searches and scopes all row-count queries independently', async () => {
    const q = Object.assign(new ArchiveListQueryDto(), {
        datasetId: scope.dataset.id,
        policyNumber: "a%_!'; DROP TABLE x",
        year: 2025,
        currency: 'USD',
      }),
      where = repository.filter(StatementKind.INSURER, scope, q);
    expect(where.values).toContain("%a!%!_!!'; drop table x%");
    expect(where.sql).not.toContain('DROP TABLE');
    expect(where.values).toEqual(
      expect.arrayContaining([scope.tenantId, scope.dataset.id, 2025, 'USD']),
    );
    tx.$queryRaw.mockResolvedValueOnce([{ total: '10' }]);
    await repository.read(scope.tenantId, (t) =>
      repository.count(t, StatementKind.INSURER, scope, Prisma.sql`TRUE`),
    );
    const sql = tx.$queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual([scope.tenantId, scope.dataset.id]);
  });
  it('validates date boundaries without timezone coercion and refuses incompatible sorting', () => {
    expect(validArchiveDate('0021-02-01')).toBe(true);
    expect(validArchiveDate('2024-02-29')).toBe(true);
    for (const bad of [
      '2025-02-29',
      '0000-01-01',
      '2025-13-01',
      '2025-01-01T00:00:00Z',
    ])
      expect(validArchiveDate(bad)).toBe(false);
    expect(() =>
      repository.order(StatementKind.INSURER, {
        sortBy: 'reinsurerName',
        sortOrder: 'asc',
      }),
    ).toThrow();
    expect(() =>
      repository.filter(StatementKind.INSURER, scope, {
        datasetId: scope.dataset.id,
        closedDateFrom: '2025-02-02',
        closedDateTo: '2025-02-01',
      }),
    ).toThrow();
  });
  it('accepts pagination defaults and rejects forged selectors and invalid dates', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    expect(
      await validate(
        plainToInstance(ArchiveListQueryDto, { datasetId: 'published-test' }),
        options,
      ),
    ).toHaveLength(0);
    for (const extra of [
      { tenantId: 'someone' },
      { limit: 201 },
      { offerDateFrom: '2025-02-30' },
      { sortBy: 'sql injection' },
    ])
      expect(
        (
          await validate(
            plainToInstance(ArchiveListQueryDto, {
              datasetId: 'published-test',
              ...extra,
            }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it('returns all financial strings, original-cell metadata and no private storage fields', () => {
    const result = statementJson(
      StatementKind.INSURER,
      { ...row, rawStorageKey: '/private/should-not-leak', tenantId: 'hidden' },
      true,
    );
    expect(result.sumInsured100).toBe(values[9]);
    expect(result.originalColumns).toHaveLength(29);
    expect(result).not.toHaveProperty('rawStorageKey');
    expect(result).not.toHaveProperty('tenantId');
  });
  it('exports beyond one database chunk without fetching all rows or combining currencies', async () => {
    const mock = {
      read: jest.fn((_: string, fn: (tx: unknown) => unknown) => fn({})),
      published: jest.fn().mockResolvedValue(scope),
      filter: jest.fn().mockReturnValue(Prisma.sql`TRUE`),
      order: jest.fn().mockReturnValue(Prisma.sql`s.id ASC`),
      rows: jest
        .fn<
          Promise<Record<string, unknown>[]>,
          [
            unknown,
            StatementKind,
            ArchiveSelection,
            Prisma.Sql,
            Prisma.Sql,
            number,
            number,
            boolean?,
          ]
        >()
        .mockResolvedValueOnce(Array.from({ length: 250 }, () => row))
        .mockResolvedValueOnce([{ ...row, id: 'last-row' }]),
    };
    const service = new HistoricalStatementsService(
        mock as unknown as HistoricalStatementsRepository,
      ),
      q = Object.assign(new ArchiveExportQueryDto(), {
        datasetId: scope.dataset.id,
        currency: 'USD',
      });
    const exported = await service.export(
      scope.tenantId,
      StatementKind.INSURER,
      q,
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.read(exported.getStream());
    expect(book.worksheets[0].rowCount).toBe(252);
    expect(book.worksheets[0].getCell('J2').value).toBe(values[9]);
    expect(book.worksheets[0].getCell('A2').type).toBe(
      ExcelJS.ValueType.String,
    );
    expect(mock.rows).toHaveBeenCalledTimes(2);
    expect(mock.rows.mock.calls.map((args) => args.slice(5, 7))).toEqual([
      [250, 0],
      [250, 250],
    ]);
    expect(mock.filter).toHaveBeenCalledWith(StatementKind.INSURER, scope, q);
  });
  it('returns explicit unlinked state and never invents a match from matching source names', async () => {
    const mock = {
      read: jest.fn((_: string, fn: (tx: unknown) => unknown) => fn({})),
      published: jest.fn().mockResolvedValue(scope),
      row: jest.fn().mockResolvedValue(row),
      links: jest.fn().mockResolvedValue([]),
      linkCount: jest.fn().mockResolvedValue(0),
      rows: jest.fn(),
    };
    const service = new HistoricalStatementsService(
      mock as unknown as HistoricalStatementsRepository,
    );
    const result = await service.linkedReinsurers(
      scope.tenantId,
      'row',
      { datasetId: scope.dataset.id },
      new ArchivePageQueryDto(),
    );
    expect(result).toMatchObject({
      state: 'UNLINKED',
      items: [],
      meta: { total: 0 },
    });
    expect(mock.rows).not.toHaveBeenCalled();
    expect(
      await service.linkedInsurer(scope.tenantId, 'row', {
        datasetId: scope.dataset.id,
      }),
    ).toMatchObject({ state: 'UNLINKED', item: null });
  });
  it('keeps the two original RE WHT headers at positions V and W', () => {
    expect(RE_HEADERS[21]).toBe('Paid WHT');
    expect(RE_HEADERS[22]).toBe('Paid WHT');
  });
});
