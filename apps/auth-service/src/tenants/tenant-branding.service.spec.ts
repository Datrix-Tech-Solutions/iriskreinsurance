import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  TenantBrandingService,
  WORKPHELO_BRANDING_DEFAULTS,
} from './tenant-branding.service';
import { TenantAssetStorageService } from './tenant-asset-storage.service';

const TENANT = {
  id: 'tenant-1',
  slug: 'acme-ghana',
  name: 'Acme Ghana Ltd',
};

const BRANDING = {
  appName: 'Acme Portal',
  appLogoObjectKey: 'tenant-assets/tenants/tenant-1/branding/app-logo/logo.png',
  appLogoMimeType: 'image/png',
  appLogoFileName: 'logo.png',
  appLogoSizeBytes: 128,
  sidebarLogoObjectKey: null,
  sidebarLogoMimeType: null,
  sidebarLogoFileName: null,
  sidebarLogoSizeBytes: null,
  loginLogoObjectKey: null,
  loginLogoMimeType: null,
  loginLogoFileName: null,
  loginLogoSizeBytes: null,
  logoObjectKey: null,
  logoDisplayUrl: 'https://cdn.example.com/legacy-logo.png',
  faviconObjectKey:
    'tenant-assets/tenants/tenant-1/branding/favicon/favicon.ico',
  faviconDisplayUrl: 'https://cdn.example.com/favicon.ico',
  faviconMimeType: 'image/x-icon',
  faviconFileName: 'favicon.ico',
  faviconSizeBytes: 64,
  primaryColor: '#111111',
  secondaryColor: '#222222',
  accentColor: '#333333',
  sidebarColor: '#444444',
  emailHeaderColor: '#555555',
  documentHeaderColor: '#666666',
  themeMode: 'DARK',
  updatedByUserId: 'user-1',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-02T00:00:00.000Z'),
};

function makePrisma() {
  return {
    tenant: {
      findUnique: jest.fn(),
    },
    tenantBranding: {
      upsert: jest.fn(),
    },
  };
}

function makeStorage() {
  return {
    storeBrandingAsset: jest.fn().mockResolvedValue({
      objectKey: 'tenant-assets/tenants/tenant-1/branding/app-logo/logo.png',
      mimeType: 'image/png',
      fileName: 'logo.png',
      sizeBytes: 128,
    }),
    createSignedReadUrl: jest.fn().mockResolvedValue({
      readUrl: 'https://signed.example.com/asset',
      expiresAt: '2026-07-09T12:00:00.000Z',
    }),
  };
}

function makeAudit() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService(
  prisma = makePrisma(),
  storage = makeStorage(),
  audit = makeAudit(),
) {
  return {
    prisma,
    storage,
    audit,
    service: new TenantBrandingService(
      prisma as unknown as PrismaService,
      storage as unknown as TenantAssetStorageService,
      audit as unknown as AuditService,
    ),
  };
}

