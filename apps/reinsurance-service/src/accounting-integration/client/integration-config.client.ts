import { createHmac } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const SERVICE_NAME = 'reinsurance-service';
const DEFAULT_CACHE_TTL_SECONDS = 30;

export interface ReinsuranceAccountingIntegrationState {
  reinsuranceEnabled: boolean;
  accountingEnabled: boolean;
  integrationEnabled: boolean;
  active: boolean;
}

@Injectable()
export class ReinsuranceAccountingIntegrationConfigClient {
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: ReinsuranceAccountingIntegrationState }
  >();

  async get(tenantId: string): Promise<ReinsuranceAccountingIntegrationState> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const baseUrl = process.env.AUTH_SERVICE_URL?.trim().replace(/\/+$/, '');
    const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
    if (!baseUrl || !secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        'Tenant integration configuration is unavailable.',
      );
    }
    const path = `/internal/tenants/${encodeURIComponent(tenantId)}/integrations/reinsurance-accounting`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secret)
      .update(`${SERVICE_NAME}:${timestamp}:GET:${path}`)
      .digest('hex');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        headers: {
          accept: 'application/json',
          'x-workphelo-service': SERVICE_NAME,
          'x-workphelo-timestamp': timestamp,
          'x-workphelo-signature': signature,
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Tenant integration configuration is unavailable.',
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Tenant integration configuration is unavailable.',
      );
    }
    const value =
      (await response.json()) as ReinsuranceAccountingIntegrationState;
    if (typeof value.active !== 'boolean') {
      throw new ServiceUnavailableException(
        'Tenant integration configuration is invalid.',
      );
    }
    this.cache.set(tenantId, {
      value,
      expiresAt: Date.now() + this.cacheTtlSeconds() * 1000,
    });
    return value;
  }

  private cacheTtlSeconds(): number {
    const parsed = Number(
      process.env.REINSURANCE_ACCOUNTING_INTEGRATION_CACHE_TTL_SECONDS,
    );
    return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 300
      ? parsed
      : DEFAULT_CACHE_TTL_SECONDS;
  }
}
