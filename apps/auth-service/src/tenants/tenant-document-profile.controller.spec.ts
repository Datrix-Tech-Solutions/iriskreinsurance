import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { TenantDocumentProfileController } from './tenant-document-profile.controller';
import { TenantDocumentProfileService } from './tenant-document-profile.service';

function requestUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ama',
    role: 'TENANT_ADMIN',
    email: 'admin@acme.example',
    permissions: [],
    moduleConfig: {},
    featureConfig: {},
    ...overrides,
  };
}

function makeController() {
  const profiles = {
    get: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    upsert: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    uploadAsset: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    listBankAccounts: jest.fn().mockResolvedValue([]),
    createBankAccount: jest.fn().mockResolvedValue({ id: 'account-1' }),
    updateBankAccount: jest.fn().mockResolvedValue({ id: 'account-1' }),
    deactivateBankAccount: jest.fn().mockResolvedValue({ id: 'account-1' }),
  };
  return {
    controller: new TenantDocumentProfileController(
      profiles as unknown as TenantDocumentProfileService,
    ),
    profiles,
  };
}

describe('TenantDocumentProfileController', () => {
  it('allows a Tenant Admin to read their own document profile', async () => {
    const { controller, profiles } = makeController();

    await controller.get('tenant-1', {
      user: requestUser(),
    } as never);

    expect(profiles.get).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects cross-tenant document profile access', () => {
    const { controller } = makeController();

    expect(() =>
      controller.get('tenant-2', {
        user: requestUser(),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('allows a Super Admin to manage any tenant', async () => {
    const { controller, profiles } = makeController();

    await controller.upsert('tenant-2', { displayName: 'Tenant Two' }, {
      user: requestUser({ role: 'SUPER_ADMIN' }),
    } as never);

    expect(profiles.upsert).toHaveBeenCalledWith('tenant-2', 'user-1', {
      displayName: 'Tenant Two',
    });
  });

  it('passes a multipart logo file to private asset storage flow', async () => {
    const { controller, profiles } = makeController();
    const file = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: 4,
      buffer: Buffer.from('logo'),
    } as Express.Multer.File;

    await controller.uploadLogo('tenant-1', file, {
      user: requestUser(),
    } as never);

    expect(profiles.uploadAsset).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'logo',
      file,
    );
  });

  it('delegates bank-account deactivation without deleting history', async () => {
    const { controller, profiles } = makeController();

    await controller.deactivateBankAccount('tenant-1', 'account-1', {
      user: requestUser(),
    } as never);

    expect(profiles.deactivateBankAccount).toHaveBeenCalledWith(
      'tenant-1',
      'account-1',
      'user-1',
    );
  });
});
