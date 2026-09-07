'use client';

import { useState, useMemo } from 'react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ContactCard, PillColor } from '@/components/molecules/ContactCard';
import { EmployeeStatsRow } from '@/components/molecules/hr/employees/EmployeeStatsRow';
import { EmployeeFilterBar } from '@/components/molecules/hr/employees/EmployeeFilterBar';
import { Button } from '@/components/atoms/Button';
import { useEmployees, useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useEmployeesOnLeaveToday } from '@/hooks/hr/useLeave';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Modal } from '@/components/organisms/shared/Modal';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { InviteEmployeePanel } from '@/components/organisms/hr/employee/inviteEmployeePanel';
import { formatDate } from '@/lib/formatters';
import { EmploymentStatus } from '@/types/hr';

const RESTRICTED_STATUSES = ['SUSPENDED', 'OFFBOARDED'];
const PAGE_SIZE = 12;

const STATUS_PILL: Record<EmploymentStatus, { label: string; color: PillColor }> = {
  ACTIVE: { label: 'Permanent', color: 'green' },
  PROBATION: { label: 'Probation', color: 'yellow' },
  ON_LEAVE: { label: 'On Leave', color: 'blue' },
  SUSPENDED: { label: 'Suspended', color: 'red' },
  TERMINATED: { label: 'Terminated', color: 'gray' },
  OFFBOARDED: { label: 'Offboarded', color: 'gray' },
};

interface EmployeeDirectoryProps {
  tenantSlug: string;
}

export function EmployeeDirectory({ tenantSlug }: EmployeeDirectoryProps) {
  const router = useRouter();
  const canInvite = usePermission(Permission.CREATE_EMPLOYEE);
  const canEditEmployee = usePermission(Permission.UPDATE_EMPLOYEE);
  const canOffboardEmployee = usePermission(Permission.OFFBOARD_EMPLOYEE);
  const canViewDetail = canEditEmployee || canOffboardEmployee;
  const canViewRestricted = canEditEmployee || canOffboardEmployee;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [panelOpen, setPanelOpen] = useState(false);
  const [noDeptWarning, setNoDeptWarning] = useState(false);
  const [successEmployee, setSuccessEmployee] = useState<string | null>(null);

  const { data: departments = [], isError: deptsError } = useDepartmentOptions();

  const handleInviteClick = () => {
    // deptsError means the user lacks READ_DEPARTMENTS — they can still invite,
    // the form just won't show the department picker.
    if (!deptsError && departments.length === 0) {
      setNoDeptWarning(true);
    } else {
      setPanelOpen(true);
    }
  };

  const { data: empResult, isLoading } = useEmployees({
    search: search || undefined,
    status: statusFilter || undefined,
    departmentId: deptFilter || undefined,
    limit: 100,
  });
  const { data: allStaff = [], isLoading: isStatsLoading } = useEmployeeOptions();

  const allEmployees = empResult?.data ?? [];
  const filteredEmployees = allEmployees
    .filter((e) => {
      if (e.employmentStatus === 'OFFBOARDED')
        return canViewRestricted && statusFilter === 'OFFBOARDED';
      if (e.employmentStatus === 'SUSPENDED')
        return canViewRestricted && statusFilter === 'SUSPENDED';
      return true;
    })
    .filter((e) => !typeFilter || e.employmentType === typeFilter);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const pagedEmployees = filteredEmployees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { data: onLeaveIds = [] } = useEmployeesOnLeaveToday();
  const onLeaveEmployeeIds = useMemo(() => new Set(onLeaveIds), [onLeaveIds]);

  const summary = useMemo(
    () => ({
      total: allStaff.filter((e) => !RESTRICTED_STATUSES.includes(e.employmentStatus)).length,
      permanent: allStaff.filter((e) => e.employmentStatus === 'ACTIVE').length,
      probation: allStaff.filter((e) => e.employmentStatus === 'PROBATION').length,
      onLeave: allStaff.filter(
        (e) => e.employmentStatus === 'ON_LEAVE' || onLeaveEmployeeIds.has(e.id),
      ).length,
    }),
    [allStaff, onLeaveEmployeeIds],
  );

  const hasActiveFilter = !!(search || statusFilter || deptFilter || typeFilter);
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDeptFilter('');
    setTypeFilter('');
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <h1 className="text-xl font-bold text-gray-900 shrink-0">Employee Directory</h1>

      <EmployeeStatsRow isLoading={isStatsLoading} {...summary} />

      <DataCardGrid
        data={pagedEmployees}
        isLoading={isLoading}
        skeletonCount={8}
        renderSkeleton={() => <div className="w-95 h-56 rounded-xl bg-gray-100 animate-pulse" />}
        searchPlaceholder="Search by name, email, job title..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canInvite ? { label: 'Invite Employee', onClick: handleInviteClick } : undefined
        }
        extraFilters={
          <EmployeeFilterBar
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            deptFilter={deptFilter}
            onDeptChange={(v) => {
              setDeptFilter(v);
              setPage(1);
            }}
            typeFilter={typeFilter}
            onTypeChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
            departments={departments}
            canViewRestricted={canViewRestricted}
            showClear={hasActiveFilter}
            onClear={clearFilters}
          />
        }
        emptyMessage="No employees found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        renderCard={(emp) => (
          <ContactCard
            name={`${emp.firstName} ${emp.lastName}`}
            avatarUrl={emp.avatarUrl}
            subtitle={emp.jobTitle}
            statusPill={
              onLeaveEmployeeIds.has(emp.id)
                ? STATUS_PILL.ON_LEAVE
                : STATUS_PILL[emp.employmentStatus]
            }
            details={[
              {
                label: 'Department',
                value: emp.department?.name ?? '—',
                dotColor: 'bg-orange-500',
              },
              { label: 'Date hired', value: emp.hireDate ? formatDate(emp.hireDate) : '—' },
            ]}
            email={emp.email ?? '—'}
            phone={emp.phone ?? '—'}
            onClick={
              canViewDetail ? () => router.push(`/${tenantSlug}/hr/employees/${emp.id}`) : undefined
            }
          />
        )}
      />

      <Modal
        isOpen={noDeptWarning}
        onClose={() => setNoDeptWarning(false)}
        title="No Departments Found"
        description="You need at least one department before inviting employees. Create a department first, then come back to add your team."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setNoDeptWarning(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setNoDeptWarning(false);
                router.push(`/${tenantSlug}/hr/departments`);
              }}
            >
              Go to Departments
            </Button>
          </div>
        }
      />

      <SuccessModal
        isOpen={!!successEmployee}
        onClose={() => setSuccessEmployee(null)}
        title="Employee Invited!"
        message={`An invite has been sent to ${successEmployee}. They will receive an email to set up their account.`}
      />

      {canInvite && (
        <InviteEmployeePanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          onSuccess={(name) => setSuccessEmployee(name)}
          employees={filteredEmployees}
        />
      )}
    </div>
  );
}
