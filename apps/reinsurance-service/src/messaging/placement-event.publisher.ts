import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  ReinsurancePlacementAuditEvent,
  ReinsurancePlacementStatusAuditEvent,
  WithMeta,
} from '@work-phelo/types';

@Injectable()
export class PlacementEventPublisher {
  private readonly logger = new Logger(PlacementEventPublisher.name);
  private readonly publishTimeoutMs = Number(
    process.env.RABBITMQ_PUBLISH_TIMEOUT_MS ?? 10000,
  );

  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  created(data: ReinsurancePlacementAuditEvent): Promise<void> {
    return this.publish(EventPatterns.REINSURANCE_PLACEMENT_CREATED, data);
  }

  updated(data: ReinsurancePlacementAuditEvent): Promise<void> {
    return this.publish(EventPatterns.REINSURANCE_PLACEMENT_UPDATED, data);
  }

  deleted(data: ReinsurancePlacementAuditEvent): Promise<void> {
    return this.publish(EventPatterns.REINSURANCE_PLACEMENT_DELETED, data);
  }

  statusChanged(data: ReinsurancePlacementStatusAuditEvent): Promise<void> {
    return this.publish(
      EventPatterns.REINSURANCE_PLACEMENT_STATUS_CHANGED,
      data,
    );
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
