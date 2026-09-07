import { createHmac } from 'crypto';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TenantDocumentProfileClient } from './tenant-document-profile.client';

const SECRET = 'a-secure-internal-service-secret-of-at-least-32-characters';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PATH = `/internal/tenants/${TENANT_ID}/document-profile`;

const profile = {
  tenantId: TENANT_ID,
  displayName: 'Acme Brokers',
  legalName: 'Acme Brokers Limited',
  registrationNumber: 'CS-123',
  taxNumber: 'TIN-123',
  physicalAddress: '1 Broker Street',
  postalAddress: 'P.O. Box 1',
  phone: '+233200000000',
  email: 'broker@acme.example',
  website: 'https://acme.example',
  footerText: 'Licensed insurance broker',
  defaultCurrency: 'GHS',
  version: 3,
  isActive: true,
  defaultsApplied: false,
  authorizedSignatoryName: 'Ama Mensah',
  authorizedSignatoryTitle: 'Managing Director',
  logo: {
    mimeType: 'image/png',
    fileName: 'logo.png',
    sizeBytes: 4,
    readUrl: 'https://storage.example/logo',
    expiresAt: '2026-07-02T12:02:00.000Z',
  },
  signature: null,
  bankAccounts: [
    {
      id: 'account-1',
      bankName: 'GCB Bank',
      branchName: 'High Street',
      accountName: 'Acme Brokers Limited',
      accountNumber: '1036000007232',
      currency: 'GHS',
      swiftCode: 'GHCBGHAC',
      sortCode: null,
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TenantDocumentProfileClient', () => {
  const originalFetch = global.fetch;
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalSecret = process.env.INTERNAL_SERVICE_AUTH_SECRET;
  const originalCacheTtl =
    process.env.REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS;

  beforeEach(() => {
    process.env.AUTH_SERVICE_URL = 'http://auth-service:4001';
    process.env.INTERNAL_SERVICE_AUTH_SECRET = SECRET;
    process.env.REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS = '300';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    thisEnv('AUTH_SERVICE_URL', originalAuthUrl);
    thisEnv('INTERNAL_SERVICE_AUTH_SECRET', originalSecret);
    thisEnv('REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS', originalCacheTtl);
  });

  it('authenticates the internal request and snapshots private assets', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(
        new Response(Buffer.from('logo'), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const snapshot = await new TenantDocumentProfileClient().getSnapshot(
      TENANT_ID,
    );

    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request[0]).toBe(`http://auth-service:4001${PATH}`);
    const headers = request[1].headers as Record<string, string>;
    expect(headers['x-workphelo-service']).toBe('reinsurance-service');
    const expectedSignature = createHmac('sha256', SECRET)
      .update(
        `reinsurance-service:${headers['x-workphelo-timestamp']}:GET:${PATH}`,
      )
      .digest('hex');
    expect(headers['x-workphelo-signature']).toBe(expectedSignature);
    expect(snapshot.identity).toEqual({
      displayName: 'Acme Brokers',
      legalName: 'Acme Brokers Limited',
      registrationNumber: 'CS-123',
      taxNumber: 'TIN-123',
    });
    expect(snapshot.branding.logo?.dataUri).toBe(
      `data:image/png;base64,${Buffer.from('logo').toString('base64')}`,
    );
    expect(snapshot.banking.defaultAccounts[0].accountNumber).toBe(
      '1036000007232',
    );
    expect(JSON.stringify(snapshot)).not.toContain('storage.example');
  });

  it('caches the materialized profile for five minutes', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        ...profile,
        logo: null,
      }),
    );
    global.fetch = fetchMock as typeof fetch;
    const client = new TenantDocumentProfileClient();

    const first = await client.getSnapshot(TENANT_ID);
    const second = await client.getSnapshot(TENANT_ID);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent profile requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        ...profile,
        logo: null,
      }),
    );
    global.fetch = fetchMock as typeof fetch;
    const client = new TenantDocumentProfileClient();

    const [first, second] = await Promise.all([
      client.getSnapshot(TENANT_ID),
      client.getSnapshot(TENANT_ID),
    ]);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails clearly without creating a fallback when Auth is unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(
      new TenantDocumentProfileClient().getSnapshot(TENANT_ID),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects inactive document profiles', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ ...profile, isActive: false }));

    await expect(
      new TenantDocumentProfileClient().getSnapshot(TENANT_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a profile resolved for a different tenant', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ ...profile, tenantId: 'tenant-2' }));

    await expect(
      new TenantDocumentProfileClient().getSnapshot(TENANT_ID),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

function thisEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
