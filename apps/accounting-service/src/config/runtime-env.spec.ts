import { assertAccountingRuntimeEnv } from './runtime-env';

describe('assertAccountingRuntimeEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DATABASE_URL =
      'postgresql://user:pass@localhost:5432/workphelo';
    process.env.JWT_SECRET = 'test-jwt-secret';
    delete process.env.DEPLOY_ENV;
    delete process.env.NODE_ENV;
    delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    delete process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES;
    delete process.env.ACCOUNTING_INTERNAL_INTEGRATION_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('requires internal integration auth config in deployment runtimes', () => {
    process.env.DEPLOY_ENV = 'dev';

    expect(() => assertAccountingRuntimeEnv()).toThrow(
      'INTERNAL_SERVICE_AUTH_SECRET, INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES',
    );
  });

  it('requires a sufficiently strong internal auth secret', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.INTERNAL_SERVICE_AUTH_SECRET = 'short';
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = 'reinsurance-service';

    expect(() => assertAccountingRuntimeEnv()).toThrow(
      'INTERNAL_SERVICE_AUTH_SECRET must be at least 32 characters',
    );
  });

  it('requires the Reinsurance service identity in the allowed services list', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.INTERNAL_SERVICE_AUTH_SECRET = 'x'.repeat(32);
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = 'auth-service';

    expect(() => assertAccountingRuntimeEnv()).toThrow(
      'INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES must include reinsurance-service',
    );
  });

  it('allows internal integration config to be omitted when explicitly disabled', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.ACCOUNTING_INTERNAL_INTEGRATION_ENABLED = 'false';

    expect(() => assertAccountingRuntimeEnv()).not.toThrow();
  });
});
