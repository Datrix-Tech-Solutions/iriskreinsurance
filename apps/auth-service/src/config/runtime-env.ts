export const authRequiredEnvVars = [
  'DATABASE_URL',
  'RABBITMQ_URL',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
  'FRONTEND_BASE_URL',
  'COOKIE_SECURE',
  'COOKIE_SAME_SITE',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_CALLBACK_URL',
  'SUPER_ADMIN_EMAIL',
] as const;

export function assertAuthRuntimeEnv(): void {
  const missing = authRequiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Auth service missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

if (require.main === module) {
  try {
    assertAuthRuntimeEnv();
    console.log('Auth service environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
