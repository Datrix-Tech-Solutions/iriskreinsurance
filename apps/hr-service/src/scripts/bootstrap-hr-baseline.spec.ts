import {
  HrBaselineBootstrap,
  parseBootstrapArgs,
} from './bootstrap-hr-baseline';

const activeTenant = {
  id: 'tenant-acme',
  slug: 'acme-ghana',
  email: 'admin@acmeghana.com',
  country: 'GH',
  currency: 'GHS',
  status: 'ACTIVE',
  moduleConfig: { hr: false },
  featureConfig: { hr: { leave: false } },
  adminUserId: 'admin-acme',
};

const internalTenant = {
  ...activeTenant,
  id: 'tenant-internal',
  slug: 'datrix-internal',
};

const pendingTenant = {
  ...activeTenant,
  id: 'tenant-pending',
  slug: 'golden-harvest',
  status: 'PENDING',
};

function buildMocks({
  tenants = [activeTenant],
  evidenceTenantIds = ['tenant-acme'],
  employees = [{ id: 'emp-1' }],
} = {}) {
  const prisma = {
    $queryRaw: jest.fn(async (query: { strings?: string[] }) => {
      const sql = query.strings?.join('') ?? '';
      if (sql.includes('FROM w_auth."Tenant"')) return tenants;
      return evidenceTenantIds.map((tenantId) => ({ tenantId }));
    }),
    tenantConfig: { upsert: jest.fn(async () => ({})) },
    employee: { findMany: jest.fn(async () => employees) },
    leaveType: { count: jest.fn(async () => 4) },
    publicHoliday: { count: jest.fn(async () => 11) },
    leaveBalance: { count: jest.fn(async () => 4) },
  };

  const leaveService = {
    seedDefaultLeaveTypes: jest.fn(async () => undefined),
    seedPublicHolidaysForTenant: jest.fn(async () => undefined),
    initializeLeaveBalances: jest.fn(async () => undefined),
  };

  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return { prisma, leaveService, logger };
}

describe('parseBootstrapArgs', () => {
  it('defaults to all eligible tenants', () => {
    expect(parseBootstrapArgs([])).toEqual({
      allEligible: true,
      tenantSlugs: [],
    });
  });

  it('supports explicit tenant arguments', () => {
    expect(parseBootstrapArgs(['--tenant', 'acme-ghana'])).toEqual({
      allEligible: false,
      tenantSlugs: ['acme-ghana'],
    });
  });
});

