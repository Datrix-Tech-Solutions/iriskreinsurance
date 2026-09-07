import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  EmailMessageDirection,
  EmailMessageStatus,
  MailboxConnectionStatus,
  Prisma,
} from '../../prisma/generated/client';
import { EmailEventPublisher } from '../messaging/email-event.publisher';
import { PlacementAttachmentsService } from '../placements/documents/attachments/attachments.service';
import { PlacementDocumentsService } from '../placements/documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { LinkPlacementEmailDto } from './dto/link-placement-email.dto';
import { QueryEmailMessagesDto } from './dto/query-email-messages.dto';
import { QueryEmailThreadsDto } from './dto/query-email-threads.dto';
import {
  ReplyPlacementEmailDto,
  SendPlacementEmailDto,
} from './dto/send-placement-email.dto';
import { EmailTokenEncryptionService } from './email-token-encryption.service';
import { EmailProviderRegistry } from './providers/email-provider.registry';
import {
  EmailProviderFileAttachment,
  EmailProviderRecipient,
  EmailProviderSentMessage,
} from './providers/email-provider.interface';

const threadInclude = {
  messages: {
    orderBy: { receivedAt: 'desc' as const },
    take: 5,
    include: { attachments: true },
  },
} satisfies Prisma.EmailThreadInclude;

const messageInclude = {
  attachments: true,
} satisfies Prisma.EmailMessageInclude;

const mailboxSummarySelect = {
  id: true,
  provider: true,
  emailAddress: true,
  displayName: true,
} satisfies Prisma.MailboxConnectionSelect;

const mailboxOutboundSelect = {
  id: true,
  tenantId: true,
  provider: true,
  emailAddress: true,
  displayName: true,
  encryptedAccessToken: true,
  status: true,
  archivedAt: true,
} satisfies Prisma.MailboxConnectionSelect;

const placementThreadListInclude = {
  thread: {
    include: {
      mailboxConnection: { select: mailboxSummarySelect },
      messages: {
        orderBy: [
          { createdAt: 'desc' as const },
          { receivedAt: 'desc' as const },
          { sentAt: 'desc' as const },
        ],
        take: 10,
        include: { attachments: true },
      },
    },
  },
} satisfies Prisma.PlacementEmailLinkInclude;

const placementThreadDetailInclude = {
  thread: {
    include: {
      mailboxConnection: { select: mailboxSummarySelect },
      messages: {
        orderBy: [
          { createdAt: 'asc' as const },
          { receivedAt: 'asc' as const },
          { sentAt: 'asc' as const },
        ],
        include: { attachments: true },
      },
    },
  },
} satisfies Prisma.PlacementEmailLinkInclude;

type ThreadRecord = Prisma.EmailThreadGetPayload<{
  include: typeof threadInclude;
}>;

type LinkRecord = Prisma.PlacementEmailLinkGetPayload<object>;
type PlacementThreadListRecord = Prisma.PlacementEmailLinkGetPayload<{
  include: typeof placementThreadListInclude;
}>;
type PlacementThreadDetailRecord = Prisma.PlacementEmailLinkGetPayload<{
  include: typeof placementThreadDetailInclude;
}>;
type OutboundMailboxRecord = Prisma.MailboxConnectionGetPayload<{
  select: typeof mailboxOutboundSelect;
}>;
type WorkflowEmailAttachment = EmailProviderFileAttachment & {
  providerAttachmentId: string;
};
const MAX_INLINE_EMAIL_ATTACHMENT_BYTES = 3 * 1024 * 1024;

@Injectable()
export class EmailThreadsService {
  private readonly logger = new Logger(EmailThreadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EmailEventPublisher,
    private readonly providers: EmailProviderRegistry,
    private readonly encryption: EmailTokenEncryptionService,
    private readonly documentsService: PlacementDocumentsService,
    private readonly attachmentsService: PlacementAttachmentsService,
  ) {}

