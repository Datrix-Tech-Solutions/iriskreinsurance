import { PiloSmsProvider } from './pilosms.provider';

describe('PiloSmsProvider', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      PILOSMS_API_KEY: 'pilo-key',
      PILOSMS_SENDER_ID: 'WorkPhelo',
    };
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('sends the documented receipients form field and strips leading plus', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 1001 }));

    const result = await new PiloSmsProvider().sendMessage(
      '+233244000001',
      'Hello',
    );

    expect(result).toMatchObject({
      success: true,
      status: 'SENT',
      provider: 'pilosms',
      providerStatus: '1001',
    });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toBeDefined();
    const body = init?.body as URLSearchParams;
    expect(body.get('sender')).toBe('WorkPhelo');
    expect(body.get('message')).toBe('Hello');
    expect(body.get('receipients')).toBe('233244000001');
    expect(body.has('recipients')).toBe(false);
  });

  it('maps insufficient balance to failed', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 1005,
        detail: 'Insufficient balance',
      }),
    );

    await expect(
      new PiloSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '1005',
      providerDetail: 'Insufficient balance',
    });
  });

  it('maps no valid numbers to skipped', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 1006,
        detail: 'No valid numbers',
      }),
    );

    await expect(
      new PiloSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'SKIPPED',
      providerStatus: '1006',
      providerDetail: 'No valid numbers',
    });
  });

  it('skips invalid local phone numbers without calling the provider', async () => {
    await expect(
      new PiloSmsProvider().sendMessage('0244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'SKIPPED',
      providerStatus: '1006',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns failed on network errors without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      new PiloSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      error: 'network down',
    });
  });

  function jsonResponse(body: unknown): Response {
    return {
      ok: true,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response;
  }
});
