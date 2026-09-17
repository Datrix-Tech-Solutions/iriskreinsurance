'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { Users, User, CalendarCheck, BarChart2 } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { CycleProgressSection } from '@/components/molecules/hr/appraisal/CycleProgressSection';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { useAppraisalCycles, useCycleAppraisals } from '@/hooks/hr/useAppraisals';
import { AppBackground } from '@/components/atoms/AppBackground';
import { cn, cardClass } from '@/lib/utils';
import type { AppraisalCycle } from '@/types/hr';

type Tab = 'overview' | 'results';

type AppraisalItem = {
  id: string;
  employeeName?: string | null;
  managerName?: string | null;
  selfStatus?: string;
  managerStatus?: string;
  selfScore?: number | null;
  managerScore?: number | null;
  status?: string;
};

type CycleStatus = 'In Progress' | 'Completed' | 'Upcoming' | 'Cancelled';

function deriveCycleStatus(cycle: AppraisalCycle, completionRate: number): CycleStatus {
  if (cycle.status === 'COMPLETED' || completionRate >= 100) return 'Completed';
  if (cycle.status === 'CANCELLED') return 'Cancelled';
  if (cycle.status === 'UPCOMING') return 'Upcoming';
  return 'In Progress';
}

const STATUS_DOT: Record<CycleStatus, string> = {
  'In Progress': 'bg-blue-500',
  Completed: 'bg-green-500',
  Upcoming: 'bg-gray-400',
  Cancelled: 'bg-red-400',
};

const STATUS_TEXT: Record<CycleStatus, string> = {
  'In Progress': 'text-blue-600',
  Completed: 'text-green-600',
  Upcoming: 'text-gray-500',
  Cancelled: 'text-red-500',
};

function StatusPill({ status }: { status: CycleStatus }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm font-medium', STATUS_TEXT[status])}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[status])} />
      {status}
    </span>
  );
}

function ReviewStatus({ status }: { status?: string }) {
  const submitted = status === 'SUBMITTED';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        submitted ? 'text-green-600' : 'text-amber-500',
      )}
    >
      <span
        className={cn('w-2 h-2 rounded-full shrink-0', submitted ? 'bg-green-500' : 'bg-amber-400')}
      />
      {submitted ? 'Completed' : 'Pending'}
    </span>
  );
}

interface Props {
  tenantSlug: string;
  cycleId: string;
}

export function CycleInProgressContent({ tenantSlug, cycleId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(
    searchParams.get('tab') === 'results' ? 'results' : 'overview',
  );
  const { data: cycles = [] } = useAppraisalCycles();
  const { data: rawAppraisals, isLoading } = useCycleAppraisals(cycleId);

  const cycle = cycles.find((c) => c.id === cycleId);

  const appraisals: AppraisalItem[] = useMemo(() => {
    const list = Array.isArray(rawAppraisals) ? rawAppraisals : (rawAppraisals?.data ?? []);
    return list as AppraisalItem[];
  }, [rawAppraisals]);

  const total = appraisals.length;
  const selfCompleted = appraisals.filter((a) => a.selfStatus === 'SUBMITTED').length;
  const managerCompleted = appraisals.filter((a) => a.managerStatus === 'SUBMITTED').length;
  const fullyCompleted = appraisals.filter((a) => a.status === 'COMPLETED').length;
  const overallPct = total > 0 ? Math.round((fullyCompleted / total) * 100) : 0;

  const cycleStatus: CycleStatus = cycle ? deriveCycleStatus(cycle, overallPct) : 'Upcoming';

  type PendingRow = AppraisalItem & { id: string };
  const pendingRows = appraisals as PendingRow[];

  const columns: Column<PendingRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName || '—'}</span>,
    },
    {
      key: 'manager',
      label: 'Manager',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="text-gray-700">{r.managerName || '—'}</span>,
    },
    {
      key: 'selfStatus',
      label: 'Self Status',
      width: '140px',
      render: (r) => <ReviewStatus status={r.selfStatus} />,
    },
    {
      key: 'selfScore',
      label: 'Employee Score',
      width: '140px',
      render: (r) => (
        <span className="text-gray-700">
          {r.selfScore != null ? `${Math.round(r.selfScore)}%` : '—'}
        </span>
      ),
    },
    {
      key: 'managerStatus',
      label: 'Manager Status',
      width: '160px',
      render: (r) => <ReviewStatus status={r.managerStatus} />,
    },
    {
      key: 'managerScore',
      label: 'Manager Score',
      width: '140px',
      render: (r) => (
        <span className="text-gray-700">
          {r.managerScore != null ? `${Math.round(r.managerScore)}%` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <AppBackground
        as="nav"
        className="sticky top-0 z-10 flex items-center gap-1.5 text-sm text-gray-400 px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-50"
      >
        <Link
          href={`/${tenantSlug}/hr/appraisal`}
          className="hover:text-gray-600 transition-colors"
        >
          Appraisal
        </Link>
        <Icons.ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{cycle?.title ?? 'Cycle'}</span>
      </AppBackground>

      {/* Page body */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8 flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-gray-900">Appraisals</h1>

        {/* Cycle header card */}
        <div className={cardClass('px-6 py-5')}>
          <div className="flex items-center gap-3">
            <p className="text-xl font-bold text-gray-900">{cycle?.title ?? '—'}</p>
            <StatusPill status={cycleStatus} />
          </div>
          <p className="text-sm text-gray-400 mt-1">Results</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 shrink-0">
          {(['overview', 'results'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab === 'overview' ? 'Overview' : 'Individual Results'}
            </button>
          ))}
        </div>

        {activeTab === 'overview' ? (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Employees Included" value={total} icon={Users} />
              <MetricCard label="Self Assessment" value={selfCompleted} icon={User} />
              <MetricCard label="Manager Review" value={managerCompleted} icon={CalendarCheck} />
              <MetricCard label="Overall Completion" value={`${overallPct}%`} icon={BarChart2} />
            </div>

            {/* Progress sections */}
            <CycleProgressSection
              title="Self Assessments"
              completed={selfCompleted}
              total={total}
              entityLabel="employees"
            />
            <CycleProgressSection
              title="Manager Reviews"
              completed={managerCompleted}
              total={total}
              entityLabel="Managers"
            />
          </>
        ) : (
          /* Individual Results tab */
          <DataTable
            columns={columns}
            data={pendingRows}
            isLoading={isLoading}
            emptyMessage="All appraisals are complete"
            currentPage={1}
            totalPages={1}
            onPageChange={() => {}}
            onRowClick={(row) =>
              router.push(`/${tenantSlug}/hr/appraisal/cycles/${cycleId}/employee/${row.id}`)
            }
            noInternalScroll
          />
        )}
      </div>
    </div>
  );
}
