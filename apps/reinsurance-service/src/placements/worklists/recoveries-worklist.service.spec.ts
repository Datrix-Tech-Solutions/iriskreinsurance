import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PlacementClaimCashCallStatus } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryRecoveriesWorklistDto } from '../dto/query-recoveries-worklist.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceRecoveriesWorklistService } from './recoveries-worklist.service';

describe('ReinsuranceRecoveriesWorklistService', () => {
  let prisma: { $queryRaw: jest.Mock };
  let service: ReinsuranceRecoveriesWorklistService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    service = new ReinsuranceRecoveriesWorklistService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns paginated recovery rows and currency-separated summary from set-based queries', async () => {
    prisma.$queryRaw.mockResolvedValue([
      rawRecoveryRow({
        totalCount: 125n,
        recordedAmount: '100.00',
        confirmedAmount: '400.00',
        reversedAmount: '50.00',
        outstandingAmount: '600.00',
        recoveredAmount: '400.00',
        recoveryStatus: 'PARTIALLY_RECOVERED',
        summaryByCurrency: [
          {
            currency: 'GHS',
            calledAmount: '1000.00',
            recordedAmount: '100.00',
            confirmedAmount: '400.00',
            outstandingAmount: '600.00',
            overdueCount: 2n,
          },
          {
            currency: 'USD',
            calledAmount: '50.00',
            recordedAmount: '0.00',
            confirmedAmount: '50.00',
            outstandingAmount: '0.00',
            overdueCount: 0,
          },
        ],
      }),
    ]);

    const result = await service.findRecoveries('tenant-1', {
      page: 3,
      limit: 10,
      search: 'POL',
      reinsurerId: 'reinsurer-1',
      recoveryStatus: 'PARTIALLY_RECOVERED',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({
      page: 3,
      limit: 10,
      total: 125,
      totalPages: 13,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'cash-call-1',
        placementId: 'placement-1',
        claimId: 'claim-1',
        cashCallId: 'cash-call-1',
        allocationId: 'allocation-1',
        reinsurerId: 'reinsurer-1',
        recordedAmount: 100,
        confirmedAmount: 400,
        reversedAmount: 50,
        outstandingAmount: 600,
        recoveryStatus: 'PARTIALLY_RECOVERED',
      }),
    ]);
    expect(result.summary.byCurrency).toEqual([
      {
        currency: 'GHS',
        calledAmount: 1000,
        recordedAmount: 100,
        confirmedAmount: 400,
        outstandingAmount: 600,
        overdueCount: 2,
      },
      {
        currency: 'USD',
        calledAmount: 50,
        recordedAmount: 0,
        confirmedAmount: 50,
        outstandingAmount: 0,
        overdueCount: 0,
      },
    ]);
  });

  it('returns out-of-range pages with total and summary instead of falsely reporting an empty worklist', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        totalCount: 101n,
        summaryByCurrency: [
          {
            currency: 'GHS',
            calledAmount: '1000.00',
            recordedAmount: '0.00',
            confirmedAmount: '250.00',
            outstandingAmount: '750.00',
            overdueCount: 1,
          },
        ],
      },
    ]);

    await expect(
      service.findRecoveries('tenant-1', { page: 11, limit: 10 }),
    ).resolves.toEqual({
      items: [],
      meta: { page: 11, limit: 10, total: 101, totalPages: 11 },
      summary: {
        byCurrency: [
          {
            currency: 'GHS',
            calledAmount: 1000,
            recordedAmount: 0,
            confirmedAmount: 250,
            outstandingAmount: 750,
            overdueCount: 1,
          },
        ],
      },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('uses tenant-scoped joins, filters, receipt status rollups and SQL pagination', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await service.findRecoveries('tenant-1', {
      page: 2,
      limit: 25,
      search: 'marine',
      reinsurerId: 'reinsurer-1',
      cedantId: 'cedant-1',
      recoveryStatus: 'FULLY_RECOVERED',
      cashCallStatus: PlacementClaimCashCallStatus.ISSUED,
      currency: 'ghs',
      since: '2026-01-01T00:00:00.000Z',
      until: '2026-02-01T00:00:00.000Z',
    });

    const cte = renderedSql(
      (
        service as unknown as {
          recoveriesCte: (
            tenantId: string,
            query: {
              search?: string;
              reinsurerId?: string;
              cedantId?: string;
              currency?: string;
              since?: string;
              until?: string;
            },
          ) => unknown;
        }
      ).recoveriesCte('tenant-1', {
        search: 'marine',
        reinsurerId: 'reinsurer-1',
        cedantId: 'cedant-1',
        currency: 'ghs',
        since: '2026-01-01T00:00:00.000Z',
        until: '2026-02-01T00:00:00.000Z',
      }),
    );
    const query = renderedSql(firstRawQuery(prisma.$queryRaw));
    const filters = renderedSql(
      (
        service as unknown as {
          filters: (query: {
            recoveryStatus?: string;
            cashCallStatus?: PlacementClaimCashCallStatus;
          }) => unknown;
        }
      ).filters({
        recoveryStatus: 'FULLY_RECOVERED',
        cashCallStatus: PlacementClaimCashCallStatus.ISSUED,
      }),
    );
    expect(cte).toContain('FROM "reinsurance"."PlacementClaimCashCall" cc');
    expect(cte).toContain('WHERE cc."tenantId" =');
    expect(cte).toContain('p."archivedAt" IS NULL');
    expect(cte).toContain('cc."counterpartyId" =');
    expect(cte).toContain('p."cedantId" =');
    expect(cte).toContain('cc."currency" =');
    expect(cte).toContain('pc."occurrenceDate" >=');
    expect(cte).toContain('pc."occurrenceDate" <');
    expect(cte).toContain('p."policyNumber" ILIKE');
    expect(cte).toContain('cc."cashCallNumber" ILIKE');
    expect(cte).toContain(`r."status"::text = 'RECORDED'`);
    expect(cte).toContain(`r."status"::text = 'BANK_CONFIRMED'`);
    expect(cte).toContain('r."reversalOfReceiptId" IS NOT NULL');
    expect(filters).toContain('"recoveryStatus" =');
    expect(filters).toContain('"cashCallStatus"::text =');
    expect(query).toContain('COUNT(*) OVER() AS "totalCount"');
    expect(query).toContain('GROUP BY "currency"');
    expect(query).toContain('LIMIT');
    expect(query).toContain('OFFSET');
  });
});

