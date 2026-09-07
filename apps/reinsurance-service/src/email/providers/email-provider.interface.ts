import { EmailMessageDirection } from '../../../prisma/generated/client';

export interface EmailProviderVerifyInput {
  accessToken?: string;
  emailAddress: string;
}

export interface EmailProviderMailboxMetadata {
  externalMailboxId?: string;
  emailAddress?: string;
  displayName?: string;
}

export interface EmailProviderAttachmentMetadata {
  providerAttachmentId: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
  isInline?: boolean;
  contentId?: string;
}

export interface EmailProviderMessage {
  providerMessageId: string;
  providerThreadId: string;
  internetMessageId?: string;
  direction: EmailMessageDirection;
  subject?: string;
  fromEmail?: string;
  fromName?: string;
  toRecipients?: unknown;
  ccRecipients?: unknown;
  receivedAt?: Date;
  sentAt?: Date;
  bodyPreview?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  attachments?: EmailProviderAttachmentMetadata[];
}

export interface EmailProviderSyncResult {
  messages: EmailProviderMessage[];
  nextCursor?: string;
}

export interface EmailProviderSyncInput {
  accessToken?: string;
  limit: number;
  cursor?: string | null;
}

export interface EmailProviderRecipient {
  email: string;
  name?: string;
}

export interface EmailProviderFileAttachment {
  fileName: string;
  contentType: string;
  contentBytes: Buffer;
  sizeBytes?: number;
}

export interface EmailProviderSendInput {
  accessToken?: string;
  subject: string;
  to: EmailProviderRecipient[];
  cc?: EmailProviderRecipient[];
  bcc?: EmailProviderRecipient[];
  bodyText?: string;
  bodyHtml?: string;
  attachments?: EmailProviderFileAttachment[];
}

export interface EmailProviderReplyInput {
  accessToken?: string;
  providerMessageId: string;
  to?: EmailProviderRecipient[];
  cc?: EmailProviderRecipient[];
  bcc?: EmailProviderRecipient[];
  bodyText?: string;
  bodyHtml?: string;
  attachments?: EmailProviderFileAttachment[];
}

export interface EmailProviderSentMessage {
  providerThreadId: string;
  providerMessageId: string;
  internetMessageId?: string;
  sentAt: Date;
}

export interface EmailProvider {
  verifyConnection(
    input: EmailProviderVerifyInput,
  ): Promise<EmailProviderMailboxMetadata>;
  sync(input: EmailProviderSyncInput): Promise<EmailProviderSyncResult>;
  sendMessage(input: EmailProviderSendInput): Promise<EmailProviderSentMessage>;
  replyToMessage(
    input: EmailProviderReplyInput,
  ): Promise<EmailProviderSentMessage>;
}
