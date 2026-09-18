'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { useDepartment } from '@/hooks/hr/useDepartments';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { DepartmentOverview } from '@/components/molecules/hr/departments/DepartmentOverview';
import { DepartmentMembersTable } from '@/components/organisms/hr/departments/departmentMembersTable';
import { EditDepartmentPanel } from '@/components/organisms/hr/departments/editDepartmentPanel';

export default function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);

  const [editOpen, setEditOpen] = useState(false);

  const canUpdate = usePermission(Permission.UPDATE_DEPARTMENT);

  const { data: department, isLoading } = useDepartment(id);
  const { data: employeeOptions = [] } = useEmployeeOptions();

  const managerName = (() => {
    if (!department?.managerId) return undefined;
    const mgr = employeeOptions.find((e) => e.id === department.managerId);
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : undefined;
  })();

  const departmentsBase = `/${tenantSlug}/hr/hrmanagement/departments`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={departmentsBase} className="hover:text-gray-700 transition-colors">
            Departments
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{department?.name ?? '—'}</span>
        </nav>

        {canUpdate && department && (
          <Button size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !department ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Department not found.
        </div>
      ) : (
        <>
          <DepartmentOverview department={department} managerName={managerName} />
          <DepartmentMembersTable
            departmentId={department.id}
            departmentName={department.name}
            managerId={department.managerId}
          />
        </>
      )}

      {canUpdate && (
        <EditDepartmentPanel
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          editTarget={editOpen ? (department ?? null) : null}
        />
      )}
    </div>
  );
}
