'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { api } from '@/lib/api';
import { AppraisalCycle, FinalRating, CycleResultItem, CycleResultsSummary } from '@/types/hr';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { RatingBadge } from '@/components/molecules/hr/appraisal/RatingBadge';
import { RatingDistributionChart } from '@/components/molecules/hr/appraisal/RatingDistributionChart';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { formatDate } from '@/lib/formatters';
import { AppBackground } from '@/components/atoms/AppBackground';
import { cn, cardClass } from '@/lib/utils';

const ALL_RATINGS: FinalRating[] = [
  'Outstanding',
  'Very Good',
  'Good',
  'Satisfactory',
  'Needs Improvement',
];

type Tab = 'overview' | 'results';

interface Props {
  tenantSlug: string;
  cycleId: string;
}

export function CycleResultsContent({ tenantSlug, cycleId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(
    searchParams.get('tab') === 'results' ? 'results' : 'overview',
  );
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  const { data: cycle, isLoading: cycleLoading } = useQuery<AppraisalCycle>({
    queryKey: ['appraisal-cycle', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}`).then((r) => r.data),
  });

  const { data: summary, isLoading: resultsLoading } = useQuery<CycleResultsSummary>({
    queryKey: ['cycle-results', tenantSlug, cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/results`).then((r) => r.data),
    enabled: !!cycleId,
  });

  const results = useMemo<CycleResultItem[]>(() => summary?.results ?? [], [summary?.results]);

  const exceeded = useMemo(
    () =>
      results.filter((r) => r.finalRating === 'Outstanding' || r.finalRating === 'Very Good')
        .length,
    [results],
  );
  const needsImprovement = useMemo(
    () => results.filter((r) => r.finalRating === 'Needs Improvement').length,
    [results],
  );

  const departments = useMemo(() => {
    const set = new Set(results.map((r) => r.department));
    return Array.from(set).sort();
  }, [results]);

  const filtered = useMemo(() => {
    let data = results;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) => r.employeeName.toLowerCase().includes(q));
    }
    if (deptFilter) data = data.filter((r) => r.department === deptFilter);
    if (ratingFilter) data = data.filter((r) => r.finalRating === ratingFilter);
    return [...data].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [results, search, deptFilter, ratingFilter]);

  const distribution = useMemo(() => {
    const total = results.length || 1;
    return ALL_RATINGS.map((rating) => {
      const count = results.filter((r) => r.finalRating === rating).length;
      return { rating, count, percentage: Math.round((count / total) * 100) };
    });
  }, [results]);

  const columns: Column<CycleResultItem>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      width: 'minmax(100px, 1fr)',
      render: (r) => <span>{r.department || '—'}</span>,
    },
    {
      key: 'jobTitle',
      label: 'Job Title',
      width: '150px',
      render: (r) => <span>{r.jobTitle || '—'}</span>,
    },
    {
      key: 'managerName',
      label: 'Manager',
      width: '150px',
      render: (r) => <span>{r.managerName || '—'}</span>,
    },
    {
      key: 'selfScore',
      label: 'Self (%)',
      width: '100px',
      render: (r) => (
        <span className="text-gray-700">
          {r.selfScore != null ? `${Math.round(r.selfScore)}%` : '—'}
        </span>
      ),
    },
    {
      key: 'managerScore',
      label: 'Manager (%)',
      width: '120px',
      render: (r) => (
        <span className="text-gray-700">
          {r.managerScore != null ? `${Math.round(r.managerScore)}%` : '—'}
        </span>
      ),
    },
    {
      key: 'overallScore',
      label: 'Final (%)',
      width: '100px',
      render: (r) => (
        <span className="font-medium text-gray-900">
          {r.overallScore != null ? `${Math.round(r.overallScore)}%` : '—'}
        </span>
      ),
    },
    {
      key: 'finalRating',
      label: 'Rating',
      width: '180px',
      render: (r) => <RatingBadge rating={r.finalRating} />,
    },
    {
      key: 'reviewCompletedAt',
      label: 'Completed',
      width: '120px',
      render: (r) => <span>{formatDate(r.reviewCompletedAt)}</span>,
    },
  ];

  if (cycleLoading) {
    return <div className="p-4 sm:p-6 lg:p-8 text-sm text-gray-400">Loading…</div>;
  }

  if (!cycle) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
        <p className="text-sm text-red-500">Cycle not found.</p>
        <Link href={`/${tenantSlug}/hr/appraisal`} className="text-sm text-brand hover:underline">
          Back to Appraisals
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <AppBackground
        as="nav"
        className="sticky top-0 z-10 flex items-center gap-2 text-sm text-gray-400 px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-50"
      >
        <Link
          href={`/${tenantSlug}/hr/appraisal`}
          className="hover:text-gray-600 transition-colors"
        >
          Appraisal
        </Link>
        <span>›</span>
        <span className="text-gray-600">{cycle.title}</span>
      </AppBackground>

      {/* Page body */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8 flex flex-col gap-6">
        {/* Cycle header */}
        <div className="flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{cycle.title}</h1>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              Completed
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
          </p>
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

        {resultsLoading ? (
          <div className="text-sm text-gray-400">Loading results…</div>
        ) : activeTab === 'overview' ? (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
              <MetricCard
                label="Total Reviewed"
                value={summary?.reviewedCount ?? 0}
                sub={`of ${summary?.totalEmployees ?? 0} employees`}
              />
              <MetricCard label="Completion Rate" value={`${summary?.completionRate ?? 0}%`} />
              <MetricCard
                label="Exceeded Expectations"
                value={exceeded}
                sub="Outstanding or Very Good"
                highlight="green"
              />
              <MetricCard
                label="Needs Improvement"
                value={needsImprovement}
                highlight={needsImprovement > 0 ? 'red' : undefined}
              />
            </div>

            {/* Rating distribution */}
            <div className={cardClass('shrink-0')}>
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Rating Distribution</h2>
              </div>
              <RatingDistributionChart data={distribution} />
            </div>
          </>
        ) : (
          /* Results tab */
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-input text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-input text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">All Ratings</option>
                {ALL_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <DataTable<CycleResultItem>
              columns={columns}
              data={filtered}
              isLoading={false}
              searchPlaceholder="Search employee…"
              onSearch={setSearch}
              onRowClick={(row) =>
                router.push(`/${tenantSlug}/hr/appraisal/cycles/${cycleId}/employee/${row.id}`)
              }
              emptyMessage="No results match your filters"
              currentPage={1}
              totalPages={1}
              onPageChange={() => {}}
              noInternalScroll
            />
          </div>
        )}
      </div>
    </div>
  );
}
