import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  EventPatterns,
  ReinsuranceCounterpartyAuditEvent,
  ReinsuranceEmailLinkAuditEvent,
  ReinsuranceMailboxAuditEvent,
  ReinsuranceMailboxSyncAuditEvent,
  ReinsurancePlacementAuditEvent,
  ReinsurancePlacementStatusAuditEvent,
  ReinsuranceAccountingOperationAuditEvent,
  WithMeta,
} from '@work-phelo/types';
import { AuditService } from './audit.service';

@Controller()
export class AuditEventsHandler {
  constructor(private readonly auditService: AuditService) {}

  @EventPattern(EventPatterns.REINSURANCE_COUNTERPARTY_CREATED)
  async onCounterpartyCreated(
    @Payload() data: WithMeta<ReinsuranceCounterpartyAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logCounterparty('CREATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_COUNTERPARTY_UPDATED)
  async onCounterpartyUpdated(
    @Payload() data: WithMeta<ReinsuranceCounterpartyAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logCounterparty('UPDATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_COUNTERPARTY_DELETED)
  async onCounterpartyDeleted(
    @Payload() data: WithMeta<ReinsuranceCounterpartyAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logCounterparty('DELETE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_PLACEMENT_CREATED)
  async onPlacementCreated(
    @Payload() data: WithMeta<ReinsurancePlacementAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logPlacement('CREATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_PLACEMENT_UPDATED)
  async onPlacementUpdated(
    @Payload() data: WithMeta<ReinsurancePlacementAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logPlacement('UPDATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_PLACEMENT_DELETED)
  async onPlacementDeleted(
    @Payload() data: WithMeta<ReinsurancePlacementAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logPlacement('DELETE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_PLACEMENT_STATUS_CHANGED)
  async onPlacementStatusChanged(
    @Payload() data: WithMeta<ReinsurancePlacementStatusAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logPlacement('UPDATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_MAILBOX_CONNECTED)
  async onMailboxConnected(
    @Payload() data: WithMeta<ReinsuranceMailboxAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logMailbox('CREATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_MAILBOX_SYNCED)
  async onMailboxSynced(
    @Payload() data: WithMeta<ReinsuranceMailboxSyncAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logMailbox('UPDATE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_MAILBOX_ARCHIVED)
  async onMailboxArchived(
    @Payload() data: WithMeta<ReinsuranceMailboxAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.logMailbox('DELETE', data);
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_EMAIL_LINKED)
  async onEmailLinked(
    @Payload() data: WithMeta<ReinsuranceEmailLinkAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.auditService.log({
      tenantId: data.tenantId,
      userId: data.actorUserId,
      userEmail: data.actorEmail,
      userRole: data.actorRole,
      action: 'CREATE',
      resource: 'operations.reinsurance.email',
      resourceId: data.linkId,
      changes: data.changes,
    });
    this.ack(context);
  }

  @EventPattern(EventPatterns.REINSURANCE_ACCOUNTING_OPERATION_EXECUTED)
  async onAccountingOperationExecuted(
    @Payload() data: WithMeta<ReinsuranceAccountingOperationAuditEvent>,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.auditService.log({
      tenantId: data.tenantId,
      userId: data.actorUserId,
      userEmail: data.actorEmail,
      userRole: data.actorRole,
      action: 'UPDATE',
      resource: 'operations.reinsurance.accounting-operations',
      resourceId: data.resourceId ?? data.operation,
      changes: {
        after: { operation: data.operation, ...data.changes },
      },
    });
    this.ack(context);
  }

  private logCounterparty(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    data: ReinsuranceCounterpartyAuditEvent,
  ): Promise<void> {
    return this.auditService.log({
      tenantId: data.tenantId,
      userId: data.actorUserId,
      userEmail: data.actorEmail,
      userRole: data.actorRole,
      action,
      resource: 'operations.reinsurance.counterparties',
      resourceId: data.counterpartyId,
      changes: data.changes,
    });
  }

  private logPlacement(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    data: ReinsurancePlacementAuditEvent,
  ): Promise<void> {
    return this.auditService.log({
      tenantId: data.tenantId,
      userId: data.actorUserId,
      userEmail: data.actorEmail,
      userRole: data.actorRole,
      action,
      resource: 'operations.reinsurance.placements',
      resourceId: data.placementId,
      changes: data.changes,
    });
  }

  private logMailbox(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    data: ReinsuranceMailboxAuditEvent,
  ): Promise<void> {
    return this.auditService.log({
      tenantId: data.tenantId,
      userId: data.actorUserId,
      userEmail: data.actorEmail,
      userRole: data.actorRole,
      action,
      resource: 'operations.reinsurance.email-settings',
      resourceId: data.mailboxConnectionId,
      changes: data.changes,
    });
  }

  private ack(context: RmqContext): void {
    const channel = context.getChannelRef() as { ack: (msg: unknown) => void };
    channel.ack(context.getMessage());
  }
}
