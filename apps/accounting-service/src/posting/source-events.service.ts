import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingSettlementMethod,
  CashbookDirection,
  FiscalPeriodStatus,
  PostingDirection,
  Prisma,
  RecordStatus,
  SourceEventStatus,
} from '../../prisma/generated/client';
import { CashbookService } from '../ledger/cashbook.service';
import { CreateJournalDto, JournalLineDto } from '../ledger/dto/accounting.dto';
import { JournalsService } from '../ledger/journals.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSourceEventDto,
  InternalSourceEventDto,
  ProcessPendingSourceEventsDto,
  QuerySourceEventsDto,
} from './dto/posting.dto';

const sourceEventInclude = {
  postingRule: {
    select: {
      id: true,
      name: true,
      sourceModule: true,
      sourceEventType: true,
      version: true,
    },
  },
  journalEntry: {
    select: {
      id: true,
      journalNumber: true,
      status: true,
      transactionDate: true,
      transactionCurrency: true,
      baseCurrency: true,
      postedAt: true,
    },
  },
  cashbookTransaction: {
    select: {
      id: true,
      status: true,
      transactionType: true,
      direction: true,
      amount: true,
      currency: true,
      cashAccountId: true,
      postedJournalEntryId: true,
    },
  },
} satisfies Prisma.SourceEventInboxInclude;

