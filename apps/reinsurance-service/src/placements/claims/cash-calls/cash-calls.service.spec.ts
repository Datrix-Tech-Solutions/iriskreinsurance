import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementClaimCashCallStatus,
  PlacementClaimAllocationStatus,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementClaimCashCallsService } from './cash-calls.service';
import { PlacementFinancialActivityReader } from '../../finance/financial-activity.reader';
import { PlacementFinancialLockPolicy } from '../../finance/financial-lock.policy';

describe('PlacementClaimCashCallsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE' as const,
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [] as string[],
  };

  const placement = { id: 'placement-1' };
  const claim = { id: 'claim-1', currency: 'GHS' };
  const allocation = {
    id: 'allocation-1',
    counterpartyId: 'reinsurer-1',
    signedLinePercent: new Prisma.Decimal('40.0000'),
    basisAmount: new Prisma.Decimal('40000.00'),
    allocatedEstimatedLossAmount: new Prisma.Decimal('16000.00'),
    allocatedFinalLossAmount: null,
  };
  const cashCall = {
    id: 'cash-call-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    allocationId: 'allocation-1',
    counterpartyId: 'reinsurer-1',
    cashCallNumber: 'CCL-001',
    status: PlacementClaimCashCallStatus.DRAFT,
    currency: 'GHS',
    amount: new Prisma.Decimal('16000.00'),
    basisAmount: new Prisma.Decimal('40000.00'),
    signedLinePercent: new Prisma.Decimal('40.0000'),
    issuedAt: null,
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-05T10:00:00.000Z'),
    updatedAt: new Date('2026-06-05T10:00:00.000Z'),
    counterparty: {
      id: 'reinsurer-1',
      type: 'REINSURER',
      name: 'Avenue Re',
      registrationNumber: null,
    },
    allocation: {
      id: 'allocation-1',
      status: PlacementClaimAllocationStatus.DRAFT,
    },
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: { findFirst: PrismaMethod };
    placementClaimAllocation: { findFirst: PrismaMethod; update: PrismaMethod };
    placementClaimCashCall: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementClaimRecoveryReceipt: { findFirst: PrismaMethod };
    placementPayment: { findFirst: PrismaMethod; update: PrismaMethod };
    placementClosing: { update: PrismaMethod };
    placementNote: { update: PrismaMethod };
    $transaction: jest.Mock;
  };
  let service: PlacementClaimCashCallsService;
  let lockPolicy: PlacementFinancialLockPolicy;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaimAllocation: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCashCall: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimRecoveryReceipt: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: { update: jest.fn<Promise<unknown>, [unknown]>() },
      placementNote: { update: jest.fn<Promise<unknown>, [unknown]>() },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new PlacementClaimCashCallsService(
      prisma as unknown as PrismaService,
    );
    lockPolicy = new PlacementFinancialLockPolicy(
      new PlacementFinancialActivityReader(prisma as unknown as PrismaService),
    );
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
  });

  it('creates a DRAFT cash call from an allocation using estimated loss amount', async () => {
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(allocation);
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(null);
    prisma.placementClaimCashCall.count.mockResolvedValue(0);
    prisma.placementClaimCashCall.create.mockResolvedValue(cashCall);

    const result = await service.create(
      user,
      'placement-1',
      'claim-1',
      'allocation-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementClaimCashCallCreateArgs>(
      prisma.placementClaimCashCall.create,
    );
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      counterpartyId: 'reinsurer-1',
      cashCallNumber: 'CCL-001',
      status: PlacementClaimCashCallStatus.DRAFT,
      currency: 'GHS',
      amount: allocation.allocatedEstimatedLossAmount,
      basisAmount: allocation.basisAmount,
      signedLinePercent: allocation.signedLinePercent,
      createdByUserId: 'user-1',
    });
    expect(result).toBe(cashCall);
  });

  it('uses allocated final loss amount when present', async () => {
    const finalizedAllocation = {
      ...allocation,
      allocatedFinalLossAmount: new Prisma.Decimal('15000.00'),
    };
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(
      finalizedAllocation,
    );
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(null);
    prisma.placementClaimCashCall.count.mockResolvedValue(0);
    prisma.placementClaimCashCall.create.mockResolvedValue({
      ...cashCall,
      amount: finalizedAllocation.allocatedFinalLossAmount,
    });

    await service.create(user, 'placement-1', 'claim-1', 'allocation-1');

    const createArgs = firstCallArg<Prisma.PlacementClaimCashCallCreateArgs>(
      prisma.placementClaimCashCall.create,
    );
    expect(createArgs.data.amount).toBe(
      finalizedAllocation.allocatedFinalLossAmount,
    );
  });

  it('rejects wrong-tenant placement or claim lookups', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.findAll('tenant-1', 'placement-1', 'claim-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.findOne('tenant-1', 'placement-1', 'claim-1', 'cash-call-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects allocation that does not belong to the claim and placement', async () => {
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'allocation-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate active cash call for an allocation', async () => {
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(allocation);
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      id: 'cash-call-1',
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'allocation-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows a new cash call after a prior cash call is VOID and increments numbering', async () => {
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(allocation);
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(null);
    prisma.placementClaimCashCall.count.mockResolvedValue(1);
    prisma.placementClaimCashCall.create.mockResolvedValue({
      ...cashCall,
      cashCallNumber: 'CCL-002',
    });

    await service.create(user, 'placement-1', 'claim-1', 'allocation-1');

    const duplicateCheck =
      firstCallArg<Prisma.PlacementClaimCashCallFindFirstArgs>(
        prisma.placementClaimCashCall.findFirst,
      );
    const createArgs = firstCallArg<Prisma.PlacementClaimCashCallCreateArgs>(
      prisma.placementClaimCashCall.create,
    );
    expect(duplicateCheck.where).toMatchObject({
      allocationId: 'allocation-1',
      status: { not: PlacementClaimCashCallStatus.VOID },
    });
    expect(createArgs.data.cashCallNumber).toBe('CCL-002');
  });

  it('lists and details cash calls with tenant and placement scoping', async () => {
    prisma.placementClaimCashCall.findMany.mockResolvedValue([cashCall]);
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);

    await service.findAll('tenant-1', 'placement-1', 'claim-1');
    await service.findOne('tenant-1', 'placement-1', 'claim-1', 'cash-call-1');

    const listArgs = firstCallArg<Prisma.PlacementClaimCashCallFindManyArgs>(
      prisma.placementClaimCashCall.findMany,
    );
    const detailArgs = firstCallArg<Prisma.PlacementClaimCashCallFindFirstArgs>(
      prisma.placementClaimCashCall.findFirst,
    );
    expect(listArgs.where).toEqual({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
    });
    expect(detailArgs.where).toEqual({
      id: 'cash-call-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
    });
  });

  it('supports DRAFT -> ISSUED and stamps issuedAt', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);
    prisma.placementClaimCashCall.update.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.ISSUED,
    });

    await service.changeStatus(user, 'placement-1', 'claim-1', 'cash-call-1', {
      status: PlacementClaimCashCallStatus.ISSUED,
    });

    const updateArgs = firstCallArg<Prisma.PlacementClaimCashCallUpdateArgs>(
      prisma.placementClaimCashCall.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementClaimCashCallStatus.ISSUED,
    });
    expect(updateArgs.data).toHaveProperty('issuedAt');
  });

  it('supports DRAFT/ISSUED -> VOID and rejects PAID in PR1', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.ISSUED,
    });
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue(null);
    prisma.placementClaimCashCall.update.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.VOID,
    });

    await service.changeStatus(user, 'placement-1', 'claim-1', 'cash-call-1', {
      status: PlacementClaimCashCallStatus.VOID,
    });

    await expect(
      service.changeStatus(user, 'placement-1', 'claim-1', 'cash-call-1', {
        status: PlacementClaimCashCallStatus.PAID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects transitions from VOID', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.VOID,
    });

    await expect(
      service.changeStatus(user, 'placement-1', 'claim-1', 'cash-call-1', {
        status: PlacementClaimCashCallStatus.ISSUED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('voids a DRAFT or ISSUED cash call with a reason', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue(null);
    prisma.placementClaimCashCall.update.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.VOID,
      voidReason: 'Replacement required',
    });

    await service.void(user, 'placement-1', 'claim-1', 'cash-call-1', {
      voidReason: ' Replacement required ',
    });

    const updateArgs = firstCallArg<Prisma.PlacementClaimCashCallUpdateArgs>(
      prisma.placementClaimCashCall.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementClaimCashCallStatus.VOID,
      voidReason: 'Replacement required',
    });
  });

  it('rejects void when active recovery receipts exist', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.ISSUED,
    });
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue({
      id: 'receipt-1',
    });

    await expect(
      service.void(user, 'placement-1', 'claim-1', 'cash-call-1', {
        voidReason: 'Replacement required',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.placementClaimCashCall.update).not.toHaveBeenCalled();
  });

  it('does not mutate claim allocation, closings, payments or notes when creating cash calls', async () => {
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(allocation);
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(null);
    prisma.placementClaimCashCall.count.mockResolvedValue(0);
    prisma.placementClaimCashCall.create.mockResolvedValue(cashCall);

    await service.create(user, 'placement-1', 'claim-1', 'allocation-1');

    expect(prisma.placementClaimAllocation.update).not.toHaveBeenCalled();
    expect(prisma.placementClosing.update).not.toHaveBeenCalled();
    expect(prisma.placementPayment.update).not.toHaveBeenCalled();
    expect(prisma.placementNote.update).not.toHaveBeenCalled();
  });

  it('does not financially lock the placement', async () => {
    prisma.placementPayment.findFirst.mockResolvedValue(null);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(allocation);
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(null);
    prisma.placementClaimCashCall.count.mockResolvedValue(0);
    prisma.placementClaimCashCall.create.mockResolvedValue(cashCall);

    await service.create(user, 'placement-1', 'claim-1', 'allocation-1');
    const lockStatus = await lockPolicy.evaluate({
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.MARKETING,
    });

    expect(lockStatus.locked).toBe(false);
    expect(lockStatus.lockSource).toBe('NONE');
  });

  it('keeps payment as the only hard financial lock source', async () => {
    prisma.placementPayment.findFirst.mockResolvedValue({
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      createdAt: new Date('2026-06-05T12:00:00.000Z'),
    });

    const lockStatus = await lockPolicy.evaluate({
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.MARKETING,
    });

    expect(lockStatus.locked).toBe(true);
    expect(lockStatus.lockSource).toBe('PREMIUM_PAYMENT');
  });
});
