import {
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementEndorsementStatus,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceClaimRowStateService } from './claim-row-state.service';

const TENANT_ID = 'tenant-1';
const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CLAIM_ID = '22222222-2222-4222-8222-222222222222';
const CROSS_TENANT_CLAIM_ID = '33333333-3333-4333-8333-333333333333';
const PLACEMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_PLACEMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CASH_CALL_ID = 'cash-call-1';
const ALLOCATION_ID = 'allocation-1';

describe('ReinsuranceClaimRowStateService', () => {
  let prisma: {
    placementClaim: { findMany: jest.Mock };
    placementClaimAllocation: { findMany: jest.Mock };
    placementClaimCashCall: { findMany: jest.Mock };
    placementClaimRecoveryReceipt: { findMany: jest.Mock };
    placementClaimRecoveryApproval: { findMany: jest.Mock };
    placementEndorsement: { groupBy: jest.Mock };
  };
  let service: ReinsuranceClaimRowStateService;

  beforeEach(() => {
    prisma = {
      placementClaim: { findMany: jest.fn() },
      placementClaimAllocation: { findMany: jest.fn() },
      placementClaimCashCall: { findMany: jest.fn() },
      placementClaimRecoveryReceipt: { findMany: jest.fn() },
      placementClaimRecoveryApproval: { findMany: jest.fn() },
      placementEndorsement: { groupBy: jest.fn() },
    };
    service = new ReinsuranceClaimRowStateService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );

    prisma.placementClaim.findMany.mockResolvedValue([
      claim(CLAIM_ID, PLACEMENT_ID, '1000.00'),
    ]);
    prisma.placementClaimAllocation.findMany.mockResolvedValue([
      allocation(CLAIM_ID, ALLOCATION_ID, '1000.00'),
    ]);
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      cashCall(CLAIM_ID, CASH_CALL_ID, ALLOCATION_ID, '1000.00'),
    ]);
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([]);
    prisma.placementClaimRecoveryApproval.findMany.mockResolvedValue([]);
    prisma.placementEndorsement.groupBy.mockResolvedValue([]);
  });

  it('returns an empty response without database work when no claimIds are provided', async () => {
    const result = await service.findRowState(TENANT_ID, {});

    expect(result).toEqual({ items: [] });
    expect(prisma.placementClaim.findMany).not.toHaveBeenCalled();
  });

  it('accepts 100 claimIds', async () => {
    const claimIds = Array.from(
      { length: 100 },
      (_, index) =>
        `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    );
    prisma.placementClaim.findMany.mockResolvedValue([]);

    await expect(
      service.findRowState(TENANT_ID, { claimIds }),
    ).resolves.toEqual({ items: [] });
  });

  it('rejects more than 100 claimIds', async () => {
    await expect(
      service.findRowState(TENANT_ID, {
        claimIds: Array.from(
          { length: 101 },
          (_, index) =>
            `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
        ),
      }),
    ).rejects.toThrow('A maximum of 100 claimIds is allowed.');
  });

  it('uses bounded tenant-scoped queries and omits unknown or cross-tenant claims', async () => {
    prisma.placementClaim.findMany.mockResolvedValue([
      claim(CLAIM_ID, PLACEMENT_ID, '1000.00'),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID, CROSS_TENANT_CLAIM_ID],
    });

    expect(prisma.placementClaim.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        id: { in: [CLAIM_ID, CROSS_TENANT_CLAIM_ID] },
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        placementId: true,
        finalLossAmount: true,
      },
    });
    expect(prisma.placementClaimAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, claimId: { in: [CLAIM_ID] } },
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({ claimId: CLAIM_ID }),
    ]);
  });

  it('returns notification when finalLossAmount is null', async () => {
    prisma.placementClaim.findMany.mockResolvedValue([
      claim(CLAIM_ID, PLACEMENT_ID, null),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]).toMatchObject({
      bucket: 'notification',
      isFullyRecovered: false,
    });
  });

  it('keeps finalized claims open when no allocations exist', async () => {
    prisma.placementClaimAllocation.findMany.mockResolvedValue([]);
    prisma.placementClaimCashCall.findMany.mockResolvedValue([]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]).toMatchObject({ bucket: 'open' });
  });

  it('keeps finalized claims open when allocations are not fully cash-called', async () => {
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      cashCall(CLAIM_ID, CASH_CALL_ID, ALLOCATION_ID, '900.00'),
    ]);
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(CLAIM_ID, CASH_CALL_ID, '900.00', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]).toMatchObject({ bucket: 'open' });
  });

  it('keeps finalized claims open when fully cash-called but outstanding is above tolerance', async () => {
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(CLAIM_ID, CASH_CALL_ID, '999.98', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]).toMatchObject({ bucket: 'open' });
  });

  it('closes finalized claims when fully cash-called and outstanding is within tolerance', async () => {
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(CLAIM_ID, CASH_CALL_ID, '999.99', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]).toMatchObject({
      bucket: 'closed',
      isFullyRecovered: true,
    });
  });

  it('uses approved recovery amount for outstanding when present', async () => {
    prisma.placementClaimRecoveryApproval.findMany.mockResolvedValue([
      approval(ALLOCATION_ID, '800.00'),
    ]);
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(CLAIM_ID, CASH_CALL_ID, '800.00', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]).toMatchObject({ bucket: 'closed' });
  });

  it('returns recoveredAmount as confirmed minus reversal rows', async () => {
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(CLAIM_ID, CASH_CALL_ID, '1000.00', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      }),
      receipt(CLAIM_ID, CASH_CALL_ID, '-250.00', {
        status: PlacementClaimRecoveryReceiptStatus.REVERSED,
        reversalOfReceiptId: 'receipt-1',
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]).toMatchObject({
      recoveredAmount: '750.00',
      bucket: 'closed',
    });
  });

  it('sets recoveredAt to the latest BANK_CONFIRMED receipt date', async () => {
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(CLAIM_ID, CASH_CALL_ID, '400.00', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
        bankConfirmedAt: new Date('2026-08-20T10:00:00.000Z'),
      }),
      receipt(CLAIM_ID, CASH_CALL_ID, '600.00', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
        bankConfirmedAt: new Date('2026-08-21T10:00:00.000Z'),
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]?.recoveredAt).toBe('2026-08-21T10:00:00.000Z');
  });

  it('ignores non-confirmed receipts when deriving recoveredAt', async () => {
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(CLAIM_ID, CASH_CALL_ID, '1000.00', {
        status: PlacementClaimRecoveryReceiptStatus.RECORDED,
        bankConfirmedAt: new Date('2026-08-21T10:00:00.000Z'),
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(result.items[0]?.recoveredAt).toBeNull();
  });

  it('excludes VOID endorsements and counts multiple non-VOID endorsements', async () => {
    prisma.placementEndorsement.groupBy.mockResolvedValue([
      { placementId: PLACEMENT_ID, _count: { _all: 2 } },
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [CLAIM_ID],
    });

    expect(prisma.placementEndorsement.groupBy).toHaveBeenCalledWith({
      by: ['placementId'],
      where: {
        tenantId: TENANT_ID,
        placementId: { in: [PLACEMENT_ID] },
        status: { not: PlacementEndorsementStatus.VOID },
      },
      _count: { _all: true },
    });
    expect(result.items[0]).toMatchObject({
      nonVoidEndorsementCount: 2,
      hasNonVoidEndorsement: true,
    });
  });

  it('returns mixed claim row states in requested order', async () => {
    prisma.placementClaim.findMany.mockResolvedValue([
      claim(CLAIM_ID, PLACEMENT_ID, null),
      claim(OTHER_CLAIM_ID, OTHER_PLACEMENT_ID, '500.00'),
    ]);
    prisma.placementClaimAllocation.findMany.mockResolvedValue([
      allocation(OTHER_CLAIM_ID, 'allocation-2', '500.00'),
    ]);
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      cashCall(OTHER_CLAIM_ID, 'cash-call-2', 'allocation-2', '500.00'),
    ]);
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([
      receipt(OTHER_CLAIM_ID, 'cash-call-2', '500.00', {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      }),
    ]);
    prisma.placementEndorsement.groupBy.mockResolvedValue([
      { placementId: OTHER_PLACEMENT_ID, _count: { _all: 1 } },
    ]);

    const result = await service.findRowState(TENANT_ID, {
      claimIds: [OTHER_CLAIM_ID, CLAIM_ID, CROSS_TENANT_CLAIM_ID],
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        claimId: OTHER_CLAIM_ID,
        bucket: 'closed',
        hasNonVoidEndorsement: true,
      }),
      expect.objectContaining({
        claimId: CLAIM_ID,
        bucket: 'notification',
        hasNonVoidEndorsement: false,
      }),
    ]);
  });
});

