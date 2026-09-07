import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '@work-phelo/types';
import { FeatureGuard, FEATURE_KEY } from './feature.guard';
import { ModuleGuard, MODULE_KEY } from './module.guard';
import { PermissionsGuard } from './permissions.guard';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';

describe('Reinsurance entitlement and permission guards', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: ['operations.reinsurance.dashboard:VIEW'],
  };

  const contextFor = (actor: RequestUser = user) =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => ({ user: actor }) }),
    }) as unknown as ExecutionContext;

  it('requires the operations module entitlement', () => {
    const getAllAndOverride = jest.fn().mockReturnValue('operations');
    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;
    const guard = new ModuleGuard(reflector);
    const disabled = {
      ...user,
      moduleConfig: { operations: false },
    };

    expect(() => guard.canActivate(contextFor(disabled))).toThrow(
      ForbiddenException,
    );
    expect(getAllAndOverride).toHaveBeenCalledWith(MODULE_KEY, [
      'handler',
      'class',
    ]);
  });

  it('requires the reinsurance feature entitlement', () => {
    const getAllAndOverride = jest
      .fn()
      .mockReturnValue({ module: 'operations', feature: 'reinsurance' });
    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;
    const guard = new FeatureGuard(reflector);
    const disabled = {
      ...user,
      featureConfig: { operations: { reinsurance: false } },
    };

    expect(() => guard.canActivate(contextFor(disabled))).toThrow(
      ForbiddenException,
    );
    expect(getAllAndOverride).toHaveBeenCalledWith(FEATURE_KEY, [
      'handler',
      'class',
    ]);
  });

  it('permits only users holding the required resource action', () => {
    const getAllAndOverride = jest
      .fn()
      .mockReturnValue(['operations.reinsurance.dashboard:VIEW']);
    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(contextFor())).toBe(true);
    expect(() =>
      guard.canActivate(contextFor({ ...user, permissions: [] })),
    ).toThrow(ForbiddenException);
    expect(getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [
      'handler',
      'class',
    ]);
  });

  it('permits users holding any accepted workflow permission', () => {
    const getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) =>
        key === ANY_PERMISSIONS_KEY
          ? [
              'operations.reinsurance.premiums.receive-from-cedant:RUN',
              'operations.reinsurance.placements:CREATE',
            ]
          : undefined,
      );
    const reflector = { getAllAndOverride } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(
      guard.canActivate(
        contextFor({
          ...user,
          permissions: [
            'operations.reinsurance.premiums.receive-from-cedant:RUN',
          ],
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor({ ...user, permissions: [] })),
    ).toThrow(ForbiddenException);
    expect(getAllAndOverride).toHaveBeenCalledWith(ANY_PERMISSIONS_KEY, [
      'handler',
      'class',
    ]);
  });

  it('does not let admin permission bypass remove entitlement guards', () => {
    const permissionsReflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(['operations.reinsurance.dashboard:VIEW']),
    } as unknown as Reflector;
    const moduleReflector = {
      getAllAndOverride: jest.fn().mockReturnValue('operations'),
    } as unknown as Reflector;
    const admin = {
      ...user,
      role: 'TENANT_ADMIN',
      moduleConfig: { operations: false },
      permissions: [],
    };

    expect(
      new PermissionsGuard(permissionsReflector).canActivate(contextFor(admin)),
    ).toBe(true);
    expect(() =>
      new ModuleGuard(moduleReflector).canActivate(contextFor(admin)),
    ).toThrow(ForbiddenException);
  });
});
