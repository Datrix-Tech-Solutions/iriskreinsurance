import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceAccountingOutboxStatus } from '../../../prisma/generated/client';
import { ReinsuranceAccountingIntegrationConfigClient } from '../client/integration-config.client';
import { ReinsuranceAccountingOutboxService } from './outbox.service';

const DEFAULT_ENABLED = false;
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 10;

export interface AccountingOutboxDispatcherConfig {
  enabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  processingTimeoutMs: number;
  retryDelayMs: number;
  maxAttempts: number;
}

export interface AccountingOutboxDispatcherBatchSummary {
  processedCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface AccountingOutboxDispatcherStatus {
  enabled: boolean;
  running: boolean;
  inFlight: boolean;
  config: AccountingOutboxDispatcherConfig;
  startedAt: string | null;
  stoppedAt: string | null;
  lastBatchAt: string | null;
  lastResult: AccountingOutboxDispatcherBatchSummary | null;
  lastError: string | null;
}

@Injectable()
export class ReinsuranceAccountingOutboxDispatcher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(
    ReinsuranceAccountingOutboxDispatcher.name,
  );
  private readonly config = this.loadConfig();
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private running = false;
  private startedAt: Date | null = null;
  private stoppedAt: Date | null = null;
  private lastBatchAt: Date | null = null;
  private lastResult: AccountingOutboxDispatcherBatchSummary | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: ReinsuranceAccountingOutboxService,
    private readonly integrationConfig?: ReinsuranceAccountingIntegrationConfigClient,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.enabled) {
      this.logger.log('Accounting outbox dispatcher disabled');
      return;
    }
    if (this.running) {
      this.logger.warn('Accounting outbox dispatcher already running');
      return;
    }

    this.running = true;
    this.startedAt = new Date();
    this.stoppedAt = null;
    this.logger.log(
      `Accounting outbox dispatcher started intervalMs=${this.config.pollIntervalMs} batchSize=${this.config.batchSize} processingTimeoutMs=${this.config.processingTimeoutMs} retryDelayMs=${this.config.retryDelayMs} maxAttempts=${this.config.maxAttempts}`,
    );

    this.timer = setInterval(() => {
      void this.processBatch('interval');
    }, this.config.pollIntervalMs);

    void this.processBatch('startup');
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.stoppedAt = new Date();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.inFlight) {
      await this.inFlight;
    }
    this.logger.log('Accounting outbox dispatcher stopped');
  }

  status(): AccountingOutboxDispatcherStatus {
    return {
      enabled: this.config.enabled,
      running: this.running,
      inFlight: Boolean(this.inFlight),
      config: this.config,
      startedAt: this.startedAt?.toISOString() ?? null,
      stoppedAt: this.stoppedAt?.toISOString() ?? null,
      lastBatchAt: this.lastBatchAt?.toISOString() ?? null,
      lastResult: this.lastResult,
      lastError: this.lastError,
    };
  }

  async processBatch(trigger = 'manual'): Promise<void> {
    if (!this.config.enabled) return;
    if (this.inFlight) {
      this.logger.debug(
        `Accounting outbox dispatcher skipped overlapping ${trigger} run`,
      );
      return;
    }

    this.inFlight = this.runBatch(trigger).finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  private async runBatch(trigger: string): Promise<void> {
    try {
      if (!this.integrationConfig) {
        const result = await this.outbox.processPending(this.prisma, {
          limit: this.config.batchSize,
          maxAttempts: this.config.maxAttempts,
          processingTimeoutMs: this.config.processingTimeoutMs,
          retryDelayMs: this.config.retryDelayMs,
        });
        this.recordResult(trigger, result);
        return;
      }
      const candidates = await this.prisma.reinsuranceAccountingOutbox.findMany(
        {
          where: {
            status: {
              in: [
                ReinsuranceAccountingOutboxStatus.PENDING,
                ReinsuranceAccountingOutboxStatus.FAILED,
                ReinsuranceAccountingOutboxStatus.PROCESSING,
              ],
            },
          },
          select: { tenantId: true },
          distinct: ['tenantId'],
          take: this.config.batchSize,
        },
      );
      const totals: AccountingOutboxDispatcherBatchSummary = {
        processedCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount: 0,
      };
      for (const { tenantId } of candidates) {
        const state = await this.integrationConfig.get(tenantId);
        if (!state.active) {
          totals.skippedCount += 1;
          continue;
        }
        const result = await this.outbox.processPending(this.prisma, {
          tenantId,
          limit: this.config.batchSize,
          maxAttempts: this.config.maxAttempts,
          processingTimeoutMs: this.config.processingTimeoutMs,
          retryDelayMs: this.config.retryDelayMs,
        });
        totals.processedCount += result.processedCount;
        totals.deliveredCount += result.deliveredCount;
        totals.failedCount += result.failedCount;
        totals.skippedCount += result.skippedCount;
      }
      this.recordResult(trigger, totals);
    } catch (error) {
      this.lastBatchAt = new Date();
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected accounting outbox dispatcher failure';
      this.lastError = 'Last dispatcher batch failed; see service logs.';
      this.logger.error(
        `Accounting outbox dispatcher batch failed trigger=${trigger}: ${message}`,
      );
    }
  }

  private recordResult(
    trigger: string,
    result: AccountingOutboxDispatcherBatchSummary,
  ): void {
    this.lastBatchAt = new Date();
    this.lastResult = result;
    this.lastError = null;
    if (result.processedCount > 0) {
      this.logger.log(
        `Accounting outbox dispatcher batch trigger=${trigger} processed=${result.processedCount} delivered=${result.deliveredCount} failed=${result.failedCount} skipped=${result.skippedCount}`,
      );
    }
  }

  private loadConfig(): AccountingOutboxDispatcherConfig {
    return {
      enabled: this.booleanEnv(
        'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED',
        DEFAULT_ENABLED,
      ),
      pollIntervalMs: this.numberEnv(
        'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS',
        DEFAULT_POLL_INTERVAL_MS,
        1000,
      ),
      batchSize: this.numberEnv(
        'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_BATCH_SIZE',
        DEFAULT_BATCH_SIZE,
        1,
        100,
      ),
      processingTimeoutMs: this.numberEnv(
        'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_PROCESSING_TIMEOUT_MS',
        DEFAULT_PROCESSING_TIMEOUT_MS,
        1000,
      ),
      retryDelayMs: this.numberEnv(
        'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_RETRY_DELAY_MS',
        DEFAULT_RETRY_DELAY_MS,
        1000,
      ),
      maxAttempts: this.numberEnv(
        'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_MAX_ATTEMPTS',
        DEFAULT_MAX_ATTEMPTS,
        1,
        100,
      ),
    };
  }

  private booleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name]?.trim().toLowerCase();
    if (!raw) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    return fallback;
  }

  private numberEnv(
    name: string,
    fallback: number,
    min: number,
    max?: number,
  ): number {
    const parsed = Number(process.env[name]);
    if (!Number.isSafeInteger(parsed)) return fallback;
    const clamped = Math.max(parsed, min);
    return max == null ? clamped : Math.min(clamped, max);
  }
}
