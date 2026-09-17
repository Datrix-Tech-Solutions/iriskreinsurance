'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppraisal, useCycleKpis, useAppraisalCycles } from '@/hooks';
import { SelfAssessmentForm } from '@/components/organisms/hr/appraisal/SelfAssessmentForm';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AppBackground } from '@/components/atoms/AppBackground';
import { cn } from '@/lib/utils';

function formatDeadline(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SelfAssessmentPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);
  const router = useRouter();

  const { data: appraisal, isLoading: loadingAppraisal } = useAppraisal(employeeAppraisalId);
  const { data: kpis = [], isLoading: loadingKpis } = useCycleKpis(cycleId);
  const { data: cycles = [] } = useAppraisalCycles();

  const cycle = cycles.find((c) => c.id === cycleId);
  const backHref = `/${tenantSlug}/hr/appraisal`;
  const isLoading = loadingAppraisal || loadingKpis;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-64">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-red-500">Appraisal not found.</p>
        <Link href={backHref} className="text-brand hover:underline mt-4 inline-block text-sm">
          ← Back
        </Link>
      </div>
    );
  }

  if (appraisal.selfStatus === 'SUBMITTED') {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
        <p className="text-sm text-gray-500">Your self-assessment has already been submitted.</p>
        <Link href={backHref} className="text-brand hover:underline text-sm">
          ← Back to Appraisals
        </Link>
      </div>
    );
  }

  const hasNoManager = !appraisal.managerId;
  const cycleTitle = appraisal.cycle?.title ?? cycle?.title ?? '';
  const deadline = cycle?.selfAssessmentDeadline;
  const selfScore = appraisal.selfScore;
  const isPending = appraisal.selfStatus === 'PENDING';

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <AppBackground
        as="nav"
        className="sticky top-0 z-10 flex items-center gap-2 text-sm text-gray-400 px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-50"
      >
        <Link href={backHref} className="hover:text-gray-600 transition-colors">
          Appraisal
        </Link>
        <span>›</span>
        <span className="text-gray-600">{cycleTitle}</span>
      </AppBackground>

      {/* Page body */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8 flex flex-col gap-6">
        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{cycleTitle} – Self Assessment</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm font-medium',
                  isPending ? 'text-amber-500' : 'text-green-600',
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isPending ? 'bg-amber-400' : 'bg-green-500',
                  )}
                />
                {isPending ? 'Pending' : 'Submitted'}
              </span>
            </div>
            {deadline && (
              <p className="text-sm text-gray-500">Deadline: {formatDeadline(deadline)}</p>
            )}
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs text-gray-400">self-assessment score</span>
            <span className="text-2xl font-bold text-gray-900">
              {selfScore != null ? `${selfScore}/5` : '—'}
            </span>
          </div>
        </div>

        {/* Instruction */}
        <p className="text-sm text-gray-600">
          Complete the KPIs below to evaluate your performance for this review cycle.
        </p>

        {/* KPI form */}
        {kpis.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">
              No KPIs have been configured for this cycle yet. Contact your HR administrator.
            </p>
          </div>
        ) : (
          <SelfAssessmentForm appraisalId={employeeAppraisalId} kpis={kpis} backHref={backHref} />
        )}

        {/* No-manager block modal — non-dismissible */}
        <Modal
          isOpen={hasNoManager}
          onClose={() => {}}
          title="No Reporting Manager Assigned"
          description="You cannot start your self-assessment because no reporting manager has been assigned to your profile. Please contact your HR administrator to have a manager assigned before proceeding."
          footer={
            <div className="flex justify-end">
              <Button onClick={() => router.push(backHref)}>Back to Appraisals</Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
