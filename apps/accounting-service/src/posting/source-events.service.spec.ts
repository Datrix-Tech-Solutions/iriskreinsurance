import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CashbookDirection,
  FiscalPeriodStatus,
  PostingDirection,
  Prisma,
  RecordStatus,
  SourceEventStatus,
  SubledgerType,
} from '../../prisma/generated/client';
import { CashbookService } from '../ledger/cashbook.service';
import { JournalsService } from '../ledger/journals.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceEventDto } from './dto/posting.dto';
import { SourceEventsService } from './source-events.service';

describe('SourceEventsService', () => {
  const actor = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'accountant@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Amina',
    moduleConfig: { accounting: true },
    featureConfig: {},
    permissions: [],
  } as RequestUser;

  const activeSubledger = (id: string, currency = 'GHS') => ({
    id,
    status: RecordStatus.ACTIVE,
    currency,
  });

  const subledgerCreateData = (
    mock: jest.Mock<
      Promise<{ id: string }>,
      [{ data: Record<string, unknown> }]
    >,
  ) => mock.mock.calls[0]?.[0].data;

  const dto: CreateSourceEventDto = {
    sourceModule: 'OPERATIONS',
    sourceEventType: 'RECEIPT_ISSUED',
    sourceRecordId: 'receipt-1',
    sourceDocumentId: 'document-1',
    idempotencyKey: 'operations:receipt-1:issued:v1',
    payload: {
      transactionDate: '2026-07-05T10:00:00.000Z',
      currency: 'GHS',
      amounts: { receivable: 100, revenue: 100 },
      counterparty: { id: 'customer-1' },
      reference: 'RCPT-001',
    },
  };

  const rule = {
    id: 'rule-1',
    tenantId: actor.tenantId,
    name: 'Receipt issued',
    sourceModule: dto.sourceModule,
    sourceEventType: dto.sourceEventType,
    version: 1,
    active: true,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    createdByUserId: actor.id,
    updatedByUserId: actor.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'rule-line-1',
        tenantId: actor.tenantId,
        postingRuleId: 'rule-1',
        sequence: 1,
        direction: PostingDirection.DR,
        glAccountId: 'receivable-account',
        subledgerType: null,
        subledgerExternalRefSource: null,
        amountSource: 'amounts.receivable',
        currencySource: 'currency',
        descriptionTemplate:
          'Receivable {{payload.reference}} for {{sourceRecordId}}',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule-line-2',
        tenantId: actor.tenantId,
        postingRuleId: 'rule-1',
        sequence: 2,
        direction: PostingDirection.CR,
        glAccountId: 'revenue-account',
        subledgerType: null,
        subledgerExternalRefSource: null,
        amountSource: 'amounts.revenue',
        currencySource: 'currency',
        descriptionTemplate: 'Revenue {{payload.reference}}',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  function setup(
    initialStatus: SourceEventStatus = SourceEventStatus.RECEIVED,
    seedDto: CreateSourceEventDto = dto,
  ) {
    const event = {
      id: 'event-1',
      tenantId: actor.tenantId,
      sourceModule: seedDto.sourceModule,
      sourceEventType: seedDto.sourceEventType,
      sourceRecordId: seedDto.sourceRecordId,
      sourceDocumentId: seedDto.sourceDocumentId ?? null,
      idempotencyKey: seedDto.idempotencyKey,
      payload: seedDto.payload as Prisma.JsonObject,
      status: initialStatus,
      failureReason:
        initialStatus === SourceEventStatus.FAILED ? 'Previous failure' : null,
      postingRuleId: null as string | null,
      journalEntryId: null as string | null,
      retryCount: 0,
      receivedByUserId: actor.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null as Date | null,
    };
    const journal = {
      id: 'journal-1',
      journalNumber: 'AUTO-001',
      status: 'POSTED',
    };

    const sourceEventInbox = {
      create: jest.fn().mockImplementation(() => {
        event.status = SourceEventStatus.RECEIVED;
        return { ...event };
      }),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            id?: string;
            tenantId?: string;
            status?: SourceEventStatus;
          };
        }) => {
          if (
            where.id === event.id &&
            where.tenantId === event.tenantId &&
            (!where.status || where.status === event.status)
          ) {
            return { ...event };
          }
          return null;
        },
      ),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn().mockImplementation(() => ({ ...event })),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(event, data);
          return { ...event };
        }),
      updateMany: jest.fn().mockImplementation(
        ({
          where,
          data,
        }: {
          where: {
            id?: string;
            tenantId?: string;
            status?: SourceEventStatus;
          };
          data: Record<string, unknown> & {
            retryCount?: { increment: number };
          };
        }) => {
          if (
            where.id !== event.id ||
            where.tenantId !== event.tenantId ||
            (where.status && where.status !== event.status)
          ) {
            return { count: 0 };
          }
          if (data.retryCount?.increment) {
            event.retryCount += data.retryCount.increment;
          }
          Object.assign(event, {
            ...data,
            retryCount: event.retryCount,
          });
          return { count: 1 };
        },
      ),
    };
    const prisma = {
      sourceEventInbox,
      postingRule: {
        findFirst: jest.fn().mockResolvedValue(rule),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          tenantId: actor.tenantId,
          status: FiscalPeriodStatus.OPEN,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: new Date('2026-07-31T23:59:59.999Z'),
        }),
      },
      subledgerAccount: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'created-subledger-1' }),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    const journals = {
      createPostedInTransaction: jest.fn().mockResolvedValue(journal),
    };
    const cashbook = {
      createPostedSourceEventTransactionInTransaction: jest
        .fn()
        .mockResolvedValue({
          transaction: { id: 'cashbook-1' },
          journal,
        }),
    };
    const service = new SourceEventsService(
      prisma as unknown as PrismaService,
      cashbook as unknown as CashbookService,
      journals as unknown as JournalsService,
    );
    return { cashbook, event, journal, journals, prisma, service };
  }

  it('generates and posts a balanced journal from the active rule', async () => {
    const { event, journals, service } = setup();

    const result = await service.receive(actor, dto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.journalEntryId).toBe('journal-1');
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        transactionCurrency: 'GHS',
        fiscalPeriodId: 'period-1',
        idempotencyKey: 'source-event:event-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'receivable-account',
            debit: 100,
            credit: 0,
            description: 'Receivable RCPT-001 for receipt-1',
          }),
          expect.objectContaining({
            glAccountId: 'revenue-account',
            debit: 0,
            credit: 100,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE DEBIT_NOTE_ISSUED using the cedant subledger reference', async () => {
    const reinsuranceDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          noteNumber: 'DN-001',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: { netPremium: 8550 },
      },
    };
    const reinsuranceRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
          descriptionTemplate:
            'Debit note {{payload.references.noteNumber}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'premium-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
          descriptionTemplate:
            'Premium clearing {{payload.references.noteNumber}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      reinsuranceDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(reinsuranceRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('cedant-subledger-1'),
    );

    const result = await service.receive(actor, reinsuranceDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        controlAccountId: 'cedant-premium-receivable',
      },
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'DEBIT_NOTE_ISSUED',
        sourceRecordId: 'note-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 8550,
            credit: 0,
            description: 'Debit note DN-001 for FAC-2026-001',
          }),
          expect.objectContaining({
            glAccountId: 'premium-clearing',
            debit: 0,
            credit: 8550,
          }),
        ],
      }),
    );
  });

  it('bridges bank-confirmed premium receipts into Cashbook with the posting-rule counter leg', async () => {
    const paymentDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementReference: 'FAC-2026-001',
          paymentReference: 'PAY-001',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          paymentAmount: 8500,
          signedCashImpact: 8500,
          signedReceivableImpact: -8500,
          cashAffectingSettlement: true,
        },
        payment: {
          method: 'BANK_TRANSFER',
          settlementCurrency: 'GHS',
          accountingCashAccountId: 'cash-account-1',
        },
      },
    };
    const paymentRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'legacy-bank-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate: 'Legacy cash leg',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Clear cedant receivable {{payload.references.paymentReference}}',
        },
      ],
    };
    const { cashbook, event, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      paymentDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(paymentRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('cedant-subledger-1'),
    );

    const result = await service.receive(actor, paymentDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.journalEntryId).toBe('journal-1');
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
    expect(
      cashbook.createPostedSourceEventTransactionInTransaction,
    ).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceEventInboxId: event.id,
        sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
        cashAccountId: 'cash-account-1',
        direction: CashbookDirection.INFLOW,
        amount: 8500,
        counterLines: [
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 0,
            credit: 8500,
          }),
        ],
      }),
    );
  });

  it('fails cash-impact source events that do not include an Accounting cash account', async () => {
    const paymentDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          paymentId: 'payment-1',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          paymentAmount: 8500,
          signedCashImpact: 8500,
          cashAffectingSettlement: true,
        },
        payment: { method: 'BANK_TRANSFER', settlementCurrency: 'GHS' },
      },
    };
    const paymentRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'legacy-bank-clearing',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Premium payment {{payload.references.paymentId}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Clear cedant receivable {{payload.references.paymentId}}',
        },
      ],
    };
    const { cashbook, event, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      paymentDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(paymentRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('cedant-subledger-1'),
    );

    const result = await service.receive(actor, paymentDto);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toContain(
      'requires an Accounting cashAccountId',
    );
    expect(
      cashbook.createPostedSourceEventTransactionInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('does not create Cashbook rows for non-cash internal offset events', async () => {
    const paymentDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          paymentId: 'payment-1',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          paymentAmount: 8500,
          signedCashImpact: 0,
          cashAffectingSettlement: false,
        },
        payment: { method: 'INTERNAL_OFFSET', settlementCurrency: 'GHS' },
      },
    };
    const { cashbook, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      paymentDto,
    );
    const internalOffsetRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'premium-clearing',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Internal offset {{payload.references.paymentId}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Clear cedant receivable {{payload.references.paymentId}}',
        },
      ],
    };
    prisma.postingRule.findFirst.mockResolvedValue(internalOffsetRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('cedant-subledger-1'),
    );

    const result = await service.receive(actor, paymentDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).toHaveBeenCalled();
    expect(
      cashbook.createPostedSourceEventTransactionInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('fails REINSURANCE DEBIT_NOTE_ISSUED cleanly when the control-account dimension is inactive', async () => {
    const reinsuranceDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: { netPremium: 8550 },
      },
    };
    const reinsuranceRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
        },
        {
          ...rule.lines[1],
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
        },
      ],
    };
    const { event, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      reinsuranceDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(reinsuranceRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'cedant-subledger-1',
      status: RecordStatus.INACTIVE,
      currency: 'GHS',
    });

    const result = await service.receive(actor, reinsuranceDto);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'CEDANT subledger for control account receivable-account is inactive',
    );
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('posts REINSURANCE CREDIT_NOTE_ISSUED using tenant-configured policy and reinsurer subledger', async () => {
    const creditNoteDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CREDIT_NOTE_ISSUED',
      sourceRecordId: 'credit-note-1',
      sourceDocumentId: 'credit-note-1',
      idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          closingId: 'closing-1',
          noteNumber: 'CN-001',
        },
        counterparty: { id: 'reinsurer-1', type: 'REINSURER' },
        amounts: {
          creditMagnitude: 3712.5,
          signedReceivableImpact: 0,
          signedPayableImpact: 3712.5,
        },
      },
    };
    const creditNoteRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CREDIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'premium-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.creditMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Credit note {{payload.references.noteNumber}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'reinsurer-premium-payable',
          subledgerType: SubledgerType.REINSURER,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.creditMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Reinsurer credit {{payload.references.noteNumber}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      creditNoteDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(creditNoteRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('reinsurer-subledger-1'),
    );

    const result = await service.receive(actor, creditNoteDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'reinsurer-premium-payable',
      },
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'CREDIT_NOTE_ISSUED',
        sourceRecordId: 'credit-note-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'premium-clearing',
            debit: 3712.5,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'reinsurer-premium-payable',
            subledgerAccountId: 'reinsurer-subledger-1',
            debit: 0,
            credit: 3712.5,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE ENDORSEMENT_DEBIT_NOTE_ISSUED as a tenant-configured additional premium event', async () => {
    const endorsementDebitDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
      sourceRecordId: 'endorsement-debit-note-1',
      sourceDocumentId: 'endorsement-debit-note-1',
      idempotencyKey:
        'reinsurance:endorsement-debit-note:endorsement-debit-note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          endorsementId: 'endorsement-1',
          endorsementReference: 'END-001',
          noteNumber: 'EDN-001',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          adjustmentMagnitude: 2500,
          signedReceivableImpact: 2500,
          signedPayableImpact: 0,
        },
      },
    };
    const endorsementDebitRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.adjustmentMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Endorsement debit note {{payload.references.noteNumber}} for {{payload.references.endorsementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'premium-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.adjustmentMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Endorsement premium clearing {{payload.references.noteNumber}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      endorsementDebitDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(endorsementDebitRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('cedant-subledger-1'),
    );

    const result = await service.receive(actor, endorsementDebitDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        controlAccountId: 'cedant-premium-receivable',
      },
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
        sourceRecordId: 'endorsement-debit-note-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 2500,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'premium-clearing',
            debit: 0,
            credit: 2500,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE ENDORSEMENT_CREDIT_NOTE_ISSUED as a tenant-configured return-premium event', async () => {
    const endorsementCreditDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
      sourceRecordId: 'endorsement-credit-note-1',
      sourceDocumentId: 'endorsement-credit-note-1',
      idempotencyKey:
        'reinsurance:endorsement-credit-note:endorsement-credit-note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          endorsementId: 'endorsement-1',
          endorsementReference: 'END-001',
          endorsementClosingId: 'endorsement-closing-1',
          noteNumber: 'ECN-001',
        },
        counterparty: { id: 'reinsurer-1', type: 'REINSURER' },
        amounts: {
          returnPremiumMagnitude: 1800,
          adjustmentMagnitude: 1800,
          signedReceivableImpact: 0,
          signedPayableImpact: 1800,
        },
      },
    };
    const endorsementCreditRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'premium-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.returnPremiumMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Endorsement credit note {{payload.references.noteNumber}} for {{payload.references.endorsementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'reinsurer-premium-payable',
          subledgerType: SubledgerType.REINSURER,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.returnPremiumMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Endorsement return premium {{payload.references.noteNumber}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      endorsementCreditDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(endorsementCreditRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('reinsurer-subledger-1'),
    );

    const result = await service.receive(actor, endorsementCreditDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'reinsurer-premium-payable',
      },
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
        sourceRecordId: 'endorsement-credit-note-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'premium-clearing',
            debit: 1800,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'reinsurer-premium-payable',
            subledgerAccountId: 'reinsurer-subledger-1',
            debit: 0,
            credit: 1800,
          }),
        ],
      }),
    );
  });

  it('creates a separate Reinsurer Claims AR subledger dimension from the posting-rule control account', async () => {
    const recoveryDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CLAIM_RECOVERY_APPROVED',
      sourceRecordId: 'claim-recovery-approval-1',
      sourceDocumentId: 'claim-recovery-approval-1',
      idempotencyKey:
        'reinsurance:claim-recovery-approval:claim-recovery-approval-1:approved:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          claimReference: 'CLM-2026-001',
          approvalReference: 'CRA-001',
        },
        counterparty: {
          id: 'reinsurer-1',
          type: 'REINSURER',
          name: 'Reinsurer A',
        },
        amounts: {
          recoveryAmount: 100,
          signedReceivableImpact: 100,
        },
      },
    };
    const recoveryRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CLAIM_RECOVERY_APPROVED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'reinsurer-claims-receivable',
          subledgerType: SubledgerType.REINSURER,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.recoveryAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Claim recovery {{payload.references.approvalReference}} for {{payload.references.claimReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'claims-recovery-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.recoveryAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Claims recovery clearing {{payload.references.approvalReference}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      recoveryDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(recoveryRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(null);
    prisma.subledgerAccount.create.mockResolvedValue({
      id: 'reinsurer-claims-ar-subledger-1',
    });

    const result = await service.receive(actor, recoveryDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'reinsurer-claims-receivable',
      },
    });
    expect(
      subledgerCreateData(
        prisma.subledgerAccount.create as jest.Mock<
          Promise<{ id: string }>,
          [{ data: Record<string, unknown> }]
        >,
      ),
    ).toMatchObject({
      tenantId: actor.tenantId,
      type: SubledgerType.REINSURER,
      externalRef: 'reinsurer-1',
      name: 'Reinsurer A',
      controlAccountId: 'reinsurer-claims-receivable',
      currency: 'GHS',
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'CLAIM_RECOVERY_APPROVED',
        sourceRecordId: 'claim-recovery-approval-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'reinsurer-claims-receivable',
            subledgerAccountId: 'reinsurer-claims-ar-subledger-1',
            debit: 100,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'claims-recovery-clearing',
            debit: 0,
            credit: 100,
          }),
        ],
      }),
    );
  });

  it('creates a separate Cedant Claims AP subledger dimension from the posting-rule control account', async () => {
    const payableDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CLAIM_PAYABLE_APPROVED',
      sourceRecordId: 'claim-payable-approval-1',
      sourceDocumentId: 'claim-payable-approval-1',
      idempotencyKey:
        'reinsurance:claim-payable-approval:claim-payable-approval-1:approved:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          claimReference: 'CLM-2026-001',
          approvalReference: 'CPA-001',
        },
        counterparty: {
          id: 'cedant-1',
          type: 'CEDANT',
          name: 'Cedant A',
        },
        amounts: {
          approvedPayableAmount: 90,
          signedPayableImpact: 90,
        },
      },
    };
    const payableRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CLAIM_PAYABLE_APPROVED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'claims-expense',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.approvedPayableAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Claim payable {{payload.references.approvalReference}} expense',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'cedant-claims-payable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.approvedPayableAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Claim payable {{payload.references.approvalReference}} for {{payload.references.claimReference}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      payableDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(payableRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(null);
    prisma.subledgerAccount.create.mockResolvedValue({
      id: 'cedant-claims-ap-subledger-1',
    });

    const result = await service.receive(actor, payableDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        controlAccountId: 'cedant-claims-payable',
      },
    });
    expect(
      subledgerCreateData(
        prisma.subledgerAccount.create as jest.Mock<
          Promise<{ id: string }>,
          [{ data: Record<string, unknown> }]
        >,
      ),
    ).toMatchObject({
      tenantId: actor.tenantId,
      type: SubledgerType.CEDANT,
      externalRef: 'cedant-1',
      name: 'Cedant A',
      controlAccountId: 'cedant-claims-payable',
      currency: 'GHS',
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'CLAIM_PAYABLE_APPROVED',
        lines: [
          expect.objectContaining({
            glAccountId: 'claims-expense',
            debit: 90,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'cedant-claims-payable',
            subledgerAccountId: 'cedant-claims-ap-subledger-1',
            debit: 0,
            credit: 90,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE PREMIUM_PAYMENT_RECEIVED using tenant-configured cash and receivable accounts', async () => {
    const paymentDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          paymentId: 'payment-1',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          paymentAmount: 8500,
          signedCashImpact: 8500,
          signedReceivableImpact: -8500,
        },
        payment: {
          method: 'BANK_TRANSFER',
          settlementCurrency: 'GHS',
          accountingCashAccountId: 'cash-account-1',
        },
      },
    };
    const paymentRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'bank-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Premium payment {{payload.references.paymentId}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Clear cedant receivable {{payload.references.paymentId}}',
        },
      ],
    };
    const { cashbook, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      paymentDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(paymentRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('cedant-subledger-1'),
    );

    const result = await service.receive(actor, paymentDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
    expect(
      cashbook.createPostedSourceEventTransactionInTransaction,
    ).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceEventInboxId: 'event-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
        sourceRecordId: 'payment-1',
        cashAccountId: 'cash-account-1',
        direction: CashbookDirection.INFLOW,
        amount: 8500,
        currency: 'GHS',
        counterLines: [
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 0,
            credit: 8500,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE PAYMENT_REVERSED as a separate reversing journal', async () => {
    const reversalDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PAYMENT_REVERSED',
      sourceRecordId: 'payment-reversal-1',
      sourceDocumentId: 'payment-reversal-1',
      idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
      payload: {
        transactionDate: '2026-07-06T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          originalPaymentId: 'payment-1',
          reversalPaymentId: 'payment-reversal-1',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          paymentAmount: 8500,
          signedCashImpact: -8500,
          signedReceivableImpact: 8500,
        },
        payment: {
          method: 'BANK_TRANSFER',
          settlementCurrency: 'GHS',
          accountingCashAccountId: 'cash-account-1',
        },
      },
    };
    const reversalRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PAYMENT_REVERSED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Reverse payment {{payload.references.reversalPaymentId}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'bank-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Reverse cash {{payload.references.originalPaymentId}}',
        },
      ],
    };
    const { cashbook, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      reversalDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(reversalRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('cedant-subledger-1'),
    );

    const result = await service.receive(actor, reversalDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
    expect(
      cashbook.createPostedSourceEventTransactionInTransaction,
    ).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceEventInboxId: 'event-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'PAYMENT_REVERSED',
        sourceRecordId: 'payment-reversal-1',
        cashAccountId: 'cash-account-1',
        direction: CashbookDirection.OUTFLOW,
        amount: 8500,
        currency: 'GHS',
        counterLines: [
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 8500,
            credit: 0,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE REINSURER_DISBURSEMENT_RECORDED using tenant-configured payable and cash accounts', async () => {
    const disbursementDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
      sourceRecordId: 'payment-disbursement-1',
      sourceDocumentId: 'payment-disbursement-1',
      idempotencyKey:
        'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
      payload: {
        transactionDate: '2026-07-07T10:00:00.000Z',
        currency: 'USD',
        exchangeRate: 12.5,
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          paymentId: 'payment-disbursement-1',
          settlementReference: 'SETTLE-001',
        },
        counterparty: { id: 'reinsurer-1', type: 'REINSURER' },
        amounts: {
          paymentAmount: 750,
          allocatedAmount: 750,
          unallocatedAmount: 0,
          bankCharges: 12.5,
          withholdingTax: 25,
          signedCashImpact: -750,
          signedPayableImpact: -750,
        },
        payment: {
          method: 'BANK_TRANSFER',
          settlementCurrency: 'USD',
          accountingCashAccountId: 'cash-account-1',
        },
        allocations: [
          {
            allocationId: 'allocation-1',
            creditNoteId: 'credit-note-1',
            creditNoteNumber: 'CN-001',
            obligationType: 'CREDIT_NOTE',
            obligationCurrency: 'USD',
            allocatedAmount: 500,
            paymentCurrencyAmount: 500,
          },
          {
            allocationId: 'allocation-2',
            creditNoteId: 'endorsement-credit-note-1',
            creditNoteNumber: 'ECN-001',
            obligationType: 'ENDORSEMENT_CREDIT_NOTE',
            obligationCurrency: 'GHS',
            allocatedAmount: 3125,
            paymentCurrencyAmount: 250,
            agreedExchangeRate: 12.5,
          },
        ],
      },
    };
    const disbursementRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'reinsurer-premium-payable',
          subledgerType: SubledgerType.REINSURER,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.allocatedAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Clear reinsurer payable {{payload.references.paymentId}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'bank-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.allocatedAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Bank-confirmed reinsurer payment {{payload.references.paymentId}}',
        },
      ],
    };
    const { cashbook, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      disbursementDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(disbursementRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('reinsurer-subledger-1', 'USD'),
    );

    const result = await service.receive(actor, disbursementDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'reinsurer-premium-payable',
      },
    });
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
    expect(
      cashbook.createPostedSourceEventTransactionInTransaction,
    ).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceEventInboxId: 'event-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
        sourceRecordId: 'payment-disbursement-1',
        cashAccountId: 'cash-account-1',
        direction: CashbookDirection.OUTFLOW,
        amount: 750,
        currency: 'USD',
        exchangeRate: 12.5,
        counterLines: [
          expect.objectContaining({
            glAccountId: 'reinsurer-premium-payable',
            subledgerAccountId: 'reinsurer-subledger-1',
            debit: 750,
            credit: 0,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE REINSURER_DISBURSEMENT_REVERSED as the reversing payable and cash journal', async () => {
    const reversalDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'REINSURER_DISBURSEMENT_REVERSED',
      sourceRecordId: 'payment-disbursement-reversal-1',
      sourceDocumentId: 'payment-disbursement-reversal-1',
      idempotencyKey:
        'reinsurance:reinsurer-disbursement:payment-disbursement-reversal-1:reversal:v1',
      payload: {
        transactionDate: '2026-07-08T10:00:00.000Z',
        currency: 'USD',
        exchangeRate: 12.5,
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          originalPaymentId: 'payment-disbursement-1',
          reversalPaymentId: 'payment-disbursement-reversal-1',
          paymentId: 'payment-disbursement-reversal-1',
          settlementReference: 'REVERSAL-SETTLE-001',
        },
        counterparty: { id: 'reinsurer-1', type: 'REINSURER' },
        amounts: {
          paymentAmount: 750,
          allocatedAmount: 750,
          bankCharges: 12.5,
          withholdingTax: 25,
          signedCashImpact: 750,
          signedPayableImpact: 750,
        },
        payment: {
          method: 'BANK_TRANSFER',
          settlementCurrency: 'USD',
          accountingCashAccountId: 'cash-account-1',
        },
        allocations: [
          {
            allocationId: 'allocation-1-reversal',
            creditNoteId: 'credit-note-1',
            creditNoteNumber: 'CN-001',
            obligationType: 'CREDIT_NOTE',
            obligationCurrency: 'USD',
            allocatedAmount: 500,
            paymentCurrencyAmount: 500,
          },
          {
            allocationId: 'allocation-2-reversal',
            creditNoteId: 'endorsement-credit-note-1',
            creditNoteNumber: 'ECN-001',
            obligationType: 'ENDORSEMENT_CREDIT_NOTE',
            obligationCurrency: 'GHS',
            allocatedAmount: 3125,
            paymentCurrencyAmount: 250,
            agreedExchangeRate: 12.5,
          },
        ],
      },
    };
    const reversalRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'REINSURER_DISBURSEMENT_REVERSED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'bank-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.allocatedAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Reverse bank-confirmed reinsurer payment {{payload.references.originalPaymentId}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'reinsurer-premium-payable',
          subledgerType: SubledgerType.REINSURER,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.allocatedAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Restore reinsurer payable {{payload.references.reversalPaymentId}} for {{payload.references.placementReference}}',
        },
      ],
    };
    const { cashbook, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      reversalDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(reversalRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(
      activeSubledger('reinsurer-subledger-1', 'USD'),
    );

    const result = await service.receive(actor, reversalDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
    expect(
      cashbook.createPostedSourceEventTransactionInTransaction,
    ).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceEventInboxId: 'event-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'REINSURER_DISBURSEMENT_REVERSED',
        sourceRecordId: 'payment-disbursement-reversal-1',
        cashAccountId: 'cash-account-1',
        direction: CashbookDirection.INFLOW,
        amount: 750,
        currency: 'USD',
        exchangeRate: 12.5,
        counterLines: [
          expect.objectContaining({
            glAccountId: 'reinsurer-premium-payable',
            subledgerAccountId: 'reinsurer-subledger-1',
            debit: 0,
            credit: 750,
          }),
        ],
      }),
    );
  });

  it('rejects a duplicate tenant idempotency key safely', async () => {
    const { prisma, service } = setup();
    prisma.sourceEventInbox.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );
    prisma.sourceEventInbox.findUnique.mockResolvedValue({
      id: 'existing-event',
      status: SourceEventStatus.POSTED,
    });

    try {
      await service.receive(actor, dto);
      fail('Expected duplicate idempotency conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const response = (error as ConflictException).getResponse();
      expect(response).toMatchObject({
        message: 'Source event idempotency key already exists',
        sourceEventId: 'existing-event',
      });
    }
  });

  it('marks an event failed when no posting rule is configured', async () => {
    const { event, journals, prisma, service } = setup();
    prisma.postingRule.findFirst.mockResolvedValue(null);

    const result = await service.receive(actor, dto);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'No posting rule is configured for this source event',
    );
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('distinguishes an inactive posting rule', async () => {
    const { event, prisma, service } = setup();
    prisma.postingRule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...rule, active: false, lines: undefined });

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'No active posting rule is available for this source event',
    );
  });

  it('distinguishes a rule outside its effective dates', async () => {
    const { event, prisma, service } = setup();
    prisma.postingRule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...rule, lines: undefined });

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'No posting rule is effective for the source event transaction date',
    );
  });

  it('does not leave a journal when account validation fails', async () => {
    const { event, journals, service } = setup();
    journals.createPostedInTransaction.mockRejectedValue(
      new BadRequestException('Invalid posting account'),
    );

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe('Invalid posting account');
    expect(event.journalEntryId).toBeNull();
  });

  it('rejects a source event in a closed fiscal period', async () => {
    const { event, journals, prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.CLOSED,
    });

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'Cannot post source event into a closed fiscal period',
    );
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('scopes event detail to the requesting tenant', async () => {
    const { prisma, service } = setup();

    await service.findOne(actor.tenantId, 'event-1');

    expect(prisma.sourceEventInbox.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1', tenantId: actor.tenantId },
      }),
    );
  });

  it('retries a failed event and posts it once', async () => {
    const { event, service } = setup(SourceEventStatus.FAILED);

    const result = await service.retry(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.retryCount).toBe(1);
    expect(event.failureReason).toBeNull();
  });

  it('returns a failed status when retry processing fails again', async () => {
    const { event, journals, service } = setup(SourceEventStatus.FAILED);
    journals.createPostedInTransaction.mockRejectedValue(
      new BadRequestException('GL account is inactive'),
    );

    const result = await service.retry(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.retryCount).toBe(1);
    expect(event.failureReason).toBe('GL account is inactive');
  });

  it('returns the posted event when a successful retry is repeated', async () => {
    const { event, journals, service } = setup(SourceEventStatus.POSTED);
    event.journalEntryId = 'journal-1';

    const result = await service.retry(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('prevents concurrent processing of the same source event', async () => {
    const { event, service } = setup(SourceEventStatus.PROCESSING);

    await expect(service.retry(actor, event.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('processes a pending internal event into a posted journal', async () => {
    const { event, service } = setup(SourceEventStatus.RECEIVED);

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.journalEntryId).toBe('journal-1');
  });

  it('does not double-post an already posted event', async () => {
    const { event, journals, service } = setup(SourceEventStatus.POSTED);
    event.journalEntryId = 'journal-1';

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('processes failed events through the single-event process endpoint', async () => {
    const { event, service } = setup(SourceEventStatus.FAILED);

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.retryCount).toBe(1);
  });

  it('stores a failure reason when single-event processing fails', async () => {
    const { event, journals, service } = setup(SourceEventStatus.RECEIVED);
    journals.createPostedInTransaction.mockRejectedValue(
      new BadRequestException('Missing premium clearing account'),
    );

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe('Missing premium clearing account');
  });

  it('processes pending events with filters and limit', async () => {
    const { event, prisma, service } = setup(SourceEventStatus.RECEIVED);
    prisma.sourceEventInbox.findMany.mockResolvedValue([{ id: event.id }]);

    const result = await service.processPending(actor, {
      limit: 2,
      sourceModule: dto.sourceModule,
      sourceEventType: dto.sourceEventType,
    });

    expect(prisma.sourceEventInbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          status: SourceEventStatus.RECEIVED,
          sourceModule: dto.sourceModule,
          sourceEventType: dto.sourceEventType,
        },
        take: 2,
      }),
    );
    expect(result).toMatchObject({
      processedCount: 1,
      postedCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it('caps pending processing batches at 100 events', async () => {
    const { prisma, service } = setup(SourceEventStatus.RECEIVED);
    prisma.sourceEventInbox.findMany.mockResolvedValue([]);

    await service.processPending(actor, { limit: 500 });

    expect(prisma.sourceEventInbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('safely retries a stale processing claim', async () => {
    const { event, service } = setup(SourceEventStatus.PROCESSING);
    event.updatedAt = new Date(Date.now() - 20 * 60 * 1000);

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.retryCount).toBe(1);
  });
});
