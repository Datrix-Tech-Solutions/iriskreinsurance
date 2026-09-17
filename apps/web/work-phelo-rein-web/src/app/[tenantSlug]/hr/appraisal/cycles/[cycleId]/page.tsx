'use client';

import { use, useMemo } from 'react';
import { useCycleAppraisals } from '@/hooks/hr/useAppraisals';
import { CycleInProgressContent } from '@/components/organisms/hr/appraisal/CycleInProgressContent';
import { CycleResultsContent } from '@/components/organisms/hr/appraisal/CycleResultsContent';

function CycleDetailRouter({ tenantSlug, cycleId }: { tenantSlug: string; cycleId: string }) {
  const { data: raw, isLoading } = useCycleAppraisals(cycleId);

  const appraisals: {
    selfStatus?: string;
    managerStatus?: string;
    status?: string;
    finalScore?: number | null;
  }[] = useMemo(() => {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).data))
      return (
        raw as {
          data: {
            selfStatus?: string;
            managerStatus?: string;
            status?: string;
            finalScore?: number | null;
          }[];
        }
      ).data;
    return [];
  }, [raw]);

  if (isLoading) {
    return <div className="p-4 sm:p-6 lg:p-8 text-sm text-gray-400">Loading…</div>;
  }

  const total = appraisals.length;
  const allFinalized =
    total > 0 && appraisals.every((a) => a.status === 'COMPLETED' || a.finalScore != null);

  if (allFinalized) {
    return <CycleResultsContent tenantSlug={tenantSlug} cycleId={cycleId} />;
  }

  return <CycleInProgressContent tenantSlug={tenantSlug} cycleId={cycleId} />;
}

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string }>;
}) {
  const { tenantSlug, cycleId } = use(params);
  return <CycleDetailRouter tenantSlug={tenantSlug} cycleId={cycleId} />;
}
