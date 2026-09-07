import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const secret = 'phase-one-test-secret';
  const guard = new JwtAuthGuard();

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  const tokenFor = (overrides: Record<string, unknown> = {}) =>
    jwt.sign(
      {
        sub: 'user-1',
        email: 'broker@example.com',
        role: 'EMPLOYEE',
        tenantId: 'tenant-1',
        tenantSlug: 'broker',
        moduleConfig: { operations: true },
        featureConfig: { operations: { reinsurance: true } },
        ...overrides,
      },
      secret,
    );

  const contextFor = (headers: Record<string, string>) => {
    const request = { headers };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;

    return { context, request };
  };

  it('uses gateway-signed dynamic permissions for an authenticated tenant user', () => {
    const rawPermissions = JSON.stringify([
      'operations.reinsurance.dashboard:VIEW',
    ]);
    const signature = createHmac('sha256', secret)
      .update(`user-1:tenant-1:${rawPermissions}`)
      .digest('hex');
    const { context, request } = contextFor({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': rawPermissions,
      'x-gateway-permissions-signature': signature,
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(
      (request as { user?: { permissions: string[] } }).user?.permissions,
    ).toEqual(['operations.reinsurance.dashboard:VIEW']);
  });

  it('does not trust forged forwarded permission headers', () => {
    const { context, request } = contextFor({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': JSON.stringify([
        'operations.reinsurance.dashboard:VIEW',
      ]),
      'x-gateway-permissions-signature': 'forged',
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(
      (request as { user?: { permissions: string[] } }).user?.permissions,
    ).toEqual([]);
  });

  it('rejects authenticated tokens without tenant context', () => {
    const { context } = contextFor({
      authorization: `Bearer ${tokenFor({ tenantId: '' })}`,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
