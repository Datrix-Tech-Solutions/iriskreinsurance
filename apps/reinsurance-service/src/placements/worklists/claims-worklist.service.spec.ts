import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  PlacementClaimStatus,
  PlacementStatus,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryClaimsWorklistDto } from '../dto/query-claims-worklist.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceClaimsWorklistService } from './claims-worklist.service';

describe('ReinsuranceClaimsWorklistService', () => {
  let prisma: { $queryRaw: jest.Mock };
  let service: ReinsuranceClaimsWorklistService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    service = new ReinsuranceClaimsWorklistService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns paginated row-ready claims data from one tenant-scoped bulk query', async () => {
    prisma.$queryRaw.mockResolvedValue([
      rawClaimRow({
        bucket: 'open',
        totalCount: 25n,
        finalLossAmount: '10000.00',
        totalAllocated: '8000.00',
        recoveredAmount: '3500.00',
        recoveredAt: '2026-08-21T10:00:00.000Z',
        nonVoidEndorsementCount: 2n,
      }),
    ]);

    const result = await service.findClaims('tenant-1', {
      tab: 'open',
      page: 2,
      limit: 10,
      search: 'POL',
      cedantId: 'cedant-1',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'claim-1',
        claimId: 'claim-1',
        placementId: 'placement-1',
        bucket: 'open',
        recoveredAmount: 3500,
        recoveredAt: '2026-08-21T10:00:00.000Z',
        isFullyRecovered: false,
        claimShare: 8000,
        nonVoidEndorsementCount: 2,
        hasNonVoidEndorsement: true,
      }),
    ]);
    expect(result.items[0]?.placement).toEqual(
      expect.objectContaining({
        id: 'placement-1',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        classOfBusiness: 'Marine',
        cedant: { id: 'cedant-1', name: 'Acme Insurance' },
        facultativeOffer: 80,
      }),
    );
    expect(result.items[0]?.claim).toEqual(
      expect.objectContaining({
        id: 'claim-1',
        claimNumber: 'CLM-001',
        finalLossAmount: '10000.00',
        estimatedLossAmount: '12000.00',
      }),
    );
  });

  it('returns empty pagination metadata without loading claims in application memory', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      service.findClaims('tenant-1', {
        tab: 'notification',
        page: 1,
        limit: 10,
      }),
    ).resolves.toEqual({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('maps notification rows with backend-derived payable share', async () => {
    prisma.$queryRaw.mockResolvedValue([
      rawClaimRow({
        bucket: 'notification',
        finalLossAmount: null,
        claimShare: '9600.00',
        recoveredAmount: '0.00',
        recoveredAt: null,
        nonVoidEndorsementCount: 0,
      }),
    ]);

    const result = await service.findClaims('tenant-1', {
      tab: 'notification',
      page: 1,
      limit: 10,
    });

    expect(result.items[0]).toMatchObject({
      bucket: 'notification',
      claimShare: 9600,
      isFullyRecovered: false,
      recoveredAt: null,
      hasNonVoidEndorsement: false,
    });
    expect(result.items[0]?.claim.finalLossAmount).toBeNull();
  });

  it('maps closed rows using recovered date sort contract and recovered amount net of reversals', async () => {
    prisma.$queryRaw.mockResolvedValue([
      rawClaimRow({
        bucket: 'closed',
        recoveredAmount: '9999.99',
        recoveredAt: new Date('2026-08-24T12:00:00.000Z'),
        totalCount: 1,
      }),
    ]);

    const result = await service.findClaims('tenant-1', {
      tab: 'closed',
      page: 1,
      limit: 10,
    });

    expect(result.items[0]).toMatchObject({
      bucket: 'closed',
      recoveredAmount: 9999.99,
      recoveredAt: '2026-08-24T12:00:00.000Z',
      isFullyRecovered: true,
    });
  });

  it('uses the required SQL classification, filtering, sorting and pagination predicates', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await service.findClaims('tenant-1', {
      tab: 'closed',
      page: 3,
      limit: 20,
      search: 'marine',
      cedantId: 'cedant-1',
    });

    const cte = renderedSql(
      (
        service as unknown as {
          classifiedClaimsCte: (
            tenantId: string,
            query: { search?: string; cedantId?: string },
          ) => unknown;
        }
      ).classifiedClaimsCte('tenant-1', {
        search: 'marine',
        cedantId: 'cedant-1',
      }),
    );
    const query = renderedSql(firstRawQuery(prisma.$queryRaw));
    expect(cte).toContain('p."archivedAt" IS NULL');
    expect(cte).toContain(
      'p."status"::text IN (\n            \'PARTIALLY_PLACED\'',
    );
    expect(cte).toContain('p."cedantId" =');
    expect(cte).toContain('p."policyNumber" ILIKE');
    expect(cte).toContain('p."title" ILIKE');
    expect(cte).toContain('p."classOfBusiness" ILIKE');
    expect(cte).toContain('pc."claimNumber" ILIKE');
    expect(cte).toContain('bc."finalLossAmount" IS NULL THEN');
    expect(cte).toContain('COALESCE(at."totalAllocated", 0) > 0');
    expect(cte).toContain('COALESCE(ccp."totalCashCalled", 0) >=');
    expect(cte).toContain('COALESCE(ccp."totalOutstanding", 0) <= 0.01');
    expect(cte).toContain(
      'COALESCE(ccp."totalConfirmed", 0) - COALESCE(ccp."totalReversed", 0)',
    );
    expect(cte).toContain('MAX(r."bankConfirmedAt") FILTER');
    expect(cte).toContain('e."status"::text <>');
    expect(query).toContain('COUNT(*) OVER() AS "totalCount"');
    expect(query).toContain('ORDER BY');
    expect(query).toContain('"claimCreatedAt" DESC, "claimId" ASC');
    expect(query).toContain('LIMIT');
    expect(query).toContain('OFFSET');
  });

  it('summarizes global claims KPIs from one query using the shared classification CTE', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        totalClaims: 12n,
        settledClaims: 3n,
        notificationClaims: 4n,
        openClaims: 6n,
        openPendingClaims: 2n,
        openFinalizedClaims: 4n,
        closedClaims: 2n,
        claimsByCurrency: [
          { code: 'GHS', amount: '10000.00' },
          { code: 'USD', amount: '250.50' },
        ],
        recoveredByCurrency: [{ code: 'GHS', amount: '9000.00' }],
        outstandingRecoveredByCurrency: [{ code: 'GHS', amount: '1000.00' }],
      },
    ]);

    const result = await service.summarizeClaims('tenant-1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totalClaims: 12,
      settledClaims: 3,
      notificationClaims: 4,
      openClaims: 6,
      openPendingClaims: 2,
      openFinalizedClaims: 4,
      closedClaims: 2,
      claimsByCurrency: [
        { code: 'GHS', amount: 10000 },
        { code: 'USD', amount: 250.5 },
      ],
      recoveredByCurrency: [{ code: 'GHS', amount: 9000 }],
      outstandingRecoveredByCurrency: [{ code: 'GHS', amount: 1000 }],
    });
  });

  it('keeps summary totals aligned with worklist bucket semantics', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        totalClaims: 1,
        settledClaims: 0,
        notificationClaims: 0,
        openClaims: 0,
        closedClaims: 1,
        claimsByCurrency: [],
        recoveredByCurrency: [],
      },
    ]);

    await service.summarizeClaims('tenant-1');

    const cte = renderedSql(
      (
        service as unknown as {
          classifiedClaimsCte: (
            tenantId: string,
            query: { search?: string; cedantId?: string },
          ) => unknown;
        }
      ).classifiedClaimsCte('tenant-1', {}),
    );
    const query = renderedSql(firstRawQuery(prisma.$queryRaw));
    expect(cte).toContain('classified_claims AS');
    expect(query).toContain('COUNT(*) FILTER (WHERE "bucket" =');
    expect(query).toContain(`WHERE "claimState"::text = 'FINALIZED'`);
    expect(query).toContain(`WHERE "bucket" = 'open'`);
  });
});

