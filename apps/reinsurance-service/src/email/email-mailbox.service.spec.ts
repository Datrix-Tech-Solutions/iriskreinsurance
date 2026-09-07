import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  EmailMessageDirection,
  MailboxConnectionStatus,
  MailboxProvider,
} from '../../prisma/generated/client';
import { EmailEventPublisher } from '../messaging/email-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { EmailMailboxService } from './email-mailbox.service';
import { EmailTokenEncryptionService } from './email-token-encryption.service';
import { EmailProviderRegistry } from './providers/email-provider.registry';

describe('EmailMailboxService', () => {
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
  const mailbox = {
    id: 'mailbox-1',
    tenantId: 'tenant-1',
    provider: MailboxProvider.MICROSOFT_GRAPH,
    emailAddress: 'placements@example.com',
    normalizedEmail: 'placements@example.com',
    displayName: 'Placements',
    status: MailboxConnectionStatus.ACTIVE,
    externalMailboxId: 'external-1',
    encryptedAccessToken: 'encrypted-access',
    encryptedRefreshToken: null,
    tokenExpiresAt: null,
    syncCursor: null,
    lastSyncedAt: null,
    lastSyncError: null,
    connectedByUserId: 'user-1',
    archivedByUserId: null,
    archivedAt: null,
    createdAt: new Date('2026-05-28T10:00:00.000Z'),
    updatedAt: new Date('2026-05-28T10:00:00.000Z'),
  };

  let prisma: {
    mailboxConnection: Record<string, jest.Mock>;
    emailThread: Record<string, jest.Mock>;
    emailMessage: Record<string, jest.Mock>;
  };
  let provider: { verifyConnection: jest.Mock; sync: jest.Mock };
  let registry: { get: jest.Mock };
  let publisher: {
    mailboxConnected: jest.Mock;
    mailboxSynced: jest.Mock;
    mailboxArchived: jest.Mock;
  };
  let service: EmailMailboxService;

  beforeEach(() => {
    process.env.REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    prisma = {
      mailboxConnection: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      emailThread: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emailMessage: {
        upsert: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    provider = {
      verifyConnection: jest.fn(),
      sync: jest.fn(),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    publisher = {
      mailboxConnected: jest.fn().mockResolvedValue(undefined),
      mailboxSynced: jest.fn().mockResolvedValue(undefined),
      mailboxArchived: jest.fn().mockResolvedValue(undefined),
    };
    service = new EmailMailboxService(
      prisma as unknown as PrismaService,
      registry as unknown as EmailProviderRegistry,
      new EmailTokenEncryptionService(),
      publisher as unknown as EmailEventPublisher,
    );
  });

  afterEach(() => {
    delete process.env.REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY;
  });

  it('lists only active mailbox connections in the current tenant', async () => {
    prisma.mailboxConnection.findMany.mockResolvedValue([mailbox]);
    prisma.mailboxConnection.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      provider: MailboxProvider.MICROSOFT_GRAPH,
      page: 2,
      limit: 10,
    });

    expect(prisma.mailboxConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          archivedAt: null,
          provider: MailboxProvider.MICROSOFT_GRAPH,
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('prevents duplicate active mailbox connections per tenant/provider/email', async () => {
    prisma.mailboxConnection.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.connect(user, {
        provider: MailboxProvider.MICROSOFT_GRAPH,
        emailAddress: 'placements@example.com',
        accessToken: 'token',
      }),
    ).rejects.toThrow(ConflictException);
    expect(provider.verifyConnection).not.toHaveBeenCalled();
  });

  it('verifies and stores mailbox tokens encrypted', async () => {
    prisma.mailboxConnection.findFirst.mockResolvedValue(null);
    provider.verifyConnection.mockResolvedValue({
      externalMailboxId: 'external-1',
      emailAddress: 'placements@example.com',
      displayName: 'Placements',
    });
    prisma.mailboxConnection.create.mockImplementation((args: unknown) => {
      const { data } = args as { data: Record<string, unknown> };
      return {
        ...mailbox,
        ...data,
        encryptedAccessToken: undefined,
        encryptedRefreshToken: undefined,
      };
    });

    await service.connect(user, {
      provider: MailboxProvider.MICROSOFT_GRAPH,
      emailAddress: 'placements@example.com',
      accessToken: 'plain-access-token',
      refreshToken: 'plain-refresh-token',
    });

    const createCalls = prisma.mailboxConnection.create.mock
      .calls as unknown as Array<[unknown]>;
    const createCall = createCalls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    const createdData = createCall.data;
    expect(createdData.encryptedAccessToken).toEqual(expect.any(String));
    expect(createdData.encryptedAccessToken).not.toBe('plain-access-token');
    expect(createdData.encryptedRefreshToken).not.toBe('plain-refresh-token');
  });

  it('syncs provider metadata into tenant-scoped threads and messages', async () => {
    const encryption = new EmailTokenEncryptionService();
    const encryptedAccessToken = encryption.encrypt('access-token');
    prisma.mailboxConnection.findFirst.mockResolvedValue({
      ...mailbox,
      encryptedAccessToken,
    });
    provider.sync.mockResolvedValue({
      messages: [
        {
          providerMessageId: 'message-1',
          providerThreadId: 'thread-provider-1',
          direction: EmailMessageDirection.INBOUND,
          subject: 'Renewal terms',
          fromEmail: 'cedant@example.com',
          receivedAt: new Date('2026-05-28T10:00:00.000Z'),
        },
      ],
      nextCursor: 'cursor-2',
    });
    prisma.emailThread.upsert.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.upsert.mockResolvedValue({ id: 'message-1' });
    prisma.emailThread.findUnique.mockResolvedValue({ id: 'thread-1' });
    prisma.emailMessage.count.mockResolvedValue(1);
    prisma.emailMessage.findFirst.mockResolvedValue(null);
    prisma.emailThread.update.mockResolvedValue({ id: 'thread-1' });
    prisma.mailboxConnection.update.mockResolvedValue(mailbox);

    await service.sync(user, 'mailbox-1', { limit: 10 });

    expect(prisma.mailboxConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'mailbox-1',
          tenantId: 'tenant-1',
          archivedAt: null,
        },
      }),
    );
    const threadUpsertCalls = prisma.emailThread.upsert.mock
      .calls as unknown as Array<[unknown]>;
    const threadUpsertCall = threadUpsertCalls[0]?.[0] as {
      create: Record<string, unknown>;
    };
    expect(threadUpsertCall).toMatchObject({
      create: {
        tenantId: 'tenant-1',
        mailboxConnectionId: 'mailbox-1',
        providerThreadId: 'thread-provider-1',
      },
    });
    const messageUpsertCalls = prisma.emailMessage.upsert.mock
      .calls as unknown as Array<[unknown]>;
    const messageUpsertCall = messageUpsertCalls[0]?.[0] as {
      create: Record<string, unknown>;
    };
    expect(messageUpsertCall).toMatchObject({
      create: {
        tenantId: 'tenant-1',
        mailboxConnectionId: 'mailbox-1',
        threadId: 'thread-1',
        providerMessageId: 'message-1',
      },
    });
    expect(publisher.mailboxSynced).toHaveBeenCalled();
  });

  it('fails mailbox operations when the tenant-scoped record is missing', async () => {
    prisma.mailboxConnection.findFirst.mockResolvedValue(null);

    await expect(service.verify(user, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('requires an encryption key before storing OAuth tokens', async () => {
    delete process.env.REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY;
    prisma.mailboxConnection.findFirst.mockResolvedValue(null);
    provider.verifyConnection.mockResolvedValue({});

    await expect(
      service.connect(user, {
        provider: MailboxProvider.MICROSOFT_GRAPH,
        emailAddress: 'placements@example.com',
        accessToken: 'token',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
