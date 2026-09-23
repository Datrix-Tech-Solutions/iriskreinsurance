import { PlacementStatus } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { PremiumsReportService } from './premiums-report.service';

describe('PremiumsReportService', () => {
  let prisma: { $queryRaw: jest.Mock<Promise<unknown>, [unknown]> };
  let service: PremiumsReportService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn<Promise<unknown>, [unknown]>() };
    service = new PremiumsReportService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns paginated Premiums report rows from set-based report queries', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'placement-1',
          placementId: 'placement-1',
          reference: 'FAC-001',
          policyNumber: 'POL-001',
          title: 'Xpress Group',
          cedantId: 'cedant-1',
          cedantName: 'Acme Insurance',
          riskClassId: 'risk-class-1',
          riskClassName: 'Motor',
          riskTypeId: 'risk-type-1',
          policyType: 'Motor Comprehensive',
          status: PlacementStatus.CLOSED,
          offerDate: new Date('2026-09-08T08:50:34.000Z'),
          closedAt: new Date('2026-09-08T00:00:00.000Z'),
          inceptionDate: new Date('2026-09-01T00:00:00.000Z'),
          expiryDate: new Date('2027-08-31T00:00:00.000Z'),
          currency: 'GHS',
          sumInsured: '1000000.00',
          premium: '25000.00',
          facultativeOfferPercent: '60.0000',
          due: '20000.00',
          paid: '15000.00',
          mandatoryDeductions: '500.00',
          effectiveSettlementCredit: '15500.00',
          outstanding: '5000.00',
          pending: '0.00',
          paymentStatus: 'Part Payment',
          reinsurers: [
            {
              reinsurerId: 'reinsurer-1',
              reinsurerName: 'Best Re',
              closingId: 'closing-1',
              sharePercent: '60.0000',
              grossPremium: '15000.00',
              commissionPercent: '10.0000',
              commissionAmount: '1500.00',
              brokerageAmount: '500.00',
              netPremium: '13500.00',
              paidAmount: '9000.00',
              outstandingAmount: '4500.00',
              closedAt: new Date('2026-09-08T00:00:00.000Z'),
            },
          ],
          totalCount: 25n,
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          placementCount: 12n,
          participantCount: 20n,
          sumInsured: '10000000.00',
          grossPremium: '500000.00',
          commission: '50000.00',
          brokerage: '12000.00',
          cedantCurrentObligation: '450000.00',
          premiumReceived: '300000.00',
          mandatoryDeductions: '12000.00',
          effectiveSettlementCredit: '312000.00',
          cedantOutstanding: '150000.00',
          cedantPending: '0.00',
          reinsurerPayable: '438000.00',
          reinsurerDisbursed: '250000.00',
          reinsurerOutstanding: '188000.00',
        },
      ]);

    const result = await service.findPremiums('tenant-1', {
      page: 2,
      limit: 10,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      dateBasis: 'INCEPTION_DATE',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'placement-1',
        placementId: 'placement-1',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        cedantName: 'Acme Insurance',
        policyType: 'Motor Comprehensive',
        status: PlacementStatus.CLOSED,
        due: 20000,
        paid: 15000,
        mandatoryDeductions: 500,
        effectiveSettlementCredit: 15500,
        outstanding: 5000,
        pending: 0,
        paymentStatus: 'Part Payment',
        closedAt: '2026-09-08T00:00:00.000Z',
        reinsurers: [
          expect.objectContaining({
            reinsurerId: 'reinsurer-1',
            closingId: 'closing-1',
            sharePercent: 60,
            grossPremium: 15000,
            netPremium: 13500,
            paidAmount: 9000,
          }),
        ],
      }),
    ]);
    expect(result.summary).toEqual({
      placementCount: 12,
      participantCount: 20,
      totalsByCurrency: [
        {
          currency: 'GHS',
          placementCount: 12,
          participantCount: 20,
          sumInsured: 10000000,
          grossPremium: 500000,
          commission: 50000,
          brokerage: 12000,
          cedantCurrentObligation: 450000,
          premiumReceived: 300000,
          mandatoryDeductions: 12000,
          effectiveSettlementCredit: 312000,
          cedantOutstanding: 150000,
          cedantPending: 0,
          reinsurerPayable: 438000,
          reinsurerDisbursed: 250000,
          reinsurerOutstanding: 188000,
        },
      ],
    });
  });

  it('keeps full-filtered totals by currency rather than adding unlike currencies', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        currency: 'EUR',
        placementCount: 1n,
        participantCount: 1n,
        sumInsured: '100.00',
        grossPremium: '10.00',
        commission: '1.00',
        brokerage: '0.00',
        cedantCurrentObligation: '9.00',
        premiumReceived: '9.00',
        mandatoryDeductions: '0.00',
        effectiveSettlementCredit: '9.00',
        cedantOutstanding: '0.00',
        cedantPending: '0.00',
        reinsurerPayable: '9.00',
        reinsurerDisbursed: '9.00',
        reinsurerOutstanding: '0.00',
      },
      {
        currency: 'GHS',
        placementCount: 2n,
        participantCount: 3n,
        sumInsured: '200.00',
        grossPremium: '20.00',
        commission: '2.00',
        brokerage: '0.00',
        cedantCurrentObligation: '18.00',
        premiumReceived: '5.00',
        mandatoryDeductions: '0.00',
        effectiveSettlementCredit: '5.00',
        cedantOutstanding: '13.00',
        cedantPending: '0.00',
        reinsurerPayable: '18.00',
        reinsurerDisbursed: '3.00',
        reinsurerOutstanding: '15.00',
      },
    ]);

    const result = await service.findPremiums('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.summary.placementCount).toBe(3);
    expect(result.summary.participantCount).toBe(4);
    expect(result.summary.totalsByCurrency).toHaveLength(2);
    expect(result.summary.totalsByCurrency.map((row) => row.currency)).toEqual([
      'EUR',
      'GHS',
    ]);
  });

  it('maps migrated-style closed placements with multiple reinsurers without auxiliary financial rows', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'placement-paid',
          placementId: 'placement-paid',
          reference: 'LEGACY-5572',
          policyNumber: '5572',
          title: 'Historical Motor Risk',
          cedantId: 'cedant-1',
          cedantName: 'Legacy Cedant',
          riskClassId: 'risk-class-1',
          riskClassName: 'Motor',
          riskTypeId: 'risk-type-1',
          policyType: 'Motor Comprehensive',
          status: PlacementStatus.CLOSED,
          offerDate: new Date('2026-04-01T08:00:00.000Z'),
          closedAt: new Date('2026-04-03T00:00:00.000Z'),
          inceptionDate: new Date('2026-04-01T00:00:00.000Z'),
          expiryDate: new Date('2027-03-31T00:00:00.000Z'),
          currency: 'GHS',
          sumInsured: '500000.00',
          premium: '5000.00',
          facultativeOfferPercent: '70.0000',
          due: '3669.12',
          paid: '3669.12',
          mandatoryDeductions: '262.08',
          effectiveSettlementCredit: '3931.20',
          outstanding: '0.00',
          pending: '0.00',
          paymentStatus: 'Paid',
          reinsurers: [
            {
              reinsurerId: 'reinsurer-1',
              reinsurerName: 'Best Re',
              closingId: 'closing-1',
              sharePercent: '40.0000',
              grossPremium: '2500.00',
              commissionPercent: '15.0000',
              commissionAmount: '375.00',
              brokerageAmount: '28.36',
              netPremium: '2096.64',
              paidAmount: '2096.64',
              outstandingAmount: '0.00',
              closedAt: new Date('2026-04-03T00:00:00.000Z'),
            },
            {
              reinsurerId: 'reinsurer-2',
              reinsurerName: 'Second Re',
              closingId: 'closing-2',
              sharePercent: '30.0000',
              grossPremium: '1169.12',
              commissionPercent: '10.0000',
              commissionAmount: '116.91',
              brokerageAmount: '0.00',
              netPremium: '1052.21',
              paidAmount: '526.11',
              outstandingAmount: '526.10',
              closedAt: new Date('2026-04-03T00:00:00.000Z'),
            },
          ],
          totalCount: 1n,
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          placementCount: 1n,
          participantCount: 2n,
          sumInsured: '500000.00',
          grossPremium: '3669.12',
          commission: '491.91',
          brokerage: '28.36',
          cedantCurrentObligation: '3669.12',
          premiumReceived: '3669.12',
          mandatoryDeductions: '262.08',
          effectiveSettlementCredit: '3931.20',
          cedantOutstanding: '0.00',
          cedantPending: '0.00',
          reinsurerPayable: '3148.85',
          reinsurerDisbursed: '2622.75',
          reinsurerOutstanding: '526.10',
        },
      ]);

    const result = await service.findPremiums('tenant-1', {
      page: 1,
      limit: 10,
      placementStatus: [PlacementStatus.CLOSED],
    });
    const sql = (
      prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string } | undefined
    )?.sql;

    expect(result.items[0]).toMatchObject({
      status: PlacementStatus.CLOSED,
      due: 3669.12,
      paid: 3669.12,
      mandatoryDeductions: 262.08,
      effectiveSettlementCredit: 3931.2,
      outstanding: 0,
      paymentStatus: 'Paid',
      reinsurers: [
        expect.objectContaining({
          reinsurerName: 'Best Re',
          paidAmount: 2096.64,
          outstandingAmount: 0,
        }),
        expect.objectContaining({
          reinsurerName: 'Second Re',
          paidAmount: 526.11,
          outstandingAmount: 526.1,
        }),
      ],
    });
    expect(result.summary.totalsByCurrency[0]).toMatchObject({
      currency: 'GHS',
      reinsurerDisbursed: 2622.75,
      reinsurerOutstanding: 526.1,
    });
    expect(sql).toContain('"PlacementEndorsementClosing" ec');
    expect(sql).toContain('e."status" = \'CLOSED\'');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).not.toContain('PlacementPaymentAllocation');
    expect(sql).not.toContain('PlacementNote');
    expect(sql).not.toContain('ReinsuranceAccountingOutbox');
  });

  it('builds the canonical settlement query from confirmed closings and bank-confirmed cash', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findPremiums('tenant-1', {
      page: 1,
      limit: 10,
      dateBasis: 'BANK_CONFIRMED_AT',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      paymentStatus: ['Paid'],
    });

    const firstQuery = prisma.$queryRaw.mock.calls[0]?.[0] as
      | { sql?: string }
      | undefined;
    const sql = firstQuery?.sql ?? '';
    expect(sql).toContain('"PlacementClosing" pc');
    expect(sql).toContain('pc."status" = \'CONFIRMED\'');
    expect(sql).toContain('pay."status" = \'BANK_CONFIRMED\'');
    expect(sql).toContain('pay."status" = \'RECORDED\'');
    expect(sql).toContain('"mandatoryDeductions"');
    expect(sql).toContain('"effectiveSettlementCredit"');
    expect(sql).toContain('"bankConfirmedAt"');
    expect(sql).toContain('"paymentStatus" IN');
  });

  it('summarizes Premiums stats in one tenant-scoped aggregate query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        placementId: 'placement-paid',
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        currency: 'GHS',
        premium: '1200.00',
        currentObligation: '1000.00',
        currentMandatoryDeductions: '100.00',
        currentPaid: '900.00',
        currentOutstanding: '0.00',
        startObligation: '1000.00',
        startMandatoryDeductions: '100.00',
        startPaid: '0.00',
        endObligation: '1000.00',
        endMandatoryDeductions: '100.00',
        endPaid: '900.00',
        endBrokerage: '50.00',
        paidInPeriod: '900.00',
      },
      {
        placementId: 'placement-partial',
        cedantId: 'cedant-2',
        cedantName: 'Best Insurance',
        currency: 'USD',
        premium: '700.00',
        currentObligation: '500.00',
        currentMandatoryDeductions: '0.00',
        currentPaid: '100.00',
        currentOutstanding: '400.00',
        startObligation: '500.00',
        startMandatoryDeductions: '0.00',
        startPaid: '0.00',
        endObligation: '500.00',
        endMandatoryDeductions: '0.00',
        endPaid: '100.00',
        endBrokerage: '20.00',
        paidInPeriod: '100.00',
      },
    ]);

    const result = await service.findPremiumStats('tenant-1', {
      since: '2026-09-01T00:00:00.000Z',
      until: '2026-09-30T23:59:59.999Z',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.dueByCurrency).toEqual([
      { code: 'GHS', amount: 1000 },
      { code: 'USD', amount: 500 },
    ]);
    expect(result.paidByCurrency).toEqual([
      { code: 'GHS', amount: 900 },
      { code: 'USD', amount: 100 },
    ]);
    expect(result.outstandingByCurrency).toEqual([
      { code: 'USD', amount: 400 },
    ]);
    expect(result.brokerageEarnedByCurrency).toEqual([
      { code: 'GHS', amount: 45 },
      { code: 'USD', amount: 4 },
    ]);
    expect(result.collectionRate).toBe(71.43);
    expect(result.topCedantsByPaidOffers).toEqual([
      {
        cedantId: 'cedant-1',
        name: 'Acme Insurance',
        count: 1,
        premiumByCurrency: [{ code: 'GHS', amount: 1200 }],
      },
    ]);

    const firstQuery = prisma.$queryRaw.mock.calls[0]?.[0] as
      | { sql?: string }
      | undefined;
    const sql = firstQuery?.sql ?? '';
    expect(sql).toContain('WHERE p."tenantId" =');
    expect(sql).toContain('"status" IN (');
    expect(sql).toContain('PARTIALLY_PLACED');
    expect(sql).toContain('PlacementEndorsementClosing');
    expect(sql).toContain('BANK_CONFIRMED');
  });

  it('returns empty Premiums stats without mixing currencies or fabricating totals', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await service.findPremiumStats('tenant-1', {
      since: '2026-09-01T00:00:00.000Z',
      until: '2026-09-30T23:59:59.999Z',
    });

    expect(result).toEqual({
      dueByCurrency: [],
      paidByCurrency: [],
      outstandingByCurrency: [],
      brokerageEarnedByCurrency: [],
      collectionRate: 0,
      topCedantsByPaidOffers: [],
    });
  });

  it('exports the full filtered CSV through the server-side report query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'placement-1',
        placementId: 'placement-1',
        reference: null,
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        riskClassId: null,
        riskClassName: null,
        riskTypeId: null,
        policyType: 'Motor Comprehensive',
        status: PlacementStatus.CLOSED,
        offerDate: new Date('2026-09-08T08:50:34.000Z'),
        closedAt: new Date('2026-09-08T00:00:00.000Z'),
        inceptionDate: null,
        expiryDate: null,
        currency: 'GHS',
        sumInsured: '1000000.00',
        premium: '25000.00',
        facultativeOfferPercent: '60.0000',
        due: '20000.00',
        paid: '20000.00',
        mandatoryDeductions: '0.00',
        effectiveSettlementCredit: '20000.00',
        outstanding: '0.00',
        pending: '0.00',
        paymentStatus: 'Paid',
        reinsurers: [],
        totalCount: 1n,
      },
    ]);

    const csv = await service.exportPremiumsCsv('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(csv).toContain('Policy Number,Reinsurer,Insured');
    expect(csv).toContain('POL-001,,Xpress Group');
    expect(csv).toContain(',20000,20000,0,20000,0,Paid');
  });
});
