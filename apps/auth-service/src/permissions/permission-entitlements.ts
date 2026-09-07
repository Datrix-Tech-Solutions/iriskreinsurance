export type TenantModuleConfig = Record<string, boolean>;
export type TenantFeatureConfig = Record<string, Record<string, boolean>>;

export type PermissionResourceLike = {
  name: string;
  module: string;
};

export type PermissionResourceWithId = PermissionResourceLike & {
  id?: string;
};

export type TenantEntitlementConfig = {
  moduleConfig?: TenantModuleConfig | null;
  featureConfig?: TenantFeatureConfig | null;
};

type ResourceEntitlement = {
  moduleKey: string;
  featurePath?: readonly [string, string];
};

const ALWAYS_ENABLED_MODULES = new Set(['AUTH']);

const RESOURCE_ENTITLEMENTS: Record<string, ResourceEntitlement> = {
  'operations.reinsurance.dashboard': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.accounting-operations': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.placements': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.facultative-offers.create-offer': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.facultative-offers.edit-offer': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.facultative-offers.partial-edit': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.facultative-offers.reopen-offer': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.facultative-offers.force-close': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.facultative-offers.endorse-offer': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.facultative-offers.archive-offer': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.premiums.receive-from-cedant': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.premiums.disburse-to-reinsurer': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.premiums.reverse-payment': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.counterparties': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.claims': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.claims.add-claim': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.claims.create-notification': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.claims.record-recovery': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.claims.void-claim': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.email': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.email-settings': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.reports': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.settings': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
  'operations.reinsurance.taxes-levies': {
    moduleKey: 'operations',
    featurePath: ['operations', 'reinsurance'],
  },
};

function moduleKeyForResource(resource: PermissionResourceLike): string {
  const explicit = RESOURCE_ENTITLEMENTS[resource.name]?.moduleKey;
  if (explicit) return explicit;
  return resource.module.toLowerCase();
}

export function isTenantAdminManagedResource(
  resource: PermissionResourceLike,
): boolean {
  return ALWAYS_ENABLED_MODULES.has(resource.module);
}

export function isResourceEnabledForTenant(
  resource: PermissionResourceLike,
  config: TenantEntitlementConfig,
): boolean {
  if (ALWAYS_ENABLED_MODULES.has(resource.module)) return true;

  const moduleKey = moduleKeyForResource(resource);
  const moduleEnabled = config.moduleConfig?.[moduleKey] === true;
  if (!moduleEnabled) return false;

  const featurePath = RESOURCE_ENTITLEMENTS[resource.name]?.featurePath;
  if (!featurePath) return true;

  const [featureModule, featureKey] = featurePath;
  return config.featureConfig?.[featureModule]?.[featureKey] === true;
}
