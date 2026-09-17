'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAppraisal, useAppraisalCycles } from '@/hooks';
import { cn } from '@/lib/utils';

interface KpiScoreRow {
  kpiId: string;
  title: string;
  weight: number;
  maxScore: number;
  score: number;
  comment?: string;
}

const STATUS_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  Finalized: { dot: 'bg-green-500', text: 'text-green-600', label: 'Completed' },
  PendingFinalization: { dot: 'bg-purple-400', text: 'text-purple-600', label: 'Pending Approval' },
  ManagerSubmitted: { dot: 'bg-purple-400', text: 'text-purple-600', label: 'Pending Approval' },
  SelfSubmitted: { dot: 'bg-amber-400', text: 'text-amber-500', label: 'Pending Manager' },
  NotStarted: { dot: 'bg-blue-500', text: 'text-blue-600', label: 'In Progress' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.NotStarted;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}

function scoreToPercent(score: number | null | undefined): string {
  if (score == null) return '—';
  return `${Math.round(score)}%`;
}

export default function EmployeeAppraisalResultPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);

  const { data: appraisal, isLoading } = useAppraisal(employeeAppraisalId);
  const { data: cycles = [] } = useAppraisalCycles();
  const cycle = cycles.find((c) => c.id === cycleId);

  const backHref = `/${tenantSlug}/hr/appraisal`;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-64">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
        <p className="text-sm text-red-500">Appraisal not found.</p>
        <Link href={backHref} className="text-sm text-brand hover:underline">
          ← Back to Appraisals
        </Link>
      </div>
    );
  }

  const cycleTitle = appraisal.cycle?.title ?? cycle?.title ?? '';
  const selfKpis: KpiScoreRow[] = appraisal.selfResponse?.kpiScores ?? [];
  const managerKpis: KpiScoreRow[] = appraisal.managerResponse?.kpiScores ?? [];
  const managerMap = new Map(managerKpis.map((k: KpiScoreRow) => [k.kpiId, k]));
  const isFinalized = appraisal.overallStatus === 'Finalized';
  const displayScore = isFinalized
    ? appraisal.finalizedAppraisal?.overallScore
    : appraisal.selfResponse?.score;
  const scoreLabel = isFinalized ? 'Overall Score' : 'Personal Score';

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={backHref} className="hover:text-gray-600 transition-colors">
          Appraisal
        </Link>
        <span>›</span>
        <span className="text-gray-600">{cycleTitle}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">Appraisals</h1>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{cycleTitle}</h2>
            <StatusBadge status={appraisal.overallStatus} />
          </div>
          <p className="text-sm text-gray-400">Results</p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs text-gray-400">{scoreLabel}</span>
          <span className="text-2xl font-bold text-gray-900">{scoreToPercent(displayScore)}</span>
        </div>
      </div>

      {/* KPI table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">KPI Breakdown</h3>
        </div>

        <div className="px-6 pb-6">
          {selfKpis.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 w-1/3">KPI</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Average</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Weight</th>
                  <th className="text-left py-3 font-semibold text-gray-700">Comment</th>
                </tr>
              </thead>
              <tbody>
                {selfKpis.map((row) => {
                  const mgr = managerMap.get(row.kpiId);
                  const selfPct = row.maxScore > 0 ? (row.score / row.maxScore) * 100 : null;
                  const mgrPct = mgr && mgr.maxScore > 0 ? (mgr.score / mgr.maxScore) * 100 : null;
                  const avg =
                    selfPct != null && mgrPct != null ? Math.round((selfPct + mgrPct) / 2) : null;
                  return (
                    <tr key={row.kpiId} className="border-b border-gray-100 last:border-0">
                      <td className="py-4 pr-4 text-gray-900">{row.title}</td>
                      <td className="py-4 pr-4 font-medium text-gray-900">
                        {avg != null ? `${avg}%` : '—'}
                      </td>
                      <td className="py-4 pr-4 text-gray-700">{row.weight}%</td>
                      <td className="py-4 text-gray-500">{row.comment ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-sm text-gray-400 text-center">No KPI data available yet.</p>
          )}
        </div>
      </div>

      {/* Overall comment card */}
      {appraisal.selfResponse && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Overall Self-Assessment Score</span>
            <span className="text-base font-bold text-gray-900">
              {scoreToPercent(appraisal.selfResponse.score)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-gray-900">Overall Comment</p>
            <p className="text-sm text-gray-500">{appraisal.selfResponse.comment ?? '—'}</p>
          </div>
        </div>
      )}

      {isFinalized && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-col gap-1">
          <p className="text-sm font-semibold text-gray-900">Overall HR Note</p>
          <p className="text-sm text-gray-500">
            {(appraisal.finalizedAppraisal as { finalComment?: string } | null)?.finalComment ??
              '—'}
          </p>
        </div>
      )}
    </div>
  );
}
