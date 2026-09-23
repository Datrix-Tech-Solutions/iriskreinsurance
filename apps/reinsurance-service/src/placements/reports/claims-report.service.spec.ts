import { PlacementClaimState } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ClaimsReportService } from './claims-report.service';

describe('ClaimsReportService', () => {
  let prisma: { $queryRaw: jest.Mock<Promise<unknown>, [unknown]> };
  let service: ClaimsReportService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn<Promise<unknown>, [unknown]>() };
    service = new ClaimsReportService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns server-paginated claim rows with full-filtered currency totals', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        rawClaimReportRow({
          id: 'claim-1:reinsurer-1',
          claimId: 'claim-1',
          reinsurerId: 'reinsurer-1',
          reinsurerName: 'Best Re',
          reinsurerSharePercent: '60.00',
          reinsurerShareAmount: '6000.00',
          reinsurerPaidAmount: '2500.00',
          reinsurerOutstandingAmount: '3500.00',
          totalCount: 8n,
        }),
      ])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          claimCount: 3n,
          claimAmount: '18000.00',
          iriskShareAmount: '14000.00',
          bankConfirmedRecovery: '7000.00',
          outstandingRecovery: '7000.00',
          openClaims: 2n,
          closedClaims: 1n,
        },
        {
          currency: 'USD',
          claimCount: 1n,
          claimAmount: '1200.00',
          iriskShareAmount: '900.00',
          bankConfirmedRecovery: '0.00',
          outstandingRecovery: '900.00',
          openClaims: 1n,
          closedClaims: 0n,
        },
      ]);

    const result = await service.findClaims('tenant-1', {
      page: 2,
      limit: 10,
      scope: 'reinsurer',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      bucket: ['open'],
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
        id: 'claim-1:reinsurer-1',
        claimId: 'claim-1',
        placementId: 'placement-1',
        bucket: 'open',
        policyNumber: 'POL-001',
        businessName: 'Xpress Group',
        cedantId: 'cedant-1',
        cedantName: 'Acme Insurance',
        riskTypeId: 'risk-type-1',
        policyType: 'Marine Cargo',
        claimType: 'Fire',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-12-31T00:00:00.000Z',
        claimNumber: 'CLM-001',
        currency: 'GHS',
        occurrenceDate: '2026-08-10T00:00:00.000Z',
        premiumPaidAt: '2026-07-01T00:00:00.000Z',
        estimatedLossAmount: 12000,
        finalLossAmount: 10000,
        claimAmount: 10000,
        claimState: PlacementClaimState.FINALIZED,
        finalizedAt: '2026-08-15T00:00:00.000Z',
        recoveredAmount: 3500,
        recoveredAt: '2026-08-20T00:00:00.000Z',
        iriskSharePercent: 80,
        iriskShareAmount: 8000,
        iriskSharePaid: 3500,
        iriskShareOutstanding: 4500,
        reinsurerId: 'reinsurer-1',
        reinsurerName: 'Best Re',
        reinsurerSharePercent: 60,
        reinsurerShareAmount: 6000,
        reinsurerPaidAmount: 2500,
        reinsurerOutstandingAmount: 3500,
        agingDays: 5,
        dolDop: 40,
      },
    ]);
    expect(result.summary).toEqual({
      scope: 'reinsurer',
      openClaims: 3,
      closedClaims: 1,
      recoveryRate: 25,
      totalsByCurrency: [
        {
          currency: 'GHS',
          claimCount: 3,
          claimAmount: 18000,
          iriskShareAmount: 14000,
          bankConfirmedRecovery: 7000,
          outstandingRecovery: 7000,
        },
        {
          currency: 'USD',
          claimCount: 1,
          claimAmount: 1200,
          iriskShareAmount: 900,
          bankConfirmedRecovery: 0,
          outstandingRecovery: 900,
        },
      ],
    });
  });

  it('builds tenant-scoped Claims SQL using set-based allocations and recoveries', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findClaims('tenant-1', {
      scope: 'reinsurer',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      currency: ['GHS'],
      cedantId: ['cedant-1'],
      reinsurerId: ['reinsurer-1'],
      claimState: [PlacementClaimState.FINALIZED],
      recoveryStatus: ['part'],
      search: 'marine',
    });

    const sql = renderedSql(firstRawQuery(prisma.$queryRaw));
    expect(sql).toContain('WHERE pc."tenantId" =');
    expect(sql).toContain('pc."status"::text <> \'VOID\'');
    expect(sql).toContain('pc."occurrenceDate" >=');
    expect(sql).toContain('pc."currency" IN');
    expect(sql).toContain('p."cedantId" IN');
    expect(sql).toContain('p."policyNumber" ILIKE');
    expect(sql).toContain('"PlacementClaimAllocation" a');
    expect(sql).toContain('"PlacementClaimRecoveryReceipt" r');
    expect(sql).toContain('r."status"::text = \'BANK_CONFIRMED\'');
    expect(sql).toContain('r."reversalOfReceiptId" IS NULL');
    expect(sql).toContain('filtered_reinsurers');
    expect(sql).toContain('"reinsurerId" IN');
    expect(sql).toContain('"recoveryStatus" IN');
    expect(sql).toContain('COUNT(*) OVER() AS "totalCount"');
    expect(sql).toContain('LIMIT');
    expect(sql).toContain('OFFSET');
    expect(sql).not.toContain('PlacementNote');
    expect(sql).not.toContain('PlacementPaymentAllocation');
  });

  it('uses one claim-level row per claim for cedant scope without multiplying totals by reinsurers', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findClaims('tenant-1', {
      scope: 'cedant',
      page: 1,
      limit: 20,
    });

    const sql = renderedSql(firstRawQuery(prisma.$queryRaw));
    expect(sql).toContain('FROM filtered_claims filtered');
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('"claimId"');
  });

  it('exports the full filtered Claims CSV through the server-side report query', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      rawClaimReportRow({
        reinsurerName: 'Best Re',
        reinsurerShareAmount: '6000.00',
        reinsurerPaidAmount: '6000.00',
        reinsurerOutstandingAmount: '0.00',
      }),
    ]);

    const csv = await service.exportClaimsCsv('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(csv).toContain(
      'Business Name,Cedant,Policy Type,Policy Number,Claim Type,Claim Number,Period of Insurance,Date of Loss,Currency,Claim Amount,iRisk Share %,iRisk Share Amount,iRisk Share Recovered,iRisk Share Outstanding,Reinsurer Name,Reinsurer % Share,Reinsurer Share Amount,Reinsurer Bank-Confirmed Recovery,Reinsurer Outstanding Recovery,Aging (days),DoL:DoP',
    );
    expect(csv).toContain(
      'Xpress Group,Acme Insurance,Marine Cargo,POL-001,Fire,CLM-001',
    );
    expect(csv).toContain('Best Re,50,6000,6000,0');
  });

  it('returns empty Claims report results without fabricating totals', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.findClaims('tenant-1', {
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      summary: {
        scope: 'general',
        openClaims: 0,
        closedClaims: 0,
        recoveryRate: 0,
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
});

function rawClaimReportRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'claim-1',
    claimId: 'claim-1',
    placementId: 'placement-1',
    bucket: 'open',
    policyNumber: 'POL-001',
    businessName: 'Xpress Group',
    cedantId: 'cedant-1',
    cedantName: 'Acme Insurance',
    riskTypeId: 'risk-type-1',
    policyType: 'Marine Cargo',
    claimType: 'Fire',
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-12-31T00:00:00.000Z',
    claimNumber: 'CLM-001',
    currency: 'GHS',
    occurrenceDate: '2026-08-10T00:00:00.000Z',
    premiumPaidAt: '2026-07-01T00:00:00.000Z',
    estimatedLossAmount: '12000.00',
    finalLossAmount: '10000.00',
    claimAmount: '10000.00',
    claimState: PlacementClaimState.FINALIZED,
    finalizedAt: '2026-08-15T00:00:00.000Z',
    recoveredAmount: '3500.00',
    recoveredAt: '2026-08-20T00:00:00.000Z',
    iriskSharePercent: '80.00',
    iriskShareAmount: '8000.00',
    iriskSharePaid: '3500.00',
    iriskShareOutstanding: '4500.00',
    reinsurerId: null,
    reinsurerName: null,
    reinsurerSharePercent: '50.00',
    reinsurerShareAmount: '5000.00',
    reinsurerPaidAmount: '1000.00',
    reinsurerOutstandingAmount: '4000.00',
    agingDays: 5n,
    dolDop: 40n,
    totalCount: 1n,
    ...overrides,
  };
}

function firstRawQuery(mock: jest.Mock<Promise<unknown>, [unknown]>): unknown {
  return mock.mock.calls[0]?.[0];
}

function renderedSql(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'sql' in value &&
    typeof (value as { sql?: unknown }).sql === 'string'
  ) {
    return (value as { sql: string }).sql;
  }
  return String(value);
}
