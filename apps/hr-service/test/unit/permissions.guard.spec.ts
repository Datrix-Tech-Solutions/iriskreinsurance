/// <reference types="jest" />

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Permission } from '@work-phelo/config';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';

function makeContext(user?: unknown) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

const employee = (permissions: string[] = []) => ({
  id: 'u1',
  tenantId: 't1',
  role: 'EMPLOYEE',
  permissions,
});

describe('PermissionsGuard (HR service — user.permissions array)', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  let guard: PermissionsGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = moduleRef.get(PermissionsGuard);
    jest.clearAllMocks();
  });

  it('allows when no permission metadata is set on the handler', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ id: 'u1' }))).toBe(true);
  });

  it('allows SUPER_ADMIN regardless of user.permissions', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_EMPLOYEES]);

    expect(
      guard.canActivate(
        makeContext({ id: 'u1', role: 'SUPER_ADMIN', permissions: [] }),
      ),
    ).toBe(true);
  });

  it('allows TENANT_ADMIN regardless of user.permissions', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_EMPLOYEES]);

    expect(
      guard.canActivate(
        makeContext({ id: 'u1', role: 'TENANT_ADMIN', permissions: [] }),
      ),
    ).toBe(true);
  });

  it('throws ForbiddenException when there is no authenticated user', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_EMPLOYEES]);

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException for an unknown permission key (fail-closed)', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue(['unknown:permission']);

    expect(() => guard.canActivate(makeContext(employee([])))).toThrow(
      ForbiddenException,
    );
  });

  it('allows EMPLOYEE whose permissions include the required resource:action string', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_EMPLOYEES]);

    expect(guard.canActivate(makeContext(employee(['employees:VIEW'])))).toBe(
      true,
    );
  });

  it('denies EMPLOYEE whose permissions do not include the required resource:action', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_EMPLOYEES]);

    expect(() =>
      guard.canActivate(makeContext(employee(['departments:VIEW']))),
    ).toThrow(ForbiddenException);
  });

  it('denies when EMPLOYEE satisfies only some of multiple required permissions', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_EMPLOYEES, Permission.CREATE_EMPLOYEE]);

    expect(() =>
      guard.canActivate(makeContext(employee(['employees:VIEW']))),
    ).toThrow(ForbiddenException);
  });

  it('allows EMPLOYEE when all required permissions are present', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_EMPLOYEES, Permission.CREATE_EMPLOYEE]);

    expect(
      guard.canActivate(
        makeContext(employee(['employees:VIEW', 'employees:CREATE'])),
      ),
    ).toBe(true);
  });

  it('allows APPROVE_LEAVE when user has the leave:APPROVE rule', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.APPROVE_LEAVE]);

    expect(guard.canActivate(makeContext(employee(['leave:APPROVE'])))).toBe(
      true,
    );
  });

  it('allows READ_PAYROLL when user has any of VIEW, RUN, APPROVE, or EDIT on the payroll resource', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([Permission.READ_PAYROLL]);

    // READ_PAYROLL maps to { resource: 'payroll', actions: ['VIEW','RUN','APPROVE','EDIT'] }
    // Any one of these satisfies the requirement
    expect(guard.canActivate(makeContext(employee(['payroll:RUN'])))).toBe(
      true,
    );
    expect(guard.canActivate(makeContext(employee(['payroll:APPROVE'])))).toBe(
      true,
    );
  });
});
