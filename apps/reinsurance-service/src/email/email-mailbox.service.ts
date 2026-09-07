import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MailboxConnectionStatus, Prisma } from '../../prisma/generated/client';
import { EmailEventPublisher } from '../messaging/email-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectMailboxDto } from './dto/connect-mailbox.dto';
import { QueryMailboxesDto } from './dto/query-mailboxes.dto';
import { SyncMailboxDto } from './dto/sync-mailbox.dto';
import { EmailTokenEncryptionService } from './email-token-encryption.service';
import { EmailProviderMessage } from './providers/email-provider.interface';
import { EmailProviderRegistry } from './providers/email-provider.registry';

const mailboxSelect = {
  id: true,
  tenantId: true,
  provider: true,
  emailAddress: true,
  normalizedEmail: true,
  displayName: true,
  status: true,
  externalMailboxId: true,
  tokenExpiresAt: true,
  syncCursor: true,
  lastSyncedAt: true,
  lastSyncError: true,
  connectedByUserId: true,
  archivedByUserId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MailboxConnectionSelect;

const mailboxSecretSelect = {
  id: true,
  tenantId: true,
  provider: true,
  emailAddress: true,
  normalizedEmail: true,
  displayName: true,
  status: true,
  externalMailboxId: true,
  encryptedAccessToken: true,
  encryptedRefreshToken: true,
  tokenExpiresAt: true,
  syncCursor: true,
  lastSyncedAt: true,
  lastSyncError: true,
  connectedByUserId: true,
  archivedByUserId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MailboxConnectionSelect;

type MailboxRecord = Prisma.MailboxConnectionGetPayload<{
  select: typeof mailboxSelect;
}>;

type MailboxSecretRecord = Prisma.MailboxConnectionGetPayload<{
  select: typeof mailboxSecretSelect;
}>;

@Injectable()
export class EmailMailboxService {
  private readonly logger = new Logger(EmailMailboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: EmailProviderRegistry,
    private readonly encryption: EmailTokenEncryptionService,
    private readonly publisher: EmailEventPublisher,
  ) {}

  async findAll(tenantId: string, query: QueryMailboxesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MailboxConnectionWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.mailboxConnection.findMany({
        where,
        select: mailboxSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.mailboxConnection.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async connect(
    user: RequestUser,
    dto: ConnectMailboxDto,
  ): Promise<MailboxRecord> {
    const normalizedEmail = this.normalizeEmail(dto.emailAddress);
    const existing = await this.prisma.mailboxConnection.findFirst({
      where: {
        tenantId: user.tenantId,
        provider: dto.provider,
        normalizedEmail,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'An active mailbox connection already exists',
      );
    }

    const provider = this.providers.get(dto.provider);
    const metadata = await provider.verifyConnection({
      accessToken: dto.accessToken,
      emailAddress: dto.emailAddress,
    });
    const emailAddress = metadata.emailAddress ?? dto.emailAddress;

    const mailbox = await this.prisma.mailboxConnection.create({
      data: {
        tenantId: user.tenantId,
        provider: dto.provider,
        emailAddress,
        normalizedEmail: this.normalizeEmail(emailAddress),
        displayName: dto.displayName ?? metadata.displayName,
        status: MailboxConnectionStatus.ACTIVE,
        externalMailboxId: metadata.externalMailboxId,
        encryptedAccessToken: this.encryption.encrypt(dto.accessToken),
        encryptedRefreshToken: this.encryption.encrypt(dto.refreshToken),
        tokenExpiresAt: dto.tokenExpiresAt,
        connectedByUserId: user.id,
      },
      select: mailboxSelect,
    });

    this.publishMailbox('mailboxConnected', mailbox, user, {
      after: this.auditSnapshot(mailbox),
    });
    return mailbox;
  }

  async verify(user: RequestUser, id: string): Promise<MailboxRecord> {
    const mailbox = await this.findActiveWithSecrets(user.tenantId, id);
    const provider = this.providers.get(mailbox.provider);
    try {
      const metadata = await provider.verifyConnection({
        accessToken: this.encryption.decrypt(mailbox.encryptedAccessToken),
        emailAddress: mailbox.emailAddress,
      });
      return this.prisma.mailboxConnection.update({
        where: { id_tenantId: { id, tenantId: user.tenantId } },
        data: {
          status: MailboxConnectionStatus.ACTIVE,
          externalMailboxId:
            metadata.externalMailboxId ?? mailbox.externalMailboxId,
          displayName: metadata.displayName ?? mailbox.displayName,
          lastSyncError: null,
        },
        select: mailboxSelect,
      });
    } catch (error) {
      await this.prisma.mailboxConnection.update({
        where: { id_tenantId: { id, tenantId: user.tenantId } },
        data: {
          status: MailboxConnectionStatus.ERROR,
          lastSyncError: this.errorMessage(error),
        },
      });
      throw error;
    }
  }

  async sync(user: RequestUser, id: string, dto: SyncMailboxDto) {
    const mailbox = await this.findActiveWithSecrets(user.tenantId, id);
    const provider = this.providers.get(mailbox.provider);

    try {
      const result = await provider.sync({
        accessToken: this.encryption.decrypt(mailbox.encryptedAccessToken),
        limit: dto.limit ?? 25,
        cursor: mailbox.syncCursor,
      });
      const syncStats = await this.persistMessages(mailbox, result.messages);
      const lastSyncedAt = new Date();
      const updatedMailbox = await this.prisma.mailboxConnection.update({
        where: { id_tenantId: { id, tenantId: user.tenantId } },
        data: {
          status: MailboxConnectionStatus.ACTIVE,
          syncCursor: result.nextCursor,
          lastSyncedAt,
          lastSyncError: null,
        },
        select: mailboxSelect,
      });

      this.publishMailboxSynced(updatedMailbox, user, {
        threadsSynced: syncStats.threadsSynced,
        messagesSynced: syncStats.messagesSynced,
        lastSyncedAt,
      });

      return {
        mailbox: updatedMailbox,
        ...syncStats,
      };
    } catch (error) {
      await this.prisma.mailboxConnection.update({
        where: { id_tenantId: { id, tenantId: user.tenantId } },
        data: {
          status: MailboxConnectionStatus.ERROR,
          lastSyncError: this.errorMessage(error),
        },
      });
      throw error;
    }
  }

  async archive(user: RequestUser, id: string): Promise<MailboxRecord> {
    const existing = await this.findOne(user.tenantId, id);
    const mailbox = await this.prisma.mailboxConnection.update({
      where: { id_tenantId: { id, tenantId: user.tenantId }, archivedAt: null },
      data: {
        status: MailboxConnectionStatus.DISCONNECTED,
        archivedAt: new Date(),
        archivedByUserId: user.id,
      },
      select: mailboxSelect,
    });

    this.publishMailbox('mailboxArchived', mailbox, user, {
      before: this.auditSnapshot(existing),
      after: this.auditSnapshot(mailbox),
    });
    return mailbox;
  }

  private async findOne(tenantId: string, id: string): Promise<MailboxRecord> {
    const mailbox = await this.prisma.mailboxConnection.findFirst({
      where: { id, tenantId, archivedAt: null },
      select: mailboxSelect,
    });
    if (!mailbox) throw new NotFoundException('Mailbox connection not found');
    return mailbox;
  }

  private async findActiveWithSecrets(
    tenantId: string,
    id: string,
  ): Promise<MailboxSecretRecord> {
    const mailbox = await this.prisma.mailboxConnection.findFirst({
      where: { id, tenantId, archivedAt: null },
      select: mailboxSecretSelect,
    });
    if (!mailbox) throw new NotFoundException('Mailbox connection not found');
    return mailbox;
  }

  private async persistMessages(
    mailbox: MailboxSecretRecord,
    messages: EmailProviderMessage[],
  ): Promise<{ threadsSynced: number; messagesSynced: number }> {
    const threadIds = new Set<string>();
    let messagesSynced = 0;

    for (const message of messages) {
      threadIds.add(message.providerThreadId);
      const thread = await this.prisma.emailThread.upsert({
        where: {
          tenantId_mailboxConnectionId_providerThreadId: {
            tenantId: mailbox.tenantId,
            mailboxConnectionId: mailbox.id,
            providerThreadId: message.providerThreadId,
          },
        },
        create: {
          tenantId: mailbox.tenantId,
          mailboxConnectionId: mailbox.id,
          providerThreadId: message.providerThreadId,
          subject: message.subject,
          participants: this.participantsJson(message),
          lastMessageAt: message.receivedAt ?? message.sentAt,
          hasAttachments: message.hasAttachments ?? false,
        },
        update: {
          subject: message.subject,
          participants: this.participantsJson(message),
          lastMessageAt: message.receivedAt ?? message.sentAt,
          hasAttachments: message.hasAttachments ?? false,
        },
        select: { id: true },
      });

      await this.prisma.emailMessage.upsert({
        where: {
          tenantId_mailboxConnectionId_providerMessageId: {
            tenantId: mailbox.tenantId,
            mailboxConnectionId: mailbox.id,
            providerMessageId: message.providerMessageId,
          },
        },
        create: {
          tenantId: mailbox.tenantId,
          mailboxConnectionId: mailbox.id,
          threadId: thread.id,
          providerMessageId: message.providerMessageId,
          internetMessageId: message.internetMessageId,
          direction: message.direction,
          subject: message.subject,
          fromEmail: message.fromEmail,
          fromName: message.fromName,
          toRecipients: this.jsonOrUndefined(message.toRecipients),
          ccRecipients: this.jsonOrUndefined(message.ccRecipients),
          receivedAt: message.receivedAt,
          sentAt: message.sentAt,
          bodyPreview: message.bodyPreview,
          hasAttachments: message.hasAttachments ?? false,
          isRead: message.isRead ?? false,
          attachments: {
            create: (message.attachments ?? []).map((attachment) => ({
              tenantId: mailbox.tenantId,
              providerAttachmentId: attachment.providerAttachmentId,
              fileName: attachment.fileName,
              contentType: attachment.contentType,
              sizeBytes: attachment.sizeBytes,
              isInline: attachment.isInline ?? false,
              contentId: attachment.contentId,
            })),
          },
        },
        update: {
          subject: message.subject,
          fromEmail: message.fromEmail,
          fromName: message.fromName,
          toRecipients: this.jsonOrUndefined(message.toRecipients),
          ccRecipients: this.jsonOrUndefined(message.ccRecipients),
          receivedAt: message.receivedAt,
          sentAt: message.sentAt,
          bodyPreview: message.bodyPreview,
          hasAttachments: message.hasAttachments ?? false,
          isRead: message.isRead ?? false,
        },
      });
      messagesSynced += 1;
    }

    for (const providerThreadId of threadIds) {
      const thread = await this.prisma.emailThread.findUnique({
        where: {
          tenantId_mailboxConnectionId_providerThreadId: {
            tenantId: mailbox.tenantId,
            mailboxConnectionId: mailbox.id,
            providerThreadId,
          },
        },
        select: { id: true },
      });
      if (!thread) continue;

      const [messageCount, hasAttachments] = await Promise.all([
        this.prisma.emailMessage.count({
          where: { tenantId: mailbox.tenantId, threadId: thread.id },
        }),
        this.prisma.emailMessage.findFirst({
          where: {
            tenantId: mailbox.tenantId,
            threadId: thread.id,
            hasAttachments: true,
          },
          select: { id: true },
        }),
      ]);

      await this.prisma.emailThread.update({
        where: { id_tenantId: { id: thread.id, tenantId: mailbox.tenantId } },
        data: { messageCount, hasAttachments: Boolean(hasAttachments) },
      });
    }

    return { threadsSynced: threadIds.size, messagesSynced };
  }

  private participantsJson(
    message: EmailProviderMessage,
  ): Prisma.InputJsonValue | undefined {
    return this.jsonOrUndefined({
      from: { email: message.fromEmail, name: message.fromName },
      to: message.toRecipients,
      cc: message.ccRecipients,
    });
  }

  private jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private auditSnapshot(mailbox: MailboxRecord): Record<string, unknown> {
    return {
      id: mailbox.id,
      provider: mailbox.provider,
      emailAddress: mailbox.emailAddress,
      status: mailbox.status,
      archivedAt: mailbox.archivedAt?.toISOString() ?? null,
    };
  }

  private publishMailbox(
    method: 'mailboxConnected' | 'mailboxArchived',
    mailbox: MailboxRecord,
    user: RequestUser,
    changes: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
  ): void {
    try {
      this.publisher[method]({
        tenantId: user.tenantId,
        mailboxConnectionId: mailbox.id,
        provider: mailbox.provider,
        emailAddress: mailbox.emailAddress,
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        changes,
      }).catch((error: unknown) => {
        this.logger.warn(
          `Mailbox audit event failed: ${this.errorMessage(error)}`,
        );
      });
    } catch (error) {
      this.logger.warn(
        `Mailbox audit event failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private publishMailboxSynced(
    mailbox: MailboxRecord,
    user: RequestUser,
    stats: {
      threadsSynced: number;
      messagesSynced: number;
      lastSyncedAt: Date;
    },
  ): void {
    try {
      this.publisher
        .mailboxSynced({
          tenantId: user.tenantId,
          mailboxConnectionId: mailbox.id,
          provider: mailbox.provider,
          emailAddress: mailbox.emailAddress,
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          threadsSynced: stats.threadsSynced,
          messagesSynced: stats.messagesSynced,
          lastSyncedAt: stats.lastSyncedAt.toISOString(),
          changes: { after: this.auditSnapshot(mailbox) },
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Mailbox sync audit event failed: ${this.errorMessage(error)}`,
          );
        });
    } catch (error) {
      this.logger.warn(
        `Mailbox sync audit event failed: ${this.errorMessage(error)}`,
      );
    }
  }
}
