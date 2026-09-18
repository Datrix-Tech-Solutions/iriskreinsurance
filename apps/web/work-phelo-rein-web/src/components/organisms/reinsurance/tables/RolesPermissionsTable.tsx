'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, Users } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { usePermissionRule, useCanAccessRoles } from '@/hooks/hr/usePermission';
import {
  usePermissionSets,
  useDeletePermissionSet,
  usePermissionSetMembers,
  useAssignPermissionSet,
  useRemovePermissionSet,
} from '@/hooks/hr/useRoles';
import { useCurrentTenantUsers } from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PermissionSetMembersPanel } from '@/components/organisms/roles/PermissionSetMembersPanel';
import type { PermissionSet } from '@/types/roles';

const PAGE_SIZE = 10;

export function RolesPermissionsTable() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const base = `/${params.tenantSlug}/operations/reinsurance/settings/rolespermissions`;
  const canAccessRoles = useCanAccessRoles();
  const canCreateRoles = usePermissionRule('permission-sets:CREATE');
  const canEditRoles = usePermissionRule('permission-sets:EDIT');
  const canDeleteRoles = usePermissionRule('permission-sets:DELETE');
  const canAssignRoles = usePermissionRule('permission-sets:ASSIGN');

  const { data: sets = [], isLoading } = usePermissionSets({ enabled: canAccessRoles });
  const { mutate: deletePermissionSet, isPending: isDeleting } = useDeletePermissionSet();
  const { mutate: assignPermissionSet, isPending: isAssigningMember } = useAssignPermissionSet();
  const { mutate: removePermissionSet, isPending: isRemovingMember } = useRemovePermissionSet();

  const [deleteTarget, setDeleteTarget] = useState<PermissionSet | null>(null);
  const [membersTarget, setMembersTarget] = useState<PermissionSet | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: currentTenantUsers = [] } = useCurrentTenantUsers();
  const { data: members = [], isLoading: isLoadingMembers } = usePermissionSetMembers(
    membersTarget?.id ?? '',
    { enabled: !!membersTarget },
  );

  // The tenant endpoint returns every permission set; show only the ones that
  // grant reinsurance-operations resources (operations-created roles).
  const operationsSets = useMemo(
    () =>
      sets.filter((s) =>
        s.resources.some((r) => r.resource.name.startsWith('operations.reinsurance.')),
      ),
    [sets],
  );

  const filtered = useMemo(
    () =>
      operationsSets.filter((s) =>
        search ? s.name.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [operationsSets, search],
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
      width: 'minmax(280px, auto)',
      render: (row) => (
        <div className="flex items-center gap-3.5" onClick={(e) => e.stopPropagation()}>
          {canAssignRoles && (
            <TableButton variant="green" onClick={() => setMembersTarget(row)}>
              Manage Members
            </TableButton>
          )}
          {canEditRoles && !row.isSystem && (
            <TableButton variant="blue" onClick={() => router.push(`${base}/${row.id}/edit`)}>
              Edit
            </TableButton>
          )}
          {canDeleteRoles && !row.isSystem && (
            <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
              Delete
            </TableButton>
          )}
        </div>
      ),
    },
  ];

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deletePermissionSet(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Role deleted');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete role')),
    });
  };

  if (!canAccessRoles) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        You don&apos;t have permission to view roles and permissions.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage roles and control what each role can access within reinsurance operations
          </p>
        </div>

        <DataTable
          columns={columns}
          data={paged}
          isLoading={isLoading}
          emptyMessage="No roles found"
          searchPlaceholder="Search roles..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          actionButton={
            canCreateRoles
              ? { label: 'Create New Role', onClick: () => router.push(`${base}/new`) }
              : undefined
          }
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
                onSuccess: () => toast.success('Member added to role'),
                onError: (err) => toast.error(extractError(err, 'Failed to add member')),
              },
            );
          }}
          onRemove={(userId) => {
            removePermissionSet(
              { userId, permissionSetId: membersTarget.id },
              {
                onSuccess: () => toast.success('Member removed from role'),
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
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting…"
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
