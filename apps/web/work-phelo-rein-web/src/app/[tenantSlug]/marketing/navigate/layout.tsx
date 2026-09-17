'use client';

import { useParams } from 'next/navigation';
import { pageHeader, pagePx } from '@/lib/layout';
import { NavigateTabs } from '@/components/molecules/marketing/NavigateTabs';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function NavigateLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/navigate`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Navigate</h1>
        </div>
        <NavigateTabs base={base} className={pagePx} />
      </div>

      <AppBackground as="main" className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {children}
      </AppBackground>
    </div>
  );
}
