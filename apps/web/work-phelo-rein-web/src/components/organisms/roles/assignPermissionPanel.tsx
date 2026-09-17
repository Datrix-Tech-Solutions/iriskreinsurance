'use client';

import { useState, useMemo } from 'react';
import { X, ShieldOff } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  PERMISSION_TAG_GROUPS,
  PERMISSION_TAG_MAPPING,
  buildPermissionResources,
  inferTagsFromResources,
} from '@/components/molecules/roles/PermissionTagSelector';
import {
  usePermissionResources,
  useGrantPermission,
  useRevokePermission,
  useUserPermissions,
} from '@/hooks/hr/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { PermissionAction } from '@/types/roles';

interface AssignPermissionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  userId: string;
}

type DirectPerm = {
  id: string;
  resourceId: string;
  resourceName: string;
  action: PermissionAction;
  grantedAt: string;
  expiresAt?: string | null;
};

function AssignPermissionPanelInner({
  isOpen,
  onClose,
  employeeName,
  userId,
}: AssignPermissionPanelProps) {
  const toast = useToast();
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: resources = [] } = usePermissionResources();
  const { data: userPerms, isLoading: isLoadingPerms } = useUserPermissions(userId);
  const { mutateAsync: grantPermission, isPending: isSaving } = useGrantPermission();
  const { mutate: revokePermission, isPending: isRevoking } = useRevokePermission();

  const resourceIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.name, r.id);
    return m;
  }, [resources]);

  const { activeTagsByGroup, grantedTagKeys } = useMemo(() => {
    const directPermissions = (userPerms?.directPermissions ?? []) as unknown as DirectPerm[];
    if (directPermissions.length === 0)
      return { activeTagsByGroup: [], grantedTagKeys: new Set<string>() };
    const inferred = inferTagsFromResources(
      directPermissions.map((p) => ({ resource: { name: p.resourceName }, action: p.action })),
    );
    const tagSet = new Set(inferred);
    return {
      grantedTagKeys: tagSet,
      activeTagsByGroup: PERMISSION_TAG_GROUPS.filter((g) => g.group !== 'Administration')
        .map((g) => ({ ...g, tags: g.tags.filter((t) => tagSet.has(t.key)) }))
        .filter((g) => g.tags.length > 0),
    };
  }, [userPerms?.directPermissions]);

  const handleRevokeTag = (tagKey: string) => {
    const perms = PERMISSION_TAG_MAPPING[tagKey];
    if (!perms) return;

    // Collect permissions still needed by other active tags so we don't revoke shared ones
    const keepPermissions = new Set<string>();
    for (const otherKey of grantedTagKeys) {
      if (otherKey === tagKey) continue;
      const otherPerms = PERMISSION_TAG_MAPPING[otherKey];
      if (!otherPerms) continue;
      for (const { resource, action } of otherPerms) keepPermissions.add(`${resource}:${action}`);
    }

    for (const { resource, action } of perms) {
      if (keepPermissions.has(`${resource}:${action}`)) continue;
      const resourceId = resourceIdMap.get(resource);
      if (!resourceId) continue;
      revokePermission(
        { userId, resourceId, action: action as PermissionAction },
        { onError: (err) => toast.error(extractError(err, 'Failed to revoke permission')) },
      );
    }
    toast.success('Permission revoked');
  };

  const handleGrant = async () => {
    if (selectedTags.length === 0) {
      toast.error('Select at least one permission');
      return;
    }

    const toGrant = buildPermissionResources(selectedTags, resourceIdMap);

    if (toGrant.length === 0) {
      toast.error('Selected permissions have no backend mapping yet');
      return;
    }

    try {
      await Promise.all(
        toGrant.map(({ resourceId, action }) => grantPermission({ userId, resourceId, action })),
      );
      toast.success(`Permissions granted to ${employeeName}`);
      setSelectedTags([]);
      setSelectedGroup('');
    } catch (err) {
      toast.error(extractError(err, 'Failed to grant permissions'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Grant Direct Permissions"
      description={`One-off permission overrides for ${employeeName}. These are exceptions on top of their base role and assigned permission sets.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button isLoading={isSaving} loadingText="Granting..." onClick={handleGrant}>
            Grant
          </Button>
        </div>
      }
    >
      {/* Active direct permissions */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Active direct permissions
        </p>

        {isLoadingPerms ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-8 bg-gray-100 rounded-full animate-pulse" />
            ))}
          </div>
        ) : activeTagsByGroup.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-gray-200 px-4 py-3">
            <ShieldOff className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-sm text-gray-400 italic">No direct permissions granted yet.</p>
          </div>
        ) : (
          activeTagsByGroup.map((group) => (
            <div key={group.group} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-400">{group.group}</p>
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag) => (
                  <div
                    key={tag.key}
                    className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium bg-brand/10 text-brand border border-brand/20"
                  >
                    {tag.label}
                    <button
                      type="button"
                      onClick={() => handleRevokeTag(tag.key)}
                      disabled={isRevoking}
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-brand/20 transition-colors disabled:opacity-40"
                      aria-label="Revoke"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-100" />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Changes appear immediately. The affected user may need to refresh or sign in again before
        their live session reflects the new access.
      </div>

      {/* Grant new permissions */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Grant new permissions
      </p>

      <SearchSelect
        label="Category"
        placeholder="Select a category..."
        options={PERMISSION_TAG_GROUPS.filter((g) => g.group !== 'Administration').map((g) => ({
          value: g.group,
          label: g.group,
        }))}
        value={selectedGroup}
        onChange={setSelectedGroup}
      />

      {selectedGroup &&
        (() => {
          const group = PERMISSION_TAG_GROUPS.find((g) => g.group === selectedGroup);
          if (!group) return null;
          const pendingSet = new Set(selectedTags);
          return (
            <div className="flex flex-wrap gap-2">
              {group.tags.map((tag) => {
                const isGranted = grantedTagKeys.has(tag.key);
                const isPending = pendingSet.has(tag.key);
                const isActive = isGranted || isPending;
                return (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() => {
                      if (isGranted) return; // already granted — managed via revoke in the top section
                      const next = new Set(pendingSet);
                      if (next.has(tag.key)) next.delete(tag.key);
                      else next.add(tag.key);
                      setSelectedTags(Array.from(next));
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      isActive
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700',
                      isGranted && 'cursor-default',
                    )}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          );
        })()}
    </SidePanel>
  );
}

export function AssignPermissionPanel({ isOpen, ...props }: AssignPermissionPanelProps) {
  return <AssignPermissionPanelInner key={props.userId} isOpen={isOpen} {...props} />;
}
