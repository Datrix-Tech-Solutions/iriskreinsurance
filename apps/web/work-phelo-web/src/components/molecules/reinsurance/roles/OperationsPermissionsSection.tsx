'use client';

import { cn } from '@/lib/utils';
import type { PermissionAction, PermissionSetResourceDto } from '@/types/roles';

interface PermissionTag {
  key: string;
  label: string;
}

interface PermissionTagGroup {
  group: string;
  tags: PermissionTag[];
}

export const OPERATIONS_PERMISSION_TAG_GROUPS: PermissionTagGroup[] = [
  {
    group: 'Offer Management',
    tags: [
      { key: 'create_offer', label: 'Create offer' },
      { key: 'edit_offer', label: 'Edit Offer' },
      { key: 'partial_edit', label: 'Partial Edit' },
      { key: 'reopen_offer', label: 'Reopen Offer' },
      { key: 'force_close', label: 'Force Close' },
      { key: 'endorse_offer', label: 'Endorse offer' },
      { key: 'archive_offer', label: 'Archive offer' },
      { key: 'renew_offer', label: 'Renew offer' },
    ],
  },
  {
    group: 'Premiums and Payment Management',
    tags: [
      { key: 'add_payments', label: 'Add payments' },
      { key: 'disburse_payment', label: 'Disburse payment' },
      { key: 'reverse_payments', label: 'Reverse payments' },
    ],
  },
  {
    group: 'Claims Management',
    tags: [
      { key: 'add_claims', label: 'Add claims' },
      { key: 'create_notifications', label: 'Create notifications' },
      { key: 'record_recovery', label: 'Record recovery' },
      { key: 'delete_claim', label: 'Delete claim' },
    ],
  },
  {
    group: 'Client Management',
    tags: [{ key: 'manage_clients', label: 'Manage clients' }],
  },
  {
    group: 'Risk Settings',
    tags: [{ key: 'manage_risk_settings', label: 'Manage risk settings' }],
  },
];

const CLAIMS = 'operations.reinsurance.claims';
const COUNTERPARTIES = 'operations.reinsurance.counterparties';
const SETTINGS = 'operations.reinsurance.settings';

// Granular reinsurance workflow resources (auth-service seed-resources.ts).
// Every workflow endpoint is gated with @RequireAnyPermission(<granular>:RUN, <coarse>),
// so granting the granular RUN permission is enough on its own.
const FAC = 'operations.reinsurance.facultative-offers';
const PREMIUMS = 'operations.reinsurance.premiums';

export const OPERATIONS_BASE_RESOURCES: Array<{ resource: string; action: string }> = [
  { resource: 'operations.reinsurance.dashboard', action: 'VIEW' },
  { resource: 'operations.reinsurance.placements', action: 'VIEW' },
  { resource: 'operations.reinsurance.counterparties', action: 'VIEW' },
  { resource: 'operations.reinsurance.email', action: 'VIEW' },
  { resource: 'operations.reinsurance.email-settings', action: 'VIEW' },
  { resource: 'operations.reinsurance.reports', action: 'VIEW' },
  { resource: 'operations.reinsurance.settings', action: 'VIEW' },
  { resource: 'operations.reinsurance.taxes-levies', action: 'VIEW' },
];

// null = UI-only tag, not yet linked to backend permissions.
export const OPERATIONS_PERMISSION_TAG_MAPPING: Record<
  string,
  Array<{ resource: string; action: string }> | null
