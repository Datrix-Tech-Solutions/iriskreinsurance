import { createHmac } from 'crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

const SERVICE_NAME = 'reinsurance-service';
const DEFAULT_CACHE_TTL_SECONDS = 300;
const MAX_CACHE_TTL_SECONDS = 600;
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const SIGNATURE_MAX_BYTES = 1024 * 1024;

type NullableString = string | null;

export interface TenantDocumentAssetSnapshot {
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  dataUri: string;
}

export interface TenantDocumentBankAccountSnapshot {
  id: string;
  bankName: string;
  branchName: NullableString;
  accountName: string;
  accountNumber: string;
  currency: string;
  swiftCode: NullableString;
  sortCode: NullableString;
}

export interface TenantDocumentProfileSnapshot {
  tenantId: string;
  identity: {
    displayName: string;
    legalName: string;
    registrationNumber: NullableString;
    taxNumber: NullableString;
  };
  contact: {
    physicalAddress: NullableString;
    postalAddress: NullableString;
    phone: NullableString;
    email: NullableString;
    website: NullableString;
  };
  footer: {
    text: NullableString;
  };
  branding: {
    logo: TenantDocumentAssetSnapshot | null;
    signature: TenantDocumentAssetSnapshot | null;
    colors: Record<string, string> | null;
    version: number;
  };
  banking: {
    defaultCurrency: string;
    defaultAccounts: TenantDocumentBankAccountSnapshot[];
  };
  signatory: {
    name: NullableString;
    title: NullableString;
  };
  profileActive: boolean;
  defaultsApplied: boolean;
}

type InternalAssetResponse = {
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  readUrl: string;
  expiresAt: string;
};

type InternalProfileResponse = {
  tenantId: string;
  displayName: string;
  legalName: string;
  registrationNumber: NullableString;
  taxNumber: NullableString;
  physicalAddress: NullableString;
  postalAddress: NullableString;
  phone: NullableString;
  email: NullableString;
  website: NullableString;
  footerText: NullableString;
  defaultCurrency: string;
  version: number;
  isActive: boolean;
  defaultsApplied: boolean;
  authorizedSignatoryName: NullableString;
  authorizedSignatoryTitle: NullableString;
  logo: InternalAssetResponse | null;
  signature: InternalAssetResponse | null;
  bankAccounts: TenantDocumentBankAccountSnapshot[];
  brandingColors?: Record<string, string> | null;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: TenantDocumentProfileSnapshot;
};