describe('QueryClaimsWorklistDto', () => {
  it('accepts expected filters and transforms pagination numbers', () => {
    const dto = plainToInstance(QueryClaimsWorklistDto, {
      tab: 'open',
      page: '2',
      limit: '100',
      search: '  POL-001  ',
      cedantId: '11111111-1111-4111-8111-111111111111',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ page: 2, limit: 100, search: 'POL-001' });
  });

  it('rejects unsupported tabs and excessive limits', () => {
    const dto = plainToInstance(QueryClaimsWorklistDto, {
      tab: 'all',
      page: '0',
      limit: '101',
    });

    expect(validateSync(dto).map((error) => error.property)).toEqual(
      expect.arrayContaining(['tab', 'page', 'limit']),
    );
  });
});

function rawClaimRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    claimId: 'claim-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    bucket: 'open',
    claimNumber: 'CLM-001',
    claimStatus: PlacementClaimStatus.NOTIFIED,
    occurrenceDate: new Date('2026-08-01T00:00:00.000Z'),
    reportedDate: new Date('2026-08-02T00:00:00.000Z'),
    claimCause: 'Fire',
    occurrenceDetails: 'Warehouse fire',
    claimCurrency: 'GHS',
    estimatedLossAmount: '12000.00',
    finalLossAmount: '10000.00',
    finalizedAt: null,
    finalizedByUserId: null,
    approvedPayableAmount: null,
    approvedAt: null,
    approvedByUserId: null,
    createdByUserId: 'user-1',
    updatedByUserId: null,
    closedAt: null,
    voidedAt: null,
    claimCreatedAt: new Date('2026-08-03T00:00:00.000Z'),
    claimUpdatedAt: new Date('2026-08-03T00:00:00.000Z'),
    placementReference: 'FAC-001',
    policyNumber: 'POL-001',
    title: 'Xpress Group',
    classOfBusiness: 'Marine',
    riskTypeId: 'risk-1',
    cedantId: 'cedant-1',
    cedantName: 'Acme Insurance',
    businessDetails: { vessel: 'WP Demo' },
    offerDetails: { terms: 'standard' },
    description: 'Demo placement',
    sumInsured: '1000000.00',
    rate: '1.2500',
    commission: '10.0000',
    facultativeOffer: '80.0000',
    premium: '12500.00',
    placementCurrency: 'GHS',
    inceptionDate: new Date('2026-01-01T00:00:00.000Z'),
    expiryDate: new Date('2026-12-31T00:00:00.000Z'),
    placementStatus: PlacementStatus.CLOSING,
    placementCreatedAt: new Date('2026-07-01T00:00:00.000Z'),
    placementUpdatedAt: new Date('2026-07-02T00:00:00.000Z'),
    archivedByUserId: null,
    archiveReason: null,
    archivedAt: null,
    closeMode: null,
    forceClosedAt: null,
    forceClosedByUserId: null,
    recoveredAmount: '0.00',
    recoveredAt: null,
    totalAllocated: '8000.00',
    claimShare: '8000.00',
    nonVoidEndorsementCount: 0,
    totalCount: 1,
    ...overrides,
  };
}

function renderedSql(value: unknown): string {
  if (Array.isArray(value)) return value.join('');
  if (!value || typeof value !== 'object') return '';
  const maybeSql = value as { strings?: unknown; values?: unknown[] };
  if (!Array.isArray(maybeSql.strings)) return '';
  return maybeSql.strings
    .map((part, index) => `${part}${renderedSql(maybeSql.values?.[index])}`)
    .join('');
}

function firstRawQuery(queryRaw: jest.Mock): unknown {
  const firstCall = queryRaw.mock.calls[0] as unknown[] | undefined;
  return firstCall?.[0];
}
