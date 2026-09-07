import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PlacementClaimCedantSettlementStatus,
  PlacementClaimStatus,
  PlacementSettlementMethod,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementClaimCedantSettlementsService } from './cedant-settlements.service';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

describe('PlacementClaimCedantSettlementsService', () => {
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
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimNumber: 'CLM-001',
    status: PlacementClaimStatus.RESERVED,
    occurrenceDate: new Date('2026-07-01T00:00:00.000Z'),
    reportedDate: new Date('2026-07-02T00:00:00.000Z'),
    claimCause: 'Fire',
    occurrenceDetails: null,
    currency: 'GHS',
    estimatedLossAmount: new Prisma.Decimal('120000.00'),
    finalLossAmount: new Prisma.Decimal('100000.00'),
    finalizedAt: new Date('2026-07-10T00:00:00.000Z'),
    finalizedByUserId: 'adjuster-1',
    approvedPayableAmount: null,
    approvedAt: null,
    approvedByUserId: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    closedAt: null,
    voidedAt: null,
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  };

  const settlement = {
    id: 'settlement-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    payableApprovalId: 'approval-1',
    currency: 'GHS',
    amount: new Prisma.Decimal('40000.00'),
    settlementDate: new Date('2026-07-29T12:00:00.000Z'),
    reference: 'PAY-001',
    settlementMethod: null,
    settlementCurrency: null,
    bankReference: null,
    bankConfirmedAt: null,
    bankConfirmedByUserId: null,
    agreedExchangeRate: null,
    bankChargeAmount: new Prisma.Decimal('0.00'),
    notes: null,
    status: PlacementClaimCedantSettlementStatus.RECORDED,
    reversalOfSettlementId: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-07-29T12:00:00.000Z'),
    updatedAt: new Date('2026-07-29T12:00:00.000Z'),
    reversalSettlements: [],
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: {
      findFirst: PrismaMethod;
      update: PrismaMethod;
    };
    placementClaimAllocation: {
      count: PrismaMethod;
    };
    placementClaimPayableApproval: {
      findFirst: PrismaMethod;
      create: PrismaMethod;
    };
    placementClaimCedantSettlement: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      updateMany: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let service: PlacementClaimCedantSettlementsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimAllocation: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimPayableApproval: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCedantSettlement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
        updateMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.count.mockResolvedValue(1);
    prisma.placementClaimPayableApproval.findFirst.mockResolvedValue(null);
    prisma.placementClaimPayableApproval.create.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      finalLossAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-30T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      notes: null,
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
    });
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([]);
    service = new PlacementClaimCedantSettlementsService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('records claim-level payable approval without Accounting outbox capture', async () => {
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });

    await service.approvePayable(user, 'placement-1', 'claim-1', {
      approvedPayableAmount: 90000,
      currency: 'GHS',
      notes: ' Reinsurer approval confirmed ',
    });

    const approvalCreateArgs =
      firstCallArg<Prisma.PlacementClaimPayableApprovalCreateArgs>(
        prisma.placementClaimPayableApproval.create,
      );
    expect(approvalCreateArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: 90000,
      finalLossAmount: 100000,
      currency: 'GHS',
      approvedByUserId: 'user-1',
      notes: 'Reinsurer approval confirmed',
    });
    const args = firstCallArg<Prisma.PlacementClaimUpdateArgs>(
      prisma.placementClaim.update,
    );
    expect(args.data).toMatchObject({
      approvedPayableAmount: 90000,
      approvedByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
  });

  it('requires final loss, active allocation, amount within final loss and matching currency', async () => {
    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 100000.01,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 90000,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      finalLossAmount: null,
    });
    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.count.mockResolvedValue(0);
    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 90000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats duplicate same-version approval as idempotent and blocks mutation', async () => {
    prisma.placementClaimPayableApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      finalLossAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-30T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      notes: null,
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
    });

    const result = await service.approvePayable(
      user,
      'placement-1',
      'claim-1',
      {
        approvedPayableAmount: 90000,
      },
    );

    expect(result).toBe(claim);
    expect(prisma.placementClaimPayableApproval.create).not.toHaveBeenCalled();

    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 85000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves operationally regardless of Accounting module enablement', async () => {
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });

    await service.approvePayable(
      { ...user, moduleConfig: { operations: true, accounting: false } },
      'placement-1',
      'claim-1',
      { approvedPayableAmount: 90000 },
    );

    expect(prisma.placementClaimPayableApproval.create).toHaveBeenCalled();
  });

  it('rejects lowering approved payable below effective cedant settlements', async () => {
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('60000.00'),
        status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
        reversalOfSettlementId: null,
      },
    ]);

    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 50000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records partial settlement against approved payable and rejects over-settlement', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });
    prisma.placementClaimPayableApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      finalLossAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-30T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      notes: null,
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
    });
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('40000.00'),
        status: PlacementClaimCedantSettlementStatus.RECORDED,
        reversalOfSettlementId: null,
      },
    ]);
    prisma.placementClaimCedantSettlement.create.mockResolvedValue({
      ...settlement,
      amount: new Prisma.Decimal('50000.00'),
    });

    await service.create(user, 'placement-1', 'claim-1', {
      currency: 'GHS',
      amount: 50000,
      settlementDate: '2026-07-29T12:00:00.000Z',
      reference: ' PAY-002 ',
    });

    const args = firstCallArg<Prisma.PlacementClaimCedantSettlementCreateArgs>(
      prisma.placementClaimCedantSettlement.create,
    );
    expect(args.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      payableApprovalId: 'approval-1',
      currency: 'GHS',
      amount: 50000,
      reference: 'PAY-002',
      status: PlacementClaimCedantSettlementStatus.RECORDED,
    });
    await expect(
      service.create(user, 'placement-1', 'claim-1', {
        currency: 'GHS',
        amount: 50000.01,
        settlementDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects settlement without approval and wrong currency', async () => {
    await expect(
      service.create(user, 'placement-1', 'claim-1', {
        currency: 'GHS',
        amount: 1000,
        settlementDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });
    prisma.placementClaimPayableApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      finalLossAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-30T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      notes: null,
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', {
        currency: 'USD',
        amount: 1000,
        settlementDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('financially confirms a recorded cedant settlement and enqueues paid event', async () => {
    const confirmed = {
      ...settlement,
      status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-07-30T12:00:00.000Z'),
      bankConfirmedByUserId: 'user-1',
      bankReference: 'BANK-CED-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
    };
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });
    prisma.placementClaimPayableApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      finalLossAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-30T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      notes: null,
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
    });
    prisma.placementClaimCedantSettlement.findFirst
      .mockResolvedValueOnce(settlement)
      .mockResolvedValueOnce(confirmed);
    prisma.placementClaimCedantSettlement.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.confirmBankSettlement(
      user,
      'placement-1',
      'claim-1',
      'settlement-1',
      {
        bankConfirmedAt: '2026-07-30T12:00:00.000Z',
        bankReference: 'BANK-CED-001',
        accountingCashAccountId: 'cash-account-1',
      },
    );

    expect(result).toEqual(confirmed);
    const updateArgs =
      firstCallArg<Prisma.PlacementClaimCedantSettlementUpdateManyArgs>(
        prisma.placementClaimCedantSettlement.updateMany,
      );
    expect(updateArgs.where).toMatchObject({
      id: 'settlement-1',
      status: PlacementClaimCedantSettlementStatus.RECORDED,
    });
    expect(updateArgs.data).toMatchObject({
      status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
      payableApprovalId: 'approval-1',
      bankConfirmedByUserId: 'user-1',
      bankReference: 'BANK-CED-001',
      accountingCashAccountId: 'cash-account-1',
    });
  });

  it('uses only bank-confirmed settlements for payable outstanding', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('30000.00'),
        status: PlacementClaimCedantSettlementStatus.RECORDED,
        reversalOfSettlementId: null,
      },
      {
        amount: new Prisma.Decimal('40000.00'),
        status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
        reversalOfSettlementId: null,
      },
    ]);

    const position = await service.getPosition(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(position).toMatchObject({
      recordedAmount: '30000.00',
      bankConfirmedAmount: '40000.00',
      settledAmount: '40000.00',
      outstandingAmount: '50000.00',
      operationalSettledAmount: '70000.00',
      settlementStatus: 'PARTIALLY_SETTLED',
    });
  });

  it('reverses settlement immutably and rejects duplicate reversal', async () => {
    prisma.placementClaimCedantSettlement.findFirst.mockResolvedValue(
      settlement,
    );
    prisma.placementClaimCedantSettlement.update.mockResolvedValue({
      ...settlement,
      status: PlacementClaimCedantSettlementStatus.REVERSED,
    });
    prisma.placementClaimCedantSettlement.create.mockResolvedValue({
      ...settlement,
      id: 'settlement-reversal-1',
      reversalOfSettlementId: 'settlement-1',
    });

    await service.reverse(user, 'placement-1', 'claim-1', 'settlement-1', {
      notes: 'Correction',
    });

    expect(prisma.placementClaimCedantSettlement.update).toHaveBeenCalledWith({
      where: { id: 'settlement-1' },
      data: { status: PlacementClaimCedantSettlementStatus.REVERSED },
    });
    const createArgs =
      firstCallArg<Prisma.PlacementClaimCedantSettlementCreateArgs>(
        prisma.placementClaimCedantSettlement.create,
      );
    expect(createArgs.data).toMatchObject({
      status: PlacementClaimCedantSettlementStatus.RECORDED,
      reversalOfSettlementId: 'settlement-1',
    });
    expect((createArgs.data.amount as Prisma.Decimal).toString()).toBe(
      '-40000',
    );
    prisma.placementClaimCedantSettlement.findFirst.mockResolvedValue({
      ...settlement,
      status: PlacementClaimCedantSettlementStatus.REVERSED,
    });

    await expect(
      service.reverse(user, 'placement-1', 'claim-1', 'settlement-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([PlacementClaimStatus.SETTLED, PlacementClaimStatus.CLOSED])(
    'blocks cedant settlement reversal when claim is %s',
    async (status) => {
      prisma.placementClaimCedantSettlement.findFirst.mockResolvedValue(
        settlement,
      );
      prisma.placementClaim.findFirst.mockResolvedValue({
        ...claim,
        status,
      });

      await expect(
        service.reverse(user, 'placement-1', 'claim-1', 'settlement-1', {
          notes: 'Correction',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        prisma.placementClaimCedantSettlement.update,
      ).not.toHaveBeenCalled();
      expect(
        prisma.placementClaimCedantSettlement.create,
      ).not.toHaveBeenCalled();
    },
  );

  it('reverses bank-confirmed cedant settlements without Accounting outbox capture', async () => {
    const confirmedSettlement = {
      ...settlement,
      status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-07-30T12:00:00.000Z'),
      bankConfirmedByUserId: 'accountant-1',
      bankReference: 'BANK-CED-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
    };
    const reversal = {
      ...confirmedSettlement,
      id: 'settlement-reversal-1',
      amount: new Prisma.Decimal('-40000.00'),
      reversalOfSettlementId: 'settlement-1',
      createdByUserId: 'user-1',
    };
    prisma.placementClaimCedantSettlement.findFirst.mockResolvedValue(
      confirmedSettlement,
    );
    prisma.placementClaimCedantSettlement.update.mockResolvedValue({
      ...confirmedSettlement,
      status: PlacementClaimCedantSettlementStatus.REVERSED,
    });
    prisma.placementClaimCedantSettlement.create.mockResolvedValue(reversal);

    await service.reverse(user, 'placement-1', 'claim-1', 'settlement-1', {
      notes: 'Correction',
    });

    const createArgs =
      firstCallArg<Prisma.PlacementClaimCedantSettlementCreateArgs>(
        prisma.placementClaimCedantSettlement.create,
      );
    expect(createArgs.data).toMatchObject({
      status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
      reversalOfSettlementId: 'settlement-1',
    });
  });
});
