'use client';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { PermissionAction, PermissionSetResourceDto } from '@/types/roles';

interface PermissionTag {
  key: string;
  label: string;
  /** Only shown when the tenant's moduleConfig has this key enabled. Omit for always-visible tags. */
  moduleKey?: string;
}

interface PermissionTagGroup {
  group: string;
  tags: PermissionTag[];
}

export const PERMISSION_TAG_GROUPS: PermissionTagGroup[] = [
  {
    group: 'Administration',
    tags: [{ key: 'grant_all_permissions', label: 'Grant All Permissions' }],
  },
  {
    group: 'People Management',
    tags: [
      { key: 'can_edit_personal_profile', label: 'Can Edit Personal Profile' },
      { key: 'onboard_employee', label: 'Onboard Employee' },
      { key: 'offboard_employee', label: 'Offboard Employee' },
      { key: 'edit_all_employees', label: 'Edit All Employees' },
      { key: 'approve_leave', label: 'Approve Leave' },
      { key: 'create_announcements', label: 'Create Announcements' },
      { key: 'view_all_assets', label: 'View All Assets' },
      { key: 'manage_assets', label: 'Manage Assets' },
      { key: 'review_appraisals', label: 'Review Appraisals' },
      { key: 'approve_appraisals', label: 'Approve Appraisals' },
      { key: 'manage_payroll', label: 'Manage Payroll' },
      { key: 'approve_payroll', label: 'Approve Payroll' },
    ],
  },
  {
    group: 'Workforce Management',
    tags: [
      { key: 'view_all_attendance', label: 'View All Attendance' },
      { key: 'approve_time_correction', label: 'Approve Time Correction' },
      { key: 'manage_schedule', label: 'Manage Schedule' },
      { key: 'view_all_projects', label: 'View All Projects' },
      { key: 'manage_projects', label: 'Manage Projects' },
    ],
  },
  {
    group: 'HR Settings',
    tags: [
      { key: 'manage_leave_holiday', label: 'Manage Leave & Holiday Settings' },
      { key: 'create_manage_appraisal', label: 'Create & Manage Appraisal' },
      { key: 'define_roles_permissions', label: 'Define Roles & Permissions' },
      { key: 'manage_departments', label: 'Manage Departments' },
      { key: 'view_all_departments', label: 'View All Departments' },
      { key: 'manage_branches', label: 'Manage Branches' },
      { key: 'view_all_branches', label: 'View All Branches' },
    ],
  },
  {
    group: 'Administrator',
    tags: [
      { key: 'operations_module_admin', label: 'Operations Admin', moduleKey: 'operations' },
      { key: 'accounting_module_admin', label: 'Accounting Admin', moduleKey: 'accounting' },
      { key: 'marketing_module_admin', label: 'Marketing Admin', moduleKey: 'marketing' },
      { key: 'recruitment_module_admin', label: 'Recruitment Admin', moduleKey: 'recruitment' },
    ],
  },
];

// Automatically included in every permission set — never shown in the UI
export const SELF_SERVICE_RESOURCES: Array<{ resource: string; action: string }> = [
  { resource: 'employees', action: 'VIEW' },
  { resource: 'employee-profile', action: 'VIEW' },
  { resource: 'leave-self', action: 'VIEW' },
  { resource: 'leave-self', action: 'CREATE' },
  { resource: 'payslip-self', action: 'VIEW' },
  { resource: 'self-appraisals', action: 'VIEW' },
  { resource: 'self-appraisals', action: 'EDIT' },
  { resource: 'resignations', action: 'CREATE' },
  { resource: 'resignations', action: 'DELETE' },
  { resource: 'attendance', action: 'CREATE' },
  { resource: 'announcements', action: 'VIEW' },
  { resource: 'schedules', action: 'VIEW' },
];

// null = UI-only tag, not yet linked to backend permissions
export const PERMISSION_TAG_MAPPING: Record<
  string,
  Array<{ resource: string; action: string }> | null