function claim(
  id: string,
  placementId: string,
  finalLossAmount: string | null,
) {
  return { id, placementId, finalLossAmount };
}

function allocation(
  claimId: string,
  id: string,
  allocatedAmount: string,
  finalAmount: string | null = null,
) {
  return {
    id,
    claimId,
    allocatedEstimatedLossAmount: allocatedAmount,
    allocatedFinalLossAmount: finalAmount,
  };
}

function cashCall(
  claimId: string,
  id: string,
  allocationId: string,
  amount: string,
  overrides: Partial<{
    status: PlacementClaimCashCallStatus;
    counterpartyId: string;
    currency: string;
  }> = {},
) {
  return {
    id,
    claimId,
    allocationId,
    counterpartyId: overrides.counterpartyId ?? 'reinsurer-1',
    currency: overrides.currency ?? 'GHS',
    status: overrides.status ?? PlacementClaimCashCallStatus.ISSUED,
    amount,
  };
}

function receipt(
  claimId: string,
  cashCallId: string,
  amount: string,
  overrides: Partial<{
    status: PlacementClaimRecoveryReceiptStatus;
    bankConfirmedAt: Date | null;
    reversalOfReceiptId: string | null;
  }> = {},
) {
  return {
    claimId,
    cashCallId,
    status: overrides.status ?? PlacementClaimRecoveryReceiptStatus.RECORDED,
    amount,
    bankConfirmedAt:
      overrides.bankConfirmedAt === undefined
        ? new Date('2026-08-20T10:00:00.000Z')
        : overrides.bankConfirmedAt,
    reversalOfReceiptId: overrides.reversalOfReceiptId ?? null,
  };
}

function approval(
  allocationId: string,
  approvedAmount: string,
  overrides: Partial<{
    cashCallId: string | null;
    counterpartyId: string;
    currency: string;
  }> = {},
) {
  return {
    allocationId,
    cashCallId: overrides.cashCallId ?? null,
    counterpartyId: overrides.counterpartyId ?? 'reinsurer-1',
    currency: overrides.currency ?? 'GHS',
    approvedAmount,
  };
}
