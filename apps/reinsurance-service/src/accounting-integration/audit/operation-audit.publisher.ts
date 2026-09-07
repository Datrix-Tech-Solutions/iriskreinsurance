import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  ReinsuranceAccountingOperationAuditEvent,
  WithMeta,
} from '@work-phelo/types';

@Injectable()
export class ReinsuranceAccountingOperationAuditPublisher {
  private readonly logger = new Logger(
    ReinsuranceAccountingOperationAuditPublisher.name,
  );

  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  executed(data: ReinsuranceAccountingOperationAuditEvent): void {
    const envelope: WithMeta<ReinsuranceAccountingOperationAuditEvent> = {
      ...data,
      _meta: {
        messageId: randomUUID(),
        correlationId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
    this.authClient
      .emit(EventPatterns.REINSURANCE_ACCOUNTING_OPERATION_EXECUTED, envelope)
      .subscribe({
        error: (error: unknown) =>
          this.logger.warn(
            `Accounting operation audit event failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
      });
  }
}
