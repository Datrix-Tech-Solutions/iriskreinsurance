import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import {
  IncomingMessage,
  Server,
  ServerResponse,
  createServer,
  request as httpRequest,
} from 'node:http';
import { AddressInfo } from 'node:net';
import { PrismaService } from '../prisma/prisma.service';
import { HistoricalStatementsModule } from './historical-statements.module';
import { HistoricalStatementsPermission as Permission } from './historical-statements.permissions';

describe('Historical statements direct service HTTP authorization', () => {
  let app: INestApplication;
  let auth: Server;
  let base: string;
  let authUrl: string | undefined;
  let respond: (request: IncomingMessage, response: ServerResponse) => void;
  const calls = jest.fn<
    void,
    [string | undefined, IncomingMessage['headers']]
  >();
  const previousSecret = process.env.JWT_SECRET;
  const secret = 'historical-statements-test-only-secret';
  const identity = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    enabled: true,
    canView: true,
    canExport: false,
  };

  function token(overrides: object = {}, signingSecret = secret) {
    return jwt.sign(
      {
        sub: 'user-1',
        tenantId: 'tenant-1',
        role: 'EMPLOYEE',
        moduleConfig: { operations: true },
        featureConfig: { operations: { reinsurance: true } },
        ...overrides,
      },
      signingSecret,
      'exp' in overrides ? {} : { expiresIn: '5m' },
    );
  }

  function get(
    path = '/api/historical-statements/access',
    headers: Record<string, string> = {},
  ) {
    return new Promise<{
      status: number;
      headers: IncomingMessage['headers'];
      body: unknown;
    }>((resolve, reject) => {
      const request = httpRequest(
        new URL(path, base),
        { headers, agent: false },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const body: unknown = JSON.parse(
              Buffer.concat(chunks).toString('utf8'),
            );
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body,
            });
          });
          response.on('error', reject);
        },
      );
      request.on('error', reject);
      request.end();
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    auth = createServer((request, response) => {
      calls(request.url, request.headers);
      respond(request, response);
    });
    await new Promise<void>((resolve) => auth.listen(0, '127.0.0.1', resolve));
    const module = await Test.createTestingModule({
      imports: [HistoricalStatementsModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: () => authUrl })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  beforeEach(() => {
    calls.mockClear();
    authUrl = `http://127.0.0.1:${(auth.address() as AddressInfo).port}`;
    respond = (_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(identity));
    };
  });
  afterAll(async () => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    await app.close();
    auth.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      auth.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('returns only an authorization result and disables shared caching', async () => {
    const result = await get(undefined, { authorization: `Bearer ${token()}` });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ authorized: true });
    expect(result.headers['cache-control']).toBe('private,no-store');
    expect(result.headers.vary).toBe('Cookie,Authorization');
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls.mock.calls[0][0]).toBe(
      '/tenants/me/historical-statements-access',
    );
  });

  it.each([
    ['missing token', {}, 401],
    [
      'forged JWT',
      { authorization: `Bearer ${token({}, 'wrong-secret')}` },
      401,
    ],
    [
      'expired JWT',
      { authorization: `Bearer ${token({ exp: 1, iat: 0 })}` },
      401,
    ],
    [
      'missing tenant',
      { authorization: `Bearer ${token({ tenantId: null })}` },
      401,
    ],
    [
      'module disabled',
      {
        authorization: `Bearer ${token({ moduleConfig: { operations: false } })}`,
      },
      403,
    ],
    [
      'feature disabled',
      {
        authorization: `Bearer ${token({ featureConfig: { operations: { reinsurance: false } } })}`,
      },
      403,
    ],
  ])(
    'rejects %s before making any Auth call',
    async (_label, headers, status) => {
      expect((await get(undefined, headers)).status).toBe(status);
      expect(calls).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['no embedded permissions', { permissions: undefined }],
    ['empty local permissions', { permissions: [] }],
    ['EXPORT-only local permissions', { permissions: [Permission.EXPORT] }],
  ])('uses fresh VIEW eligibility for %s', async (_label, claims) => {
    const original = token(claims);
    if (claims.permissions === undefined) {
      expect(jwt.decode(original)).not.toHaveProperty('permissions');
    }
    const headers = { authorization: `Bearer ${original}` };
    expect((await get(undefined, headers)).status).toBe(200);
    respond = (_request, response) =>
      response.end(JSON.stringify({ ...identity, canView: false }));
    expect((await get(undefined, headers)).status).toBe(403);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('does not let forged permission headers override the fresh decision', async () => {
    respond = (_request, response) =>
      response.end(JSON.stringify({ ...identity, canView: false }));
    const denied = await get(undefined, {
      authorization: `Bearer ${token({ permissions: [] })}`,
      'x-user-permissions': JSON.stringify([Permission.VIEW]),
      'x-gateway-permissions-signature': 'forged',
      'x-tenant-id': 'tenant-2',
    });
    expect(denied.status).toBe(403);
    expect(calls).toHaveBeenCalledTimes(1);
    respond = (_request, response) => response.end(JSON.stringify(identity));
    expect(
      (
        await get(undefined, {
          authorization: `Bearer ${token()}`,
          'x-user-permissions': JSON.stringify([Permission.VIEW]),
          'x-gateway-permissions-signature': 'forged',
        })
      ).status,
    ).toBe(200);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('ignores tenant/browser host headers and uses the configured Auth host', async () => {
    const original = token();
    expect(
      (
        await get(undefined, {
          authorization: `Bearer ${original}`,
          'x-tenant-id': 'tenant-2',
          'x-user-id': 'user-2',
          host: 'evil.example',
          'x-forwarded-host': 'evil.example',
          'x-auth-service-url': 'http://evil.example',
        })
      ).status,
    ).toBe(200);
    const headers = calls.mock.calls[0][1];
    expect(headers.authorization).toBe(`Bearer ${original}`);
    expect(headers['x-tenant-id']).toBeUndefined();
    expect(headers['x-forwarded-host']).toBeUndefined();
    expect(headers.host).toBe(new URL(authUrl!).host);
  });

  it('forwards the cookie JWT rather than a conflicting bearer JWT', async () => {
    const cookie = token();
    const bearer = token({ sub: 'user-2', tenantId: 'tenant-2' });
    expect(
      (
        await get(undefined, {
          cookie: `access_token=${cookie}`,
          authorization: `Bearer ${bearer}`,
        })
      ).status,
    ).toBe(200);
    expect(calls.mock.calls[0][1].authorization).toBe(`Bearer ${cookie}`);
    expect(
      (
        await get(undefined, {
          cookie: 'access_token=invalid',
          authorization: `Bearer ${cookie}`,
        })
      ).status,
    ).toBe(401);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it.each(['TENANT_ADMIN', 'SUPER_ADMIN'])(
    'blocks a disabled tenant even for %s',
    async (role) => {
      respond = (_request, response) =>
        response.end(
          JSON.stringify({ ...identity, enabled: false, canView: false }),
        );
      expect(
        (
          await get(undefined, {
            authorization: `Bearer ${token({ role, permissions: [] })}`,
          })
        ).status,
      ).toBe(403);
      expect(calls).toHaveBeenCalledTimes(1);
    },
  );

  it('denies a stale JWT permission immediately after live VIEW revocation', async () => {
    const headers = {
      authorization: `Bearer ${token({ permissions: [Permission.VIEW] })}`,
    };
    expect((await get(undefined, headers)).status).toBe(200);
    respond = (_request, response) =>
      response.end(JSON.stringify({ ...identity, canView: false }));
    expect((await get(undefined, headers)).status).toBe(403);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it.each([{ tenantId: 'tenant-2' }, { userId: 'user-2' }])(
    'rejects a fresh response for another identity %j',
    async (override) => {
      respond = (_request, response) =>
        response.end(JSON.stringify({ ...identity, ...override }));
      expect(
        (await get(undefined, { authorization: `Bearer ${token()}` })).status,
      ).toBe(401);
    },
  );

  it.each([
    [401, 401],
    [403, 403],
    [500, 503],
    [302, 503],
  ])(
    'fails closed for Auth %s with service status %s',
    async (upstream, expected) => {
      respond = (_request, response) => {
        response.writeHead(upstream, { Location: 'http://evil.example' });
        response.end('private error');
      };
      const result = await get(undefined, {
        authorization: `Bearer ${token()}`,
      });
      expect(result.status).toBe(expected);
      expect(JSON.stringify(result.body)).not.toContain('private error');
    },
  );

  it('fails closed when Auth returns malformed data', async () => {
    respond = (_request, response) =>
      response.end(JSON.stringify({ ...identity, enabled: 'true' }));
    expect(
      (await get(undefined, { authorization: `Bearer ${token()}` })).status,
    ).toBe(503);
  });

  it('starts without AUTH_SERVICE_URL and returns 503 only on archive access', async () => {
    authUrl = undefined;
    expect(
      (await get(undefined, { authorization: `Bearer ${token()}` })).status,
    ).toBe(503);
    expect(calls).not.toHaveBeenCalled();
  });

  it('returns 503 when the Auth response exceeds the deadline', async () => {
    respond = () => undefined;
    expect(
      (await get(undefined, { authorization: `Bearer ${token()}` })).status,
    ).toBe(503);
  });

  it.each(['tenantId=tenant-2', 'userId=user-2', 'host=evil.example'])(
    'rejects request-controlled query selectors: %s',
    async (query) => {
      expect(
        (
          await get(`/api/historical-statements/access?${query}`, {
            authorization: `Bearer ${token()}`,
          })
        ).status,
      ).toBe(400);
    },
  );

  it('does not expose unknown archive operations', async () => {
    expect(
      (
        await get('/api/historical-statements/unknown-operation', {
          authorization: `Bearer ${token()}`,
        })
      ).status,
    ).toBe(404);
    expect(calls).not.toHaveBeenCalled();
  });
});
