import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimCedantSettlementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceAccountingEventInput } from '../events/accounting-event.builder';
import { ReinsuranceFinancialEventPublisher } from '../events/financial-event.publisher';
import {
  ReinsuranceAccountingClient,
  ReinsuranceAccountingClientError,
  ReinsuranceAccountingEventReadiness,
  ReinsuranceAccountingReadinessResponse,
} from '../client/accounting.client';
import {
  ProcessAccountingOutboxOptions,
  ReinsuranceAccountingOutboxService,
} from '../outbox/outbox.service';

type CounterpartyRecord = Prisma.CounterpartyGetPayload<object>;

const paymentReconciliationInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  placement: {
    select: {
      id: true,
      reference: true,
      policyNumber: true,
      title: true,
      cedantId: true,
    },
  },
  reversalOfPayment: {
    select: {
      id: true,
      amount: true,
      currency: true,
      paymentDate: true,
      reference: true,
      status: true,
    },
  },
  closing: {
    select: {
      id: true,
      closingNumber: true,
      netPremium: true,
      currency: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
      netPremium: true,
      currency: true,
      endorsementId: true,
      endorsement: {
        select: {
          id: true,
          endorsementNumber: true,
          effectiveDate: true,
          type: true,
        },
      },
    },
  },
  allocations: {
    include: {
      note: {
        select: {
          id: true,
          noteNumber: true,
          type: true,
          direction: true,
          status: true,
          currency: true,
          netAmount: true,
          nicLevyPercent: true,
          nicLevyAmount: true,
          withholdingTaxPercent: true,
          withholdingTaxAmount: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PlacementPaymentInclude;

type AccountingSubledgerSyncResult =
  | {
      status: 'DISABLED' | 'SKIPPED';
      accountingEnabled: boolean;
      message: string;
    }
  | {
      status: 'SYNCED';
      accountingEnabled: true;
      subledgerId: string;
      subledgerCode?: string;
      subledgerType?: string;
      externalRef: string;
    }
  | {
      status: 'FAILED';
      accountingEnabled: true;
      retryable: boolean;
      statusCode?: number;
      message: string;
    };

const ACTIVE_REINSURANCE_ACCOUNTING_EVENT_TYPES = [
  'DEBIT_NOTE_ISSUED',
  'CREDIT_NOTE_ISSUED',
  'ENDORSEMENT_DEBIT_NOTE_ISSUED',
  'ENDORSEMENT_CREDIT_NOTE_ISSUED',
  'PREMIUM_PAYMENT_RECEIVED',
  'PAYMENT_REVERSED',
  'REINSURER_DISBURSEMENT_RECORDED',
  'REINSURER_DISBURSEMENT_REVERSED',
] as const;

const REINSURANCE_ACCOUNTING_INTEGRATION = 'operations.reinsurance->accounting';

const READINESS_GROUPS = {
  premiumAccounting: [
    'DEBIT_NOTE_ISSUED',
    'CREDIT_NOTE_ISSUED',
    'ENDORSEMENT_DEBIT_NOTE_ISSUED',
    'ENDORSEMENT_CREDIT_NOTE_ISSUED',
  ],
  cashConfirmation: [
    'PREMIUM_PAYMENT_RECEIVED',
    'PAYMENT_REVERSED',
    'REINSURER_DISBURSEMENT_RECORDED',
    'REINSURER_DISBURSEMENT_REVERSED',
  ],
} as const;

@Injectable()
export class ReinsuranceAccountingReadinessService {
  private readonly logger = new Logger(
    ReinsuranceAccountingReadinessService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ReinsuranceAccountingClient,
    private readonly outbox: ReinsuranceAccountingOutboxService,
    private readonly financialEvents: ReinsuranceFinancialEventPublisher,
  ) {}

  async status(user: RequestUser) {
    const configuration = this.client.configurationStatus();
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const reinsuranceEnabled = Boolean(
      user.moduleConfig?.operations &&
      user.featureConfig?.operations?.reinsurance,
    );
    const integrationEnabled = Boolean(
      user.integrationConfig?.[REINSURANCE_ACCOUNTING_INTEGRATION],
    );
    const integrationActive =
      reinsuranceEnabled && accountingEnabled && integrationEnabled;
    const activeSourceEvents = integrationActive
      ? [...ACTIVE_REINSURANCE_ACCOUNTING_EVENT_TYPES]
      : [];
    const postingReadiness =
      integrationActive && configuration.configured
        ? await this.getPostingReadiness(user, activeSourceEvents)
        : null;
    return {
      accountingEnabled,
      reinsuranceEnabled,
      integrationEnabled,
      integrationActive,
      integrationConfigured: configuration.configured,
      baseUrlConfigured: configuration.baseUrlConfigured,
      serviceAuthSecretConfigured: configuration.serviceAuthSecretConfigured,
      sourceEventsActive: integrationActive,
      activeSourceEvents,
      postingReadiness,
      readinessGroups: postingReadiness
        ? this.groupPostingReadiness(postingReadiness.eventResults)
        : null,
      readinessMode:
        'Debit-note, credit-note, premium-payment and reinsurer-disbursement source-event capture, PostingRule preflight, counterparty subledger readiness and outbox dispatch. Reinsurance Claims are financially controlled inside Reinsurance and do not post to Accounting.',
      message:
        !reinsuranceEnabled || !accountingEnabled
          ? 'Reinsurance and Accounting are not both enabled for this tenant; they operate independently.'
          : !integrationEnabled
            ? 'Reinsurance and Accounting are intentionally disconnected for this tenant.'
            : configuration.configured
              ? postingReadiness?.ready
                ? 'Accounting integration is configured and posting readiness preflight is passing for active Reinsurance event families.'
                : 'Accounting integration is configured, but one or more active Reinsurance event families are not posting-ready.'
              : 'Reinsurance Accounting integration is enabled, but delivery is missing Accounting integration configuration.',
    };
  }

  private async getPostingReadiness(
    user: RequestUser,
    activeSourceEvents: string[],
  ): Promise<
    | ReinsuranceAccountingReadinessResponse
    | {
        ready: false;
        checkedAt: string;
        eventResults: ReinsuranceAccountingEventReadiness[];
        message: string;
      }
  > {
    try {
      return await this.client.checkReinsuranceReadiness({
        tenantId: user.tenantId,
        eventTypes: activeSourceEvents,
      });
    } catch (error) {
      const failure = this.failure(error);
      return {
        ready: false,
        checkedAt: new Date().toISOString(),
        eventResults: [],
        message: failure.retryable
          ? 'Accounting posting readiness could not be verified right now.'
          : failure.message,
      };
    }
  }

  private groupPostingReadiness(
    eventResults: ReinsuranceAccountingEventReadiness[],
  ) {
    return Object.fromEntries(
      Object.entries(READINESS_GROUPS).map(([group, eventTypes]) => {
        const events = eventResults.filter((event) =>
          (eventTypes as readonly string[]).includes(event.eventType),
        );
        return [
          group,
          {
            ready: events.length > 0 && events.every((event) => event.ready),
            events,
          },
        ];
      }),
    );
  }

  async syncCounterpartyById(user: RequestUser, counterpartyId: string) {
    const counterparty = await this.prisma.counterparty.findFirst({
      where: {
        id: counterpartyId,
        tenantId: user.tenantId,
        archivedAt: null,
      },
    });
    if (!counterparty) throw new NotFoundException('Counterparty not found');
    return this.syncCounterparty(user, counterparty);
  }

  async syncCounterparty(
    user: RequestUser,
    counterparty: CounterpartyRecord,
  ): Promise<AccountingSubledgerSyncResult> {
    const accountingEnabled = this.isIntegrationActive(user);
    if (!accountingEnabled) {
      return {
        status: 'DISABLED',
        accountingEnabled,
        message:
          'Reinsurance Accounting integration is disabled for this tenant; subledger sync skipped.',
      };
    }

    const subledgerType = this.subledgerType(counterparty.type);
    if (!subledgerType) {
      return {
        status: 'SKIPPED',
        accountingEnabled,
        message:
          'Only Cedant and Reinsurer counterparties require Accounting subledger readiness.',
      };
    }

    try {
      const subledger = await this.client.ensureSubledger({
        tenantId: counterparty.tenantId,
        type: subledgerType,
        externalRef: counterparty.id,
        name: counterparty.name,
        metadata: {
          sourceModule: 'REINSURANCE',
          sourceRecordType: 'Counterparty',
          sourceRecordId: counterparty.id,
          counterpartyType: counterparty.type,
        },
      });
      return {
        status: 'SYNCED',
        accountingEnabled,
        subledgerId: subledger.id,
        subledgerCode: subledger.code,
        subledgerType: subledger.type,
        externalRef: counterparty.id,
      };
    } catch (error) {
      const failure = this.failure(error);
      return {
        status: 'FAILED',
        accountingEnabled,
        ...failure,
      };
    }
  }

  async syncCounterpartyBestEffort(
    user: RequestUser,
    counterparty: CounterpartyRecord,
  ) {
    const result = await this.syncCounterparty(user, counterparty);
    if (result.status === 'FAILED') {
      this.logger.warn(
        `Accounting subledger readiness failed for counterparty ${counterparty.id}: ${result.message}`,
      );
    }
    return result;
  }

  processPending(user: RequestUser, options: ProcessAccountingOutboxOptions) {
    this.assertIntegrationActive(user);
    return this.outbox.processPending(this.prisma, {
      tenantId: user.tenantId,
      limit: options.limit,
    });
  }

  assertIntegrationActive(user: RequestUser): void {
    if (!this.isIntegrationActive(user)) {
      throw new ConflictException(
        'Reinsurance Accounting integration is disabled for this tenant.',
      );
    }
  }

  private isIntegrationActive(user: RequestUser): boolean {
    return Boolean(
      user.moduleConfig?.operations &&
      user.featureConfig?.operations?.reinsurance &&
      user.moduleConfig?.accounting &&
      user.integrationConfig?.[REINSURANCE_ACCOUNTING_INTEGRATION],
    );
  }

  async findPendingClaimRecoveryReceiptConfirmations(user: RequestUser) {
    const receipts = await this.prisma.placementClaimRecoveryReceipt.findMany({
      where: {
        tenantId: user.tenantId,
        status: PlacementClaimRecoveryReceiptStatus.RECORDED,
        reversalOfReceiptId: null,
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        placementId: true,
        claimId: true,
        allocationId: true,
        cashCallId: true,
        recoveryApprovalId: true,
        counterpartyId: true,
        currency: true,
        amount: true,
        paymentDate: true,
        reference: true,
        settlementMethod: true,
        settlementCurrency: true,
        agreedExchangeRate: true,
        status: true,
        createdAt: true,
        placement: {
          select: {
            id: true,
            reference: true,
            policyNumber: true,
            title: true,
          },
        },
        claim: {
          select: {
            id: true,
            claimNumber: true,
          },
        },
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: receipts.map((receipt) => ({
        id: `REINSURANCE_CLAIM_RECOVERY_RECEIPT:${receipt.id}`,
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'PlacementClaimRecoveryReceipt',
        sourceRecordId: receipt.id,
        sourceParentId: receipt.placementId,
        sourceReference: receipt.reference ?? receipt.id,
        action: 'CONFIRM_BANK_RECEIPT',
        direction: 'INBOUND',
        status: receipt.status,
        amount: receipt.amount.toString(),
        currency: receipt.currency,
        operationalDate: receipt.paymentDate.toISOString(),
        settlementMethod: receipt.settlementMethod,
        settlementCurrency: receipt.settlementCurrency ?? receipt.currency,
        agreedExchangeRate: receipt.agreedExchangeRate?.toString() ?? null,
        counterparty: receipt.counterparty,
        sourceDetailUrl: `/operations/reinsurance/facultative/${receipt.placementId}`,
        businessSnapshot: {
          placementId: receipt.placement.id,
          placementReference: receipt.placement.reference,
          policyNumber: receipt.placement.policyNumber,
          placementTitle: receipt.placement.title,
          claimId: receipt.claim.id,
          claimNumber: receipt.claim.claimNumber,
          allocationId: receipt.allocationId,
          cashCallId: receipt.cashCallId,
          recoveryApprovalId: receipt.recoveryApprovalId,
        },
      })),
    };
  }

  async findPendingClaimCedantSettlementConfirmations(user: RequestUser) {
    const settlements =
      await this.prisma.placementClaimCedantSettlement.findMany({
        where: {
          tenantId: user.tenantId,
          status: PlacementClaimCedantSettlementStatus.RECORDED,
          reversalOfSettlementId: null,
          placement: { archivedAt: null },
        },
        select: {
          id: true,
          placementId: true,
          claimId: true,
          payableApprovalId: true,
          currency: true,
          amount: true,
          settlementDate: true,
          reference: true,
          settlementMethod: true,
          settlementCurrency: true,
          agreedExchangeRate: true,
          status: true,
          createdAt: true,
          placement: {
            select: {
              id: true,
              reference: true,
              policyNumber: true,
              title: true,
              cedant: {
                select: {
                  id: true,
                  type: true,
                  name: true,
                  registrationNumber: true,
                },
              },
            },
          },
          claim: {
            select: {
              id: true,
              claimNumber: true,
            },
          },
        },
        orderBy: [{ settlementDate: 'desc' }, { createdAt: 'desc' }],
      });

    return {
      items: settlements.map((settlement) => ({
        id: `REINSURANCE_CLAIM_CEDANT_SETTLEMENT:${settlement.id}`,
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'PlacementClaimCedantSettlement',
        sourceRecordId: settlement.id,
        sourceParentId: settlement.placementId,
        sourceReference: settlement.reference ?? settlement.id,
        action: 'CONFIRM_BANK_PAYMENT',
        transactionType: 'CLAIM_CEDANT_SETTLEMENT',
        direction: 'OUTBOUND',
        status: settlement.status,
        amount: settlement.amount.toString(),
        currency: settlement.currency,
        operationalDate: settlement.settlementDate.toISOString(),
        settlementMethod: settlement.settlementMethod,
        settlementCurrency:
          settlement.settlementCurrency ?? settlement.currency,
        agreedExchangeRate: settlement.agreedExchangeRate?.toString() ?? null,
        counterparty: settlement.placement.cedant,
        sourceDetailUrl: `/operations/reinsurance/facultative/${settlement.placementId}`,
        businessSnapshot: {
          placementId: settlement.placement.id,
          placementReference: settlement.placement.reference,
          policyNumber: settlement.placement.policyNumber,
          placementTitle: settlement.placement.title,
          claimId: settlement.claim.id,
          claimNumber: settlement.claim.claimNumber,
          payableApprovalId: settlement.payableApprovalId,
        },
      })),
    };
  }

  async reconcileDebitNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no debit-note events are captured in Phase 1.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.DEBIT_NOTE,
        direction: PlacementNoteDirection.CEDANT_TO_BROKER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) => this.debitNoteIdempotencyKey(note.id));
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.debitNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event = await this.financialEvents.prepareDebitNoteIssued(
        user,
        note,
        issuedAt,
      );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcileCreditNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no credit-note events are captured in Phase 1.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.CREDIT_NOTE,
        direction: PlacementNoteDirection.BROKER_TO_REINSURER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
        closing: {
          select: {
            id: true,
            closingNumber: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) => this.creditNoteIdempotencyKey(note.id));
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.creditNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event = await this.financialEvents.prepareCreditNoteIssued(
        user,
        note,
        issuedAt,
      );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcileEndorsementDebitNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no endorsement debit-note events are captured.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        direction: PlacementNoteDirection.CEDANT_TO_BROKER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        endorsementId: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
        endorsement: {
          select: {
            id: true,
            endorsementNumber: true,
            type: true,
            impactType: true,
            effectiveDate: true,
            status: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) =>
      this.endorsementDebitNoteIdempotencyKey(note.id),
    );
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      endorsementId?: string | null;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.endorsementDebitNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event =
        await this.financialEvents.prepareEndorsementDebitNoteIssued(
          user,
          note,
          issuedAt,
        );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        endorsementId: note.endorsementId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcileEndorsementCreditNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no endorsement credit-note events are captured.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        direction: PlacementNoteDirection.BROKER_TO_REINSURER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        endorsementId: { not: null },
        endorsementClosingId: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
        endorsement: {
          select: {
            id: true,
            endorsementNumber: true,
            type: true,
            impactType: true,
            effectiveDate: true,
            status: true,
          },
        },
        endorsementClosing: {
          select: {
            id: true,
            closingNumber: true,
            endorsementParticipantId: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) =>
      this.endorsementCreditNoteIdempotencyKey(note.id),
    );
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      endorsementId?: string | null;
      endorsementClosingId?: string | null;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.endorsementCreditNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          endorsementClosingId: note.endorsementClosingId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          endorsementClosingId: note.endorsementClosingId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event =
        await this.financialEvents.prepareEndorsementCreditNoteIssued(
          user,
          note,
          issuedAt,
        );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        endorsementId: note.endorsementId,
        endorsementClosingId: note.endorsementClosingId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcilePremiumPaymentReceivedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no premium payment events are captured in Phase 1.',
      eventType: 'PREMIUM_PAYMENT_RECEIVED',
      idempotencyKey: (paymentId) =>
        this.premiumPaymentReceivedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: null,
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.preparePremiumPaymentReceived(user, payment),
    });
  }

  async reconcilePaymentReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no payment reversal events are captured in Phase 1.',
      eventType: 'PAYMENT_REVERSED',
      idempotencyKey: (paymentId) =>
        this.paymentReversedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        status: PlacementPaymentStatus.RECORDED,
        reversalOfPaymentId: { not: null },
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.preparePaymentReversed(user, payment),
    });
  }

  async reconcileReinsurerDisbursementRecordedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no reinsurer disbursement events are captured.',
      eventType: 'REINSURER_DISBURSEMENT_RECORDED',
      idempotencyKey: (paymentId) =>
        this.reinsurerDisbursementRecordedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: null,
        bankConfirmedAt: { not: null },
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.prepareReinsurerDisbursementRecorded(
          user,
          payment,
        ),
    });
  }

  async reconcileReinsurerDisbursementReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no reinsurer disbursement reversal events are captured.',
      eventType: 'REINSURER_DISBURSEMENT_REVERSED',
      idempotencyKey: (paymentId) =>
        this.reinsurerDisbursementReversedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        status: PlacementPaymentStatus.RECORDED,
        reversalOfPaymentId: { not: null },
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.prepareReinsurerDisbursementReversed(
          user,
          payment,
        ),
    });
  }

  reconcileClaimPayableApprovedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.retiredClaimReconciliationResult(user, options);
  }

  reconcileClaimRecoveryApprovedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.retiredClaimReconciliationResult(user, options);
  }

  reconcileClaimCedantSettlementPaidEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.retiredClaimReconciliationResult(user, options);
  }

  reconcileClaimCedantSettlementReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.retiredClaimReconciliationResult(user, options);
  }

  reconcileClaimRecoveryReceivedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.retiredClaimReconciliationResult(user, options);
  }

  reconcileClaimRecoveryReceiptReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.retiredClaimReconciliationResult(user, options);
  }

  private retiredClaimReconciliationResult(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return {
      accountingEnabled: Boolean(user.moduleConfig?.accounting),
      dryRun: options.dryRun ?? true,
      inspectedCount: 0,
      missingCount: 0,
      enqueuedCount: 0,
      items: [],
      message:
        'Reinsurance claim Accounting integration is retired by product policy; claim financial workflows are controlled inside Reinsurance.',
    };
  }

  private debitNoteIdempotencyKey(noteId: string) {
    return `reinsurance:debit-note:${noteId}:issued:v1`;
  }

  private creditNoteIdempotencyKey(noteId: string) {
    return `reinsurance:credit-note:${noteId}:issued:v1`;
  }

  private endorsementDebitNoteIdempotencyKey(noteId: string) {
    return `reinsurance:endorsement-debit-note:${noteId}:issued:v1`;
  }

  private endorsementCreditNoteIdempotencyKey(noteId: string) {
    return `reinsurance:endorsement-credit-note:${noteId}:issued:v1`;
  }

  private premiumPaymentReceivedIdempotencyKey(paymentId: string) {
    return `reinsurance:payment:${paymentId}:recorded:v1`;
  }

  private paymentReversedIdempotencyKey(paymentId: string) {
    return `reinsurance:payment:${paymentId}:reversal:v1`;
  }

  private reinsurerDisbursementRecordedIdempotencyKey(paymentId: string) {
    return `reinsurance:reinsurer-disbursement:${paymentId}:recorded:v1`;
  }

  private reinsurerDisbursementReversedIdempotencyKey(paymentId: string) {
    return `reinsurance:reinsurer-disbursement:${paymentId}:reversal:v1`;
  }

  private async reconcilePaymentEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
    config: {
      disabledMessage: string;
      eventType:
        | 'PREMIUM_PAYMENT_RECEIVED'
        | 'PAYMENT_REVERSED'
        | 'REINSURER_DISBURSEMENT_RECORDED'
        | 'REINSURER_DISBURSEMENT_REVERSED';
      idempotencyKey: (paymentId: string) => string;
      missingStatus: 'MISSING';
      presentStatus: 'PRESENT';
      enqueuedStatus: 'ENQUEUED';
      where: Prisma.PlacementPaymentWhereInput;
      prepare: (
        payment: Prisma.PlacementPaymentGetPayload<{
          include: typeof paymentReconciliationInclude;
        }>,
      ) =>
        | ReinsuranceAccountingEventInput
        | null
        | Promise<ReinsuranceAccountingEventInput | null>;
    },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message: config.disabledMessage,
      };
    }

    const payments = await this.prisma.placementPayment.findMany({
      where: config.where,
      include: paymentReconciliationInclude,
      orderBy: { paymentDate: 'asc' },
      take: limit,
    });
    const keys = payments.map((payment) => config.idempotencyKey(payment.id));
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      paymentId: string;
      originalPaymentId?: string | null;
      placementId: string;
      paymentDate: string;
      eventType: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const payment of payments) {
      const idempotencyKey = config.idempotencyKey(payment.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          paymentId: payment.id,
          originalPaymentId: payment.reversalOfPaymentId,
          placementId: payment.placementId,
          paymentDate: payment.paymentDate.toISOString(),
          eventType: config.eventType,
          idempotencyKey,
          status: config.presentStatus,
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          paymentId: payment.id,
          originalPaymentId: payment.reversalOfPaymentId,
          placementId: payment.placementId,
          paymentDate: payment.paymentDate.toISOString(),
          eventType: config.eventType,
          idempotencyKey,
          status: config.missingStatus,
        });
        continue;
      }

      const event = await config.prepare(payment);
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        paymentId: payment.id,
        originalPaymentId: payment.reversalOfPaymentId,
        placementId: payment.placementId,
        paymentDate: payment.paymentDate.toISOString(),
        eventType: config.eventType,
        idempotencyKey,
        status: config.enqueuedStatus,
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: payments.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  private subledgerType(
    counterpartyType: CounterpartyType,
  ): 'CEDANT' | 'REINSURER' | null {
    if (counterpartyType === CounterpartyType.CEDANT) return 'CEDANT';
    if (counterpartyType === CounterpartyType.REINSURER) return 'REINSURER';
    return null;
  }

  private failure(error: unknown): {
    message: string;
    retryable: boolean;
    statusCode?: number;
  } {
    if (error instanceof ReinsuranceAccountingClientError) {
      return {
        message: error.message,
        retryable: error.retryable,
        statusCode: error.statusCode,
      };
    }
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Unexpected Accounting readiness failure',
      retryable: true,
    };
  }
}
