import { BadRequestException } from '@nestjs/common';
import { MicrosoftGraphEmailProvider } from './microsoft-graph-email.provider';

describe('MicrosoftGraphEmailProvider outbound send/reply', () => {
  let provider: MicrosoftGraphEmailProvider;
  let fetchMock: jest.SpyInstance<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >;

  beforeEach(() => {
    provider = new MicrosoftGraphEmailProvider();
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a new message using immutable Microsoft Graph IDs', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'immutable-draft-message-1',
          conversationId: 'immutable-thread-1',
          internetMessageId: '<internet-1@example.com>',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    const result = await provider.sendMessage({
      accessToken: 'access-token',
      subject: 'Offer slip',
      to: [{ email: 'cedant@example.com', name: 'Cedant' }],
      cc: [{ email: 'broker@example.com' }],
      bcc: [{ email: 'audit@example.com' }],
      bodyText: 'Please review.',
      attachments: [
        {
          fileName: 'offer-slip.pdf',
          contentType: 'application/pdf',
          contentBytes: Buffer.from('%PDF-offer'),
          sizeBytes: 10,
        },
      ],
    });

    const calls = fetchMock.mock.calls;
    expect(urlOf(calls[0]?.[0])).toBe(
      'https://graph.microsoft.com/v1.0/me/messages',
    );
    expect(calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Prefer: 'IdType="ImmutableId"',
      }) as Record<string, string>,
    });
    expect(jsonBodyOf(calls[0]?.[1])).toMatchObject({
      subject: 'Offer slip',
      body: { contentType: 'Text', content: 'Please review.' },
      toRecipients: [
        { emailAddress: { address: 'cedant@example.com', name: 'Cedant' } },
      ],
      ccRecipients: [{ emailAddress: { address: 'broker@example.com' } }],
      bccRecipients: [{ emailAddress: { address: 'audit@example.com' } }],
      attachments: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: 'offer-slip.pdf',
          contentType: 'application/pdf',
          contentBytes: Buffer.from('%PDF-offer').toString('base64'),
        },
      ],
    });
    expect(urlOf(calls[1]?.[0])).toBe(
      'https://graph.microsoft.com/v1.0/me/messages/immutable-draft-message-1/send',
    );
    expect(calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Prefer: 'IdType="ImmutableId"',
      }) as Record<string, string>,
    });
    expect(result).toMatchObject({
      providerMessageId: 'immutable-draft-message-1',
      providerThreadId: 'immutable-thread-1',
      internetMessageId: '<internet-1@example.com>',
    });
  });

  it('replies to an existing message and stores the immutable reply draft ID', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'immutable-reply-message-1',
          conversationId: 'immutable-thread-1',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    const result = await provider.replyToMessage({
      accessToken: 'access-token',
      providerMessageId: 'immutable-parent-message-1',
      to: [{ email: 'cedant@example.com' }],
      bodyHtml: '<p>Thanks.</p>',
      attachments: [
        {
          fileName: 'closing-slip.pdf',
          contentType: 'application/pdf',
          contentBytes: Buffer.from('%PDF-closing'),
        },
      ],
    });

    const calls = fetchMock.mock.calls;
    expect(urlOf(calls[0]?.[0])).toBe(
      'https://graph.microsoft.com/v1.0/me/messages/immutable-parent-message-1/createReply',
    );
    expect(calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Prefer: 'IdType="ImmutableId"',
      }) as Record<string, string>,
    });
    expect(urlOf(calls[1]?.[0])).toBe(
      'https://graph.microsoft.com/v1.0/me/messages/immutable-reply-message-1',
    );
    expect(calls[1]?.[1]).toMatchObject({
      method: 'PATCH',
      headers: expect.objectContaining({
        Prefer: 'IdType="ImmutableId"',
      }) as Record<string, string>,
    });
    expect(jsonBodyOf(calls[1]?.[1])).toMatchObject({
      body: { contentType: 'HTML', content: '<p>Thanks.</p>' },
      toRecipients: [{ emailAddress: { address: 'cedant@example.com' } }],
      attachments: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: 'closing-slip.pdf',
          contentType: 'application/pdf',
          contentBytes: Buffer.from('%PDF-closing').toString('base64'),
        },
      ],
    });
    expect(urlOf(calls[2]?.[0])).toBe(
      'https://graph.microsoft.com/v1.0/me/messages/immutable-reply-message-1/send',
    );
    expect(calls[2]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Prefer: 'IdType="ImmutableId"',
      }) as Record<string, string>,
    });
    expect(result).toMatchObject({
      providerMessageId: 'immutable-reply-message-1',
      providerThreadId: 'immutable-thread-1',
    });
  });

  it('rejects outbound provider calls without an access token', async () => {
    await expect(
      provider.sendMessage({
        subject: 'Offer slip',
        to: [{ email: 'cedant@example.com' }],
        bodyText: 'Please review.',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

function urlOf(input: Parameters<typeof fetch>[0] | undefined): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url ?? '';
}

function jsonBodyOf(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') return undefined;
  return JSON.parse(init.body) as unknown;
}
