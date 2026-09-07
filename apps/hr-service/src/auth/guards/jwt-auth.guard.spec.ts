import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard gateway permission verification', () => {
  const secret = 'gateway-permission-test-secret';
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
        email: 'employee@example.com',
        role: 'EMPLOYEE',
        tenantId: 'tenant-1',
        tenantSlug: 'acme',
        permissions: ['jwt.permission:VIEW'],
        moduleConfig: { hr: true },
        featureConfig: { hr: { payroll: true } },
        ...overrides,
      },
      secret,
    );

  const expiredToken = () =>
    jwt.sign(
      {
        sub: 'user-1',
        email: 'employee@example.com',
        role: 'EMPLOYEE',
        tenantId: 'tenant-1',
        tenantSlug: 'acme',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      secret,
    );

  const signPermissions = (
    rawPermissions: string,
    userId = 'user-1',
    tenantId = 'tenant-1',
  ) =>
    createHmac('sha256', secret)
      .update(`${userId}:${tenantId}:${rawPermissions}`)
      .digest('hex');

  const contextFor = (headers: Record<string, string | string[]>) => {
    const request = { headers };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context, request };
  };

  const expectUnauthorized = (headers: Record<string, string | string[]>) => {
    const { context } = contextFor(headers);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  };

  it('accepts valid JWT and gateway-signed permissions', () => {
    const rawPermissions = JSON.stringify(['payroll:APPROVE']);
    const { context, request } = contextFor({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': rawPermissions,
      'x-gateway-permissions-signature': signPermissions(rawPermissions),
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(
      (request as { user?: { permissions: string[] } }).user?.permissions,
    ).toEqual(['payroll:APPROVE']);
  });

  it('rejects forged permissions with a random signature', () => {
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': JSON.stringify(['payroll:APPROVE']),
      'x-gateway-permissions-signature': 'random-signature',
    });
  });

  it('rejects permissions altered after signing', () => {
    const signedPermissions = JSON.stringify(['payroll:VIEW']);
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': JSON.stringify(['payroll:APPROVE']),
      'x-gateway-permissions-signature': signPermissions(signedPermissions),
    });
  });

  it('rejects forwarded permissions without a signature', () => {
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': JSON.stringify(['payroll:APPROVE']),
    });
  });

  it('rejects a signature without forwarded permissions', () => {
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-gateway-permissions-signature': signPermissions(JSON.stringify([])),
    });
  });

  it('rejects malformed or wrong-length signatures without crashing', () => {
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': JSON.stringify(['payroll:APPROVE']),
      'x-gateway-permissions-signature': 'short',
    });
  });

  it('rejects malformed JSON even when the malformed value is signed', () => {
    const rawPermissions = '{"not-valid-json"';
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': rawPermissions,
      'x-gateway-permissions-signature': signPermissions(rawPermissions),
    });
  });

  it('rejects correctly signed JSON that is not an array', () => {
    const rawPermissions = JSON.stringify({ permission: 'payroll:APPROVE' });
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': rawPermissions,
      'x-gateway-permissions-signature': signPermissions(rawPermissions),
    });
  });

  it('rejects correctly signed arrays containing non-string values', () => {
    const rawPermissions = JSON.stringify(['payroll:APPROVE', 42]);
    expectUnauthorized({
      authorization: `Bearer ${tokenFor()}`,
      'x-user-permissions': rawPermissions,
      'x-gateway-permissions-signature': signPermissions(rawPermissions),
    });
  });

  it('rejects signatures generated for a different tenant', () => {
    const rawPermissions = JSON.stringify(['payroll:APPROVE']);
    expectUnauthorized({
      authorization: `Bearer ${tokenFor({ tenantId: 'tenant-2' })}`,
      'x-user-permissions': rawPermissions,
      'x-gateway-permissions-signature': signPermissions(
        rawPermissions,
        'user-1',
        'tenant-1',
      ),
    });
  });

  it('rejects signatures generated for a different user', () => {
    const rawPermissions = JSON.stringify(['payroll:APPROVE']);
    expectUnauthorized({
      authorization: `Bearer ${tokenFor({ sub: 'user-2' })}`,
      'x-user-permissions': rawPermissions,
      'x-gateway-permissions-signature': signPermissions(
        rawPermissions,
        'user-1',
        'tenant-1',
      ),
    });
  });

  it('preserves JWT permission fallback when no gateway permission headers exist', () => {
    const { context, request } = contextFor({
      authorization: `Bearer ${tokenFor()}`,
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(
      (request as { user?: { permissions: string[] } }).user?.permissions,
    ).toEqual(['jwt.permission:VIEW']);
  });

  it('rejects invalid JWTs', () => {
    expectUnauthorized({
      authorization: 'Bearer not-a-jwt',
    });
  });

  it('rejects expired JWTs', () => {
    expectUnauthorized({
      authorization: `Bearer ${expiredToken()}`,
    });
  });
});
