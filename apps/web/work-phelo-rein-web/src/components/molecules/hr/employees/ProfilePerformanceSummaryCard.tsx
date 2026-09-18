'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Award, BarChart3 } from 'lucide-react';
import { useMyAppraisals } from '@/hooks/hr/useAppraisals';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { cn } from '@/lib/utils';

function ratingLabel(avg: number): { label: string; color: string } {
  if (avg >= 90) return { label: 'Excellent', color: 'text-green-600' };
  if (avg >= 75) return { label: 'Good', color: 'text-blue-600' };
  if (avg >= 60) return { label: 'Satisfactory', color: 'text-amber-600' };
  return { label: 'Needs Improvement', color: 'text-red-500' };
}

export function ProfilePerformanceSummaryCard() {
  const { data: myAppraisals = [] } = useMyAppraisals();

  const stats = useMemo(() => {
    const completed = myAppraisals
      .filter((a) => a.overallStatus === 'Finalized' && a.overallScore != null)
      .map((a) => Math.round(Number(a.overallScore)));

    if (completed.length === 0) return null;

    const avg = Math.round(completed.reduce((s, v) => s + v, 0) / completed.length);
    const highest = Math.max(...completed);
    const lowest = Math.min(...completed);
    const total = myAppraisals.filter((a) => a.overallStatus === 'Finalized').length;
    const latest = myAppraisals.find((a) => a.overallStatus === 'Finalized')?.cycleName;

    return { avg, highest, lowest, total, latest };
  }, [myAppraisals]);

  if (!stats) {
    return (
      <SectionCard title="Performance Summary">
        <p className="py-4 text-center text-sm text-gray-400">No data yet.</p>
      </SectionCard>
    );
  }

  const { label, color } = ratingLabel(stats.avg);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Performance Summary">
        {/* Average score hero */}
        <div className="flex flex-col items-center gap-1 py-3 mb-4 rounded-lg bg-gray-50">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Average Score
          </span>
          <span className="text-4xl font-bold text-gray-900">{stats.avg}%</span>
          <span className={cn('text-sm font-semibold', color)}>{label}</span>
        </div>

        <div className="flex flex-col gap-3">
          <StatRow
            icon={<BarChart3 className="w-4 h-4 text-gray-400" />}
            label="Appraisals Completed"
            value={`${stats.total}`}
          />
          <StatRow
            icon={<TrendingUp className="w-4 h-4 text-green-500" />}
            label="Highest Score"
            value={`${stats.highest}%`}
          />
          <StatRow
            icon={<TrendingDown className="w-4 h-4 text-red-400" />}
            label="Lowest Score"
            value={`${stats.lowest}%`}
          />
          {stats.latest != null && (
            <StatRow
              icon={<Award className="w-4 h-4 text-brand" />}
              label="Latest Cycle"
              value={String(stats.latest)}
            />
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-sm text-gray-500 truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900 shrink-0">{value}</span>
    </div>
  );
}
