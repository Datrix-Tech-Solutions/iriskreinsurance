import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { BusinessExchangeReportService } from './business-exchange-report.service';

type Captured = { sql: string; values: unknown[] };

describe('BusinessExchangeReportService', () => {
  let prisma: { $queryRaw: jest.Mock<Promise<unknown>, [Captured]> };
  let service: BusinessExchangeReportService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn<Promise<unknown>, [Captured]>().mockResolvedValue([]),
    };
    service = new BusinessExchangeReportService(
      {
        ...prisma,
        $transaction: async (run: (tx: typeof prisma) => Promise<unknown>) =>
          run(prisma),
      } as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  const firstQuery = (): Captured => prisma.$queryRaw.mock.calls[0][0];
  const dates = (q: Captured) =>
    q.values.filter((v): v is Date => v instanceof Date);

  it('maps rows and per-currency totals', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          insuranceCompany: 'Acme Insurance',
          currency: 'GHS',
          period: '2026-03',
          volumeGiven: 2n,
          volumeReceived: 3n,
          businessReceived: '1000.50',
          netBalance: '400.25',
          netBrokerage: '55.00',
          totalCount: 1n,
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          companyCount: 1n,
          volumeGiven: 2n,
          volumeReceived: 3n,
          businessReceived: '1000.50',
          netBalance: '400.25',
          netBrokerage: '55.00',
        },
      ]);

    const result = await service.findBusinessExchange('tenant-1', {
      mode: 'monthly',
      year: 2026,
      month: 3,
    });

    expect(result.items).toEqual([
      {
        insuranceCompany: 'Acme Insurance',
        currency: 'GHS',
        period: '2026-03',
        volumeGiven: 2,
        volumeReceived: 3,
        businessReceived: 1000.5,
        netBalance: 400.25,
        netBrokerage: 55,
      },
    ]);
    expect(result.summary.companyCount).toBe(1);
    expect(result.summary.totalsByCurrency[0].currency).toBe('GHS');
    expect(result.meta).toEqual({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });
  });

  it('monthly with a month selects exactly that month', async () => {
    await service.findBusinessExchange('tenant-1', {
      mode: 'monthly',
      year: 2026,
      month: 3,
    });
    const q = firstQuery();
    expect(q.sql).toContain('to_char(p."createdAt", ');
    expect(dates(q).map((d) => d.toISOString())).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
    ]);
    expect(q.sql).toContain("'YYYY-MM'");
  });

  it('monthly with all months selects the whole year', async () => {
    await service.findBusinessExchange('tenant-1', {
      mode: 'monthly',
      year: 2026,
    });
    expect(dates(firstQuery()).map((d) => d.toISOString())).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ]);
  });

  it('yearly with a year selects that year, grouped by year', async () => {
    await service.findBusinessExchange('tenant-1', {
      mode: 'yearly',
      year: 2025,
    });
    const q = firstQuery();
    expect(dates(q).map((d) => d.toISOString())).toEqual([
      '2025-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
    expect(q.sql).toContain("'YYYY'");
  });

  it('yearly with all years applies no date bound', async () => {
    await service.findBusinessExchange('tenant-1', { mode: 'yearly' });
    expect(dates(firstQuery())).toHaveLength(0);
    expect(firstQuery().sql).not.toContain('"createdAt" >=');
  });

  it('merges by normalized name and counts both roles', async () => {
    await service.findBusinessExchange('tenant-1', { mode: 'yearly' });
    const sql = firstQuery().sql;
    expect(sql).toContain('"normalizedName"');
    expect(sql).toContain("pp.\"status\" IN ('ACCEPTED', 'CLOSED')");
    expect(sql).toContain('agg."businessReceived" - agg."premiumGiven"');
    expect(sql).toContain('n."effectiveAsOf" DESC');
  });

  it('exports a CSV with the requested columns', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        insuranceCompany: 'Acme, Ltd',
        currency: 'USD',
        period: '2026',
        volumeGiven: 1n,
        volumeReceived: 2n,
        businessReceived: '10',
        netBalance: '4',
        netBrokerage: '1',
        totalCount: 1n,
      },
    ]);
    const csv = await service.exportBusinessExchangeCsv('tenant-1', {
      mode: 'yearly',
    });
    expect(csv.split('\n')[0]).toBe(
      'Insurance Company,Currency,Period,Volume of Business Given,Volume of Business Received,Business Received (Premium),Net Balance,Net Brokerage',
    );
    expect(csv).toContain('"Acme, Ltd",USD,2026,1,2,10,4,1');
  });
});
