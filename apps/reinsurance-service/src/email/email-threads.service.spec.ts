import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  EmailMessageDirection,
  EmailMessageStatus,
  MailboxConnectionStatus,
  MailboxProvider,
} from '../../prisma/generated/client';
import { EmailEventPublisher } from '../messaging/email-event.publisher';
import { PlacementAttachmentsService } from '../placements/documents/attachments/attachments.service';
import { PlacementDocumentsService } from '../placements/documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTokenEncryptionService } from './email-token-encryption.service';
import { EmailThreadsService } from './email-threads.service';
import { EmailProviderRegistry } from './providers/email-provider.registry';

describe('EmailThreadsService', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  };
  const thread = {
    id: 'thread-1',
    tenantId: 'tenant-1',
    mailboxConnectionId: 'mailbox-1',
    providerThreadId: 'provider-thread-1',
    archivedAt: null,
  };

  let prisma: {
    $transaction: jest.Mock;
    emailThread: Record<string, jest.Mock>;
    emailMessage: Record<string, jest.Mock>;
    mailboxConnection: Record<string, jest.Mock>;
    placement: Record<string, jest.Mock>;
    placementEmailLink: Record<string, jest.Mock>;
  };
  let publisher: { emailLinked: jest.Mock };
  let provider: {
    sendMessage: jest.Mock;
    replyToMessage: jest.Mock;
  };
  let registry: { get: jest.Mock };
  let encryption: { decrypt: jest.Mock };
  let documentsService: { readStoredPdfForEmail: jest.Mock };
  let attachmentsService: { readStoredAttachmentForEmail: jest.Mock };
  let service: EmailThreadsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
      emailThread: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      emailMessage: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      mailboxConnection: {
        findFirst: jest.fn(),
      },
      placement: {
        findFirst: jest.fn(),
      },
      placementEmailLink: {
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    publisher = { emailLinked: jest.fn().mockResolvedValue(undefined) };
    provider = {
      sendMessage: jest.fn(),
      replyToMessage: jest.fn(),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    encryption = { decrypt: jest.fn().mockReturnValue('access-token') };
    documentsService = { readStoredPdfForEmail: jest.fn() };
    attachmentsService = { readStoredAttachmentForEmail: jest.fn() };
    service = new EmailThreadsService(
      prisma as unknown as PrismaService,
      publisher as unknown as EmailEventPublisher,
      registry as unknown as EmailProviderRegistry,
      encryption as unknown as EmailTokenEncryptionService,
      documentsService as unknown as PlacementDocumentsService,
      attachmentsService as unknown as PlacementAttachmentsService,
    );
  });

  const activeMailbox = {
    id: 'mailbox-1',
    tenantId: 'tenant-1',
    provider: MailboxProvider.MICROSOFT_GRAPH,
    emailAddress: 'placements@example.com',
    displayName: 'Placements',
    encryptedAccessToken: 'encrypted-access-token',
    status: MailboxConnectionStatus.ACTIVE,
    archivedAt: null,
  };

  const placementThreadLink = {
    id: 'link-1',
    placementId: 'placement-1',
    threadId: 'thread-1',
    linkedByUserId: 'user-1',
    note: null,
    createdAt: new Date('2026-06-11T09:00:00.000Z'),
    thread: {
      id: 'thread-1',
      subject: 'FAC placement thread',
      participants: null,
      lastMessageAt: new Date('2026-06-11T10:00:00.000Z'),
      messageCount: 1,
      hasAttachments: false,
      mailboxConnection: {
        id: 'mailbox-1',
        provider: MailboxProvider.MICROSOFT_GRAPH,
        emailAddress: 'placements@example.com',
        displayName: 'Placements',
      },
      messages: [
        {
          id: 'message-1',
          bodyPreview: 'Hello cedant',
          receivedAt: null,
          sentAt: new Date('2026-06-11T10:00:00.000Z'),
          attachments: [],
        },
      ],
    },
  };

  it('lists only active threads in the current tenant', async () => {
    prisma.emailThread.findMany.mockResolvedValue([thread]);
    prisma.emailThread.count.mockResolvedValue(1);

    const result = await service.findThreads('tenant-1', {
      mailboxConnectionId: 'mailbox-1',
      search: 'renewal',
      page: 1,
      limit: 20,
    });

    expect(prisma.emailThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          archivedAt: null,
          mailboxConnectionId: 'mailbox-1',
          subject: { contains: 'renewal', mode: 'insensitive' },
        },
      }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('lists messages only for active tenant-owned threads', async () => {
    prisma.emailMessage.findMany.mockResolvedValue([]);
    prisma.emailMessage.count.mockResolvedValue(0);

    await service.findMessages('tenant-1', {
      threadId: 'thread-1',
      page: 1,
      limit: 20,
    });

    const findManyCalls = prisma.emailMessage.findMany.mock
      .calls as unknown as Array<[unknown]>;
    const findManyCall = findManyCalls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        threadId: 'thread-1',
        thread: { archivedAt: null },
      },
    });
  });

  it('links a tenant-owned thread to a tenant-owned placement', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.emailThread.findFirst.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.findFirst.mockResolvedValue({ id: 'message-1' });
    prisma.placementEmailLink.findFirst.mockResolvedValue(null);
    prisma.placementEmailLink.create.mockResolvedValue({
      id: 'link-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      threadId: 'thread-1',
      messageId: 'message-1',
      note: null,
      linkedByUserId: 'user-1',
    });

    const result = await service.linkPlacement(
      user,
      'thread-1',
      'placement-1',
      { messageId: 'message-1' },
    );

    expect(prisma.placement.findFirst).toHaveBeenCalledWith({
      where: { id: 'placement-1', tenantId: 'tenant-1', archivedAt: null },
      select: { id: true },
    });
    expect(prisma.placementEmailLink.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        threadId: 'thread-1',
        messageId: 'message-1',
        note: undefined,
        linkedByUserId: 'user-1',
      },
    });
    expect(result.id).toBe('link-1');
    expect(publisher.emailLinked).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        threadId: 'thread-1',
      }),
    );
  });

  it('lists placement-linked email threads with latest message metadata', async () => {
    const linkedAt = new Date('2026-06-11T09:00:00.000Z');
    const latestAt = new Date('2026-06-11T10:00:00.000Z');
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEmailLink.findMany.mockResolvedValue([
      {
        id: 'link-1',
        placementId: 'placement-1',
        threadId: 'thread-1',
        linkedByUserId: 'user-1',
        note: 'Important placement thread',
        createdAt: linkedAt,
        thread: {
          id: 'thread-1',
          subject: 'FAC placement thread',
          participants: [{ email: 'cedant@example.com' }],
          lastMessageAt: latestAt,
          messageCount: 2,
          hasAttachments: false,
          mailboxConnection: {
            id: 'mailbox-1',
            provider: 'MICROSOFT_GRAPH',
            emailAddress: 'placements@example.com',
            displayName: 'Placements',
          },
          messages: [
            {
              bodyPreview: 'Latest reply',
              receivedAt: latestAt,
              sentAt: null,
            },
          ],
        },
      },
    ]);

    const result = await service.findPlacementThreads(
      'tenant-1',
      'placement-1',
    );

    expect(prisma.placementEmailLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          archivedAt: null,
          thread: { archivedAt: null },
        },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        linkId: 'link-1',
        threadId: 'thread-1',
        latestMessagePreview: 'Latest reply',
        latestMessageAt: latestAt,
        linkedAt,
      }),
    ]);
  });

  it('gets a placement email thread with messages in chronological order', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEmailLink.findFirst.mockResolvedValue({
      id: 'link-1',
      placementId: 'placement-1',
      threadId: 'thread-1',
      linkedByUserId: 'user-1',
      note: null,
      createdAt: new Date('2026-06-11T09:00:00.000Z'),
      thread: {
        id: 'thread-1',
        subject: 'FAC placement thread',
        participants: null,
        lastMessageAt: null,
        messageCount: 2,
        hasAttachments: false,
        mailboxConnection: {
          id: 'mailbox-1',
          provider: 'MICROSOFT_GRAPH',
          emailAddress: 'placements@example.com',
          displayName: null,
        },
        messages: [
          {
            id: 'message-1',
            bodyPreview: 'First',
            direction: EmailMessageDirection.INBOUND,
            receivedAt: new Date('2026-06-11T09:00:00.000Z'),
            createdAt: new Date('2026-06-11T09:05:00.000Z'),
          },
          {
            id: 'message-2',
            bodyPreview: 'Second',
            direction: EmailMessageDirection.OUTBOUND,
            status: EmailMessageStatus.SENT,
            sentAt: new Date('2026-06-11T10:00:00.000Z'),
            createdAt: new Date('2026-06-11T08:00:00.000Z'),
          },
        ],
      },
    });

    const result = await service.findPlacementThread(
      'tenant-1',
      'placement-1',
      'thread-1',
    );

    const findFirstCalls = prisma.placementEmailLink.findFirst.mock
      .calls as unknown as Array<
      [
        {
          where: Record<string, unknown>;
          include: {
            thread: {
              include: { messages: { orderBy: unknown } };
            };
          };
        },
      ]
    >;
    expect(findFirstCalls[0]?.[0].where).toEqual({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      threadId: 'thread-1',
      archivedAt: null,
      thread: { archivedAt: null },
    });
    expect(
      findFirstCalls[0]?.[0].include.thread.include.messages.orderBy,
    ).toEqual([{ createdAt: 'asc' }, { receivedAt: 'asc' }, { sentAt: 'asc' }]);
    expect(result.messages.map((message) => message.id)).toEqual([
      'message-1',
      'message-2',
    ]);
  });

  it('sends a new placement email and persists the outbound message as sent', async () => {
    const sentAt = new Date('2026-06-11T10:00:00.000Z');
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.mailboxConnection.findFirst.mockResolvedValue(activeMailbox);
    prisma.emailThread.create.mockResolvedValue({
      id: 'thread-1',
      subject: 'Offer slip',
    });
    prisma.emailMessage.create.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.SENDING,
      direction: EmailMessageDirection.OUTBOUND,
      attachments: [],
    });
    prisma.placementEmailLink.create.mockResolvedValue({
      id: 'link-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      threadId: 'thread-1',
      messageId: 'message-1',
      linkedByUserId: 'user-1',
      note: null,
    });
    provider.sendMessage.mockResolvedValue({
      providerThreadId: 'provider-thread-1',
      providerMessageId: 'provider-message-1',
      internetMessageId: 'internet-1',
      sentAt,
    });
    prisma.emailThread.update.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.update.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.SENT,
      direction: EmailMessageDirection.OUTBOUND,
      providerMessageId: 'provider-message-1',
      sentAt,
      attachments: [],
    });
    prisma.placementEmailLink.findFirst.mockResolvedValue(placementThreadLink);

    const result = await service.sendPlacementEmail(user, 'placement-1', {
      mailboxConnectionId: 'mailbox-1',
      subject: 'Offer slip',
      to: [{ email: 'cedant@example.com', name: 'Cedant' }],
      cc: [{ email: 'broker@example.com' }],
      bcc: [{ email: 'audit@example.com' }],
      bodyText: 'Please review the attached terms.',
    });

    const threadCreateCalls = prisma.emailThread.create.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(threadCreateCalls[0]?.[0].data).toMatchObject({
      tenantId: 'tenant-1',
      mailboxConnectionId: 'mailbox-1',
      subject: 'Offer slip',
    });
    expect(threadCreateCalls[0]?.[0].data.providerThreadId).toEqual(
      expect.stringMatching(/^pending:thread:/),
    );

    const messageCreateCalls = prisma.emailMessage.create.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(messageCreateCalls[0]?.[0].data).toMatchObject({
      direction: EmailMessageDirection.OUTBOUND,
      status: EmailMessageStatus.SENDING,
      toRecipients: [{ email: 'cedant@example.com', name: 'Cedant' }],
      ccRecipients: [{ email: 'broker@example.com' }],
      bccRecipients: [{ email: 'audit@example.com' }],
      bodyText: 'Please review the attached terms.',
    });
    expect(messageCreateCalls[0]?.[0].data).not.toHaveProperty('sentAt');
    expect(messageCreateCalls[0]?.[0].data.providerMessageId).toEqual(
      expect.stringMatching(/^pending:message:/),
    );
    expect(provider.sendMessage).toHaveBeenCalledWith({
      accessToken: 'access-token',
      subject: 'Offer slip',
      to: [{ email: 'cedant@example.com', name: 'Cedant' }],
      cc: [{ email: 'broker@example.com' }],
      bcc: [{ email: 'audit@example.com' }],
      bodyText: 'Please review the attached terms.',
      bodyHtml: undefined,
    });
    const messageUpdateCalls = prisma.emailMessage.update.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(messageUpdateCalls[0]?.[0].data).toMatchObject({
      providerMessageId: 'provider-message-1',
      status: EmailMessageStatus.SENT,
      errorMessage: null,
    });
    expect(result.message.status).toBe(EmailMessageStatus.SENT);
  });

  it('sends a placement email with generated offer and closing slip PDFs attached', async () => {
    const sentAt = new Date('2026-06-11T10:00:00.000Z');
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    documentsService.readStoredPdfForEmail
      .mockResolvedValueOnce({
        body: Buffer.from('%PDF-offer'),
        mimeType: 'application/pdf',
        fileName: 'offer-slip.pdf',
        sizeBytes: 10,
      })
      .mockResolvedValueOnce({
        body: Buffer.from('%PDF-closing'),
        mimeType: 'application/pdf',
        fileName: 'closing-slip.pdf',
        sizeBytes: 12,
      });
    prisma.mailboxConnection.findFirst.mockResolvedValue(activeMailbox);
    prisma.emailThread.create.mockResolvedValue({
      id: 'thread-1',
      subject: 'Offer and closing slips',
    });
    prisma.emailMessage.create.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.SENDING,
      direction: EmailMessageDirection.OUTBOUND,
      attachments: [],
    });
    prisma.placementEmailLink.create.mockResolvedValue({ id: 'link-1' });
    provider.sendMessage.mockResolvedValue({
      providerThreadId: 'provider-thread-1',
      providerMessageId: 'provider-message-1',
      internetMessageId: 'internet-1',
      sentAt,
    });
    prisma.emailThread.update.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.update.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.SENT,
      providerMessageId: 'provider-message-1',
      sentAt,
      attachments: [
        {
          providerAttachmentId: 'document:offer-document-1',
          fileName: 'offer-slip.pdf',
        },
        {
          providerAttachmentId: 'document:closing-document-1',
          fileName: 'closing-slip.pdf',
        },
      ],
    });
    prisma.placementEmailLink.findFirst.mockResolvedValue(placementThreadLink);

    await service.sendPlacementEmail(user, 'placement-1', {
      mailboxConnectionId: 'mailbox-1',
      subject: 'Offer and closing slips',
      to: [{ email: 'reinsurer@example.com', name: 'Reinsurer' }],
      bodyText: 'Please review the attached documents.',
      documentIds: ['offer-document-1', 'closing-document-1'],
    });

    expect(documentsService.readStoredPdfForEmail).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'offer-document-1',
    );
    expect(documentsService.readStoredPdfForEmail).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'closing-document-1',
    );
    const threadCreateCalls = prisma.emailThread.create.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(threadCreateCalls[0]?.[0].data).toMatchObject({
      hasAttachments: true,
    });
    const messageCreateCalls = prisma.emailMessage.create.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(messageCreateCalls[0]?.[0].data).toMatchObject({
      hasAttachments: true,
      attachments: {
        create: [
          {
            tenantId: 'tenant-1',
            providerAttachmentId: 'document:offer-document-1',
            fileName: 'offer-slip.pdf',
            contentType: 'application/pdf',
            sizeBytes: 10,
            isInline: false,
          },
          {
            tenantId: 'tenant-1',
            providerAttachmentId: 'document:closing-document-1',
            fileName: 'closing-slip.pdf',
            contentType: 'application/pdf',
            sizeBytes: 12,
            isInline: false,
          },
        ],
      },
    });
    expect(provider.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            fileName: 'offer-slip.pdf',
            contentType: 'application/pdf',
            contentBytes: Buffer.from('%PDF-offer'),
            sizeBytes: 10,
          },
          {
            fileName: 'closing-slip.pdf',
            contentType: 'application/pdf',
            contentBytes: Buffer.from('%PDF-closing'),
            sizeBytes: 12,
          },
        ],
      }),
    );
  });

  it('sends a placement email with uploaded placement attachments', async () => {
    const sentAt = new Date('2026-06-11T10:00:00.000Z');
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    attachmentsService.readStoredAttachmentForEmail.mockResolvedValue({
      body: Buffer.from('supporting-file'),
      mimeType: 'application/pdf',
      fileName: 'supporting-file.pdf',
      sizeBytes: 15,
    });
    prisma.mailboxConnection.findFirst.mockResolvedValue(activeMailbox);
    prisma.emailThread.create.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.create.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.SENDING,
      attachments: [],
    });
    prisma.placementEmailLink.create.mockResolvedValue({ id: 'link-1' });
    provider.sendMessage.mockResolvedValue({
      providerThreadId: 'provider-thread-1',
      providerMessageId: 'provider-message-1',
      sentAt,
    });
    prisma.emailThread.update.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.update.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.SENT,
      attachments: [],
    });
    prisma.placementEmailLink.findFirst.mockResolvedValue(placementThreadLink);

    await service.sendPlacementEmail(user, 'placement-1', {
      mailboxConnectionId: 'mailbox-1',
      subject: 'Supporting file',
      to: [{ email: 'cedant@example.com' }],
      bodyText: 'Please see attached.',
      attachmentIds: ['attachment-1'],
    });

    expect(
      attachmentsService.readStoredAttachmentForEmail,
    ).toHaveBeenCalledWith('tenant-1', 'placement-1', 'attachment-1');
    expect(provider.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            fileName: 'supporting-file.pdf',
            contentType: 'application/pdf',
            contentBytes: Buffer.from('supporting-file'),
            sizeBytes: 15,
          },
        ],
      }),
    );
  });

  it('rejects generated document attachments outside the placement scope', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    documentsService.readStoredPdfForEmail.mockRejectedValue(
      new NotFoundException('Document not found'),
    );

    await expect(
      service.sendPlacementEmail(user, 'placement-1', {
        mailboxConnectionId: 'mailbox-1',
        subject: 'Offer slip',
        to: [{ email: 'reinsurer@example.com' }],
        bodyText: 'Please review.',
        documentIds: ['other-placement-document'],
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.mailboxConnection.findFirst).not.toHaveBeenCalled();
    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects unsupported generated document types before sending', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    documentsService.readStoredPdfForEmail.mockRejectedValue(
      new BadRequestException('Document type cannot be rendered as PDF'),
    );

    await expect(
      service.sendPlacementEmail(user, 'placement-1', {
        mailboxConnectionId: 'mailbox-1',
        subject: 'Debit note',
        to: [{ email: 'cedant@example.com' }],
        bodyText: 'Please review.',
        documentIds: ['debit-note-document'],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.mailboxConnection.findFirst).not.toHaveBeenCalled();
    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects attachments that require a provider upload session', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    documentsService.readStoredPdfForEmail.mockResolvedValue({
      body: Buffer.alloc(3 * 1024 * 1024),
      mimeType: 'application/pdf',
      fileName: 'large-offer-slip.pdf',
      sizeBytes: 3 * 1024 * 1024,
    });

    await expect(
      service.sendPlacementEmail(user, 'placement-1', {
        mailboxConnectionId: 'mailbox-1',
        subject: 'Offer slip',
        to: [{ email: 'reinsurer@example.com' }],
        bodyText: 'Please review.',
        documentIds: ['large-document'],
      }),
    ).rejects.toThrow(
      'Attachment "large-offer-slip.pdf" must be smaller than 3 MB',
    );

    expect(prisma.mailboxConnection.findFirst).not.toHaveBeenCalled();
    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it('stores a failed outbound message when provider sending fails', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.mailboxConnection.findFirst.mockResolvedValue(activeMailbox);
    prisma.emailThread.create.mockResolvedValue({
      id: 'thread-1',
      subject: 'Offer slip',
    });
    prisma.emailMessage.create.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.SENDING,
      attachments: [],
    });
    prisma.placementEmailLink.create.mockResolvedValue({ id: 'link-1' });
    provider.sendMessage.mockRejectedValue(new Error('provider down'));
    prisma.emailMessage.update.mockResolvedValue({
      id: 'message-1',
      status: EmailMessageStatus.FAILED,
    });

    await expect(
      service.sendPlacementEmail(user, 'placement-1', {
        mailboxConnectionId: 'mailbox-1',
        subject: 'Offer slip',
        to: [{ email: 'cedant@example.com' }],
        bodyText: 'Please review.',
      }),
    ).rejects.toThrow('provider down');

    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: 'message-1', tenantId: 'tenant-1' } },
      data: {
        status: EmailMessageStatus.FAILED,
        errorMessage: 'provider down',
        sentAt: null,
      },
    });
    expect(prisma.emailThread.update).not.toHaveBeenCalled();
  });

  it('requires a placement-thread link before replying', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.mailboxConnection.findFirst.mockResolvedValue(activeMailbox);
    prisma.placementEmailLink.findFirst.mockResolvedValue(null);

    await expect(
      service.replyToPlacementEmail(user, 'placement-1', 'thread-1', {
        mailboxConnectionId: 'mailbox-1',
        bodyText: 'Thanks.',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(provider.replyToMessage).not.toHaveBeenCalled();
  });

  it('persists an outbound reply in the same linked thread', async () => {
    const sentAt = new Date('2026-06-11T11:00:00.000Z');
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.mailboxConnection.findFirst.mockResolvedValue(activeMailbox);
    prisma.placementEmailLink.findFirst
      .mockResolvedValueOnce({
        id: 'link-1',
        placementId: 'placement-1',
        threadId: 'thread-1',
      })
      .mockResolvedValueOnce(placementThreadLink);
    prisma.emailThread.findFirst.mockResolvedValue({
      id: 'thread-1',
      subject: 'Offer slip',
      providerThreadId: 'provider-thread-1',
      mailboxConnectionId: 'mailbox-1',
    });
    prisma.emailMessage.findFirst
      .mockResolvedValueOnce({
        id: 'parent-message-1',
        providerMessageId: 'provider-message-parent',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        receivedAt: null,
        sentAt,
        createdAt: sentAt,
      });
    prisma.emailMessage.create.mockResolvedValue({
      id: 'reply-message-1',
      status: EmailMessageStatus.SENDING,
      attachments: [],
    });
    prisma.emailMessage.count.mockResolvedValue(2);
    prisma.emailThread.update.mockResolvedValue({ id: 'thread-1' });
    provider.replyToMessage.mockResolvedValue({
      providerThreadId: 'provider-thread-1',
      providerMessageId: 'provider-message-reply',
      internetMessageId: 'internet-reply',
      sentAt,
    });
    prisma.emailMessage.update.mockResolvedValue({
      id: 'reply-message-1',
      status: EmailMessageStatus.SENT,
      providerMessageId: 'provider-message-reply',
      attachments: [],
    });

    const result = await service.replyToPlacementEmail(
      user,
      'placement-1',
      'thread-1',
      {
        mailboxConnectionId: 'mailbox-1',
        to: [{ email: 'cedant@example.com' }],
        bodyHtml: '<p>Thanks.</p>',
      },
    );

    expect(prisma.placementEmailLink.create).not.toHaveBeenCalled();
    const replyCreateCalls = prisma.emailMessage.create.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(replyCreateCalls[0]?.[0].data).toMatchObject({
      threadId: 'thread-1',
      direction: EmailMessageDirection.OUTBOUND,
      status: EmailMessageStatus.SENDING,
      parentMessageId: 'parent-message-1',
      inReplyToMessageId: 'parent-message-1',
      bodyHtml: '<p>Thanks.</p>',
    });
    expect(provider.replyToMessage).toHaveBeenCalledWith({
      accessToken: 'access-token',
      providerMessageId: 'provider-message-parent',
      to: [{ email: 'cedant@example.com' }],
      cc: undefined,
      bcc: undefined,
      bodyText: undefined,
      bodyHtml: '<p>Thanks.</p>',
    });
    expect(result.message.status).toBe(EmailMessageStatus.SENT);
  });

  it('rejects replies sent through a mailbox that does not own the thread', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEmailLink.findFirst.mockResolvedValue({
      id: 'link-1',
      placementId: 'placement-1',
      threadId: 'thread-1',
    });
    prisma.emailThread.findFirst.mockResolvedValue({
      id: 'thread-1',
      subject: 'Offer slip',
      providerThreadId: 'provider-thread-1',
      mailboxConnectionId: 'mailbox-1',
    });

    await expect(
      service.replyToPlacementEmail(user, 'placement-1', 'thread-1', {
        mailboxConnectionId: 'mailbox-2',
        bodyText: 'Thanks.',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.mailboxConnection.findFirst).not.toHaveBeenCalled();
    expect(provider.replyToMessage).not.toHaveBeenCalled();
  });

  it('rejects outbound send when the mailbox is outside the tenant', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.mailboxConnection.findFirst.mockResolvedValue(null);

    await expect(
      service.sendPlacementEmail(user, 'placement-1', {
        mailboxConnectionId: 'mailbox-from-other-tenant',
        subject: 'Offer slip',
        to: [{ email: 'cedant@example.com' }],
        bodyText: 'Please review.',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects outbound send without a message body', async () => {
    await expect(
      service.sendPlacementEmail(user, 'placement-1', {
        mailboxConnectionId: 'mailbox-1',
        subject: 'Offer slip',
        to: [{ email: 'cedant@example.com' }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placement.findFirst).not.toHaveBeenCalled();
  });

  it('returns an existing active placement-thread link instead of duplicating it', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.emailThread.findFirst.mockResolvedValue({ id: 'thread-1' });
    prisma.placementEmailLink.findFirst.mockResolvedValue({
      id: 'link-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      threadId: 'thread-1',
      messageId: null,
      note: null,
      linkedByUserId: 'user-1',
    });

    const result = await service.linkPlacement(
      user,
      'thread-1',
      'placement-1',
      {},
    );

    expect(result.id).toBe('link-1');
    expect(prisma.placementEmailLink.create).not.toHaveBeenCalled();
    expect(publisher.emailLinked).not.toHaveBeenCalled();
  });

  it('rejects linking when the message is not in the selected thread and tenant', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.emailThread.findFirst.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.findFirst.mockResolvedValue(null);

    await expect(
      service.linkPlacement(user, 'thread-1', 'placement-1', {
        messageId: 'message-from-other-thread',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('archives links only inside the authenticated tenant', async () => {
    prisma.placementEmailLink.findFirst.mockResolvedValue({ id: 'link-1' });
    prisma.placementEmailLink.update.mockResolvedValue({
      id: 'link-1',
      archivedAt: new Date('2026-05-28T10:00:00.000Z'),
    });

    await service.archiveLink(user, 'link-1');

    expect(prisma.placementEmailLink.findFirst).toHaveBeenCalledWith({
      where: { id: 'link-1', tenantId: 'tenant-1', archivedAt: null },
    });
    expect(prisma.placementEmailLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_tenantId: { id: 'link-1', tenantId: 'tenant-1' } },
      }),
    );
    expect(prisma.placementEmailLink.delete).not.toHaveBeenCalled();
  });
});
