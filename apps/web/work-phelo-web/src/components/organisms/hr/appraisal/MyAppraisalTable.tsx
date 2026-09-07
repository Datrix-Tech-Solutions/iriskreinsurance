'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useMyAppraisals, useAppraisalCycles } from '@/hooks/hr/useAppraisals';
import { Column, DataTable } from '../../shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

type MyAppraisalStatus =
  | 'In Progress'
  | 'Pending Manager'
  | 'Pending Approval'
  | 'Completed'
  | 'Overdue'
  | 'Cancelled';

const STATUS_CONFIG: Record<MyAppraisalStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  'Pending Manager': { dot: 'bg-amber-400', text: 'text-amber-500' },
  'Pending Approval': { dot: 'bg-purple-400', text: 'text-purple-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Overdue: { dot: 'bg-red-500', text: 'text-red-500' },
  Cancelled: { dot: 'bg-gray-300', text: 'text-gray-400' },
};

function deriveStatus(
  overallStatus: string,
  cycleStatus: string,
  deadline: string,
): MyAppraisalStatus {
  if (overallStatus === 'CANCELLED' || cycleStatus === 'CANCELLED') return 'Cancelled';
  if (overallStatus === 'Finalized') return 'Completed';
  if (overallStatus === 'ManagerSubmitted' || overallStatus === 'PendingFinalization')
    return 'Pending Approval';
  if (overallStatus === 'SelfSubmitted') return 'Pending Manager';
  if (deadline) {
    const today = new Date().toISOString().slice(0, 10);
    if (deadline.slice(0, 10) < today) return 'Overdue';
  }
  return 'In Progress';
}

function formatDeadline(d: string): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PAGE_SIZE = 10;

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function MyAppraisalsTable({ search, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: myData, isLoading } = useMyAppraisals();
  const { data: cycles = [] } = useAppraisalCycles();

  const myRows = useMemo(() => {
    const list = Array.isArray(myData) ? myData : [];
    return list.map(
      (r: {
        id: unknown;
        cycleId: unknown;
        cycleName?: unknown;
        cycleStatus?: string;
        overallStatus?: string;
        finalScore?: number | null;
      }) => {
        const cycleId = String(r.cycleId ?? '');
        const cycle = cycles.find((c) => c.id === cycleId);
        return {
          id: String(r.id),
          cycleId,
          cycleName: String(r.cycleName ?? cycle?.title ?? ''),
          cycleStatus: r.cycleStatus ?? 'Upcoming',
          overallStatus: r.overallStatus ?? 'NotStarted',
          overallScore: r.finalScore != null ? Math.round(Number(r.finalScore)) : undefined,
          selfAssessmentDeadline: cycle?.selfAssessmentDeadline ?? '',
        };
      },
    );
  }, [myData, cycles]);

  const filteredRows = useMemo(() => {
    let rows = myRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.cycleName.toLowerCase().includes(q));
    }
    if (statusFilter) {
      rows = rows.filter(
        (r) =>
          deriveStatus(r.overallStatus, r.cycleStatus, r.selfAssessmentDeadline) === statusFilter,
      );
    } else {
      rows = rows.filter(
        (r) =>
          deriveStatus(r.overallStatus, r.cycleStatus, r.selfAssessmentDeadline) !== 'Cancelled',
      );
    }
    return rows;
  }, [myRows, search, statusFilter]);

  const pageData = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  type MyRow = (typeof myRows)[0];

  const columns: Column<MyRow>[] = [
    {
      key: 'cycleName',
      label: 'Cycle Name',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.cycleName}</span>,
    },
    {
      key: 'selfAssessmentDeadline',
      label: 'Self-Assessment Deadline',
      width: '200px',
      render: (r) => (
        <span className="text-gray-700">{formatDeadline(r.selfAssessmentDeadline)}</span>
      ),
    },
    {
      key: 'overallScore',
      label: 'Overall Score',
      width: '150px',
      render: (r) => {
        const managerReviewed =
          r.overallStatus === 'Finalized' || r.overallStatus === 'ManagerSubmitted';
        if (managerReviewed && r.overallScore != null) {
          return <span className="font-medium text-gray-900">{r.overallScore}%</span>;
        }
        return <span className="text-gray-400">—</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      render: (r) => {
        const status = deriveStatus(r.overallStatus, r.cycleStatus, r.selfAssessmentDeadline);
        const s = STATUS_CONFIG[status];
        return (
          <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
            <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
            {status}
          </span>
        );
      },
    },
    {
      key: 'action',
      label: '',
      width: '160px',
      render: (r) => {
        const status = deriveStatus(r.overallStatus, r.cycleStatus, r.selfAssessmentDeadline);
        if (status === 'Cancelled') return null;
        if (status === 'In Progress' || status === 'Overdue') {
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <TableButton
                variant="green"
                onClick={() =>
                  router.push(
                    `/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/self-assessment/${r.id}`,
                  )
                }
              >
                Start
              </TableButton>
            </div>
          );
        }
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <TableButton
              variant="blue"
              onClick={() =>
                router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/results/${r.id}`)
              }
            >
              View Assessment
            </TableButton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Custom toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              onPageChange(1);
            }}
            className="appearance-none pl-4 pr-8 py-2 border border-gray-200 rounded-input text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white font-medium"
          >
            <option value="">All</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Manager">Pending Manager</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <Icons.ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-4 w-4" />
        </div>

        <div className="flex-1" />
      </div>

      {/* Table — pass data without triggering DataTable's own toolbar */}
      <DataTable
        columns={columns}
        data={pageData}
        isLoading={isLoading}
        emptyMessage="No appraisal cycles assigned to you yet"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onRowClick={(r) => {
          const status = deriveStatus(r.overallStatus, r.cycleStatus, r.selfAssessmentDeadline);
          if (status === 'Cancelled') return;
          if (status === 'In Progress' || status === 'Overdue') {
            router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/self-assessment/${r.id}`);
          } else {
            router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/results/${r.id}`);
          }
        }}
        noInternalScroll
      />
    </div>
  );
}
