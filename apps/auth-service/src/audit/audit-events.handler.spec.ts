import { RmqContext } from '@nestjs/microservices';
import {
  EventPatterns,
  ReinsuranceCounterpartyAuditEvent,
  ReinsuranceEmailLinkAuditEvent,
  ReinsuranceMailboxAuditEvent,
  ReinsurancePlacementAuditEvent,
  ReinsurancePlacementStatusAuditEvent,
} from '@work-phelo/types';
import { AuditEventsHandler } from './audit-events.handler';
import { AuditService } from './audit.service';

describe('AuditEventsHandler', () => {
  type CounterpartyAuditHandler =
    | 'onCounterpartyCreated'
    | 'onCounterpartyUpdated'
    | 'onCounterpartyDeleted';
  type PlacementAuditHandler =
    | 'onPlacementCreated'
    | 'onPlacementUpdated'
    | 'onPlacementDeleted'
    | 'onPlacementStatusChanged';
  type MailboxAuditHandler =
    | 'onMailboxConnected'
    | 'onMailboxSynced'
    | 'onMailboxArchived';

  const meta = {
    messageId: 'message-1',
    correlationId: 'correlation-1',
    timestamp: '2026-05-26T10:00:00.000Z',
  };
  const event: ReinsuranceCounterpartyAuditEvent & {
    _meta: {
      messageId: string;
      correlationId: string;
      timestamp: string;
    };
  } = {
    tenantId: 'tenant-1',
    counterpartyId: 'counterparty-1',
    counterpartyType: 'CEDANT',
    counterpartyName: 'Acme Cedant',
    actorUserId: 'user-1',
    actorEmail: 'broker@example.com',
    actorRole: 'EMPLOYEE',
    changes: { after: { name: 'Acme Cedant' } },
    _meta: meta,
  };
  const placementEvent: ReinsurancePlacementAuditEvent & {
    _meta: typeof meta;
  } = {
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    reference: 'FAC-2026-0001',
    title: 'Acme Energy Placement',
    status: 'DRAFT',
    actorUserId: 'user-1',
    actorEmail: 'broker@example.com',
    actorRole: 'EMPLOYEE',
    changes: { after: { reference: 'FAC-2026-0001' } },
    _meta: meta,
  };
  const placementStatusEvent: ReinsurancePlacementStatusAuditEvent & {
    _meta: typeof meta;
  } = {
    ...placementEvent,
    status: 'MARKETING',
    previousStatus: 'DRAFT',
    nextStatus: 'MARKETING',
    changes: {
      before: { status: 'DRAFT' },
      after: { status: 'MARKETING' },
    },
  };
  const mailboxEvent: ReinsuranceMailboxAuditEvent & { _meta: typeof meta } = {
    tenantId: 'tenant-1',
    mailboxConnectionId: 'mailbox-1',
    provider: 'MICROSOFT_GRAPH',
    emailAddress: 'placements@example.com',
    actorUserId: 'user-1',
    actorEmail: 'broker@example.com',
    actorRole: 'EMPLOYEE',
    changes: { after: { emailAddress: 'placements@example.com' } },
    _meta: meta,
  };
  const emailLinkEvent: ReinsuranceEmailLinkAuditEvent & {
    _meta: typeof meta;
  } = {
    tenantId: 'tenant-1',
    linkId: 'link-1',
    placementId: 'placement-1',
    threadId: 'thread-1',
    messageId: 'message-1',
    actorUserId: 'user-1',
    actorEmail: 'broker@example.com',
    actorRole: 'EMPLOYEE',
    changes: { after: { placementId: 'placement-1' } },
    _meta: meta,
  };

  let auditService: { log: jest.Mock };
  let channel: { ack: jest.Mock };
  let context: RmqContext;
  let handler: AuditEventsHandler;

  beforeEach(() => {
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    channel = { ack: jest.fn() };
    context = {
      getChannelRef: () => channel,
      getMessage: () => 'message',
    } as unknown as RmqContext;
    handler = new AuditEventsHandler(auditService as unknown as AuditService);
  });

  it.each<[string, string, CounterpartyAuditHandler]>([
    [
      EventPatterns.REINSURANCE_COUNTERPARTY_CREATED,
      'CREATE',
      'onCounterpartyCreated',
    ],
    [
      EventPatterns.REINSURANCE_COUNTERPARTY_UPDATED,
      'UPDATE',
      'onCounterpartyUpdated',
    ],
    [
      EventPatterns.REINSURANCE_COUNTERPARTY_DELETED,
      'DELETE',
      'onCounterpartyDeleted',
    ],
  ])(
    'records %s as %s and acknowledges the event',
    async (_pattern, action, method) => {
      await handler[method](event, context);

      expect(auditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'broker@example.com',
        userRole: 'EMPLOYEE',
        action,
        resource: 'operations.reinsurance.counterparties',
        resourceId: 'counterparty-1',
        changes: event.changes,
      });
      expect(channel.ack).toHaveBeenCalledWith('message');
    },
  );

  it.each<
    [string, string, PlacementAuditHandler, ReinsurancePlacementAuditEvent]
  >([
    [
      EventPatterns.REINSURANCE_PLACEMENT_CREATED,
      'CREATE',
      'onPlacementCreated',
      placementEvent,
    ],
    [
      EventPatterns.REINSURANCE_PLACEMENT_UPDATED,
      'UPDATE',
      'onPlacementUpdated',
      placementEvent,
    ],
    [
      EventPatterns.REINSURANCE_PLACEMENT_DELETED,
      'DELETE',
      'onPlacementDeleted',
      placementEvent,
    ],
    [
      EventPatterns.REINSURANCE_PLACEMENT_STATUS_CHANGED,
      'UPDATE',
      'onPlacementStatusChanged',
      placementStatusEvent,
    ],
  ])(
    'records %s as %s and acknowledges the event',
    async (_pattern, action, method, payload) => {
      await handler[method](payload as never, context);

      expect(auditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'broker@example.com',
        userRole: 'EMPLOYEE',
        action,
        resource: 'operations.reinsurance.placements',
        resourceId: 'placement-1',
        changes: payload.changes,
      });
      expect(channel.ack).toHaveBeenCalledWith('message');
    },
  );

  it.each<[string, string, MailboxAuditHandler]>([
    [
      EventPatterns.REINSURANCE_MAILBOX_CONNECTED,
      'CREATE',
      'onMailboxConnected',
    ],
    [EventPatterns.REINSURANCE_MAILBOX_SYNCED, 'UPDATE', 'onMailboxSynced'],
    [EventPatterns.REINSURANCE_MAILBOX_ARCHIVED, 'DELETE', 'onMailboxArchived'],
  ])(
    'records %s as %s and acknowledges the event',
    async (_pattern, action, method) => {
      await handler[method](mailboxEvent as never, context);

      expect(auditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'broker@example.com',
        userRole: 'EMPLOYEE',
        action,
        resource: 'operations.reinsurance.email-settings',
        resourceId: 'mailbox-1',
        changes: mailboxEvent.changes,
      });
      expect(channel.ack).toHaveBeenCalledWith('message');
    },
  );

  it('records email link events and acknowledges the event', async () => {
    await handler.onEmailLinked(emailLinkEvent, context);

    expect(auditService.log).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      userEmail: 'broker@example.com',
      userRole: 'EMPLOYEE',
      action: 'CREATE',
      resource: 'operations.reinsurance.email',
      resourceId: 'link-1',
      changes: emailLinkEvent.changes,
    });
    expect(channel.ack).toHaveBeenCalledWith('message');
  });
});
