'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { MapPin } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { BranchStatus, HeadOfficeTag } from '@/components/molecules/hr/branches/BranchStatus';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useBranches, useDeleteBranch, useUpdateBranch, useEmployeeOptions } from '@/hooks';
import type { Branch, EmployeeOption } from '@/types/hr';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { BranchFormPanel } from './BranchFormPanel';
import { BranchMembersPanel } from './BranchMembersPanel';

const PAGE_SIZE = 8;

function branchLocation(b: Branch) {
  return [b.city, b.region, b.country].filter(Boolean).join(', ') || '—';
}

export function BranchesTable() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();
  const canCreate = usePermission(Permission.CREATE_BRANCH);
  const canUpdate = usePermission(Permission.UPDATE_BRANCH);
  const canDelete = usePermission(Permission.DELETE_BRANCH);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [membersTarget, setMembersTarget] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useBranches();
  const { data: employees = [] } = useEmployeeOptions();

  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeOption>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    if (!search) return branches;
    const q = search.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.country?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q),
    );
  }, [branches, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { mutate: deleteBranch, isPending: isDeleting } = useDeleteBranch();
  const { mutate: updateBranch, isPending: isTogglingActive } = useUpdateBranch();

  const columns: Column<Branch>[] = [
    {
      key: 'code',
      label: 'Code',
      width: '110px',
      render: (row) => <span className="text-sm text-gray-500">{row.code ?? '—'}</span>,
    },
    {
      key: 'name',
      label: 'Branch Name',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <div className="flex flex-col gap-1 items-start">
          <span className="font-medium text-gray-900">{row.name}</span>
          {row.isHeadOffice && <HeadOfficeTag />}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      width: 'minmax(150px, 1.5fr)',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          {(row.city || row.country) && <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
          <span className="truncate">{branchLocation(row)}</span>
        </div>
      ),
    },
    {
      key: 'managerId',
      label: 'Branch Manager',
      width: 'minmax(150px, 1.5fr)',
      render: (row) => {
        const mgr = row.managerId ? employeeMap.get(row.managerId) : null;
        return mgr ? (
          <span className="text-sm text-gray-900">
            {mgr.firstName} {mgr.lastName}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      },
    },
    {
      key: '_count',
      label: 'Members',
      width: '90px',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">{row._count?.employees ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (row) => <BranchStatus count={row._count?.employees ?? 0} isActive={row.isActive} />,
    },
  ];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteBranch(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Branch deleted');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete branch')),
    });
  };

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={pageData}
        isLoading={isLoading}
        searchPlaceholder="Search branches..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        {...(canCreate && {
          actionButton: { label: 'New Branch', onClick: () => setCreateOpen(true) },
        })}
        onRowClick={(row) =>
          router.push(`/${params.tenantSlug}/hr/hrmanagement/branches/${row.id}`)
        }
        rowActions={(row) => [
          {
            label: 'View Branch',
            onClick: () => router.push(`/${params.tenantSlug}/hr/hrmanagement/branches/${row.id}`),
          },
          ...(canUpdate
            ? [
                { label: 'Edit Branch', onClick: () => setEditTarget(row) },
                { label: 'Add Members', onClick: () => setMembersTarget(row) },
                {
                  label: row.isActive ? 'Deactivate' : 'Activate',
                  onClick: () => setToggleActiveTarget(row),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  label: 'Delete Branch',
                  danger: true,
                  onClick: () => setDeleteTarget(row),
                },
              ]
            : []),
        ]}
        emptyMessage="No branches found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      {(canCreate || canUpdate || canDelete) && (
        <>
          {canCreate && (
            <BranchFormPanel
              isOpen={createOpen}
              onClose={() => setCreateOpen(false)}
              employees={employees}
            />
          )}
          {canUpdate && (
            <>
              <BranchFormPanel
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                branch={editTarget}
                employees={employees}
              />
              <BranchMembersPanel
                isOpen={!!membersTarget}
                onClose={() => setMembersTarget(null)}
                branch={membersTarget}
                employees={employees}
              />
            </>
          )}
          {canUpdate && (
            <Modal
              isOpen={!!toggleActiveTarget}
              onClose={() => setToggleActiveTarget(null)}
              title={toggleActiveTarget?.isActive ? 'Deactivate Branch' : 'Activate Branch'}
              description={
                toggleActiveTarget?.isActive
                  ? `Are you sure you want to deactivate "${toggleActiveTarget?.name}"? Members will remain assigned but the branch will be marked inactive.`
                  : `Are you sure you want to activate "${toggleActiveTarget?.name}"?`
              }
              footer={
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setToggleActiveTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant={toggleActiveTarget?.isActive ? 'danger' : 'primary'}
                    isLoading={isTogglingActive}
                    loadingText={toggleActiveTarget?.isActive ? 'Deactivating...' : 'Activating...'}
                    onClick={() => {
                      if (!toggleActiveTarget) return;
                      updateBranch(
                        { id: toggleActiveTarget.id, isActive: !toggleActiveTarget.isActive },
                        {
                          onSuccess: () => {
                            toast.success(
                              toggleActiveTarget.isActive
                                ? `"${toggleActiveTarget.name}" deactivated`
                                : `"${toggleActiveTarget.name}" activated`,
                            );
                            setToggleActiveTarget(null);
                          },
                          onError: (err: unknown) =>
                            toast.error(extractError(err, 'Failed to update branch')),
                        },
                      );
                    }}
                  >
                    {toggleActiveTarget?.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              }
            />
          )}
          {canDelete && (
            <Modal
              isOpen={!!deleteTarget}
              onClose={() => setDeleteTarget(null)}
              title="Delete Branch"
              description={`Delete "${deleteTarget?.name}"? This cannot be undone. Employees assigned to this branch will be unassigned.`}
              footer={
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={isDeleting}
                    loadingText="Deleting…"
                    onClick={confirmDelete}
                  >
                    Delete Branch
                  </Button>
                </div>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