@Injectable()
export class TenantDocumentProfileClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<TenantDocumentProfileSnapshot>
  >();

  async getSnapshot(tenantId: string): Promise<TenantDocumentProfileSnapshot> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.snapshot;
    if (cached) this.cache.delete(tenantId);

    const inFlight = this.inFlight.get(tenantId);
    if (inFlight) return inFlight;

    const request = this.loadSnapshot(tenantId);
    this.inFlight.set(tenantId, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(tenantId);
    }
  }

  private async loadSnapshot(
    tenantId: string,
  ): Promise<TenantDocumentProfileSnapshot> {
    const profile = await this.fetchProfile(tenantId);
    const [logo, signature] = await Promise.all([
      this.materializeAsset(profile.logo, 'logo'),
      this.materializeAsset(profile.signature, 'signature'),
    ]);
    const snapshot = this.toSnapshot(profile, logo, signature);

    this.cache.set(tenantId, {
      expiresAt: Date.now() + this.cacheTtlSeconds() * 1000,
      snapshot,
    });
    return snapshot;
  }

  private async fetchProfile(
    tenantId: string,
  ): Promise<InternalProfileResponse> {
    const baseUrl = process.env.AUTH_SERVICE_URL?.trim().replace(/\/+$/, '');
    const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
    if (!baseUrl || !secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        'Tenant document profile service is not configured; document was not generated.',
      );
    }

    const path = `/internal/tenants/${encodeURIComponent(tenantId)}/document-profile`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secret)
      .update(`${SERVICE_NAME}:${timestamp}:GET:${path}`)
      .digest('hex');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-workphelo-service': SERVICE_NAME,
          'x-workphelo-timestamp': timestamp,
          'x-workphelo-signature': signature,
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs()),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Tenant document profile is unavailable; document was not generated.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Tenant document profile is unavailable (${response.status}); document was not generated.`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'Tenant document profile returned an invalid response; document was not generated.',
      );
    }
    return this.parseProfile(body, tenantId);
  }

  private parseProfile(
    value: unknown,
    expectedTenantId: string,
  ): InternalProfileResponse {
    const profile = this.record(value);
    if (
      !profile ||
      profile.tenantId !== expectedTenantId ||
      !this.nonEmptyString(profile.displayName) ||
      !this.nonEmptyString(profile.legalName) ||
      !this.nonEmptyString(profile.defaultCurrency) ||
      typeof profile.version !== 'number' ||
      !Number.isSafeInteger(profile.version) ||
      typeof profile.isActive !== 'boolean' ||
      typeof profile.defaultsApplied !== 'boolean' ||
      !Array.isArray(profile.bankAccounts)
    ) {
      throw new ServiceUnavailableException(
        'Tenant document profile returned an invalid response; document was not generated.',
      );
    }
    if (!profile.isActive) {
      throw new BadRequestException(
        'Tenant document profile is inactive; document was not generated.',
      );
    }

    return {
      tenantId: expectedTenantId,
      displayName: profile.displayName,
      legalName: profile.legalName,
      registrationNumber: this.nullableString(profile.registrationNumber),
      taxNumber: this.nullableString(profile.taxNumber),
      physicalAddress: this.nullableString(profile.physicalAddress),
      postalAddress: this.nullableString(profile.postalAddress),
      phone: this.nullableString(profile.phone),
      email: this.nullableString(profile.email),
      website: this.nullableString(profile.website),
      footerText: this.nullableString(profile.footerText),
      defaultCurrency: profile.defaultCurrency,
      version: profile.version,
      isActive: profile.isActive,
      defaultsApplied: profile.defaultsApplied,
      authorizedSignatoryName: this.nullableString(
        profile.authorizedSignatoryName,
      ),
      authorizedSignatoryTitle: this.nullableString(
        profile.authorizedSignatoryTitle,
      ),
      logo: this.parseAsset(profile.logo),
      signature: this.parseAsset(profile.signature),
      bankAccounts: profile.bankAccounts.map((account) =>
        this.parseBankAccount(account),
      ),
      brandingColors: this.parseColors(profile.brandingColors),
    };
  }

  private async materializeAsset(
    asset: InternalAssetResponse | null,
    label: 'logo' | 'signature',
  ): Promise<TenantDocumentAssetSnapshot | null> {
    if (!asset) return null;
    const maxBytes = label === 'logo' ? LOGO_MAX_BYTES : SIGNATURE_MAX_BYTES;
    if (asset.sizeBytes > maxBytes) {
      throw new BadRequestException(
        `Tenant document ${label} exceeds the supported size; document was not generated.`,
      );
    }

    let response: Response;
    try {
      response = await fetch(asset.readUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.requestTimeoutMs()),
      });
    } catch {
      throw new ServiceUnavailableException(
        `Tenant document ${label} is unavailable; document was not generated.`,
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Tenant document ${label} is unavailable (${response.status}); document was not generated.`,
      );
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > maxBytes) {
      throw new BadRequestException(
        `Tenant document ${label} is invalid; document was not generated.`,
      );
    }
    const responseMimeType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      asset.mimeType;
    if (
      !responseMimeType.startsWith('image/') ||
      responseMimeType !== asset.mimeType
    ) {
      throw new BadRequestException(
        `Tenant document ${label} has an invalid content type; document was not generated.`,
      );
    }

    return {
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      sizeBytes: body.byteLength,
      dataUri: `data:${asset.mimeType};base64,${body.toString('base64')}`,
    };
  }

  private toSnapshot(
    profile: InternalProfileResponse,
    logo: TenantDocumentAssetSnapshot | null,
    signature: TenantDocumentAssetSnapshot | null,
  ): TenantDocumentProfileSnapshot {
    return {
      tenantId: profile.tenantId,
      identity: {
        displayName: profile.displayName,
        legalName: profile.legalName,
        registrationNumber: profile.registrationNumber,
        taxNumber: profile.taxNumber,
      },
      contact: {
        physicalAddress: profile.physicalAddress,
        postalAddress: profile.postalAddress,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
      },
      footer: { text: profile.footerText },
      branding: {
        logo,
        signature,
        colors: profile.brandingColors ?? null,
        version: profile.version,
      },
      banking: {
        defaultCurrency: profile.defaultCurrency,
        defaultAccounts: profile.bankAccounts,
      },
      signatory: {
        name: profile.authorizedSignatoryName,
        title: profile.authorizedSignatoryTitle,
      },
      profileActive: profile.isActive,
      defaultsApplied: profile.defaultsApplied,
    };
  }

  private parseAsset(value: unknown): InternalAssetResponse | null {
    if (value === null || value === undefined) return null;
    const asset = this.record(value);
    if (
      !asset ||
      !this.nonEmptyString(asset.mimeType) ||
      !this.nonEmptyString(asset.fileName) ||
      !Number.isSafeInteger(asset.sizeBytes) ||
      Number(asset.sizeBytes) <= 0 ||
      !this.nonEmptyString(asset.readUrl) ||
      !this.nonEmptyString(asset.expiresAt)
    ) {
      throw new ServiceUnavailableException(
        'Tenant document profile contains invalid asset metadata; document was not generated.',
      );
    }
    return {
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      sizeBytes: Number(asset.sizeBytes),
      readUrl: asset.readUrl,
      expiresAt: asset.expiresAt,
    };
  }

  private parseBankAccount(value: unknown): TenantDocumentBankAccountSnapshot {
    const account = this.record(value);
    if (
      !account ||
      !this.nonEmptyString(account.id) ||
      !this.nonEmptyString(account.bankName) ||
      !this.nonEmptyString(account.accountName) ||
      !this.nonEmptyString(account.accountNumber) ||
      !this.nonEmptyString(account.currency)
    ) {
      throw new ServiceUnavailableException(
        'Tenant document profile contains invalid bank account data; document was not generated.',
      );
    }
    return {
      id: account.id,
      bankName: account.bankName,
      branchName: this.nullableString(account.branchName),
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      currency: account.currency,
      swiftCode: this.nullableString(account.swiftCode),
      sortCode: this.nullableString(account.sortCode),
    };
  }

  private parseColors(value: unknown): Record<string, string> | null {
    if (value === null || value === undefined) return null;
    const colors = this.record(value);
    if (!colors) return null;
    return Object.entries(colors).reduce<Record<string, string>>(
      (result, [key, color]) => {
        if (typeof color === 'string' && /^#[\dA-F]{6}$/i.test(color)) {
          result[key] = color;
        }
        return result;
      },
      {},
    );
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  }

  private nonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private nullableString(value: unknown): NullableString {
    return this.nonEmptyString(value) ? value : null;
  }

  private cacheTtlSeconds(): number {
    const parsed = Number(
      process.env.REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS,
    );
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return DEFAULT_CACHE_TTL_SECONDS;
    }
    return Math.min(parsed, MAX_CACHE_TTL_SECONDS);
  }

  private requestTimeoutMs(): number {
    const parsed = Number(process.env.REINSURANCE_TENANT_PROFILE_TIMEOUT_MS);
    return Number.isSafeInteger(parsed) && parsed > 0
      ? parsed
      : DEFAULT_REQUEST_TIMEOUT_MS;
  }
}