const postingRuleForEngineInclude = {
  lines: {
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.PostingRuleInclude;

type SourcePayload = Record<string, unknown>;
type EngineRule = Prisma.PostingRuleGetPayload<{
  include: typeof postingRuleForEngineInclude;
}>;
type SourceCashbookDirection = Extract<CashbookDirection, 'INFLOW' | 'OUTFLOW'>;

const PROCESSING_STALE_AFTER_MS = 15 * 60 * 1000;

type CashEventProfile = {
  direction: SourceCashbookDirection;
  cashImpactPath: string;
};

const CASH_EVENT_PROFILES: Record<string, CashEventProfile> = {
  'REINSURANCE:PREMIUM_PAYMENT_RECEIVED': {
    direction: 'INFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
  'REINSURANCE:PAYMENT_REVERSED': {
    direction: 'OUTFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
  'REINSURANCE:REINSURER_DISBURSEMENT_RECORDED': {
    direction: 'OUTFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
  'REINSURANCE:REINSURER_DISBURSEMENT_REVERSED': {
    direction: 'INFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
  'REINSURANCE:CLAIM_RECOVERY_RECEIVED': {
    direction: 'INFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
  'REINSURANCE:CLAIM_RECOVERY_RECEIPT_REVERSED': {
    direction: 'OUTFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
  'REINSURANCE:CLAIM_CEDANT_SETTLEMENT_PAID': {
    direction: 'OUTFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
  'REINSURANCE:CLAIM_CEDANT_SETTLEMENT_REVERSED': {
    direction: 'INFLOW',
    cashImpactPath: 'amounts.signedCashImpact',
  },
};

const CASH_ACCOUNT_ID_PATHS = [
  'settlement.cashAccountId',
  'settlement.accountingCashAccountId',
  'payment.accountingCashAccountId',
  'receipt.accountingCashAccountId',
  'cashbook.cashAccountId',
  'cashAccountId',
];

const SETTLEMENT_METHOD_PATHS = [
  'settlement.method',
  'settlement.settlementMethod',
  'payment.settlementMethod',
  'payment.method',
  'receipt.settlementMethod',
  'receipt.method',
];

const SETTLEMENT_CURRENCY_PATHS = [
  'settlement.currency',
  'settlement.settlementCurrency',
  'payment.settlementCurrency',
  'receipt.settlementCurrency',
  'currency',
];

const REFERENCE_PATHS = [
  'references.bankReference',
  'references.settlementReference',
  'references.paymentReference',
  'payment.bankReference',
  'payment.settlementReference',
  'payment.paymentReference',
];

const SUBLEDGER_NAME_PATHS = [
  'counterparty.name',
  'counterparty.legalName',
  'counterparty.tradingName',
];

@Injectable()
export class SourceEventsService {
  private readonly logger = new Logger(SourceEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cashbook: CashbookService,
    private readonly journals: JournalsService,
  ) {}

  async enqueueInternal(callingService: string, dto: InternalSourceEventDto) {
    const tenant = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId: dto.tenantId },
      select: { tenantId: true },
    });
    if (!tenant) {
      throw new NotFoundException(
        'Accounting tenant is not configured for source events',
      );
    }

    const data: Prisma.SourceEventInboxUncheckedCreateInput = {
      tenantId: dto.tenantId,
      sourceModule: dto.sourceModule,
      sourceEventType: dto.sourceEventType,
      sourceRecordId: dto.sourceRecordId,
      sourceDocumentId: dto.sourceDocumentId?.trim() || null,
      idempotencyKey: dto.idempotencyKey,
      payload: {
        ...dto.payload,
        transactionDate: dto.occurredAt,
        currency: dto.currency,
      } as Prisma.InputJsonObject,
      status: SourceEventStatus.RECEIVED,
      receivedByUserId: `service:${callingService}`,
    };

    try {
      return await this.prisma.sourceEventInbox.create({
        data,
        include: sourceEventInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.sourceEventInbox.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: dto.tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
          include: sourceEventInclude,
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async receive(user: RequestUser, dto: CreateSourceEventDto) {
    let event;
    try {
      event = await this.prisma.sourceEventInbox.create({
        data: {
          tenantId: user.tenantId,
          sourceModule: dto.sourceModule,
          sourceEventType: dto.sourceEventType,
          sourceRecordId: dto.sourceRecordId,
          sourceDocumentId: dto.sourceDocumentId?.trim() || null,
          idempotencyKey: dto.idempotencyKey,
          payload: dto.payload as Prisma.InputJsonObject,
          receivedByUserId: user.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.sourceEventInbox.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: user.tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
          select: { id: true, status: true },
        });
        throw new ConflictException({
          message: 'Source event idempotency key already exists',
          sourceEventId: existing?.id,
          status: existing?.status,
        });
      }
      throw error;
    }

    return this.process(user, event.id, SourceEventStatus.RECEIVED, false);
  }

  list(tenantId: string, query: QuerySourceEventsDto) {
    return this.prisma.sourceEventInbox.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
        ...(query.sourceEventType
          ? { sourceEventType: query.sourceEventType }
          : {}),
        ...(query.sourceRecordId
          ? { sourceRecordId: query.sourceRecordId }
          : {}),
      },
      include: sourceEventInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, eventId: string) {
    const event = await this.prisma.sourceEventInbox.findFirst({
      where: { id: eventId, tenantId },
      include: sourceEventInclude,
    });
    if (!event) throw new NotFoundException('Source event not found');
    return event;
  }

  async retry(user: RequestUser, eventId: string) {
    await this.findOne(user.tenantId, eventId);
    return this.process(user, eventId, SourceEventStatus.FAILED, true);
  }

  async processOne(user: RequestUser, eventId: string) {
    const event = await this.findOne(user.tenantId, eventId);

    if (event.status === SourceEventStatus.POSTED) return event;
    if (event.status === SourceEventStatus.RECEIVED) {
      return this.process(user, event.id, SourceEventStatus.RECEIVED, false);
    }
    if (event.status === SourceEventStatus.FAILED) {
      return this.process(user, event.id, SourceEventStatus.FAILED, true);
    }
    if (event.status === SourceEventStatus.PROCESSING) {
      await this.releaseStaleProcessingClaim(user.tenantId, event);
      return this.process(user, event.id, SourceEventStatus.FAILED, true);
    }

    return event;
  }

  async processPending(
    user: RequestUser,
    query: ProcessPendingSourceEventsDto,
  ) {
    const limit = Math.min(query.limit ?? 25, 100);
    const events = await this.prisma.sourceEventInbox.findMany({
      where: {
        tenantId: user.tenantId,
        status: SourceEventStatus.RECEIVED,
        ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
        ...(query.sourceEventType
          ? { sourceEventType: query.sourceEventType }
          : {}),
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const results: Array<{
      eventId: string;
      status: SourceEventStatus | 'SKIPPED';
      message?: string;
    }> = [];
    let posted = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of events) {
      try {
        const processed = await this.processOne(user, event.id);
        results.push({ eventId: event.id, status: processed.status });
        if (processed.status === SourceEventStatus.POSTED) posted += 1;
        else if (processed.status === SourceEventStatus.FAILED) failed += 1;
        else skipped += 1;
      } catch (error) {
        skipped += 1;
        results.push({
          eventId: event.id,
          status: 'SKIPPED',
          message:
            error instanceof HttpException
              ? error.message
              : 'Source event could not be processed',
        });
      }
    }

    return {
      processedCount: results.length,
      postedCount: posted,
      failedCount: failed,
      skippedCount: skipped,
      events: results,
    };
  }

  private async process(
    user: RequestUser,
    eventId: string,
    expectedStatus: SourceEventStatus,
    retry: boolean,
  ) {
    const claimed = await this.prisma.sourceEventInbox.updateMany({
      where: {
        id: eventId,
        tenantId: user.tenantId,
        status: expectedStatus,
      },
      data: {
        status: SourceEventStatus.PROCESSING,
        processedAt: null,
        ...(retry ? { retryCount: { increment: 1 } } : {}),
      },
    });
    if (claimed.count !== 1) {
      const current = await this.findOne(user.tenantId, eventId);
      if (current.status === SourceEventStatus.PROCESSING) {
        throw new ConflictException('Source event is already processing');
      }
      if (retry && current.status === SourceEventStatus.POSTED) {
        return current;
      }
      throw new ConflictException(
        retry
          ? 'Only failed source events can be retried'
          : `Source event cannot be processed from ${current.status}`,
      );
    }

    let resolvedRuleId: string | undefined;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.sourceEventInbox.findFirst({
          where: {
            id: eventId,
            tenantId: user.tenantId,
            status: SourceEventStatus.PROCESSING,
          },
        });
        if (!event) {
          throw new ConflictException('Source event processing claim was lost');
        }

        const payload = this.asPayload(event.payload);
        const transactionDate = this.transactionDate(payload);
        const rule = await this.resolveRule(tx, event, transactionDate);
        resolvedRuleId = rule.id;
        const { currency, lines } = await this.resolveLines(
          tx,
          event,
          rule,
          payload,
        );
        const cashbookInput = this.sourceCashbookInput(
          event,
          payload,
          transactionDate,
          currency,
          lines,
        );
        const journal = cashbookInput
          ? (
              await this.cashbook.createPostedSourceEventTransactionInTransaction(
                tx,
                user,
                cashbookInput,
              )
            ).journal
          : await this.createSourceEventJournal(
              tx,
              user,
              event,
              payload,
              transactionDate,
              currency,
              lines,
            );

        await tx.sourceEventInbox.update({
          where: {
            id_tenantId: { id: event.id, tenantId: user.tenantId },
          },
          data: {
            status: SourceEventStatus.POSTED,
            postingRuleId: rule.id,
            journalEntryId: journal.id,
            failureReason: null,
            processedAt: new Date(),
          },
        });

        return tx.sourceEventInbox.findUniqueOrThrow({
          where: {
            id_tenantId: { id: event.id, tenantId: user.tenantId },
          },
          include: sourceEventInclude,
        });
      });
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Source event ${eventId} processing failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      await this.prisma.sourceEventInbox.updateMany({
        where: {
          id: eventId,
          tenantId: user.tenantId,
          status: SourceEventStatus.PROCESSING,
        },
        data: {
          status: SourceEventStatus.FAILED,
          failureReason: this.failureMessage(error),
          ...(resolvedRuleId ? { postingRuleId: resolvedRuleId } : {}),
          processedAt: new Date(),
        },
      });
      return this.findOne(user.tenantId, eventId);
    }
  }

  private async releaseStaleProcessingClaim(
    tenantId: string,
    event: Awaited<ReturnType<SourceEventsService['findOne']>>,
  ) {
    const updatedAt = new Date(event.updatedAt).getTime();
    const stale = updatedAt <= Date.now() - PROCESSING_STALE_AFTER_MS;
    if (!stale) {
      throw new ConflictException('Source event is already processing');
    }

    const released = await this.prisma.sourceEventInbox.updateMany({
      where: {
        id: event.id,
        tenantId,
        status: SourceEventStatus.PROCESSING,
        updatedAt: { lte: new Date(Date.now() - PROCESSING_STALE_AFTER_MS) },
      },
      data: {
        status: SourceEventStatus.FAILED,
        failureReason: 'Processing claim expired before completion',
        processedAt: new Date(),
      },
    });
    if (released.count !== 1) {
      throw new ConflictException('Source event is already processing');
    }
  }

  private async resolveRule(
    tx: Prisma.TransactionClient,
    event: {
      tenantId: string;
      sourceModule: string;
      sourceEventType: string;
    },
    transactionDate: Date,
  ): Promise<EngineRule> {
    const rule = await tx.postingRule.findFirst({
      where: {
        tenantId: event.tenantId,
        sourceModule: event.sourceModule,
        sourceEventType: event.sourceEventType,
        active: true,
        effectiveFrom: { lte: transactionDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: transactionDate } }],
      },
      include: postingRuleForEngineInclude,
      orderBy: { version: 'desc' },
    });
    if (rule) return rule;

    const configured = await tx.postingRule.findFirst({
      where: {
        tenantId: event.tenantId,
        sourceModule: event.sourceModule,
        sourceEventType: event.sourceEventType,
      },
      orderBy: { version: 'desc' },
    });
    if (!configured) {
      throw new BadRequestException(
        'No posting rule is configured for this source event',
      );
    }
    if (!configured.active) {
      throw new BadRequestException(
        'No active posting rule is available for this source event',
      );
    }
    throw new BadRequestException(
      'No posting rule is effective for the source event transaction date',
    );
  }

  private async resolveLines(
    tx: Prisma.TransactionClient,
    event: {
      tenantId: string;
      sourceRecordId: string;
      sourceDocumentId: string | null;
      receivedByUserId: string;
    },
    rule: EngineRule,
    payload: SourcePayload,
  ) {
    if (rule.lines.length < 2) {
      throw new BadRequestException(
        'Posting rule requires at least two configured lines',
      );
    }

    const currencies = new Set<string>();
    const lines: JournalLineDto[] = [];
    for (const ruleLine of rule.lines) {
      const amount = this.positiveAmount(
        this.readPayload(payload, ruleLine.amountSource),
        ruleLine.amountSource,
      );
      const currency = this.currency(
        this.readPayload(payload, ruleLine.currencySource),
        ruleLine.currencySource,
      );
      currencies.add(currency);

      let subledgerAccountId: string | undefined;
      if (ruleLine.subledgerType) {
        if (!ruleLine.subledgerExternalRefSource) {
          throw new BadRequestException(
            `Posting rule line ${ruleLine.sequence} is missing its subledger reference source`,
          );
        }
        const externalRef = String(
          this.readPayload(payload, ruleLine.subledgerExternalRefSource),
        ).trim();
        const subledger = await this.resolvePostingSubledger(
          tx,
          event.tenantId,
          ruleLine,
          externalRef,
          currency,
          payload,
          event.receivedByUserId,
        );
        subledgerAccountId = subledger.id;
      }

      lines.push({
        glAccountId: ruleLine.glAccountId,
        subledgerAccountId,
        description: this.renderDescription(
          ruleLine.descriptionTemplate,
          event,
          payload,
        ),
        debit: ruleLine.direction === PostingDirection.DR ? amount : 0,
        credit: ruleLine.direction === PostingDirection.CR ? amount : 0,
      });
    }

    if (currencies.size !== 1) {
      throw new BadRequestException(
        'All posting rule lines must resolve to the same transaction currency',
      );
    }
    return { currency: [...currencies][0], lines };
  }

  private async resolvePostingSubledger(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ruleLine: EngineRule['lines'][number],
    externalRef: string,
    currency: string,
    payload: SourcePayload,
    actorUserId: string,
  ) {
    const existing = await tx.subledgerAccount.findFirst({
      where: {
        tenantId,
        type: ruleLine.subledgerType!,
        externalRef,
        controlAccountId: ruleLine.glAccountId,
      },
    });
    if (existing) {
      if (existing.status !== RecordStatus.ACTIVE) {
        throw new ConflictException(
          `${ruleLine.subledgerType} subledger for control account ${ruleLine.glAccountId} is inactive`,
        );
      }
      if (existing.currency && existing.currency !== currency) {
        throw new BadRequestException(
          `${ruleLine.subledgerType} subledger currency does not match source event currency`,
        );
      }
      return existing;
    }

    if (
      ruleLine.subledgerType !== 'CEDANT' &&
      ruleLine.subledgerType !== 'REINSURER'
    ) {
      throw new BadRequestException(
        `Active ${ruleLine.subledgerType!.toLowerCase()} subledger not found for rule line ${ruleLine.sequence}`,
      );
    }

    return tx.subledgerAccount.create({
      data: {
        tenantId,
        code: this.integrationSubledgerCode(
          ruleLine.subledgerType,
          externalRef,
          ruleLine.glAccountId,
        ),
        name:
          this.firstString(payload, SUBLEDGER_NAME_PATHS) ??
          `${ruleLine.subledgerType} ${externalRef}`,
        type: ruleLine.subledgerType,
        externalRef,
        controlAccountId: ruleLine.glAccountId,
        currency,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    });
  }

  private sourceCashbookInput(
    event: {
      id: string;
      sourceModule: string;
      sourceEventType: string;
      sourceRecordId: string;
      sourceDocumentId: string | null;
    },
    payload: SourcePayload,
    transactionDate: Date,
    currency: string,
    lines: JournalLineDto[],
  ) {
    const profile =
      CASH_EVENT_PROFILES[`${event.sourceModule}:${event.sourceEventType}`];
    if (!profile) return null;

    const settlementMethod = this.sourceSettlementMethod(payload);
    const cashImpact = this.absoluteNumber(
      this.readPayload(payload, profile.cashImpactPath),
      profile.cashImpactPath,
    );
    if (!this.isCashbookSettlementMethod(settlementMethod)) {
      if (cashImpact > 0) {
        throw new BadRequestException(
          `${event.sourceEventType} has cash impact but uses non-cash settlement method ${settlementMethod}`,
        );
      }
      return null;
    }
    if (cashImpact <= 0) return null;

    const cashAccountId = this.firstString(payload, CASH_ACCOUNT_ID_PATHS);
    if (!cashAccountId) {
      throw new BadRequestException(
        `${event.sourceEventType} requires an Accounting cashAccountId before it can be posted to Cashbook`,
      );
    }

    const settlementCurrency =
      this.firstString(payload, SETTLEMENT_CURRENCY_PATHS) ?? currency;
    const cashCurrency = this.currency(
      settlementCurrency,
      'settlement currency',
    );
    if (cashCurrency !== currency) {
      throw new BadRequestException(
        'Source cash event settlement currency must match the posting-rule currency for Phase 1 Cashbook integration',
      );
    }

    const cashLineIndex = this.cashLineIndex(
      lines,
      profile.direction,
      cashImpact,
    );
    const counterLines = lines.filter(
      (_line, index) => index !== cashLineIndex,
    );
    const sourceReference = this.firstString(payload, REFERENCE_PATHS);

    return {
      sourceEventInboxId: event.id,
      sourceModule: event.sourceModule,
      sourceEventType: event.sourceEventType,
      sourceRecordId: event.sourceRecordId,
      sourceReference,
      cashAccountId,
      direction: profile.direction,
      amount: cashImpact,
      currency: cashCurrency,
      transactionDate,
      settlementMethod: this.accountingSettlementMethod(settlementMethod),
      reference:
        sourceReference ?? event.sourceDocumentId ?? event.sourceRecordId,
      counterpartyType: this.firstString(payload, ['counterparty.type']),
      counterpartyId: this.firstString(payload, ['counterparty.id']),
      description: `${event.sourceEventType} - ${event.sourceRecordId}`,
      exchangeRate: this.optionalExchangeRate(payload),
      counterLines,
    };
  }

  private async createSourceEventJournal(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    event: {
      id: string;
      sourceModule: string;
      sourceEventType: string;
      sourceRecordId: string;
      sourceDocumentId: string | null;
    },
    payload: SourcePayload,
    transactionDate: Date,
    currency: string,
    lines: JournalLineDto[],
  ) {
    const period = await this.resolvePeriod(tx, user.tenantId, transactionDate);
    const journalDto: CreateJournalDto = {
      transactionDate: transactionDate.toISOString(),
      fiscalPeriodId: period.id,
      transactionCurrency: currency,
      exchangeRate: this.optionalExchangeRate(payload),
      reference: event.sourceDocumentId ?? event.sourceRecordId,
      description: `${event.sourceEventType} - ${event.sourceRecordId}`,
      idempotencyKey: `source-event:${event.id}`,
      sourceModule: event.sourceModule,
      sourceRecordType: event.sourceEventType,
      sourceRecordId: event.sourceRecordId,
      lines,
    };
    return this.journals.createPostedInTransaction(tx, user, journalDto);
  }

  private cashLineIndex(
    lines: JournalLineDto[],
    direction: SourceCashbookDirection,
    amount: number,
  ): number {
    const matches = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => {
        if (line.subledgerAccountId) return false;
        if (direction === 'INFLOW') {
          return (
            this.amountsEqual(line.debit ?? 0, amount) && line.credit === 0
          );
        }
        return this.amountsEqual(line.credit ?? 0, amount) && line.debit === 0;
      });
    if (matches.length !== 1) {
      throw new BadRequestException(
        'Cash-impact source events require exactly one posting-rule cash leg matching the signed cash impact',
      );
    }
    return matches[0].index;
  }

  private sourceSettlementMethod(payload: SourcePayload): string {
    return (
      this.firstString(payload, SETTLEMENT_METHOD_PATHS)?.toUpperCase() ??
      AccountingSettlementMethod.BANK_TRANSFER
    );
  }

  private isCashbookSettlementMethod(method: string): boolean {
    const cashbookMethods: string[] = [
      AccountingSettlementMethod.BANK_TRANSFER,
      AccountingSettlementMethod.CHEQUE,
      AccountingSettlementMethod.CASH,
      AccountingSettlementMethod.MOBILE_MONEY,
    ];
    return cashbookMethods.includes(method);
  }

  private accountingSettlementMethod(
    method: string,
  ): AccountingSettlementMethod {
    if (method in AccountingSettlementMethod) {
      return AccountingSettlementMethod[
        method as keyof typeof AccountingSettlementMethod
      ];
    }
    throw new BadRequestException(`Unsupported settlement method ${method}`);
  }

  private async resolvePeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transactionDate: Date,
  ) {
    const period = await tx.fiscalPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!period) {
      throw new BadRequestException(
        'No fiscal period contains the source event transaction date',
      );
    }
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post source event into a ${period.status.toLowerCase()} fiscal period`,
      );
    }
    return period;
  }

  private transactionDate(payload: SourcePayload) {
    const raw = this.readPayload(payload, 'transactionDate');
    if (typeof raw !== 'string') {
      throw new BadRequestException(
        'Source event payload transactionDate must be an ISO date string',
      );
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'Source event payload transactionDate is invalid',
      );
    }
    return date;
  }

  private optionalExchangeRate(payload: SourcePayload) {
    const raw = payload.exchangeRate;
    if (raw === undefined || raw === null) return undefined;
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException(
        'Source event payload exchangeRate must be greater than zero',
      );
    }
    return rate;
  }

  private readPayload(payload: SourcePayload, path: string): unknown {
    let current: unknown = payload;
    for (const segment of path.split('.')) {
      if (
        typeof current !== 'object' ||
        current === null ||
        Array.isArray(current) ||
        !(segment in current)
      ) {
        throw new BadRequestException(
          `Source event payload is missing ${path}`,
        );
      }
      current = (current as SourcePayload)[segment];
    }
    return current;
  }

  private readOptionalPayload(payload: SourcePayload, path: string): unknown {
    let current: unknown = payload;
    for (const segment of path.split('.')) {
      if (
        typeof current !== 'object' ||
        current === null ||
        Array.isArray(current) ||
        !(segment in current)
      ) {
        return undefined;
      }
      current = (current as SourcePayload)[segment];
    }
    return current;
  }

  private firstString(payload: SourcePayload, paths: string[]): string | null {
    for (const path of paths) {
      const value = this.readOptionalPayload(payload, path);
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private positiveAmount(value: unknown, path: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        `Source event amount ${path} must be greater than zero`,
      );
    }
    return amount;
  }

  private absoluteNumber(value: unknown, path: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException(
        `Source event amount ${path} must be numeric`,
      );
    }
    return Math.abs(amount);
  }

  private amountsEqual(left: number, right: number) {
    return Math.abs(left - right) < 0.0001;
  }

  private currency(value: unknown, path: string) {
    if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) {
      throw new BadRequestException(
        `Source event currency ${path} must be a three-letter code`,
      );
    }
    return value.trim().toUpperCase();
  }

  private integrationSubledgerCode(
    type: 'CEDANT' | 'REINSURER',
    externalRef: string,
    controlAccountId: string,
  ): string {
    const prefix = type === 'CEDANT' ? 'CED' : 'REI';
    const digest = createHash('sha1')
      .update(`${externalRef}:${controlAccountId}`)
      .digest('hex');
    return `${prefix}-${digest.slice(0, 12).toUpperCase()}`;
  }

  private renderDescription(
    template: string,
    event: {
      sourceRecordId: string;
      sourceDocumentId: string | null;
    },
    payload: SourcePayload,
  ) {
    return template.replace(/\{\{([^}]+)}}/g, (_match, rawToken: string) => {
      const token = rawToken.trim();
      if (token === 'sourceRecordId') return event.sourceRecordId;
      if (token === 'sourceDocumentId') {
        return event.sourceDocumentId ?? '';
      }
      if (token.startsWith('payload.')) {
        const value = this.readPayload(payload, token.slice(8));
        if (
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean'
        ) {
          throw new BadRequestException(
            `Description placeholder ${token} must resolve to a scalar value`,
          );
        }
        return String(value);
      }
      throw new BadRequestException(
        `Unsupported description placeholder ${token}`,
      );
    });
  }

  private asPayload(value: Prisma.JsonValue): SourcePayload {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Source event payload must be a JSON object',
      );
    }
    return value as SourcePayload;
  }

  private failureMessage(error: unknown) {
    const message =
      error instanceof HttpException
        ? error.message
        : 'Unexpected posting engine failure';
    return message.slice(0, 1000);
  }
}
