'use client';

import { useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PERMISSION_ACTION_LABELS,
  RESOURCE_ACTIONS,
  isPermissionUiVisibleResource,
} from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';

export type FeaturePermissions = Record<string, string[]>;

// Kept for any existing imports that reference FeatureDefinition
export interface FeatureDefinition {
  key: string;
  label: string;
  actions: { key: string; label: string }[];
}

interface PermissionMatrixProps {
  value: FeaturePermissions;
  onChange?: (value: FeaturePermissions) => void;
  readOnly?: boolean;
}

type VirtualResource = {
  key: string;
  label: string;
  actions: string[];
  actionMaps: Record<string, { resource: string; action: string }[]>;
};

type ResourceGroup = {
  label: string;
  description: string;
  resources: string[];
  resourceLabels?: Record<string, string>;
  resourceActions?: Record<string, string[]>;
  actionLabels?: Record<string, Record<string, string>>;
  virtualResources?: VirtualResource[];
};

const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    label: 'Access & Accounts',
    description: 'User administration, security controls, roles and audit visibility',
    resources: ['users', 'user-security', 'permission-sets', 'audit-logs'],
    resourceLabels: {
      'user-security': 'User Security',
      'permission-sets': 'Permission Sets',
      'audit-logs': 'Audit Logs',
    },
    resourceActions: {
      'user-security': ['EDIT'],
    },
    actionLabels: {
      'user-security': { EDIT: 'Force Reset' },
    },
  },
  {
    label: 'Self Service',
    description: 'Employee-facing permissions for personal profile, leave, payslips and reviews',
    resources: [
      'employee-profile',
      'leave-self',
      'payslip-self',
      'self-appraisals',
      'resignations',
    ],
    resourceLabels: {
      'employee-profile': 'Own Profile',
      'leave-self': 'Own Leave',
      'payslip-self': 'Own Payslips',
      'self-appraisals': 'Own Appraisals',
      resignations: 'Resignation',
    },
    resourceActions: {
      'employee-profile': ['VIEW'],
      'leave-self': ['VIEW', 'CREATE'],
      'payslip-self': ['VIEW'],
      'self-appraisals': ['VIEW', 'EDIT'],
      resignations: ['CREATE', 'DELETE'],
    },
    actionLabels: {
      'leave-self': { CREATE: 'Request' },
      'self-appraisals': { EDIT: 'Submit' },
      resignations: { CREATE: 'Submit', DELETE: 'Withdraw' },
    },
  },
  {
    label: 'People Operations',
    description: 'Company-wide employee, leave, appraisal, asset and communication workflows',
    resources: [
      'employees',
      'employee-profile',
      'offboarding',
      'documents',
      'leave',
      'appraisals',
      'appraisal-reviews',
      'assets',
      'announcements',
    ],
    resourceActions: {
      'employee-profile': ['EDIT'],
      offboarding: ['EDIT'],
      leave: ['VIEW', 'APPROVE'],
      appraisals: ['VIEW', 'CREATE'],
      'appraisal-reviews': ['EDIT'],
    },
    resourceLabels: {
      'employee-profile': 'Can edit personal profile',
      appraisals: 'Appraisals',
      offboarding: 'Offboarding',
      documents: 'Employee Documents',
      leave: 'Leave Requests',
      'appraisal-reviews': 'Manager Reviews',
      assets: 'Assets',
      announcements: 'Announcements',
    },
    actionLabels: {
      'employee-profile': { EDIT: 'Edit' },
      offboarding: { EDIT: 'Manage' },
      leave: { APPROVE: 'Approve' },
      'appraisal-reviews': { EDIT: 'Review' },
    },
  },
  {
    label: 'Workforce Management',
    description: 'Time clock and scheduling',
    resources: ['schedules'],
    resourceActions: {
      schedules: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    },
    virtualResources: [
      {
        key: 'time-clock',
        label: 'Time Clock',
        actions: ['VIEW', 'CREATE', 'APPROVE'],
        actionMaps: {
          VIEW: [
            { resource: 'attendance', action: 'VIEW' },
            { resource: 'time-corrections', action: 'VIEW' },
            { resource: 'timesheets', action: 'VIEW' },
          ],
          CREATE: [
            { resource: 'attendance', action: 'CREATE' },
            { resource: 'time-corrections', action: 'CREATE' },
          ],
          APPROVE: [
            { resource: 'time-corrections', action: 'APPROVE' },
            { resource: 'timesheets', action: 'APPROVE' },
          ],
        },
      },
    ],
  },
  {
    label: 'Payroll & Compensation',
    description: 'Payroll processing, approvals and allowances',
    resources: ['payroll', 'allowances'],
  },
  {
    label: 'HR Settings',
    description: 'Departments, branches, appraisal configuration and other settings',
    resources: ['departments', 'branches', 'leave-settings', 'appraisal-settings', 'hr-settings'],
    resourceLabels: {
      'leave-settings': 'Leave Types & Holidays',
      'appraisal-settings': 'Appraisal Configuration',
      'hr-settings': 'Company Policies',
    },
    resourceActions: {
      'leave-settings': ['EDIT'],
      'appraisal-settings': ['EDIT'],
    },
    actionLabels: {
      'leave-settings': { EDIT: 'Manage' },
      'appraisal-settings': { EDIT: 'Manage' },
    },
  },
];

