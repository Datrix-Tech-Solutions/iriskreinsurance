import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClaimCedantSettlementStatus,
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimStatus,
  PlacementSettlementMethod,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementClaimRecoveryReceiptsService } from './recovery-receipts.service';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

describe('PlacementClaimRecoveryReceiptsService', () => {
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
    permissions: [],
  };

  const counterparty = {
    id: 'reinsurer-1',
    type: CounterpartyType.REINSURER,
    name: 'Avenue Re',
    registrationNumber: null,
  };

  const receipt = {
    id: 'receipt-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    allocationId: 'allocation-1',
    cashCallId: 'cash-call-1',
    recoveryApprovalId: 'recovery-approval-1',
    counterpartyId: 'reinsurer-1',
    currency: 'GHS',
    amount: new Prisma.Decimal('40000.00'),
    paymentDate: new Date('2026-07-29T12:00:00.000Z'),
    reference: 'BANK-001',
    settlementMethod: null,
    settlementCurrency: null,
    bankReference: null,
    bankConfirmedAt: null,
    bankConfirmedByUserId: null,
    agreedExchangeRate: null,
    bankChargeAmount: new Prisma.Decimal('0.00'),
    notes: null,
    status: PlacementClaimRecoveryReceiptStatus.RECORDED,
    reversalOfReceiptId: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-07-29T12:00:00.000Z'),
    updatedAt: new Date('2026-07-29T12:00:00.000Z'),
    counterparty,
    reversalReceipts: [],
  };

  const cashCall = {
    id: 'cash-call-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    allocationId: 'allocation-1',
    counterpartyId: 'reinsurer-1',
    cashCallNumber: 'CCL-001',
    status: PlacementClaimCashCallStatus.ISSUED,
    currency: 'GHS',
    amount: new Prisma.Decimal('100000.00'),
    basisAmount: new Prisma.Decimal('250000.00'),
    signedLinePercent: new Prisma.Decimal('40.0000'),
    issuedAt: new Date('2026-07-29T10:00:00.000Z'),
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-07-29T10:00:00.000Z'),
    updatedAt: new Date('2026-07-29T10:00:00.000Z'),
    counterparty,
    allocation: {
      id: 'allocation-1',
      allocatedEstimatedLossAmount: new Prisma.Decimal('100000.00'),
      allocatedFinalLossAmount: null,
      recoveryApprovals: [
        {
          id: 'recovery-approval-1',
          approvedAmount: new Prisma.Decimal('100000.00'),
          currency: 'GHS',
          cashCallId: 'cash-call-1',
          counterpartyId: 'reinsurer-1',
        },
      ],
    },
    recoveryReceipts: [],
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: { findFirst: PrismaMethod };
    placementClaimCashCall: { findFirst: PrismaMethod; findMany: PrismaMethod };
    placementClaimCedantSettlement: {
      findMany: PrismaMethod;
    };
    placementClaimRecoveryReceipt: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      updateMany: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let service: PlacementClaimRecoveryReceiptsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaimCashCall: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCedantSettlement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimRecoveryReceipt: {
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
    prisma.placementClaim.findFirst.mockResolvedValue({
      id: 'claim-1',
      placementId: 'placement-1',
      currency: 'GHS',
      finalLossAmount: null,
      approvedPayableAmount: null,
      approvedAt: null,
      approvedByUserId: null,
      status: PlacementClaimStatus.RESERVED,
    });
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([]);
    service = new PlacementClaimRecoveryReceiptsService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('lists receipts with tenant, claim and cash-call scoping', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([receipt]);

    await service.findAll('tenant-1', 'placement-1', 'claim-1', 'cash-call-1');

    const args = firstCallArg<Prisma.PlacementClaimRecoveryReceiptFindManyArgs>(
      prisma.placementClaimRecoveryReceipt.findMany,
    );
    expect(args.where).toEqual({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      cashCallId: 'cash-call-1',
    });
  });

  it('rejects DRAFT and VOID cash calls', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.DRAFT,
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.VOID,
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records partial recovery against an ISSUED cash call', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);
    prisma.placementClaimRecoveryReceipt.create.mockResolvedValue(receipt);

    await service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
      currency: 'GHS',
      amount: 40000,
      paymentDate: '2026-07-29T12:00:00.000Z',
      reference: ' BANK-001 ',
    });

    const args = firstCallArg<Prisma.PlacementClaimRecoveryReceiptCreateArgs>(
      prisma.placementClaimRecoveryReceipt.create,
    );
    expect(args.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      cashCallId: 'cash-call-1',
      recoveryApprovalId: 'recovery-approval-1',
      counterpartyId: 'reinsurer-1',
      currency: 'GHS',
      amount: 40000,
      reference: 'BANK-001',
      status: PlacementClaimRecoveryReceiptStatus.RECORDED,
    });
  });

  it('allows a second receipt to complete recovery and rejects over-recovery', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      recoveryReceipts: [receipt],
    });
    prisma.placementClaimRecoveryReceipt.create.mockResolvedValue({
      ...receipt,
      id: 'receipt-2',
      amount: new Prisma.Decimal('60000.00'),
    });

    await service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
      currency: 'GHS',
      amount: 60000,
      paymentDate: '2026-07-30T12:00:00.000Z',
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 60000.01,
        paymentDate: '2026-07-30T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('financially confirms a recorded recovery receipt without Accounting outbox capture', async () => {
    const confirmed = {
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-07-30T12:00:00.000Z'),
      bankConfirmedByUserId: 'user-1',
      bankReference: 'BANK-CONF-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
    };
    prisma.placementClaimRecoveryReceipt.findFirst
      .mockResolvedValueOnce(receipt)
      .mockResolvedValueOnce(confirmed);
    prisma.placementClaimRecoveryReceipt.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.confirmBankReceipt(
      user,
      'placement-1',
      'claim-1',
      'receipt-1',
      {
        bankConfirmedAt: '2026-07-30T12:00:00.000Z',
        bankReference: 'BANK-CONF-001',
        accountingCashAccountId: 'cash-account-1',
      },
    );

    expect(result).toEqual(confirmed);
    const updateManyArgs =
      firstCallArg<Prisma.PlacementClaimRecoveryReceiptUpdateManyArgs>(
        prisma.placementClaimRecoveryReceipt.updateMany,
      );
    expect(updateManyArgs.where).toMatchObject({
      id: 'receipt-1',
      status: PlacementClaimRecoveryReceiptStatus.RECORDED,
    });
    expect(updateManyArgs.data).toMatchObject({
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      bankConfirmedByUserId: 'user-1',
      bankReference: 'BANK-CONF-001',
      accountingCashAccountId: 'cash-account-1',
    });
  });

  it('rejects duplicate or non-recorded financial confirmation', async () => {
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue({
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
    });

    await expect(
      service.confirmBankReceipt(user, 'placement-1', 'claim-1', 'receipt-1', {
        bankConfirmedAt: '2026-07-30T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue({
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    });

    await expect(
      service.confirmBankReceipt(user, 'placement-1', 'claim-1', 'receipt-1', {
        bankConfirmedAt: '2026-07-30T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrong currency and wrong scoped cash call', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'USD',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaimCashCall.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reverses a receipt immutably and rejects duplicate reversal', async () => {
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue(receipt);
    prisma.placementClaimRecoveryReceipt.update.mockResolvedValue({
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    });
    prisma.placementClaimRecoveryReceipt.create.mockResolvedValue({
      ...receipt,
      id: 'receipt-reversal-1',
      reversalOfReceiptId: 'receipt-1',
    });

    await service.reverse(user, 'placement-1', 'claim-1', 'receipt-1', {
      notes: 'Correction',
    });

    expect(prisma.placementClaimRecoveryReceipt.update).toHaveBeenCalledWith({
      where: { id: 'receipt-1' },
      data: { status: PlacementClaimRecoveryReceiptStatus.REVERSED },
    });
    const createArgs =
      firstCallArg<Prisma.PlacementClaimRecoveryReceiptCreateArgs>(
        prisma.placementClaimRecoveryReceipt.create,
      );
    expect(createArgs.data).toMatchObject({
      status: PlacementClaimRecoveryReceiptStatus.RECORDED,
      reversalOfReceiptId: 'receipt-1',
    });
    expect((createArgs.data.amount as Prisma.Decimal).toString()).toBe('40000');
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue({
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    });

    await expect(
      service.reverse(user, 'placement-1', 'claim-1', 'receipt-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reversing a reversal receipt', async () => {
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue({
      ...receipt,
      reversalOfReceiptId: 'receipt-1',
    });

    await expect(
      service.reverse(user, 'placement-1', 'claim-1', 'receipt-reversal-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([PlacementClaimStatus.SETTLED, PlacementClaimStatus.CLOSED])(
    'blocks recovery receipt reversal when claim is %s',
    async (status) => {
      prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue(receipt);
      prisma.placementClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status,
      });

      await expect(
        service.reverse(user, 'placement-1', 'claim-1', 'receipt-1', {
          notes: 'Correction',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        prisma.placementClaimRecoveryReceipt.update,
      ).not.toHaveBeenCalled();
      expect(
        prisma.placementClaimRecoveryReceipt.create,
      ).not.toHaveBeenCalled();
    },
  );

  it('reverses bank-confirmed recovery receipts without Accounting outbox capture', async () => {
    const confirmedReceipt = {
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-07-30T12:00:00.000Z'),
      bankConfirmedByUserId: 'accountant-1',
      bankReference: 'BANK-CONF-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
    };
    const reversal = {
      ...confirmedReceipt,
      id: 'receipt-reversal-1',
      amount: new Prisma.Decimal('40000.00'),
      reversalOfReceiptId: 'receipt-1',
      createdByUserId: 'user-1',
    };
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue(
      confirmedReceipt,
    );
    prisma.placementClaimRecoveryReceipt.update.mockResolvedValue({
      ...confirmedReceipt,
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    });
    prisma.placementClaimRecoveryReceipt.create.mockResolvedValue(reversal);

    await service.reverse(user, 'placement-1', 'claim-1', 'receipt-1', {
      notes: 'Correction',
    });

    const createArgs =
      firstCallArg<Prisma.PlacementClaimRecoveryReceiptCreateArgs>(
        prisma.placementClaimRecoveryReceipt.create,
      );
    expect(createArgs.data).toMatchObject({
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      reversalOfReceiptId: 'receipt-1',
    });
  });

  it('builds recovery position totals independently per cash call', async () => {
    const reversedOriginal = {
      ...receipt,
      id: 'receipt-reversed-original',
      amount: new Prisma.Decimal('10000.00'),
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    };
    const reversalRow = {
      ...receipt,
      id: 'receipt-reversal',
      amount: new Prisma.Decimal('10000.00'),
      reversalOfReceiptId: 'receipt-reversed-original',
    };
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      {
        ...cashCall,
        recoveryReceipts: [receipt, reversedOriginal, reversalRow],
      },
      {
        ...cashCall,
        id: 'cash-call-2',
        allocationId: 'allocation-2',
        counterpartyId: 'reinsurer-2',
        amount: new Prisma.Decimal('35000.00'),
        counterparty: { ...counterparty, id: 'reinsurer-2', name: 'B Re' },
        allocation: {
          id: 'allocation-2',
          allocatedEstimatedLossAmount: new Prisma.Decimal('35000.00'),
          allocatedFinalLossAmount: null,
          recoveryApprovals: [
            {
              id: 'recovery-approval-2',
              approvedAmount: new Prisma.Decimal('35000.00'),
              currency: 'GHS',
              cashCallId: 'cash-call-2',
              counterpartyId: 'reinsurer-2',
            },
          ],
        },
        recoveryReceipts: [],
      },
    ]);

    const position = await service.getRecoveryPosition(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(position.recoveries).toEqual({
      totalAllocated: '135000.00',
      totalCashCalled: '135000.00',
      totalRecovered: '0.00',
      totalRecorded: '40000.00',
      totalConfirmed: '0.00',
      totalReversed: '10000.00',
      totalOutstanding: '135000.00',
    });
    expect(position.perCashCall).toHaveLength(2);
    expect(position.perCashCall[0]).toMatchObject({
      recoveredAmount: '0.00',
      recordedAmount: '40000.00',
      confirmedAmount: '0.00',
      reversedAmount: '10000.00',
      outstandingAmount: '100000.00',
      recoveryStatus: 'UNRECOVERED',
    });
    expect(position.perCashCall[1]).toMatchObject({
      recoveredAmount: '0.00',
      recordedAmount: '0.00',
      confirmedAmount: '0.00',
      outstandingAmount: '35000.00',
      recoveryStatus: 'UNRECOVERED',
    });
    expect(position.cedantSettlement).toEqual({
      approvedPayableAmount: null,
      settledAmount: '0.00',
      recordedAmount: '0.00',
      bankConfirmedAmount: '0.00',
      reversedAmount: '0.00',
      outstandingAmount: '0.00',
      operationalSettledAmount: '0.00',
      settlementStatus: 'PENDING_APPROVAL',
    });
  });

  it('excludes draft and void cash calls from active recovery outstanding totals', async () => {
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      {
        ...cashCall,
        status: PlacementClaimCashCallStatus.DRAFT,
      },
      {
        ...cashCall,
        id: 'cash-call-void',
        status: PlacementClaimCashCallStatus.VOID,
        recoveryReceipts: [
          {
            ...receipt,
            id: 'receipt-void-original',
            status: PlacementClaimRecoveryReceiptStatus.REVERSED,
          },
          {
            ...receipt,
            id: 'receipt-void-reversal',
            reversalOfReceiptId: 'receipt-void-original',
          },
        ],
      },
    ]);

    const position = await service.getRecoveryPosition(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(position.recoveries).toEqual({
      totalAllocated: '200000.00',
      totalCashCalled: '0.00',
      totalRecovered: '0.00',
      totalRecorded: '0.00',
      totalConfirmed: '0.00',
      totalReversed: '40000.00',
      totalOutstanding: '0.00',
    });
    expect(position.perCashCall).toEqual([
      expect.objectContaining({
        cashCallStatus: PlacementClaimCashCallStatus.DRAFT,
        outstandingAmount: '0.00',
        recoveryStatus: 'UNRECOVERED',
      }),
      expect.objectContaining({
        cashCallStatus: PlacementClaimCashCallStatus.VOID,
        outstandingAmount: '0.00',
        recoveryStatus: 'UNRECOVERED',
      }),
    ]);
  });

  it('uses only bank-confirmed recovery receipts for financial recovered and outstanding totals', async () => {
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      {
        ...cashCall,
        recoveryReceipts: [
          {
            ...receipt,
            id: 'receipt-recorded',
            amount: new Prisma.Decimal('25000.00'),
            status: PlacementClaimRecoveryReceiptStatus.RECORDED,
          },
          {
            ...receipt,
            id: 'receipt-confirmed',
            amount: new Prisma.Decimal('40000.00'),
            status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
            bankConfirmedAt: new Date('2026-07-30T12:00:00.000Z'),
          },
        ],
      },
    ]);

    const position = await service.getRecoveryPosition(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(position.recoveries).toMatchObject({
      totalRecovered: '40000.00',
      totalRecorded: '25000.00',
      totalConfirmed: '40000.00',
      totalOutstanding: '60000.00',
    });
    expect(position.perCashCall[0]).toMatchObject({
      recoveredAmount: '40000.00',
      recordedAmount: '25000.00',
      confirmedAmount: '40000.00',
      outstandingAmount: '60000.00',
      recoveryStatus: 'PARTIALLY_RECOVERED',
    });
  });

  it('reports cedant settlement independently from reinsurer recoveries', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue({
      id: 'claim-1',
      placementId: 'placement-1',
      currency: 'GHS',
      finalLossAmount: new Prisma.Decimal('120000.00'),
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      approvedAt: new Date('2026-07-29T09:00:00.000Z'),
      approvedByUserId: 'approver-1',
    });
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      {
        ...cashCall,
        recoveryReceipts: [receipt],
      },
    ]);
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('50000.00'),
        status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
        reversalOfSettlementId: null,
      },
      {
        amount: new Prisma.Decimal('10000.00'),
        status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
        reversalOfSettlementId: 'settlement-reversed',
      },
    ]);

    const position = await service.getRecoveryPosition(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(position.claim).toMatchObject({
      finalLossAmount: '120000.00',
      approvedPayableAmount: '90000.00',
      approvedByUserId: 'approver-1',
    });
    expect(position.cedantSettlement).toEqual({
      approvedPayableAmount: '90000.00',
      settledAmount: '50000.00',
      recordedAmount: '0.00',
      bankConfirmedAmount: '50000.00',
      reversedAmount: '10000.00',
      outstandingAmount: '40000.00',
      operationalSettledAmount: '50000.00',
      settlementStatus: 'PARTIALLY_SETTLED',
    });
    expect(position.funding).toEqual({
      brokerFundedExposure: '50000.00',
      recoveredMinusSettled: '0.00',
    });
  });
});
