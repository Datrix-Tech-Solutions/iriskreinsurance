import { assertNotificationRuntimeEnv } from './runtime-env';

describe('assertNotificationRuntimeEnv', () => {
  const originalEnv = process.env;
  const baseEnv = {
    DATABASE_URL: 'postgres://notification',
    RABBITMQ_URL: 'amqp://rabbitmq',
    JWT_SECRET: 'secret',
    FRONTEND_BASE_URL: 'https://app.workphelo.test',
    RESEND_API_KEY: 'resend-key',
    RESEND_FROM_EMAIL: 'noreply@workphelo.test',
  };

  beforeEach(() => {
    process.env = { ...originalEnv, ...baseEnv };
    delete process.env.SMS_PROVIDER;
    delete process.env.TERMII_API_KEY;
    delete process.env.TERMII_SENDER_ID;
    delete process.env.PILOSMS_API_KEY;
    delete process.env.PILOSMS_SENDER_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('requires Termii credentials when SMS_PROVIDER is termii', () => {
    process.env.SMS_PROVIDER = 'termii';

    expect(() => assertNotificationRuntimeEnv()).toThrow(
      'Notification service missing required environment variables: TERMII_API_KEY, TERMII_SENDER_ID',
    );

    process.env.TERMII_API_KEY = 'termii-key';
    process.env.TERMII_SENDER_ID = 'WorkPhelo';
    expect(() => assertNotificationRuntimeEnv()).not.toThrow();
  });

  it('requires only PiloSMS credentials when SMS_PROVIDER is pilosms', () => {
    process.env.SMS_PROVIDER = 'pilosms';

    expect(() => assertNotificationRuntimeEnv()).toThrow(
      'Notification service missing required environment variables: PILOSMS_API_KEY, PILOSMS_SENDER_ID',
    );

    process.env.PILOSMS_API_KEY = 'pilo-key';
    process.env.PILOSMS_SENDER_ID = 'WorkPhelo';
    expect(() => assertNotificationRuntimeEnv()).not.toThrow();
  });

  it('defaults to Termii credentials for backward compatibility', () => {
    expect(() => assertNotificationRuntimeEnv()).toThrow(
      'Notification service missing required environment variables: TERMII_API_KEY, TERMII_SENDER_ID',
    );
  });

  it('rejects unsupported SMS providers', () => {
    process.env.SMS_PROVIDER = 'unsupported';

    expect(() => assertNotificationRuntimeEnv()).toThrow(
      'Unsupported SMS_PROVIDER "unsupported". Expected "termii" or "pilosms".',
    );
  });
});
