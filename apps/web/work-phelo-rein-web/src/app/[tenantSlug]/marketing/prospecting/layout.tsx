'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pageHeader, pageContent, pagePx } from '@/lib/layout';
import { ProspectingTabs } from '@/components/molecules/marketing/ProspectingTabs';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function ProspectingLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/prospecting`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">CRM Settings</h1>
        </div>
        <ProspectingTabs base={base} className={pagePx} />
      </div>

      <AppBackground
        as="main"
        className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}
      >
        {children}
      </AppBackground>
    </div>
  );
}