describe('HrBaselineBootstrap', () => {
  it('creates TenantConfig for an eligible tenant missing baseline data', async () => {
    const { prisma, leaveService, logger } = buildMocks();
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await bootstrap.run({ allEligible: true, tenantSlugs: [] });

    expect(prisma.tenantConfig.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-acme' },
      create: expect.objectContaining({
        tenantId: 'tenant-acme',
        adminEmail: 'admin@acmeghana.com',
        adminUserId: 'admin-acme',
        payrollCountry: 'GH',
        payrollCurrency: 'GHS',
      }),
      update: {
        adminEmail: 'admin@acmeghana.com',
        adminUserId: 'admin-acme',
        payrollCountry: 'GH',
        payrollCurrency: 'GHS',
      },
    });
  });

  it('updates only provisioning-owned TenantConfig fields', async () => {
    const { prisma, leaveService, logger } = buildMocks();
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await bootstrap.run({ allEligible: true, tenantSlugs: [] });

    const configUpsert = (prisma.tenantConfig.upsert as jest.Mock).mock
      .calls[0]?.[0];
    expect(configUpsert).toBeDefined();
    expect(configUpsert.update).toEqual({
      adminEmail: 'admin@acmeghana.com',
      adminUserId: 'admin-acme',
      payrollCountry: 'GH',
      payrollCurrency: 'GHS',
    });
    expect(configUpsert.update).not.toHaveProperty(
      'defaultProbationPeriodMonths',
    );
    expect(configUpsert.update).not.toHaveProperty(
      'lateArrivalThresholdMinutes',
    );
  });

  it('uses existing idempotent leave type and holiday seed methods', async () => {
    const { prisma, leaveService, logger } = buildMocks();
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await bootstrap.run({ allEligible: true, tenantSlugs: [] });

    expect(leaveService.seedDefaultLeaveTypes).toHaveBeenCalledWith(
      'tenant-acme',
    );
    expect(leaveService.seedPublicHolidaysForTenant).toHaveBeenCalledWith(
      'tenant-acme',
      'GH',
    );
  });

  it('can run repeatedly without creating employees or departments', async () => {
    const { prisma, leaveService, logger } = buildMocks();
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await bootstrap.run({ allEligible: true, tenantSlugs: [] });
    await bootstrap.run({ allEligible: true, tenantSlugs: [] });

    expect(leaveService.seedDefaultLeaveTypes).toHaveBeenCalledTimes(2);
    expect(leaveService.seedPublicHolidaysForTenant).toHaveBeenCalledTimes(2);
    expect(prisma.tenantConfig.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.employee.findMany).toHaveBeenCalledTimes(2);
    expect(prisma).not.toHaveProperty('department');
  });

  it('does not reset existing leave balance usage state', async () => {
    const { prisma, leaveService, logger } = buildMocks({
      employees: [{ id: 'emp-1' }, { id: 'emp-2' }],
    });
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await bootstrap.run({ allEligible: true, tenantSlugs: [] });

    expect(leaveService.initializeLeaveBalances).toHaveBeenCalledWith(
      'tenant-acme',
      'emp-1',
    );
    expect(leaveService.initializeLeaveBalances).toHaveBeenCalledWith(
      'tenant-acme',
      'emp-2',
    );
    expect(prisma.leaveBalance).not.toHaveProperty('update');
    expect(prisma.leaveBalance).not.toHaveProperty('updateMany');
  });

  it('initializes missing balances through the existing leave service method', async () => {
    const { prisma, leaveService, logger } = buildMocks({
      employees: [{ id: 'emp-missing' }],
    });
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await bootstrap.run({ allEligible: true, tenantSlugs: [] });

    expect(leaveService.initializeLeaveBalances).toHaveBeenCalledWith(
      'tenant-acme',
      'emp-missing',
    );
  });

  it('skips ineligible internal and pending tenants', async () => {
    const { prisma, leaveService, logger } = buildMocks({
      tenants: [internalTenant, pendingTenant],
      evidenceTenantIds: ['tenant-internal', 'tenant-pending'],
    });
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    const summaries = await bootstrap.run({
      allEligible: true,
      tenantSlugs: [],
    });

    expect(summaries).toEqual([]);
    expect(leaveService.seedDefaultLeaveTypes).not.toHaveBeenCalled();
    expect(prisma.tenantConfig.upsert).not.toHaveBeenCalled();
  });

  it('allows explicit active tenants even before HR evidence exists', async () => {
    const { prisma, leaveService, logger } = buildMocks({
      evidenceTenantIds: [],
    });
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await bootstrap.run({
      allEligible: false,
      tenantSlugs: ['acme-ghana'],
    });

    expect(leaveService.seedDefaultLeaveTypes).toHaveBeenCalledWith(
      'tenant-acme',
    );
  });

  it('fails the command when any tenant bootstrap fails', async () => {
    const { prisma, leaveService, logger } = buildMocks();
    leaveService.seedPublicHolidaysForTenant.mockRejectedValueOnce(
      new Error('holiday service unavailable'),
    );
    const bootstrap = new HrBaselineBootstrap(
      prisma as never,
      leaveService,
      logger,
    );

    await expect(
      bootstrap.run({ allEligible: true, tenantSlugs: [] }),
    ).rejects.toThrow('HR baseline bootstrap failed for 1 tenant(s)');
  });
});
