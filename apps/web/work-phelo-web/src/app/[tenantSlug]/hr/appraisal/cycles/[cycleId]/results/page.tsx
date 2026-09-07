'use client';

import { use } from 'react';
import { CycleResultsContent } from '@/components/organisms/hr/appraisal/CycleResultsContent';

export default function CycleResultsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string }>;
}) {
  const { tenantSlug, cycleId } = use(params);
  return <CycleResultsContent tenantSlug={tenantSlug} cycleId={cycleId} />;
}
