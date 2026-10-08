export type ExistingSuperAdmin = {
  id: string;
  email: string;
  tenantId: string;
};

export type SeedMode = 'full' | 'reference';

export type SuperAdminSeedDecision =
  | {
      action: 'dev-upsert';
      email: string;
      password: string;
      existingSuperAdmin?: ExistingSuperAdmin;
    }
  | {
      action: 'prod-preserve-existing';
      existingSuperAdmin: ExistingSuperAdmin;
    }
  | {
      action: 'prod-bootstrap-create';
      email: string;
      password: string;
    };

export function resolveSeedMode(value: string | undefined): SeedMode {
  if (!value) return 'full';
  if (value === 'full' || value === 'reference') return value;

  throw new Error(
    `Unsupported AUTH_SEED_MODE "${value}". Use "full" or "reference".`,
  );
}

function requireSuperAdminCredentials(
  email: string | undefined,
  password: string | undefined,
) {
  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars are required',
    );
  }

  return { email, password };
}

export function resolveSuperAdminSeedDecision(params: {
  isProd: boolean;
  existingSuperAdmins: ExistingSuperAdmin[];
  superAdminEmail?: string;
  superAdminPassword?: string;
  allowProdBootstrap?: boolean;
}): SuperAdminSeedDecision {
  const {
    isProd,
    existingSuperAdmins,
    superAdminEmail,
    superAdminPassword,
    allowProdBootstrap = false,
  } = params;

  if (isProd && existingSuperAdmins.length > 1) {
    throw new Error(
      [
        'Production seed aborted: multiple SUPER_ADMIN users already exist.',
        'Expected exactly one SUPER_ADMIN under the datrix-internal tenant.',
        'Please clean up duplicate super-admin accounts before rerunning the seed.',
        `Found: ${existingSuperAdmins.map((user) => `${user.email} (${user.tenantId})`).join(', ')}`,
      ].join(' '),
    );
  }

  const existingSuperAdmin = existingSuperAdmins[0];

  if (isProd && existingSuperAdmin) {
    return { action: 'prod-preserve-existing', existingSuperAdmin };
  }

  if (isProd) {
    if (!allowProdBootstrap) {
      throw new Error(
        [
          'Production seed aborted: no SUPER_ADMIN user exists.',
          'Create the initial production super-admin via an explicit bootstrap run with AUTH_ALLOW_PROD_SUPER_ADMIN_BOOTSTRAP=true.',
        ].join(' '),
      );
    }

    const credentials = requireSuperAdminCredentials(
      superAdminEmail,
      superAdminPassword,
    );
    return {
      action: 'prod-bootstrap-create',
      email: credentials.email,
      password: credentials.password,
    };
  }

  const credentials = requireSuperAdminCredentials(
    superAdminEmail,
    superAdminPassword,
  );

  return {
    action: 'dev-upsert',
    email: credentials.email,
    password: credentials.password,
    existingSuperAdmin,
  };
}
