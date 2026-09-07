export const gatewayRequiredEnvVars = [
  'JWT_SECRET',
  'AUTH_SERVICE_URL',
  'HR_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
] as const;

export const gatewayOptionalServiceEnvVars = [
  'SUBSCRIPTION_SERVICE_URL',
  'MARKETING_SERVICE_URL',
  'REINSURANCE_SERVICE_URL',
  'ACCOUNTING_SERVICE_URL',
] as const;

const allGatewayEnvVars = [
  ...gatewayRequiredEnvVars,
  ...gatewayOptionalServiceEnvVars,
] as const;

export type GatewayServiceName =
  | 'auth'
  | 'hr'
  | 'notification'
  | 'subscription'
  | 'marketing'
  | 'reinsurance'
  | 'accounting';

export const gatewayRequiredServices: GatewayServiceName[] = [
  'auth',
  'hr',
  'notification',
];

export const gatewayOptionalServices: GatewayServiceName[] = [
  'subscription',
  'marketing',
  'reinsurance',
  'accounting',
];

export const gatewayServiceConfig: Record<
  GatewayServiceName,
  {
    envVar: (typeof allGatewayEnvVars)[number];
    healthPath: string;
    downstreamPrefix?: string;
  }
> = {
  auth: { envVar: 'AUTH_SERVICE_URL', healthPath: '/health' },
  hr: { envVar: 'HR_SERVICE_URL', healthPath: '/health' },
  notification: {
    envVar: 'NOTIFICATION_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  subscription: {
    envVar: 'SUBSCRIPTION_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  marketing: {
    envVar: 'MARKETING_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  reinsurance: {
    envVar: 'REINSURANCE_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  accounting: {
    envVar: 'ACCOUNTING_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
};

export function assertGatewayRuntimeEnv(): void {
  const missing = gatewayRequiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `API gateway missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

export function getGatewayServiceUrl(
  serviceName: GatewayServiceName,
): string | undefined {
  return process.env[gatewayServiceConfig[serviceName].envVar];
}

export function getConfiguredGatewayServices(): Partial<
  Record<GatewayServiceName, string>
> {
  return Object.entries(gatewayServiceConfig).reduce(
    (services, [serviceName, config]) => {
      const value = process.env[config.envVar];
      if (value) {
        services[serviceName as GatewayServiceName] = value;
      }
      return services;
    },
    {} as Partial<Record<GatewayServiceName, string>>,
  );
}

if (require.main === module) {
  try {
    assertGatewayRuntimeEnv();
    console.log('API gateway environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
