import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  ReinsuranceEmailLinkAuditEvent,
  ReinsuranceMailboxAuditEvent,
  ReinsuranceMailboxSyncAuditEvent,
  WithMeta,
} from '@work-phelo/types';

@Injectable()
export class EmailEventPublisher {
  private readonly logger = new Logger(EmailEventPublisher.name);
  private readonly publishTimeoutMs = Number(
    process.env.RABBITMQ_PUBLISH_TIMEOUT_MS ?? 10000,
  );

  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  mailboxConnected(data: ReinsuranceMailboxAuditEvent): Promise<void> {
    return this.publish(EventPatterns.REINSURANCE_MAILBOX_CONNECTED, data);
  }

  mailboxSynced(data: ReinsuranceMailboxSyncAuditEvent): Promise<void> {
    return this.publish(EventPatterns.REINSURANCE_MAILBOX_SYNCED, data);
  }

  mailboxArchived(data: ReinsuranceMailboxAuditEvent): Promise<void> {
    return this.publish(EventPatterns.REINSURANCE_MAILBOX_ARCHIVED, data);
  }

  emailLinked(data: ReinsuranceEmailLinkAuditEvent): Promise<void> {
    return this.publish(EventPatterns.REINSURANCE_EMAIL_LINKED, data);
  }

  private publish<T extends object>(pattern: string, data: T): Promise<void> {
    const envelope: WithMeta<T> = {
      ...data,
      _meta: {
        messageId: randomUUID(),
        correlationId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.log(
      `Publishing ${pattern} | msgId=${envelope._meta.messageId}`,
    );

    return new Promise((resolve, reject) => {
      let settled = false;
      const delivery: { subscription?: { unsubscribe: () => void } } = {};
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        delivery.subscription?.unsubscribe();
        reject(new Error(`Timed out publishing ${pattern}`));
      }, this.publishTimeoutMs);
      delivery.subscription = this.authClient
        .emit(pattern, envelope)
        .subscribe({
          complete: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          },
          error: (error: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
    });
  }
}
