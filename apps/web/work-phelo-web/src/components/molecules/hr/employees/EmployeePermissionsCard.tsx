import { useMemo } from 'react';
import { ShieldCog, ArrowRight } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import {
  PERMISSION_TAG_GROUPS,
  inferTagsFromResources,
} from '@/components/molecules/roles/PermissionTagSelector';

interface EmployeePermissionsCardProps {
  canManage: boolean;
  onManage: () => void;
  directPermissions?: Array<{ resourceName: string; action: string }>;
  hideWhenEmpty?: boolean;
}

export function EmployeePermissionsCard({
  canManage,
  onManage,
  directPermissions = [],
  hideWhenEmpty = false,
}: EmployeePermissionsCardProps) {
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

  if (hideWhenEmpty && activeTagsByGroup.length === 0) return null;

  return (
    <SectionCard title="Permissions">
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

      {canManage && (
        <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onManage}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Manage Permissions
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </SectionCard>
  );
}