> = {
  // Administration
  grant_all_permissions: null,

  // People Management
  can_edit_personal_profile: [{ resource: 'employee-profile', action: 'EDIT' }],
  onboard_employee: [{ resource: 'employees', action: 'CREATE' }],
  offboard_employee: [{ resource: 'offboarding', action: 'EDIT' }],
  edit_all_employees: [{ resource: 'employees', action: 'EDIT' }],
  approve_leave: [{ resource: 'leave', action: 'APPROVE' }],
  create_announcements: [
    { resource: 'announcements', action: 'CREATE' },
    { resource: 'announcements', action: 'EDIT' },
    { resource: 'announcements', action: 'DELETE' },
  ],
  view_all_assets: [{ resource: 'assets', action: 'VIEW' }],
  manage_assets: [
    { resource: 'assets', action: 'VIEW' },
    { resource: 'assets', action: 'CREATE' },
    { resource: 'assets', action: 'EDIT' },
    { resource: 'assets', action: 'ASSIGN' },
  ],
  review_appraisals: [
    { resource: 'appraisals', action: 'VIEW' },
    { resource: 'appraisal-reviews', action: 'EDIT' },
  ],
  approve_appraisals: [
    { resource: 'appraisals', action: 'VIEW' },
    { resource: 'appraisals', action: 'APPROVE' },
  ],
  manage_payroll: [
    { resource: 'payroll', action: 'RUN' },
    { resource: 'payroll', action: 'EDIT' },
  ],
  approve_payroll: [{ resource: 'payroll', action: 'APPROVE' }],

  // Workforce Management
  view_all_attendance: [{ resource: 'attendance', action: 'VIEW' }],
  approve_time_correction: [{ resource: 'time-corrections', action: 'APPROVE' }],
  manage_schedule: [
    { resource: 'schedules', action: 'CREATE' },
    { resource: 'schedules', action: 'EDIT' },
  ],
  view_all_projects: [
    { resource: 'projects', action: 'VIEW' },
    { resource: 'project-tasks', action: 'VIEW' },
  ],
  manage_projects: [
    { resource: 'projects', action: 'VIEW' },
    { resource: 'projects', action: 'CREATE' },
    { resource: 'projects', action: 'EDIT' },
    { resource: 'projects', action: 'DELETE' },
    { resource: 'projects', action: 'ASSIGN' },
    { resource: 'project-tasks', action: 'VIEW' },
    { resource: 'project-tasks', action: 'CREATE' },
    { resource: 'project-tasks', action: 'EDIT' },
    { resource: 'project-tasks', action: 'DELETE' },
    { resource: 'project-tasks', action: 'ASSIGN' },
  ],

  // HR Settings
  manage_leave_holiday: [{ resource: 'leave-settings', action: 'EDIT' }],
  create_manage_appraisal: [
    { resource: 'appraisals', action: 'CREATE' },
    { resource: 'appraisal-settings', action: 'EDIT' },
  ],
  define_roles_permissions: [
    { resource: 'users', action: 'VIEW' },
    { resource: 'permission-sets', action: 'VIEW' },
    { resource: 'permission-sets', action: 'CREATE' },
    { resource: 'permission-sets', action: 'EDIT' },
    { resource: 'permission-sets', action: 'DELETE' },
    { resource: 'permission-sets', action: 'ASSIGN' },
  ],
  manage_departments: [
    { resource: 'departments', action: 'VIEW' },
    { resource: 'departments', action: 'CREATE' },
    { resource: 'departments', action: 'EDIT' },
    { resource: 'departments', action: 'DELETE' },
  ],
  view_all_departments: [{ resource: 'departments', action: 'VIEW' }],
  manage_branches: [
    { resource: 'branches', action: 'VIEW' },
    { resource: 'branches', action: 'CREATE' },
    { resource: 'branches', action: 'EDIT' },
    { resource: 'branches', action: 'DELETE' },
  ],
  view_all_branches: [{ resource: 'branches', action: 'VIEW' }],

  // Operations Admin — full access to every reinsurance-operations resource,
  // plus the tenant Roles & Permissions surface (scoped by the backend to
  // granting operations resources only).
  operations_module_admin: [
    { resource: 'operations.reinsurance.dashboard', action: 'VIEW' },

    { resource: 'operations.reinsurance.placements', action: 'VIEW' },
    { resource: 'operations.reinsurance.placements', action: 'CREATE' },
    { resource: 'operations.reinsurance.placements', action: 'EDIT' },
    { resource: 'operations.reinsurance.placements', action: 'DELETE' },
    { resource: 'operations.reinsurance.placements', action: 'APPROVE' },
    { resource: 'operations.reinsurance.placements', action: 'EXPORT' },

    { resource: 'operations.reinsurance.counterparties', action: 'VIEW' },
    { resource: 'operations.reinsurance.counterparties', action: 'CREATE' },
    { resource: 'operations.reinsurance.counterparties', action: 'EDIT' },
    { resource: 'operations.reinsurance.counterparties', action: 'DELETE' },

    { resource: 'operations.reinsurance.claims', action: 'VIEW' },
    { resource: 'operations.reinsurance.claims', action: 'CREATE' },
    { resource: 'operations.reinsurance.claims', action: 'EDIT' },
    { resource: 'operations.reinsurance.claims', action: 'DELETE' },
    { resource: 'operations.reinsurance.claims', action: 'APPROVE' },
    { resource: 'operations.reinsurance.claims', action: 'EXPORT' },

    { resource: 'operations.reinsurance.email', action: 'VIEW' },
    { resource: 'operations.reinsurance.email', action: 'CREATE' },
    { resource: 'operations.reinsurance.email', action: 'EDIT' },

    { resource: 'operations.reinsurance.email-settings', action: 'VIEW' },
    { resource: 'operations.reinsurance.email-settings', action: 'EDIT' },

    { resource: 'operations.reinsurance.reports', action: 'VIEW' },
    { resource: 'operations.reinsurance.reports', action: 'EXPORT' },

    { resource: 'operations.reinsurance.settings', action: 'VIEW' },
    { resource: 'operations.reinsurance.settings', action: 'EDIT' },

    { resource: 'operations.reinsurance.taxes-levies', action: 'VIEW' },
    { resource: 'operations.reinsurance.taxes-levies', action: 'CREATE' },
    { resource: 'operations.reinsurance.taxes-levies', action: 'EDIT' },
    { resource: 'operations.reinsurance.taxes-levies', action: 'DELETE' },

    // Granular reinsurance workflow resources (RUN) — Operations Admin can run
    // every workflow, not just the ones the coarse placements/claims fallback covers.
    { resource: 'operations.reinsurance.facultative-offers.create-offer', action: 'RUN' },
    { resource: 'operations.reinsurance.facultative-offers.edit-offer', action: 'RUN' },
    { resource: 'operations.reinsurance.facultative-offers.partial-edit', action: 'RUN' },
    { resource: 'operations.reinsurance.facultative-offers.reopen-offer', action: 'RUN' },
    { resource: 'operations.reinsurance.facultative-offers.force-close', action: 'RUN' },
    { resource: 'operations.reinsurance.facultative-offers.endorse-offer', action: 'RUN' },
    { resource: 'operations.reinsurance.facultative-offers.archive-offer', action: 'RUN' },

    { resource: 'operations.reinsurance.premiums.receive-from-cedant', action: 'RUN' },
    { resource: 'operations.reinsurance.premiums.disburse-to-reinsurer', action: 'RUN' },
    { resource: 'operations.reinsurance.premiums.reverse-payment', action: 'RUN' },

    { resource: 'operations.reinsurance.claims.add-claim', action: 'RUN' },
    { resource: 'operations.reinsurance.claims.create-notification', action: 'RUN' },
    { resource: 'operations.reinsurance.claims.record-recovery', action: 'RUN' },
    { resource: 'operations.reinsurance.claims.void-claim', action: 'RUN' },

    { resource: 'permission-sets', action: 'VIEW' },
    { resource: 'permission-sets', action: 'CREATE' },
    { resource: 'permission-sets', action: 'EDIT' },
    { resource: 'permission-sets', action: 'DELETE' },
    { resource: 'permission-sets', action: 'ASSIGN' },
    { resource: 'users', action: 'VIEW' },
  ],

  // Other modules — UI-only for now, not yet linked to backend permissions
  accounting_module_admin: null,
  marketing_module_admin: null,
  recruitment_module_admin: null,
};

