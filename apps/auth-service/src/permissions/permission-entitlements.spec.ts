import { isResourceEnabledForTenant } from './permission-entitlements';

describe('permission entitlements', () => {
  const enabledConfig = {
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
  };
  const disabledFeatureConfig = {
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: false } },
  };

  it.each([
    'operations.reinsurance.facultative-offers.create-offer',
    'operations.reinsurance.facultative-offers.edit-offer',
    'operations.reinsurance.facultative-offers.partial-edit',
    'operations.reinsurance.facultative-offers.reopen-offer',
    'operations.reinsurance.facultative-offers.force-close',
    'operations.reinsurance.facultative-offers.endorse-offer',
    'operations.reinsurance.facultative-offers.archive-offer',
    'operations.reinsurance.premiums.receive-from-cedant',
    'operations.reinsurance.premiums.disburse-to-reinsurer',
    'operations.reinsurance.premiums.reverse-payment',
    'operations.reinsurance.claims.add-claim',
    'operations.reinsurance.claims.create-notification',
    'operations.reinsurance.claims.record-recovery',
    'operations.reinsurance.claims.void-claim',
  ])('scopes %s to the Reinsurance feature entitlement', (name) => {
    const resource = { name, module: 'OPERATIONS' };

    expect(isResourceEnabledForTenant(resource, enabledConfig)).toBe(true);
    expect(isResourceEnabledForTenant(resource, disabledFeatureConfig)).toBe(
      false,
    );
  });
});
