import { TenantDocumentProfileInternalController } from './tenant-document-profile-internal.controller';
import { TenantDocumentProfileService } from './tenant-document-profile.service';

describe('TenantDocumentProfileInternalController', () => {
  it('delegates resolved profile lookup without accepting a tenant from the body', async () => {
    const response = {
      tenantId: 'tenant-1',
      displayName: 'Acme',
      bankAccounts: [],
    };
    const profiles = {
      getInternalResolved: jest.fn().mockResolvedValue(response),
    };
    const controller = new TenantDocumentProfileInternalController(
      profiles as unknown as TenantDocumentProfileService,
    );

    await expect(controller.get('tenant-1')).resolves.toBe(response);
    expect(profiles.getInternalResolved).toHaveBeenCalledWith('tenant-1');
  });
});
