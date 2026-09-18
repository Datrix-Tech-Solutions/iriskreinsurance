import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { formatDate } from '@/lib/formatters';
import { Column, DataTable } from '../../shared/DataTable';
import { api } from '@/lib/api';

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const PAGE_SIZE = 10;

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function TeamReviewTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team-appraisals'],
    queryFn: () => api.get('/hr/appraisals/team').then((r) => r.data),
  });

  const teamRows = useMemo(() => {
    const list = Array.isArray(teamData) ? teamData : (teamData?.data ?? []);
    return list
      .filter((r: { overallStatus?: string }) =>
        ['SelfSubmitted', 'ManagerSubmitted', 'Finalized'].includes(r.overallStatus ?? ''),
      )
      .map(
        (r: {
          id: unknown;
          employeeId: unknown;
          employeeName?: unknown;
          cycleId: unknown;
          cycleName?: unknown;
          selfSubmittedAt?: unknown;
          managerReviewDeadline?: unknown;
          overallStatus?: string;
        }) => ({
          id: String(r.id),
          employeeId: String(r.employeeId),
          employeeName: String(r.employeeName ?? ''),
          cycleId: String(r.cycleId),
          cycleName: String(r.cycleName ?? ''),
          selfSubmittedAt: r.selfSubmittedAt ? String(r.selfSubmittedAt) : undefined,
          managerReviewDeadline: String(r.managerReviewDeadline ?? ''),
          overallStatus: r.overallStatus ?? 'NotStarted',
        }),
      );
  }, [teamData]);

  const filteredRows = useMemo(() => {
    if (!search) return teamRows;
    const q = search.toLowerCase();
    return teamRows.filter(
      (r: (typeof teamRows)[0]) =>
        r.employeeName.toLowerCase().includes(q) || r.cycleName.toLowerCase().includes(q),
    );
  }, [teamRows, search]);

  const pageData = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  type TeamRow = (typeof teamRows)[0];
  const columns: Column<TeamRow>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    {
      key: 'cycleName',
      label: 'Cycle',
      width: 'minmax(100px, 1fr)',
      render: (r) => <span className="text-gray-700">{r.cycleName}</span>,
    },
    {
      key: 'selfSubmittedAt',
      label: 'Self Submitted',
      width: '150px',
      render: (r) =>
        r.selfSubmittedAt ? (
          <span className="text-sm text-gray-700">{formatDate(r.selfSubmittedAt)}</span>
        ) : (
          <span className="text-sm text-gray-400">Pending</span>
        ),
    },
    {
      key: 'managerReviewDeadline',
      label: 'Manager Deadline',
      width: '150px',
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDate(r.managerReviewDeadline)}</span>
      ),
    },
    {
      key: 'daysLeft',
      label: 'Days Left',
      width: '120px',
      render: (r) => {
        const days = daysUntil(r.managerReviewDeadline);
        return (
          <span
            className={`font-semibold text-sm ${days < 0 ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-700'}`}
          >
            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
          </span>
        );
      },
    },
    {
      key: 'action',
      label: '',
      width: '120px',
      render: (r) => {
        if (r.overallStatus === 'ManagerSubmitted' || r.overallStatus === 'Finalized') {
          return (
            <button
              onClick={() =>
                router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/results/${r.id}`)
              }
              className="text-sm font-medium text-gray-600 hover:text-brand transition-colors"
            >
              View Results
            </button>
          );
        }
        if (r.overallStatus === 'SelfSubmitted') {
          return (
            <button
              onClick={() =>
                router.push(
                  `/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/manager-review/${r.id}`,
                )
              }
              className="px-4 py-1.5 rounded-full border border-blue-700 bg-white text-sm font-medium text-gray-700 hover:bg-blue-300 transition-colors"
            >
              Review
            </button>
          );
        }
        return <span className="text-sm text-gray-400">Awaiting employee</span>;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pageData}
      isLoading={isLoading}
      searchPlaceholder="Search employee or cycle..."
      onSearch={onSearch}
      onRowClick={(r) =>
        router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/manager-review/${r.id}`)
      }
      currentPage={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      emptyMessage="No team members have active appraisals"
      noInternalScroll
    />
  );
}
