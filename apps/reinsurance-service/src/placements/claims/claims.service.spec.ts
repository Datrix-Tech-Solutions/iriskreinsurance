import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementClaimAllocationStatus,
  PlacementClaimStatus,
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaimAllocationCalculator } from './allocation/allocation.calculator';
import { ClosingSnapshotReader } from '../closings/closing-snapshot.reader';
import { PlacementEffectivePositionService } from '../placement-effective-position.service';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import { PlacementClaimsService } from './claims.service';
import { PlacementFinancialActivityReader } from '../finance/financial-activity.reader';
import { PlacementFinancialLockPolicy } from '../finance/financial-lock.policy';
import {
  ClaimWorkflowPermission,
  PlacementPermission,
} from '../placement.permissions';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

describe('PlacementClaimsService', () => {
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
    permissions: [PlacementPermission.CREATE, PlacementPermission.EDIT],
  };
  const employeeWithPermissions = (permissions: string[]) => ({
    ...user,
    permissions,
  });

  const placement = {
    id: 'placement-1',
    currency: 'GHS',
    placementType: 'FACULTATIVE' as const,
  };

  const effectiveView = {
    effectiveTerms: {
      inceptionDate: '2026-01-01T00:00:00.000Z',
      expiryDate: '2026-12-31T00:00:00.000Z',
      currency: 'GHS',
      sumInsured: 100000,
    },
  };

  const claim = {
    id: 'claim-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimNumber: 'CLM-001',
    status: PlacementClaimStatus.DRAFT,
    occurrenceDate: new Date('2026-06-03T00:00:00.000Z'),
    reportedDate: new Date('2026-06-05T10:00:00.000Z'),
    claimCause: 'Warehouse fire',
    occurrenceDetails: null,
    currency: 'GHS',
    estimatedLossAmount: new Prisma.Decimal('40000.00'),
    finalLossAmount: null,
    finalizedAt: null,
    finalizedByUserId: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    closedAt: null,
    voidedAt: null,
    createdAt: new Date('2026-06-05T10:00:00.000Z'),
    updatedAt: new Date('2026-06-05T10:00:00.000Z'),
  };

  const closedEndorsement = {
    id: 'endorsement-1',
    endorsementNumber: 'END-001',
    effectiveDate: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-02T00:00:00.000Z'),
    closings: [
      {
        id: 'endorsement-closing-1',
        status: PlacementClosingStatus.CONFIRMED,
      },
    ],
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementClaimAllocation: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      createMany: PrismaMethod;
    };
    placementEndorsement: { findMany: PrismaMethod };
    placementClosing: { findMany: PrismaMethod };
    placementEndorsementClosing: { findMany: PrismaMethod };
    placementPayment: { findFirst: PrismaMethod };
    placementNote: { update: PrismaMethod };
    $transaction: jest.Mock;
  };
  let service: PlacementClaimsService;
  let effectiveViewService: {
    getEffectiveView: jest.Mock;
  };
  let financialCloseReadiness: {
    assertReadyForSettlementStatus: jest.Mock;
    assertReadyForClosedStatus: jest.Mock;
  };
  let lockPolicy: PlacementFinancialLockPolicy;
  let money: ReinsuranceMoneyHelper;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimAllocation: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        createMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementNote: {
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    money = new ReinsuranceMoneyHelper();
    effectiveViewService = {
      getEffectiveView: jest.fn().mockResolvedValue(effectiveView),
    };
    financialCloseReadiness = {
      assertReadyForSettlementStatus: jest.fn().mockResolvedValue({}),
      assertReadyForClosedStatus: jest.fn().mockResolvedValue({}),
    };
    service = new PlacementClaimsService(
      prisma as unknown as PrismaService,
      new PlacementEffectivePositionService(new ClosingSnapshotReader(money)),
      effectiveViewService as unknown as PlacementEffectiveViewService,
      new ClaimAllocationCalculator(money),
      financialCloseReadiness as never,
      money,
    );
    lockPolicy = new PlacementFinancialLockPolicy(
      new PlacementFinancialActivityReader(prisma as unknown as PrismaService),
    );
    prisma.placementEndorsement.findMany.mockResolvedValue([]);
  });

  it('creates a claim loss event using the user-entered claim number', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.create.mockResolvedValue(claim);

    await service.create(user, 'placement-1', {
      claimNumber: ' CLM-CUSTOM-001 ',
      occurrenceDate: '2026-06-03T00:00:00.000Z',
      reportedDate: '2026-06-05T10:00:00.000Z',
      claimCause: ' Warehouse fire ',
      occurrenceDetails: ' Section B ',
      currency: 'ghs',
      estimatedLossAmount: 40000,
    });

    const createArgs = firstCallArg<Prisma.PlacementClaimCreateArgs>(
      prisma.placementClaim.create,
    );
    expect(effectiveViewService.getEffectiveView).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      new Date('2026-06-03T00:00:00.000Z'),
    );
    expect(createArgs.data.claimNumber).toBe('CLM-CUSTOM-001');
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      status: PlacementClaimStatus.DRAFT,
      claimCause: 'Warehouse fire',
      occurrenceDetails: 'Section B',
      currency: 'GHS',
      estimatedLossAmount: 40000,
      finalLossAmount: null,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
  });

  it('rejects creating a claim with a claim number already used by the tenant', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '0.0.0',
      }),
    );

    await expect(
      service.create(user, 'placement-1', {
        claimNumber: 'CLM-DUPLICATE',
        occurrenceDate: '2026-06-03T00:00:00.000Z',
        reportedDate: '2026-06-05T10:00:00.000Z',
        claimCause: 'Warehouse fire',
        currency: 'GHS',
        estimatedLossAmount: 40000,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a claim before the effective coverage inception date', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(
      service.create(user, 'placement-1', {
        claimNumber: 'CLM-TEST-001',
        occurrenceDate: '2025-12-31T12:00:00.000Z',
        reportedDate: '2026-06-05T10:00:00.000Z',
        claimCause: 'Warehouse fire',
        currency: 'GHS',
        estimatedLossAmount: 40000,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementClaim.create).not.toHaveBeenCalled();
  });

  it('rejects a claim after the effective coverage expiry date', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(
      service.create(user, 'placement-1', {
        claimNumber: 'CLM-TEST-002',
        occurrenceDate: '2027-01-01T00:00:00.000Z',
        reportedDate: '2026-06-05T10:00:00.000Z',
        claimCause: 'Warehouse fire',
        currency: 'GHS',
        estimatedLossAmount: 40000,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementClaim.create).not.toHaveBeenCalled();
  });

  it('validates claim amounts against the effective sum insured on the loss date', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(
      service.create(user, 'placement-1', {
        claimNumber: 'CLM-TEST-003',
        occurrenceDate: '2026-06-03T00:00:00.000Z',
        reportedDate: '2026-06-05T10:00:00.000Z',
        claimCause: 'Warehouse fire',
        currency: 'GHS',
        estimatedLossAmount: 100000.01,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementClaim.create).not.toHaveBeenCalled();
  });

  it('uses endorsed loss-date terms instead of raw placement values', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.create.mockResolvedValue(claim);
    effectiveViewService.getEffectiveView.mockResolvedValueOnce({
      effectiveTerms: {
        ...effectiveView.effectiveTerms,
        sumInsured: 700000,
      },
    });

    await service.create(user, 'placement-1', {
      claimNumber: 'CLM-TEST-004',
      occurrenceDate: '2026-08-01T00:00:00.000Z',
      reportedDate: '2026-08-02T10:00:00.000Z',
      claimCause: 'Warehouse fire',
      currency: 'GHS',
      estimatedLossAmount: 650000,
    });

    expect(prisma.placementClaim.create).toHaveBeenCalled();
    expect(effectiveViewService.getEffectiveView).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      new Date('2026-08-01T00:00:00.000Z'),
    );
  });

  it('rejects wrong-tenant or archived placement when creating claim', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, 'placement-1', {
        claimNumber: 'CLM-TEST-005',
        occurrenceDate: '2026-06-03T00:00:00.000Z',
        reportedDate: '2026-06-05T10:00:00.000Z',
        claimCause: 'Warehouse fire',
        currency: 'GHS',
        estimatedLossAmount: 40000,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('scopes claim list reads by tenant and placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findMany.mockResolvedValue([claim]);

    const result = await service.findAll('tenant-1', 'placement-1');

    expect(prisma.placement.findFirst).toHaveBeenCalledWith({
      where: { id: 'placement-1', tenantId: 'tenant-1', archivedAt: null },
      select: { id: true, currency: true },
    });
    expect(prisma.placementClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', placementId: 'placement-1' },
      }),
    );
    expect(result).toEqual([claim]);
  });

  it('scopes claim detail reads by tenant, placement and claim', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);

    await expect(
      service.findOne('tenant-1', 'placement-1', 'claim-1'),
    ).resolves.toBe(claim);

    expect(prisma.placementClaim.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'claim-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
      },
    });
  });

  it('sets finalLossAmount and finalized metadata on editable claim update', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      finalLossAmount: new Prisma.Decimal('37500.00'),
      finalizedByUserId: 'user-1',
    });

    await service.update(user, 'placement-1', 'claim-1', {
      finalLossAmount: 37500,
    });

    const updateArgs = firstCallArg<Prisma.PlacementClaimUpdateArgs>(
      prisma.placementClaim.update,
    );
    expect(updateArgs.data).toMatchObject({
      finalLossAmount: 37500,
      finalizedByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
    expect(updateArgs.data).toHaveProperty('finalizedAt');
  });

  it('revalidates effective terms when updating occurrence date or amounts', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);

    await expect(
      service.update(user, 'placement-1', 'claim-1', {
        occurrenceDate: '2027-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementClaim.update).not.toHaveBeenCalled();
    expect(effectiveViewService.getEffectiveView).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      new Date('2027-01-01T00:00:00.000Z'),
    );
  });

  it('blocks allocation-sensitive edits after allocations have been generated', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue({
      id: 'allocation-1',
    });

    await expect(
      service.update(user, 'placement-1', 'claim-1', {
        occurrenceDate: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(effectiveViewService.getEffectiveView).not.toHaveBeenCalled();
    expect(prisma.placementClaim.update).not.toHaveBeenCalled();
  });

  it('allows non-economic claim text edits after allocations exist', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue({
      id: 'allocation-1',
    });
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      claimCause: 'Updated cause',
    });

    await service.update(user, 'placement-1', 'claim-1', {
      claimCause: 'Updated cause',
    });

    expect(prisma.placementClaimAllocation.findFirst).not.toHaveBeenCalled();
    const updateArgs = firstCallArg<Prisma.PlacementClaimUpdateArgs>(
      prisma.placementClaim.update,
    );
    expect(updateArgs.data).toMatchObject({ claimCause: 'Updated cause' });
  });

  it('rejects editing CLOSED or VOID claims', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.CLOSED,
    });

    await expect(
      service.update(user, 'placement-1', 'claim-1', {
        claimCause: 'Updated cause',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces claim lifecycle transitions and terminal states', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.NOTIFIED,
    });

    await service.changeStatus(user, 'placement-1', 'claim-1', {
      status: PlacementClaimStatus.NOTIFIED,
    });

    const statusUpdateArgs = firstCallArg<Prisma.PlacementClaimUpdateArgs>(
      prisma.placementClaim.update,
    );
    expect(statusUpdateArgs.data).toMatchObject({
      status: PlacementClaimStatus.NOTIFIED,
      updatedByUserId: 'user-1',
    });

    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.CLOSED,
    });
    await expect(
      service.changeStatus(user, 'placement-1', 'claim-1', {
        status: PlacementClaimStatus.NOTIFIED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows create-notification permission only for NOTIFIED transitions', async () => {
    const notificationUser = employeeWithPermissions([
      ClaimWorkflowPermission.CREATE_NOTIFICATION,
    ]);
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.NOTIFIED,
    });

    await service.changeStatus(notificationUser, 'placement-1', 'claim-1', {
      status: PlacementClaimStatus.NOTIFIED,
    });

    const notificationUpdateArgs = firstCallArg<{
      data: { status?: PlacementClaimStatus };
    }>(prisma.placementClaim.update);
    expect(notificationUpdateArgs.data.status).toBe(
      PlacementClaimStatus.NOTIFIED,
    );

    prisma.placementClaim.update.mockClear();
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.NOTIFIED,
    });

    await expect(
      service.changeStatus(notificationUser, 'placement-1', 'claim-1', {
        status: PlacementClaimStatus.RESERVED,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.placementClaim.update).not.toHaveBeenCalled();
  });

  it('allows void-claim permission only for VOID transitions', async () => {
    const voidUser = employeeWithPermissions([
      ClaimWorkflowPermission.VOID_CLAIM,
    ]);
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.VOID,
    });

    await service.changeStatus(voidUser, 'placement-1', 'claim-1', {
      status: PlacementClaimStatus.VOID,
    });

    const voidUpdateArgs = firstCallArg<{
      data: { status?: PlacementClaimStatus };
    }>(prisma.placementClaim.update);
    expect(voidUpdateArgs.data.status).toBe(PlacementClaimStatus.VOID);

    prisma.placementClaim.update.mockClear();
    prisma.placementClaim.findFirst.mockResolvedValue(claim);

    await expect(
      service.changeStatus(voidUser, 'placement-1', 'claim-1', {
        status: PlacementClaimStatus.NOTIFIED,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.placementClaim.update).not.toHaveBeenCalled();
  });

  it('requires financial readiness before moving to SETTLED', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.PARTIALLY_SETTLED,
    });
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.SETTLED,
    });

    await service.changeStatus(user, 'placement-1', 'claim-1', {
      status: PlacementClaimStatus.SETTLED,
    });

    expect(
      financialCloseReadiness.assertReadyForSettlementStatus,
    ).toHaveBeenCalledWith('tenant-1', 'placement-1', 'claim-1');
  });

  it('blocks SETTLED when financial readiness reports outstanding obligations', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.PARTIALLY_SETTLED,
    });
    financialCloseReadiness.assertReadyForSettlementStatus.mockRejectedValue(
      new ConflictException({
        message: 'Claim cannot be marked settled',
        blockers: ['CLAIM_PAYABLE_OUTSTANDING'],
      }),
    );

    await expect(
      service.changeStatus(user, 'placement-1', 'claim-1', {
        status: PlacementClaimStatus.SETTLED,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.placementClaim.update).not.toHaveBeenCalled();
  });

  it('requires SETTLED before CLOSED and rechecks financial readiness', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.SETTLED,
    });
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.CLOSED,
    });

    await service.changeStatus(user, 'placement-1', 'claim-1', {
      status: PlacementClaimStatus.CLOSED,
    });

    expect(
      financialCloseReadiness.assertReadyForClosedStatus,
    ).toHaveBeenCalledWith('tenant-1', 'placement-1', 'claim-1');
  });

  it('does not allow CLOSED to bypass SETTLED', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.PARTIALLY_SETTLED,
    });

    await expect(
      service.changeStatus(user, 'placement-1', 'claim-1', {
        status: PlacementClaimStatus.CLOSED,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(
      financialCloseReadiness.assertReadyForClosedStatus,
    ).not.toHaveBeenCalled();
  });

  it.each([PlacementClaimStatus.CLOSED, PlacementClaimStatus.VOID])(
    'rejects allocation generation when claim status is %s',
    async (status) => {
      prisma.placement.findFirst.mockResolvedValue(placement);
      prisma.placementClaim.findFirst.mockResolvedValue({
        ...claim,
        status,
      });

      await expect(
        service.generateAllocations(user, 'placement-1', 'claim-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementClaimAllocation.findFirst).not.toHaveBeenCalled();
      expect(prisma.placementClosing.findMany).not.toHaveBeenCalled();
      expect(
        prisma.placementEndorsementClosing.findMany,
      ).not.toHaveBeenCalled();
    },
  );

  it('generates allocations from confirmed placement and endorsement closing snapshots', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      finalLossAmount: new Prisma.Decimal('37500.00'),
    });
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        id: 'closing-1',
        participantId: 'participant-1',
        signedLinePercent: new Prisma.Decimal('40.0000'),
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('450.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('337.50'),
        netPremium: new Prisma.Decimal('3712.50'),
        currency: 'GHS',
        participant: { counterpartyId: 'reinsurer-1' },
      },
    ]);
    prisma.placementEndorsement.findMany.mockResolvedValue([closedEndorsement]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        endorsementParticipantId: 'endorsement-participant-1',
        signedLinePercent: new Prisma.Decimal('10.0000'),
        premiumSnapshot: new Prisma.Decimal('1200.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('120.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('90.00'),
        netPremium: new Prisma.Decimal('990.00'),
        currency: 'GHS',
        endorsementParticipant: {
          counterpartyId: 'reinsurer-2',
          originalParticipantId: null,
        },
      },
    ]);
    prisma.placementClaimAllocation.createMany.mockResolvedValue({ count: 2 });
    prisma.placementClaimAllocation.findMany.mockResolvedValue([]);

    await service.generateAllocations(user, 'placement-1', 'claim-1');

    const placementClosingFindArgs =
      firstCallArg<Prisma.PlacementClosingFindManyArgs>(
        prisma.placementClosing.findMany,
      );
    expect(placementClosingFindArgs.where).toMatchObject({
      status: PlacementClosingStatus.CONFIRMED,
    });
    const endorsementClosingFindArgs =
      firstCallArg<Prisma.PlacementEndorsementClosingFindManyArgs>(
        prisma.placementEndorsementClosing.findMany,
      );
    expect(endorsementClosingFindArgs.where).toMatchObject({
      status: PlacementClosingStatus.CONFIRMED,
    });
    const endorsementFindArgs =
      firstCallArg<Prisma.PlacementEndorsementFindManyArgs>(
        prisma.placementEndorsement.findMany,
      );
    expect(endorsementFindArgs.where).toMatchObject({
      status: PlacementEndorsementStatus.CLOSED,
      effectiveDate: { lte: claim.occurrenceDate },
    });
    const createManyArgs =
      firstCallArg<Prisma.PlacementClaimAllocationCreateManyArgs>(
        prisma.placementClaimAllocation.createMany,
      );
    const rows = Array.isArray(createManyArgs.data)
      ? createManyArgs.data
      : [createManyArgs.data];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(
        Boolean(row.placementClosingId) && Boolean(row.endorsementClosingId),
      ).toBe(false);
      expect(
        Boolean(row.placementClosingId) || Boolean(row.endorsementClosingId),
      ).toBe(true);
    }
    expect(createManyArgs.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementClosingId: 'closing-1',
          participantId: 'participant-1',
          counterpartyId: 'reinsurer-1',
          signedLinePercent: 40,
          basisAmount: 37500,
          allocatedEstimatedLossAmount: 16000,
          allocatedFinalLossAmount: 15000,
          cashCallAmount: null,
          paidAmount: null,
        }),
        expect.objectContaining({
          endorsementClosingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-2',
          signedLinePercent: 10,
          basisAmount: 37500,
          allocatedEstimatedLossAmount: 4000,
          allocatedFinalLossAmount: 3750,
          cashCallAmount: null,
          paidAmount: null,
        }),
      ]),
    );
  });

  it('allocates claims before an endorsement using only original placement closings', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      occurrenceDate: new Date('2026-04-01T00:00:00.000Z'),
    });
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        id: 'closing-1',
        participantId: 'participant-1',
        signedLinePercent: new Prisma.Decimal('60.0000'),
        grossPremium: new Prisma.Decimal('6000.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('600.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('450.00'),
        netPremium: new Prisma.Decimal('4950.00'),
        currency: 'GHS',
        participant: { counterpartyId: 'reinsurer-1' },
      },
      {
        id: 'closing-2',
        participantId: 'participant-2',
        signedLinePercent: new Prisma.Decimal('40.0000'),
        grossPremium: new Prisma.Decimal('4000.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('400.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('300.00'),
        netPremium: new Prisma.Decimal('3300.00'),
        currency: 'GHS',
        participant: { counterpartyId: 'reinsurer-2' },
      },
    ]);
    prisma.placementEndorsement.findMany.mockResolvedValue([]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'future-endorsement-closing',
        endorsementParticipantId: 'future-endorsement-participant',
        signedLinePercent: new Prisma.Decimal('20.0000'),
        premiumSnapshot: new Prisma.Decimal('2000.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('200.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('150.00'),
        netPremium: new Prisma.Decimal('1650.00'),
        currency: 'GHS',
        endorsementParticipant: {
          counterpartyId: 'reinsurer-3',
          originalParticipantId: null,
        },
      },
    ]);
    prisma.placementClaimAllocation.createMany.mockResolvedValue({ count: 2 });
    prisma.placementClaimAllocation.findMany.mockResolvedValue([]);

    await service.generateAllocations(user, 'placement-1', 'claim-1');

    const createManyArgs =
      firstCallArg<Prisma.PlacementClaimAllocationCreateManyArgs>(
        prisma.placementClaimAllocation.createMany,
      );
    expect(createManyArgs.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementClosingId: 'closing-1',
          signedLinePercent: 60,
          allocatedEstimatedLossAmount: 24000,
        }),
        expect.objectContaining({
          placementClosingId: 'closing-2',
          signedLinePercent: 40,
          allocatedEstimatedLossAmount: 16000,
        }),
      ]),
    );
    expect(createManyArgs.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endorsementClosingId: 'future-endorsement-closing',
        }),
      ]),
    );
  });

  it('allocates claims after a replacement endorsement without double-counting the original line', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      occurrenceDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        id: 'closing-a',
        participantId: 'participant-a',
        signedLinePercent: new Prisma.Decimal('60.0000'),
        grossPremium: new Prisma.Decimal('6000.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('600.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('450.00'),
        netPremium: new Prisma.Decimal('4950.00'),
        currency: 'GHS',
        participant: { counterpartyId: 'reinsurer-a' },
      },
      {
        id: 'closing-b',
        participantId: 'participant-b',
        signedLinePercent: new Prisma.Decimal('40.0000'),
        grossPremium: new Prisma.Decimal('4000.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('400.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('300.00'),
        netPremium: new Prisma.Decimal('3300.00'),
        currency: 'GHS',
        participant: { counterpartyId: 'reinsurer-b' },
      },
    ]);
    prisma.placementEndorsement.findMany.mockResolvedValue([
      {
        ...closedEndorsement,
        effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        closings: [
          {
            id: 'endorsement-closing-a',
            status: PlacementClosingStatus.CONFIRMED,
          },
        ],
      },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-a',
        endorsementParticipantId: 'endorsement-participant-a',
        signedLinePercent: new Prisma.Decimal('40.0000'),
        premiumSnapshot: new Prisma.Decimal('4000.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('400.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('300.00'),
        netPremium: new Prisma.Decimal('3300.00'),
        currency: 'GHS',
        endorsementParticipant: {
          counterpartyId: 'reinsurer-a',
          originalParticipantId: 'participant-a',
        },
      },
    ]);
    prisma.placementClaimAllocation.createMany.mockResolvedValue({ count: 2 });
    prisma.placementClaimAllocation.findMany.mockResolvedValue([]);

    await service.generateAllocations(user, 'placement-1', 'claim-1');

    const createManyArgs =
      firstCallArg<Prisma.PlacementClaimAllocationCreateManyArgs>(
        prisma.placementClaimAllocation.createMany,
      );
    const rows = Array.isArray(createManyArgs.data)
      ? createManyArgs.data
      : [createManyArgs.data];

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endorsementClosingId: 'endorsement-closing-a',
          endorsementParticipantId: 'endorsement-participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 40,
          allocatedEstimatedLossAmount: 16000,
        }),
        expect.objectContaining({
          placementClosingId: 'closing-b',
          participantId: 'participant-b',
          counterpartyId: 'reinsurer-b',
          signedLinePercent: 40,
          allocatedEstimatedLossAmount: 16000,
        }),
      ]),
    );
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementClosingId: 'closing-a',
        }),
      ]),
    );
  });

  it('scopes claim allocation reads by tenant, placement and claim', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findMany.mockResolvedValue([]);

    await expect(
      service.findAllocations('tenant-1', 'placement-1', 'claim-1'),
    ).resolves.toEqual([]);

    expect(prisma.placementClaim.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'claim-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
      },
    });
    expect(prisma.placementClaimAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          claimId: 'claim-1',
          status: { not: PlacementClaimAllocationStatus.VOID },
        },
      }),
    );
  });

  it('rejects allocation generation when no confirmed closings exist', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);

    await expect(
      service.generateAllocations(user, 'placement-1', 'claim-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate allocation generation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue({
      id: 'allocation-1',
    });

    await expect(
      service.generateAllocations(user, 'placement-1', 'claim-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('does not lock placement or mutate financial records when creating a claim', async () => {
    const unlockedPlacement = {
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.CLOSED,
    };
    prisma.placementPayment.findFirst.mockResolvedValue(null);
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.create.mockResolvedValue(claim);

    await expect(lockPolicy.evaluate(unlockedPlacement)).resolves.toMatchObject(
      {
        locked: false,
        endorsementRequired: false,
      },
    );

    await service.create(user, 'placement-1', {
      claimNumber: 'CLM-TEST-006',
      occurrenceDate: '2026-06-03T00:00:00.000Z',
      reportedDate: '2026-06-05T10:00:00.000Z',
      claimCause: 'Warehouse fire',
      currency: 'GHS',
      estimatedLossAmount: 40000,
    });

    expect(prisma.placementNote.update).not.toHaveBeenCalled();
    await expect(lockPolicy.evaluate(unlockedPlacement)).resolves.toMatchObject(
      {
        locked: false,
        endorsementRequired: false,
      },
    );
  });

  it('keeps payment as the only hard lock source for future claim settlements', async () => {
    const lockedPlacement = {
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.CLOSED,
    };
    const paymentDate = new Date('2026-06-05T13:00:00.000Z');
    prisma.placementPayment.findFirst.mockResolvedValue({
      type: PlacementPaymentType.CLAIM_SETTLEMENT,
      paymentDate,
      createdAt: paymentDate,
    });

    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
      endorsementRequired: true,
      lockSource: 'CLAIM_SETTLEMENT',
    });
  });
});
