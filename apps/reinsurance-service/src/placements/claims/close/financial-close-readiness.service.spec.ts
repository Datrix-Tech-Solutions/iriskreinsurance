import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  PlacementClaimCedantSettlementStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimStatus,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementClaimFinancialCloseReadinessService } from './financial-close-readiness.service';

describe('PlacementClaimFinancialCloseReadinessService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod, index = 0): TArgs => {
    const call = mock.mock.calls[index];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  let prisma: {
    placementClaim: { findFirst: PrismaMethod };
    placementClaimCedantSettlement: { aggregate: PrismaMethod };
    placementClaimRecoveryApproval: { aggregate: PrismaMethod };
    placementClaimRecoveryReceipt: { aggregate: PrismaMethod };
  };
  let service: PlacementClaimFinancialCloseReadinessService;

  const claim = {
    id: 'claim-1',
    status: PlacementClaimStatus.PARTIALLY_SETTLED,
    approvedPayableAmount: new Prisma.Decimal('100.00'),
  };

  function aggregate(amount: string | null, count?: number) {
    return {
      _sum: {
        amount: amount === null ? null : new Prisma.Decimal(amount),
        approvedAmount: amount === null ? null : new Prisma.Decimal(amount),
      },
      _count: count === undefined ? undefined : { _all: count },
    };
  }

  function mockAggregates(
    input: {
      bankConfirmedCedant?: string;
      recordedCedant?: string;
      recordedCedantCount?: number;
      approvedRecovery?: string;
      bankConfirmedRecovery?: string;
      recordedRecovery?: string;
      recordedRecoveryCount?: number;
    } = {},
  ) {
    prisma.placementClaimCedantSettlement.aggregate
      .mockResolvedValueOnce(aggregate(input.bankConfirmedCedant ?? '100.00'))
      .mockResolvedValueOnce(
        aggregate(
          input.recordedCedant ?? '0.00',
          input.recordedCedantCount ?? 0,
        ),
      );
    prisma.placementClaimRecoveryApproval.aggregate.mockResolvedValueOnce(
      aggregate(input.approvedRecovery ?? '80.00'),
    );
    prisma.placementClaimRecoveryReceipt.aggregate
      .mockResolvedValueOnce(aggregate(input.bankConfirmedRecovery ?? '80.00'))
      .mockResolvedValueOnce(
        aggregate(
          input.recordedRecovery ?? '0.00',
          input.recordedRecoveryCount ?? 0,
        ),
      );
  }

  beforeEach(() => {
    prisma = {
      placementClaim: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCedantSettlement: {
        aggregate: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimRecoveryApproval: {
        aggregate: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimRecoveryReceipt: {
        aggregate: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    service = new PlacementClaimFinancialCloseReadinessService(
      prisma as unknown as PrismaService,
    );
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
  });

  it('returns PAYABLE_NOT_APPROVED when no claim payable is approved', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      approvedPayableAmount: null,
    });
    mockAggregates({
      bankConfirmedCedant: '0.00',
      approvedRecovery: '0.00',
      bankConfirmedRecovery: '0.00',
    });

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.blockers).toEqual(['PAYABLE_NOT_APPROVED']);
    expect(readiness.isFinanciallyReadyToSettle).toBe(false);
  });

  it('reports approved payable outstanding until bank-confirmed settlements match it', async () => {
    mockAggregates({ bankConfirmedCedant: '40.00' });

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.payable).toMatchObject({
      approvedPayableAmount: '100.00',
      bankConfirmedSettledAmount: '40.00',
      outstandingPayable: '60.00',
    });
    expect(readiness.blockers).toContain('CLAIM_PAYABLE_OUTSTANDING');
  });

  it('reports payable fully settled when confirmed settlements cover approved payable', async () => {
    mockAggregates();

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.isPayableFullySettled).toBe(true);
    expect(readiness.payable.outstandingPayable).toBe('0.00');
  });

  it('reports recovery outstanding when approved recoveries exceed confirmed receipts', async () => {
    mockAggregates({
      approvedRecovery: '90.00',
      bankConfirmedRecovery: '20.00',
    });

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.recovery.outstandingRecovery).toBe('70.00');
    expect(readiness.blockers).toContain('RECOVERY_OUTSTANDING');
  });

  it('supports partial recovery approvals with zero outstanding when received', async () => {
    mockAggregates({
      approvedRecovery: '25.00',
      bankConfirmedRecovery: '25.00',
    });

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.recovery.approvedRecoveryAmount).toBe('25.00');
    expect(readiness.areRecoveriesFullyReceived).toBe(true);
    expect(readiness.blockers).not.toContain('RECOVERY_OUTSTANDING');
  });

  it('blocks settlement readiness for pending recorded cedant settlements', async () => {
    mockAggregates({ recordedCedant: '15.00', recordedCedantCount: 2 });

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.pendingConfirmations.recordedCedantSettlementCount).toBe(
      2,
    );
    expect(readiness.pendingConfirmations.recordedCedantSettlementAmount).toBe(
      '15.00',
    );
    expect(readiness.blockers).toContain(
      'CEDANT_SETTLEMENT_CONFIRMATION_PENDING',
    );
  });

  it('blocks settlement readiness for pending recorded recovery receipts', async () => {
    mockAggregates({ recordedRecovery: '30.00', recordedRecoveryCount: 1 });

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.pendingConfirmations.recordedRecoveryReceiptCount).toBe(1);
    expect(readiness.pendingConfirmations.recordedRecoveryReceiptAmount).toBe(
      '30.00',
    );
    expect(readiness.blockers).toContain(
      'RECOVERY_RECEIPT_CONFIRMATION_PENDING',
    );
  });

  it('queries only active non-reversal rows so historical reversal rows are excluded', async () => {
    mockAggregates();

    await service.getReadiness('tenant-1', 'placement-1', 'claim-1');

    const cedantArgs =
      firstCallArg<Prisma.PlacementClaimCedantSettlementAggregateArgs>(
        prisma.placementClaimCedantSettlement.aggregate,
      );
    const receiptArgs =
      firstCallArg<Prisma.PlacementClaimRecoveryReceiptAggregateArgs>(
        prisma.placementClaimRecoveryReceipt.aggregate,
      );

    expect(cedantArgs.where).toMatchObject({
      status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
      reversalOfSettlementId: null,
    });
    expect(receiptArgs.where).toMatchObject({
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      reversalOfReceiptId: null,
    });
    expect(
      prisma.placementClaimCedantSettlement.aggregate,
    ).toHaveBeenCalledTimes(2);
    expect(
      prisma.placementClaimRecoveryReceipt.aggregate,
    ).toHaveBeenCalledTimes(2);
  });

  it('returns ready when payable, multiple reinsurer recoveries and confirmations net to zero outstanding', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.SETTLED,
    });
    mockAggregates({
      bankConfirmedCedant: '100.00',
      approvedRecovery: '75.50',
      bankConfirmedRecovery: '75.50',
    });

    const readiness = await service.getReadiness(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(readiness.blockers).toEqual([]);
    expect(readiness.isFinanciallyReadyToSettle).toBe(true);
    expect(readiness.isFinanciallyReadyToClose).toBe(true);
  });

  it('throws a controlled conflict with blockers when settlement readiness fails', async () => {
    mockAggregates({ bankConfirmedCedant: '0.00' });

    await expect(
      service.assertReadyForSettlementStatus(
        'tenant-1',
        'placement-1',
        'claim-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects cross-tenant or missing claims without leaking existence', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue(null);

    await expect(
      service.getReadiness('other-tenant', 'placement-1', 'claim-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