describe('QueryRecoveriesWorklistDto', () => {
  it('accepts expected filters and transforms pagination numbers', () => {
    const dto = plainToInstance(QueryRecoveriesWorklistDto, {
      page: '2',
      limit: '100',
      search: '  POL-001  ',
      reinsurerId: '11111111-1111-4111-8111-111111111111',
      cedantId: '22222222-2222-4222-8222-222222222222',
      recoveryStatus: 'PARTIALLY_RECOVERED',
      cashCallStatus: 'ISSUED',
      currency: 'GHS',
      since: '2026-01-01T00:00:00.000Z',
      until: '2026-02-01T00:00:00.000Z',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ page: 2, limit: 100, search: 'POL-001' });
  });

  it('rejects unsupported filters and excessive limits', () => {
    const dto = plainToInstance(QueryRecoveriesWorklistDto, {
      page: '0',
      limit: '101',
      recoveryStatus: 'MAYBE',
      cashCallStatus: 'NOT_REAL',
      since: 'bad-date',
    });

    expect(validateSync(dto).map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'page',
        'limit',
        'recoveryStatus',
        'cashCallStatus',
        'since',
      ]),
    );
  });
});

function rawRecoveryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cash-call-1',
    placementId: 'placement-1',
    policyNumber: 'POL-001',
    insuredTitle: 'Xpress Group',
    riskType: 'Marine',
    claimId: 'claim-1',
    claimNumber: 'CLM-001',
    cashCallId: 'cash-call-1',
    cashCallNumber: 'CCL-001',
    cashCallStatus: PlacementClaimCashCallStatus.ISSUED,
    allocationId: 'allocation-1',
    reinsurerId: 'reinsurer-1',
    reinsurerName: 'Best Re',
    currency: 'GHS',
    calledAmount: '1000.00',
    recordedAmount: '0.00',
    confirmedAmount: '0.00',
    reversedAmount: '0.00',
    outstandingAmount: '1000.00',
    recoveredAmount: '0.00',
    recoveryStatus: 'UNRECOVERED',
    occurrenceDate: new Date('2026-08-01T00:00:00.000Z'),
    totalCount: 1,
    summaryByCurrency: [],
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