  async findThreads(tenantId: string, query: QueryEmailThreadsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.EmailThreadWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.mailboxConnectionId
        ? { mailboxConnectionId: query.mailboxConnectionId }
        : {}),
      ...(query.search
        ? { subject: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.emailThread.findMany({
        where,
        include: threadInclude,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.emailThread.count({ where }),
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

  async findThread(tenantId: string, id: string): Promise<ThreadRecord> {
    const thread = await this.prisma.emailThread.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: threadInclude,
    });

    if (!thread) throw new NotFoundException('Email thread not found');
    return thread;
  }

  async findMessages(tenantId: string, query: QueryEmailMessagesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.EmailMessageWhereInput = {
      tenantId,
      ...(query.threadId ? { threadId: query.threadId } : {}),
      ...(query.mailboxConnectionId
        ? { mailboxConnectionId: query.mailboxConnectionId }
        : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { fromEmail: { contains: query.search, mode: 'insensitive' } },
              { fromName: { contains: query.search, mode: 'insensitive' } },
              { bodyPreview: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      thread: { archivedAt: null },
    };

    const [items, total] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where,
        include: messageInclude,
        orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.emailMessage.count({ where }),
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

  async findPlacementThreads(tenantId: string, placementId: string) {
    await this.assertPlacement(tenantId, placementId);

    const links = await this.prisma.placementEmailLink.findMany({
      where: {
        tenantId,
        placementId,
        archivedAt: null,
        thread: { archivedAt: null },
      },
      include: placementThreadListInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return links.map((link) => this.mapPlacementThreadSummary(link));
  }

  async findPlacementThread(
    tenantId: string,
    placementId: string,
    threadId: string,
  ) {
    await this.assertPlacement(tenantId, placementId);

    const link = await this.prisma.placementEmailLink.findFirst({
      where: {
        tenantId,
        placementId,
        threadId,
        archivedAt: null,
        thread: { archivedAt: null },
      },
      include: placementThreadDetailInclude,
    });

    if (!link) throw new NotFoundException('Placement email thread not found');

    return {
      thread: this.mapPlacementThreadSummary(link),
      messages: this.sortMessagesByActivity(link.thread.messages, 'asc'),
    };
  }

  async sendPlacementEmail(
    user: RequestUser,
    placementId: string,
    dto: SendPlacementEmailDto,
  ) {
    this.assertBody(dto.bodyText, dto.bodyHtml);
    if (!dto.to?.length) {
      throw new BadRequestException('At least one recipient is required');
    }

    await this.assertPlacement(user.tenantId, placementId);
    const attachments = await this.prepareWorkflowAttachments(
      user.tenantId,
      placementId,
      dto,
    );
    const mailbox = await this.findOutboundMailbox(
      user.tenantId,
      dto.mailboxConnectionId,
    );

    const provider = this.providers.get(mailbox.provider);
    const messageId = randomUUID();
    const threadId = randomUUID();
    const now = new Date();

    const { thread, message, link } = await this.prisma.$transaction(
      async (tx) => {
        const createdThread = await tx.emailThread.create({
          data: {
            id: threadId,
            tenantId: user.tenantId,
            mailboxConnectionId: mailbox.id,
            providerThreadId: this.pendingProviderId('thread', threadId),
            subject: dto.subject,
            participants: this.jsonOrUndefined({
              from: { email: mailbox.emailAddress, name: mailbox.displayName },
              to: dto.to,
              cc: dto.cc,
              bcc: dto.bcc,
            }),
            lastMessageAt: now,
            messageCount: 1,
            hasAttachments: attachments.length > 0,
          },
        });

        const createdMessage = await tx.emailMessage.create({
          data: {
            id: messageId,
            tenantId: user.tenantId,
            mailboxConnectionId: mailbox.id,
            threadId: createdThread.id,
            providerMessageId: this.pendingProviderId('message', messageId),
            direction: EmailMessageDirection.OUTBOUND,
            status: EmailMessageStatus.SENDING,
            subject: dto.subject,
            fromEmail: mailbox.emailAddress,
            fromName: mailbox.displayName,
            toRecipients: this.jsonOrUndefined(dto.to),
            ccRecipients: this.jsonOrUndefined(dto.cc),
            bccRecipients: this.jsonOrUndefined(dto.bcc),
            bodyPreview: this.preview(dto.bodyText, dto.bodyHtml),
            bodyText: this.cleanOptional(dto.bodyText),
            bodyHtml: this.cleanOptional(dto.bodyHtml),
            hasAttachments: attachments.length > 0,
            attachments: this.attachmentCreateInput(user.tenantId, attachments),
          },
          include: messageInclude,
        });

        const createdLink = await tx.placementEmailLink.create({
          data: {
            tenantId: user.tenantId,
            placementId,
            threadId: createdThread.id,
            messageId: createdMessage.id,
            linkedByUserId: user.id,
          },
        });

        return {
          thread: createdThread,
          message: createdMessage,
          link: createdLink,
        };
      },
    );

    const sent = await this.sendWithFailureStatus(
      user.tenantId,
      message.id,
      () =>
        provider.sendMessage({
          accessToken: this.encryption.decrypt(mailbox.encryptedAccessToken),
          subject: dto.subject,
          to: this.toProviderRecipients(dto.to) ?? [],
          cc: this.toProviderRecipients(dto.cc),
          bcc: this.toProviderRecipients(dto.bcc),
          bodyText: this.providerBody(dto.bodyText),
          bodyHtml: this.providerBody(dto.bodyHtml),
          ...this.providerAttachmentInput(attachments),
        }),
    );

    await this.prisma.emailThread.update({
      where: { id_tenantId: { id: thread.id, tenantId: user.tenantId } },
      data: {
        providerThreadId: sent.providerThreadId,
        lastMessageAt: sent.sentAt,
      },
    });

    const sentMessage = await this.prisma.emailMessage.update({
      where: { id_tenantId: { id: message.id, tenantId: user.tenantId } },
      data: {
        providerMessageId: sent.providerMessageId,
        internetMessageId: sent.internetMessageId,
        status: EmailMessageStatus.SENT,
        errorMessage: null,
        sentAt: sent.sentAt,
      },
      include: messageInclude,
    });

    const conversation = await this.findPlacementThread(
      user.tenantId,
      placementId,
      thread.id,
    );

    return {
      thread: conversation.thread,
      message: sentMessage,
      link,
    };
  }

  async replyToPlacementEmail(
    user: RequestUser,
    placementId: string,
    threadId: string,
    dto: ReplyPlacementEmailDto,
  ) {
    this.assertBody(dto.bodyText, dto.bodyHtml);
    await this.assertPlacement(user.tenantId, placementId);

    const link = await this.prisma.placementEmailLink.findFirst({
      where: {
        tenantId: user.tenantId,
        placementId,
        threadId,
        archivedAt: null,
        thread: { archivedAt: null },
      },
    });
    if (!link) throw new NotFoundException('Placement email thread not found');

    const thread = await this.prisma.emailThread.findFirst({
      where: { id: threadId, tenantId: user.tenantId, archivedAt: null },
      select: {
        id: true,
        subject: true,
        providerThreadId: true,
        mailboxConnectionId: true,
      },
    });
    if (!thread) throw new NotFoundException('Email thread not found');
    if (dto.mailboxConnectionId !== thread.mailboxConnectionId) {
      throw new BadRequestException(
        'Reply mailbox must match the mailbox that owns the thread',
      );
    }

    const mailbox = await this.findOutboundMailbox(
      user.tenantId,
      thread.mailboxConnectionId,
    );
    const attachments = await this.prepareWorkflowAttachments(
      user.tenantId,
      placementId,
      dto,
    );

    const parentMessage = await this.prisma.emailMessage.findFirst({
      where: {
        tenantId: user.tenantId,
        threadId,
        NOT: { providerMessageId: { startsWith: 'pending:' } },
      },
      orderBy: [
        { receivedAt: 'desc' },
        { sentAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: { id: true, providerMessageId: true },
    });
    if (!parentMessage) {
      throw new BadRequestException(
        'Thread has no provider message to reply to',
      );
    }

    const provider = this.providers.get(mailbox.provider);
    const messageId = randomUUID();

    const message = await this.prisma.emailMessage.create({
      data: {
        id: messageId,
        tenantId: user.tenantId,
        mailboxConnectionId: mailbox.id,
        threadId,
        providerMessageId: this.pendingProviderId('message', messageId),
        direction: EmailMessageDirection.OUTBOUND,
        status: EmailMessageStatus.SENDING,
        subject: thread.subject,
        fromEmail: mailbox.emailAddress,
        fromName: mailbox.displayName,
        toRecipients: this.jsonOrUndefined(dto.to),
        ccRecipients: this.jsonOrUndefined(dto.cc),
        bccRecipients: this.jsonOrUndefined(dto.bcc),
        bodyPreview: this.preview(dto.bodyText, dto.bodyHtml),
        bodyText: this.cleanOptional(dto.bodyText),
        bodyHtml: this.cleanOptional(dto.bodyHtml),
        parentMessageId: parentMessage.id,
        inReplyToMessageId: parentMessage.id,
        hasAttachments: attachments.length > 0,
        attachments: this.attachmentCreateInput(user.tenantId, attachments),
      },
      include: messageInclude,
    });

    await this.recountThread(user.tenantId, threadId);

    const sent = await this.sendWithFailureStatus(
      user.tenantId,
      message.id,
      () =>
        provider.replyToMessage({
          accessToken: this.encryption.decrypt(mailbox.encryptedAccessToken),
          providerMessageId: parentMessage.providerMessageId,
          to: this.toProviderRecipients(dto.to),
          cc: this.toProviderRecipients(dto.cc),
          bcc: this.toProviderRecipients(dto.bcc),
          bodyText: this.providerBody(dto.bodyText),
          bodyHtml: this.providerBody(dto.bodyHtml),
          ...this.providerAttachmentInput(attachments),
        }),
    );

    await this.prisma.emailThread.update({
      where: { id_tenantId: { id: threadId, tenantId: user.tenantId } },
      data: {
        providerThreadId: sent.providerThreadId,
        lastMessageAt: sent.sentAt,
      },
    });

    const sentMessage = await this.prisma.emailMessage.update({
      where: { id_tenantId: { id: message.id, tenantId: user.tenantId } },
      data: {
        providerMessageId: sent.providerMessageId,
        internetMessageId: sent.internetMessageId,
        status: EmailMessageStatus.SENT,
        errorMessage: null,
        sentAt: sent.sentAt,
      },
      include: messageInclude,
    });

    const conversation = await this.findPlacementThread(
      user.tenantId,
      placementId,
      threadId,
    );

    return {
      thread: conversation.thread,
      message: sentMessage,
      link,
    };
  }

  async linkPlacement(
    user: RequestUser,
    threadId: string,
    placementId: string,
    dto: LinkPlacementEmailDto,
  ): Promise<LinkRecord> {
    await Promise.all([
      this.assertPlacement(user.tenantId, placementId),
      this.assertThread(user.tenantId, threadId),
      dto.messageId
        ? this.assertMessage(user.tenantId, threadId, dto.messageId)
        : Promise.resolve(),
    ]);

    const existing = await this.prisma.placementEmailLink.findFirst({
      where: {
        tenantId: user.tenantId,
        placementId,
        threadId,
        archivedAt: null,
      },
    });
    if (existing) return existing;

    const link = await this.prisma.placementEmailLink.create({
      data: {
        tenantId: user.tenantId,
        placementId,
        threadId,
        messageId: dto.messageId,
        note: this.cleanOptional(dto.note),
        linkedByUserId: user.id,
      },
    });

    this.publishLinked(link, user);
    return link;
  }

  async linkPlacementWithThread(
    user: RequestUser,
    threadId: string,
    placementId: string,
    dto: LinkPlacementEmailDto,
  ) {
    const link = await this.linkPlacement(user, threadId, placementId, dto);
    const conversation = await this.findPlacementThread(
      user.tenantId,
      placementId,
      threadId,
    );

    return {
      link,
      thread: conversation.thread,
    };
  }

  async archiveLink(user: RequestUser, id: string): Promise<LinkRecord> {
    const existing = await this.prisma.placementEmailLink.findFirst({
      where: { id, tenantId: user.tenantId, archivedAt: null },
    });
    if (!existing) throw new NotFoundException('Email link not found');

    return this.prisma.placementEmailLink.update({
      where: { id_tenantId: { id, tenantId: user.tenantId } },
      data: {
        archivedAt: new Date(),
        archivedByUserId: user.id,
      },
    });
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');
  }

  private async findOutboundMailbox(
    tenantId: string,
    mailboxConnectionId: string,
  ): Promise<OutboundMailboxRecord> {
    const mailbox = await this.prisma.mailboxConnection.findFirst({
      where: {
        id: mailboxConnectionId,
        tenantId,
        archivedAt: null,
        status: MailboxConnectionStatus.ACTIVE,
      },
      select: mailboxOutboundSelect,
    });
    if (!mailbox) throw new NotFoundException('Mailbox connection not found');
    return mailbox;
  }

  private async assertThread(
    tenantId: string,
    threadId: string,
  ): Promise<void> {
    const thread = await this.prisma.emailThread.findFirst({
      where: { id: threadId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException('Email thread not found');
  }

  private async assertMessage(
    tenantId: string,
    threadId: string,
    messageId: string,
  ): Promise<void> {
    const message = await this.prisma.emailMessage.findFirst({
      where: { id: messageId, tenantId, threadId },
      select: { id: true },
    });
    if (!message) throw new NotFoundException('Email message not found');
  }

  private cleanOptional(value?: string): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private providerBody(value?: string): string | undefined {
    const cleaned = this.cleanOptional(value);
    return cleaned ?? undefined;
  }

  private assertBody(bodyText?: string, bodyHtml?: string): void {
    if (!bodyText?.trim() && !bodyHtml?.trim()) {
      throw new BadRequestException('Email body is required');
    }
  }

  private pendingProviderId(type: 'thread' | 'message', id: string): string {
    return `pending:${type}:${id}`;
  }

  private preview(bodyText?: string, bodyHtml?: string): string | null {
    const source =
      bodyText?.trim() || bodyHtml?.replace(/<[^>]*>/g, ' ').trim();
    if (!source) return null;
    return source.replace(/\s+/g, ' ').slice(0, 500);
  }

  private toProviderRecipients(
    recipients?: { email: string; name?: string }[],
  ): EmailProviderRecipient[] | undefined {
    if (!recipients) return undefined;
    return recipients.map((recipient) => ({
      email: recipient.email,
      ...(recipient.name ? { name: recipient.name } : {}),
    }));
  }

  private jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }

  private async prepareWorkflowAttachments(
    tenantId: string,
    placementId: string,
    dto: Pick<SendPlacementEmailDto, 'documentIds' | 'attachmentIds'>,
  ): Promise<WorkflowEmailAttachment[]> {
    const documentIds = this.uniqueIds(dto.documentIds);
    const attachmentIds = this.uniqueIds(dto.attachmentIds);
    if (documentIds.length + attachmentIds.length > 10) {
      throw new BadRequestException(
        'At most 10 workflow attachments can be sent in one email',
      );
    }

    const documents = await Promise.all(
      documentIds.map(async (documentId) => {
        const file = await this.documentsService.readStoredPdfForEmail(
          tenantId,
          placementId,
          documentId,
        );
        return {
          providerAttachmentId: `document:${documentId}`,
          fileName: file.fileName,
          contentType: file.mimeType,
          contentBytes: file.body,
          sizeBytes: file.sizeBytes,
        };
      }),
    );
    const uploadedAttachments = await Promise.all(
      attachmentIds.map(async (attachmentId) => {
        const file = await this.attachmentsService.readStoredAttachmentForEmail(
          tenantId,
          placementId,
          attachmentId,
        );
        return {
          providerAttachmentId: `attachment:${attachmentId}`,
          fileName: file.fileName,
          contentType: file.mimeType,
          contentBytes: file.body,
          sizeBytes: file.sizeBytes,
        };
      }),
    );

    const attachments = [...documents, ...uploadedAttachments];
    const oversized = attachments.find(
      (attachment) =>
        attachment.contentBytes.byteLength >= MAX_INLINE_EMAIL_ATTACHMENT_BYTES,
    );
    if (oversized) {
      throw new BadRequestException(
        `Attachment "${oversized.fileName}" must be smaller than 3 MB for workflow email sending`,
      );
    }

    return attachments;
  }

  private uniqueIds(ids?: string[]): string[] {
    return Array.from(new Set(ids ?? []));
  }

  private attachmentCreateInput(
    tenantId: string,
    attachments: WorkflowEmailAttachment[],
  ):
    | Prisma.EmailAttachmentMetadataCreateNestedManyWithoutMessageInput
    | undefined {
    if (!attachments.length) return undefined;
    return {
      create: attachments.map((attachment) => ({
        tenantId,
        providerAttachmentId: attachment.providerAttachmentId,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        isInline: false,
      })),
    };
  }

  private providerAttachmentInput(attachments: WorkflowEmailAttachment[]): {
    attachments?: EmailProviderFileAttachment[];
  } {
    if (!attachments.length) return {};
    return {
      attachments: attachments.map((attachment) => ({
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        contentBytes: attachment.contentBytes,
        sizeBytes: attachment.sizeBytes,
      })),
    };
  }

  private async sendWithFailureStatus(
    tenantId: string,
    messageId: string,
    send: () => Promise<EmailProviderSentMessage>,
  ): Promise<EmailProviderSentMessage> {
    try {
      return await send();
    } catch (error) {
      await this.markOutboundFailed(tenantId, messageId, error);
      throw error;
    }
  }

  private async markOutboundFailed(
    tenantId: string,
    messageId: string,
    error: unknown,
  ): Promise<void> {
    await this.prisma.emailMessage.update({
      where: { id_tenantId: { id: messageId, tenantId } },
      data: {
        status: EmailMessageStatus.FAILED,
        errorMessage: this.errorMessage(error),
        sentAt: null,
      },
    });
  }

  private async recountThread(
    tenantId: string,
    threadId: string,
  ): Promise<void> {
    const [messageCount, hasAttachments, latestMessage] = await Promise.all([
      this.prisma.emailMessage.count({ where: { tenantId, threadId } }),
      this.prisma.emailMessage.findFirst({
        where: { tenantId, threadId, hasAttachments: true },
        select: { id: true },
      }),
      this.prisma.emailMessage.findFirst({
        where: { tenantId, threadId },
        orderBy: [
          { receivedAt: 'desc' },
          { sentAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: { receivedAt: true, sentAt: true, createdAt: true },
      }),
    ]);

    await this.prisma.emailThread.update({
      where: { id_tenantId: { id: threadId, tenantId } },
      data: {
        messageCount,
        hasAttachments: Boolean(hasAttachments),
        lastMessageAt:
          latestMessage?.receivedAt ??
          latestMessage?.sentAt ??
          latestMessage?.createdAt,
      },
    });
  }

  private mapPlacementThreadSummary(
    link: PlacementThreadListRecord | PlacementThreadDetailRecord,
  ) {
    const messages = this.sortMessagesByActivity(link.thread.messages, 'desc');
    const latestMessage = messages[0];

    return {
      linkId: link.id,
      threadId: link.threadId,
      subject: link.thread.subject,
      participants: link.thread.participants,
      latestMessagePreview: latestMessage?.bodyPreview ?? null,
      latestMessageAt:
        link.thread.lastMessageAt ??
        latestMessage?.receivedAt ??
        latestMessage?.sentAt ??
        null,
      messageCount: link.thread.messageCount,
      hasAttachments: link.thread.hasAttachments,
      linkedByUserId: link.linkedByUserId,
      note: link.note,
      linkedAt: link.createdAt,
      mailbox: link.thread.mailboxConnection,
    };
  }

  private publishLinked(link: LinkRecord, user: RequestUser): void {
    try {
      this.publisher
        .emailLinked({
          tenantId: user.tenantId,
          linkId: link.id,
          placementId: link.placementId,
          threadId: link.threadId,
          messageId: link.messageId ?? undefined,
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          changes: {
            after: {
              placementId: link.placementId,
              threadId: link.threadId,
              messageId: link.messageId,
            },
          },
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Email link audit event failed: ${this.errorMessage(error)}`,
          );
        });
    } catch (error) {
      this.logger.warn(
        `Email link audit event failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private sortMessagesByActivity<T extends { createdAt?: Date | null }>(
    messages: T[],
    direction: 'asc' | 'desc',
  ): T[] {
    return [...messages].sort((left, right) => {
      const diff =
        this.messageActivityAt(left).getTime() -
        this.messageActivityAt(right).getTime();
      return direction === 'asc' ? diff : -diff;
    });
  }

  private messageActivityAt(message: {
    direction?: EmailMessageDirection | null;
    receivedAt?: Date | null;
    sentAt?: Date | null;
    createdAt?: Date | null;
  }): Date {
    if (message.direction === EmailMessageDirection.OUTBOUND) {
      return message.sentAt ?? message.createdAt ?? new Date(0);
    }
    return message.receivedAt ?? message.createdAt ?? new Date(0);
  }
}
