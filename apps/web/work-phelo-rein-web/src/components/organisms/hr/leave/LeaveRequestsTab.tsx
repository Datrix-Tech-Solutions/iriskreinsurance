'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Badge } from '@/components/atoms/Badge';
import { Avatar } from '@/components/atoms/Avatar';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { LeaveRequestDetailPanel } from '@/components/organisms/hr/leave/LeaveRequestDetailPanel';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { useLeaveTypes, useLeaveRequests } from '@/hooks/hr/useLeave';
import { useDepartments } from '@/hooks/hr/useDepartments';
import { formatDate } from '@/lib/formatters';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/hr';
import { CalendarDays, Clock, Users } from 'lucide-react';

const STATUS_VARIANT: Record<LeaveRequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

interface Props {
  tenantSlug: string;
  canReview: boolean;
}

export function LeaveRequestsTab({ tenantSlug, canReview }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterFrom] = useState('');
  const [reqPage, setReqPage] = useState(1);

  const { data: leaveTypesRaw } = useLeaveTypes(tenantSlug);
  const leaveTypes: LeaveType[] = Array.isArray(leaveTypesRaw)
    ? leaveTypesRaw
    : ((leaveTypesRaw as { data?: LeaveType[] } | undefined)?.data ?? []);

  const { data: departmentsRaw } = useDepartments();
  const departments: { id: string; name: string }[] = Array.isArray(departmentsRaw)
    ? departmentsRaw
    : ((departmentsRaw as { data?: { id: string; name: string }[] } | undefined)?.data ?? []);

  const { data: allEmployeeOptions, isLoading: employeesLoading } = useEmployeeOptions();
  const totalEmployees = allEmployeeOptions?.length ?? 0;

  const { data: reqList = [], isLoading: reqLoading } = useLeaveRequests();
  const requestIdFromQuery = searchParams.get('requestId');

  const selectedRequest = useMemo(
    () => reqList.find((r) => r.id === requestIdFromQuery) ?? null,
    [requestIdFromQuery, reqList],
  );

  const totalRequests = reqList.length;
  const pendingCount = useMemo(
    () => reqList.filter((r) => r.status === 'PENDING').length,
    [reqList],
  );

  const filteredRequests = useMemo(() => {
    return reqList.filter((r) => {
      if (search && !r.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterLeaveType && r.leaveTypeId !== filterLeaveType) return false;
      if (filterFrom && r.createdAt.slice(0, 10) < filterFrom) return false;
      return true;
    });
  }, [reqList, search, filterLeaveType, filterFrom]);

  const PAGE_SIZE = 10;
  const reqTotalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pagedRequests = filteredRequests.slice((reqPage - 1) * PAGE_SIZE, reqPage * PAGE_SIZE);

  const handleRequestOpen = (request: LeaveRequest) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'requests');
    params.set('requestId', request.id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleRequestClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('requestId');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employeeName',
      label: 'Employee Name',
      width: 'minmax(200px, 1.5fr)',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.employeeName} avatarUrl={r.employeeAvatarUrl} size="sm" />
          <span className="font-medium text-gray-900">{r.employeeName}</span>
        </div>
      ),
    },
    {
      key: 'leaveTypeName',
      label: 'Leave Type',
      width: 'minmax(150px, 1fr)',
      render: (r) => <span className="text-gray-700">{r.leaveTypeName}</span>,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      width: '150px',
      render: (r) => <span className="text-gray-700">{formatDate(r.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      width: '150px',
      render: (r) => <span className="text-gray-700">{formatDate(r.endDate)}</span>,
    },
    {
      key: 'totalDays',
      label: 'Days',
      width: '72px',
      render: (r) => <span className="text-gray-700">{r.totalDays}</span>,
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      width: '150px',
      render: (r) => <span className="text-gray-500 text-sm">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]} label={r.status} />,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 shrink-0">
          <KpiCard
            label="Total Leave Requests"
            value={totalRequests}
            icon={CalendarDays}
            iconColor="#2a78d6"
            isLoading={reqLoading}
          />
          <KpiCard
            label="Pending Approval"
            value={pendingCount}
            icon={Clock}
            iconColor="#eab308"
            isLoading={reqLoading}
          />
          <KpiCard
            label="Total Employees"
            value={totalEmployees}
            icon={Users}
            iconColor="#6b7280"
            isLoading={employeesLoading}
          />
        </div>

        <DataTable
          columns={columns}
          data={pagedRequests}
          isLoading={reqLoading}
          searchPlaceholder="Search by employee name…"
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setReqPage(1);
          }}
          extraFilters={
            <>
              <div className="w-44">
                <SearchSelect
                  placeholder="All leave types"
                  size="sm"
                  options={[
                    { value: '', label: 'All leave types' },
                    ...leaveTypes.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  value={filterLeaveType}
                  onChange={(v) => {
                    setFilterLeaveType(v);
                    setReqPage(1);
                  }}
                />
              </div>
              <div className="w-44">
                <SearchSelect
                  placeholder="All departments"
                  size="sm"
                  options={[
                    { value: '', label: 'All departments' },
                    ...departments.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                  value={filterDepartment}
                  onChange={(v) => {
                    setFilterDepartment(v);
                    setReqPage(1);
                  }}
                />
              </div>
            </>
          }
          emptyMessage="No leave requests found"
          currentPage={reqPage}
          totalPages={reqTotalPages}
          onPageChange={setReqPage}
          onRowClick={(row) => handleRequestOpen(row)}
          noInternalScroll
        />
      </div>

      <LeaveRequestDetailPanel
        isOpen={!!selectedRequest}
        onClose={handleRequestClose}
        tenantSlug={tenantSlug}
        request={selectedRequest}
        canReview={canReview}
      />
    </>
  );
}
