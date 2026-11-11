import {
  PlacementClaimAllocationStatus,
  PlacementClaimCashCallStatus,
  PlacementClaimStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementNoteStatus,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceDashboardService } from './dashboard.service';
import { QueryDashboardPeriodDto } from './query-dashboard-period.dto';

describe('ReinsuranceDashboardService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  let prisma: {
    placement: { count: PrismaMethod; findMany: PrismaMethod };
    placementPayment: { findMany: PrismaMethod };
    placementEndorsement: { count: PrismaMethod };
    placementClaim: { count: PrismaMethod; findMany: PrismaMethod };
    placementClosing: { findMany: PrismaMethod };
    placementEndorsementClosing: { findMany: PrismaMethod };
    placementNote: { findMany: PrismaMethod };
    placementClaimAllocation: { findMany: PrismaMethod };
    placementClaimCashCall: { findMany: PrismaMethod };
    placementClaimRecoveryReceipt: { findMany: PrismaMethod };
    $queryRaw: jest.MockedFunction<(query: unknown) => Promise<unknown>>;
  };
  let service: ReinsuranceDashboardService;

  beforeEach(() => {
    prisma = {
      placement: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaim: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementNote: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimAllocation: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCashCall: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimRecoveryReceipt: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $queryRaw: jest.fn<Promise<unknown>, [unknown]>(),
    };
    service = new ReinsuranceDashboardService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns tenant-scoped overview counts using payments as lock source', async () => {
    prisma.placement.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.placementPayment.findMany.mockResolvedValue([
      { placementId: 'placement-1' },
      { placementId: 'placement-2' },
    ]);
    prisma.placementEndorsement.count.mockResolvedValue(4);
    prisma.placementClaim.count.mockResolvedValue(5);

    const result = await service.getOverview('tenant-1');

    expect(prisma.placement.count).toHaveBeenNthCalledWith(1, {
      where: {
        tenantId: 'tenant-1',
        archivedAt: null,
        status: { notIn: [PlacementStatus.CLOSED, PlacementStatus.CANCELLED] },
      },
    });
    expect(prisma.placementPayment.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', placement: { archivedAt: null } },
      distinct: ['placementId'],
      select: { placementId: true },
    });
    expect(result).toMatchObject({
      activePlacements: 3,
      closedPlacements: 2,
      lockedPlacements: 2,
      endorsementsPending: 4,
      claimsOpen: 5,
    });
  });

  it('uses confirmed placement and endorsement closing snapshots for capacity', async () => {
    prisma.placement.findMany.mockResolvedValue([
      { facultativeOffer: '60.0000' },
      { facultativeOffer: null },
    ]);
    prisma.placementClosing.findMany.mockResolvedValue([
      { signedLinePercent: '40.0000' },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      { signedLinePercent: '10.0000' },
    ]);

    const result = await service.getPlacements('tenant-1');

    expect(prisma.placementClosing.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        status: PlacementClosingStatus.CONFIRMED,
        placement: { archivedAt: null },
      },
      select: { signedLinePercent: true },
    });
    expect(prisma.placementEndorsementClosing.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        status: PlacementClosingStatus.CONFIRMED,
        placement: { archivedAt: null },
        endorsement: {
          status: { not: PlacementEndorsementStatus.VOID },
        },
      },
      select: { signedLinePercent: true },
    });
    expect(result).toMatchObject({
      placementCount: 2,
      totalCapacity: 60,
      acceptedCapacity: 50,
      pendingCapacity: 10,
      confirmedClosingCapacity: 50,
      placementsMissingTarget: 1,
    });
    expect(result.warnings[0]).toContain('facultativeOffer');
  });

  it('summarizes financials from confirmed closings, payments and note statuses', async () => {
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        placementId: 'placement-1',
        participantId: 'participant-1',
        grossPremium: '1000.00',
        netPremium: '850.00',
        brokerageAmount: '50.00',
        commissionAmount: '100.00',
        currency: 'GHS',
      },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        placementId: 'placement-1',
        endorsementParticipant: { originalParticipantId: null },
        premiumSnapshot: '200.00',
        netPremium: '170.00',
        brokerageAmount: '10.00',
        commissionAmount: '20.00',
        currency: 'GHS',
      },
    ]);
    prisma.placementPayment.findMany.mockResolvedValue([
      { amount: '300.00', currency: 'GHS' },
    ]);
    prisma.placementNote.findMany.mockResolvedValue([
      { status: PlacementNoteStatus.DRAFT },
      { status: PlacementNoteStatus.ISSUED },
      { status: PlacementNoteStatus.VOID },
    ]);

    const result = await service.getFinancials('tenant-1');

    expect(prisma.placementPayment.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        reversalOfPaymentId: null,
        placement: { archivedAt: null },
      },
      select: { amount: true, currency: true },
    });
    expect(result).toMatchObject({
      grossPremium: 1200,
      netPremium: 1020,
      brokerage: 60,
      commission: 120,
      paid: 300,
      outstanding: 720,
      noteCounts: { draft: 1, issued: 1, void: 1 },
    });
    expect(result.netPremiumByCurrency).toEqual([
      { currency: 'GHS', amount: 1020 },
    ]);
    expect(result.brokerageByCurrency).toEqual([
      { currency: 'GHS', amount: 60 },
    ]);
  });

  it('keeps multi-currency financial totals separated with a warning', async () => {
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        placementId: 'placement-1',
        participantId: 'participant-1',
        grossPremium: '1000.00',
        netPremium: '850.00',
        brokerageAmount: '50.00',
        commissionAmount: '100.00',
        currency: 'GHS',
      },
      {
        placementId: 'placement-2',
        participantId: 'participant-2',
        grossPremium: '500.00',
        netPremium: '425.00',
        brokerageAmount: '25.00',
        commissionAmount: '50.00',
        currency: 'USD',
      },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);
    prisma.placementPayment.findMany.mockResolvedValue([
      { amount: '300.00', currency: 'GHS' },
      { amount: '100.00', currency: 'USD' },
    ]);
    prisma.placementNote.findMany.mockResolvedValue([]);

    const result = await service.getFinancials('tenant-1');

    expect(result.netPremiumByCurrency).toEqual([
      { currency: 'GHS', amount: 850 },
      { currency: 'USD', amount: 425 },
    ]);
    expect(result.paidByCurrency).toEqual([
      { currency: 'GHS', amount: 300 },
      { currency: 'USD', amount: 100 },
    ]);
    expect(result.outstandingByCurrency).toEqual([
      { currency: 'GHS', amount: 550 },
      { currency: 'USD', amount: 325 },
    ]);
    expect(result.warnings).toEqual([
      'Multiple currencies are present. Use the byCurrency fields for reliable financial reporting.',
    ]);
  });

  describe('effective financial snapshot', () => {
    const original = (
      participantId: string,
      grossPremium = 100,
      currency = 'GHS',
      placementId = 'placement-1',
    ) => ({
      placementId,
      participantId,
      grossPremium,
      netPremium: grossPremium * 0.85,
      brokerageAmount: grossPremium * 0.05,
      commissionAmount: grossPremium * 0.1,
      currency,
    });
    const endorsement = (
      originalParticipantId: string | null,
      premiumSnapshot: number,
      currency = 'GHS',
      placementId = 'placement-1',
    ) => ({
      placementId,
      endorsementParticipant: { originalParticipantId },
      premiumSnapshot,
      netPremium: premiumSnapshot * 0.85,
      brokerageAmount: premiumSnapshot * 0.05,
      commissionAmount: premiumSnapshot * 0.1,
      currency,
    });

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-11T12:00:00.000Z'));
      prisma.placementClosing.findMany.mockResolvedValue([]);
      prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);
      prisma.placementPayment.findMany.mockResolvedValue([]);
      prisma.placementNote.findMany.mockResolvedValue([]);
    });

    afterEach(() => jest.useRealTimers());

    it.each([
      ['originals only', [], 200],
      [
        'replacement preserves unaffected original',
        [endorsement('participant-1', 150)],
        250,
      ],
      ['additive preserves originals', [endorsement(null, 50)], 250],
      [
        'sequential replacement keeps only the latest',
        [endorsement('participant-1', 150), endorsement('participant-1', 180)],
        280,
      ],
      [
        'sequential replacement preserves additive rows',
        [
          endorsement(null, 50),
          endorsement('participant-1', 150),
          endorsement('participant-1', 180),
        ],
        330,
      ],
      [
        'replacement without an original closing is retained',
        [endorsement('unclosed-participant', 50)],
        250,
      ],
    ])('%s', async (_name, endorsements, expectedGross) => {
      prisma.placementClosing.findMany.mockResolvedValue([
        original('participant-1'),
        original('participant-2'),
      ]);
      prisma.placementEndorsementClosing.findMany.mockResolvedValue(
        endorsements,
      );

      const result = await service.getFinancials('tenant-1');

      expect(result).toMatchObject({
        grossPremium: expectedGross,
        netPremium: expectedGross * 0.85,
        brokerage: expectedGross * 0.05,
        commission: expectedGross * 0.1,
        paid: 0,
        outstanding: expectedGross * 0.85,
      });
      expect(prisma.placementClosing.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.placementEndorsementClosing.findMany).toHaveBeenCalledTimes(
        1,
      );
    });

    it('replaces currency along with the snapshot and isolates placements', async () => {
      prisma.placementClosing.findMany.mockResolvedValue([
        original('participant-1'),
        original('participant-2', 200, 'USD'),
        original('participant-1', 300, 'GHS', 'placement-2'),
      ]);
      prisma.placementEndorsementClosing.findMany.mockResolvedValue([
        endorsement('participant-1', 150, 'EUR'),
        endorsement(null, 50, 'USD'),
      ]);
      prisma.placementPayment.findMany.mockResolvedValue([
        { amount: 40, currency: 'USD' },
      ]);

      const result = await service.getFinancials('tenant-1');

      expect(result.grossPremiumByCurrency).toEqual([
        { currency: 'EUR', amount: 150 },
        { currency: 'GHS', amount: 300 },
        { currency: 'USD', amount: 250 },
      ]);
      expect(result.outstandingByCurrency).toEqual([
        { currency: 'EUR', amount: 127.5 },
        { currency: 'GHS', amount: 255 },
        { currency: 'USD', amount: 172.5 },
      ]);
    });

    it('selects only confirmed CLOSED endorsements effective now with canonical tie breakers', async () => {
      await service.getFinancials('tenant-1');

      expect(prisma.placementEndorsementClosing.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          status: PlacementClosingStatus.CONFIRMED,
          placement: { archivedAt: null },
          endorsement: {
            status: PlacementEndorsementStatus.CLOSED,
            effectiveDate: { lte: new Date('2026-11-11T12:00:00.000Z') },
          },
        },
        select: {
          placementId: true,
          endorsementParticipant: { select: { originalParticipantId: true } },
          premiumSnapshot: true,
          netPremium: true,
          brokerageAmount: true,
          commissionAmount: true,
          currency: true,
        },
        orderBy: [
          { endorsement: { effectiveDate: 'asc' } },
          { endorsement: { createdAt: 'asc' } },
          { endorsement: { endorsementNumber: 'asc' } },
          { endorsement: { id: 'asc' } },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      });
    });

    it.each([
      [
        'future CLOSED',
        PlacementEndorsementStatus.CLOSED,
        '2026-11-12T00:00:00Z',
        PlacementClosingStatus.CONFIRMED,
      ],
      [
        'nonclosed',
        PlacementEndorsementStatus.DRAFT,
        '2026-01-01T00:00:00Z',
        PlacementClosingStatus.CONFIRMED,
      ],
      [
        'VOID endorsement',
        PlacementEndorsementStatus.VOID,
        '2026-01-01T00:00:00Z',
        PlacementClosingStatus.CONFIRMED,
      ],
      [
        'unconfirmed closing',
        PlacementEndorsementStatus.CLOSED,
        '2026-01-01T00:00:00Z',
        PlacementClosingStatus.DRAFT,
      ],
    ])(
      'excludes %s at the ORM boundary',
      async (_name, status, effectiveDate, closingStatus) => {
        // Model only the eligibility predicate passed to Prisma, not composition.
        prisma.placementEndorsementClosing.findMany.mockImplementation(
          (args: unknown) => {
            const { where } = args as {
              where: {
                status: PlacementClosingStatus;
                endorsement: {
                  status: PlacementEndorsementStatus;
                  effectiveDate: { lte: Date };
                };
              };
            };
            return Promise.resolve(
              status === where.endorsement.status &&
                closingStatus === where.status &&
                new Date(effectiveDate) <= where.endorsement.effectiveDate.lte
                ? [endorsement('participant-1', 999)]
                : [],
            );
          },
        );
        prisma.placementClosing.findMany.mockResolvedValue([
          original('participant-1'),
        ]);
        expect((await service.getFinancials('tenant-1')).grossPremium).toBe(
          100,
        );
      },
    );

    it.each([
      { since: '2026-01-01T00:00:00.000Z', until: '2026-01-31T23:59:59.999Z' },
      { since: '2026-01-01T00:00:00.000Z' },
      { until: '2026-01-31T23:59:59.999Z' },
    ])(
      'keeps period filters on placement.createdAt while applying the current snapshot: %j',
      async (query: QueryDashboardPeriodDto) => {
        prisma.placementClosing.findMany.mockResolvedValue([
          original('participant-1'),
        ]);
        // This replacement is effective after the January cohort, before now.
        prisma.placementEndorsementClosing.findMany.mockResolvedValue([
          endorsement('participant-1', 180),
        ]);
        const result = await service.getFinancials('tenant-1', query);
        const createdAt = {
          ...(query.since ? { gte: new Date(query.since) } : {}),
          ...(query.until ? { lte: new Date(query.until) } : {}),
        };
        for (const model of [
          prisma.placementClosing,
          prisma.placementEndorsementClosing,
          prisma.placementPayment,
          prisma.placementNote,
        ]) {
          const args = model.findMany.mock
            .calls[0][0] as Prisma.PlacementClosingFindManyArgs;
          expect(args.where?.placement).toEqual({
            archivedAt: null,
            createdAt,
          });
        }
        const endorsementArgs = prisma.placementEndorsementClosing.findMany.mock
          .calls[0][0] as Prisma.PlacementEndorsementClosingFindManyArgs;
        expect(endorsementArgs.where?.endorsement).toEqual({
          status: PlacementEndorsementStatus.CLOSED,
          effectiveDate: { lte: new Date('2026-11-11T12:00:00.000Z') },
        });
        expect(result.grossPremium).toBe(180);
      },
    );
  });

  it('returns set-based dashboard breakdowns without collapsing currencies', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { status: PlacementStatus.CLOSED, count: 2 },
        { status: PlacementStatus.PLACED, count: 1 },
      ])
      .mockResolvedValueOnce([{ status: PlacementStatus.CLOSED, count: 1 }])
      .mockResolvedValueOnce([
        {
          currency: 'GHS',
          sumInsured: '1000.00',
          totalRisk: '400.00',
          grossPremium: '50.00',
        },
        {
          currency: 'USD',
          sumInsured: '500.00',
          totalRisk: '250.00',
          grossPremium: '20.00',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'risk-class-1',
          name: 'Motor',
          placementCount: 2,
          currency: 'GHS',
          premium: '50.00',
          sumInsured: '1000.00',
        },
        {
          id: 'risk-class-1',
          name: 'Motor',
          placementCount: 1,
          currency: 'USD',
          premium: '20.00',
          sumInsured: '500.00',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cedant-1',
          name: 'Acme Cedant',
          offerCount: 2,
          currency: 'GHS',
          premium: '50.00',
        },
        {
          id: 'cedant-1',
          name: 'Acme Cedant',
          offerCount: 1,
          currency: 'USD',
          premium: '20.00',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'reinsurer-1',
          name: 'Apex Re',
          offerCount: 1,
          currency: 'GHS',
          premium: '25.00',
        },
      ])
      .mockResolvedValueOnce([
        {
          month: '2026-08-01T00:00:00.000Z',
          currency: 'GHS',
          amount: '50.00',
        },
        {
          month: '2026-08-01T00:00:00.000Z',
          currency: 'USD',
          amount: '20.00',
        },
      ]);

    const result = await service.getBreakdowns('tenant-1', {
      since: '2026-08-01T00:00:00.000Z',
      until: '2026-08-31T23:59:59.999Z',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(7);
    expect(result.offers).toMatchObject({
      placementCount: 3,
      placedOffers: 1,
      closedOffers: 2,
      closedRate: 66.66666666666666,
      previous: {
        placementCount: 1,
        closedOffers: 1,
      },
    });
    expect(result.sumInsuredByCurrency).toEqual([
      { currency: 'GHS', amount: 1000 },
      { currency: 'USD', amount: 500 },
    ]);
    expect(result.grossPremiumByCurrency).toEqual([
      { currency: 'GHS', amount: 50 },
      { currency: 'USD', amount: 20 },
    ]);
    expect(result.riskClasses).toEqual([
      {
        id: 'risk-class-1',
        name: 'Motor',
        placementCount: 3,
        premiumByCurrency: [
          { currency: 'GHS', amount: 50 },
          { currency: 'USD', amount: 20 },
        ],
        sumInsuredByCurrency: [
          { currency: 'GHS', amount: 1000 },
          { currency: 'USD', amount: 500 },
        ],
      },
    ]);
    expect(result.topCedants[0]).toMatchObject({
      id: 'cedant-1',
      offerCount: 3,
      totalPremiumByCurrency: [
        { currency: 'GHS', amount: 50 },
        { currency: 'USD', amount: 20 },
      ],
    });
    expect(result.premiumTrend).toEqual([
      {
        month: '2026-08-01T00:00:00.000Z',
        amountByCurrency: [
          { currency: 'GHS', amount: 50 },
          { currency: 'USD', amount: 20 },
        ],
      },
    ]);
  });

  it('summarizes claims from claim, allocation and cash-call snapshots', async () => {
    prisma.placementClaim.findMany.mockResolvedValue([
      {
        status: PlacementClaimStatus.NOTIFIED,
        currency: 'GHS',
        estimatedLossAmount: '1000.00',
        finalLossAmount: null,
      },
      {
        status: PlacementClaimStatus.CLOSED,
        currency: 'GHS',
        estimatedLossAmount: '500.00',
        finalLossAmount: '400.00',
      },
    ]);
    prisma.placementClaimAllocation.findMany.mockResolvedValue([
      {
        status: PlacementClaimAllocationStatus.CASH_CALLED,
        allocatedEstimatedLossAmount: '250.00',
        allocatedFinalLossAmount: null,
      },
      {
        status: PlacementClaimAllocationStatus.CASH_CALLED,
        allocatedEstimatedLossAmount: '200.00',
        allocatedFinalLossAmount: '150.00',
      },
    ]);
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      { status: PlacementClaimCashCallStatus.DRAFT, amount: '50.00' },
      { status: PlacementClaimCashCallStatus.ISSUED, amount: '250.00' },
      { status: PlacementClaimCashCallStatus.PAID, amount: '100.00' },
    ]);
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      { currency: 'GHS', amount: '300.00', reversalOfReceiptId: null },
      { currency: 'USD', amount: '20.00', reversalOfReceiptId: null },
    ]);

    const result = await service.getClaims('tenant-1');

    expect(prisma.placementClaimAllocation.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        placement: { archivedAt: null },
        status: { not: PlacementClaimAllocationStatus.VOID },
      },
      select: {
        allocatedEstimatedLossAmount: true,
        allocatedFinalLossAmount: true,
      },
    });
    expect(result).toMatchObject({
      claimsCount: 2,
      openClaims: 1,
      estimatedLoss: 1500,
      finalLoss: 400,
      allocatedLiability: 400,
      claimsIncurredByCurrency: [{ currency: 'GHS', amount: 1400 }],
      recoveriesByCurrency: [
        { currency: 'GHS', amount: 300 },
        { currency: 'USD', amount: 20 },
      ],
      cashCallsIssued: 250,
      cashCallsPaid: 100,
      cashCallsPending: 150,
      cashCallCounts: { draft: 1, issued: 1, paid: 1 },
    });
  });
  describe('recovery current balance versus period activity', () => {
    const confirmed = PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED;
    const reversed = PlacementClaimRecoveryReceiptStatus.REVERSED;
    const receipts = [
      {
        currency: 'GHS',
        amount: 100,
        status: reversed,
        reversalOfReceiptId: null,
        bankConfirmedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        currency: 'GHS',
        amount: 100,
        status: confirmed,
        reversalOfReceiptId: 'original-1',
        bankConfirmedAt: new Date('2026-02-15T00:00:00Z'),
      },
      {
        currency: 'GHS',
        amount: 80,
        status: confirmed,
        reversalOfReceiptId: null,
        bankConfirmedAt: new Date('2026-01-20T00:00:00Z'),
      },
      {
        currency: 'USD',
        amount: 25,
        status: confirmed,
        reversalOfReceiptId: null,
        bankConfirmedAt: new Date('2026-01-20T00:00:00Z'),
      },
      {
        currency: 'GHS',
        amount: 999,
        status: reversed,
        reversalOfReceiptId: null,
        bankConfirmedAt: null,
      },
      {
        currency: 'GHS',
        amount: 999,
        status: PlacementClaimRecoveryReceiptStatus.RECORDED,
        reversalOfReceiptId: 'original-2',
        bankConfirmedAt: new Date('2026-01-21T00:00:00Z'),
      },
      {
        currency: 'GHS',
        amount: 999,
        status: reversed,
        reversalOfReceiptId: 'original-3',
        bankConfirmedAt: new Date('2026-01-21T00:00:00Z'),
      },
    ];
    type ReceiptPredicate = {
      status?:
        | PlacementClaimRecoveryReceiptStatus
        | { in: PlacementClaimRecoveryReceiptStatus[] };
      reversalOfReceiptId?: null | { not: null };
      bankConfirmedAt?: { not?: null; gte?: Date; lte?: Date };
      OR?: ReceiptPredicate[];
    };
    const matches = (
      receipt: (typeof receipts)[number],
      where: ReceiptPredicate,
    ): boolean => {
      if (
        where.status &&
        (typeof where.status === 'string'
          ? receipt.status !== where.status
          : !where.status.in.includes(receipt.status))
      )
        return false;
      if (
        where.reversalOfReceiptId === null &&
        receipt.reversalOfReceiptId !== null
      )
        return false;
      if (where.reversalOfReceiptId && receipt.reversalOfReceiptId === null)
        return false;
      if (where.bankConfirmedAt) {
        if (!receipt.bankConfirmedAt) return false;
        if (
          where.bankConfirmedAt.gte &&
          receipt.bankConfirmedAt < where.bankConfirmedAt.gte
        )
          return false;
        if (
          where.bankConfirmedAt.lte &&
          receipt.bankConfirmedAt > where.bankConfirmedAt.lte
        )
          return false;
      }
      return !where.OR || where.OR.some((clause) => matches(receipt, clause));
    };

    beforeEach(() => {
      prisma.placementClaim.findMany.mockResolvedValue([]);
      prisma.placementClaimAllocation.findMany.mockResolvedValue([]);
      prisma.placementClaimCashCall.findMany.mockResolvedValue([]);
      prisma.placementClaimRecoveryReceipt.findMany.mockImplementation(
        (args: unknown) => {
          const { where } = args as { where: ReceiptPredicate };
          return Promise.resolve(
            receipts.filter((receipt) => matches(receipt, where)),
          );
        },
      );
    });

    it('current balance includes only unreversed BANK_CONFIRMED originals', async () => {
      const result = await service.getClaims('tenant-1');
      expect(result.recoveriesByCurrency).toEqual([
        { currency: 'GHS', amount: 80 },
        { currency: 'USD', amount: 25 },
      ]);
      expect(
        prisma.placementClaimRecoveryReceipt.findMany,
      ).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          placement: { archivedAt: null },
          claim: { status: { not: PlacementClaimStatus.VOID } },
          status: confirmed,
          reversalOfReceiptId: null,
        },
        select: { currency: true, amount: true, reversalOfReceiptId: true },
      });
      expect(result.warnings).toContain(
        'recoveriesByCurrency is the current balance of unreversed BANK_CONFIRMED original receipts.',
      );
    });

    it.each([
      [
        'original confirmation window',
        { since: '2026-01-01', until: '2026-01-31' },
        180,
        true,
      ],
      [
        'reversal window',
        { since: '2026-02-01', until: '2026-02-28' },
        -100,
        false,
      ],
      ['both windows', { since: '2026-01-01', until: '2026-02-28' }, 80, true],
      ['since only', { since: '2026-02-01' }, -100, false],
      ['until only', { until: '2026-01-31' }, 180, true],
    ])(
      '%s retains confirmed originals after reversal and subtracts reversals only in their window',
      async (_name, query: QueryDashboardPeriodDto, ghs, hasUsd) => {
        const result = await service.getClaims('tenant-1', query);
        expect(result.recoveriesByCurrency).toEqual([
          { currency: 'GHS', amount: ghs },
          ...(hasUsd ? [{ currency: 'USD', amount: 25 }] : []),
        ]);
        expect(
          prisma.placementClaimRecoveryReceipt.findMany,
        ).toHaveBeenCalledWith({
          where: {
            tenantId: 'tenant-1',
            placement: { archivedAt: null },
            claim: { status: { not: PlacementClaimStatus.VOID } },
            bankConfirmedAt: {
              not: null,
              ...(query.since ? { gte: new Date(query.since) } : {}),
              ...(query.until ? { lte: new Date(query.until) } : {}),
            },
            OR: [
              {
                reversalOfReceiptId: null,
                status: { in: [confirmed, reversed] },
              },
              { reversalOfReceiptId: { not: null }, status: confirmed },
            ],
          },
          select: { currency: true, amount: true, reversalOfReceiptId: true },
        });
        expect(result.warnings).toContain(
          'recoveriesByCurrency is net activity by bankConfirmedAt in the requested period, including subsequent reversals in their own period.',
        );
      },
    );
  });
});
