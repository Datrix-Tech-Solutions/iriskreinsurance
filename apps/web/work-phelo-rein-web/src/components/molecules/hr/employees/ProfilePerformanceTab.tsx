'use client';

import { useRouter, useParams } from 'next/navigation';
import { useMyAppraisals } from '@/hooks/hr/useAppraisals';

export function ProfilePerformanceTab() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: myAppraisals = [], isLoading } = useMyAppraisals();

  const completed = myAppraisals.filter((a) => a.overallStatus === 'Finalized');

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-400">Loading...</p>;
  }

  if (completed.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">No completed appraisals yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-gray-100">
      {completed.map((appraisal) => (
        <div key={String(appraisal.id)} className="flex items-center justify-between py-4">
          <p className="text-sm font-semibold text-gray-900">
            {String(appraisal.cycleName ?? '—')}
          </p>
          <div className="flex items-center gap-6">
            {appraisal.overallScore != null ? (
              <span className="text-sm font-semibold text-gray-900">
                {Math.round(Number(appraisal.overallScore))}%
              </span>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
            <button
              onClick={() =>
                router.push(
                  `/${tenantSlug}/hr/appraisal/cycles/${appraisal.cycleId}/results/${appraisal.id}`,
                )
              }
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
