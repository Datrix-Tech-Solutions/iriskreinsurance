'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Avatar } from '@/components/atoms/Avatar';
import { EmploymentStatusBadge } from '@/components/molecules/hr/employees/EmploymentStatusBadge';
import { AddMembersPanel } from './addMembersPanel';
import { useAllEmployees, useEmployeeOptions, useUpdateEmployee } from '@/hooks/hr/useEmployees';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { Employee } from '@/types/hr';

const PAGE_SIZE = 8;

const STATUS_FILTER_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PROBATION', label: 'Probation' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'OFFBOARDED', label: 'Offboarded' },
];

interface Props {
  departmentId: string;
  departmentName: string;
  managerId?: string;
}

export function DepartmentMembersTable({ departmentId, departmentName, managerId }: Props) {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();

  const canUpdate = usePermission(Permission.UPDATE_DEPARTMENT);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading } = useAllEmployees({ departmentId });
  const { data: employeeOptions = [] } = useEmployeeOptions();
  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployee();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (data?.data ?? []).filter((e) => {
      const matchesStatus = statusFilter
        ? e.employmentStatus === statusFilter
        : e.employmentStatus !== 'OFFBOARDED';
      const matchesSearch =
        !q ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.jobTitle?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [data, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const members = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAddMembers = async (deptId: string, employeeIds: string[]) => {
    try {
      await Promise.all(employeeIds.map((id) => updateEmployeeAsync({ id, departmentId: deptId })));
      setPanelOpen(false);
    } catch (err) {
      toast.error(extractError(err, 'Failed to add members'));
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      label: 'Employee',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.firstName} ${row.lastName}`} avatarUrl={row.avatarUrl} size="sm" />
          <p className="font-medium text-gray-900">
            {row.firstName} {row.lastName}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: 'minmax(150px, 1fr)',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-700">{row.jobTitle}</span>
          {row.id === managerId && (
            <span className="text-xs font-medium text-brand">Department Head</span>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      width: 'minmax(150px, 1fr)',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-700">{row.email}</span>
          {row.phone && <span className="text-xs text-gray-400">{row.phone}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      render: (row) => <EmploymentStatusBadge status={row.employmentStatus} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        isLoading={isLoading}
        searchPlaceholder="Search members..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        filterOptions={STATUS_FILTER_OPTIONS}
        onFilter={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onRowClick={(row) => router.push(`/${params.tenantSlug}/hr/employees/${row.id}`)}
        {...(canUpdate && {
          actionButton: { label: 'Add Members', onClick: () => setPanelOpen(true) },
        })}
        emptyMessage="No members in this department"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      {canUpdate && (
        <AddMembersPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          department={{ id: departmentId, name: departmentName }}
          employees={employeeOptions}
          onAddMembers={handleAddMembers}
        />
      )}
    </>
  );
}
