import { PiloSmsProvider } from './pilosms.provider';
import type { SmsProvider, SmsSendResult } from './sms-provider.interface';
import { SmsService } from './sms.service';
import { TermiiSmsProvider } from './termii-sms.provider';

describe('SmsService provider routing', () => {
  const originalEnv = process.env;
  const termiiResult: SmsSendResult = {
    success: true,
    status: 'SENT',
    provider: 'termii',
    providerStatus: 'ok',
  };
  const piloResult: SmsSendResult = {
    success: true,
    status: 'SENT',
    provider: 'pilosms',
    providerStatus: '1001',
    providerDetail: 'Message(s) processed successfully',
  };

  let termiiProvider: SmsProvider;
  let piloProvider: SmsProvider;
  let termiiSendMessage: jest.Mock<Promise<SmsSendResult>, [string, string]>;
  let piloSendMessage: jest.Mock<Promise<SmsSendResult>, [string, string]>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    termiiSendMessage = jest
      .fn<Promise<SmsSendResult>, [string, string]>()
      .mockImplementation(() => Promise.resolve(termiiResult));
    piloSendMessage = jest
      .fn<Promise<SmsSendResult>, [string, string]>()
      .mockImplementation(() => Promise.resolve(piloResult));
    termiiProvider = {
      provider: 'termii',
      sendMessage: termiiSendMessage,
    };
    piloProvider = {
      provider: 'pilosms',
      sendMessage: piloSendMessage,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('routes through Termii when SMS_PROVIDER=termii', async () => {
    process.env.SMS_PROVIDER = 'termii';

    const service = createService();
    await expect(service.sendMessage('+233244000001', 'Hello')).resolves.toBe(
      termiiResult,
    );

    expect(termiiSendMessage).toHaveBeenCalledWith('+233244000001', 'Hello');
    expect(piloSendMessage).not.toHaveBeenCalled();
  });

  it('routes through PiloSMS when SMS_PROVIDER=pilosms', async () => {
    process.env.SMS_PROVIDER = 'pilosms';

    const service = createService();
    await expect(service.sendMessage('+233244000001', 'Hello')).resolves.toBe(
      piloResult,
    );

    expect(piloSendMessage).toHaveBeenCalledWith('+233244000001', 'Hello');
    expect(termiiSendMessage).not.toHaveBeenCalled();
  });

  it('defaults to Termii for backward compatibility', async () => {
    delete process.env.SMS_PROVIDER;

    const service = createService();
    await service.sendOtp('+233244000001', '123456', 'login');

    expect(termiiSendMessage).toHaveBeenCalledWith(
      '+233244000001',
      expect.stringContaining('Your WorkPhelo login code is: 123456'),
    );
    expect(piloSendMessage).not.toHaveBeenCalled();
  });

  it('fails fast for unsupported SMS_PROVIDER values', () => {
    process.env.SMS_PROVIDER = 'other-provider';

    expect(() => createService()).toThrow(
      'Unsupported SMS_PROVIDER "other-provider". Expected "termii" or "pilosms".',
    );
  });

  function createService(): SmsService {
    return new SmsService(
      termiiProvider as TermiiSmsProvider,
      piloProvider as PiloSmsProvider,
    );
  }
});
