import { RequestUser } from '@work-phelo/types';
import {
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
  ReinsuranceAccountingOutboxStatus,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceAccountingClient } from '../client/accounting.client';
import { ReinsuranceAccountingOutboxService } from '../outbox/outbox.service';
import { ReinsuranceAccountingReadinessService } from './readiness.service';
import { ReinsuranceFinancialEventPublisher } from '../events/financial-event.publisher';

describe('ReinsuranceAccountingReadinessService', () => {
  type PlacementNoteFindManyArg = {
    take?: number;
    where?: Record<string, unknown>;
  };
  type PlacementPaymentFindManyArg = {
    take?: number;
    where?: Record<string, unknown>;
  };
  type ClaimPayableApprovalFindManyArg = {
    take?: number;
    where?: Record<string, unknown>;
  };
  type ClaimRecoveryApprovalFindManyArg = {
    take?: number;
    where?: Record<string, unknown>;
  };
  type ClaimRecoveryReceiptFindManyArg = {
    take?: number;
    where?: Record<string, unknown>;
  };
  type ClaimCedantSettlementFindManyArg = {
    take?: number;
    where?: Record<string, unknown>;
  };

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

  const issuedNote = {
    id: 'note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'cedant-1',
    type: PlacementNoteType.DEBIT_NOTE,
    direction: PlacementNoteDirection.CEDANT_TO_BROKER,
    noteNumber: 'DN-001',
    status: PlacementNoteStatus.ISSUED,
    currency: 'GHS',
    grossAmount: new Prisma.Decimal('10000.00'),
    commissionPercent: null,
    commissionAmount: new Prisma.Decimal('1000.00'),
    brokeragePercent: null,
    brokerageAmount: new Prisma.Decimal('500.00'),
    nicLevyPercent: new Prisma.Decimal('0.0000'),
    nicLevyAmount: new Prisma.Decimal('0.00'),
    withholdingTaxPercent: new Prisma.Decimal('0.0000'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    netAmount: new Prisma.Decimal('8500.00'),
    appliedCharges: null,
    noteDate: new Date('2026-06-04T12:00:00.000Z'),
    issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    counterparty: {
      id: 'cedant-1',
      type: 'CEDANT',
      name: 'Acme Insurance',
      registrationNumber: null,
    },
  };

  const issuedCreditNote = {
    ...issuedNote,
    id: 'credit-note-1',
    closingId: 'closing-1',
    participantId: 'participant-1',
    counterpartyId: 'reinsurer-1',
    type: PlacementNoteType.CREDIT_NOTE,
    direction: PlacementNoteDirection.BROKER_TO_REINSURER,
    noteNumber: 'CN-001',
    counterparty: {
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      name: 'Reliable Re',
      registrationNumber: null,
    },
    closing: {
      id: 'closing-1',
      closingNumber: 'CLO-001',
    },
  };

  const issuedEndorsementDebitNote = {
    ...issuedNote,
    id: 'endorsement-debit-note-1',
    endorsementId: 'endorsement-1',
    type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
    direction: PlacementNoteDirection.CEDANT_TO_BROKER,
    noteNumber: 'EDN-001',
    endorsement: {
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      type: 'CAPACITY_CHANGE',
      impactType: 'CAPACITY_INCREASE',
      effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
      status: 'CLOSING',
    },
  };

  const issuedEndorsementCreditNote = {
    ...issuedCreditNote,
    id: 'endorsement-credit-note-1',
    endorsementId: 'endorsement-1',
    endorsementClosingId: 'endorsement-closing-1',
    endorsementParticipantId: 'endorsement-participant-1',
    type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
    direction: PlacementNoteDirection.BROKER_TO_REINSURER,
    noteNumber: 'ECN-001',
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
    settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
    settlementCurrency: 'GHS',
    bankReference: 'BANK-CONF-001',
    bankConfirmedAt: new Date('2026-06-06T09:15:00.000Z'),
    agreedExchangeRate: null,
    bankChargeAmount: new Prisma.Decimal('0.00'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    notes: null,
    status: PlacementPaymentStatus.BANK_CONFIRMED,
    reversalOfPaymentId: null,
    counterparty: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Insurance',
      registrationNumber: null,
    },
    placement: {
      id: 'placement-1',
      reference: 'FAC-001',
      policyNumber: 'POL-001',
      title: 'Xpress Group',
      cedantId: 'cedant-1',
    },
    reversalOfPayment: null,
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
    reference: 'PAY-001',
    settlementReference: 'SETTLE-001',
    bankReference: 'BANK-CONF-001',
    bankConfirmedAt: new Date('2026-06-07T10:00:00.000Z'),
    agreedExchangeRate: new Prisma.Decimal('12.50000000'),
    bankChargeAmount: new Prisma.Decimal('12.50'),
    withholdingTaxAmount: new Prisma.Decimal('25.00'),
    status: PlacementPaymentStatus.BANK_CONFIRMED,
    counterparty: {
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      name: 'Reliable Re',
      registrationNumber: null,
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
        },
      },
    ],
  };

  const reinsurerDisbursementReversal = {
    ...reinsurerDisbursement,
    id: 'payment-disbursement-reversal-1',
    amount: new Prisma.Decimal('-750.00'),
    paymentDate: new Date('2026-06-08T10:00:00.000Z'),
    reference: 'REVERSAL-PAY-001',
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

  const reversalPayment = {
    ...payment,
    id: 'payment-reversal-1',
    amount: new Prisma.Decimal('-1000.00'),
    paymentDate: new Date('2026-06-06T10:30:00.000Z'),
    reference: 'REVERSAL-BANK-001',
    status: PlacementPaymentStatus.RECORDED,
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
  const claimRecoveryApproval = {
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
    notes: null,
    createdAt: new Date('2026-07-31T10:00:00.000Z'),
    counterparty: {
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      name: 'Reliable Re',
      registrationNumber: null,
    },
  };
  const claimRecoveryReceipt = {
    id: 'recovery-receipt-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    allocationId: 'allocation-1',
    cashCallId: 'cash-call-1',
    recoveryApprovalId: 'recovery-approval-1',
    counterpartyId: 'reinsurer-1',
    currency: 'GHS',
    amount: new Prisma.Decimal('40000.00'),
    paymentDate: new Date('2026-08-10T10:00:00.000Z'),
    reference: 'REC-001',
    settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
    settlementCurrency: 'GHS',
    agreedExchangeRate: null,
    status: PlacementClaimRecoveryReceiptStatus.RECORDED,
    reversalOfReceiptId: null,
    bankConfirmedAt: null,
    createdAt: new Date('2026-08-10T10:00:00.000Z'),
    placement: {
      id: 'placement-1',
      reference: 'FAC-001',
      policyNumber: 'POL-001',
      title: 'Factory Fire Risk',
    },
    claim: {
      id: 'claim-1',
      claimNumber: 'CLM-001',
    },
    counterparty: {
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      name: 'Reliable Re',
      registrationNumber: null,
    },
  };
  const bankConfirmedRecoveryReceipt = {
    ...claimRecoveryReceipt,
    status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
    bankConfirmedAt: new Date('2026-08-10T12:00:00.000Z'),
  };
  const claimCedantSettlement = {
    id: 'cedant-settlement-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    payableApprovalId: 'approval-1',
    currency: 'GHS',
    amount: new Prisma.Decimal('30000.00'),
    settlementDate: new Date('2026-08-11T10:00:00.000Z'),
    reference: 'CED-SET-001',
    settlementMethod: PlacementSettlementMethod.BANK_TRANSFER,
    settlementCurrency: 'GHS',
    agreedExchangeRate: null,
    bankReference: null,
    bankConfirmedAt: null,
    status: PlacementClaimCedantSettlementStatus.RECORDED,
    reversalOfSettlementId: null,
    createdAt: new Date('2026-08-11T10:00:00.000Z'),
    placement: {
      id: 'placement-1',
      reference: 'FAC-001',
      policyNumber: 'POL-001',
      title: 'Factory Fire Risk',
      cedant: {
        id: 'cedant-1',
        type: CounterpartyType.CEDANT,
        name: 'Acme Insurance',
        registrationNumber: null,
      },
    },
    claim: {
      id: 'claim-1',
      claimNumber: 'CLM-001',
    },
  };
  const bankConfirmedClaimCedantSettlement = {
    ...claimCedantSettlement,
    status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
    bankReference: 'BANK-CED-001',
    bankConfirmedAt: new Date('2026-08-11T12:00:00.000Z'),
  };

  const makeService = (
    notes: unknown[] = [issuedNote],
    existingOutbox: unknown[] = [],
    payments: unknown[] = [payment],
    approvals: unknown[] = [claimPayableApproval],
    recoveryApprovals: unknown[] = [claimRecoveryApproval],
    recoveryReceipts: unknown[] = [],
    cedantSettlements: unknown[] = [],
  ) => {
    const prisma: {
      placementNote: {
        findMany: jest.Mock<Promise<unknown[]>, [PlacementNoteFindManyArg]>;
      };
      placementPayment: {
        findMany: jest.Mock<Promise<unknown[]>, [PlacementPaymentFindManyArg]>;
      };
      placementClaimPayableApproval: {
        findMany: jest.Mock<
          Promise<unknown[]>,
          [ClaimPayableApprovalFindManyArg]
        >;
      };
      placementClaimRecoveryApproval: {
        findMany: jest.Mock<
          Promise<unknown[]>,
          [ClaimRecoveryApprovalFindManyArg]
        >;
      };
      placementClaimRecoveryReceipt: {
        findMany: jest.Mock<
          Promise<unknown[]>,
          [ClaimRecoveryReceiptFindManyArg]
        >;
      };
      placementClaimCedantSettlement: {
        findMany: jest.Mock<
          Promise<unknown[]>,
          [ClaimCedantSettlementFindManyArg]
        >;
      };
      reinsuranceAccountingOutbox: { findMany: jest.Mock };
      $transaction: jest.Mock;
    } = {
      placementNote: {
        findMany: jest
          .fn<Promise<unknown[]>, [PlacementNoteFindManyArg]>()
          .mockResolvedValue(notes),
      },
      placementPayment: {
        findMany: jest
          .fn<Promise<unknown[]>, [PlacementPaymentFindManyArg]>()
          .mockResolvedValue(payments),
      },
      placementClaimPayableApproval: {
        findMany: jest
          .fn<Promise<unknown[]>, [ClaimPayableApprovalFindManyArg]>()
          .mockResolvedValue(approvals),
      },
      placementClaimRecoveryApproval: {
        findMany: jest
          .fn<Promise<unknown[]>, [ClaimRecoveryApprovalFindManyArg]>()
          .mockResolvedValue(recoveryApprovals),
      },
      placementClaimRecoveryReceipt: {
        findMany: jest
          .fn<Promise<unknown[]>, [ClaimRecoveryReceiptFindManyArg]>()
          .mockResolvedValue(recoveryReceipts),
      },
      placementClaimCedantSettlement: {
        findMany: jest
          .fn<Promise<unknown[]>, [ClaimCedantSettlementFindManyArg]>()
          .mockResolvedValue(cedantSettlements),
      },
      reinsuranceAccountingOutbox: {
        findMany: jest.fn().mockResolvedValue(existingOutbox),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(prisma),
    );
    const client = {
      configurationStatus: jest.fn().mockReturnValue({
        configured: true,
        baseUrlConfigured: true,
        serviceAuthSecretConfigured: true,
      }),
      checkReinsuranceReadiness: jest.fn().mockResolvedValue({
        ready: false,
        checkedAt: '2026-08-11T12:00:00.000Z',
        eventResults: [
          {
            eventType: 'PREMIUM_PAYMENT_RECEIVED',
            ready: false,
            kind: 'CASH',
            controlDimension: 'CEDANT_PREMIUM_AR',
            requiredSubledgerType: 'CEDANT',
            reversalDependsOnOriginalRecognition: false,
            blockers: [{ code: 'POSTING_RULE_MISSING' }],
          },
          {
            eventType: 'DEBIT_NOTE_ISSUED',
            ready: true,
            kind: 'NON_CASH',
            controlDimension: 'CEDANT_PREMIUM_AR',
            requiredSubledgerType: 'CEDANT',
            reversalDependsOnOriginalRecognition: false,
            blockers: [],
          },
        ],
      }),
    };
    const outbox = {
      processPending: jest.fn(),
    };
    const financialEvents = {
      prepareDebitNoteIssued: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'DEBIT_NOTE_ISSUED',
        sourceRecordType: 'PlacementNote',
        sourceRecordId: 'note-1',
        sourceDocumentId: 'note-1',
        idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { netPremium: 8500 } },
      }),
      prepareCreditNoteIssued: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CREDIT_NOTE_ISSUED',
        sourceRecordType: 'PlacementNote',
        sourceRecordId: 'credit-note-1',
        sourceDocumentId: 'credit-note-1',
        idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { creditMagnitude: 8500 } },
      }),
      prepareEndorsementDebitNoteIssued: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
        sourceRecordType: 'PlacementNote',
        sourceRecordId: 'endorsement-debit-note-1',
        sourceDocumentId: 'endorsement-debit-note-1',
        idempotencyKey:
          'reinsurance:endorsement-debit-note:endorsement-debit-note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { adjustmentMagnitude: 8500 } },
      }),
      prepareEndorsementCreditNoteIssued: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
        sourceRecordType: 'PlacementNote',
        sourceRecordId: 'endorsement-credit-note-1',
        sourceDocumentId: 'endorsement-credit-note-1',
        idempotencyKey:
          'reinsurance:endorsement-credit-note:endorsement-credit-note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { returnPremiumMagnitude: 8500 } },
      }),
      preparePremiumPaymentReceived: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
        sourceRecordType: 'PlacementPayment',
        sourceRecordId: 'payment-1',
        sourceDocumentId: 'payment-1',
        idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
        occurredAt: '2026-06-06T09:15:00.000Z',
        currency: 'GHS',
        payload: { amounts: { paymentAmount: 1000 } },
      }),
      preparePaymentReversed: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'PAYMENT_REVERSED',
        sourceRecordType: 'PlacementPayment',
        sourceRecordId: 'payment-reversal-1',
        sourceDocumentId: 'payment-reversal-1',
        idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
        occurredAt: '2026-06-06T10:30:00.000Z',
        currency: 'GHS',
        payload: { amounts: { paymentAmount: 1000 } },
      }),
      prepareReinsurerDisbursementRecorded: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
        sourceRecordType: 'PlacementPayment',
        sourceRecordId: 'payment-disbursement-1',
        sourceDocumentId: 'payment-disbursement-1',
        idempotencyKey:
          'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
        occurredAt: '2026-06-07T10:00:00.000Z',
        currency: 'USD',
        payload: { amounts: { paymentAmount: 750 } },
      }),
      prepareReinsurerDisbursementReversed: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'REINSURER_DISBURSEMENT_REVERSED',
        sourceRecordType: 'PlacementPayment',
        sourceRecordId: 'payment-disbursement-reversal-1',
        sourceDocumentId: 'payment-disbursement-reversal-1',
        idempotencyKey:
          'reinsurance:reinsurer-disbursement:payment-disbursement-reversal-1:reversal:v1',
        occurredAt: '2026-06-08T10:00:00.000Z',
        currency: 'USD',
        payload: { amounts: { paymentAmount: 750 } },
      }),
      prepareClaimPayableApproved: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CLAIM_PAYABLE_APPROVED',
        sourceRecordType: 'PlacementClaimPayableApproval',
        sourceRecordId: 'approval-1',
        sourceDocumentId: 'claim-1',
        idempotencyKey: 'reinsurance:claim:claim-1:payable-approved:1:v1',
        occurredAt: '2026-07-30T10:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { approvedPayableAmount: 90000 } },
      }),
      prepareClaimRecoveryApproved: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CLAIM_RECOVERY_APPROVED',
        sourceRecordType: 'PlacementClaimRecoveryApproval',
        sourceRecordId: 'recovery-approval-1',
        sourceDocumentId: 'claim-1',
        idempotencyKey:
          'reinsurance:claim-recovery:recovery-approval-1:approved:v1',
        occurredAt: '2026-07-31T10:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { approvedRecoveryAmount: 40000 } },
      }),
      prepareClaimRecoveryReceived: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CLAIM_RECOVERY_RECEIVED',
        sourceRecordType: 'PlacementClaimRecoveryReceipt',
        sourceRecordId: 'recovery-receipt-1',
        sourceDocumentId: 'claim-1',
        idempotencyKey:
          'reinsurance:claim-recovery-receipt:recovery-receipt-1:confirmed:v1',
        occurredAt: '2026-08-10T12:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { receiptAmount: 40000 } },
      }),
      prepareClaimRecoveryReceiptReversed: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CLAIM_RECOVERY_RECEIPT_REVERSED',
        sourceRecordType: 'PlacementClaimRecoveryReceipt',
        sourceRecordId: 'recovery-receipt-reversal-1',
        sourceDocumentId: 'recovery-receipt-1',
        idempotencyKey:
          'reinsurance:claim-recovery-receipt:recovery-receipt-reversal-1:reversal:v1',
        occurredAt: '2026-08-10T12:30:00.000Z',
        currency: 'GHS',
        payload: { amounts: { reversalAmount: 40000 } },
      }),
      prepareClaimCedantSettlementPaid: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CLAIM_CEDANT_SETTLEMENT_PAID',
        sourceRecordType: 'PlacementClaimCedantSettlement',
        sourceRecordId: 'cedant-settlement-1',
        sourceDocumentId: 'claim-1',
        idempotencyKey:
          'reinsurance:claim-cedant-settlement:cedant-settlement-1:confirmed:v1',
        occurredAt: '2026-08-11T12:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { settlementAmount: 30000 } },
      }),
      prepareClaimCedantSettlementReversed: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CLAIM_CEDANT_SETTLEMENT_REVERSED',
        sourceRecordType: 'PlacementClaimCedantSettlement',
        sourceRecordId: 'cedant-settlement-reversal-1',
        sourceDocumentId: 'cedant-settlement-1',
        idempotencyKey:
          'reinsurance:claim-cedant-settlement:cedant-settlement-reversal-1:reversal:v1',
        occurredAt: '2026-08-11T12:30:00.000Z',
        currency: 'GHS',
        payload: { amounts: { reversalAmount: 30000 } },
      }),
      enqueuePreparedEvent: jest.fn().mockResolvedValue({
        id: 'outbox-1',
        status: ReinsuranceAccountingOutboxStatus.PENDING,
        accountingSourceEventId: null,
      }),
    };
    const service = new ReinsuranceAccountingReadinessService(
      prisma as unknown as PrismaService,
      client as unknown as ReinsuranceAccountingClient,
      outbox as unknown as ReinsuranceAccountingOutboxService,
      financialEvents as unknown as ReinsuranceFinancialEventPublisher,
    );

    return { client, financialEvents, prisma, service };
  };

  it('reports Accounting integration status with grouped posting readiness', async () => {
    const { client, service } = makeService();

    const result = await service.status(user);

    const checkReinsuranceReadiness =
      client.checkReinsuranceReadiness as jest.MockedFunction<
        (request: {
          tenantId: string;
          eventTypes: string[];
        }) => Promise<unknown>
      >;
    const readinessRequest = checkReinsuranceReadiness.mock.calls[0]?.[0];
    expect(readinessRequest?.tenantId).toBe('tenant-1');
    expect(readinessRequest?.eventTypes).toEqual(
      expect.arrayContaining([
        'DEBIT_NOTE_ISSUED',
        'CREDIT_NOTE_ISSUED',
        'PREMIUM_PAYMENT_RECEIVED',
        'REINSURER_DISBURSEMENT_RECORDED',
      ]),
    );
    expect(readinessRequest?.eventTypes).not.toEqual(
      expect.arrayContaining(['CLAIM_PAYABLE_APPROVED']),
    );
    expect(result.integrationConfigured).toBe(true);
    expect(result.postingReadiness).toMatchObject({
      ready: false,
      checkedAt: '2026-08-11T12:00:00.000Z',
    });
    expect(result.readinessGroups).toMatchObject({
      premiumAccounting: {
        ready: true,
      },
      cashConfirmation: {
        ready: false,
      },
    });
    expect(result.readinessGroups).not.toHaveProperty('claimsAccounting');
  });

  it('dry-runs issued debit notes missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService();

    const result = await service.reconcileDebitNoteIssuedEvents(user, {
      dryRun: true,
      limit: 10,
    });

    const findManyArg = prisma.placementNote.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementNote.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementNoteType.DEBIT_NOTE,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: { not: null },
    });
    expect(result.accountingEnabled).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.inspectedCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.enqueuedCount).toBe(0);
    expect(result.items[0]).toMatchObject({
      noteId: 'note-1',
      status: 'MISSING',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('does not report notes that already have matching outbox events', async () => {
    const { service } = makeService(
      [issuedNote],
      [
        {
          id: 'outbox-1',
          idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
          status: ReinsuranceAccountingOutboxStatus.DELIVERED,
          accountingSourceEventId: 'accounting-event-1',
        },
      ],
    );

    const result = await service.reconcileDebitNoteIssuedEvents(user, {
      dryRun: true,
    });

    expect(result).toMatchObject({
      missingCount: 0,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          noteId: 'note-1',
          status: 'PRESENT',
          outboxId: 'outbox-1',
          accountingSourceEventId: 'accounting-event-1',
        }),
      ],
    });
  });

  it('enqueues missing debit-note events explicitly with the original business date', async () => {
    const { financialEvents, service } = makeService();

    const result = await service.reconcileDebitNoteIssuedEvents(user, {
      dryRun: false,
    });

    expect(financialEvents.prepareDebitNoteIssued).toHaveBeenCalledWith(
      user,
      issuedNote,
      issuedNote.issuedAt,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      missingCount: 0,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          noteId: 'note-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('does not inspect or enqueue events when Accounting is disabled', async () => {
    const { financialEvents, prisma, service } = makeService();
    const disabledUser = {
      ...user,
      moduleConfig: { accounting: false },
    } as RequestUser;

    const result = await service.reconcileDebitNoteIssuedEvents(disabledUser, {
      dryRun: false,
    });

    expect(result).toMatchObject({
      accountingEnabled: false,
      inspectedCount: 0,
      enqueuedCount: 0,
    });
    expect(prisma.placementNote.findMany).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('dry-runs issued credit notes missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService([
      issuedCreditNote,
    ]);

    const result = await service.reconcileCreditNoteIssuedEvents(user, {
      dryRun: true,
      limit: 10,
    });

    const findManyArg = prisma.placementNote.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementNote.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: { not: null },
    });
    expect(result).toMatchObject({
      accountingEnabled: true,
      dryRun: true,
      inspectedCount: 1,
      missingCount: 1,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          noteId: 'credit-note-1',
          noteNumber: 'CN-001',
          status: 'MISSING',
          idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
        }),
      ],
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('enqueues missing credit-note events explicitly with the original business date', async () => {
    const { financialEvents, service } = makeService([issuedCreditNote]);

    const result = await service.reconcileCreditNoteIssuedEvents(user, {
      dryRun: false,
    });

    expect(financialEvents.prepareCreditNoteIssued).toHaveBeenCalledWith(
      user,
      issuedCreditNote,
      issuedCreditNote.issuedAt,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      missingCount: 0,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          noteId: 'credit-note-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('does not report credit notes that already have matching outbox events', async () => {
    const { service } = makeService(
      [issuedCreditNote],
      [
        {
          id: 'outbox-1',
          idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
          status: ReinsuranceAccountingOutboxStatus.DELIVERED,
          accountingSourceEventId: 'accounting-event-1',
        },
      ],
    );

    const result = await service.reconcileCreditNoteIssuedEvents(user, {
      dryRun: true,
    });

    expect(result).toMatchObject({
      missingCount: 0,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          noteId: 'credit-note-1',
          status: 'PRESENT',
          outboxId: 'outbox-1',
          accountingSourceEventId: 'accounting-event-1',
        }),
      ],
    });
  });

  it('dry-runs issued endorsement debit notes missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService([
      issuedEndorsementDebitNote,
    ]);

    const result = await service.reconcileEndorsementDebitNoteIssuedEvents(
      user,
      {
        dryRun: true,
        limit: 10,
      },
    );

    const findManyArg = prisma.placementNote.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementNote.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: { not: null },
      endorsementId: { not: null },
    });
    expect(result).toMatchObject({
      accountingEnabled: true,
      dryRun: true,
      inspectedCount: 1,
      missingCount: 1,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          noteId: 'endorsement-debit-note-1',
          noteNumber: 'EDN-001',
          endorsementId: 'endorsement-1',
          status: 'MISSING',
          idempotencyKey:
            'reinsurance:endorsement-debit-note:endorsement-debit-note-1:issued:v1',
        }),
      ],
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('enqueues missing endorsement debit-note events with the original business date', async () => {
    const { financialEvents, service } = makeService([
      issuedEndorsementDebitNote,
    ]);

    const result = await service.reconcileEndorsementDebitNoteIssuedEvents(
      user,
      { dryRun: false },
    );

    expect(
      financialEvents.prepareEndorsementDebitNoteIssued,
    ).toHaveBeenCalledWith(
      user,
      issuedEndorsementDebitNote,
      issuedEndorsementDebitNote.issuedAt,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey:
          'reinsurance:endorsement-debit-note:endorsement-debit-note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      missingCount: 0,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          noteId: 'endorsement-debit-note-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('dry-runs issued endorsement credit notes missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService([
      issuedEndorsementCreditNote,
    ]);

    const result = await service.reconcileEndorsementCreditNoteIssuedEvents(
      user,
      {
        dryRun: true,
        limit: 10,
      },
    );

    const findManyArg = prisma.placementNote.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementNote.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: { not: null },
      endorsementId: { not: null },
      endorsementClosingId: { not: null },
    });
    expect(result).toMatchObject({
      accountingEnabled: true,
      dryRun: true,
      inspectedCount: 1,
      missingCount: 1,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          noteId: 'endorsement-credit-note-1',
          noteNumber: 'ECN-001',
          endorsementId: 'endorsement-1',
          endorsementClosingId: 'endorsement-closing-1',
          status: 'MISSING',
          idempotencyKey:
            'reinsurance:endorsement-credit-note:endorsement-credit-note-1:issued:v1',
        }),
      ],
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('enqueues missing endorsement credit-note events with the original business date', async () => {
    const { financialEvents, service } = makeService([
      issuedEndorsementCreditNote,
    ]);

    const result = await service.reconcileEndorsementCreditNoteIssuedEvents(
      user,
      { dryRun: false },
    );

    expect(
      financialEvents.prepareEndorsementCreditNoteIssued,
    ).toHaveBeenCalledWith(
      user,
      issuedEndorsementCreditNote,
      issuedEndorsementCreditNote.issuedAt,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey:
          'reinsurance:endorsement-credit-note:endorsement-credit-note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      missingCount: 0,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          noteId: 'endorsement-credit-note-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('dry-runs recorded premium payments missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService();

    const result = await service.reconcilePremiumPaymentReceivedEvents(user, {
      dryRun: true,
      limit: 10,
    });

    const findManyArg = prisma.placementPayment.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementPayment.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      reversalOfPaymentId: null,
    });
    expect(result).toMatchObject({
      accountingEnabled: true,
      dryRun: true,
      inspectedCount: 1,
      missingCount: 1,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          paymentId: 'payment-1',
          eventType: 'PREMIUM_PAYMENT_RECEIVED',
          status: 'MISSING',
          idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
        }),
      ],
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('enqueues missing premium payment events with their payment date', async () => {
    const { financialEvents, service } = makeService();

    const result = await service.reconcilePremiumPaymentReceivedEvents(user, {
      dryRun: false,
    });

    expect(financialEvents.preparePremiumPaymentReceived).toHaveBeenCalledWith(
      user,
      payment,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
        occurredAt: '2026-06-06T09:15:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          paymentId: 'payment-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('dry-runs reversal payment rows missing their deterministic outbox row', async () => {
    const { financialEvents, service } = makeService(
      [issuedNote],
      [],
      [reversalPayment],
    );

    const result = await service.reconcilePaymentReversedEvents(user, {
      dryRun: true,
    });

    expect(result).toMatchObject({
      inspectedCount: 1,
      missingCount: 1,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          paymentId: 'payment-reversal-1',
          originalPaymentId: 'payment-1',
          eventType: 'PAYMENT_REVERSED',
          status: 'MISSING',
          idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
        }),
      ],
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('enqueues missing reversal events with their reversal payment date', async () => {
    const { financialEvents, service } = makeService(
      [issuedNote],
      [],
      [reversalPayment],
    );

    const result = await service.reconcilePaymentReversedEvents(user, {
      dryRun: false,
    });

    expect(financialEvents.preparePaymentReversed).toHaveBeenCalledWith(
      user,
      reversalPayment,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
        occurredAt: '2026-06-06T10:30:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          paymentId: 'payment-reversal-1',
          status: 'ENQUEUED',
        }),
      ],
    });
  });

  it('dry-runs bank-confirmed reinsurer disbursements missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService(
      [],
      [],
      [reinsurerDisbursement],
    );

    const result = await service.reconcileReinsurerDisbursementRecordedEvents(
      user,
      { dryRun: true, limit: 10 },
    );

    const findManyArg = prisma.placementPayment.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementPayment.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      reversalOfPaymentId: null,
      bankConfirmedAt: { not: null },
    });
    expect(result).toMatchObject({
      accountingEnabled: true,
      dryRun: true,
      inspectedCount: 1,
      missingCount: 1,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          paymentId: 'payment-disbursement-1',
          eventType: 'REINSURER_DISBURSEMENT_RECORDED',
          status: 'MISSING',
          idempotencyKey:
            'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
        }),
      ],
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('enqueues missing reinsurer disbursement events through the shared builder', async () => {
    const { financialEvents, service } = makeService(
      [],
      [],
      [reinsurerDisbursement],
    );

    const result = await service.reconcileReinsurerDisbursementRecordedEvents(
      user,
      { dryRun: false },
    );

    expect(
      financialEvents.prepareReinsurerDisbursementRecorded,
    ).toHaveBeenCalledWith(user, reinsurerDisbursement);
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
        idempotencyKey:
          'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
        occurredAt: '2026-06-07T10:00:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      missingCount: 0,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          paymentId: 'payment-disbursement-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('does not report reinsurer disbursements that already have matching outbox events', async () => {
    const { service } = makeService(
      [],
      [
        {
          id: 'outbox-1',
          idempotencyKey:
            'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
          status: ReinsuranceAccountingOutboxStatus.DELIVERED,
          accountingSourceEventId: 'accounting-event-1',
        },
      ],
      [reinsurerDisbursement],
    );

    const result = await service.reconcileReinsurerDisbursementRecordedEvents(
      user,
      { dryRun: true },
    );

    expect(result).toMatchObject({
      missingCount: 0,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          paymentId: 'payment-disbursement-1',
          status: 'PRESENT',
          outboxId: 'outbox-1',
          accountingSourceEventId: 'accounting-event-1',
        }),
      ],
    });
  });

  it('dry-runs reversed reinsurer disbursements missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService(
      [],
      [],
      [reinsurerDisbursementReversal],
    );

    const result = await service.reconcileReinsurerDisbursementReversedEvents(
      user,
      { dryRun: true, limit: 10 },
    );

    const findManyArg = prisma.placementPayment.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementPayment.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.RECORDED,
      reversalOfPaymentId: { not: null },
    });
    expect(result).toMatchObject({
      accountingEnabled: true,
      dryRun: true,
      inspectedCount: 1,
      missingCount: 1,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          paymentId: 'payment-disbursement-reversal-1',
          originalPaymentId: 'payment-disbursement-1',
          eventType: 'REINSURER_DISBURSEMENT_REVERSED',
          status: 'MISSING',
          idempotencyKey:
            'reinsurance:reinsurer-disbursement:payment-disbursement-reversal-1:reversal:v1',
        }),
      ],
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('enqueues missing reversed reinsurer disbursement events through the shared builder', async () => {
    const { financialEvents, service } = makeService(
      [],
      [],
      [reinsurerDisbursementReversal],
    );

    const result = await service.reconcileReinsurerDisbursementReversedEvents(
      user,
      { dryRun: false },
    );

    expect(
      financialEvents.prepareReinsurerDisbursementReversed,
    ).toHaveBeenCalledWith(user, reinsurerDisbursementReversal);
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourceEventType: 'REINSURER_DISBURSEMENT_REVERSED',
        idempotencyKey:
          'reinsurance:reinsurer-disbursement:payment-disbursement-reversal-1:reversal:v1',
        occurredAt: '2026-06-08T10:00:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      missingCount: 0,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          paymentId: 'payment-disbursement-reversal-1',
          originalPaymentId: 'payment-disbursement-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('retires claim reconciliation so it cannot recreate claim outbox rows', () => {
    const { financialEvents, prisma, service } = makeService(
      [],
      [],
      [claimPayableApproval],
      [claimRecoveryApproval],
      [],
      [bankConfirmedRecoveryReceipt],
      [bankConfirmedClaimCedantSettlement],
    );

    const results = [
      service.reconcileClaimPayableApprovedEvents(user, { dryRun: false }),
      service.reconcileClaimRecoveryApprovedEvents(user, { dryRun: false }),
      service.reconcileClaimRecoveryReceivedEvents(user, { dryRun: false }),
      service.reconcileClaimRecoveryReceiptReversedEvents(user, {
        dryRun: false,
      }),
      service.reconcileClaimCedantSettlementPaidEvents(user, { dryRun: false }),
      service.reconcileClaimCedantSettlementReversedEvents(user, {
        dryRun: false,
      }),
    ];

    for (const result of results) {
      expect(result).toMatchObject({
        accountingEnabled: true,
        dryRun: false,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
      });
      expect(result.message).toContain('retired by product policy');
    }
    expect(
      prisma.placementClaimPayableApproval.findMany,
    ).not.toHaveBeenCalled();
    expect(
      prisma.placementClaimRecoveryApproval.findMany,
    ).not.toHaveBeenCalled();
    expect(
      prisma.placementClaimRecoveryReceipt.findMany,
    ).not.toHaveBeenCalled();
    expect(
      prisma.placementClaimCedantSettlement.findMany,
    ).not.toHaveBeenCalled();
    expect(financialEvents.prepareClaimPayableApproved).not.toHaveBeenCalled();
    expect(financialEvents.prepareClaimRecoveryApproved).not.toHaveBeenCalled();
    expect(financialEvents.prepareClaimRecoveryReceived).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareClaimRecoveryReceiptReversed,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareClaimCedantSettlementPaid,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareClaimCedantSettlementReversed,
    ).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });
});
