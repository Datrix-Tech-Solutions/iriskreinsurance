import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ReinsuranceAccountingOutboxStatus,
} from '../../../prisma/generated/client';
import {
  ReinsuranceAccountingClient,
  ReinsuranceAccountingClientError,
} from '../client/accounting.client';
import {
  ReinsuranceAccountingEventBuilder,
  ReinsuranceAccountingEventInput,
} from '../events/accounting-event.builder';

const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 100;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
const BASE_BACKOFF_MS = 60 * 1000;
const PROCESSING_STALE_AFTER_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 10;
export const RETIRED_REINSURANCE_ACCOUNTING_EVENT_TYPES = [
  'DEBIT_NOTE_ISSUED',
  'CREDIT_NOTE_ISSUED',
  'ENDORSEMENT_DEBIT_NOTE_ISSUED',
  'ENDORSEMENT_CREDIT_NOTE_ISSUED',
  'PREMIUM_PAYMENT_RECEIVED',
  'PAYMENT_REVERSED',
  'REINSURER_DISBURSEMENT_RECORDED',
  'REINSURER_DISBURSEMENT_REVERSED',
  'CLAIM_PAYABLE_APPROVED',
  'CLAIM_RECOVERY_APPROVED',
  'CLAIM_RECOVERY_RECEIVED',
  'CLAIM_RECOVERY_RECEIPT_REVERSED',
  'CLAIM_CEDANT_SETTLEMENT_PAID',
  'CLAIM_CEDANT_SETTLEMENT_REVERSED',
] as const;

type OutboxRecord = Prisma.ReinsuranceAccountingOutboxGetPayload<object>;

export interface ProcessAccountingOutboxOptions {
  tenantId?: string;
  limit?: number;
  maxAttempts?: number;
  processingTimeoutMs?: number;
  retryDelayMs?: number;
}

export interface ProcessAccountingOutboxResult {
  processedCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  events: Array<{
    outboxId: string;
    status: ReinsuranceAccountingOutboxStatus | 'SKIPPED';
    retryable?: boolean;
    message?: string;
  }>;
}

@Injectable()
export class ReinsuranceAccountingOutboxService {
  private readonly logger = new Logger(ReinsuranceAccountingOutboxService.name);

  constructor(
    private readonly client: ReinsuranceAccountingClient,
    private readonly builder: ReinsuranceAccountingEventBuilder,
  ) {}

