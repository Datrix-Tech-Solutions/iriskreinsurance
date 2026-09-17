'use client';

import { useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { extractError } from '@/lib/extractError';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  usePermissionSets,
  usePermissionSetMembers,
  useAssignPermissionSet,
  useRemovePermissionSet,
} from '@/hooks/hr/useRoles';
import { useCurrentTenantUsers } from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';
import type { PermissionSet } from '@/types/roles';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { PermissionSetMembersPanel } from '@/components/organisms/roles/PermissionSetMembersPanel';
import { useParams, useRouter } from 'next/navigation';

export function RolesContent() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();

  const [membersTarget, setMembersTarget] = useState<PermissionSet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionSet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: setsRaw = [], isLoading } = usePermissionSets();
  const { data: currentTenantUsers = [] } = useCurrentTenantUsers();
  const { data: members = [], isLoading: isLoadingMembers } = usePermissionSetMembers(
    membersTarget?.id ?? '',
    { enabled: !!membersTarget },
  );
  const sets: PermissionSet[] = Array.isArray(setsRaw) ? setsRaw : [];

  const { mutate: assignPermissionSet, isPending: isAssigningMember } = useAssignPermissionSet();
  const { mutate: removePermissionSet, isPending: isRemovingMember } = useRemovePermissionSet();

  const PAGE_SIZE = 10;
  const filtered = sets.filter((s) =>
    search ? s.name.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<PermissionSet>[] = [
    {
      key: 'name',
      label: 'Roles',
      width: 'minmax(150px, 0.5fr)',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-brand" />
          </div>
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'members',
      label: 'Members',
      width: '70px',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          {row._count?.users ?? 0}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(200px, 3fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span
          className="text-sm text-gray-500 block truncate max-w-xs lg:max-w-sm xl:max-w-md"
          title={row.description ?? undefined}
        >
          {row.description || <span className="text-gray-400 italic">No description</span>}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(260px, auto)',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <TableButton variant="blue" onClick={() => setMembersTarget(row)}>
            Manage Members
          </TableButton>
          <TableButton
            variant="orange"
            onClick={() =>
              router.push(`/${params.tenantSlug}/hr/hrmanagement/roles/${row.id}/edit`)
            }
          >
            Edit
          </TableButton>
          {!row.isSystem && (
            <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
              Delete
            </TableButton>
          )}
        </div>
      ),
    },
  ];

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/auth/permissions/sets/${deleteTarget.id}`);
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
      toast.success('Permission set deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete permission set'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage roles and control what each role can access
          </p>
        </div>

        <DataTable
          columns={columns}
          data={paged}
          isLoading={isLoading}
          emptyMessage="No permission sets found"
          searchPlaceholder="Search permission sets..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          actionButton={{
            label: 'Create New Role',
            onClick: () => router.push(`/${params.tenantSlug}/hr/hrmanagement/roles/new`),
          }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>

      {membersTarget && (
        <PermissionSetMembersPanel
          isOpen={!!membersTarget}
          onClose={() => setMembersTarget(null)}
          permissionSet={membersTarget}
          members={members}
          users={currentTenantUsers}
          isLoadingMembers={isLoadingMembers}
          isAssigning={isAssigningMember}
          isRemoving={isRemovingMember}
          onAssign={(userId) => {
            assignPermissionSet(
              { userId, permissionSetId: membersTarget.id },
              {
                onSuccess: () => toast.success('Member added to permission set'),
                onError: (err) => toast.error(extractError(err, 'Failed to add member')),
              },
            );
          }}
          onRemove={(userId) => {
            removePermissionSet(
              { userId, permissionSetId: membersTarget.id },
              {
                onSuccess: () => toast.success('Member removed from permission set'),
                onError: (err) => toast.error(extractError(err, 'Failed to remove member')),
              },
            );
          }}
        />
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Role"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
