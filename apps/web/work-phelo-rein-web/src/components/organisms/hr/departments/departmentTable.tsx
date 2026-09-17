'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import {
  useDepartments,
  useUpdateDepartment,
  useDeleteDepartment,
} from '@/hooks/hr/useDepartments';
import { useEmployeeOptions, useUpdateEmployee } from '@/hooks/hr/useEmployees';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useToast } from '@/hooks/useToast';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { extractError } from '@/lib/extractError';
import type { Department } from '@/types/hr';
import { AddMembersPanel } from './addMembersPanel';
import { CreateDepartmentPanel } from './createDepartmentPanel';
import { EditDepartmentPanel } from './editDepartmentPanel';

const PAGE_SIZE = 8;

export function DepartmentsTable() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();

  const canCreate = usePermission(Permission.CREATE_DEPARTMENT);
  const canUpdate = usePermission(Permission.UPDATE_DEPARTMENT);
  const canDelete = usePermission(Permission.DELETE_DEPARTMENT);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [membersTarget, setMembersTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = useState<Department | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  const { data: departments = [], isLoading } = useDepartments();
  const { data: employees = [] } = useEmployeeOptions();

  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployee();
  const { mutateAsync: updateDepartmentAsync } = useUpdateDepartment();
  const { mutate: deleteDepartment, isPending: isDeleting } = useDeleteDepartment();
  const { mutate: updateDepartment, isPending: isTogglingActive } = useUpdateDepartment();

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`])),
    [employees],
  );

  const filtered = useMemo(() => {
    if (!search) return departments;
    const q = search.toLowerCase();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAddMembers = async (departmentId: string, employeeIds: string[]) => {
    await Promise.all(
      employeeIds.map(async (empId) => {
        const oldDept = departments.find((d) => d.managerId === empId && d.id !== departmentId);
        if (oldDept) {
          await updateDepartmentAsync({ id: oldDept.id, managerId: null });
        }
        await updateEmployeeAsync({ id: empId, departmentId });
      }),
    );
  };

  const handleToggleActiveConfirm = () => {
    if (!toggleActiveTarget) return;
    updateDepartment(
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
        onError: (err) => toast.error(extractError(err, 'Failed to update department')),
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteDepartment(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete department')),
    });
  };

  const columns: Column<Department>[] = [
    {
      key: 'name',
      label: 'Department Name',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'manager',
      label: 'Department Head',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {row.managerId ? (employeeMap.get(row.managerId) ?? '—') : '—'}
        </span>
      ),
    },
    {
      key: 'memberCount',
      label: 'Members',
      width: '120px',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">{row._count?.employees ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => {
        const count = row._count?.employees ?? 0;
        if (!row.isActive) return <Badge variant="neutral" label="Inactive" />;
        if (count === 0) return <Badge variant="warning" label="Empty" />;
        return <Badge variant="success" label="Active" />;
      },
    },
  ];

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search departments..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        {...(canCreate && {
          actionButton: { label: 'New Department', onClick: () => setCreateOpen(true) },
        })}
        onRowClick={(row) =>
          router.push(`/${params.tenantSlug}/hr/hrmanagement/departments/${row.id}`)
        }
        rowActions={(row) => [
          {
            label: 'View Department',
            onClick: () =>
              router.push(`/${params.tenantSlug}/hr/hrmanagement/departments/${row.id}`),
          },
          ...(canUpdate
            ? [
                { label: 'Edit Department', onClick: () => setEditTarget(row) },
                { label: 'Add Members', onClick: () => setMembersTarget(row) },
                {
                  label: row.isActive ? 'Deactivate' : 'Activate',
                  onClick: () => setToggleActiveTarget(row),
                },
              ]
            : []),
          ...(canDelete
            ? [{ label: 'Delete', onClick: () => setDeleteTarget(row), danger: true }]
            : []),
        ]}
        emptyMessage="No departments found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      {canCreate && (
        <CreateDepartmentPanel
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          tenantSlug={params.tenantSlug}
          employees={employees}
          onSuccess={(name) => setSuccessName(name)}
        />
      )}

      {canUpdate && (
        <>
          <EditDepartmentPanel
            isOpen={!!editTarget}
            onClose={() => setEditTarget(null)}
            editTarget={editTarget}
          />
          <AddMembersPanel
            isOpen={!!membersTarget}
            onClose={() => setMembersTarget(null)}
            department={membersTarget}
            employees={employees}
            onAddMembers={handleAddMembers}
          />
          <Modal
            isOpen={!!toggleActiveTarget}
            onClose={() => setToggleActiveTarget(null)}
            title={toggleActiveTarget?.isActive ? 'Deactivate Department' : 'Activate Department'}
            description={
              toggleActiveTarget?.isActive
                ? `Are you sure you want to deactivate "${toggleActiveTarget?.name}"? Members will remain assigned but the department will be marked inactive.`
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
                  onClick={handleToggleActiveConfirm}
                >
                  {toggleActiveTarget?.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            }
          />
        </>
      )}

      {canDelete && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Department"
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
                Delete Department
              </Button>
            </div>
          }
        />
      )}

      <SuccessModal
        isOpen={!!successName}
        onClose={() => setSuccessName(null)}
        title="Department Created!"
        message={`"${successName}" has been added to your organisation.`}
      />
    </div>
  );
}
