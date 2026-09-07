import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClaimAllocationStatus,
  PlacementClaimStatus,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementClaimRecoveryApprovalsService } from './recovery-approvals.service';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

describe('PlacementClaimRecoveryApprovalsService', () => {
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
    moduleConfig: { operations: true, accounting: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  };

  const claim = {
    id: 'claim-1',
    placementId: 'placement-1',
    status: PlacementClaimStatus.RESERVED,
    currency: 'GHS',
    finalizedAt: new Date('2026-07-10T00:00:00.000Z'),
    voidedAt: null,
    closedAt: null,
  };

  const allocation = {
    id: 'allocation-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    placementClosingId: 'closing-1',
    endorsementClosingId: null,
    participantId: 'participant-1',
    endorsementParticipantId: null,
    counterpartyId: 'reinsurer-1',
    signedLinePercent: new Prisma.Decimal('40.0000'),
    basisAmount: new Prisma.Decimal('250000.00'),
    allocatedEstimatedLossAmount: new Prisma.Decimal('100000.00'),
    allocatedFinalLossAmount: new Prisma.Decimal('90000.00'),
    cashCallAmount: new Prisma.Decimal('90000.00'),
    paidAmount: null,
    status: PlacementClaimAllocationStatus.NOTIFIED,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    claim,
    counterparty: {
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      name: 'Reliable Re',
      registrationNumber: 'RE-001',
    },
  };

  const approval = {
    id: 'recovery-approval-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    allocationId: 'allocation-1',
    cashCallId: null,
    counterpartyId: 'reinsurer-1',
    approvalVersion: 1,
    approvedAmount: new Prisma.Decimal('40000.00'),
    eligibleAmount: new Prisma.Decimal('90000.00'),
    currency: 'GHS',
    approvedAt: new Date('2026-07-30T10:00:00.000Z'),
    approvedByUserId: 'user-1',
    reference: null,
    notes: null,
    createdAt: new Date('2026-07-30T10:00:00.000Z'),
    counterparty: allocation.counterparty,
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: { findFirst: PrismaMethod };
    placementClaimAllocation: { findFirst: PrismaMethod };
    placementClaimCashCall: { findFirst: PrismaMethod };
    placementClaimRecoveryApproval: {
      findMany: PrismaMethod;
      create: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let service: PlacementClaimRecoveryApprovalsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaimAllocation: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCashCall: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimRecoveryApproval: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementClaim.findFirst.mockResolvedValue({
      id: 'claim-1',
      placementId: 'placement-1',
    });
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(allocation);
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      id: 'cash-call-1',
      currency: 'GHS',
    });
    prisma.placementClaimRecoveryApproval.findMany.mockResolvedValue([]);
    prisma.placementClaimRecoveryApproval.create.mockResolvedValue(approval);
    service = new PlacementClaimRecoveryApprovalsService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('records a per-allocation recovery approval without Accounting outbox capture', async () => {
    await service.approve(user, 'placement-1', 'claim-1', 'allocation-1', {
      approvedAmount: 40000,
      currency: 'GHS',
      reference: 'APP-001',
      notes: 'Approved after loss-adjuster review.',
    });

    const createArgs =
      firstCallArg<Prisma.PlacementClaimRecoveryApprovalCreateArgs>(
        prisma.placementClaimRecoveryApproval.create,
      );
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      counterpartyId: 'reinsurer-1',
      approvalVersion: 1,
      approvedAmount: 40000,
      eligibleAmount: 90000,
      currency: 'GHS',
      approvedByUserId: 'user-1',
      reference: 'APP-001',
      notes: 'Approved after loss-adjuster review.',
    });
  });

  it('allows cumulative partial approvals for the same allocation', async () => {
    prisma.placementClaimRecoveryApproval.findMany.mockResolvedValue([
      { ...approval, approvedAmount: new Prisma.Decimal('40000.00') },
    ]);
    prisma.placementClaimRecoveryApproval.create.mockResolvedValue({
      ...approval,
      id: 'recovery-approval-2',
      approvalVersion: 2,
      approvedAmount: new Prisma.Decimal('50000.00'),
    });

    await service.approve(user, 'placement-1', 'claim-1', 'allocation-1', {
      approvedAmount: 50000,
    });

    const findManyArgs =
      firstCallArg<Prisma.PlacementClaimRecoveryApprovalFindManyArgs>(
        prisma.placementClaimRecoveryApproval.findMany,
      );
    expect(findManyArgs.where).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
    });
    const createArgs =
      firstCallArg<Prisma.PlacementClaimRecoveryApprovalCreateArgs>(
        prisma.placementClaimRecoveryApproval.create,
      );
    expect(createArgs.data.approvalVersion).toBe(2);
  });

  it('rejects over-approval without creating approval rows', async () => {
    prisma.placementClaimRecoveryApproval.findMany.mockResolvedValue([
      { ...approval, approvedAmount: new Prisma.Decimal('80000.00') },
    ]);

    await expect(
      service.approve(user, 'placement-1', 'claim-1', 'allocation-1', {
        approvedAmount: 15000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.placementClaimRecoveryApproval.create).not.toHaveBeenCalled();
  });

  it('approves operationally regardless of Accounting module enablement', async () => {
    await service.approve(
      { ...user, moduleConfig: { operations: true, accounting: false } },
      'placement-1',
      'claim-1',
      'allocation-1',
      { approvedAmount: 40000 },
    );

    expect(prisma.placementClaimRecoveryApproval.create).toHaveBeenCalled();
  });

  it('rejects non-reinsurer and void allocation approvals', async () => {
    prisma.placementClaimAllocation.findFirst.mockResolvedValueOnce({
      ...allocation,
      counterparty: {
        ...allocation.counterparty,
        type: CounterpartyType.CEDANT,
      },
    });
    await expect(
      service.approve(user, 'placement-1', 'claim-1', 'allocation-1', {
        approvedAmount: 40000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaimAllocation.findFirst.mockResolvedValueOnce({
      ...allocation,
      status: PlacementClaimAllocationStatus.VOID,
    });
    await expect(
      service.approve(user, 'placement-1', 'claim-1', 'allocation-1', {
        approvedAmount: 40000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates optional cash-call scope and currency', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValueOnce({
      id: 'cash-call-1',
      currency: 'USD',
    });

    await expect(
      service.approve(user, 'placement-1', 'claim-1', 'allocation-1', {
        approvedAmount: 40000,
        cashCallId: 'cash-call-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
