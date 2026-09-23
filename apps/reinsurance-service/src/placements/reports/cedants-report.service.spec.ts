import { PlacementStatus } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { CedantsReportService } from './cedants-report.service';

describe('CedantsReportService', () => {
  let prisma: { $queryRaw: jest.Mock<Promise<unknown>, [unknown]> };
  let service: CedantsReportService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn<Promise<unknown>, [unknown]>() };
    service = new CedantsReportService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns server-paginated cedant rows with full-filtered currency totals', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          cedantId: 'cedant-1',
          name: 'Acme Insurance',
          placementCount: 3n,
          totalPremiumByCurrency: [
            { currency: 'GHS', amount: '35000.00' },
            { currency: 'USD', amount: '1200.00' },
          ],
          outstandingByCurrency: [{ currency: 'GHS', amount: '5000.00' }],
          pendingByCurrency: [{ currency: 'USD', amount: '200.00' }],
          totalPremium: '36200.00',
          outstanding: '5000.00',
          pending: '200.00',
          totalCount: 12n,
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          activeCedants: 4n,
          cedantsWithOutstanding: 2n,
          placementCount: 5n,
          sumInsured: '1000000.00',
          premium: '70000.00',
          brokerage: '3000.00',
          commission: '8000.00',
          totalPremium: '62000.00',
          received: '55000.00',
          mandatoryDeductions: '3000.00',
          effectiveSettlementCredit: '58000.00',
          outstanding: '4000.00',
          pending: '0.00',
        },
        {
          currency: 'USD',
          activeCedants: 4n,
          cedantsWithOutstanding: 2n,
          placementCount: 2n,
          sumInsured: '20000.00',
          premium: '2000.00',
          brokerage: '0.00',
          commission: '200.00',
          totalPremium: '1800.00',
          received: '1000.00',
          mandatoryDeductions: '0.00',
          effectiveSettlementCredit: '1000.00',
          outstanding: '800.00',
          pending: '200.00',
        },
      ]);

    const result = await service.findCedants('tenant-1', {
      page: 2,
      limit: 10,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      placementStatus: [PlacementStatus.CLOSED],
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
    expect(result.items).toEqual([
      {
        cedantId: 'cedant-1',
        name: 'Acme Insurance',
        placementCount: 3,
        totalPremiumByCurrency: [
          { currency: 'GHS', amount: 35000 },
          { currency: 'USD', amount: 1200 },
        ],
        outstandingByCurrency: [{ currency: 'GHS', amount: 5000 }],
        pendingByCurrency: [{ currency: 'USD', amount: 200 }],
        totalPremium: 36200,
        outstanding: 5000,
        pending: 200,
      },
    ]);
    expect(result.summary).toEqual({
      activeCedants: 4,
      totalPlacements: 7,
      cedantsWithOutstanding: 2,
      totalsByCurrency: [
        {
          currency: 'GHS',
          placementCount: 5,
          sumInsured: 1000000,
          premium: 70000,
          brokerage: 3000,
          commission: 8000,
          nicLevy: 0,
          wht: 0,
          totalPremium: 62000,
          received: 55000,
          mandatoryDeductions: 3000,
          effectiveSettlementCredit: 58000,
          outstanding: 4000,
          pending: 0,
        },
        {
          currency: 'USD',
          placementCount: 2,
          sumInsured: 20000,
          premium: 2000,
          brokerage: 0,
          commission: 200,
          nicLevy: 0,
          wht: 0,
          totalPremium: 1800,
          received: 1000,
          mandatoryDeductions: 0,
          effectiveSettlementCredit: 1000,
          outstanding: 800,
          pending: 200,
        },
      ],
    });
  });

  it('builds tenant-scoped Cedants report SQL from confirmed closings and premium receipts', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findCedants('tenant-1', {
      page: 1,
      limit: 20,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      paymentStatus: ['Part Payment'],
    });

    const firstQuery = prisma.$queryRaw.mock.calls[0]?.[0] as
      | { sql?: string }
      | undefined;
    const sql = firstQuery?.sql ?? '';
    expect(sql).toContain('WHERE p."tenantId" =');
    expect(sql).toContain('p."archivedAt" IS NULL');
    expect(sql).toContain('pc."status" = \'CONFIRMED\'');
    expect(sql).toContain('"PlacementEndorsementClosing" ec');
    expect(sql).toContain('e."status" = \'CLOSED\'');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('pay."type" = \'PREMIUM_RECEIVED\'');
    expect(sql).toContain('pay."status" = \'BANK_CONFIRMED\'');
    expect(sql).toContain('pay."status" = \'RECORDED\'');
    expect(sql).toContain('"paymentStatus" IN');
    expect(sql).not.toContain('PlacementPaymentAllocation');
    expect(sql).not.toContain('PlacementNote');
  });

  it('returns empty Cedants report results without fabricating totals', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.findCedants('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      summary: {
        activeCedants: 0,
        totalPlacements: 0,
        cedantsWithOutstanding: 0,
        totalsByCurrency: [],
      },
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('exports the full filtered Cedants CSV through the server-side report query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        cedantId: 'cedant-1',
        name: 'Acme Insurance',
        placementCount: 2n,
        totalPremiumByCurrency: [
          { currency: 'GHS', amount: '1000.00' },
          { currency: 'USD', amount: '50.00' },
        ],
        outstandingByCurrency: [{ currency: 'GHS', amount: '250.00' }],
        pendingByCurrency: [],
        totalPremium: '1050.00',
        outstanding: '250.00',
        pending: '0.00',
        totalCount: 1n,
      },
    ]);

    const csv = await service.exportCedantsCsv('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(csv).toContain(
      'Cedant,Currency,Offers,Total Premium,Outstanding,Pending',
    );
    expect(csv).toContain('Acme Insurance,GHS,2,1000,250,0');
    expect(csv).toContain('Acme Insurance,USD,2,50,0,0');
  });
});
