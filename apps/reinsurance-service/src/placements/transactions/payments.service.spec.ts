import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementSettlementMethod,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementFinancialPositionService } from '../finance/financial-position.service';
import { PlacementPaymentsService } from './payments.service';

describe('PlacementPaymentsService', () => {
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
    permissions: [] as string[],
  };

  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    cedantId: 'cedant-1',
    currency: 'USD',
    reference: 'FAC-001',
    policyNumber: 'POL-001',
    title: 'Xpress Group',
  };

  const payment = {
    id: 'payment-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    closingId: null,
    endorsementClosingId: null,
    participantId: null,
    counterpartyId: 'cedant-1',
    type: PlacementPaymentType.PREMIUM_RECEIVED,
    direction: PlacementPaymentDirection.INBOUND,
    amount: new Prisma.Decimal('1000.00'),
    currency: 'USD',
    paymentDate: new Date('2026-06-04T12:00:00.000Z'),
    reference: 'BANK-001',
    settlementReference: null,
    bankReference: null,
    bankConfirmedAt: null,
    bankConfirmedByUserId: null,
    agreedExchangeRate: null,
    bankChargeAmount: new Prisma.Decimal('0.00'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    notes: null,
    status: PlacementPaymentStatus.RECORDED,
    reversalOfPaymentId: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-04T12:00:00.000Z'),
    updatedAt: new Date('2026-06-04T12:00:00.000Z'),
    counterparty: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Insurance',
      registrationNumber: null,
    },
    participant: null,
    closing: null,
    endorsementClosing: null,
    allocations: [],
  };

  const issuedCreditNote = (overrides: Record<string, unknown> = {}) => ({
    id: 'credit-note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'reinsurer-1',
    type: PlacementNoteType.CREDIT_NOTE,
    direction: PlacementNoteDirection.BROKER_TO_REINSURER,
    status: PlacementNoteStatus.ISSUED,
    currency: 'USD',
    netAmount: new Prisma.Decimal('500.00'),
    ...overrides,
  });

  let prisma: {
    placement: { findFirst: PrismaMethod };
    counterparty: { findFirst: PrismaMethod };
    placementNote: { findMany: PrismaMethod };
    placementClosing: { findFirst: PrismaMethod; findMany: PrismaMethod };
    placementEndorsementClosing: { findFirst: PrismaMethod };
    placementPayment: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      updateMany: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let financialPositionService: {
    getFinancialPosition: jest.Mock;
  };
  let financialEvents: {
    assertAccountingReadyForEvent: jest.Mock;
    preparePremiumPaymentReceived: jest.Mock<unknown, [unknown, unknown]>;
    preparePaymentReversed: jest.Mock<unknown, [unknown, unknown]>;
    prepareReinsurerDisbursementRecorded: jest.Mock<
      unknown,
      [unknown, unknown]
    >;
    prepareReinsurerDisbursementReversed: jest.Mock<
      unknown,
      [unknown, unknown]
    >;
    enqueuePreparedEvent: jest.Mock;
  };
  let service: PlacementPaymentsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      counterparty: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementNote: { findMany: jest.fn<Promise<unknown>, [unknown]>() },
      placementClosing: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
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
    financialPositionService = {
      getFinancialPosition: jest.fn().mockResolvedValue({
        currency: 'USD',
        isMultiCurrency: false,
        cedant: {
          currentObligation: 1000,
          outstanding: 1000,
        },
        reinsurers: [
          {
            counterpartyId: 'reinsurer-1',
            outstanding: 1000,
          },
        ],
      }),
    };
    financialEvents = {
      assertAccountingReadyForEvent: jest.fn().mockResolvedValue(undefined),
      preparePremiumPaymentReceived: jest
        .fn<unknown, [unknown, unknown]>()
        .mockReturnValue(null),
      preparePaymentReversed: jest
        .fn<unknown, [unknown, unknown]>()
        .mockReturnValue(null),
      prepareReinsurerDisbursementRecorded: jest
        .fn<unknown, [unknown, unknown]>()
        .mockReturnValue(null),
      prepareReinsurerDisbursementReversed: jest
        .fn<unknown, [unknown, unknown]>()
        .mockReturnValue(null),
      enqueuePreparedEvent: jest.fn(),
    };
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        id: 'closing-1',
        participantId: 'participant-1',
        netPremium: '1000.00',
        currency: 'USD',
      },
    ]);
    prisma.placementPayment.findMany.mockResolvedValue([]);
    service = new PlacementPaymentsService(
      prisma as unknown as PrismaService,
      financialPositionService as unknown as PlacementFinancialPositionService,
    );
  });

  it('lists payments for an active tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findMany.mockResolvedValue([payment]);

    const result = await service.findAll('tenant-1', 'placement-1');

    expect(prisma.placementPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', placementId: 'placement-1' },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('throws NotFoundException when listing payments for another tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findAll('tenant-1', 'unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('records a cedant premium receipt as RECORDED without an accounting event', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });
    prisma.placementPayment.create.mockResolvedValue(payment);

    const result = await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'usd',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        counterpartyId: 'cedant-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        amount: 1000,
        currency: 'USD',
        status: PlacementPaymentStatus.RECORDED,
      }),
    );
    expect(
      financialEvents.preparePremiumPaymentReceived,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
    expect(result.id).toBe('payment-1');
  });

  it('bank-confirms a recorded premium receipt without Accounting recognition', async () => {
    const recordedReceipt = {
      ...payment,
      settlementMethod: PlacementSettlementMethod.CHEQUE,
      settlementCurrency: 'USD',
      reference: 'CHQ-001',
      notes: 'Cheque payment',
    };
    const confirmedReceipt = {
      ...recordedReceipt,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-06-05T10:00:00.000Z'),
      bankConfirmedByUserId: 'user-1',
      bankReference: null,
      accountingCashAccountId: 'cash-account-1',
      notes: 'Cheque payment\nBank confirmation: Cheque cleared',
    };
    prisma.placement.findFirst.mockResolvedValueOnce({ id: 'placement-1' });
    prisma.placementPayment.findFirst
      .mockResolvedValueOnce(recordedReceipt)
      .mockResolvedValueOnce(confirmedReceipt);
    prisma.placementPayment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.confirmBankPayment(
      user,
      'placement-1',
      'payment-1',
      {
        bankConfirmedAt: '2026-06-05T10:00:00.000Z',
        accountingCashAccountId: 'cash-account-1',
        notes: 'Cheque cleared',
      },
    );

    const updateArgs = firstCallArg<Prisma.PlacementPaymentUpdateManyArgs>(
      prisma.placementPayment.updateMany,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      settlementMethod: PlacementSettlementMethod.CHEQUE,
      settlementCurrency: 'USD',
      bankReference: null,
      accountingCashAccountId: 'cash-account-1',
      notes: 'Cheque payment\nBank confirmation: Cheque cleared',
    });
    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.preparePremiumPaymentReceived,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
    expect(result.status).toBe(PlacementPaymentStatus.BANK_CONFIRMED);
  });

  it('bank-confirms a premium receipt even when retired Accounting readiness would fail', async () => {
    const recordedReceipt = {
      ...payment,
      settlementMethod: PlacementSettlementMethod.CHEQUE,
      settlementCurrency: 'USD',
      reference: 'CHQ-001',
    };
    const confirmedReceipt = {
      ...recordedReceipt,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-06-05T10:00:00.000Z'),
    };
    prisma.placement.findFirst.mockResolvedValueOnce({ id: 'placement-1' });
    prisma.placementPayment.findFirst
      .mockResolvedValueOnce(recordedReceipt)
      .mockResolvedValueOnce(confirmedReceipt);
    prisma.placementPayment.updateMany.mockResolvedValue({ count: 1 });
    financialEvents.assertAccountingReadyForEvent.mockRejectedValue(
      new ConflictException({
        code: 'ACCOUNTING_NOT_READY',
        blockers: [{ code: 'POSTING_RULE_MISSING' }],
      }),
    );

    await service.confirmBankPayment(user, 'placement-1', 'payment-1', {
      bankConfirmedAt: '2026-06-05T10:00:00.000Z',
    });

    expect(prisma.placementPayment.updateMany).toHaveBeenCalled();
    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.preparePremiumPaymentReceived,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('does not enqueue a premium received event when Accounting is disabled', async () => {
    const disabledUser = {
      ...user,
      moduleConfig: { operations: true, accounting: false },
    };
    financialEvents.preparePremiumPaymentReceived.mockReturnValue(null);
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementPayment.create.mockResolvedValue(payment);

    await service.create(disabledUser, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    expect(
      financialEvents.preparePremiumPaymentReceived,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects payment before any confirmed closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    financialPositionService.getFinancialPosition.mockResolvedValue({
      currency: 'USD',
      isMultiCurrency: false,
      cedant: {
        currentObligation: 0,
        outstanding: 0,
      },
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('records a cross-currency premium receipt for Accounting FX confirmation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      currency: 'GHS',
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'GHS',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      currency: 'GHS',
      status: PlacementPaymentStatus.RECORDED,
      bankConfirmedAt: null,
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects premium received from a non-cedant counterparty', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'other-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'other-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an operational reinsurer disbursement as a RECORDED original closing payment', async () => {
    const mockedOutboxEvents: unknown[] = [];
    financialEvents.enqueuePreparedEvent.mockImplementation((_tx, event) => {
      mockedOutboxEvents.push(event);
      return Promise.resolve(event);
    });
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({
      id: 'closing-1',
      participantId: 'participant-1',
      netPremium: new Prisma.Decimal('500.00'),
      currency: 'USD',
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-2',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 500,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      closingId: 'closing-1',
      participantId: 'participant-1',
      settlementReference: 'SETTLE-001',
      reference: 'PAY-001',
      notes: 'Operational settlement',
    });

    const closingLookup = firstCallArg<Prisma.PlacementClosingFindFirstArgs>(
      prisma.placementClosing.findFirst,
    );
    expect(closingLookup.where).toMatchObject({
      id: 'closing-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      status: PlacementClosingStatus.CONFIRMED,
      participant: { counterpartyId: 'reinsurer-1' },
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      status: PlacementPaymentStatus.RECORDED,
      reference: 'PAY-001',
      settlementReference: 'SETTLE-001',
      bankConfirmedAt: null,
      bankConfirmedByUserId: null,
    });
    expect(
      financialEvents.preparePremiumPaymentReceived,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareReinsurerDisbursementRecorded,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
    expect(mockedOutboxEvents).toEqual([]);
  });

  it('creates an operational reinsurer disbursement against an endorsement closing', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
      id: 'endorsement-closing-1',
      netPremium: new Prisma.Decimal('250.00'),
      currency: 'USD',
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 250,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      endorsementClosingId: 'endorsement-closing-1',
    });

    const endorsementClosingLookup =
      firstCallArg<Prisma.PlacementEndorsementClosingFindFirstArgs>(
        prisma.placementEndorsementClosing.findFirst,
      );
    expect(endorsementClosingLookup.where).toMatchObject({
      id: 'endorsement-closing-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      status: PlacementClosingStatus.CONFIRMED,
      endorsementParticipant: { counterpartyId: 'reinsurer-1' },
    });
    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      endorsementClosingId: 'endorsement-closing-1',
      status: PlacementPaymentStatus.RECORDED,
      bankConfirmedAt: null,
      bankConfirmedByUserId: null,
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects a mismatched participant for an original closing disbursement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({
      id: 'closing-1',
      participantId: 'participant-1',
      netPremium: new Prisma.Decimal('500.00'),
      currency: 'USD',
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
        closingId: 'closing-1',
        participantId: 'participant-2',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('allows allocations to be omitted during operational disbursement recording', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({
      id: 'closing-1',
      participantId: 'participant-1',
      netPremium: new Prisma.Decimal('500.00'),
      currency: 'USD',
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-disbursement-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 500,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      closingId: 'closing-1',
    });

    expect(prisma.placementNote.findMany).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('allows one operational reinsurer payment to include multiple issued credit-note allocations', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([
      issuedCreditNote(),
      issuedCreditNote({
        id: 'endorsement-credit-note-1',
        type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        netAmount: new Prisma.Decimal('250.00'),
      }),
    ]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-multi-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 750,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      allocations: [
        { noteId: 'credit-note-1', allocatedAmount: 500 },
        { noteId: 'endorsement-credit-note-1', allocatedAmount: 250 },
      ],
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    const create = createArgs.data as { allocations?: { create?: unknown[] } };
    expect(create.allocations?.create).toHaveLength(2);
  });

  it('persists the agreed exchange rate when payment currency differs from credit-note currency', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([
      issuedCreditNote({
        currency: 'EUR',
        netAmount: new Prisma.Decimal('80'),
      }),
    ]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-fx-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      currency: 'USD',
      status: PlacementPaymentStatus.RECORDED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 100,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      agreedExchangeRate: 1.25,
      allocations: [
        {
          noteId: 'credit-note-1',
          allocatedAmount: 100,
          obligationAmount: 80,
        },
      ],
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      agreedExchangeRate: 1.25,
      allocations: {
        create: [
          expect.objectContaining({
            allocatedCurrency: 'USD',
            obligationCurrency: 'EUR',
            agreedExchangeRate: new Prisma.Decimal('1.25'),
          }),
        ],
      },
    });
  });

  it('does not require bank confirmation during operational disbursement recording', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([issuedCreditNote()]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-allocation-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 500,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      allocations: [{ noteId: 'credit-note-1', allocatedAmount: 500 }],
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      status: PlacementPaymentStatus.RECORDED,
      bankConfirmedAt: null,
      bankConfirmedByUserId: null,
    });
  });

  it('lists recorded premium receipts and reinsurer disbursements pending Accounting financial confirmation', async () => {
    prisma.placementPayment.findMany.mockResolvedValue([
      {
        ...payment,
        id: 'pending-receipt-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        status: PlacementPaymentStatus.RECORDED,
      },
      {
        ...payment,
        id: 'pending-disbursement-1',
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        status: PlacementPaymentStatus.RECORDED,
      },
    ]);

    const result = await service.findPendingBankConfirmations('tenant-1');

    const listArgs = firstCallArg<Prisma.PlacementPaymentFindManyArgs>(
      prisma.placementPayment.findMany,
    );
    expect(listArgs.where).toMatchObject({
      tenantId: 'tenant-1',
      OR: [
        {
          type: PlacementPaymentType.PREMIUM_RECEIVED,
          direction: PlacementPaymentDirection.INBOUND,
        },
        {
          type: PlacementPaymentType.REINSURER_DISBURSEMENT,
          direction: PlacementPaymentDirection.OUTBOUND,
        },
      ],
      status: PlacementPaymentStatus.RECORDED,
      reversalOfPaymentId: null,
      placement: { archivedAt: null },
    });
    expect(result).toHaveLength(2);
  });

  it('bank-confirms a recorded reinsurer disbursement without Accounting recognition', async () => {
    const recordedDisbursement = {
      ...payment,
      id: 'payment-disbursement-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
      closingId: 'closing-1',
      participantId: 'participant-1',
      reference: 'PAY-001',
      notes: 'Operational settlement',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
    };
    const confirmedDisbursement = {
      ...recordedDisbursement,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-06-05T10:00:00.000Z'),
      bankConfirmedByUserId: 'user-1',
      bankReference: 'BANK-CONF-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'USD',
      agreedExchangeRate: new Prisma.Decimal('1.2'),
      bankChargeAmount: new Prisma.Decimal('25.00'),
      withholdingTaxAmount: new Prisma.Decimal('50.00'),
      notes: 'Operational settlement\nBank confirmation: Statement batch 42',
    };
    prisma.placement.findFirst.mockResolvedValueOnce({ id: 'placement-1' });
    prisma.placementPayment.findFirst
      .mockResolvedValueOnce(recordedDisbursement)
      .mockResolvedValueOnce(confirmedDisbursement);
    prisma.placementPayment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.confirmBankPayment(
      user,
      'placement-1',
      'payment-disbursement-1',
      {
        bankConfirmedAt: '2026-06-05T10:00:00.000Z',
        bankReference: 'BANK-CONF-001',
        accountingCashAccountId: 'cash-account-1',
        settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
        settlementCurrency: 'USD',
        confirmedExchangeRate: 1.2,
        bankChargeAmount: 25,
        notes: 'Statement batch 42',
      },
    );

    const updateArgs = firstCallArg<Prisma.PlacementPaymentUpdateManyArgs>(
      prisma.placementPayment.updateMany,
    );
    expect(updateArgs.where).toMatchObject({
      id: 'payment-disbursement-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      status: PlacementPaymentStatus.RECORDED,
    });
    expect(updateArgs.data).toMatchObject({
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankConfirmedByUserId: 'user-1',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'USD',
      bankReference: 'BANK-CONF-001',
      agreedExchangeRate: 1.2,
      bankChargeAmount: 25,
      notes: 'Operational settlement\nBank confirmation: Statement batch 42',
    });
    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareReinsurerDisbursementRecorded,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
    expect(result.status).toBe(PlacementPaymentStatus.BANK_CONFIRMED);
  });

  it('blocks cross-currency reinsurer confirmation when no persisted FX fact exists', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      id: 'payment-disbursement-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
      currency: 'USD',
      closingId: 'closing-1',
      agreedExchangeRate: null,
      closing: {
        id: 'closing-1',
        closingNumber: 'CLO-001',
        currency: 'GHS',
        netPremium: new Prisma.Decimal('1200.00'),
      },
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
    });

    await expect(
      service.confirmBankPayment(
        user,
        'placement-1',
        'payment-disbursement-1',
        {
          bankConfirmedAt: '2026-06-05T10:00:00.000Z',
          bankReference: 'BANK-CONF-001',
          accountingCashAccountId: 'cash-account-1',
          settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
          settlementCurrency: 'USD',
        },
      ),
    ).rejects.toThrow('requires a persisted agreed FX rate');
    expect(prisma.placementPayment.updateMany).not.toHaveBeenCalled();
  });

  it('blocks cross-currency premium receipt confirmation when no persisted FX fact exists', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      status: PlacementPaymentStatus.RECORDED,
      currency: 'GHS',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
      agreedExchangeRate: null,
      placement: {
        id: 'placement-1',
        reference: 'FAC-001',
        policyNumber: 'POL-001',
        title: 'Xpress Group',
        currency: 'USD',
      },
    });

    await expect(
      service.confirmBankPayment(user, 'placement-1', 'payment-1', {
        bankConfirmedAt: '2026-06-05T10:00:00.000Z',
        bankReference: 'BANK-CONF-001',
        accountingCashAccountId: 'cash-account-1',
      }),
    ).rejects.toThrow('requires a persisted agreed FX rate');
    expect(prisma.placementPayment.updateMany).not.toHaveBeenCalled();
  });

  it('allows internal-offset confirmation without a bank reference', async () => {
    const recordedDisbursement = {
      ...payment,
      id: 'payment-disbursement-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
      currency: 'USD',
      closingId: 'closing-1',
      reference: 'PAY-001',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce({ id: 'placement-1' })
      .mockResolvedValueOnce(placement);
    prisma.placementPayment.findFirst
      .mockResolvedValueOnce(recordedDisbursement)
      .mockResolvedValueOnce({
        ...recordedDisbursement,
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        settlementMethod: PlacementSettlementMethod.INTERNAL_OFFSET,
        settlementCurrency: 'USD',
        bankReference: null,
        bankConfirmedAt: new Date('2026-06-05T10:00:00.000Z'),
      });
    prisma.placementPayment.updateMany.mockResolvedValue({ count: 1 });

    await service.confirmBankPayment(
      user,
      'placement-1',
      'payment-disbursement-1',
      {
        bankConfirmedAt: '2026-06-05T10:00:00.000Z',
        settlementMethod: PlacementSettlementMethod.INTERNAL_OFFSET,
        settlementCurrency: 'USD',
        notes: 'Offset against cedant balance',
      },
    );

    const updateArgs = firstCallArg<Prisma.PlacementPaymentUpdateManyArgs>(
      prisma.placementPayment.updateMany,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      settlementMethod: PlacementSettlementMethod.INTERNAL_OFFSET,
      settlementCurrency: 'USD',
      bankReference: null,
    });
  });

  it('confirms cheque clearance without re-entering the operational cheque reference', async () => {
    const recordedDisbursement = {
      ...payment,
      id: 'payment-disbursement-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
      currency: 'GHS',
      settlementMethod: PlacementSettlementMethod.CHEQUE,
      settlementCurrency: 'GHS',
      closingId: 'closing-1',
      reference: 'CHQ-001',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce({ id: 'placement-1' })
      .mockResolvedValueOnce(placement);
    prisma.placementPayment.findFirst
      .mockResolvedValueOnce(recordedDisbursement)
      .mockResolvedValueOnce({
        ...recordedDisbursement,
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        bankReference: null,
        bankConfirmedAt: new Date('2026-06-05T10:00:00.000Z'),
      });
    prisma.placementPayment.updateMany.mockResolvedValue({ count: 1 });

    await service.confirmBankPayment(
      user,
      'placement-1',
      'payment-disbursement-1',
      {
        bankConfirmedAt: '2026-06-05T10:00:00.000Z',
        accountingCashAccountId: 'cash-account-1',
        notes: 'Cheque cleared',
      },
    );

    const updateArgs = firstCallArg<Prisma.PlacementPaymentUpdateManyArgs>(
      prisma.placementPayment.updateMany,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      settlementMethod: PlacementSettlementMethod.CHEQUE,
      settlementCurrency: 'GHS',
      bankReference: null,
    });
  });

  it('rejects confirmation attempts that change the operational settlement method', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      id: 'payment-disbursement-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
      currency: 'USD',
      settlementMethod: PlacementSettlementMethod.CHEQUE,
      settlementCurrency: 'USD',
      reference: 'CHQ-001',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
    });

    await expect(
      service.confirmBankPayment(
        user,
        'placement-1',
        'payment-disbursement-1',
        {
          bankConfirmedAt: '2026-06-05T10:00:00.000Z',
          settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
          bankReference: 'BANK-CONF-001',
          accountingCashAccountId: 'cash-account-1',
        },
      ),
    ).rejects.toThrow('cannot change the operational settlement method');
    expect(prisma.placementPayment.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    PlacementPaymentStatus.BANK_CONFIRMED,
    PlacementPaymentStatus.CANCELLED,
    PlacementPaymentStatus.FAILED,
    PlacementPaymentStatus.REVERSED,
  ])('rejects bank confirmation from %s status', async (status) => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      id: 'payment-disbursement-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status,
    });

    const promise = service.confirmBankPayment(
      user,
      'placement-1',
      'payment-disbursement-1',
      {
        bankConfirmedAt: '2026-06-05T10:00:00.000Z',
        bankReference: 'BANK-CONF-001',
        accountingCashAccountId: 'cash-account-1',
      },
    );

    if (status === PlacementPaymentStatus.BANK_CONFIRMED) {
      await expect(promise).rejects.toThrow(ConflictException);
    } else {
      await expect(promise).rejects.toThrow(BadRequestException);
    }
    expect(prisma.placementPayment.updateMany).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareReinsurerDisbursementRecorded,
    ).not.toHaveBeenCalled();
  });

  it('rejects reinsurer disbursements without a closing source or allocation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects premium received over the current effective outstanding amount', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    financialPositionService.getFinancialPosition.mockResolvedValue({
      currency: 'USD',
      isMultiCurrency: false,
      cedant: {
        currentObligation: 1500,
        outstanding: 300,
      },
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 400,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('uses the financial position as of the payment date when validating premium outstanding', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementPayment.create.mockResolvedValue(payment);

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    expect(financialPositionService.getFinancialPosition).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      new Date('2026-06-04T12:00:00.000Z'),
    );
  });

  it('allows additional premium after an effective endorsement increases the current obligation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    financialPositionService.getFinancialPosition.mockResolvedValue({
      currency: 'USD',
      isMultiCurrency: false,
      cedant: {
        currentObligation: 1200,
        outstanding: 200,
      },
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-additional-1',
      amount: new Prisma.Decimal('200.00'),
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 200,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    expect(prisma.placementPayment.create).toHaveBeenCalled();
  });

  it('allows reinsurer overpayment when the full amount is allocated for JV correction', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([
      issuedCreditNote({ netAmount: new Prisma.Decimal('500.00') }),
    ]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-overpay-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      amount: new Prisma.Decimal('575.00'),
      status: PlacementPaymentStatus.RECORDED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 575,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      allocations: [
        {
          noteId: 'credit-note-1',
          allocatedAmount: 575,
          obligationAmount: 575,
        },
      ],
    });

    expect(prisma.placementPayment.create).toHaveBeenCalled();
  });

  it('rejects wrong-tenant or mismatched credit-note allocations for reinsurer disbursement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([]);

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
        allocations: [{ noteId: 'wrong-note-1', allocatedAmount: 500 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects claim settlement payments through the generic payment creation API', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.CLAIM_SETTLEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('creates an auditable reversal record and marks the original reversed', async () => {
    const confirmedPayment = {
      ...payment,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-06-05T10:00:00.000Z'),
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(confirmedPayment);
    prisma.placementPayment.update.mockResolvedValue({
      ...confirmedPayment,
      status: PlacementPaymentStatus.REVERSED,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...confirmedPayment,
      id: 'payment-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
    });

    const result = await service.reverse(user, 'placement-1', 'payment-1');

    expect(prisma.placementPayment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PlacementPaymentStatus.REVERSED },
    });
    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
      status: PlacementPaymentStatus.RECORDED,
    });
    expect(result.reversalOfPaymentId).toBe('payment-1');
  });

  it('reverses a bank-confirmed premium receipt without Accounting capture', async () => {
    const confirmedPayment = {
      ...payment,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-06-05T10:00:00.000Z'),
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(confirmedPayment);
    prisma.placementPayment.update.mockResolvedValue({
      ...confirmedPayment,
      status: PlacementPaymentStatus.REVERSED,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...confirmedPayment,
      id: 'payment-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
    });

    await service.reverse(user, 'placement-1', 'payment-1');

    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(financialEvents.preparePaymentReversed).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects reversing a recorded premium receipt before financial confirmation', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(payment);

    await expect(
      service.reverse(user, 'placement-1', 'payment-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementPayment.update).not.toHaveBeenCalled();
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
    expect(financialEvents.preparePaymentReversed).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects reversing a recorded operational reinsurer disbursement before bank confirmation', async () => {
    const endorsementPayment = {
      ...payment,
      id: 'payment-endorsement-1',
      counterpartyId: 'reinsurer-c',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      closingId: null,
      endorsementClosingId: 'endorsement-closing-c',
      participantId: null,
      counterparty: {
        id: 'reinsurer-c',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(endorsementPayment);

    await expect(
      service.reverse(user, 'placement-1', 'payment-endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementPayment.update).not.toHaveBeenCalled();
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareReinsurerDisbursementReversed,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('preserves endorsement closing source when reversing a bank-confirmed reinsurer disbursement without Accounting capture', async () => {
    const endorsementPayment = {
      ...payment,
      id: 'payment-endorsement-1',
      counterpartyId: 'reinsurer-c',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      closingId: null,
      endorsementClosingId: 'endorsement-closing-c',
      participantId: null,
      counterparty: {
        id: 'reinsurer-c',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: null,
      },
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(endorsementPayment);
    prisma.placementPayment.update.mockResolvedValue({
      ...endorsementPayment,
      status: PlacementPaymentStatus.REVERSED,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...endorsementPayment,
      id: 'payment-endorsement-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      status: PlacementPaymentStatus.RECORDED,
      reversalOfPaymentId: 'payment-endorsement-1',
    });

    await service.reverse(user, 'placement-1', 'payment-endorsement-1');

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      closingId: null,
      endorsementClosingId: 'endorsement-closing-c',
      participantId: null,
      reversalOfPaymentId: 'payment-endorsement-1',
    });
    expect(
      financialEvents.assertAccountingReadyForEvent,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareReinsurerDisbursementReversed,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects reversing an already reversed payment', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.REVERSED,
    });

    await expect(
      service.reverse(user, 'placement-1', 'payment-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('cancels a recorded payment and appends the reason to notes', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({ ...payment });
    prisma.placementPayment.update.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.CANCELLED,
    });

    await service.cancel(user, 'placement-1', 'payment-1', {
      reason: 'Wrong amount',
    });

    const updateArgs = firstCallArg<Prisma.PlacementPaymentUpdateArgs>(
      prisma.placementPayment.update,
    );
    expect(updateArgs.where).toEqual({ id: 'payment-1' });
    expect(updateArgs.data).toMatchObject({
      status: PlacementPaymentStatus.CANCELLED,
      notes: 'Cancelled: Wrong amount',
    });
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('rejects cancelling a bank-confirmed payment', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });

    await expect(
      service.cancel(user, 'placement-1', 'payment-1', {}),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementPayment.update).not.toHaveBeenCalled();
  });

  it('rejects cancelling a reversal payment', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      reversalOfPaymentId: 'payment-0',
    });

    await expect(
      service.cancel(user, 'placement-1', 'payment-1', {}),
    ).rejects.toThrow(BadRequestException);
  });
});
