import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  TenantBankAccount,
  TenantDocumentProfile,
} from '../../prisma/generated/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAssetStorageService } from './tenant-asset-storage.service';
import { TenantDocumentProfileService } from './tenant-document-profile.service';

const TENANT = {
  id: 'tenant-1',
  name: 'Acme Reinsurance Brokers',
  slug: 'acme',
  email: 'admin@acme.example',
  phone: '+233302000001',
  address: '12 Independence Avenue, Accra',
  country: 'GH',
  currency: 'GHS',
  status: 'ACTIVE',
  moduleConfig: {},
  featureConfig: {},
  logoUrl: null,
  website: 'https://www.acme.example',
  industry: 'Insurance',
  size: '10-50',
  subscriptionId: null,
  trialEndsAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const PROFILE: TenantDocumentProfile = {
  id: 'profile-1',
  tenantId: 'tenant-1',
  displayName: 'Acme Reinsurance Brokers',
  legalName: 'Acme Reinsurance Brokers Limited',
  registrationNumber: null,
  taxNumber: null,
  physicalAddress: TENANT.address,
  postalAddress: null,
  phone: TENANT.phone,
  email: TENANT.email,
  website: TENANT.website,
  footerText: null,
  defaultCurrency: 'GHS',
  logoObjectKey: null,
  logoMimeType: null,
  logoFileName: null,
  logoSizeBytes: null,
  signatureObjectKey: null,
  signatureMimeType: null,
  signatureFileName: null,
  signatureSizeBytes: null,
  authorizedSignatoryName: null,
  authorizedSignatoryTitle: null,
  isActive: true,
  version: 1,
  createdByUserId: 'user-1',
  updatedByUserId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const ACCOUNT: TenantBankAccount = {
  id: 'account-1',
  tenantId: 'tenant-1',
  bankName: 'GCB Bank PLC',
  branchName: 'High Street',
  accountName: 'Acme Reinsurance Brokers Limited',
  accountNumber: '1036000007232',
  currency: 'GHS',
  swiftCode: 'GHCBGHAC',
  sortCode: null,
  isDefault: true,
  isActive: true,
  createdByUserId: 'user-1',
  updatedByUserId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makePrisma() {
  const prisma = {
    tenant: {
      findUnique: jest.fn(),
    },
    tenantDocumentProfile: {
      upsert: jest.fn(),
    },
    tenantBankAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );
  return prisma;
}

function makeService() {
  const prisma = makePrisma();
  const storage = {
    store: jest.fn(),
    createSignedReadUrl: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new TenantDocumentProfileService(
    prisma as unknown as PrismaService,
    storage as unknown as TenantAssetStorageService,
    audit as unknown as AuditService,
  );
  return { audit, prisma, service, storage };
}

function tenantResult(
  profile: typeof PROFILE | null = null,
  bankAccounts: (typeof ACCOUNT)[] = [],
) {
  return {
    ...TENANT,
    documentProfile: profile,
    bankAccounts,
  };
}

function imageFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  const buffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  return {
    fieldname: 'file',
    originalname: 'logo.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.byteLength,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

describe('TenantDocumentProfileService', () => {
  it('returns tenant-derived defaults without creating a profile', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult());

    const result = await service.get('tenant-1');

    expect(result).toMatchObject({
      id: null,
      tenantId: 'tenant-1',
      displayName: TENANT.name,
      legalName: TENANT.name,
      physicalAddress: TENANT.address,
      phone: TENANT.phone,
      email: TENANT.email,
      website: TENANT.website,
      defaultCurrency: 'GHS',
      version: 0,
      defaultsApplied: true,
      bankAccounts: [],
    });
    expect(prisma.tenantDocumentProfile.upsert).not.toHaveBeenCalled();
  });

  it('returns service-safe defaults without requiring asset storage', async () => {
    const { prisma, service, storage } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult());

    const result = await service.getInternalResolved('tenant-1');

    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      displayName: TENANT.name,
      legalName: TENANT.name,
      version: 0,
      defaultsApplied: true,
      logo: null,
      signature: null,
      bankAccounts: [],
    });
    expect(result).not.toHaveProperty('logoObjectKey');
    expect(result).not.toHaveProperty('createdByUserId');
    expect(storage.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('returns signed asset metadata without exposing object keys', async () => {
    const { prisma, service, storage } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(
      tenantResult({
        ...PROFILE,
        logoObjectKey: 'tenant-assets/tenant-1/logo.png',
        logoMimeType: 'image/png',
        logoFileName: 'logo.png',
        logoSizeBytes: 1024,
        signatureObjectKey: 'tenant-assets/tenant-1/signature.png',
        signatureMimeType: 'image/png',
        signatureFileName: 'signature.png',
        signatureSizeBytes: 512,
      }),
    );
    storage.createSignedReadUrl
      .mockResolvedValueOnce({
        readUrl: 'https://storage.example/logo-signed',
        expiresAt: '2026-07-02T10:02:00.000Z',
      })
      .mockResolvedValueOnce({
        readUrl: 'https://storage.example/signature-signed',
        expiresAt: '2026-07-02T10:02:00.000Z',
      });

    const result = await service.getInternalResolved('tenant-1');

    expect(storage.createSignedReadUrl).toHaveBeenNthCalledWith(1, {
      objectKey: 'tenant-assets/tenant-1/logo.png',
      mimeType: 'image/png',
      fileName: 'logo.png',
    });
    expect(result.logo).toEqual({
      mimeType: 'image/png',
      fileName: 'logo.png',
      sizeBytes: 1024,
      readUrl: 'https://storage.example/logo-signed',
      expiresAt: '2026-07-02T10:02:00.000Z',
    });
    expect(result.signature?.readUrl).toBe(
      'https://storage.example/signature-signed',
    );
    expect(result).not.toHaveProperty('logoObjectKey');
    expect(result).not.toHaveProperty('signatureObjectKey');
  });

  it('returns only active default bank accounts for document rendering', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(
      tenantResult(PROFILE, [
        ACCOUNT,
        {
          ...ACCOUNT,
          id: 'inactive-default',
          currency: 'USD',
          isActive: false,
        },
        {
          ...ACCOUNT,
          id: 'active-non-default',
          currency: 'EUR',
          isDefault: false,
        },
        {
          ...ACCOUNT,
          id: 'other-tenant-default',
          tenantId: 'tenant-2',
          currency: 'USD',
        },
      ]),
    );

    const result = await service.getInternalResolved('tenant-1');

    expect(result.bankAccounts).toEqual([
      {
        id: ACCOUNT.id,
        bankName: ACCOUNT.bankName,
        branchName: ACCOUNT.branchName,
        accountName: ACCOUNT.accountName,
        accountNumber: ACCOUNT.accountNumber,
        currency: ACCOUNT.currency,
        swiftCode: ACCOUNT.swiftCode,
        sortCode: ACCOUNT.sortCode,
      },
    ]);
  });

  it('rejects a missing tenant through the internal contract', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.getInternalResolved('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('upserts a profile and increments its version on update', async () => {
    const { audit, prisma, service } = makeService();
    prisma.tenant.findUnique
      .mockResolvedValueOnce(tenantResult(PROFILE))
      .mockResolvedValueOnce(
        tenantResult({ ...PROFILE, version: 2, footerText: 'Broker footer' }),
      );

    const result = await service.upsert('tenant-1', 'user-1', {
      footerText: ' Broker footer ',
      defaultCurrency: 'USD',
    });

    expect(prisma.tenantDocumentProfile.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      create: expect.any(Object) as Record<string, unknown>,
      update: expect.objectContaining({
        footerText: 'Broker footer',
        defaultCurrency: 'USD',
        version: { increment: 1 },
        updatedByUserId: 'user-1',
      }) as Record<string, unknown>,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        action: 'UPDATE',
        resource: 'tenant-document-profile',
      }),
    );
    expect(result.version).toBe(2);
  });

  it('uploads a private logo and stores only object metadata', async () => {
    const { prisma, service, storage } = makeService();
    prisma.tenant.findUnique
      .mockResolvedValueOnce(tenantResult())
      .mockResolvedValueOnce(
        tenantResult({
          ...PROFILE,
          logoObjectKey:
            'tenant-assets/tenants/tenant-1/document-profile/logo/id-logo.png',
          logoMimeType: 'image/png',
          logoFileName: 'logo.png',
          logoSizeBytes: 5,
        }),
      );
    storage.store.mockResolvedValue({
      objectKey:
        'tenant-assets/tenants/tenant-1/document-profile/logo/id-logo.png',
      mimeType: 'image/png',
      fileName: 'logo.png',
      sizeBytes: 5,
    });

    const result = await service.uploadAsset(
      'tenant-1',
      'user-1',
      'logo',
      imageFile(),
    );

    expect(storage.store).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        tenantSlug: 'acme',
        assetType: 'logo',
        contentType: 'image/png',
      }),
    );
    expect(prisma.tenantDocumentProfile.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      create: expect.objectContaining({
        logoObjectKey: expect.stringContaining('/logo/') as string,
        logoMimeType: 'image/png',
      }) as Record<string, unknown>,
      update: expect.objectContaining({
        logoObjectKey: expect.stringContaining('/logo/') as string,
        version: { increment: 1 },
      }) as Record<string, unknown>,
    });
    expect(result.logoObjectKey).toContain('/logo/');
    expect(result).not.toHaveProperty('logoUrl');
  });

  it('rejects unsupported image types before storage', async () => {
    const { prisma, service, storage } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult());

    await expect(
      service.uploadAsset(
        'tenant-1',
        'user-1',
        'logo',
        imageFile({ mimetype: 'image/svg+xml' }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storage.store).not.toHaveBeenCalled();
  });

  it('rejects spoofed image content before storage', async () => {
    const { prisma, service, storage } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult());

    await expect(
      service.uploadAsset(
        'tenant-1',
        'user-1',
        'logo',
        imageFile({ buffer: Buffer.from('not-a-png'), size: 9 }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storage.store).not.toHaveBeenCalled();
  });

  it('atomically replaces the active default bank account per currency', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult(PROFILE));
    prisma.tenantBankAccount.create.mockResolvedValue(ACCOUNT);
    prisma.tenantBankAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.tenantDocumentProfile.upsert.mockResolvedValue({
      ...PROFILE,
      version: 2,
    });

    const result = await service.createBankAccount('tenant-1', 'user-1', {
      bankName: ACCOUNT.bankName,
      accountName: ACCOUNT.accountName,
      accountNumber: ACCOUNT.accountNumber,
      currency: 'GHS',
      isDefault: true,
    });

    expect(prisma.tenantBankAccount.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        currency: 'GHS',
        isDefault: true,
        isActive: true,
      },
      data: { isDefault: false, updatedByUserId: 'user-1' },
    });
    expect(prisma.tenantDocumentProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          version: { increment: 1 },
        }) as Record<string, unknown>,
      }) as Record<string, unknown>,
    );
    expect(result).toEqual(ACCOUNT);
  });

  it('does not allow an inactive account to be the default', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult());

    await expect(
      service.createBankAccount('tenant-1', 'user-1', {
        bankName: ACCOUNT.bankName,
        accountName: ACCOUNT.accountName,
        accountNumber: ACCOUNT.accountNumber,
        currency: 'GHS',
        isDefault: true,
        isActive: false,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported document currencies', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult());

    await expect(
      service.createBankAccount('tenant-1', 'user-1', {
        bankName: ACCOUNT.bankName,
        accountName: ACCOUNT.accountName,
        accountNumber: ACCOUNT.accountNumber,
        currency: 'BTC',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a bank account from another tenant', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(tenantResult());
    prisma.tenantBankAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.updateBankAccount('tenant-1', 'account-other-tenant', 'user-1', {
        bankName: 'Updated Bank',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