> = {
  // Offer Management — each pill grants its granular facultative-offers workflow
  // resource (RUN action). create/renew share the create-offer resource because
  // a renewal is a new offer on the backend.
  create_offer: [{ resource: `${FAC}.create-offer`, action: 'RUN' }],
  edit_offer: [{ resource: `${FAC}.edit-offer`, action: 'RUN' }],
  partial_edit: [{ resource: `${FAC}.partial-edit`, action: 'RUN' }],
  reopen_offer: [{ resource: `${FAC}.reopen-offer`, action: 'RUN' }],
  force_close: [{ resource: `${FAC}.force-close`, action: 'RUN' }],
  endorse_offer: [{ resource: `${FAC}.endorse-offer`, action: 'RUN' }],
  archive_offer: [{ resource: `${FAC}.archive-offer`, action: 'RUN' }],
  renew_offer: [{ resource: `${FAC}.create-offer`, action: 'RUN' }],

  // Premiums and Payment Management
  add_payments: [{ resource: `${PREMIUMS}.receive-from-cedant`, action: 'RUN' }],
  disburse_payment: [{ resource: `${PREMIUMS}.disburse-to-reinsurer`, action: 'RUN' }],
  reverse_payments: [{ resource: `${PREMIUMS}.reverse-payment`, action: 'RUN' }],

  // Claims Management — each pill grants its granular claims workflow resource
  // (RUN), plus claims:VIEW so the role can open the lists the actions live on.
  add_claims: [
    { resource: CLAIMS, action: 'VIEW' },
    { resource: `${CLAIMS}.add-claim`, action: 'RUN' },
  ],
  create_notifications: [
    { resource: CLAIMS, action: 'VIEW' },
    { resource: `${CLAIMS}.create-notification`, action: 'RUN' },
  ],
  record_recovery: [
    { resource: CLAIMS, action: 'VIEW' },
    { resource: `${CLAIMS}.record-recovery`, action: 'RUN' },
  ],
  delete_claim: [
    { resource: CLAIMS, action: 'VIEW' },
    { resource: `${CLAIMS}.void-claim`, action: 'RUN' },
  ],

  // Client Management — cedants, reinsurers and brokers (counterparties + contacts)
  manage_clients: [
    { resource: COUNTERPARTIES, action: 'VIEW' },
    { resource: COUNTERPARTIES, action: 'CREATE' },
    { resource: COUNTERPARTIES, action: 'EDIT' },
    { resource: COUNTERPARTIES, action: 'DELETE' },
  ],

  // Settings
  manage_risk_settings: [
    { resource: SETTINGS, action: 'VIEW' },
    { resource: SETTINGS, action: 'EDIT' },
  ],
};

/**
 * Build the resources DTO from selected operations tags, always appending
 * OPERATIONS_BASE_RESOURCES (module entry + read access across the module).
 */
export function buildOperationsPermissionResources(
  selectedTags: string[],
  resourceIdMap: Map<string, string>,
): PermissionSetResourceDto[] {
  const seen = new Set<string>();
  const dtos: PermissionSetResourceDto[] = [];

  const add = (resource: string, action: string) => {
    const resourceId = resourceIdMap.get(resource);
    if (!resourceId) return;
    const key = `${resourceId}:${action}`;
    if (seen.has(key)) return;
    seen.add(key);
    dtos.push({ resourceId, action: action as PermissionAction });
  };

  for (const tag of selectedTags) {
    const perms = OPERATIONS_PERMISSION_TAG_MAPPING[tag];
    if (!perms) continue;
    for (const { resource, action } of perms) add(resource, action);
  }

  for (const { resource, action } of OPERATIONS_BASE_RESOURCES) add(resource, action);

  return dtos;
}

/** Reverse-map a set's existing resource:action pairs back to operations tag keys. */
export function inferOperationsTagsFromResources(
  resources: Array<{ resource: { name: string }; action: string }>,
): string[] {
  const has = new Set(resources.map((r) => `${r.resource.name}:${r.action}`));
  return Object.entries(OPERATIONS_PERMISSION_TAG_MAPPING)
    .filter(
      ([, perms]) =>
        perms && perms.every(({ resource, action }) => has.has(`${resource}:${action}`)),
    )
    .map(([key]) => key);
}

interface OperationsPermissionsSectionProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function OperationsPermissionsSection({
  value,
  onChange,
}: OperationsPermissionsSectionProps) {
  const selected = new Set(value);

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-6">
      {OPERATIONS_PERMISSION_TAG_GROUPS.map((group) => (
        <div key={group.group} className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">{group.group}</p>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => {
              const isSelected = selected.has(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => toggle(tag.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    isSelected
                      ? 'bg-(--module-btn-bg,var(--color-brand)) text-white border-(--module-btn-bg,var(--color-brand))'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700',
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
