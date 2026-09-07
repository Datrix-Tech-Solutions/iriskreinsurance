export const hrRequiredEnvVars = [
  'DATABASE_URL',
  'RABBITMQ_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
  'FRONTEND_BASE_URL',
] as const;

export function assertHrRuntimeEnv(): void {
  const missing = hrRequiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `HR service missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

if (require.main === module) {
  try {
    assertHrRuntimeEnv();
    console.log('HR service environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
