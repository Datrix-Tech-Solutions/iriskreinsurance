'use client';

import { use } from 'react';
import { SchedulingContent } from '@/components/organisms/hr/scheduling/SchedulingContent';

export default function SchedulingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Scheduling</h1>
      </div>
      <SchedulingContent tenantSlug={tenantSlug} />
    </div>
  );
}
