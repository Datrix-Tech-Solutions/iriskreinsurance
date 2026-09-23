import { PlacementStatus } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { BrokerageReportService } from './brokerage-report.service';

describe('BrokerageReportService', () => {
  let prisma: { $queryRaw: jest.Mock<Promise<unknown>, [unknown]> };
  let service: BrokerageReportService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn<Promise<unknown>, [unknown]>() };
    service = new BrokerageReportService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns server-paginated reinsurer-scope Brokerage rows without duplicating placement-level premium totals', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'placement-1:participant-1',
          placementId: 'placement-1',
          policyNumber: 'POL-001',
          title: 'Xpress Group',
          cedantId: 'cedant-1',
          cedantName: 'Acme Insurance',
          reinsurerId: 'reinsurer-1',
          reinsurerName: 'Best Re',
          riskTypeId: 'risk-type-1',
          policyType: 'Motor Comprehensive',
          status: PlacementStatus.CLOSED,
          inceptionDate: new Date('2026-09-01T00:00:00.000Z'),
          expiryDate: new Date('2027-08-31T00:00:00.000Z'),
          currency: 'GHS',
          sumInsured: '1000000.00',
          premium: '25000.00',
          exchangeRate: '1.000000',
          grossPremium: '10000.00',
          brokerageAmount: '300.00',
          brokeragePaid: '222.22',
          withholdingTax: '30.00',
          withholdingTaxPaid: '22.22',
          nicLevy: '12.00',
          nicLevyPaid: '8.89',
          paymentStatus: 'Part Payment',
          totalCount: 2n,
        },
        {
          id: 'placement-1:participant-2',
          placementId: 'placement-1',
          policyNumber: 'POL-001',
          title: 'Xpress Group',
          cedantId: 'cedant-1',
          cedantName: 'Acme Insurance',
          reinsurerId: 'reinsurer-2',
          reinsurerName: 'Good Re',
          riskTypeId: 'risk-type-1',
          policyType: 'Motor Comprehensive',
          status: PlacementStatus.CLOSED,
          inceptionDate: new Date('2026-09-01T00:00:00.000Z'),
          expiryDate: new Date('2027-08-31T00:00:00.000Z'),
          currency: 'GHS',
          sumInsured: '1000000.00',
          premium: '25000.00',
          exchangeRate: '1.000000',
          grossPremium: '5000.00',
          brokerageAmount: '200.00',
          brokeragePaid: '148.15',
          withholdingTax: '20.00',
          withholdingTaxPaid: '14.81',
          nicLevy: '8.00',
          nicLevyPaid: '5.93',
          paymentStatus: 'Part Payment',
          totalCount: 2n,
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          placementCount: 1n,
          participantCount: 2n,
          premium: '25000.00',
          grossPremium: '15000.00',
          brokerageAmount: '500.00',
          brokeragePaid: '370.37',
          withholdingTax: '50.00',
          withholdingTaxPaid: '37.03',
          nicLevy: '20.00',
          nicLevyPaid: '14.82',
        },
      ]);

    const result = await service.findBrokerage('tenant-1', {
      page: 1,
      limit: 10,
      scope: 'reinsurer',
      dateBasis: 'INCEPTION_DATE',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });

    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: 'placement-1:participant-1',
      placementId: 'placement-1',
      reinsurerName: 'Best Re',
      grossPremium: 10000,
      brokerageAmount: 300,
      brokeragePaid: 222.22,
      withholdingTax: 30,
      withholdingTaxPaid: 22.22,
      nicLevy: 12,
      nicLevyPaid: 8.89,
      paymentStatus: 'Part Payment',
    });
    expect(result.summary).toEqual({
      scope: 'reinsurer',
      placementCount: 1,
      participantCount: 2,
      totalsByCurrency: [
        {
          currency: 'GHS',
          placementCount: 1,
          participantCount: 2,
          premium: 25000,
          grossPremium: 15000,
          brokerageAmount: 500,
          brokeragePaid: 370.37,
          withholdingTax: 50,
          withholdingTaxPaid: 37.03,
          nicLevy: 20,
          nicLevyPaid: 14.82,
        },
      ],
    });
  });

  it('builds tenant-scoped Brokerage SQL with credit notes, endorsements, and no payment allocation dependency', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findBrokerage('tenant-1', {
      scope: 'reinsurer',
      page: 1,
      limit: 20,
      dateBasis: 'BANK_CONFIRMED_AT',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      paymentStatus: ['Paid'],
      reinsurerId: ['7c755411-6e8d-43f0-9c18-5fe3689deca1'],
    });

    const firstQuery = prisma.$queryRaw.mock.calls[0]?.[0] as
      | { sql?: string }
      | undefined;
    const summaryQuery = prisma.$queryRaw.mock.calls[1]?.[0] as
      | { sql?: string }
      | undefined;
    const sql = `${firstQuery?.sql ?? ''}\n${summaryQuery?.sql ?? ''}`;
    expect(sql).toContain('WHERE p."tenantId" =');
    expect(sql).toContain('p."archivedAt" IS NULL');
    expect(sql).toContain('"PlacementClosing" pc');
    expect(sql).toContain('"PlacementEndorsementClosing" ec');
    expect(sql).toContain('e."status" = \'CLOSED\'');
    expect(sql).toContain('"PlacementNote" n');
    expect(sql).toContain('n."type" = \'CREDIT_NOTE\'');
    expect(sql).toContain('pay_date."bankConfirmedAt"');
    expect(sql).toContain('br."reinsurerId" IN');
    expect(sql).toContain('br."paymentStatus" IN');
    expect(sql).toContain('placement_premiums');
    expect(sql).not.toContain('PlacementPaymentAllocation');
  });

  it('returns empty Brokerage results without fabricating totals', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.findBrokerage('tenant-1', {
      scope: 'cedant',
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      summary: {
        scope: 'cedant',
        placementCount: 0,
        participantCount: 0,
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

  it('exports Brokerage CSV using the same server-side report query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'placement-1:participant-1',
        placementId: 'placement-1',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        reinsurerId: 'reinsurer-1',
        reinsurerName: 'Best Re',
        riskTypeId: 'risk-type-1',
        policyType: 'Motor Comprehensive',
        status: PlacementStatus.CLOSED,
        inceptionDate: new Date('2026-09-01T00:00:00.000Z'),
        expiryDate: new Date('2027-08-31T00:00:00.000Z'),
        currency: 'GHS',
        sumInsured: '1000000.00',
        premium: '25000.00',
        exchangeRate: '1.000000',
        grossPremium: '10000.00',
        brokerageAmount: '300.00',
        brokeragePaid: '300.00',
        withholdingTax: '30.00',
        withholdingTaxPaid: '30.00',
        nicLevy: '12.00',
        nicLevyPaid: '12.00',
        paymentStatus: 'Paid',
        totalCount: 1n,
      },
    ]);

    const csv = await service.exportBrokerageCsv('tenant-1', {
      scope: 'reinsurer',
      page: 1,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(csv).toContain('Policy Number,Reinsurer,Insured');
    expect(csv).toContain('Brokerage Paid,WHT,WHT Paid,NIC Levy,NIC Levy Paid');
    expect(csv).not.toContain('Realized');
    expect(csv).toContain(
      'POL-001,Best Re,Xpress Group,Motor Comprehensive,Acme Insurance,2026-09-01 - 2027-08-31',
    );
    expect(csv).toContain('Paid');
  });
});
