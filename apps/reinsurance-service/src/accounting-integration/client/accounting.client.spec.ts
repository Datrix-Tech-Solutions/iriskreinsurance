import { createHmac } from 'crypto';
import { ReinsuranceAccountingClient } from './accounting.client';

describe('ReinsuranceAccountingClient', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    process.env = {
      ...originalEnv,
      ACCOUNTING_SERVICE_URL: 'http://accounting-service:4008',
      INTERNAL_SERVICE_AUTH_SECRET: 'x'.repeat(32),
      ACCOUNTING_SERVICE_TIMEOUT_MS: '5000',
    };
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('posts the accounting source event with the HMAC headers Accounting expects', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'source-event-1',
          status: 'RECEIVED',
          idempotencyKey: 'reinsurance:test:1:v1',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new ReinsuranceAccountingClient();
    const result = await client.enqueueSourceEvent({
      tenantId: 'tenant-1',
      sourceModule: 'REINSURANCE',
      sourceEventType: 'TEST_EVENT',
      sourceRecordId: 'record-1',
      idempotencyKey: 'reinsurance:test:1:v1',
      occurredAt: '2026-07-29T10:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { value: 100 } },
    });

    const expectedSignature = createHmac(
      'sha256',
      process.env.INTERNAL_SERVICE_AUTH_SECRET!,
    )
      .update('reinsurance-service:1710000000:POST:/internal/source-events')
      .digest('hex');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(result.id).toBe('source-event-1');
    expect(url).toBe('http://accounting-service:4008/internal/source-events');
    expect(init.method).toBe('POST');
    expect(headers['x-workphelo-service']).toBe('reinsurance-service');
    expect(headers['x-workphelo-timestamp']).toBe('1710000000');
    expect(headers['x-workphelo-signature']).toBe(expectedSignature);
  });

  it('ensures an Accounting subledger with the expected HMAC path', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'subledger-1',
          code: 'CED-ABC123',
          type: 'CEDANT',
          externalRef: 'counterparty-1',
          status: 'ACTIVE',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new ReinsuranceAccountingClient();
    const result = await client.ensureSubledger({
      tenantId: 'tenant-1',
      type: 'CEDANT',
      externalRef: 'counterparty-1',
      name: 'Acme Cedant',
    });

    const expectedSignature = createHmac(
      'sha256',
      process.env.INTERNAL_SERVICE_AUTH_SECRET!,
    )
      .update('reinsurance-service:1710000000:POST:/internal/subledgers/ensure')
      .digest('hex');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(result.id).toBe('subledger-1');
    expect(url).toBe(
      'http://accounting-service:4008/internal/subledgers/ensure',
    );
    expect(headers['x-workphelo-signature']).toBe(expectedSignature);
  });

  it('checks Reinsurance posting readiness with the Accounting HMAC path', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ready: true,
          checkedAt: '2026-07-30T12:00:00.000Z',
          eventResults: [
            {
              eventType: 'CLAIM_PAYABLE_APPROVED',
              ready: true,
              blockers: [],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new ReinsuranceAccountingClient();
    const result = await client.checkReinsuranceReadiness({
      tenantId: 'tenant-1',
      eventTypes: ['CLAIM_PAYABLE_APPROVED'],
      currency: 'GHS',
      businessDate: '2026-07-30T12:00:00.000Z',
    });

    const expectedSignature = createHmac(
      'sha256',
      process.env.INTERNAL_SERVICE_AUTH_SECRET!,
    )
      .update(
        'reinsurance-service:1710000000:POST:/internal/reinsurance/accounting-readiness',
      )
      .digest('hex');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(result.ready).toBe(true);
    expect(url).toBe(
      'http://accounting-service:4008/internal/reinsurance/accounting-readiness',
    );
    expect(init.method).toBe('POST');
    expect(headers['x-workphelo-signature']).toBe(expectedSignature);
  });

  it('reports Accounting configuration readiness without making a request', () => {
    const client = new ReinsuranceAccountingClient();

    expect(client.configurationStatus()).toEqual({
      configured: true,
      baseUrlConfigured: true,
      serviceAuthSecretConfigured: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies 5xx responses as retryable and 4xx validation as permanent', async () => {
    const client = new ReinsuranceAccountingClient();
    const event = {
      tenantId: 'tenant-1',
      sourceModule: 'REINSURANCE' as const,
      sourceEventType: 'TEST_EVENT',
      sourceRecordId: 'record-1',
      idempotencyKey: 'reinsurance:test:1:v1',
      occurredAt: '2026-07-29T10:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { value: 100 } },
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Accounting is unavailable' }), {
        status: 503,
      }),
    );
    await expect(client.enqueueSourceEvent(event)).rejects.toMatchObject({
      retryable: true,
      statusCode: 503,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Malformed payload' }), {
        status: 400,
      }),
    );
    await expect(client.enqueueSourceEvent(event)).rejects.toMatchObject({
      retryable: false,
      statusCode: 400,
    });
  });

  it('reports missing Accounting URL as a permanent configuration failure', async () => {
    delete process.env.ACCOUNTING_SERVICE_URL;

    const client = new ReinsuranceAccountingClient();

    await expect(
      client.enqueueSourceEvent({
        tenantId: 'tenant-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'TEST_EVENT',
        sourceRecordId: 'record-1',
        idempotencyKey: 'reinsurance:test:1:v1',
        occurredAt: '2026-07-29T10:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { value: 100 } },
      }),
    ).rejects.toMatchObject({
      message: 'ACCOUNTING_SERVICE_URL is not configured',
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports invalid Accounting URL as a permanent configuration failure', async () => {
    process.env.ACCOUNTING_SERVICE_URL = 'not a url';

    const client = new ReinsuranceAccountingClient();

    await expect(
      client.enqueueSourceEvent({
        tenantId: 'tenant-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'TEST_EVENT',
        sourceRecordId: 'record-1',
        idempotencyKey: 'reinsurance:test:1:v1',
        occurredAt: '2026-07-29T10:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { value: 100 } },
      }),
    ).rejects.toMatchObject({
      message: 'ACCOUNTING_SERVICE_URL is invalid',
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports missing HMAC secret as a permanent configuration failure', async () => {
    process.env.INTERNAL_SERVICE_AUTH_SECRET = 'short';

    const client = new ReinsuranceAccountingClient();

    await expect(
      client.enqueueSourceEvent({
        tenantId: 'tenant-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'TEST_EVENT',
        sourceRecordId: 'record-1',
        idempotencyKey: 'reinsurance:test:1:v1',
        occurredAt: '2026-07-29T10:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { value: 100 } },
      }),
    ).rejects.toMatchObject({
      message:
        'INTERNAL_SERVICE_AUTH_SECRET is not configured or shorter than 32 characters',
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
