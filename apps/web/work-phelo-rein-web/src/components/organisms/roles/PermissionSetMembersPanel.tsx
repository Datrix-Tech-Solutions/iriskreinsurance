'use client';

import { useMemo, useState } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import type { PermissionSet, PermissionSetMember } from '@/types/roles';
import type { TenantUser } from '@/types/tenant';

interface PermissionSetMembersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  permissionSet: PermissionSet;
  members: PermissionSetMember[];
  users: TenantUser[];
  onAssign: (userId: string) => void;
  onRemove: (userId: string) => void;
  isAssigning?: boolean;
  isRemoving?: boolean;
  isLoadingMembers?: boolean;
}

function memberStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING_VERIFICATION':
      return 'warning';
    case 'SUSPENDED':
    case 'INACTIVE':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function PermissionSetMembersPanel({
  isOpen,
  onClose,
  permissionSet,
  members,
  users,
  onAssign,
  onRemove,
  isAssigning,
  isRemoving,
  isLoadingMembers,
}: PermissionSetMembersPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const assignedIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);

  const assignableUsers = useMemo(
    () =>
      users
        .filter((user) => user.role === 'EMPLOYEE' && !assignedIds.has(user.id))
        .map((user) => ({
          value: user.id,
          label: `${user.firstName} ${user.lastName}`.trim(),
          sublabel: user.email,
        })),
    [assignedIds, users],
  );

  const handleAssign = () => {
    if (!selectedUserId) return;
    onAssign(selectedUserId);
    setSelectedUserId('');
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Members"
      description={`Assign employees to ${permissionSet.name} and remove them when they no longer need this access.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-900">Assigned members</p>
        {isLoadingMembers ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm italic text-gray-400">
            No employees are assigned to this permission set yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="truncate text-xs text-gray-500">{member.email}</p>
                </div>

                <div className="ml-4 flex items-center gap-3">
                  <Badge
                    label={member.status.replace(/_/g, ' ')}
                    variant={memberStatusVariant(member.status)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRemove(member.id)}
                    isLoading={isRemoving}
                    loadingText="Removing..."
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold text-gray-900">Add member</p>
        <SearchSelect
          placeholder="Select an employee..."
          options={assignableUsers}
          value={selectedUserId}
          onChange={setSelectedUserId}
        />
        <Button
          onClick={handleAssign}
          disabled={!selectedUserId}
          isLoading={isAssigning}
          loadingText="Adding..."
          variant="secondary"
        >
          Add Member
        </Button>
      </div>
    </SidePanel>
  );
}
