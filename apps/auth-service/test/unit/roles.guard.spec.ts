/// <reference types="jest" />

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

function ctxWithUser(user?: any) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  beforeEach(() => {
    guard = new RolesGuard(reflector);
    jest.clearAllMocks();
  });

  it('allows route when no role metadata is declared', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    expect(guard.canActivate(ctxWithUser({ role: 'EMPLOYEE' }))).toBe(true);
  });

  it('throws when route requires role but request has no user', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['SUPER_ADMIN']);

    expect(() => guard.canActivate(ctxWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('allows when user has one of required roles', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['SUPER_ADMIN']);

    expect(guard.canActivate(ctxWithUser({ role: 'SUPER_ADMIN' }))).toBe(true);
  });

  it('denies when user role does not match required roles', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['SUPER_ADMIN']);

    expect(() =>
      guard.canActivate(ctxWithUser({ role: 'TENANT_ADMIN' })),
    ).toThrow(ForbiddenException);
  });
});
