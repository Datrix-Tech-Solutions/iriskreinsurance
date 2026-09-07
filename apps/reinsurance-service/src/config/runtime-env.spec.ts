import { assertReinsuranceRuntimeEnv } from './runtime-env';

describe('assertReinsuranceRuntimeEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DATABASE_URL =
      'postgresql://user:pass@localhost:5432/workphelo';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
    delete process.env.DEPLOY_ENV;
    delete process.env.NODE_ENV;
    delete process.env.ACCOUNTING_SERVICE_URL;
    delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    delete process.env.REINSURANCE_ACCOUNTING_INTEGRATION_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not require Accounting integration config in deployment runtimes', () => {
    process.env.DEPLOY_ENV = 'dev';

    expect(() => assertReinsuranceRuntimeEnv()).not.toThrow();
  });

  it('does not validate retired Accounting service URL settings during startup', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.ACCOUNTING_SERVICE_URL = 'not a url';

    expect(() => assertReinsuranceRuntimeEnv()).not.toThrow();
  });

  it('does not require retired Accounting internal auth settings during startup', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.INTERNAL_SERVICE_AUTH_SECRET = 'short';

    expect(() => assertReinsuranceRuntimeEnv()).not.toThrow();
  });

  it('continues to accept the retired integration disable flag for compatibility', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.REINSURANCE_ACCOUNTING_INTEGRATION_ENABLED = 'false';

    expect(() => assertReinsuranceRuntimeEnv()).not.toThrow();
  });
});
