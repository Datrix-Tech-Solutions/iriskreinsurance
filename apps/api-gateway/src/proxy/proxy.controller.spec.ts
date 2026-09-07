import { createHmac } from 'crypto';
import { ProxyController } from './proxy.controller';

function mockCreateProxyRequest(
  controller: ProxyController,
  fakeProxyRequest: unknown,
) {
  return jest
    .spyOn(
      controller as unknown as { createProxyRequest: () => unknown },
      'createProxyRequest',
    )
    .mockReturnValue(fakeProxyRequest);
}

describe('ProxyController Reinsurance foundation', () => {
  const enableSwagger = process.env.ENABLE_SWAGGER;
  const deployEnv = process.env.DEPLOY_ENV;
  const nodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.JWT_SECRET = 'gateway-phase-one-secret';
    process.env.AUTH_SERVICE_URL = 'http://auth-service:4001';
    process.env.REINSURANCE_SERVICE_URL = 'http://reinsurance-service:4007';
    process.env.ACCOUNTING_SERVICE_URL = 'http://accounting-service:4008';
    process.env.DEPLOY_ENV = 'dev';
    process.env.ENABLE_SWAGGER = 'true';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.JWT_SECRET;
    delete process.env.AUTH_SERVICE_URL;
    delete process.env.REINSURANCE_SERVICE_URL;
    delete process.env.ACCOUNTING_SERVICE_URL;
    delete process.env.GATEWAY_PROXY_TIMEOUT_MS;
    if (enableSwagger === undefined) {
      delete process.env.ENABLE_SWAGGER;
    } else {
      process.env.ENABLE_SWAGGER = enableSwagger;
    }
    if (deployEnv === undefined) {
      delete process.env.DEPLOY_ENV;
    } else {
      process.env.DEPLOY_ENV = deployEnv;
    }
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }
  });

  it('maps the public Operations route to the Reinsurance service boundary', () => {
    const controller = new ProxyController() as unknown as {
      resolveDownstream(pathParts: string[]): {
        service: string | undefined;
        consumedPathParts: number;
      };
    };

    expect(
      controller.resolveDownstream([
        'api',
        'v1',
        'operations',
        'reinsurance',
        'access',
        'verify',
      ]),
    ).toEqual({
      service: 'reinsurance',
      consumedPathParts: 4,
    });
  });

  it('maps the Accounting route to the Accounting service boundary', () => {
    const controller = new ProxyController() as unknown as {
      resolveDownstream(pathParts: string[]): {
        service: string | undefined;
        consumedPathParts: number;
      };
    };

    expect(
      controller.resolveDownstream(['api', 'v1', 'accounting', 'journals']),
    ).toEqual({
      service: 'accounting',
      consumedPathParts: 3,
    });
  });

  it('signs forwarded permissions against user and tenant context', () => {
    const controller = new ProxyController() as unknown as {
      signPermissions(
        userId: string,
        tenantId: string,
        serializedPermissions: string,
      ): string;
    };
    const permissions = JSON.stringify([
      'operations.reinsurance.dashboard:VIEW',
    ]);
    const expected = createHmac('sha256', 'gateway-phase-one-secret')
      .update(`user-1:tenant-1:${permissions}`)
      .digest('hex');

    expect(controller.signPermissions('user-1', 'tenant-1', permissions)).toBe(
      expected,
    );
  });

  it('strips caller-supplied forwarded authorization context headers', async () => {
    const controller = new ProxyController();
    const request = {
      path: '/api/v1/operations/reinsurance/placements',
      headers: {
        'x-user-permissions': JSON.stringify([
          'operations.reinsurance.settings:EDIT',
        ]),
        'x-gateway-permissions-signature': 'forged',
      },
      cookies: {},
      method: 'GET',
    };
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    await controller.proxy(request as never, { status } as never);

    expect(request.headers['x-user-permissions']).toBeUndefined();
    expect(request.headers['x-gateway-permissions-signature']).toBeUndefined();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('makes dev Swagger docs public for deployed services', () => {
    const controller = new ProxyController() as unknown as {
      isPublicPath(path: string): boolean;
    };

    for (const path of [
      '/api/v1/auth/docs',
      '/api/v1/hr/docs',
      '/api/v1/notification/docs',
      '/api/v1/subscription/docs',
      '/api/v1/marketing/docs',
      '/api/v1/operations/reinsurance/docs',
      '/api/v1/operations/reinsurance/docs/swagger-ui-init.js',
      '/api/v1/operations/reinsurance/docs-json',
      '/api/v1/accounting/docs',
      '/api/v1/accounting/docs-json',
    ]) {
      expect(controller.isPublicPath(path)).toBe(true);
    }

    delete process.env.ENABLE_SWAGGER;
    process.env.DEPLOY_ENV = 'prod';

    expect(controller.isPublicPath('/api/v1/operations/reinsurance/docs')).toBe(
      false,
    );
  });

  it('streams multipart write requests instead of JSON serializing them', () => {
    const controller = new ProxyController() as unknown as {
      shouldStreamRequestBody(req: {
        method: string;
        headers: Record<string, string>;
      }): boolean;
    };

    expect(
      controller.shouldStreamRequestBody({
        method: 'POST',
        headers: {
          'content-type': 'multipart/form-data; boundary=----workphelo',
        },
      }),
    ).toBe(true);
  });

  it('keeps JSON write requests on the existing JSON proxy path', () => {
    const controller = new ProxyController() as unknown as {
      shouldStreamRequestBody(req: {
        method: string;
        headers: Record<string, string>;
      }): boolean;
    };

    expect(
      controller.shouldStreamRequestBody({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      }),
    ).toBe(false);
  });

  it('uses a bounded downstream proxy timeout with a safe default', () => {
    const controller = new ProxyController() as unknown as {
      proxyTimeoutMs(): number;
    };

    expect(controller.proxyTimeoutMs()).toBe(30_000);

    process.env.GATEWAY_PROXY_TIMEOUT_MS = '2500';
    expect(controller.proxyTimeoutMs()).toBe(2500);

    process.env.GATEWAY_PROXY_TIMEOUT_MS = '0';
    expect(controller.proxyTimeoutMs()).toBe(30_000);
  });

  it('returns 504 when the downstream request times out', async () => {
    const controller = new ProxyController();
    let timeoutHandler: (() => void) | undefined;
    const fakeProxyRequest = {
      setTimeout: jest.fn((_ms: number, handler: () => void) => {
        timeoutHandler = handler;
      }),
      on: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
    };
    mockCreateProxyRequest(controller, fakeProxyRequest);
    const request = {
      path: '/api/v1/auth/login',
      url: '/api/v1/auth/login',
      headers: {},
      cookies: {},
      method: 'POST',
      body: { email: 'admin@example.com', password: 'secret' },
      on: jest.fn(),
      off: jest.fn(),
    };
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = {
      status,
      json,
      headersSent: false,
      writableEnded: false,
      on: jest.fn(),
      off: jest.fn(),
      end: jest.fn(),
    };

    await controller.proxy(request as never, response as never);
    timeoutHandler?.();

    expect(fakeProxyRequest.destroy).toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(504);
    expect(json).toHaveBeenCalledWith({
      message: 'Gateway timeout while contacting downstream service',
      statusCode: 504,
    });
  });

  it('does not double-write a response if a timeout also emits an error', async () => {
    const controller = new ProxyController();
    let timeoutHandler: (() => void) | undefined;
    let errorHandler: ((error: Error) => void) | undefined;
    const fakeProxyRequest = {
      setTimeout: jest.fn((_ms: number, handler: () => void) => {
        timeoutHandler = handler;
      }),
      on: jest.fn((event: string, handler: (error: Error) => void) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      }),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
    };
    mockCreateProxyRequest(controller, fakeProxyRequest);
    const request = {
      path: '/api/v1/auth/login',
      url: '/api/v1/auth/login',
      headers: {},
      cookies: {},
      method: 'POST',
      body: {},
      on: jest.fn(),
      off: jest.fn(),
    };
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = {
      status,
      json,
      headersSent: false,
      writableEnded: false,
      on: jest.fn(),
      off: jest.fn(),
      end: jest.fn(),
    };

    await controller.proxy(request as never, response as never);
    timeoutHandler?.();
    errorHandler?.(new Error('socket closed after timeout'));

    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(504);
  });

  it('returns 503 without leaking downstream error details', async () => {
    const controller = new ProxyController();
    let errorHandler: ((error: Error) => void) | undefined;
    const fakeProxyRequest = {
      setTimeout: jest.fn(),
      on: jest.fn((event: string, handler: (error: Error) => void) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      }),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
    };
    mockCreateProxyRequest(controller, fakeProxyRequest);
    const request = {
      path: '/api/v1/auth/login',
      url: '/api/v1/auth/login',
      headers: {},
      cookies: {},
      method: 'POST',
      body: {},
      on: jest.fn(),
      off: jest.fn(),
    };
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = {
      status,
      json,
      headersSent: false,
      writableEnded: false,
      on: jest.fn(),
      off: jest.fn(),
      end: jest.fn(),
    };

    await controller.proxy(request as never, response as never);
    errorHandler?.(new Error('connect ECONNREFUSED 127.0.0.1:4001'));

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      message: 'Service temporarily unavailable',
      statusCode: 503,
    });
  });

  it('propagates client aborts to the downstream request', async () => {
    const controller = new ProxyController();
    let abortHandler: (() => void) | undefined;
    const fakeProxyRequest = {
      setTimeout: jest.fn(),
      on: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
    };
    mockCreateProxyRequest(controller, fakeProxyRequest);
    const request = {
      path: '/api/v1/auth/login',
      url: '/api/v1/auth/login',
      headers: {},
      cookies: {},
      method: 'POST',
      body: {},
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'aborted') {
          abortHandler = handler;
        }
      }),
      off: jest.fn(),
    };
    const response = {
      status: jest.fn().mockReturnValue({ json: jest.fn() }),
      headersSent: false,
      writableEnded: false,
      on: jest.fn(),
      off: jest.fn(),
      end: jest.fn(),
    };

    await controller.proxy(request as never, response as never);
    abortHandler?.();

    expect(fakeProxyRequest.destroy).toHaveBeenCalled();
  });
});
