/// <reference types="jest" />

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Permission } from '@work-phelo/config';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { PrismaService } from '../../src/prisma/prisma.service';

function executionContextWithUser(user?: any) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const prisma = {
    resource: { findUnique: jest.fn() },
    userPermission: { findFirst: jest.fn() },
    userPermissionSet: { findFirst: jest.fn() },
  } as any;

  let guard: PermissionsGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = moduleRef.get(PermissionsGuard);
    jest.clearAllMocks();
  });

  it('allows when no permission metadata is set', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    await expect(
      guard.canActivate(executionContextWithUser({ id: 'u1', tenantId: 't1' })),
    ).resolves.toBe(true);
  });

  it('allows SUPER_ADMIN without querying permission tables', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_USERS]);

    await expect(
      guard.canActivate(
        executionContextWithUser({
          id: 'u1',
          tenantId: 't1',
          role: 'SUPER_ADMIN',
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.resource.findUnique).not.toHaveBeenCalled();
  });

  it('allows TENANT_ADMIN without querying permission tables', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_USERS]);

    await expect(
      guard.canActivate(
        executionContextWithUser({
          id: 'u1',
          tenantId: 't1',
          role: 'TENANT_ADMIN',
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.resource.findUnique).not.toHaveBeenCalled();
  });

  it('denies unknown permission metadata values (fail closed)', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue(['unknown.permission']);

    await expect(
      guard.canActivate(
        executionContextWithUser({
          id: 'u1',
          tenantId: 't1',
          role: 'EMPLOYEE',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when user has a direct tenant-scoped permission', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_USERS]);
    prisma.resource.findUnique.mockResolvedValue({ id: 'resource-users' });
    prisma.userPermission.findFirst.mockResolvedValue({ id: 'perm-1' });

    await expect(
      guard.canActivate(
        executionContextWithUser({
          id: 'user-1',
          tenantId: 'tenant-1',
          role: 'EMPLOYEE',
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.userPermission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('allows when permission is provided by assigned permission set', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_USERS]);
    prisma.resource.findUnique.mockResolvedValue({ id: 'resource-users' });
    prisma.userPermission.findFirst.mockResolvedValue(null);
    prisma.userPermissionSet.findFirst.mockResolvedValue({
      id: 'assignment-1',
    });

    await expect(
      guard.canActivate(
        executionContextWithUser({
          id: 'user-1',
          tenantId: 'tenant-1',
          role: 'EMPLOYEE',
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.userPermissionSet.findFirst).toHaveBeenCalled();
  });

  it('denies when route requires permissions but request has no authenticated user', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_USERS]);

    await expect(
      guard.canActivate(executionContextWithUser(undefined)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
