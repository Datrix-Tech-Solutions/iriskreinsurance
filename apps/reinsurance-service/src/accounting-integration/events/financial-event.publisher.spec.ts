import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyOrigin,
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementSettlementMethod,
  PlacementClaimCedantSettlementStatus,
  PlacementClaimRecoveryReceiptStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceAccountingOutboxService } from '../outbox/outbox.service';
import { ReinsuranceFinancialEventPublisher } from './financial-event.publisher';

describe('ReinsuranceFinancialEventPublisher', () => {
  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true, accounting: true },
    featureConfig: { operations: { reinsurance: true } },
    integrationConfig: { 'operations.reinsurance->accounting': true },
    permissions: [],
  } as RequestUser;

  const placement = {
    id: 'placement-1',
    reference: 'FAC-2026-001',
    policyNumber: 'POL-2026-001',
    title: 'Factory Fire Risk',
    cedantId: 'cedant-1',
  };

  const counterparty = {
    id: 'cedant-1',
    tenantId: 'tenant-1',
    type: CounterpartyType.CEDANT,
    origin: CounterpartyOrigin.LOCAL,
    name: 'Acme Insurance',
    normalizedName: 'acme insurance',
    registrationNumber: 'REG-123',
    country: 'GH',
    taxId: null,
    licenseNumber: null,
    email: null,
    phone: null,
    website: null,
    notes: null,
    brokerageFee: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedByUserId: null,
    archivedAt: null,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:00:00.000Z'),
  };

  const claimPayableApproval = {
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
  };

  const note = {
    id: 'note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'cedant-1',
    type: PlacementNoteType.DEBIT_NOTE,
    direction: PlacementNoteDirection.CEDANT_TO_BROKER,
    noteNumber: 'DN-001',
    status: PlacementNoteStatus.DRAFT,
    currency: 'GHS',
    grossAmount: new Prisma.Decimal('10000.00'),
    commissionPercent: new Prisma.Decimal('10.0000'),
    commissionAmount: new Prisma.Decimal('1000.00'),
    brokeragePercent: new Prisma.Decimal('5.00'),
    brokerageAmount: new Prisma.Decimal('500.00'),
    nicLevyPercent: new Prisma.Decimal('1.0000'),
    nicLevyAmount: new Prisma.Decimal('100.00'),
    withholdingTaxPercent: new Prisma.Decimal('0.5000'),
    withholdingTaxAmount: new Prisma.Decimal('50.00'),
    netAmount: new Prisma.Decimal('8550.00'),
    appliedCharges: [
      {
        code: 'NIC_LEVY',
        name: 'NIC Levy',
        amount: 100,
      },
    ] as Prisma.JsonArray,
    noteDate: new Date('2026-06-04T12:00:00.000Z'),
    issuedAt: null,
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
    currency: 'GHS',
    paymentDate: new Date('2026-06-05T10:30:00.000Z'),
    reference: 'BANK-001',
    settlementReference: null,
    settlementMethod: null,
    settlementCurrency: null,
    bankReference: null,
    accountingCashAccountId: null,
    bankConfirmedAt: null,
    agreedExchangeRate: null,
    bankChargeAmount: new Prisma.Decimal('0.00'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    notes: 'Bank transfer',
    status: PlacementPaymentStatus.RECORDED,
    reversalOfPaymentId: null,
    counterparty: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Insurance',
      registrationNumber: 'ACME-001',
    },
    placement: {
      id: 'placement-1',
      reference: 'FAC-2026-001',
      policyNumber: 'POL-001',
      title: 'Xpress Group',
      cedantId: 'cedant-1',
    },
    allocations: [],
  };

  const reinsurerDisbursement = {
    ...payment,
    id: 'payment-disbursement-1',
    counterpartyId: 'reinsurer-1',
    type: PlacementPaymentType.REINSURER_DISBURSEMENT,
    direction: PlacementPaymentDirection.OUTBOUND,
    amount: new Prisma.Decimal('750.00'),
    currency: 'USD',
    paymentDate: new Date('2026-06-07T09:30:00.000Z'),
    reference: 'PAY-REF-001',
    settlementReference: 'SETTLE-001',
    settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
    settlementCurrency: 'USD',
    bankReference: 'BANK-CONF-001',
    accountingCashAccountId: 'cash-account-1',
    bankConfirmedAt: new Date('2026-06-07T10:00:00.000Z'),
    agreedExchangeRate: new Prisma.Decimal('12.50000000'),
    bankChargeAmount: new Prisma.Decimal('12.50'),
    withholdingTaxAmount: new Prisma.Decimal('25.00'),
    status: PlacementPaymentStatus.BANK_CONFIRMED,
    counterparty: {
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      name: 'Reliable Re',
      registrationNumber: 'RE-001',
    },
    allocations: [
      {
        id: 'allocation-1',
        noteId: 'credit-note-1',
        allocatedAmount: new Prisma.Decimal('500.00'),
        allocatedCurrency: 'USD',
        obligationAmount: new Prisma.Decimal('500.00'),
        obligationCurrency: 'USD',
        agreedExchangeRate: null,
        note: {
          id: 'credit-note-1',
          noteNumber: 'CN-001',
          type: PlacementNoteType.CREDIT_NOTE,
          direction: PlacementNoteDirection.BROKER_TO_REINSURER,
          status: PlacementNoteStatus.ISSUED,
          currency: 'USD',
          netAmount: new Prisma.Decimal('500.00'),
          nicLevyAmount: new Prisma.Decimal('10.00'),
          withholdingTaxAmount: new Prisma.Decimal('20.00'),
          withholdingTaxPercent: new Prisma.Decimal('4.0000'),
        },
      },
      {
        id: 'allocation-2',
        noteId: 'endorsement-credit-note-1',
        allocatedAmount: new Prisma.Decimal('250.00'),
        allocatedCurrency: 'USD',
        obligationAmount: new Prisma.Decimal('3125.00'),
        obligationCurrency: 'GHS',
        agreedExchangeRate: new Prisma.Decimal('12.50000000'),
        note: {
          id: 'endorsement-credit-note-1',
          noteNumber: 'ECN-001',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          direction: PlacementNoteDirection.BROKER_TO_REINSURER,
          status: PlacementNoteStatus.ISSUED,
          currency: 'GHS',
          netAmount: new Prisma.Decimal('3125.00'),
          nicLevyAmount: new Prisma.Decimal('62.50'),
          withholdingTaxAmount: new Prisma.Decimal('125.00'),
          withholdingTaxPercent: new Prisma.Decimal('4.0000'),
        },
      },
    ],
  };

  const makeService = (overrides?: { accountingEnabled?: boolean }) => {
    const prisma = {
      placement: {
        findFirst: jest.fn().mockResolvedValue(placement),
      },
      placementEndorsement: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'endorsement-1',
          endorsementNumber: 'END-001',
          type: 'CAPACITY_CHANGE',
          impactType: 'CAPACITY_INCREASE',
          effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
          status: 'CLOSING',
        }),
      },
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(counterparty),
      },
      placementClaim: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'claim-1',
          claimNumber: 'CLM-001',
          currency: 'GHS',
          estimatedLossAmount: new Prisma.Decimal('120000.00'),
          finalLossAmount: new Prisma.Decimal('100000.00'),
          placement,
        }),
      },
      placementClaimPayableApproval: {
        findFirst: jest.fn().mockResolvedValue(claimPayableApproval),
      },
      placementClaimAllocation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'allocation-1',
          placementClosingId: 'closing-1',
          endorsementClosingId: null,
          participantId: 'participant-1',
          endorsementParticipantId: null,
          counterpartyId: 'reinsurer-1',
          signedLinePercent: new Prisma.Decimal('60.0000'),
          basisAmount: new Prisma.Decimal('200000.00'),
          allocatedEstimatedLossAmount: new Prisma.Decimal('120000.00'),
          allocatedFinalLossAmount: new Prisma.Decimal('100000.00'),
          cashCallAmount: new Prisma.Decimal('100000.00'),
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Reliable Re',
            registrationNumber: 'RE-123',
          },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'allocation-1',
            placementClosingId: 'closing-1',
            endorsementClosingId: null,
            participantId: 'participant-1',
            endorsementParticipantId: null,
            counterpartyId: 'reinsurer-1',
            signedLinePercent: new Prisma.Decimal('60.0000'),
            basisAmount: new Prisma.Decimal('200000.00'),
            allocatedEstimatedLossAmount: new Prisma.Decimal('120000.00'),
            allocatedFinalLossAmount: new Prisma.Decimal('60000.00'),
            cashCallAmount: null,
            counterparty: {
              id: 'reinsurer-1',
              type: CounterpartyType.REINSURER,
              name: 'Reliable Re',
              registrationNumber: 'RE-123',
            },
          },
        ]),
      },
    };
    const outbox = {
      enqueueAccountingEvent: jest.fn(),
    };
    const client = {
      checkReinsuranceReadiness: jest.fn().mockResolvedValue({
        ready: true,
        checkedAt: '2026-07-01T00:00:00.000Z',
        eventResults: [],
      }),
    };
    const actor = {
      ...user,
      moduleConfig: {
        operations: true,
        accounting: overrides?.accountingEnabled ?? true,
      },
    } as RequestUser;
    const service = new ReinsuranceFinancialEventPublisher(
      prisma as unknown as PrismaService,
      outbox as unknown as ReinsuranceAccountingOutboxService,
      client as never,
    );

    return { actor, client, outbox, prisma, service };
  };

  it('skips Accounting readiness preflight when the tenant has Accounting disabled', async () => {
    const { actor, client, service } = makeService({
      accountingEnabled: false,
    });

    await service.assertAccountingReadyForEvent(actor, {
      eventType: 'CLAIM_PAYABLE_APPROVED',
      currency: 'GHS',
      businessDate: '2026-07-30T10:00:00.000Z',
    });

    expect(client.checkReinsuranceReadiness).not.toHaveBeenCalled();
  });

  it('throws a controlled conflict when Accounting readiness returns blockers', async () => {
    const { actor, client, service } = makeService();
    client.checkReinsuranceReadiness.mockResolvedValueOnce({
      ready: false,
      checkedAt: '2026-07-30T10:00:00.000Z',
      eventResults: [
        {
          eventType: 'CLAIM_PAYABLE_APPROVED',
          ready: false,
          blockers: [
            {
              code: 'POSTING_RULE_MISSING',
              message: 'No PostingRule is configured.',
            },
          ],
        },
      ],
    });

    let error: unknown;
    try {
      await service.assertAccountingReadyForEvent(actor, {
        eventType: 'CLAIM_PAYABLE_APPROVED',
        currency: 'GHS',
        businessDate: new Date('2026-07-30T10:00:00.000Z'),
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ConflictException);
    expect(error).toMatchObject({
      response: {
        code: 'ACCOUNTING_NOT_READY',
        eventType: 'CLAIM_PAYABLE_APPROVED',
        message:
          'Accounting is not ready to recognize CLAIM_PAYABLE_APPROVED. Missing PostingRule for CLAIM_PAYABLE_APPROVED.',
      },
    });
    expect(client.checkReinsuranceReadiness).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      eventTypes: ['CLAIM_PAYABLE_APPROVED'],
      currency: 'GHS',
      businessDate: '2026-07-30T10:00:00.000Z',
    });
  });

  it('prepares a WFIS-compliant DEBIT_NOTE_ISSUED event from the note snapshot', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareDebitNoteIssued(
      actor,
      note,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected DEBIT_NOTE_ISSUED event');

    const payload = event.payload as {
      transactionDate: string;
      currency: string;
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      documents: Record<string, unknown>;
    };
    expect(payload.transactionDate).toBe('2026-06-04T13:00:00.000Z');
    expect(payload.currency).toBe('GHS');
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      placementReference: 'FAC-2026-001',
      policyNumber: 'POL-2026-001',
      noteNumber: 'DN-001',
    });
    expect(payload.counterparty).toEqual({
      id: 'cedant-1',
      type: 'CEDANT',
      name: 'Acme Insurance',
      registrationNumber: 'REG-123',
      subledgerExternalRef: 'cedant-1',
    });
    expect(payload.amounts).toMatchObject({
      grossPremium: 10000,
      commissionAmount: 1000,
      brokerageAmount: 500,
      nicLevyAmount: 100,
      withholdingTaxAmount: 50,
      netPremium: 8550,
      netAmount: 8550,
    });
    expect(payload.documents).toEqual({
      placementNoteId: 'note-1',
      placementNoteNumber: 'DN-001',
      sourceDocumentId: 'note-1',
    });
  });

  it('skips publishing when Accounting is disabled for the tenant', async () => {
    const { actor, service } = makeService({
      accountingEnabled: false,
    });

    const event = await service.prepareDebitNoteIssued(
      actor,
      note,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event).toBeNull();
  });

  it('prepares a WFIS-compliant CREDIT_NOTE_ISSUED event from the note snapshot', async () => {
    const { actor, service } = makeService();
    const creditNote = {
      ...note,
      id: 'credit-note-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'CN-001',
      grossAmount: new Prisma.Decimal('4500.00'),
      commissionAmount: new Prisma.Decimal('450.00'),
      brokerageAmount: new Prisma.Decimal('337.50'),
      netAmount: new Prisma.Decimal('3712.50'),
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: 'RE-001',
      },
      closing: {
        id: 'closing-1',
        closingNumber: 'CLO-001',
      },
    };

    const event = await service.prepareCreditNoteIssued(
      actor,
      creditNote,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'CREDIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'credit-note-1',
      sourceDocumentId: 'credit-note-1',
      idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected CREDIT_NOTE_ISSUED event');

    const payload = event.payload as {
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      note: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      placementReference: 'FAC-2026-001',
      closingId: 'closing-1',
      closingNumber: 'CLO-001',
      participantId: 'participant-1',
      noteNumber: 'CN-001',
    });
    expect(payload.counterparty).toEqual({
      id: 'reinsurer-1',
      type: 'REINSURER',
      name: 'Reliable Re',
      registrationNumber: 'RE-001',
      subledgerExternalRef: 'reinsurer-1',
    });
    expect(payload.amounts).toMatchObject({
      grossPremium: 4500,
      commissionAmount: 450,
      brokerageAmount: 337.5,
      charges: 150,
      netAmount: 3712.5,
      creditMagnitude: 3712.5,
      signedReceivableImpact: 0,
      signedPayableImpact: 3712.5,
    });
    expect(payload.note).toMatchObject({
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      status: PlacementNoteStatus.ISSUED,
      amountRepresentation: 'POSITIVE_MAGNITUDE_WITH_SIGNED_IMPACTS',
    });
  });

  it('does not prepare CREDIT_NOTE_ISSUED for the wrong note type', async () => {
    const { actor, service } = makeService();

    await expect(
      service.prepareCreditNoteIssued(
        actor,
        note,
        new Date('2026-06-04T13:00:00.000Z'),
      ),
    ).rejects.toThrow(
      'Note note-1 is not a valid issued placement credit note',
    );
  });

  it('prepares ENDORSEMENT_DEBIT_NOTE_ISSUED from an issued endorsement debit note snapshot', async () => {
    const { actor, service } = makeService();
    const endorsementDebitNote = {
      ...note,
      id: 'endorsement-debit-note-1',
      endorsementId: 'endorsement-1',
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      noteNumber: 'EDN-001',
      grossAmount: new Prisma.Decimal('2500.00'),
      commissionAmount: new Prisma.Decimal('250.00'),
      brokerageAmount: new Prisma.Decimal('0.00'),
      netAmount: new Prisma.Decimal('2250.00'),
      endorsement: {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        type: 'CAPACITY_CHANGE',
        impactType: 'CAPACITY_INCREASE',
        effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
        status: 'CLOSING',
      },
    };

    const event = await service.prepareEndorsementDebitNoteIssued(
      actor,
      endorsementDebitNote,
      new Date('2026-06-11T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'endorsement-debit-note-1',
      sourceDocumentId: 'endorsement-debit-note-1',
      idempotencyKey:
        'reinsurance:endorsement-debit-note:endorsement-debit-note-1:issued:v1',
      occurredAt: '2026-06-11T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected ENDORSEMENT_DEBIT_NOTE_ISSUED event');
    const payload = event.payload as {
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      endorsement: Record<string, unknown>;
      note: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      endorsementReference: 'END-001',
      noteNumber: 'EDN-001',
    });
    expect(payload.counterparty).toMatchObject({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      subledgerExternalRef: 'cedant-1',
    });
    expect(payload.amounts).toMatchObject({
      grossPremiumAdjustment: 2500,
      commissionAdjustment: 250,
      netPremiumAdjustment: 2250,
      adjustmentMagnitude: 2250,
      signedReceivableImpact: 2250,
      signedPayableImpact: 0,
    });
    expect(payload.endorsement).toMatchObject({
      id: 'endorsement-1',
      reference: 'END-001',
      effectiveDate: '2026-06-10T00:00:00.000Z',
    });
    expect(payload.note).toMatchObject({
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      status: PlacementNoteStatus.ISSUED,
    });
  });

  it('prepares ENDORSEMENT_CREDIT_NOTE_ISSUED from a return-premium endorsement credit note snapshot', async () => {
    const { actor, service } = makeService();
    const endorsementCreditNote = {
      ...note,
      id: 'endorsement-credit-note-1',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'ECN-001',
      grossAmount: new Prisma.Decimal('-1800.00'),
      commissionAmount: new Prisma.Decimal('-180.00'),
      brokerageAmount: new Prisma.Decimal('0.00'),
      netAmount: new Prisma.Decimal('-1620.00'),
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: 'RE-001',
      },
      endorsement: {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        type: 'CAPACITY_CHANGE',
        impactType: 'DECREASE_OR_CANCELLATION',
        effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
        status: 'CLOSING',
      },
      endorsementClosing: {
        id: 'endorsement-closing-1',
        closingNumber: 'ECLO-001',
        endorsementParticipantId: 'endorsement-participant-1',
      },
    };

    const event = await service.prepareEndorsementCreditNoteIssued(
      actor,
      endorsementCreditNote,
      new Date('2026-06-11T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'endorsement-credit-note-1',
      sourceDocumentId: 'endorsement-credit-note-1',
      idempotencyKey:
        'reinsurance:endorsement-credit-note:endorsement-credit-note-1:issued:v1',
      occurredAt: '2026-06-11T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) {
      throw new Error('Expected ENDORSEMENT_CREDIT_NOTE_ISSUED event');
    }
    const payload = event.payload as {
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      note: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      endorsementId: 'endorsement-1',
      endorsementReference: 'END-001',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementClosingNumber: 'ECLO-001',
      endorsementParticipantId: 'endorsement-participant-1',
      noteNumber: 'ECN-001',
    });
    expect(payload.counterparty).toMatchObject({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      subledgerExternalRef: 'reinsurer-1',
    });
    expect(payload.amounts).toMatchObject({
      rawGrossPremiumAdjustment: -1800,
      rawCommissionAdjustment: -180,
      rawNetPremiumAdjustment: -1620,
      grossPremiumAdjustment: 1800,
      commissionAdjustment: 180,
      netPremiumAdjustment: -1620,
      adjustmentMagnitude: 1620,
      returnPremiumMagnitude: 1620,
      signedReceivableImpact: 0,
      signedPayableImpact: 1620,
    });
    expect(payload.note).toMatchObject({
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      amountRepresentation: 'POSITIVE_MAGNITUDE_WITH_SIGNED_IMPACTS',
    });
  });

  it('rejects endorsement events when the note has no endorsement association', async () => {
    const { actor, service } = makeService();

    await expect(
      service.prepareEndorsementDebitNoteIssued(
        actor,
        {
          ...note,
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          direction: PlacementNoteDirection.CEDANT_TO_BROKER,
          endorsementId: null,
        },
        new Date('2026-06-11T13:00:00.000Z'),
      ),
    ).rejects.toThrow(
      'Note note-1 is not a valid issued endorsement debit note',
    );
  });

  it('captures the event even when delivery configuration is missing', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareDebitNoteIssued(
      actor,
      note,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event?.sourceEventType).toBe('DEBIT_NOTE_ISSUED');
    expect(event?.idempotencyKey).toBe(
      'reinsurance:debit-note:note-1:issued:v1',
    );
  });

  it('prepares a PREMIUM_PAYMENT_RECEIVED event from the bank-confirmed payment row', () => {
    const { actor, service } = makeService();
    const confirmedPayment = {
      ...payment,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankConfirmedAt: new Date('2026-06-06T09:15:00.000Z'),
      bankReference: 'BANK-CONF-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
      bankChargeAmount: new Prisma.Decimal('15.00'),
      accountingCashAccountId: 'cash-account-1',
    };

    const event = service.preparePremiumPaymentReceived(
      actor,
      confirmedPayment,
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      occurredAt: '2026-06-06T09:15:00.000Z',
      currency: 'GHS',
      payload: {
        transactionDate: '2026-06-06T09:15:00.000Z',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          policyNumber: 'POL-001',
          paymentId: 'payment-1',
          paymentReference: 'BANK-001',
        },
        counterparty: {
          id: 'cedant-1',
          type: CounterpartyType.CEDANT,
          name: 'Acme Insurance',
          subledgerExternalRef: 'cedant-1',
        },
        amounts: {
          paymentAmount: 1000,
          bankCharges: 15,
          signedCashImpact: 1000,
          signedReceivableImpact: -1000,
          cashAffectingSettlement: true,
        },
        payment: {
          status: PlacementPaymentStatus.BANK_CONFIRMED,
          bankConfirmedAt: '2026-06-06T09:15:00.000Z',
          bankReference: 'BANK-CONF-001',
          accountingCashAccountId: 'cash-account-1',
          settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
          settlementCurrency: 'GHS',
        },
        allocation: {
          model: 'PLACEMENT_LEVEL_RECEIVABLE',
          noteAllocationSupported: false,
          noteId: null,
          noteNumber: null,
        },
      },
    });
  });

  it('prepares a PAYMENT_REVERSED event from the reversal payment row', () => {
    const { actor, service } = makeService();
    const reversal = {
      ...payment,
      id: 'payment-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      paymentDate: new Date('2026-06-06T10:30:00.000Z'),
      reference: 'REVERSAL-BANK-001',
      notes: 'Payment reversal',
      reversalOfPaymentId: 'payment-1',
      reversalOfPayment: {
        id: 'payment-1',
        amount: payment.amount,
        currency: payment.currency,
        paymentDate: payment.paymentDate,
        reference: payment.reference,
        status: PlacementPaymentStatus.REVERSED,
      },
    };

    const event = service.preparePaymentReversed(actor, reversal);

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'PAYMENT_REVERSED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-reversal-1',
      sourceDocumentId: 'payment-reversal-1',
      idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
      occurredAt: '2026-06-06T10:30:00.000Z',
      currency: 'GHS',
      payload: {
        references: {
          originalPaymentId: 'payment-1',
          reversalPaymentId: 'payment-reversal-1',
        },
        amounts: {
          paymentAmount: 1000,
          originalPaymentAmount: 1000,
          signedCashImpact: -1000,
          signedReceivableImpact: 1000,
        },
        payment: {
          id: 'payment-reversal-1',
          originalPaymentId: 'payment-1',
          reversalPaymentId: 'payment-reversal-1',
          isReversal: true,
        },
      },
    });
  });

  it('classifies a valid bank-confirmed reinsurer disbursement as eligible', () => {
    const { actor, service } = makeService();

    const eligibility = service.classifyReinsurerDisbursementRecorded(
      actor,
      reinsurerDisbursement,
    );

    expect(eligibility).toEqual({
      accountingEnabled: true,
      eligible: true,
      exclusionReasons: [],
      idempotencyKey:
        'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
    });
  });

  it('allows bank-confirmed reinsurer disbursement recognition without credit-note allocations', () => {
    const { actor, service } = makeService();

    const eligibility = service.classifyReinsurerDisbursementRecorded(actor, {
      ...reinsurerDisbursement,
      allocations: [],
    });

    const event = service.prepareReinsurerDisbursementRecorded(actor, {
      ...reinsurerDisbursement,
      allocations: [],
    });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.exclusionReasons).toEqual([]);
    expect(event?.payload).toMatchObject({
      amounts: {
        paymentAmount: 750,
        allocatedAmount: 0,
        unallocatedAmount: 750,
      },
      allocation: {
        allocationCount: 0,
      },
      allocations: [],
    });
  });

  it('prepares REINSURER_DISBURSEMENT_RECORDED from a bank-confirmed allocation snapshot', () => {
    const { actor, service } = makeService();

    const event = service.prepareReinsurerDisbursementRecorded(
      actor,
      reinsurerDisbursement,
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-disbursement-1',
      sourceDocumentId: 'payment-disbursement-1',
      idempotencyKey:
        'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
      occurredAt: '2026-06-07T10:00:00.000Z',
      currency: 'USD',
      payload: {
        transactionDate: '2026-06-07T10:00:00.000Z',
        currency: 'USD',
        exchangeRate: 12.5,
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          paymentId: 'payment-disbursement-1',
          paymentReference: 'PAY-REF-001',
          settlementReference: 'SETTLE-001',
        },
        counterparty: {
          id: 'reinsurer-1',
          type: CounterpartyType.REINSURER,
          name: 'Reliable Re',
          subledgerExternalRef: 'reinsurer-1',
        },
        payment: {
          status: PlacementPaymentStatus.BANK_CONFIRMED,
          bankConfirmedAt: '2026-06-07T10:00:00.000Z',
          bankReference: 'BANK-CONF-001',
          accountingCashAccountId: 'cash-account-1',
          settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
          settlementCurrency: 'USD',
        },
        amounts: {
          paymentAmount: 750,
          allocatedAmount: 750,
          unallocatedAmount: 0,
          bankCharges: 12.5,
          nicLevyAmount: 72.5,
          contractualWithholdingTaxAmount: 145,
          contractualWithholdingTaxRate: 4,
          withholdingTax: 145,
          signedCashImpact: -750,
          signedPayableImpact: -750,
          cashAffectingSettlement: true,
        },
        allocation: {
          model: 'CREDIT_NOTE_ALLOCATIONS',
          allocationCount: 2,
        },
      },
    });
    const payload = event?.payload as { allocations: Array<unknown> };
    expect(payload.allocations).toEqual([
      expect.objectContaining({
        allocationId: 'allocation-1',
        creditNoteId: 'credit-note-1',
        creditNoteNumber: 'CN-001',
        obligationType: PlacementNoteType.CREDIT_NOTE,
        obligationCurrency: 'USD',
        allocatedAmount: 500,
        paymentCurrencyAmount: 500,
        agreedExchangeRate: null,
        nicLevyAmount: 10,
        contractualWithholdingTaxAmount: 20,
        contractualWithholdingTaxRate: 4,
      }),
      expect.objectContaining({
        allocationId: 'allocation-2',
        creditNoteId: 'endorsement-credit-note-1',
        creditNoteNumber: 'ECN-001',
        obligationType: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        obligationCurrency: 'GHS',
        allocatedAmount: 3125,
        paymentCurrencyAmount: 250,
        agreedExchangeRate: 12.5,
        nicLevyAmount: 62.5,
        contractualWithholdingTaxAmount: 125,
        contractualWithholdingTaxRate: 4,
      }),
    ]);
  });

  it('sets no cash impact for journal reinsurer disbursement settlements', () => {
    const { actor, service } = makeService();

    const event = service.prepareReinsurerDisbursementRecorded(actor, {
      ...reinsurerDisbursement,
      settlementMethod: PlacementSettlementMethod.JOURNAL,
    });

    expect(event?.payload).toMatchObject({
      payment: {
        settlementMethod: PlacementSettlementMethod.JOURNAL,
      },
      amounts: {
        paymentAmount: 750,
        signedCashImpact: 0,
        signedPayableImpact: -750,
        cashAffectingSettlement: false,
      },
    });
  });

  it('preserves operational cheque facts in the disbursement event payload', () => {
    const { actor, service } = makeService();

    const event = service.prepareReinsurerDisbursementRecorded(actor, {
      ...reinsurerDisbursement,
      reference: 'CHQ-001',
      bankReference: null,
      settlementMethod: PlacementSettlementMethod.CHEQUE,
    });

    expect(event?.payload).toMatchObject({
      references: {
        paymentReference: 'CHQ-001',
      },
      payment: {
        paymentReference: 'CHQ-001',
        bankReference: null,
        accountingCashAccountId: 'cash-account-1',
        settlementMethod: PlacementSettlementMethod.CHEQUE,
      },
      amounts: {
        paymentAmount: 750,
        signedCashImpact: -750,
        signedPayableImpact: -750,
      },
    });
  });

  it('prepares REINSURER_DISBURSEMENT_REVERSED from the immutable reversal row', () => {
    const { actor, service } = makeService();
    const reversal = {
      ...reinsurerDisbursement,
      id: 'payment-disbursement-reversal-1',
      amount: new Prisma.Decimal('-750.00'),
      paymentDate: new Date('2026-06-08T10:00:00.000Z'),
      reference: 'REVERSAL-PAY-REF-001',
      settlementReference: 'REVERSAL-SETTLE-001',
      bankReference: 'REVERSAL-BANK-CONF-001',
      bankConfirmedAt: null,
      bankChargeAmount: new Prisma.Decimal('-12.50'),
      withholdingTaxAmount: new Prisma.Decimal('-25.00'),
      status: PlacementPaymentStatus.RECORDED,
      reversalOfPaymentId: 'payment-disbursement-1',
      reversalOfPayment: {
        id: 'payment-disbursement-1',
        amount: reinsurerDisbursement.amount,
        currency: reinsurerDisbursement.currency,
        paymentDate: reinsurerDisbursement.paymentDate,
        reference: reinsurerDisbursement.reference,
        status: PlacementPaymentStatus.REVERSED,
      },
      allocations: reinsurerDisbursement.allocations.map((allocation) => ({
        ...allocation,
        id: `${allocation.id}-reversal`,
        allocatedAmount: allocation.allocatedAmount.negated(),
        obligationAmount: allocation.obligationAmount.negated(),
      })),
    };

    const event = service.prepareReinsurerDisbursementReversed(actor, reversal);

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'REINSURER_DISBURSEMENT_REVERSED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-disbursement-reversal-1',
      sourceDocumentId: 'payment-disbursement-reversal-1',
      idempotencyKey:
        'reinsurance:reinsurer-disbursement:payment-disbursement-reversal-1:reversal:v1',
      occurredAt: '2026-06-08T10:00:00.000Z',
      currency: 'USD',
      payload: {
        transactionDate: '2026-06-08T10:00:00.000Z',
        currency: 'USD',
        exchangeRate: 12.5,
        references: {
          placementId: 'placement-1',
          originalPaymentId: 'payment-disbursement-1',
          reversalPaymentId: 'payment-disbursement-reversal-1',
          settlementReference: 'REVERSAL-SETTLE-001',
        },
        counterparty: {
          id: 'reinsurer-1',
          type: CounterpartyType.REINSURER,
          subledgerExternalRef: 'reinsurer-1',
        },
        payment: {
          id: 'payment-disbursement-reversal-1',
          originalPaymentId: 'payment-disbursement-1',
          reversalPaymentId: 'payment-disbursement-reversal-1',
          isReversal: true,
          reversalOfPaymentId: 'payment-disbursement-1',
          bankReference: 'REVERSAL-BANK-CONF-001',
          accountingCashAccountId: 'cash-account-1',
          settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
        },
        amounts: {
          paymentAmount: 750,
          originalPaymentAmount: 750,
          allocatedAmount: 750,
          bankCharges: 12.5,
          nicLevyAmount: 72.5,
          contractualWithholdingTaxAmount: 145,
          contractualWithholdingTaxRate: 4,
          withholdingTax: 145,
          signedCashImpact: 750,
          signedPayableImpact: 750,
          cashAffectingSettlement: true,
        },
        allocation: {
          model: 'CREDIT_NOTE_ALLOCATIONS',
          allocationCount: 2,
          reversesRecognizedDisbursement: true,
        },
      },
    });
    const payload = event?.payload as { allocations: Array<unknown> };
    expect(payload.allocations).toEqual([
      expect.objectContaining({
        allocationId: 'allocation-1-reversal',
        creditNoteId: 'credit-note-1',
        obligationType: PlacementNoteType.CREDIT_NOTE,
        allocatedAmount: 500,
        paymentCurrencyAmount: 500,
      }),
      expect.objectContaining({
        allocationId: 'allocation-2-reversal',
        creditNoteId: 'endorsement-credit-note-1',
        obligationType: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        obligationCurrency: 'GHS',
        allocatedAmount: 3125,
        paymentCurrencyAmount: 250,
        agreedExchangeRate: 12.5,
      }),
    ]);
  });

  it('uses the payment amount for an unallocated disbursement reversal', () => {
    const { actor, service } = makeService();
    const reversal = {
      ...reinsurerDisbursement,
      id: 'payment-disbursement-reversal-unallocated-1',
      amount: new Prisma.Decimal('-750.00'),
      status: PlacementPaymentStatus.RECORDED,
      reversalOfPaymentId: 'payment-disbursement-1',
      reversalOfPayment: {
        id: 'payment-disbursement-1',
        amount: reinsurerDisbursement.amount,
        currency: reinsurerDisbursement.currency,
        paymentDate: reinsurerDisbursement.paymentDate,
        reference: reinsurerDisbursement.reference,
        status: PlacementPaymentStatus.REVERSED,
      },
      allocations: [],
    };

    const event = service.prepareReinsurerDisbursementReversed(actor, reversal);

    expect(event?.payload).toMatchObject({
      amounts: {
        paymentAmount: 750,
        allocatedAmount: 750,
        signedPayableImpact: 750,
      },
      allocation: { allocationCount: 0 },
    });
  });

  it('skips reinsurer disbursement events when Accounting is disabled', () => {
    const { actor, service } = makeService({ accountingEnabled: false });

    const event = service.prepareReinsurerDisbursementRecorded(
      actor,
      reinsurerDisbursement,
    );

    expect(event).toBeNull();
  });

  it('reports controlled exclusion reasons for ineligible disbursement rows', () => {
    const { actor, service } = makeService();

    const eligibility = service.classifyReinsurerDisbursementRecorded(actor, {
      ...reinsurerDisbursement,
      status: PlacementPaymentStatus.FAILED,
      reversalOfPaymentId: 'payment-original',
      allocations: [],
      bankConfirmedAt: null,
    });

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.exclusionReasons).toEqual(
      expect.arrayContaining([
        'failed payment',
        'reversal row',
        'missing bank confirmation date',
      ]),
    );
  });

  it('does not require FX for same-currency disbursement allocations', () => {
    const { actor, service } = makeService();

    const event = service.prepareReinsurerDisbursementRecorded(actor, {
      ...reinsurerDisbursement,
      agreedExchangeRate: null,
      allocations: [
        {
          ...reinsurerDisbursement.allocations[0],
          allocatedAmount: new Prisma.Decimal('750.00'),
          obligationAmount: new Prisma.Decimal('750.00'),
        },
      ],
    });

    expect(event?.payload).not.toHaveProperty('exchangeRate');
  });

  it('requires persisted FX for cross-currency disbursement allocations', () => {
    const { actor, service } = makeService();

    const eligibility = service.classifyReinsurerDisbursementRecorded(actor, {
      ...reinsurerDisbursement,
      agreedExchangeRate: null,
      allocations: [
        {
          ...reinsurerDisbursement.allocations[1],
          agreedExchangeRate: null,
          allocatedAmount: new Prisma.Decimal('750.00'),
        },
      ],
    });

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.exclusionReasons).toContain('missing agreed FX rate');
  });

  it('does not prepare retired CLAIM_PAYABLE_APPROVED events', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareClaimPayableApproved(actor, {
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
      notes: 'Approved by reinsurer',
    });

    expect(event).toBeNull();
    if (event === null) return;

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'CLAIM_PAYABLE_APPROVED',
      sourceRecordType: 'PlacementClaimPayableApproval',
      sourceRecordId: 'approval-1',
      sourceDocumentId: 'claim-1',
      idempotencyKey: 'reinsurance:claim:claim-1:payable-approved:1:v1',
      occurredAt: '2026-07-30T10:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected CLAIM_PAYABLE_APPROVED event');
    const payload = event.payload as {
      references: Record<string, unknown>;
      cedant: Record<string, unknown>;
      reinsurers: Array<Record<string, unknown>>;
      amounts: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      placementReference: 'FAC-2026-001',
      claimId: 'claim-1',
      claimNumber: 'CLM-001',
      approvalId: 'approval-1',
      approvalVersion: 1,
      approvedByUserId: 'user-1',
    });
    expect(payload.cedant).toMatchObject({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      subledgerExternalRef: 'cedant-1',
    });
    expect(payload.reinsurers).toEqual([
      expect.objectContaining({
        allocationId: 'allocation-1',
        counterpartyId: 'reinsurer-1',
        counterpartyType: CounterpartyType.REINSURER,
        signedLinePercent: 60,
        allocatedFinalLossAmount: 60000,
      }),
    ]);
    expect(payload.amounts).toEqual({
      approvedPayableAmount: 90000,
      finalLossAmount: 100000,
      signedClaimPayableImpact: 90000,
    });
    const serializedPayload = JSON.stringify(event.payload).toLowerCase();
    expect(serializedPayload).not.toContain('withholding');
    expect(serializedPayload).not.toContain('nic');
    expect(serializedPayload).not.toContain('glaccount');
  });

  it('skips claim payable approval events when Accounting is disabled', async () => {
    const { actor, service } = makeService({ accountingEnabled: false });

    const event = await service.prepareClaimPayableApproved(actor, {
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
    });

    expect(event).toBeNull();
  });

  it('does not prepare retired CLAIM_RECOVERY_APPROVED events', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareClaimRecoveryApproved(actor, {
      id: 'recovery-approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      cashCallId: 'cash-call-1',
      counterpartyId: 'reinsurer-1',
      approvalVersion: 1,
      approvedAmount: new Prisma.Decimal('40000.00'),
      eligibleAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-31T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      reference: 'REC-APP-001',
      notes: 'Formally agreed by reinsurer',
    });

    expect(event).toBeNull();
    if (event === null) return;

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'CLAIM_RECOVERY_APPROVED',
      sourceRecordType: 'PlacementClaimRecoveryApproval',
      sourceRecordId: 'recovery-approval-1',
      sourceDocumentId: 'claim-1',
      idempotencyKey:
        'reinsurance:claim-recovery:recovery-approval-1:approved:v1',
      occurredAt: '2026-07-31T10:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected CLAIM_RECOVERY_APPROVED event');
    const payload = event.payload as {
      references: Record<string, unknown>;
      reinsurer: Record<string, unknown>;
      allocation: Record<string, unknown>;
      amounts: Record<string, unknown>;
      approval: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      placementReference: 'FAC-2026-001',
      claimId: 'claim-1',
      claimNumber: 'CLM-001',
      allocationId: 'allocation-1',
      cashCallId: 'cash-call-1',
      approvalId: 'recovery-approval-1',
      approvalVersion: 1,
      approvalReference: 'REC-APP-001',
    });
    expect(payload.reinsurer).toMatchObject({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      subledgerExternalRef: 'reinsurer-1',
    });
    expect(payload.allocation).toMatchObject({
      id: 'allocation-1',
      placementClosingId: 'closing-1',
      signedLinePercent: 60,
      basisAmount: 200000,
      allocatedEstimatedLossAmount: 120000,
      allocatedFinalLossAmount: 100000,
    });
    expect(payload.amounts).toEqual({
      approvedRecoveryAmount: 40000,
      eligibleRecoveryAmount: 100000,
      signedRecoveryReceivableImpact: 40000,
    });
    expect(payload.approval.recognitionBoundary).toBe(
      'FORMAL_REINSURER_RECOVERY_APPROVAL',
    );
    const serializedPayload = JSON.stringify(event.payload).toLowerCase();
    expect(serializedPayload).not.toContain('withholdingtax');
    expect(serializedPayload).not.toContain('niclevy');
    expect(serializedPayload).not.toContain('bankreference');
    expect(serializedPayload).not.toContain('paymentdate');
    expect(payload.references).not.toHaveProperty('recoveryReceiptId');
  });

  it('skips claim recovery approval events when Accounting is disabled', async () => {
    const { actor, service } = makeService({ accountingEnabled: false });

    const event = await service.prepareClaimRecoveryApproved(actor, {
      id: 'recovery-approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      counterpartyId: 'reinsurer-1',
      approvalVersion: 1,
      approvedAmount: new Prisma.Decimal('40000.00'),
      eligibleAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-31T10:00:00.000Z'),
      approvedByUserId: 'user-1',
    });

    expect(event).toBeNull();
  });

  it('does not prepare retired CLAIM_RECOVERY_RECEIVED events', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareClaimRecoveryReceived(actor, {
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
      paymentDate: new Date('2026-07-31T09:00:00.000Z'),
      reference: 'REC-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
      bankReference: 'BANK-CONF-001',
      accountingCashAccountId: 'cash-account-1',
      bankConfirmedAt: new Date('2026-07-31T10:00:00.000Z'),
      bankChargeAmount: new Prisma.Decimal('15.00'),
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      reversalOfReceiptId: null,
    });

    expect(event).toBeNull();
    if (event === null) return;

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'CLAIM_RECOVERY_RECEIVED',
      sourceRecordType: 'PlacementClaimRecoveryReceipt',
      sourceRecordId: 'receipt-1',
      idempotencyKey:
        'reinsurance:claim-recovery-receipt:receipt-1:confirmed:v1',
      occurredAt: '2026-07-31T10:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected CLAIM_RECOVERY_RECEIVED event');
    const payload = event.payload as {
      references: Record<string, unknown>;
      settlement: Record<string, unknown>;
      amounts: Record<string, unknown>;
      policy: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      recoveryApprovalId: 'recovery-approval-1',
      recoveryReceiptId: 'receipt-1',
      bankReference: 'BANK-CONF-001',
    });
    expect(payload.amounts).toEqual({
      receiptAmount: 40000,
      signedRecoveryReceivableReduction: 40000,
      signedCashImpact: 40000,
      bankChargeAmount: 15,
    });
    expect(payload.settlement).toMatchObject({
      method: PlacementSettlementMethod.BANK_TRANSFER,
      cashImpact: true,
      cashAccountId: 'cash-account-1',
      bankChargesAccountingOwned: true,
    });
    expect(payload.policy).toMatchObject({
      claimSettlementTaxTreatment: 'NOT_APPLICABLE',
      withholdingTaxTreatment: 'NOT_APPLICABLE',
      nicLevyTreatment: 'NOT_APPLICABLE',
      recognitionBoundary: 'ACCOUNTING_BANK_CONFIRMATION',
    });
  });

  it('does not prepare retired CLAIM_RECOVERY_RECEIPT_REVERSED events', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareClaimRecoveryReceiptReversed(actor, {
      id: 'receipt-reversal-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      cashCallId: 'cash-call-1',
      recoveryApprovalId: 'recovery-approval-1',
      counterpartyId: 'reinsurer-1',
      currency: 'GHS',
      amount: new Prisma.Decimal('-40000.00'),
      paymentDate: new Date('2026-07-31T11:00:00.000Z'),
      reference: 'REVERSAL:REC-001',
      settlementMethod: PlacementSettlementMethod.INTERNAL_OFFSET,
      settlementCurrency: 'GHS',
      bankReference: 'REVERSAL:BANK-CONF-001',
      bankConfirmedAt: new Date('2026-07-31T11:00:00.000Z'),
      bankChargeAmount: new Prisma.Decimal('-15.00'),
      status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
      reversalOfReceiptId: 'receipt-1',
    });

    expect(event).toBeNull();
    if (event === null) return;

    expect(event).toMatchObject({
      sourceEventType: 'CLAIM_RECOVERY_RECEIPT_REVERSED',
      sourceRecordType: 'PlacementClaimRecoveryReceipt',
      sourceRecordId: 'receipt-reversal-1',
      sourceDocumentId: 'receipt-1',
      idempotencyKey:
        'reinsurance:claim-recovery-receipt:receipt-reversal-1:reversal:v1',
    });
    if (!event) {
      throw new Error('Expected CLAIM_RECOVERY_RECEIPT_REVERSED event');
    }
    const payload = event.payload as {
      references: Record<string, unknown>;
      settlement: Record<string, unknown>;
      amounts: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      reversalReceiptId: 'receipt-reversal-1',
      reversedRecoveryReceiptId: 'receipt-1',
    });
    expect(payload.amounts).toEqual({
      reversalAmount: 40000,
      signedRecoveryReceivableRestoration: 40000,
      signedCashImpact: 0,
      bankChargeReversalAmount: 15,
    });
    expect(payload.settlement).toMatchObject({
      method: PlacementSettlementMethod.INTERNAL_OFFSET,
      cashImpact: false,
    });
  });

  it('does not prepare retired CLAIM_CEDANT_SETTLEMENT_PAID events', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareClaimCedantSettlementPaid(actor, {
      id: 'settlement-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      payableApprovalId: 'approval-1',
      currency: 'GHS',
      amount: new Prisma.Decimal('30000.00'),
      settlementDate: new Date('2026-08-10T09:00:00.000Z'),
      reference: 'CED-SET-001',
      settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
      settlementCurrency: 'GHS',
      bankReference: 'BANK-CED-001',
      accountingCashAccountId: 'cash-account-1',
      bankConfirmedAt: new Date('2026-08-10T11:00:00.000Z'),
      bankChargeAmount: new Prisma.Decimal('25.00'),
      agreedExchangeRate: null,
      status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
      reversalOfSettlementId: null,
    });

    expect(event).toBeNull();
    if (event === null) return;

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'CLAIM_CEDANT_SETTLEMENT_PAID',
      sourceRecordType: 'PlacementClaimCedantSettlement',
      sourceRecordId: 'settlement-1',
      sourceDocumentId: 'claim-1',
      idempotencyKey:
        'reinsurance:claim-cedant-settlement:settlement-1:confirmed:v1',
      occurredAt: '2026-08-10T11:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) {
      throw new Error('Expected CLAIM_CEDANT_SETTLEMENT_PAID event');
    }
    const payload = event.payload as {
      references: Record<string, unknown>;
      cedant: Record<string, unknown>;
      amounts: Record<string, unknown>;
      settlement: Record<string, unknown>;
      policy: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      claimId: 'claim-1',
      claimNumber: 'CLM-001',
      payableApprovalId: 'approval-1',
      payableApprovalVersion: 1,
      cedantSettlementId: 'settlement-1',
      bankReference: 'BANK-CED-001',
    });
    expect(payload.cedant).toMatchObject({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      subledgerExternalRef: 'cedant-1',
    });
    expect(payload.amounts).toEqual({
      settlementAmount: 30000,
      approvedPayableAmount: 90000,
      signedClaimPayableReduction: 30000,
      signedCashImpact: -30000,
      bankChargeAmount: 25,
    });
    expect(payload.settlement).toMatchObject({
      method: PlacementSettlementMethod.BANK_TRANSFER,
      cashImpact: true,
      cashAccountId: 'cash-account-1',
      bankChargesAccountingOwned: true,
    });
    expect(payload.policy).toMatchObject({
      postingEngine: 'POSTING_RULES',
      claimSettlementTaxTreatment: 'NOT_APPLICABLE',
      withholdingTaxTreatment: 'NOT_APPLICABLE',
      nicLevyTreatment: 'NOT_APPLICABLE',
      recognitionBoundary: 'ACCOUNTING_BANK_CONFIRMATION',
    });
  });

  it('does not prepare retired CLAIM_CEDANT_SETTLEMENT_REVERSED events', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareClaimCedantSettlementReversed(actor, {
      id: 'settlement-reversal-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      payableApprovalId: 'approval-1',
      currency: 'GHS',
      amount: new Prisma.Decimal('-30000.00'),
      settlementDate: new Date('2026-08-10T12:00:00.000Z'),
      reference: 'REVERSAL:CED-SET-001',
      settlementMethod: PlacementSettlementMethod.INTERNAL_OFFSET,
      settlementCurrency: 'GHS',
      bankReference: 'REVERSAL:BANK-CED-001',
      bankConfirmedAt: new Date('2026-08-10T12:00:00.000Z'),
      bankChargeAmount: new Prisma.Decimal('-25.00'),
      agreedExchangeRate: null,
      status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
      reversalOfSettlementId: 'settlement-1',
    });

    expect(event).toBeNull();
    if (event === null) return;

    expect(event).toMatchObject({
      sourceEventType: 'CLAIM_CEDANT_SETTLEMENT_REVERSED',
      sourceRecordType: 'PlacementClaimCedantSettlement',
      sourceRecordId: 'settlement-reversal-1',
      sourceDocumentId: 'settlement-1',
      idempotencyKey:
        'reinsurance:claim-cedant-settlement:settlement-reversal-1:reversal:v1',
      occurredAt: '2026-08-10T12:00:00.000Z',
    });
    if (!event) {
      throw new Error('Expected CLAIM_CEDANT_SETTLEMENT_REVERSED event');
    }
    const payload = event.payload as {
      references: Record<string, unknown>;
      amounts: Record<string, unknown>;
      settlement: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      reversalSettlementId: 'settlement-reversal-1',
      reversedCedantSettlementId: 'settlement-1',
    });
    expect(payload.amounts).toEqual({
      reversalAmount: 30000,
      signedClaimPayableRestoration: 30000,
      signedCashImpact: 0,
      bankChargeReversalAmount: 25,
    });
    expect(payload.settlement).toMatchObject({
      method: PlacementSettlementMethod.INTERNAL_OFFSET,
      cashImpact: false,
    });
  });

  it('enqueues prepared events through the transactional outbox', async () => {
    const { outbox, service } = makeService();
    const tx = {} as Prisma.TransactionClient;
    const event = {
      tenantId: 'tenant-1',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { netPremium: 8550 } },
    };

    await service.enqueuePreparedEvent(tx, event);

    expect(outbox.enqueueAccountingEvent).toHaveBeenCalledWith(tx, event);
  });
});
