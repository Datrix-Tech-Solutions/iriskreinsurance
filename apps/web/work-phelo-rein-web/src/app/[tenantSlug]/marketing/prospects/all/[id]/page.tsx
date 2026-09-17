'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { ProspectBreadcrumb } from '@/components/molecules/marketing/ProspectBreadcrumb';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

export default function ProspectDetailPage() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const searchParams = useSearchParams();
  const prospectName = searchParams.get('name') ?? `Prospect #${id}`;

  return (
    <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col gap-6')}>
      <ProspectBreadcrumb tenantSlug={tenantSlug} prospectName={prospectName} />
    </div>
  );
}
