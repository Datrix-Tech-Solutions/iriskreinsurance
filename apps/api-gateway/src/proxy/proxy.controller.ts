import { Controller, All, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';
import * as jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';
import { isSwaggerEnabled } from '@work-phelo/config';
import { JwtPayload } from '@work-phelo/types';
import {
  GatewayServiceName,
  gatewayServiceConfig,
  getConfiguredGatewayServices,
  getGatewayServiceUrl,
} from '../config/runtime-env';

const permissionsCache = new Map<
  string,
  { permissions: string[]; expiresAt: number }
>();
const PERM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes — matches access-token lifetime

const PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/login$/,
  /^\/api\/v1\/auth\/admin\/login$/,
  /^\/api\/v1\/auth\/refresh$/,
  /^\/api\/v1\/auth\/verify-email$/,
  /^\/api\/v1\/auth\/resend-verification$/,
  /^\/api\/v1\/auth\/forgot-password$/,
  /^\/api\/v1\/auth\/reset-password$/,
  /^\/api\/v1\/auth\/force-reset-password$/,
  /^\/api\/v1\/auth\/google(?:\/callback)?$/,
  /^\/api\/v1\/auth\/microsoft(?:\/callback)?$/,
  /^\/api\/v1\/auth\/tenants\/register$/,
  /^\/api\/v1\/auth\/tenants\/slug\/[^/]+\/branding$/,
  /^\/api\/v1\/auth\/users\/accept-invite$/,
  /^\/api\/v1\/auth\/mfa\/send-sms$/,
  /^\/api\/v1\/operations\/reinsurance\/health$/,
  /^\/api\/v1\/accounting\/health$/,
];

const SWAGGER_PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/hr\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/notification\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/subscription\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/marketing\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/operations\/reinsurance\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/accounting\/docs(?:\/.*|-json|-yaml)?$/,
];

const FORWARDED_AUTH_CONTEXT_HEADERS = [
  'x-user-id',
  'x-user-email',
  'x-user-role',
  'x-tenant-id',
  'x-tenant-slug',
  'x-tenant-name',
  'x-user-first-name',
  'x-company-role-id',
  'x-user-permissions',
  'x-gateway-permissions-signature',
] as const;

const DEFAULT_PROXY_TIMEOUT_MS = 30_000;
const MAX_PROXY_TIMEOUT_MS = 300_000;

