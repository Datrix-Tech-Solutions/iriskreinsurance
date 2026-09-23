import { PlacementStatus } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { FacultativeReportService } from './facultative-report.service';

describe('FacultativeReportService', () => {
  let prisma: { $queryRaw: jest.Mock<Promise<unknown>, [unknown]> };
  let service: FacultativeReportService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn<Promise<unknown>, [unknown]>() };
    service = new FacultativeReportService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns server-paginated Facultative rows with placement and participant financials', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'placement-1',
          reference: 'FAC-001',
          policyNumber: 'POL-001',
          title: 'Xpress Group',
          cedantId: 'cedant-1',
          cedantName: 'Acme Insurance',
          classOfBusiness: 'Motor Comprehensive',
          riskClassId: 'risk-class-1',
          riskClassName: 'Motor',
          offerDate: new Date('2026-09-08T08:50:34.000Z'),
          closedAt: new Date('2026-09-08T00:00:00.000Z'),
          sumInsured: '1000000.00',
          premium: '25000.00',
          currency: 'GHS',
          commission: '10.0000',
          facultativeOfferPercent: '60.0000',
          totalOfferedPercent: '60.0000',
          totalAcceptedPercent: '60.0000',
          reinsurerCount: 2n,
          status: PlacementStatus.CLOSED,
          inceptionDate: new Date('2026-09-01T00:00:00.000Z'),
          expiryDate: new Date('2027-08-31T00:00:00.000Z'),
          paymentStatus: 'Part Payment',
          facSumInsured: '600000.00',
          facPremium: '15000.00',
          paidFacPremium: '11500.00',
          cedantCommissionPercent: '10.0000',
          cedantCommissionAmount: '1500.00',
          netPremiumDueIrisk: '13500.00',
          netPremiumDueIriskPaid: '10000.00',
          brokerage: '500.00',
          brokeragePaid: '370.37',
          netPremiumDueReinsurer: '13000.00',
          netPremiumDueReinsurerPaid: '9000.00',
          reinsurers: [
            {
              reinsurerId: 'reinsurer-1',
              reinsurerName: 'Best Re',
              sharePercent: '40.0000',
              closedAt: new Date('2026-09-08T00:00:00.000Z'),
              facSumInsured: '400000.00',
              facPremium: '10000.00',
              paidFacPremium: '7407.41',
              brokerage: '300.00',
              brokeragePaid: '222.22',
              withholdingTax: '0.00',
              withholdingTaxPaid: '0.00',
              nicLevy: '0.00',
              nicLevyPaid: '0.00',
              netPremiumDueReinsurer: '9700.00',
              netPremiumPaid: '7000.00',
            },
            {
              reinsurerId: 'reinsurer-2',
              reinsurerName: 'Good Re',
              sharePercent: '20.0000',
              closedAt: new Date('2026-09-08T00:00:00.000Z'),
              facSumInsured: '200000.00',
              facPremium: '5000.00',
              paidFacPremium: '3703.70',
              brokerage: '200.00',
              brokeragePaid: '148.15',
              withholdingTax: '0.00',
              withholdingTaxPaid: '0.00',
              nicLevy: '0.00',
              nicLevyPaid: '0.00',
              netPremiumDueReinsurer: '3300.00',
              netPremiumPaid: '2000.00',
            },
          ],
          totalCount: 12n,
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          placementCount: 12n,
          participantCount: 20n,
          sumInsured: '10000000.00',
          premium: '500000.00',
          brokerage: '12000.00',
          commission: '50000.00',
          openOffers: 2n,
          acceptedOffers: 10n,
        },
      ]);

    const result = await service.findFacultative('tenant-1', {
      page: 2,
      limit: 10,
      dateField: 'closingDate',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      placementStatus: [PlacementStatus.CLOSED],
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
    expect(result.items).toHaveLength(1);
    const row = result.items[0];
    expect(row).toBeDefined();
    expect(row?.id).toBe('placement-1');
    expect(row?.policyNumber).toBe('POL-001');
    expect(row?.cedantName).toBe('Acme Insurance');
    expect(row?.riskClassName).toBe('Motor');
    expect(row?.status).toBe(PlacementStatus.CLOSED);
    expect(row?.paymentStatus).toBe('Part Payment');
    expect(row?.totalAcceptedPercent).toBe(60);
    expect(row?.reinsurerCount).toBe(2);
    expect(row?.cedantFinancials).toMatchObject({
      facPremium: 15000,
      netPremiumDueIrisk: 13500,
      netPremiumDueIriskPaid: 10000,
      brokerage: 500,
      netPremiumDueReinsurer: 13000,
      netPremiumDueReinsurerPaid: 9000,
    });
    expect(row?.reinsurers).toMatchObject([
      {
        reinsurerId: 'reinsurer-1',
        facPremium: 10000,
        netPremiumPaid: 7000,
      },
      {
        reinsurerId: 'reinsurer-2',
        facPremium: 5000,
        netPremiumPaid: 2000,
      },
    ]);
    expect(result.summary).toEqual({
      totalOffers: 12,
      openOffers: 2,
      acceptanceRate: 83.33,
      totalsByCurrency: [
        {
          currency: 'GHS',
          placementCount: 12,
          participantCount: 20,
          sumInsured: 10000000,
          premium: 500000,
          brokerage: 12000,
          commission: 50000,
        },
      ],
    });
  });

  it('builds tenant-scoped SQL without payment allocations or frontend fan-out dependencies', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findFacultative('tenant-1', {
      page: 1,
      limit: 20,
      dateField: 'premiumPaid',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      paymentStatus: ['Paid'],
    });

    const firstQuery = prisma.$queryRaw.mock.calls[0]?.[0] as
      | { sql?: string }
      | undefined;
    const sql = firstQuery?.sql ?? '';
    expect(sql).toContain('WHERE p."tenantId" =');
    expect(sql).toContain('p."archivedAt" IS NULL');
    expect(sql).toContain('"PlacementClosing" pc');
    expect(sql).toContain('"PlacementEndorsementClosing" ec');
    expect(sql).toContain('e."status" = \'CLOSED\'');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('pay."type" = \'PREMIUM_RECEIVED\'');
    expect(sql).toContain('pay."type" = \'REINSURER_DISBURSEMENT\'');
    expect(sql).toContain('pay."status" = \'BANK_CONFIRMED\'');
    expect(sql).toContain('pay."status" = \'RECORDED\'');
    expect(sql).toContain('"PlacementNote" n');
    expect(sql).toContain('n."type" = \'CREDIT_NOTE\'');
    expect(sql).toContain('rr."paymentStatus" IN');
    expect(sql).not.toContain('PlacementPaymentAllocation');
  });

  it('returns empty Facultative report results without fabricating totals', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.findFacultative('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      summary: {
        totalOffers: 0,
        openOffers: 0,
        acceptanceRate: 0,
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

  it('exports the full filtered Facultative CSV through the server-side report query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'placement-1',
        reference: 'FAC-001',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        classOfBusiness: 'Motor Comprehensive',
        riskClassId: 'risk-class-1',
        riskClassName: 'Motor',
        offerDate: new Date('2026-09-08T08:50:34.000Z'),
        closedAt: new Date('2026-09-08T00:00:00.000Z'),
        sumInsured: '1000000.00',
        premium: '25000.00',
        currency: 'GHS',
        commission: '10.0000',
        facultativeOfferPercent: '60.0000',
        totalOfferedPercent: '60.0000',
        totalAcceptedPercent: '60.0000',
        reinsurerCount: 1n,
        status: PlacementStatus.CLOSED,
        inceptionDate: new Date('2026-09-01T00:00:00.000Z'),
        expiryDate: new Date('2027-08-31T00:00:00.000Z'),
        paymentStatus: 'Paid',
        facSumInsured: '600000.00',
        facPremium: '15000.00',
        paidFacPremium: '15000.00',
        cedantCommissionPercent: '10.0000',
        cedantCommissionAmount: '1500.00',
        netPremiumDueIrisk: '13500.00',
        netPremiumDueIriskPaid: '13500.00',
        brokerage: '500.00',
        brokeragePaid: '500.00',
        netPremiumDueReinsurer: '13000.00',
        netPremiumDueReinsurerPaid: '13000.00',
        reinsurers: [],
        totalCount: 1n,
      },
    ]);

    const csv = await service.exportFacultativeCsv('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(csv).toContain('Policy Number,Insurer,Reinsurer,Insured');
    expect(csv).toContain('POL-001,Acme Insurance,,Xpress Group,Motor');
    expect(csv).toContain('Paid');
  });

  it('exports explicit reinsurer-scope Facultative CSV rows without multiplying placement-level fields in the API summary', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'placement-1',
        reference: 'FAC-001',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        classOfBusiness: 'Motor Comprehensive',
        riskClassId: 'risk-class-1',
        riskClassName: 'Motor',
        offerDate: new Date('2026-09-08T08:50:34.000Z'),
        closedAt: new Date('2026-09-08T00:00:00.000Z'),
        sumInsured: '1000000.00',
        premium: '25000.00',
        currency: 'GHS',
        commission: '10.0000',
        facultativeOfferPercent: '60.0000',
        totalOfferedPercent: '60.0000',
        totalAcceptedPercent: '60.0000',
        reinsurerCount: 2n,
        status: PlacementStatus.CLOSED,
        inceptionDate: new Date('2026-09-01T00:00:00.000Z'),
        expiryDate: new Date('2027-08-31T00:00:00.000Z'),
        paymentStatus: 'Paid',
        facSumInsured: '600000.00',
        facPremium: '15000.00',
        paidFacPremium: '15000.00',
        cedantCommissionPercent: '10.0000',
        cedantCommissionAmount: '1500.00',
        netPremiumDueIrisk: '13500.00',
        netPremiumDueIriskPaid: '13500.00',
        brokerage: '500.00',
        brokeragePaid: '500.00',
        netPremiumDueReinsurer: '13000.00',
        netPremiumDueReinsurerPaid: '13000.00',
        reinsurers: [
          {
            reinsurerId: 'reinsurer-1',
            reinsurerName: 'Best Re',
            sharePercent: '40.0000',
            closedAt: new Date('2026-09-08T00:00:00.000Z'),
            facSumInsured: '400000.00',
            facPremium: '10000.00',
            paidFacPremium: '10000.00',
            brokerage: '300.00',
            brokeragePaid: '300.00',
            withholdingTax: '30.00',
            withholdingTaxPaid: '30.00',
            nicLevy: '12.00',
            nicLevyPaid: '12.00',
            netPremiumDueReinsurer: '9700.00',
            netPremiumPaid: '9700.00',
          },
          {
            reinsurerId: 'reinsurer-2',
            reinsurerName: 'Good Re',
            sharePercent: '20.0000',
            closedAt: new Date('2026-09-08T00:00:00.000Z'),
            facSumInsured: '200000.00',
            facPremium: '5000.00',
            paidFacPremium: '5000.00',
            brokerage: '200.00',
            brokeragePaid: '200.00',
            withholdingTax: '20.00',
            withholdingTaxPaid: '20.00',
            nicLevy: '8.00',
            nicLevyPaid: '8.00',
            netPremiumDueReinsurer: '3300.00',
            netPremiumPaid: '3300.00',
          },
        ],
        totalCount: 1n,
      },
    ]);

    const csv = await service.exportFacultativeCsv('tenant-1', {
      scope: 'reinsurer',
      page: 1,
      limit: 10,
    });

    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain(
      'Policy Number,Insurer,Reinsurer,Insured,Risk Class',
    );
    expect(lines[1]).toContain('POL-001,Acme Insurance,Best Re,Xpress Group');
    expect(lines[1]).toContain('1000000');
    expect(lines[1]).toContain('10000');
    expect(lines[2]).toContain('POL-001,Acme Insurance,Good Re,Xpress Group');
    expect(lines[2]).toContain('1000000');
    expect(lines[2]).toContain('5000');
  });
});
