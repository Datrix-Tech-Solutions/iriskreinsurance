import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { formatDate } from '@/lib/formatters';
import { Column, DataTable } from '../../shared/DataTable';
import { useAppraisalCycles, useCycleAppraisals } from '@/hooks/hr/useAppraisals';
import { cn } from '@/lib/utils';

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

type CycleStatus = 'In Progress' | 'Completed' | 'Upcoming' | 'Expired';

const CYCLE_STATUS_STYLES: Record<CycleStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Upcoming: { dot: 'bg-gray-400', text: 'text-gray-500' },
  Expired: { dot: 'bg-red-400', text: 'text-red-500' },
};

type CycleAppraisalItem = {
  selfStatus?: string;
  managerStatus?: string;
  status?: string;
  finalScore?: number | null;
};

function useCycleCompletion(cycleId: string) {
  const { data: raw } = useCycleAppraisals(cycleId);
  const appraisals: CycleAppraisalItem[] = useMemo(() => {
    if (Array.isArray(raw)) return raw as CycleAppraisalItem[];
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).data))
      return (raw as { data: CycleAppraisalItem[] }).data;
    return [];
  }, [raw]);

  const total = appraisals.length;
  const selfCompleted = appraisals.filter((a) => a.selfStatus === 'SUBMITTED').length;
  const managerCompleted = appraisals.filter((a) => a.managerStatus === 'SUBMITTED').length;
  const finalized = appraisals.filter(
    (a) => a.status === 'COMPLETED' || a.finalScore != null,
  ).length;
  const rate = total > 0 ? Math.round(((selfCompleted + managerCompleted) / (total * 2)) * 100) : 0;
  const allFinalized = total > 0 && finalized === total;
  return { total, rate, allFinalized };
}

function CompletionCell({ cycleId }: { cycleId: string }) {
  const { rate } = useCycleCompletion(cycleId);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-24">
        <div
          className="h-full bg-brand rounded-full transition-all"
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 shrink-0 w-9 text-right">{rate}%</span>
    </div>
  );
}

function EmployeeCountCell({ cycleId, fallback }: { cycleId: string; fallback?: number }) {
  const { total } = useCycleCompletion(cycleId);
  return <span className="font-medium text-gray-700">{total || fallback || '—'}</span>;
}

function StatusCell({
  cycleId,
  startDate,
  endDate,
}: {
  cycleId: string;
  startDate: string;
  endDate: string;
}) {
  const { total, allFinalized } = useCycleCompletion(cycleId);
  const status = deriveCycleStatus(startDate, endDate, total, allFinalized);
  const s = CYCLE_STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {status}
    </span>
  );
}

function deriveCycleStatus(
  startDate: string,
  endDate: string,
  totalAppraisals: number,
  allFinalized: boolean,
): CycleStatus {
  if (allFinalized) return 'Completed';
  const today = new Date().toISOString().slice(0, 10);
  if (endDate < today) return 'Expired';
  if (totalAppraisals > 0) return 'In Progress';
  if (startDate > today) return 'Upcoming';
  return 'In Progress';
}

export function HRAppraisalsTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { data: hrData, isLoading } = useAppraisalCycles({ page, search: search || undefined });

  type HRCycleRow = {
    id: string;
    title: string;
    frequency: string;
    startDate: string;
    endDate: string;
    totalEmployees?: number;
    completionRate?: number;
    status?: string;
    isActive?: boolean;
  };

  const hrCycles = useMemo<HRCycleRow[]>(
    () =>
      (hrData ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        frequency: c.frequency ?? '',
        startDate: c.startDate,
        endDate: c.endDate,
        isActive: c.isActive,
        totalEmployees:
          (c as unknown as { totalEmployees?: number }).totalEmployees ?? c._count?.appraisals,
        completionRate: c.completionRate,
      })),
    [hrData],
  );

  const totalPages = 1;

  const columns: Column<HRCycleRow>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
    },
    {
      key: 'date range',
      label: 'Date range',
      width: '150px',
      render: (r) => (
        <span className="text-xs text-gray-600">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </span>
      ),
    },
    {
      key: 'totalEmployees',
      label: 'Employees',
      width: '100px',
      render: (r) => <EmployeeCountCell cycleId={r.id} fallback={r.totalEmployees} />,
    },
    {
      key: 'completionRate',
      label: 'Completion',
      width: '200px',
      render: (r) => <CompletionCell cycleId={r.id} />,
    },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (r) => <StatusCell cycleId={r.id} startDate={r.startDate} endDate={r.endDate} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={hrCycles}
      isLoading={isLoading}
      searchPlaceholder="Search cycles..."
      onSearch={onSearch}
      currentPage={page}
      totalPages={totalPages}
      onRowClick={(row) => router.push(`/${tenantSlug}/hr/appraisal/cycles/${row.id}`)}
      onPageChange={onPageChange}
      emptyMessage="No appraisal cycles created yet"
      noInternalScroll
    />
  );
}
