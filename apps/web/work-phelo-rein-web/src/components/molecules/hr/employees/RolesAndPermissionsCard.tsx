'use client';

import { useMemo, useState } from 'react';
import { Pencil, ShieldCheck, ShieldCog } from 'lucide-react';
import { cardClass } from '@/lib/utils';
import { HeaderTab } from '@/components/molecules/shared/HeaderTab';
import { TableButton } from '@/components/atoms/TableButton';
import {
  PERMISSION_TAG_GROUPS,
  inferTagsFromResources,
} from '@/components/molecules/roles/PermissionTagSelector';

interface RolesAndPermissionsCardProps {
  roles: string[];
  /** Navigates to the HR Settings roles & permissions page — omitted where that page doesn't apply (e.g. the self-service profile). */
  onManageRoles?: () => void;
  canEditRoles?: boolean;
  onEditRoles?: () => void;
  canManagePermissions?: boolean;
  /** Opens the manage-permissions side panel. */
  onManagePermissions?: () => void;
  directPermissions?: Array<{ resourceName: string; action: string }>;
}

type SubTab = 'roles' | 'permissions';

export function RolesAndPermissionsCard({
  roles,
  onManageRoles,
  canEditRoles = false,
  onEditRoles,
  canManagePermissions = false,
  onManagePermissions,
  directPermissions = [],
}: RolesAndPermissionsCardProps) {
  const [tab, setTab] = useState<SubTab>(roles.length > 0 ? 'roles' : 'permissions');

  const activeTagsByGroup = useMemo(() => {
    if (directPermissions.length === 0) return [];
    const inferred = inferTagsFromResources(
      directPermissions.map((p) => ({ resource: { name: p.resourceName }, action: p.action })),
    );
    const tagSet = new Set(inferred);
    return PERMISSION_TAG_GROUPS.filter((g) => g.group !== 'Administration')
      .map((g) => ({ ...g, tags: g.tags.filter((t) => tagSet.has(t.key)) }))
      .filter((g) => g.tags.length > 0);
  }, [directPermissions]);

  if (
    roles.length === 0 &&
    activeTagsByGroup.length === 0 &&
    !canManagePermissions &&
    !onManageRoles
  )
    return null;

  return (
    <div className={cardClass('overflow-hidden')}>
      {/* Tabbed header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 pt-1">
        <div className="flex items-center gap-4">
          <HeaderTab active={tab === 'roles'} onClick={() => setTab('roles')}>
            Roles
          </HeaderTab>
          <HeaderTab active={tab === 'permissions'} onClick={() => setTab('permissions')}>
            Permissions
          </HeaderTab>
        </div>

        {tab === 'roles' ? (
          <div className="flex items-center gap-3 pb-2">
            {canEditRoles && onEditRoles && (
              <button
                type="button"
                onClick={onEditRoles}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Edit Roles
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onManageRoles && (
              <TableButton variant="blue" onClick={onManageRoles}>
                Manage
              </TableButton>
            )}
          </div>
        ) : (
          canManagePermissions &&
          onManagePermissions && (
            <div className="pb-2">
              <TableButton variant="blue" onClick={onManagePermissions}>
                Manage
              </TableButton>
            </div>
          )
        )}
      </div>

      <div className="px-6 py-5">
        {tab === 'roles' ? (
          roles.length === 0 ? (
            <p className="text-sm text-gray-400">No roles assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <div
                  key={role}
                  className="flex items-center gap-1.5 rounded-md bg-brand/10 px-2.5 py-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="text-sm font-medium text-gray-700">{role}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {activeTagsByGroup.length === 0 ? (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCog className="w-4 h-4 text-brand" />
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Grant or manage individual permissions directly assigned to this employee.
                </p>
              </div>
            ) : (
              activeTagsByGroup.map((group) => (
                <div key={group.group} className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-gray-400">{group.group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => (
                      <span
                        key={tag.key}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20"
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
