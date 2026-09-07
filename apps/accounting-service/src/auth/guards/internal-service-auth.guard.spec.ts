import { createHmac } from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import {
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from './internal-service-auth.guard';

const SECRET = 'a-secure-internal-service-secret-of-at-least-32-characters';
const PATH = '/internal/source-events';

function context(
  headers: Record<string, string>,
  path = PATH,
): ExecutionContext {
  const request = {
    headers,
    method: 'POST',
    originalUrl: path,
  } as unknown as Request;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function signedHeaders(
  serviceName = 'reinsurance-service',
  timestamp = Math.floor(Date.now() / 1000).toString(),
  path = PATH,
): Record<string, string> {
  const signature = createHmac('sha256', SECRET)
    .update(`${serviceName}:${timestamp}:POST:${path}`)
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
      'reinsurance-service,hr-service,payroll-service,subscription-service';
    process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS = '300';
  });

  afterEach(() => {
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

  it('requires all service authentication headers', () => {
    expect(() =>
      new InternalServiceAuthGuard().canActivate(context({})),
    ).toThrow(UnauthorizedException);
  });

  it.each([
    'reinsurance-service',
    'hr-service',
    'payroll-service',
    'subscription-service',
  ])('accepts a valid signature from configured service %s', (serviceName) => {
    expect(
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders(serviceName)),
      ),
    ).toBe(true);
  });

  it('accepts a valid signature for the internal subledger ensure path', () => {
    const path = '/internal/subledgers/ensure';
    expect(
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders('reinsurance-service', undefined, path), path),
      ),
    ).toBe(true);
  });

  it('rejects a service outside the configured allow list', () => {
    expect(() =>
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders('unknown-service')),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a stale signature', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000 - 301).toString();
    expect(() =>
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders('hr-service', staleTimestamp)),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a signature for a different path', () => {
    const headers = signedHeaders();
    const timestamp = headers[INTERNAL_SERVICE_AUTH_HEADERS.timestamp];
    headers[INTERNAL_SERVICE_AUTH_HEADERS.signature] = createHmac(
      'sha256',
      SECRET,
    )
      .update(`reinsurance-service:${timestamp}:POST:/internal/other`)
      .digest('hex');

    expect(() =>
      new InternalServiceAuthGuard().canActivate(context(headers)),
    ).toThrow(UnauthorizedException);
  });
});