describe('TenantBrandingService', () => {
  it('returns WorkPhelo defaults when no branding exists', async () => {
    const { prisma, service, storage } = makeService();
    prisma.tenant.findUnique.mockResolvedValue({ ...TENANT, branding: null });

    const result = await service.findByTenantId('tenant-1');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      include: { branding: true },
    });
    expect(storage.createSignedReadUrl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      tenantSlug: 'acme-ghana',
      tenantName: 'Acme Ghana Ltd',
      logoObjectKey: null,
      logoDisplayUrl: null,
      ...WORKPHELO_BRANDING_DEFAULTS,
      appName: 'Acme Ghana Ltd',
      defaultsApplied: true,
    });
  });

  it('updates branding metadata and clears display URLs when object keys are present', async () => {
    const { prisma, service, audit } = makeService();
    prisma.tenant.findUnique
      .mockResolvedValueOnce({ ...TENANT, branding: null })
      .mockResolvedValueOnce({
        ...TENANT,
        branding: {
          ...BRANDING,
          appLogoObjectKey: null,
          appLogoMimeType: null,
          appLogoFileName: null,
          appLogoSizeBytes: null,
          logoObjectKey: 'tenant-branding/tenant-1/logo/v1/logo.png',
          logoDisplayUrl: null,
          faviconDisplayUrl: null,
        },
      });

    const result = await service.update(
      'tenant-1',
      {
        appName: 'Acme Portal',
        logoObjectKey: 'tenant-branding/tenant-1/logo/v1/logo.png',
        faviconObjectKey: 'tenant-branding/tenant-1/favicon/v1/favicon.ico',
        logoDisplayUrl: 'https://cdn.example.com/should-not-be-source.png',
        primaryColor: '#123456',
        themeMode: 'SYSTEM',
      },
      'user-1',
    );

    expect(prisma.tenantBranding.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      create: expect.objectContaining({
        tenantId: 'tenant-1',
        appName: 'Acme Portal',
        logoObjectKey: 'tenant-branding/tenant-1/logo/v1/logo.png',
        logoDisplayUrl: null,
        faviconObjectKey: 'tenant-branding/tenant-1/favicon/v1/favicon.ico',
        faviconDisplayUrl: null,
        primaryColor: '#123456',
        themeMode: 'SYSTEM',
        updatedByUserId: 'user-1',
      }),
      update: expect.objectContaining({
        appName: 'Acme Portal',
        logoObjectKey: 'tenant-branding/tenant-1/logo/v1/logo.png',
        logoDisplayUrl: null,
        faviconObjectKey: 'tenant-branding/tenant-1/favicon/v1/favicon.ico',
        faviconDisplayUrl: null,
        primaryColor: '#123456',
        themeMode: 'SYSTEM',
        updatedByUserId: 'user-1',
      }),
    });
    expect(audit.log).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'CREATE',
      resource: 'tenant-branding',
      resourceId: 'tenant-1',
      changes: {
        after: {
          fields: expect.arrayContaining([
            'appName',
            'logoObjectKey',
            'faviconObjectKey',
            'primaryColor',
            'themeMode',
          ]) as unknown as string[],
        },
      },
    });
    expect(result.logoObjectKey).toBeNull();
    expect(result.logoDisplayUrl).toBeNull();
  });

  it('uploads app branding assets into the branding namespace', async () => {
    const { prisma, service, storage, audit } = makeService();
    prisma.tenant.findUnique
      .mockResolvedValueOnce({ ...TENANT, branding: null })
      .mockResolvedValueOnce({ ...TENANT, branding: BRANDING });

    const result = await service.uploadAsset('tenant-1', 'user-1', 'app-logo', {
      buffer: Buffer.from('logo'),
      mimetype: 'image/png',
      originalname: 'logo.png',
    } as Express.Multer.File);

    expect(storage.storeBrandingAsset).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      tenantSlug: 'acme-ghana',
      assetType: 'app-logo',
      body: Buffer.from('logo'),
      contentType: 'image/png',
      originalFileName: 'logo.png',
    });
    expect(prisma.tenantBranding.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      create: expect.objectContaining({
        tenantId: 'tenant-1',
        appLogoObjectKey:
          'tenant-assets/tenants/tenant-1/branding/app-logo/logo.png',
        appLogoMimeType: 'image/png',
        appLogoFileName: 'logo.png',
        appLogoSizeBytes: 128,
        logoObjectKey: null,
        logoDisplayUrl: null,
        updatedByUserId: 'user-1',
      }),
      update: expect.objectContaining({
        appLogoObjectKey:
          'tenant-assets/tenants/tenant-1/branding/app-logo/logo.png',
        appLogoMimeType: 'image/png',
        appLogoFileName: 'logo.png',
        appLogoSizeBytes: 128,
        logoObjectKey: null,
        logoDisplayUrl: null,
        updatedByUserId: 'user-1',
      }),
    });
    expect(audit.log).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'CREATE',
      resource: 'tenant-branding',
      resourceId: 'tenant-1',
      changes: {
        after: {
          assetType: 'app-logo',
          mimeType: 'image/png',
          fileName: 'logo.png',
          sizeBytes: 128,
        },
      },
    });
    expect(result.appLogo.objectKey).toBeNull();
    expect(result.appLogo.readUrl).toBe('https://signed.example.com/asset');
  });

  it('rejects invalid hex colors and unsupported assets', async () => {
    const { prisma, service } = makeService();

    await expect(
      service.update('tenant-1', { primaryColor: 'blue' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);

    prisma.tenant.findUnique.mockResolvedValue({ ...TENANT, branding: null });
    await expect(
      service.uploadAsset('tenant-1', 'user-1', 'app-logo', {
        buffer: Buffer.from('svg'),
        mimetype: 'image/svg+xml',
        originalname: 'logo.svg',
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when tenant is missing', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.findByTenantId('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('public slug lookup returns safe branding without object keys or audit metadata', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue({
      ...TENANT,
      branding: BRANDING,
      documentProfile: {
        logoObjectKey: 'private/tenant-logo.png',
        signatureObjectKey: 'private/signature.png',
      },
      bankAccounts: [{ accountNumber: '1036000007232' }],
    });

    const result = await service.findPublicBySlug('acme-ghana');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { slug: 'acme-ghana' },
      include: { branding: true },
    });
    expect(result).toEqual({
      tenantSlug: 'acme-ghana',
      tenantName: 'Acme Ghana Ltd',
      appName: 'Acme Portal',
      themeMode: 'DARK',
      appLogoUrl: 'https://signed.example.com/asset',
      sidebarLogoUrl: null,
      loginLogoUrl: null,
      faviconUrl: 'https://signed.example.com/asset',
      logoDisplayUrl: 'https://signed.example.com/asset',
      faviconDisplayUrl: 'https://signed.example.com/asset',
      primaryColor: '#111111',
      secondaryColor: '#222222',
      accentColor: '#333333',
      sidebarColor: '#444444',
      emailHeaderColor: '#555555',
      documentHeaderColor: '#666666',
      defaultsApplied: false,
    });
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('logoObjectKey');
    expect(result).not.toHaveProperty('updatedByUserId');
    expect(result).not.toHaveProperty('documentProfile');
    expect(result).not.toHaveProperty('bankAccounts');
    expect(result).not.toHaveProperty('accountNumber');
  });
});
