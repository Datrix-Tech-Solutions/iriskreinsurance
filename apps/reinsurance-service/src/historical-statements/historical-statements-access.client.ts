import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'node:http';
import * as https from 'node:https';

export interface HistoricalStatementsAccess {
  tenantId: string;
  userId: string;
  enabled: boolean;
  canView: boolean;
  canExport: boolean;
  canImport?: boolean;
}

export const HISTORICAL_ACCESS_TIMEOUT_MS = 2000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const ACCESS_PATH = '/tenants/me/historical-statements-access';

function isAccess(value: unknown): value is HistoricalStatementsAccess {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.tenantId === 'string' &&
    record.tenantId.length > 0 &&
    typeof record.userId === 'string' &&
    record.userId.length > 0 &&
    typeof record.enabled === 'boolean' &&
    typeof record.canView === 'boolean' &&
    typeof record.canExport === 'boolean' &&
    (record.canImport === undefined || typeof record.canImport === 'boolean')
  );
}

@Injectable()
export class HistoricalStatementsAccessClient {
  constructor(private readonly config: ConfigService) {}

  async getAccess(token: string): Promise<HistoricalStatementsAccess> {
    // Resolve lazily: deployments without the archive configuration still boot.
    const configured = this.config.get<unknown>('AUTH_SERVICE_URL');
    let url: URL;
    try {
      if (typeof configured !== 'string' || !configured.trim())
        throw new Error();
      const base = new URL(configured);
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        base.pathname !== '/'
      )
        throw new Error();
      url = new URL(ACCESS_PATH, base);
    } catch {
      throw new ServiceUnavailableException('Archive access is unavailable');
    }

    return new Promise((resolve, reject) => {
      const unavailable = () =>
        new ServiceUnavailableException('Archive access is unavailable');
      let settled = false;
      const finish = (error?: Error, access?: HistoricalStatementsAccess) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (error) reject(error);
        else if (access) resolve(access);
      };
      // This deadline bounds DNS, connection and the entire body, including trickles.
      const deadline = setTimeout(() => {
        finish(unavailable());
        request?.destroy();
      }, HISTORICAL_ACCESS_TIMEOUT_MS);
      const transport = url.protocol === 'https:' ? https : http;
      let request: http.ClientRequest | undefined;
      try {
        request = transport.request(
          url,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            agent: false,
          },
          (response) => {
            if (response.statusCode !== 200) {
              const error =
                response.statusCode === 401
                  ? new UnauthorizedException(
                      'Inactive or invalid archive session',
                    )
                  : response.statusCode === 403
                    ? new ForbiddenException('ARCHIVE_PERMISSION_DENIED')
                    : unavailable();
              finish(error);
              response.destroy();
              return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            response.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > MAX_RESPONSE_BYTES) {
                finish(unavailable());
                response.destroy();
              } else {
                chunks.push(chunk);
              }
            });
            response.on('end', () => {
              try {
                const value: unknown = JSON.parse(
                  Buffer.concat(chunks).toString('utf8'),
                );
                if (!isAccess(value)) throw new Error();
                finish(undefined, value);
              } catch {
                finish(unavailable());
              }
            });
            response.on('error', () => finish(unavailable()));
            response.on('aborted', () => finish(unavailable()));
          },
        );
        request.on('error', () => finish(unavailable()));
        request.end();
      } catch {
        finish(unavailable());
      }
    });
  }
}
