import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailMessageDirection } from '../../../prisma/generated/client';
import {
  EmailProvider,
  EmailProviderMailboxMetadata,
  EmailProviderMessage,
  EmailProviderRecipient,
  EmailProviderReplyInput,
  EmailProviderSendInput,
  EmailProviderSentMessage,
  EmailProviderFileAttachment,
  EmailProviderSyncInput,
  EmailProviderSyncResult,
  EmailProviderVerifyInput,
} from './email-provider.interface';

type GraphUser = {
  id?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

type GraphEmailAddress = {
  emailAddress?: {
    address?: string;
    name?: string;
  };
};

type GraphRecipient = {
  emailAddress: {
    address: string;
    name?: string;
  };
};

type GraphMessage = {
  id?: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  from?: GraphEmailAddress;
  toRecipients?: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
};

type GraphMessagesResponse = {
  value?: GraphMessage[];
  '@odata.nextLink'?: string;
};

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

const GRAPH_IMMUTABLE_ID_HEADER = 'IdType="ImmutableId"';

@Injectable()
export class MicrosoftGraphEmailProvider implements EmailProvider {
  async verifyConnection(
    input: EmailProviderVerifyInput,
  ): Promise<EmailProviderMailboxMetadata> {
    const accessToken = this.requireToken(input.accessToken);
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: GRAPH_IMMUTABLE_ID_HEADER,
        },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Microsoft Graph mailbox verification failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as GraphUser;
    return {
      externalMailboxId: data.id,
      displayName: data.displayName,
      emailAddress: data.mail ?? data.userPrincipalName ?? input.emailAddress,
    };
  }

  async sync(input: EmailProviderSyncInput): Promise<EmailProviderSyncResult> {
    const accessToken = this.requireToken(input.accessToken);
    const params = new URLSearchParams({
      $top: String(input.limit),
      $orderby: 'receivedDateTime desc',
      $select:
        'id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,isRead',
    });
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Microsoft Graph sync failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as GraphMessagesResponse;
    return {
      messages: (data.value ?? []).flatMap((message) =>
        this.toProviderMessage(message),
      ),
      nextCursor: data['@odata.nextLink'],
    };
  }

  async sendMessage(
    input: EmailProviderSendInput,
  ): Promise<EmailProviderSentMessage> {
    const accessToken = this.requireToken(input.accessToken);
    const draft = await this.createDraft(accessToken, {
      subject: input.subject,
      body: this.body(input),
      toRecipients: this.toGraphRecipients(input.to),
      ccRecipients: this.toGraphRecipients(input.cc),
      bccRecipients: this.toGraphRecipients(input.bcc),
      attachments: this.toGraphAttachments(input.attachments),
    });

    await this.sendDraft(accessToken, draft.id);
    return this.toSentMessage(draft);
  }

  async replyToMessage(
    input: EmailProviderReplyInput,
  ): Promise<EmailProviderSentMessage> {
    const accessToken = this.requireToken(input.accessToken);
    const draft = await this.createReplyDraft(
      accessToken,
      input.providerMessageId,
    );

    await this.patchDraft(accessToken, draft.id, {
      body: this.body(input),
      ...(input.to ? { toRecipients: this.toGraphRecipients(input.to) } : {}),
      ...(input.cc ? { ccRecipients: this.toGraphRecipients(input.cc) } : {}),
      ...(input.bcc
        ? { bccRecipients: this.toGraphRecipients(input.bcc) }
        : {}),
      ...(input.attachments?.length
        ? { attachments: this.toGraphAttachments(input.attachments) }
        : {}),
    });

    await this.sendDraft(accessToken, draft.id);
    return this.toSentMessage(draft);
  }

  private requireToken(accessToken?: string): string {
    if (!accessToken) {
      throw new BadRequestException(
        'Microsoft Graph requires an OAuth access token for this operation',
      );
    }
    return accessToken;
  }

  private async createDraft(
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<
    Required<Pick<GraphMessage, 'id' | 'conversationId'>> & GraphMessage
  > {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/messages',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: GRAPH_IMMUTABLE_ID_HEADER,
        },
        body: JSON.stringify(payload),
      },
    );

    return this.parseDraftResponse(response, 'Microsoft Graph draft creation');
  }

  private async createReplyDraft(
    accessToken: string,
    providerMessageId: string,
  ): Promise<
    Required<Pick<GraphMessage, 'id' | 'conversationId'>> & GraphMessage
  > {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(providerMessageId)}/createReply`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: GRAPH_IMMUTABLE_ID_HEADER,
        },
      },
    );

    return this.parseDraftResponse(
      response,
      'Microsoft Graph reply draft creation',
    );
  }

  private async patchDraft(
    accessToken: string,
    providerMessageId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(providerMessageId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: GRAPH_IMMUTABLE_ID_HEADER,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Microsoft Graph draft update failed with status ${response.status}`,
      );
    }
  }

  private async sendDraft(
    accessToken: string,
    providerMessageId: string,
  ): Promise<void> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(providerMessageId)}/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: GRAPH_IMMUTABLE_ID_HEADER,
        },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Microsoft Graph send failed with status ${response.status}`,
      );
    }
  }

  private async parseDraftResponse(
    response: FetchResponse,
    operation: string,
  ): Promise<
    Required<Pick<GraphMessage, 'id' | 'conversationId'>> & GraphMessage
  > {
    if (!response.ok) {
      throw new BadRequestException(
        `${operation} failed with status ${response.status}`,
      );
    }

    const draft = (await response.json()) as GraphMessage;
    if (!draft.id || !draft.conversationId) {
      throw new BadRequestException(
        `${operation} did not return message and conversation identifiers`,
      );
    }

    return draft as Required<Pick<GraphMessage, 'id' | 'conversationId'>> &
      GraphMessage;
  }

  private body(input: { bodyHtml?: string; bodyText?: string }): {
    contentType: 'HTML' | 'Text';
    content: string;
  } {
    if (input.bodyHtml?.trim()) {
      return { contentType: 'HTML', content: input.bodyHtml };
    }

    return { contentType: 'Text', content: input.bodyText ?? '' };
  }

  private toGraphRecipients(
    recipients?: EmailProviderRecipient[],
  ): GraphRecipient[] {
    return (recipients ?? []).map((recipient) => ({
      emailAddress: {
        address: recipient.email,
        ...(recipient.name ? { name: recipient.name } : {}),
      },
    }));
  }

  private toGraphAttachments(
    attachments?: EmailProviderFileAttachment[],
  ): unknown[] | undefined {
    if (!attachments?.length) return undefined;
    return attachments.map((attachment) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: attachment.fileName,
      contentType: attachment.contentType,
      contentBytes: attachment.contentBytes.toString('base64'),
    }));
  }

  private toSentMessage(
    message: Required<Pick<GraphMessage, 'id' | 'conversationId'>> &
      GraphMessage,
  ): EmailProviderSentMessage {
    // All send/reply calls request Microsoft Graph immutable IDs, so this draft
    // ID remains the durable message ID after Graph moves the message to Sent.
    return {
      providerMessageId: message.id,
      providerThreadId: message.conversationId,
      internetMessageId: message.internetMessageId,
      sentAt: this.toDate(message.sentDateTime) ?? new Date(),
    };
  }

  private toProviderMessage(message: GraphMessage): EmailProviderMessage[] {
    if (!message.id || !message.conversationId) return [];

    return [
      {
        providerMessageId: message.id,
        providerThreadId: message.conversationId,
        internetMessageId: message.internetMessageId,
        direction: EmailMessageDirection.INBOUND,
        subject: message.subject,
        fromEmail: message.from?.emailAddress?.address,
        fromName: message.from?.emailAddress?.name,
        toRecipients: this.recipients(message.toRecipients),
        ccRecipients: this.recipients(message.ccRecipients),
        receivedAt: this.toDate(message.receivedDateTime),
        sentAt: this.toDate(message.sentDateTime),
        bodyPreview: message.bodyPreview,
        hasAttachments: message.hasAttachments ?? false,
        isRead: message.isRead ?? false,
      },
    ];
  }

  private recipients(recipients?: GraphEmailAddress[]): unknown {
    return (recipients ?? []).map((recipient) => ({
      email: recipient.emailAddress?.address,
      name: recipient.emailAddress?.name,
    }));
  }

  private toDate(value?: string): Date | undefined {
    return value ? new Date(value) : undefined;
  }
}
