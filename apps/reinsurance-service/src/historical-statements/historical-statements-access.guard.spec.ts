import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { HistoricalStatementsAccessClient } from './historical-statements-access.client';
import { HistoricalStatementsAccessGuard } from './historical-statements-access.guard';
import { HistoricalStatementsPermission as Permission } from './historical-statements.permissions';

describe('HistoricalStatementsAccessGuard', () => {
  const getAccess = jest.fn();
  const client = { getAccess } as unknown as HistoricalStatementsAccessClient;
  const reflector = new Reflector();
  const guard = new HistoricalStatementsAccessGuard(client, reflector);
  const decision = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    enabled: true,
    canView: true,
    canExport: true,
  };
  function context(
    required: string[] = [Permission.VIEW],
    request: object = {
      user: { id: 'user-1', tenantId: 'tenant-1', role: 'TENANT_ADMIN' },
      cookies: { access_token: 'original-cookie-jwt' },
      headers: {
        authorization: 'Bearer different-bearer-jwt',
        'x-tenant-id': 'tenant-2',
      },
    },
  ): ExecutionContext {
    const handler = () => undefined;
    Reflect.defineMetadata(PERMISSIONS_KEY, required, handler);
    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    getAccess.mockReset().mockResolvedValue(decision);
  });

  it('forwards the original cookie selected by the JWT guard and ignores tenant headers', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(getAccess).toHaveBeenCalledWith('original-cookie-jwt');
  });

  it('uses the same bearer fallback when the cookie is empty', async () => {
    await guard.canActivate(
      context([Permission.VIEW], {
        user: { id: 'user-1', tenantId: 'tenant-1' },
        cookies: { access_token: '' },
        headers: { authorization: 'Bearer original-bearer-jwt' },
      }),
    );
    expect(getAccess).toHaveBeenCalledWith('original-bearer-jwt');
  });

  it.each([
    { headers: { authorization: 'Bearer token' } },
    { user: { id: 'user-1' }, headers: { authorization: 'Bearer token' } },
    {
      user: { tenantId: 'tenant-1' },
      headers: { authorization: 'Bearer token' },
    },
    { user: { id: 'user-1', tenantId: 'tenant-1' }, headers: {} },
  ])(
    'rejects missing verified identity or original token before calling Auth: %j',
    async (request) => {
      await expect(
        guard.canActivate(context([], request)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(getAccess).not.toHaveBeenCalled();
    },
  );

  it.each([{ tenantId: 'tenant-2' }, { userId: 'user-2' }])(
    'requires exact identity agreement: %j',
    async (override) => {
      getAccess.mockResolvedValue({ ...decision, ...override });
      await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it.each([
    ['missing', undefined],
    ['empty', []],
    ['null', null],
    ['scalar', Permission.VIEW],
    ['unknown action', ['operations.reinsurance.historical-statements:EDIT']],
    ['unknown resource', ['operations.reinsurance.placements:VIEW']],
    ['mixed known and unknown', [Permission.VIEW, 'unknown']],
    ['non-string action', [Permission.VIEW, true]],
  ])(
    'rejects %s permission metadata before calling Auth',
    async (_label, required) => {
      const execution = context();
      if (required === undefined) {
        Reflect.deleteMetadata(PERMISSIONS_KEY, execution.getHandler());
      } else {
        Reflect.defineMetadata(
          PERMISSIONS_KEY,
          required,
          execution.getHandler(),
        );
      }
      await expect(guard.canActivate(execution)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(getAccess).not.toHaveBeenCalled();
    },
  );

  it.each([
    [Permission.VIEW],
    [Permission.EXPORT],
    [Permission.VIEW, Permission.EXPORT],
  ])('allows a freshly granted permission subset %j', async (...required) => {
    await expect(guard.canActivate(context(required))).resolves.toBe(true);
  });

  it('never lets an admin bypass a disabled platform entitlement', async () => {
    getAccess.mockResolvedValue({ ...decision, enabled: false });
    await expect(guard.canActivate(context())).rejects.toThrow(
      'ARCHIVE_NOT_ENABLED',
    );
  });

  it('requires fresh VIEW even for stale admin claims', async () => {
    getAccess.mockResolvedValue({ ...decision, canView: false });
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])('EXPORT requires VIEW and EXPORT: %s/%s', async (canView, canExport) => {
    getAccess.mockResolvedValue({ ...decision, canView, canExport });
    await expect(
      guard.canActivate(context([Permission.EXPORT])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows fresh VIEW without EXPORT, and both actions when freshly granted', async () => {
    getAccess.mockResolvedValueOnce({ ...decision, canExport: false });
    await expect(guard.canActivate(context())).resolves.toBe(true);
    await expect(
      guard.canActivate(context([Permission.VIEW, Permission.EXPORT])),
    ).resolves.toBe(true);
  });

  it('rechecks on every request without positive caching', async () => {
    await guard.canActivate(context());
    getAccess.mockResolvedValue({ ...decision, enabled: false });
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(getAccess).toHaveBeenCalledTimes(2);
  });
});
