import { ConfigService } from '@nestjs/config';
import {
  IncomingMessage,
  Server,
  ServerResponse,
  createServer,
} from 'node:http';
import { AddressInfo } from 'node:net';
import {
  HistoricalStatementsAccessClient,
  HISTORICAL_ACCESS_TIMEOUT_MS,
} from './historical-statements-access.client';

describe('HistoricalStatementsAccessClient HTTP', () => {
  let server: Server;
  let base: string;
  let respond: (request: IncomingMessage, response: ServerResponse) => void;
  let configured: unknown;
  let client: HistoricalStatementsAccessClient;
  const decision = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    enabled: true,
    canView: true,
    canExport: false,
  };

  beforeAll(async () => {
    server = createServer((request, response) => respond(request, response));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    configured = base;
    client = new HistoricalStatementsAccessClient({
      get: () => configured,
    } as unknown as ConfigService);
    respond = (_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(decision));
    };
  });
  afterEach(() => server.closeAllConnections());
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('calls only the fixed internal path with the original JWT and no forwarded browser headers', async () => {
    const received = jest.fn<
      void,
      [string | undefined, string | undefined, IncomingMessage['headers']]
    >();
    respond = (request, response) => {
      received(request.url, request.method, request.headers);
      response.end(JSON.stringify(decision));
    };
    await expect(client.getAccess('original.jwt.bytes')).resolves.toEqual(
      decision,
    );
    expect(received).toHaveBeenCalledWith(
      '/tenants/me/historical-statements-access',
      'GET',
      expect.objectContaining({ authorization: 'Bearer original.jwt.bytes' }),
    );
    const headers = received.mock.calls[0][2];
    expect(headers.cookie).toBeUndefined();
    expect(headers['x-user-permissions']).toBeUndefined();
    expect(headers['x-tenant-id']).toBeUndefined();
  });

  it.each([
    undefined,
    '',
    'not a URL',
    'ftp://localhost',
    'http://user:password@localhost',
    'http://localhost/auth',
    'http://localhost/?host=evil',
    'http://localhost/#evil',
    42,
  ])(
    'fails closed lazily for invalid/missing configuration: %s',
    async (value) => {
      configured = value;
      expect(
        () =>
          new HistoricalStatementsAccessClient({
            get: () => value,
          } as unknown as ConfigService),
      ).not.toThrow();
      await expect(client.getAccess('token')).rejects.toMatchObject({
        status: 503,
      });
    },
  );

  it.each([
    [401, 401],
    [403, 403],
    [404, 503],
    [429, 503],
    [500, 503],
    [503, 503],
  ])(
    'maps Auth HTTP %s to %s without leaking the Auth body',
    async (upstream, expected) => {
      respond = (_request, response) => {
        response.writeHead(upstream);
        response.end('private DB credentials');
      };
      await expect(client.getAccess('token')).rejects.toMatchObject({
        status: expected,
      });
      await expect(client.getAccess('token')).rejects.not.toThrow(
        'private DB credentials',
      );
    },
  );

  it.each([301, 302, 307, 308])(
    'never follows redirect %s or forwards JWT to its destination',
    async (status) => {
      let calls = 0;
      respond = (_request, response) => {
        calls++;
        response.writeHead(status, { Location: `${base}/collect-token` });
        response.end();
      };
      await expect(client.getAccess('secret-token')).rejects.toMatchObject({
        status: 503,
      });
      expect(calls).toBe(1);
    },
  );

  it.each([
    'not json',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...decision, tenantId: null }),
    JSON.stringify({ ...decision, tenantId: '' }),
    JSON.stringify({ ...decision, userId: 123 }),
    JSON.stringify({ ...decision, userId: '' }),
    JSON.stringify({ ...decision, enabled: 'true' }),
    JSON.stringify({ ...decision, canView: 1 }),
    JSON.stringify({ ...decision, canExport: null }),
    JSON.stringify({
      tenantId: 'tenant-1',
      userId: 'user-1',
      enabled: true,
      canView: true,
    }),
  ])('rejects unknown or malformed runtime response %s', async (body) => {
    respond = (_request, response) => response.end(body);
    await expect(client.getAccess('token')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('bounds response memory', async () => {
    respond = (_request, response) => response.end(' '.repeat(16 * 1024 + 1));
    await expect(client.getAccess('token')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('fails closed on truncated bodies and socket failures', async () => {
    respond = (_request, response) => {
      response.writeHead(200, { 'Content-Length': 1000 });
      response.write('{');
      response.socket?.destroy();
    };
    await expect(client.getAccess('token')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('fails closed on connection refusal', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, '127.0.0.1', resolve),
    );
    configured = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
    await new Promise<void>((resolve, reject) =>
      closed.close((error) => (error ? reject(error) : resolve())),
    );
    await expect(client.getAccess('token')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('has a hard two-second deadline even before response headers', async () => {
    respond = () => undefined;
    const started = Date.now();
    await expect(client.getAccess('token')).rejects.toMatchObject({
      status: 503,
    });
    expect(Date.now() - started).toBeGreaterThanOrEqual(
      HISTORICAL_ACCESS_TIMEOUT_MS - 50,
    );
    expect(Date.now() - started).toBeLessThan(
      HISTORICAL_ACCESS_TIMEOUT_MS + 750,
    );
  });

  it('bounds the whole response even when the server keeps trickling data', async () => {
    respond = (_request, response) => {
      response.writeHead(200);
      response.write('{');
      const interval = setInterval(() => response.write(' '), 50);
      response.on('close', () => clearInterval(interval));
    };
    const started = Date.now();
    await expect(client.getAccess('token')).rejects.toMatchObject({
      status: 503,
    });
    expect(Date.now() - started).toBeLessThan(
      HISTORICAL_ACCESS_TIMEOUT_MS + 750,
    );
  });

  it('does not cache successful decisions', async () => {
    await expect(client.getAccess('token')).resolves.toEqual(decision);
    respond = (_request, response) =>
      response.end(
        JSON.stringify({ ...decision, enabled: false, canView: false }),
      );
    await expect(client.getAccess('token')).resolves.toMatchObject({
      enabled: false,
      canView: false,
    });
  });
});
