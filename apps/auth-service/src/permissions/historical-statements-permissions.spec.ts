import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';
import { TenantConfigService } from '../tenants/tenant-config.service';

describe('Historical statements permission resolution and entitlement isolation', () => {
  const name = 'operations.reinsurance.historical-statements';
  const resource = {
    id: 'resource',
    name,
    module: 'OPERATIONS',
    isActive: true,
  };

  it('resolves current direct and set grants, excluding expired, revoked and inactive resources', async () => {
    const db = {
      user: { findFirst: jest.fn().mockResolvedValue({ role: 'EMPLOYEE' }) },
      userPermission: {
        findMany: jest.fn().mockResolvedValue([
          { resource, action: 'VIEW', isActive: true, expiresAt: null },
          { resource, action: 'EXPORT', isActive: false, expiresAt: null },
          {
            resource,
            action: 'EXPORT',
            isActive: true,
            expiresAt: new Date(0),
          },
          {
            resource: { ...resource, isActive: false },
            action: 'EXPORT',
            isActive: true,
          },
        ]),
      },
      userPermissionSet: {
        findMany: jest.fn().mockResolvedValue([
          {
            permissionSet: {
              name: 'Archive reader',
              resources: [
                { resource, action: 'VIEW' },
                {
                  resource: { ...resource, isActive: false },
                  action: 'EXPORT',
                },
              ],
            },
          },
        ]),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PrismaService, useValue: db },
        { provide: AuditService, useValue: {} },
      ],
    }).compile();
    const service = module.get(PermissionsService);
    const result = await service.getHistoricalStatementsPermissions(
      'current-tenant',
      'user',
    );
    expect(result.effectivePermissions).toEqual([`${name}:VIEW`]);
    expect(db.userPermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'current-tenant', userId: 'user' },
      }),
    );
    expect(db.userPermissionSet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user',
          permissionSet: { isActive: true, tenantId: 'current-tenant' },
        },
      }),
    );
    // The generic resolver intentionally retains its existing resource and
    // permission-set semantics for unrelated live flows.
    await expect(
      service.getUserPermissions('current-tenant', 'user'),
    ).resolves.toMatchObject({
      effectivePermissions: [`${name}:EXPORT`, `${name}:VIEW`],
    });
    expect(db.userPermissionSet.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId: 'user', permissionSet: { isActive: true } },
      }),
    );

    db.userPermissionSet.findMany.mockResolvedValue([
      {
        permissionSet: {
          name: 'Archive exporter',
          resources: [{ resource, action: 'EXPORT' }],
        },
      },
    ]);
    await expect(
      service.getHistoricalStatementsPermissions('current-tenant', 'user'),
    ).resolves.toMatchObject({
      effectivePermissions: [`${name}:EXPORT`, `${name}:VIEW`],
    });
    db.userPermissionSet.findMany.mockResolvedValue([]);
    await expect(
      service.getHistoricalStatementsPermissions('current-tenant', 'user'),
    ).resolves.toMatchObject({
      effectivePermissions: [`${name}:VIEW`],
    });
  });

  it('ordinary feature and module updates cannot mutate the platform entitlement', async () => {
    const tenant = {
      historicalStatementsEnabled: false,
      moduleConfig: { operations: true },
      featureConfig: { operations: { reinsurance: true } },
    };
    const db = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(tenant),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(tenant, data);
          return tenant;
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const module = await Test.createTestingModule({
      providers: [
        TenantConfigService,
        { provide: PrismaService, useValue: db },
      ],
    }).compile();
    const config = module.get(TenantConfigService);
    await config.updateFeatures(
      'tenant',
      'operations',
      {
        reinsurance: true,
        historicalStatementsEnabled: true,
      },
      'admin',
    );
    await config.updateModules(
      'tenant',
      { operations: true, historicalStatementsEnabled: true },
      'admin',
    );
    expect(tenant.historicalStatementsEnabled).toBe(false);
    for (const [call] of db.tenant.update.mock.calls) {
      expect(call.data).not.toHaveProperty('historicalStatementsEnabled');
    }
  });
});