  async enqueueAccountingEvent(
    tx: Prisma.TransactionClient,
    event: ReinsuranceAccountingEventInput,
  ): Promise<OutboxRecord> {
    const data = this.builder.asOutboxCreateInput(event);
    try {
      return await tx.reinsuranceAccountingOutbox.create({ data });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        const existing = await tx.reinsuranceAccountingOutbox.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: data.tenantId,
              idempotencyKey: data.idempotencyKey,
            },
          },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async processPending(
    prisma: Prisma.TransactionClient,
    options: ProcessAccountingOutboxOptions = {},
  ): Promise<ProcessAccountingOutboxResult> {
    const limit = this.batchLimit(options.limit);
    const maxAttempts = this.maxAttempts(options.maxAttempts);
    const now = new Date();
    const staleProcessingBefore = new Date(
      now.getTime() - this.processingTimeoutMs(options.processingTimeoutMs),
    );
    const candidates = await prisma.reinsuranceAccountingOutbox.findMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        sourceEventType: {
          notIn: [...RETIRED_REINSURANCE_ACCOUNTING_EVENT_TYPES],
        },
        OR: [
          { status: ReinsuranceAccountingOutboxStatus.PENDING },
          {
            status: ReinsuranceAccountingOutboxStatus.FAILED,
            nextAttemptAt: { lte: now },
            attemptCount: { lt: maxAttempts },
          },
          {
            status: ReinsuranceAccountingOutboxStatus.PROCESSING,
            lastAttemptAt: { lte: staleProcessingBefore },
            attemptCount: { lt: maxAttempts },
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }],
      take: limit,
      select: { id: true, tenantId: true },
    });

    const events: ProcessAccountingOutboxResult['events'] = [];
    let deliveredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      const result = await this.processOne(
        prisma,
        candidate.tenantId,
        candidate.id,
        options,
      );
      events.push(result);
      if (result.status === ReinsuranceAccountingOutboxStatus.DELIVERED) {
        deliveredCount += 1;
      } else if (result.status === ReinsuranceAccountingOutboxStatus.FAILED) {
        failedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    return {
      processedCount: events.length,
      deliveredCount,
      failedCount,
      skippedCount,
      events,
    };
  }

  async processOne(
    prisma: Prisma.TransactionClient,
    tenantId: string,
    outboxId: string,
    options: ProcessAccountingOutboxOptions = {},
  ): Promise<ProcessAccountingOutboxResult['events'][number]> {
    const claimed = await this.claim(prisma, tenantId, outboxId, options);
    if (!claimed) {
      return {
        outboxId,
        status: 'SKIPPED',
        message: 'Outbox row was not eligible',
      };
    }

    this.logger.log(
      `Delivering accounting outbox ${claimed.id} event=${claimed.sourceEventType} source=${claimed.sourceRecordType}:${claimed.sourceRecordId} attempt=${claimed.attemptCount}`,
    );

    try {
      const envelope = this.builder.fromOutbox(claimed);
      const response = await this.client.enqueueSourceEvent(envelope);
      await prisma.reinsuranceAccountingOutbox.update({
        where: { id: claimed.id },
        data: {
          status: ReinsuranceAccountingOutboxStatus.DELIVERED,
          accountingSourceEventId: response.id,
          deliveredAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
        },
      });
      this.logger.log(
        `Delivered accounting outbox ${claimed.id} accountingEvent=${response.id}`,
      );
      return {
        outboxId: claimed.id,
        status: ReinsuranceAccountingOutboxStatus.DELIVERED,
      };
    } catch (error) {
      const failure = this.failure(error);
      const exhausted =
        claimed.attemptCount >= this.maxAttempts(options.maxAttempts);
      const nextAttemptAt =
        failure.retryable && !exhausted
          ? new Date(
              Date.now() +
                this.backoffMs(claimed.attemptCount, options.retryDelayMs),
            )
          : null;
      await prisma.reinsuranceAccountingOutbox.update({
        where: { id: claimed.id },
        data: {
          status: ReinsuranceAccountingOutboxStatus.FAILED,
          lastError: failure.message,
          nextAttemptAt,
        },
      });
      this.logger.warn(
        `Failed accounting outbox ${claimed.id} event=${claimed.sourceEventType} source=${claimed.sourceRecordType}:${claimed.sourceRecordId} attempt=${claimed.attemptCount} retryable=${failure.retryable} exhausted=${exhausted} error=${failure.message}`,
      );
      return {
        outboxId: claimed.id,
        status: ReinsuranceAccountingOutboxStatus.FAILED,
        retryable: failure.retryable,
        message: failure.message,
      };
    }
  }

  async retryFailedEvent(
    prisma: Prisma.TransactionClient,
    tenantId: string,
    outboxId: string,
  ): Promise<OutboxRecord | null> {
    const updated = await prisma.reinsuranceAccountingOutbox.updateMany({
      where: {
        id: outboxId,
        tenantId,
        status: ReinsuranceAccountingOutboxStatus.FAILED,
        sourceEventType: {
          notIn: [...RETIRED_REINSURANCE_ACCOUNTING_EVENT_TYPES],
        },
      },
      data: { nextAttemptAt: new Date(), lastError: null },
    });
    if (updated.count !== 1) return null;
    return prisma.reinsuranceAccountingOutbox.findFirst({
      where: { id: outboxId, tenantId },
    });
  }

  private async claim(
    prisma: Prisma.TransactionClient,
    tenantId: string,
    outboxId: string,
    options: ProcessAccountingOutboxOptions = {},
  ): Promise<OutboxRecord | null> {
    const now = new Date();
    const staleProcessingBefore = new Date(
      now.getTime() - this.processingTimeoutMs(options.processingTimeoutMs),
    );
    const maxAttempts = this.maxAttempts(options.maxAttempts);
    const claimed = await prisma.reinsuranceAccountingOutbox.updateMany({
      where: {
        id: outboxId,
        tenantId,
        sourceEventType: {
          notIn: [...RETIRED_REINSURANCE_ACCOUNTING_EVENT_TYPES],
        },
        OR: [
          { status: ReinsuranceAccountingOutboxStatus.PENDING },
          {
            status: ReinsuranceAccountingOutboxStatus.FAILED,
            nextAttemptAt: { lte: now },
            attemptCount: { lt: maxAttempts },
          },
          {
            status: ReinsuranceAccountingOutboxStatus.PROCESSING,
            lastAttemptAt: { lte: staleProcessingBefore },
            attemptCount: { lt: maxAttempts },
          },
        ],
      },
      data: {
        status: ReinsuranceAccountingOutboxStatus.PROCESSING,
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        lastError: null,
      },
    });
    if (claimed.count !== 1) return null;
    return prisma.reinsuranceAccountingOutbox.findFirst({
      where: { id: outboxId, tenantId },
    });
  }

  private batchLimit(value?: number): number {
    return Math.min(
      Math.max(Math.trunc(value ?? DEFAULT_BATCH_LIMIT), 1),
      MAX_BATCH_LIMIT,
    );
  }

  private maxAttempts(value?: number): number {
    return Math.max(Math.trunc(value ?? DEFAULT_MAX_ATTEMPTS), 1);
  }

  private processingTimeoutMs(value?: number): number {
    return Math.max(Math.trunc(value ?? PROCESSING_STALE_AFTER_MS), 1000);
  }

  private retryDelayMs(value?: number): number {
    return Math.max(Math.trunc(value ?? BASE_BACKOFF_MS), 1000);
  }

  private backoffMs(attemptCount: number, retryDelayMs?: number): number {
    return Math.min(
      this.retryDelayMs(retryDelayMs) * 2 ** Math.max(attemptCount - 1, 0),
      MAX_BACKOFF_MS,
    );
  }

  private failure(error: unknown): { message: string; retryable: boolean } {
    if (error instanceof ReinsuranceAccountingClientError) {
      return {
        message: error.message.slice(0, 1000),
        retryable: error.retryable,
      };
    }
    return {
      message:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : 'Unexpected accounting outbox delivery failure',
      retryable: true,
    };
  }

  private isUniqueConstraint(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
