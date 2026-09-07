import { createHmac } from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import {
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from './internal-service-auth.guard';

const SECRET = 'a-secure-internal-service-secret-of-at-least-32-characters';
const PATH = '/internal/tenants/tenant-1/document-profile';

function context(headers: Record<string, string>): ExecutionContext {
  const request = {
    headers,
    method: 'GET',
    originalUrl: PATH,
  } as unknown as Request;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function signedHeaders(
  serviceName = 'reinsurance-service',
  timestamp = Math.floor(Date.now() / 1000).toString(),
): Record<string, string> {
  const signature = createHmac('sha256', SECRET)
    .update(`${serviceName}:${timestamp}:GET:${PATH}`)
    .digest('hex');
  return {
    [INTERNAL_SERVICE_AUTH_HEADERS.service]: serviceName,
    [INTERNAL_SERVICE_AUTH_HEADERS.timestamp]: timestamp,
    [INTERNAL_SERVICE_AUTH_HEADERS.signature]: signature,
  };
}

describe('InternalServiceAuthGuard', () => {
  const originalSecret = process.env.INTERNAL_SERVICE_AUTH_SECRET;
  const originalAllowed = process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES;
  const originalMaxClockSkew =
    process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_AUTH_SECRET = SECRET;
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES =
      'reinsurance-service,notification-service';
    process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS = '300';
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    } else {
      process.env.INTERNAL_SERVICE_AUTH_SECRET = originalSecret;
    }
    if (originalAllowed === undefined) {
      delete process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES;
    } else {
      process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = originalAllowed;
    }
    if (originalMaxClockSkew === undefined) {
      delete process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS;
    } else {
      process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS =
        originalMaxClockSkew;
    }
  });

  it('requires service authentication headers', () => {
    expect(() =>
      new InternalServiceAuthGuard().canActivate(context({})),
    ).toThrow(UnauthorizedException);
  });

  it('accepts a valid signature from an allowed service', () => {
    expect(
      new InternalServiceAuthGuard().canActivate(context(signedHeaders())),
    ).toBe(true);
  });

  it('rejects stale signatures', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000 - 301).toString();
    expect(() =>
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders('reinsurance-service', staleTimestamp)),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects services outside the allow list', () => {
    expect(() =>
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders('unknown-service')),
      ),
    ).toThrow(UnauthorizedException);
  });
});
