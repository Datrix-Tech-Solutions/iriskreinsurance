import {
  PlacementClaimAllocationStatus,
  PlacementClaimCashCallStatus,
  PlacementClaimStatus,
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementNoteStatus,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementStatus,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceDashboardService } from './dashboard.service';

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
        grossPremium: '1000.00',
        netPremium: '850.00',
        brokerageAmount: '50.00',
        commissionAmount: '100.00',
        currency: 'GHS',
      },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        premiumSnapshot: '200.00',
        netPremium: '170.00',
        brokerageAmount: '10.00',
        commissionAmount: '20.00',
        currency: 'GHS',
      },
    ]);
    prisma.placementPayment.findMany.mockResolvedValue([
      { amount: '300.00', currency: 'GHS' },
      { amount: '-100.00', currency: 'GHS' },
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
        status: PlacementPaymentStatus.RECORDED,
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        placement: { archivedAt: null },
      },
      select: { amount: true, currency: true },
    });
    expect(result).toMatchObject({
      grossPremium: 1200,
      netPremium: 1020,
      brokerage: 60,
      commission: 120,
      paid: 200,
      outstanding: 820,
      noteCounts: { draft: 1, issued: 1, void: 1 },
    });
    expect(result.netPremiumByCurrency).toEqual([
      { currency: 'GHS', amount: 1020 },
    ]);
  });

  it('keeps multi-currency financial totals separated with a warning', async () => {
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: '1000.00',
        netPremium: '850.00',
        brokerageAmount: '50.00',
        commissionAmount: '100.00',
        currency: 'GHS',
      },
      {
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
      { currency: 'GHS', amount: '50.00', reversalOfReceiptId: 'receipt-1' },
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
        { currency: 'GHS', amount: 250 },
        { currency: 'USD', amount: 20 },
      ],
      cashCallsIssued: 250,
      cashCallsPaid: 100,
      cashCallsPending: 150,
      cashCallCounts: { draft: 1, issued: 1, paid: 1 },
    });
  });
});
