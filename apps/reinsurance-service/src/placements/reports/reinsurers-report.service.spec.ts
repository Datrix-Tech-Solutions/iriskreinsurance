import { PlacementStatus } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsurersReportService } from './reinsurers-report.service';

describe('ReinsurersReportService', () => {
  let prisma: { $queryRaw: jest.Mock<Promise<unknown>, [unknown]> };
  let service: ReinsurersReportService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn<Promise<unknown>, [unknown]>() };
    service = new ReinsurersReportService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns server-paginated reinsurer rows with participant-level currency totals', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          reinsurerId: 'reinsurer-1',
          name: 'Best Re',
          placementCount: 2n,
          participantCount: 3n,
          cededPremiumByCurrency: [
            { currency: 'GHS', amount: '35000.00' },
            { currency: 'USD', amount: '1200.00' },
          ],
          payableByCurrency: [{ currency: 'GHS', amount: '31000.00' }],
          disbursedByCurrency: [{ currency: 'GHS', amount: '20000.00' }],
          outstandingByCurrency: [{ currency: 'GHS', amount: '11000.00' }],
          pendingByCurrency: [{ currency: 'USD', amount: '200.00' }],
          cededPremium: '36200.00',
          payable: '31000.00',
          disbursed: '20000.00',
          outstanding: '11000.00',
          pending: '200.00',
          totalCount: 8n,
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          activeReinsurers: 3n,
          reinsurersWithOutstanding: 2n,
          placementCount: 5n,
          participantCount: 7n,
          sumInsured: '1000000.00',
          cededPremium: '70000.00',
          brokerage: '3000.00',
          commission: '8000.00',
          payable: '59000.00',
          disbursed: '42000.00',
          outstanding: '17000.00',
          pending: '0.00',
        },
        {
          currency: 'USD',
          activeReinsurers: 3n,
          reinsurersWithOutstanding: 2n,
          placementCount: 1n,
          participantCount: 1n,
          sumInsured: '20000.00',
          cededPremium: '2000.00',
          brokerage: '0.00',
          commission: '200.00',
          payable: '1800.00',
          disbursed: '1000.00',
          outstanding: '800.00',
          pending: '200.00',
        },
      ]);

    const result = await service.findReinsurers('tenant-1', {
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
      total: 8,
      totalPages: 1,
    });
    expect(result.items).toEqual([
      {
        reinsurerId: 'reinsurer-1',
        name: 'Best Re',
        placementCount: 2,
        participantCount: 3,
        cededPremiumByCurrency: [
          { currency: 'GHS', amount: 35000 },
          { currency: 'USD', amount: 1200 },
        ],
        payableByCurrency: [{ currency: 'GHS', amount: 31000 }],
        disbursedByCurrency: [{ currency: 'GHS', amount: 20000 }],
        outstandingByCurrency: [{ currency: 'GHS', amount: 11000 }],
        pendingByCurrency: [{ currency: 'USD', amount: 200 }],
        cededPremium: 36200,
        payable: 31000,
        disbursed: 20000,
        outstanding: 11000,
        pending: 200,
      },
    ]);
    expect(result.summary).toEqual({
      activeReinsurers: 3,
      totalPlacements: 6,
      totalParticipants: 8,
      reinsurersWithOutstanding: 2,
      totalsByCurrency: [
        {
          currency: 'GHS',
          placementCount: 5,
          participantCount: 7,
          sumInsured: 1000000,
          cededPremium: 70000,
          brokerage: 3000,
          commission: 8000,
          payable: 59000,
          disbursed: 42000,
          outstanding: 17000,
          pending: 0,
        },
        {
          currency: 'USD',
          placementCount: 1,
          participantCount: 1,
          sumInsured: 20000,
          cededPremium: 2000,
          brokerage: 0,
          commission: 200,
          payable: 1800,
          disbursed: 1000,
          outstanding: 800,
          pending: 200,
        },
      ],
    });
  });

  it('builds tenant-scoped Reinsurers SQL from effective confirmed closings and disbursements', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findReinsurers('tenant-1', {
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
    expect(sql).toContain('"PlacementClosing" pc');
    expect(sql).toContain('pc."status" = \'CONFIRMED\'');
    expect(sql).toContain('"PlacementEndorsementClosing" ec');
    expect(sql).toContain('e."status" = \'CLOSED\'');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('pay."type" = \'REINSURER_DISBURSEMENT\'');
    expect(sql).toContain('pay."status" = \'BANK_CONFIRMED\'');
    expect(sql).toContain('pay."status" = \'RECORDED\'');
    expect(sql).toContain('ps."paymentStatus" IN');
    expect(sql).not.toContain('PlacementPaymentAllocation');
    expect(sql).not.toContain('PlacementNote');
  });

  it('returns empty Reinsurers report results without fabricating totals', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.findReinsurers('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      summary: {
        activeReinsurers: 0,
        totalPlacements: 0,
        totalParticipants: 0,
        reinsurersWithOutstanding: 0,
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

  it('exports the full filtered Reinsurers CSV through the server-side report query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        reinsurerId: 'reinsurer-1',
        name: 'Best Re',
        placementCount: 2n,
        participantCount: 3n,
        cededPremiumByCurrency: [
          { currency: 'GHS', amount: '1000.00' },
          { currency: 'USD', amount: '50.00' },
        ],
        payableByCurrency: [{ currency: 'GHS', amount: '850.00' }],
        disbursedByCurrency: [{ currency: 'GHS', amount: '600.00' }],
        outstandingByCurrency: [{ currency: 'GHS', amount: '250.00' }],
        pendingByCurrency: [],
        cededPremium: '1050.00',
        payable: '850.00',
        disbursed: '600.00',
        outstanding: '250.00',
        pending: '0.00',
        totalCount: 1n,
      },
    ]);

    const csv = await service.exportReinsurersCsv('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(csv).toContain(
      'Reinsurer,Currency,Placements,Participants,Ceded Premium,Payable,Disbursed,Outstanding,Pending',
    );
    expect(csv).toContain('Best Re,GHS,2,3,1000,850,600,250,0');
    expect(csv).toContain('Best Re,USD,2,3,50,0,0,0,0');
  });
});
