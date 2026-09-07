export const accountingRequiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

export const accountingInternalIntegrationRequiredEnvVars = [
  'INTERNAL_SERVICE_AUTH_SECRET',
  'INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES',
] as const;

export function assertAccountingRuntimeEnv(): void {
  const required = [
    ...accountingRequiredEnvVars,
    ...(isInternalIntegrationExpected()
      ? accountingInternalIntegrationRequiredEnvVars
      : []),
  ];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Accounting service missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (isInternalIntegrationExpected()) {
    assertInternalServiceAuthSecret();
    assertAllowedInternalServices();
  }
}

function isInternalIntegrationExpected(): boolean {
  if (process.env.ACCOUNTING_INTERNAL_INTEGRATION_ENABLED === 'false') {
    return false;
  }
  return (
    process.env.NODE_ENV === 'production' || Boolean(process.env.DEPLOY_ENV)
  );
}

function assertInternalServiceAuthSecret(): void {
  const value = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error(
      'Accounting service INTERNAL_SERVICE_AUTH_SECRET must be at least 32 characters when internal source integrations are enabled',
    );
  }
}

function assertAllowedInternalServices(): void {
  const allowedServices = (
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES ?? ''
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowedServices.includes('reinsurance-service')) {
    throw new Error(
      'Accounting service INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES must include reinsurance-service when internal source integrations are enabled',
    );
  }
}

if (require.main === module) {
  try {
    assertAccountingRuntimeEnv();
    console.log('Accounting service environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