@Controller()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly services = getConfiguredGatewayServices();

  private resolveDownstream(pathParts: string[]): {
    service: GatewayServiceName | undefined;
    consumedPathParts: number;
  } {
    // Operations is a public navigation namespace, while Reinsurance remains
    // the deployable downstream service boundary.
    if (pathParts[2] === 'operations' && pathParts[3] === 'reinsurance') {
      return { service: 'reinsurance', consumedPathParts: 4 };
    }

    return {
      service: pathParts[2] as GatewayServiceName | undefined,
      consumedPathParts: 3,
    };
  }

  private fetchUserPermissions(
    authServiceUrl: string,
    token: string,
  ): Promise<string[]> {
    return new Promise((resolve) => {
      const url = new URL(authServiceUrl);
      const isHttps = url.protocol === 'https:';
      const port = url.port ? parseInt(url.port) : isHttps ? 443 : 80;

      const req = (isHttps ? https : http).request(
        {
          hostname: url.hostname,
          port,
          path: '/me',
          method: 'GET',
          headers: { Cookie: `access_token=${token}` },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const body = JSON.parse(data);
              resolve(Array.isArray(body.permissions) ? body.permissions : []);
            } catch {
              resolve([]);
            }
          });
        },
      );
      req.on('error', () => resolve([]));
      req.end();
    });
  }

  private isPublicPath(path: string): boolean {
    if (PUBLIC_PATTERNS.some((pattern) => pattern.test(path))) {
      return true;
    }

    return (
      isSwaggerEnabled() &&
      SWAGGER_PUBLIC_PATTERNS.some((pattern) => pattern.test(path))
    );
  }

  private shouldStreamRequestBody(req: Request): boolean {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return false;
    }

    const contentTypeHeader = req.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader.join(';')
      : contentTypeHeader;

    return (
      contentType?.toLowerCase().startsWith('multipart/form-data') ?? false
    );
  }

  @All('api/v1/*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    // pathParts: ['api', 'v1', 'auth', 'login', ...]
    const pathParts = req.path.split('/').filter(Boolean);
    const { service, consumedPathParts } = this.resolveDownstream(pathParts);
    const serviceUrl = service ? getGatewayServiceUrl(service) : undefined;

    if (!serviceUrl) {
      const availableServices = Object.keys(this.services);

      return res.status(503).json({
        message: `Service '${service ?? 'unknown'}' is not configured for this environment`,
        availableServices,
        statusCode: 503,
      });
    }

    for (const header of FORWARDED_AUTH_CONTEXT_HEADERS) {
      delete req.headers[header];
    }

    const isPublic = this.isPublicPath(req.path);

    if (!isPublic) {
      const cookies = req.cookies as Record<string, string> | undefined;
      const token =
        cookies?.access_token ||
        req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res
          .status(401)
          .json({ message: 'No token provided', statusCode: 401 });
      }

      try {
        const payload = jwt.verify(
          token,
          process.env.JWT_SECRET!,
        ) as JwtPayload;
        req.headers['x-user-id'] = payload.sub;
        req.headers['x-user-email'] = payload.email;
        req.headers['x-user-role'] = payload.role;
        req.headers['x-tenant-id'] = payload.tenantId;
        req.headers['x-tenant-slug'] = payload.tenantSlug;
        req.headers['x-tenant-name'] = payload.tenantName ?? '';
        req.headers['x-user-first-name'] = payload.firstName ?? '';
        if (payload.companyRoleId) {
          req.headers['x-company-role-id'] = payload.companyRoleId;
        }

        // Resolve and forward permissions for non-auth-service requests.
        // The JWT no longer embeds permissions (removed to keep Set-Cookie small),
        // so the gateway fetches them from auth-service and injects as a header.
        if (service !== 'auth') {
          const userId = payload.sub;
          const cached = permissionsCache.get(userId);
          let permissions: string[];
          if (cached && cached.expiresAt > Date.now()) {
            permissions = cached.permissions;
          } else {
            const authUrl = getGatewayServiceUrl('auth');
            permissions = authUrl
              ? await this.fetchUserPermissions(authUrl, token)
              : [];
            permissionsCache.set(userId, {
              permissions,
              expiresAt: Date.now() + PERM_CACHE_TTL,
            });
          }
          const serializedPermissions = JSON.stringify(permissions);
          req.headers['x-user-permissions'] = serializedPermissions;
          req.headers['x-gateway-permissions-signature'] = this.signPermissions(
            payload.sub,
            payload.tenantId,
            serializedPermissions,
          );
        }
      } catch {
        return res
          .status(401)
          .json({ message: 'Invalid or expired token', statusCode: 401 });
      }
    }

    // Strip the public route namespace before forwarding downstream:
    // /api/v1/auth/login -> /auth/login (auth-service)
    // /api/v1/hr/departments -> /departments (hr-service)
    // /api/v1/operations/reinsurance/health -> /api/health (reinsurance-service)
    const remainingParts = pathParts.slice(consumedPathParts);
    const downstreamPath = '/' + remainingParts.join('/');

    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    const downstreamPrefix =
      service && gatewayServiceConfig[service]?.downstreamPrefix
        ? gatewayServiceConfig[service].downstreamPrefix
        : '';
    const targetPath = downstreamPrefix + downstreamPath + queryString;

    this.logger.log(`${req.method} ${req.path} → ${serviceUrl}${targetPath}`);

    const url = new URL(serviceUrl);
    const isHttps = url.protocol === 'https:';
    const port = url.port ? parseInt(url.port) : isHttps ? 443 : 80;

    const forwardHeaders: any = {
      ...req.headers,
      host: url.hostname,
      'content-type': req.headers['content-type'] || 'application/json',
    };

    if (
      service === 'accounting' &&
      /^\/api\/v1\/accounting\/docs(?:\/.*|-json|-yaml)?$/.test(req.path)
    ) {
      forwardHeaders['x-workphelo-gateway-docs'] = 'accounting';
      forwardHeaders['x-forwarded-host'] = req.headers.host;
      forwardHeaders['x-forwarded-proto'] = req.protocol;
    }

    if (req.headers.cookie) {
      forwardHeaders.cookie = req.headers.cookie;
    }

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port,
      path: targetPath,
      method: req.method,
      headers: forwardHeaders,
    };

    const proxyTimeoutMs = this.proxyTimeoutMs();
    let timedOut = false;
    let clientAborted = false;

    const cleanupProxyListeners = () => {
      req.off('aborted', handleClientAbort);
      res.off('close', cleanupProxyListeners);
    };

    const handleClientAbort = () => {
      clientAborted = true;
      cleanupProxyListeners();
      proxyReq.destroy();
    };

    const proxyReq = this.createProxyRequest(isHttps, options, (proxyRes) => {
      cleanupProxyListeners();
      res.status(proxyRes.statusCode || 200);
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'transfer-encoding') return;
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      });
      proxyRes.pipe(res, { end: true });
    });

    req.on('aborted', handleClientAbort);
    res.on('close', cleanupProxyListeners);

    proxyReq.setTimeout(proxyTimeoutMs, () => {
      timedOut = true;
      cleanupProxyListeners();
      this.logger.warn(
        `Proxy timeout → ${serviceUrl}${targetPath} after ${proxyTimeoutMs}ms`,
      );
      proxyReq.destroy();
      if (!res.headersSent && !res.writableEnded) {
        res.status(504).json({
          message: 'Gateway timeout while contacting downstream service',
          statusCode: 504,
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });

    proxyReq.on('error', (err) => {
      cleanupProxyListeners();
      if (timedOut || clientAborted) {
        return;
      }

      this.logger.error(
        `Proxy error → ${serviceUrl}${targetPath}: ${err.message}`,
      );
      if (!res.headersSent && !res.writableEnded) {
        res.status(503).json({
          message: 'Service temporarily unavailable',
          statusCode: 503,
        });
      }
    });

    if (this.shouldStreamRequestBody(req)) {
      req.pipe(proxyReq);
      return;
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      const body = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
      proxyReq.write(body);
    }

    proxyReq.end();
  }

  private signPermissions(
    userId: string,
    tenantId: string,
    serializedPermissions: string,
  ): string {
    return createHmac('sha256', process.env.JWT_SECRET!)
      .update(`${userId}:${tenantId}:${serializedPermissions}`)
      .digest('hex');
  }

  private proxyTimeoutMs(): number {
    const configured = Number(process.env.GATEWAY_PROXY_TIMEOUT_MS);

    if (
      Number.isInteger(configured) &&
      configured > 0 &&
      configured <= MAX_PROXY_TIMEOUT_MS
    ) {
      return configured;
    }

    return DEFAULT_PROXY_TIMEOUT_MS;
  }

  private createProxyRequest(
    isHttps: boolean,
    options: http.RequestOptions,
    callback: (response: http.IncomingMessage) => void,
  ): http.ClientRequest {
    return (isHttps ? https : http).request(options, callback);
  }
}
