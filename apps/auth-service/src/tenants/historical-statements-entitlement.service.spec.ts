import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { HistoricalStatementsEntitlementService } from './historical-statements-entitlement.service';

describe('HistoricalStatementsEntitlementService', () => {
  const resource = 'operations.reinsurance.historical-statements';
  const identity = {
    id: 'user',
    tenantId: 'tenant',
    role: 'SUPER_ADMIN',
    email: 'actor@example.test',
    tenantSlug: 'tenant',
    tenantName: 'Tenant',
    firstName: 'Actor',
    moduleConfig: {},
    featureConfig: {},
    permissions: [],
  } satisfies RequestUser;
  function userFixture() {
    return {
      id: 'user',
      tenantId: 'tenant',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      email: 'actor@example.test',
      tenant: {
        id: 'tenant',
        status: 'ACTIVE',
        historicalStatementsEnabled: true,
        moduleConfig: { operations: true },
        featureConfig: { operations: { reinsurance: true } },
      },
    };
  }

  function databaseFixture() {
    const tx = {
      user: {
        findUnique: jest.fn(
          async (): Promise<ReturnType<typeof userFixture> | null> => user,
        ),
      },
      tenant: {
        findUnique: jest.fn(
          async (): Promise<{
            historicalStatementsEnabled: boolean;
          } | null> => ({ historicalStatementsEnabled: false }),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn(
          async (_args: { data: Prisma.AuditLogUncheckedCreateInput }) => ({}),
        ),
      },
      userPermission: {
        create: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      userPermissionSet: {
        create: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      permissionSetResource: {
        create: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    return {
      ...tx,
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
  }

  function permissionsFixture() {
    return {
      getHistoricalStatementsPermissions: jest.fn(
        async (_tenantId: string, _userId: string) => ({
          effectivePermissions: [`${resource}:VIEW`, `${resource}:EXPORT`],
        }),
      ),
    };
  }

  let db: ReturnType<typeof databaseFixture>;
  let permissions: ReturnType<typeof permissionsFixture>;
  let service: HistoricalStatementsEntitlementService;
  let user: ReturnType<typeof userFixture>;

  beforeEach(async () => {
    user = userFixture();
    db = databaseFixture();
    permissions = permissionsFixture();
    const module = await Test.createTestingModule({
      providers: [
        HistoricalStatementsEntitlementService,
        { provide: PrismaService, useValue: db },
        { provide: PermissionsService, useValue: permissions },
      ],
    }).compile();
    service = module.get(HistoricalStatementsEntitlementService);
  });

  it('reads live grants instead of stale token role and permissions', async () => {
    permissions.getHistoricalStatementsPermissions.mockResolvedValue({
      effectivePermissions: [],
    });
    await expect(service.getAccess(identity)).resolves.toEqual({
      tenantId: 'tenant',
      userId: 'user',
      enabled: true,
      canView: false,
      canExport: false,
      canImport: false,
    });
    expect(permissions.getHistoricalStatementsPermissions).toHaveBeenCalledWith(
      'tenant',
      'user',
    );
    permissions.getHistoricalStatementsPermissions.mockResolvedValue({
      effectivePermissions: [`${resource}:VIEW`],
    });
    await expect(service.getAccess(identity)).resolves.toMatchObject({
      canView: true,
      canExport: false,
    });
  });

  it.each<[string[], boolean, boolean]>([
    [[], false, false],
    [[`${resource}:EXPORT`], false, false],
    [[`${resource}:VIEW`], true, false],
    [[`${resource}:VIEW`, `${resource}:EXPORT`], true, true],
  ])('enforces VIEW plus EXPORT for %j', async (grants, canView, canExport) => {
    permissions.getHistoricalStatementsPermissions.mockResolvedValue({
      effectivePermissions: grants,
    });
    await expect(service.getAccess(identity)).resolves.toMatchObject({
      canView,
      canExport,
    });
  });

  it('does not let an IMPORT grant or stale admin claim authorize a non-administrator', async () => {
    user.role = 'EMPLOYEE';
    permissions.getHistoricalStatementsPermissions.mockResolvedValue({
      effectivePermissions: [`${resource}:IMPORT`],
    });
    await expect(service.getAccess(identity)).resolves.toMatchObject({
      canImport: false,
    });
    user.role = 'TENANT_ADMIN';
    await expect(service.getAccess(identity)).resolves.toMatchObject({
      canImport: true,
    });
    user.tenant.historicalStatementsEnabled = false;
    await expect(service.getAccess(identity)).resolves.toMatchObject({
      canImport: false,
    });
  });

  it.each(['TENANT_ADMIN', 'SUPER_ADMIN'])(
    'allows %s bypass only when all gates enabled',
    async (role) => {
      user.role = role;
      await expect(service.getAccess(identity)).resolves.toMatchObject({
        enabled: true,
        canView: true,
        canExport: true,
      });
      user.tenant.historicalStatementsEnabled = false;
      await expect(service.getAccess(identity)).resolves.toMatchObject({
        enabled: false,
        canView: false,
        canExport: false,
      });
      expect(
        permissions.getHistoricalStatementsPermissions,
      ).not.toHaveBeenCalled();
    },
  );

  it.each(['module', 'feature', 'entitlement'])(
    'denies disabled %s despite current admin role',
    async (gate) => {
      user.role = 'TENANT_ADMIN';
      if (gate === 'module') user.tenant.moduleConfig.operations = false;
      if (gate === 'feature')
        user.tenant.featureConfig.operations.reinsurance = false;
      if (gate === 'entitlement')
        user.tenant.historicalStatementsEnabled = false;
      await expect(service.getAccess(identity)).resolves.toMatchObject({
        enabled: false,
        canView: false,
        canExport: false,
      });
    },
  );

  it.each([
    'missing',
    'inactive',
    'suspended-tenant',
    'moved-tenant',
    'wrong-user',
  ])('rejects %s identity', async (state) => {
    if (state === 'missing') db.user.findUnique.mockResolvedValueOnce(null);
    if (state === 'inactive') user.status = 'INACTIVE';
    if (state === 'suspended-tenant') user.tenant.status = 'SUSPENDED';
    if (state === 'moved-tenant') user.tenantId = 'other';
    if (state === 'wrong-user') user.id = 'other';
    await expect(service.getAccess(identity)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each(['TENANT_ADMIN', 'EMPLOYEE'])(
    'denies %s enablement despite stale super-admin claim',
    async (role) => {
      user.role = role;
      await expect(
        service.update(
          'target',
          { enabled: true, reason: 'approved' },
          identity,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.tenant.update).not.toHaveBeenCalled();
      expect(db.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    [false, true],
    [true, false],
    [true, true],
    [false, false],
  ])(
    'serializes entitlement change from %s to %s with required audit',
    async (before, enabled) => {
      user.role = 'SUPER_ADMIN';
      db.tenant.findUnique.mockResolvedValue({
        historicalStatementsEnabled: before,
      });
      await expect(
        service.update('target', { enabled, reason: ' approved ' }, identity),
      ).resolves.toEqual({ tenantId: 'target', enabled });
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      expect(db.tenant.update).toHaveBeenCalledWith({
        where: { id: 'target' },
        data: { historicalStatementsEnabled: enabled },
      });
      const [audit] = db.auditLog.create.mock.calls;
      expect(audit?.[0].data).toMatchObject({
        tenantId: 'target',
        userId: 'user',
        userRole: 'SUPER_ADMIN',
        changes: {
          before: { enabled: before },
          after: { enabled, reason: 'approved' },
        },
      });
      for (const model of [
        db.userPermission,
        db.userPermissionSet,
        db.permissionSetResource,
      ]) {
        expect(model.create).not.toHaveBeenCalled();
        expect(model.createMany).not.toHaveBeenCalled();
        expect(model.upsert).not.toHaveBeenCalled();
      }
    },
  );

  it('propagates audit failure out of the transaction instead of committing', async () => {
    user.role = 'SUPER_ADMIN';
    const auditFailure = new Error('Audit unavailable');
    db.auditLog.create.mockRejectedValue(auditFailure);
    const transactionFailures: unknown[] = [];
    db.$transaction.mockImplementation(async (callback) => {
      try {
        return await callback(db);
      } catch (error) {
        transactionFailures.push(error);
        throw error;
      }
    });
    await expect(
      service.update('target', { enabled: true, reason: 'approved' }, identity),
    ).rejects.toThrow(
      new ServiceUnavailableException('Access decision unavailable'),
    );
    expect(transactionFailures).toEqual([auditFailure]);
    expect(db.tenant.update).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a concurrent serialization conflict', async () => {
    db.$transaction.mockRejectedValue(
      Object.assign(new Error('Write conflict'), { code: 'P2034' }),
    );
    await expect(
      service.update('target', { enabled: true, reason: 'approved' }, identity),
    ).rejects.toThrow(
      new ServiceUnavailableException('Access decision unavailable'),
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.tenant.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown target', async () => {
    user.role = 'SUPER_ADMIN';
    db.tenant.findUnique.mockResolvedValue(null);
    await expect(
      service.update(
        'missing',
        { enabled: true, reason: 'approved' },
        identity,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.tenant.update).not.toHaveBeenCalled();
  });

  it.each(['user', 'permissions', 'audit', 'update'])(
    'fails closed on %s outage without exposing details',
    async (kind) => {
      const error = new Error('postgresql://secret-host/password');
      if (kind === 'user') db.user.findUnique.mockRejectedValue(error);
      if (kind === 'permissions')
        permissions.getHistoricalStatementsPermissions.mockRejectedValue(error);
      if (kind === 'audit') db.auditLog.create.mockRejectedValue(error);
      if (kind === 'update') db.tenant.update.mockRejectedValue(error);
      const action = ['audit', 'update'].includes(kind)
        ? ((user.role = 'SUPER_ADMIN'),
          service.update(
            'target',
            { enabled: true, reason: 'approved' },
            identity,
          ))
        : service.getAccess(identity);
      await expect(action).rejects.toThrow(
        new ServiceUnavailableException('Access decision unavailable'),
      );
    },
  );
});
