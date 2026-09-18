'use client';

import { useParams, usePathname } from 'next/navigation';
import { pageHeader, pagePx } from '@/lib/layout';
import { ProspectsTabs } from '@/components/molecules/marketing/ProspectsTabs';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function ProspectsLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const pathname = usePathname();
  const base = `/${tenantSlug}/marketing/prospects`;

  const tabRoutes = [`${base}/all`, `${base}/upcoming-follow-ups`];
  const showTabs = tabRoutes.some((r) => pathname === r);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {showTabs && (
        <div className="shrink-0">
          <div className={pageHeader}>
            <h1 className="text-xl font-semibold text-gray-900">Prospects</h1>
          </div>
          <ProspectsTabs base={base} className={pagePx} />
        </div>
      )}

      <AppBackground as="main" className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </AppBackground>
    </div>
  );
}
