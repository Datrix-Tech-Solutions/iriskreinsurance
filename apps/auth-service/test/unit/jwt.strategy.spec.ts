/// <reference types="jest" />

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { PrismaService } from '../../src/prisma/prisma.service';

const JWT_PAYLOAD = {
  sub: 'user-1',
  email: 'ama@acme.com',
  role: 'EMPLOYEE',
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
};

const ACTIVE_TENANT = {
  slug: 'acme',
  name: 'Acme Corp',
  status: 'ACTIVE',
  moduleConfig: { hr: true },
  featureConfig: {},
};

const makeDbUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'ama@acme.com',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  tenantId: 'tenant-1',
  firstName: 'Ama',
  tenant: ACTIVE_TENANT,
  ...overrides,
});

describe('JwtStrategy.validate — permissions resolution', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    userPermission: { findMany: jest.fn() },
    userPermissionSet: { findMany: jest.fn() },
  } as any;

  let strategy: JwtStrategy;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'test-jwt-secret' },
        },
      ],
    }).compile();

    strategy = moduleRef.get(JwtStrategy);
    jest.clearAllMocks();
  });

  it('throws UnauthorizedException when the user record does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(JWT_PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when user status is not ACTIVE', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeDbUser({ status: 'SUSPENDED' }),
    );

    await expect(strategy.validate(JWT_PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the tenant is not ACTIVE', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeDbUser({ tenant: { ...ACTIVE_TENANT, status: 'SUSPENDED' } }),
    );

    await expect(strategy.validate(JWT_PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns empty permissions for TENANT_ADMIN and skips the permission DB lookup', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeDbUser({ role: 'TENANT_ADMIN' }),
    );

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.permissions).toEqual([]);
    expect(prisma.userPermission.findMany).not.toHaveBeenCalled();
    expect(prisma.userPermissionSet.findMany).not.toHaveBeenCalled();
  });

  it('returns empty permissions for SUPER_ADMIN and skips the permission DB lookup', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeDbUser({ role: 'SUPER_ADMIN' }),
    );

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.permissions).toEqual([]);
    expect(prisma.userPermission.findMany).not.toHaveBeenCalled();
  });

  it('includes active non-expired direct permissions for EMPLOYEE', async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.userPermission.findMany.mockResolvedValue([
      {
        isActive: true,
        expiresAt: null,
        resource: { name: 'employees' },
        action: 'VIEW',
      },
    ]);
    prisma.userPermissionSet.findMany.mockResolvedValue([]);

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.permissions).toContain('employees:VIEW');
  });

  it('excludes revoked (isActive=false) direct permissions', async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.userPermission.findMany.mockResolvedValue([
      {
        isActive: false,
        expiresAt: null,
        resource: { name: 'employees' },
        action: 'VIEW',
      },
    ]);
    prisma.userPermissionSet.findMany.mockResolvedValue([]);

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.permissions).not.toContain('employees:VIEW');
  });

  it('excludes expired direct permissions (expiresAt in the past)', async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.userPermission.findMany.mockResolvedValue([
      {
        isActive: true,
        expiresAt: yesterday,
        resource: { name: 'employees' },
        action: 'VIEW',
      },
    ]);
    prisma.userPermissionSet.findMany.mockResolvedValue([]);

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.permissions).not.toContain('employees:VIEW');
  });

  it('includes a not-yet-expired permission (expiresAt in the future)', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.userPermission.findMany.mockResolvedValue([
      {
        isActive: true,
        expiresAt: tomorrow,
        resource: { name: 'employees' },
        action: 'VIEW',
      },
    ]);
    prisma.userPermissionSet.findMany.mockResolvedValue([]);

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.permissions).toContain('employees:VIEW');
  });

  it('includes permissions that come from an active assigned permission set', async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.userPermission.findMany.mockResolvedValue([]);
    prisma.userPermissionSet.findMany.mockResolvedValue([
      {
        permissionSet: {
          isActive: true,
          resources: [{ resource: { name: 'departments' }, action: 'VIEW' }],
        },
      },
    ]);

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.permissions).toContain('departments:VIEW');
  });

  it('merges direct and set permissions without duplicates', async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.userPermission.findMany.mockResolvedValue([
      {
        isActive: true,
        expiresAt: null,
        resource: { name: 'employees' },
        action: 'VIEW',
      },
    ]);
    prisma.userPermissionSet.findMany.mockResolvedValue([
      {
        permissionSet: {
          isActive: true,
          resources: [{ resource: { name: 'employees' }, action: 'VIEW' }],
        },
      },
    ]);

    const result = await strategy.validate(JWT_PAYLOAD);

    const count = result.permissions.filter(
      (p) => p === 'employees:VIEW',
    ).length;
    expect(count).toBe(1);
  });

  it('propagates tenant moduleConfig and featureConfig onto the returned RequestUser', async () => {
    const moduleConfig = { hr: true, payroll: false };
    const featureConfig = { leave: { approvals: true } };
    prisma.user.findUnique.mockResolvedValue(
      makeDbUser({ tenant: { ...ACTIVE_TENANT, moduleConfig, featureConfig } }),
    );
    prisma.userPermission.findMany.mockResolvedValue([]);
    prisma.userPermissionSet.findMany.mockResolvedValue([]);

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.moduleConfig).toEqual(moduleConfig);
    expect(result.featureConfig).toEqual(featureConfig);
  });

  it('returns the correct core identity fields on the RequestUser', async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.userPermission.findMany.mockResolvedValue([]);
    prisma.userPermissionSet.findMany.mockResolvedValue([]);

    const result = await strategy.validate(JWT_PAYLOAD);

    expect(result.id).toBe('user-1');
    expect(result.email).toBe('ama@acme.com');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.tenantSlug).toBe('acme');
  });
});
