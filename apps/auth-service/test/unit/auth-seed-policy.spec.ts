import {
  resolveSeedMode,
  resolveSuperAdminSeedDecision,
} from '../../prisma/seed-policy';

describe('auth seed policy', () => {
  const existingSuperAdmin = {
    id: 'user-1',
    email: 'owner@example.com',
    tenantId: 'tenant-1',
  };

  it('defaults to full mode and accepts reference mode', () => {
    expect(resolveSeedMode(undefined)).toBe('full');
    expect(resolveSeedMode('full')).toBe('full');
    expect(resolveSeedMode('reference')).toBe('reference');
  });

  it('rejects unknown seed modes', () => {
    expect(() => resolveSeedMode('demo')).toThrow(
      'Unsupported AUTH_SEED_MODE "demo"',
    );
  });

  it('preserves an existing production super-admin without requiring env credentials', () => {
    expect(
      resolveSuperAdminSeedDecision({
        isProd: true,
        existingSuperAdmins: [existingSuperAdmin],
      }),
    ).toEqual({
      action: 'prod-preserve-existing',
      existingSuperAdmin,
    });
  });

  it('requires an explicit production bootstrap flag before creating a super-admin', () => {
    expect(() =>
      resolveSuperAdminSeedDecision({
        isProd: true,
        existingSuperAdmins: [],
        superAdminEmail: 'owner@example.com',
        superAdminPassword: 'secret',
      }),
    ).toThrow('Production seed aborted: no SUPER_ADMIN user exists.');
  });

  it('requires credentials for explicit production super-admin bootstrap', () => {
    expect(() =>
      resolveSuperAdminSeedDecision({
        isProd: true,
        existingSuperAdmins: [],
        allowProdBootstrap: true,
      }),
    ).toThrow('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars are required');
  });

  it('allows explicit production super-admin bootstrap when credentials are present', () => {
    expect(
      resolveSuperAdminSeedDecision({
        isProd: true,
        existingSuperAdmins: [],
        superAdminEmail: 'owner@example.com',
        superAdminPassword: 'secret',
        allowProdBootstrap: true,
      }),
    ).toEqual({
      action: 'prod-bootstrap-create',
      email: 'owner@example.com',
      password: 'secret',
    });
  });

  it('keeps development seed behavior credential-gated', () => {
    expect(() =>
      resolveSuperAdminSeedDecision({
        isProd: false,
        existingSuperAdmins: [],
      }),
    ).toThrow('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars are required');

    expect(
      resolveSuperAdminSeedDecision({
        isProd: false,
        existingSuperAdmins: [existingSuperAdmin],
        superAdminEmail: 'dev-owner@example.com',
        superAdminPassword: 'secret',
      }),
    ).toEqual({
      action: 'dev-upsert',
      email: 'dev-owner@example.com',
      password: 'secret',
      existingSuperAdmin,
    });
  });

  it('blocks duplicate production super-admin records', () => {
    expect(() =>
      resolveSuperAdminSeedDecision({
        isProd: true,
        existingSuperAdmins: [
          existingSuperAdmin,
          { ...existingSuperAdmin, id: 'user-2' },
        ],
      }),
    ).toThrow('Production seed aborted: multiple SUPER_ADMIN users already exist.');
  });
});
