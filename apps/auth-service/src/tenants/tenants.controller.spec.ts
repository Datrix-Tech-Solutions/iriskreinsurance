import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { TenantsController } from './tenants.controller';

function makeController() {
  const lifecycle = {};
  const config = {};
  const admin = {};
  const branding = {
    findByTenantId: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    findPublicBySlug: jest.fn().mockResolvedValue({ tenantSlug: 'acme-ghana' }),
    update: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    uploadAsset: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  };

  return {
    branding,
    controller: new TenantsController(
      lifecycle as never,
      config as never,
      admin as never,
      branding as never,
    ),
  };
}

function requestUser(overrides: Partial<RequestUser> = {}) {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    role: 'TENANT_ADMIN',
    email: 'admin@acmeghana.com',
    permissions: [],
    ...overrides,
  } as RequestUser;
}

describe('TenantsController branding access', () => {
  it('allows tenant admin to read own tenant branding', async () => {
    const { branding, controller } = makeController();
    const req = { user: requestUser() };

    await controller.getBranding('tenant-1', req as never);

    expect(branding.findByTenantId).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects tenant admin reading another tenant branding', () => {
    const { controller } = makeController();
    const req = { user: requestUser() };

    expect(() => controller.getBranding('tenant-2', req as never)).toThrow(
      ForbiddenException,
    );
  });

  it('allows super admin to update any tenant branding', async () => {
    const { branding, controller } = makeController();
    const req = { user: requestUser({ role: 'SUPER_ADMIN' }) };

    await controller.updateBranding(
      'tenant-2',
      { primaryColor: '#0D2244' },
      req as never,
    );

    expect(branding.update).toHaveBeenCalledWith(
      'tenant-2',
      { primaryColor: '#0D2244' },
      'user-1',
    );
  });

  it('allows tenant admin to manage own branding through self-service route', async () => {
    const { branding, controller } = makeController();
    const req = { user: requestUser() };

    await controller.updateOwnBranding(
      { appName: 'Acme Portal', themeMode: 'LIGHT' },
      req as never,
    );

    expect(branding.update).toHaveBeenCalledWith(
      'tenant-1',
      { appName: 'Acme Portal', themeMode: 'LIGHT' },
      'user-1',
    );
  });

  it('allows tenant admin to upload own branding asset through self-service route', async () => {
    const { branding, controller } = makeController();
    const req = { user: requestUser() };
    const file = {
      buffer: Buffer.from('logo'),
      mimetype: 'image/png',
      originalname: 'logo.png',
    } as Express.Multer.File;

    await controller.uploadOwnBrandingAsset('app-logo', file, req as never);

    expect(branding.uploadAsset).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'app-logo',
      file,
    );
  });

  it('allows super admin to upload branding assets for any tenant', async () => {
    const { branding, controller } = makeController();
    const req = { user: requestUser({ role: 'SUPER_ADMIN' }) };
    const file = {
      buffer: Buffer.from('logo'),
      mimetype: 'image/png',
      originalname: 'logo.png',
    } as Express.Multer.File;

    await controller.uploadBrandingAsset(
      'tenant-2',
      'login-logo',
      file,
      req as never,
    );

    expect(branding.uploadAsset).toHaveBeenCalledWith(
      'tenant-2',
      'user-1',
      'login-logo',
      file,
    );
  });

  it('delegates public slug branding lookup without auth metadata', async () => {
    const { branding, controller } = makeController();

    await controller.getPublicBrandingBySlug('acme-ghana');

    expect(branding.findPublicBySlug).toHaveBeenCalledWith('acme-ghana');
  });
});