/** Build the resources DTO from selected tags + auto self-service permissions. */
export function buildPermissionResources(
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
    const perms = PERMISSION_TAG_MAPPING[tag];
    if (!perms) continue;
    for (const { resource, action } of perms) add(resource, action);
  }

  for (const { resource, action } of SELF_SERVICE_RESOURCES) add(resource, action);

  return dtos;
}

/** Reverse-map a set's existing resource:action pairs back to tag keys. */
export function inferTagsFromResources(
  resources: Array<{ resource: { name: string }; action: string }>,
): string[] {
  const has = new Set(resources.map((r) => `${r.resource.name}:${r.action}`));
  return Object.entries(PERMISSION_TAG_MAPPING)
    .filter(
      ([, perms]) =>
        perms && perms.every(({ resource, action }) => has.has(`${resource}:${action}`)),
    )
    .map(([key]) => key);
}

const EMPTY_MODULE_CONFIG: Record<string, boolean> = {};

interface PermissionTagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function PermissionTagSelector({ value, onChange }: PermissionTagSelectorProps) {
  const moduleConfig = useAuthStore((s) => s.user?.moduleConfig ?? EMPTY_MODULE_CONFIG);
  const visibleGroups = PERMISSION_TAG_GROUPS.map((group) => ({
    ...group,
    tags: group.tags.filter((tag) => !tag.moduleKey || moduleConfig[tag.moduleKey]),
  })).filter((group) => group.tags.length > 0);

  const allTagKeys = visibleGroups
    .flatMap((g) => g.tags.map((t) => t.key))
    .filter((k) => k !== 'grant_all_permissions');

  const selected = new Set(value);
  const allGranted = allTagKeys.every((k) => selected.has(k));

  const toggle = (key: string) => {
    if (key === 'grant_all_permissions') {
      // Select all or deselect all
      onChange(allGranted ? [] : ['grant_all_permissions', ...allTagKeys]);
      return;
    }

    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
      next.delete('grant_all_permissions'); // deselect "grant all" if any tag is removed
    } else {
      next.add(key);
      // Auto-select "grant all" if every other tag is now selected
      if (allTagKeys.every((k) => next.has(k))) next.add('grant_all_permissions');
    }
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-6">
      {visibleGroups.map((group) => (
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
                      ? 'bg-brand text-white border-brand'
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