const RESOURCE_FEATURE_KEYS: Record<string, string> = {
  users: 'management',
  'user-security': 'management',
  'permission-sets': 'management',
  'audit-logs': 'management',
  employees: 'employees',
  'employee-profile': 'employees',
  offboarding: 'employees',
  resignations: 'employees',
  documents: 'employees',
  departments: 'departments',
  branches: 'branches',
  leave: 'leave',
  'leave-self': 'leave',
  'leave-settings': 'leave',
  attendance: 'timeclock',
  'time-corrections': 'timeclock',
  timesheets: 'timeclock',
  schedules: 'scheduling',
  assets: 'assets',
  announcements: 'management',
  payroll: 'payroll',
  'payslip-self': 'payroll',
  allowances: 'payroll',
  appraisals: 'appraisal',
  'appraisal-settings': 'appraisal',
  'self-appraisals': 'appraisal',
  'appraisal-reviews': 'appraisal',
  'hr-settings': 'management',
};

const EMPTY_HR_FEATURES: Record<string, boolean> = {};

function formatResourceName(name: string) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PermissionMatrix({ value, onChange, readOnly = false }: PermissionMatrixProps) {
  const hrFeatures = useAuthStore((s) => s.user?.featureConfig?.hr ?? EMPTY_HR_FEATURES);

  const visibleResourceGroups = RESOURCE_GROUPS.map((group) => ({
    ...group,
    resources: group.resources.filter((resourceName) =>
      isPermissionUiVisibleResource(resourceName),
    ),
  })).filter((group) => group.resources.length > 0);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) =>
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isLocked = (resourceName: string) => {
    const featureKey = RESOURCE_FEATURE_KEYS[resourceName];
    if (!featureKey || featureKey === 'management') return false;
    return featureKey in hrFeatures && hrFeatures[featureKey] === false;
  };

  const toggle = (resourceName: string, action: string) => {
    if (readOnly || !onChange) return;
    const current = value[resourceName] ?? [];
    const next = current.includes(action)
      ? current.filter((existingAction) => existingAction !== action)
      : [...current, action];
    onChange({ ...value, [resourceName]: next });
  };

  const isVirtualActionGranted = (vr: VirtualResource, action: string): boolean => {
    const maps = vr.actionMaps[action] ?? [];
    return (
      maps.length > 0 &&
      maps.every(({ resource, action: a }) => (value[resource] ?? []).includes(a))
    );
  };

  const toggleVirtual = (vr: VirtualResource, action: string) => {
    if (readOnly || !onChange) return;
    const maps = vr.actionMaps[action] ?? [];
    const isGranted = isVirtualActionGranted(vr, action);
    const next = { ...value };
    for (const { resource, action: a } of maps) {
      const current = next[resource] ?? [];
      next[resource] = isGranted
        ? current.filter((x) => x !== a)
        : current.includes(a)
          ? current
          : [...current, a];
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissions</p>

      <div className="flex flex-col gap-3">
        {visibleResourceGroups.map((group) => {
          const isExpanded = expandedGroups[group.label] ?? false;
          return (
            <div key={group.label} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                  <span className="text-xs text-gray-400">{group.description}</span>
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0',
                    !isExpanded && '-rotate-90',
                  )}
                />
              </button>

              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {(group.virtualResources ?? []).map((vr) => (
                    <div key={vr.key} className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-gray-700 mb-2.5">{vr.label}</p>
                      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
                        {vr.actions.map((action) => (
                          <label
                            key={action}
                            className={cn(
                              'flex items-center gap-1.5 select-none',
                              readOnly ? 'cursor-default' : 'cursor-pointer',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isVirtualActionGranted(vr, action)}
                              disabled={readOnly}
                              onChange={() => toggleVirtual(vr, action)}
                              className="w-4 h-4 accent-brand rounded cursor-pointer disabled:cursor-default"
                            />
                            <span className="text-sm text-gray-600">
                              {PERMISSION_ACTION_LABELS[action] ?? action}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {group.resources.map((resourceName) => {
                    const actions =
                      group.resourceActions?.[resourceName] ?? RESOURCE_ACTIONS[resourceName] ?? [];
                    const locked = isLocked(resourceName);
                    const granted = value[resourceName] ?? [];
                    const displayName =
                      group.resourceLabels?.[resourceName] ?? formatResourceName(resourceName);

                    return (
                      <div key={resourceName} className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-gray-700 mb-2.5">{displayName}</p>

                        {locked ? (
                          <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-gray-100 text-gray-400">
                            <Lock className="w-4 h-4 shrink-0" />
                            <span className="text-sm">Upgrade to unlock</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
                            {actions.map((action) => (
                              <label
                                key={action}
                                className={cn(
                                  'flex items-center gap-1.5 select-none',
                                  readOnly ? 'cursor-default' : 'cursor-pointer',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={granted.includes(action)}
                                  disabled={readOnly}
                                  onChange={() => toggle(resourceName, action)}
                                  className="w-4 h-4 accent-brand rounded cursor-pointer disabled:cursor-default"
                                />
                                <span className="text-sm text-gray-600">
                                  {group.actionLabels?.[resourceName]?.[action] ??
                                    PERMISSION_ACTION_LABELS[action] ??
                                    action}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
