'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { ClaimsTable } from '@/components/organisms/reinsurance/tables/Claimstable';
import { ClaimsStatsRow } from '@/components/molecules/reinsurance/stats/ClaimsStatsRow';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';

type ClaimsPageTab = 'notification' | 'open' | 'closed';

const TABS = [
  { key: 'open', label: 'Open Claims' },
  { key: 'notification', label: 'Notification' },
  { key: 'closed', label: 'Closed Claims' },
];

const VALID_TABS: ClaimsPageTab[] = ['notification', 'open', 'closed'];

export default function ReinsuranceClaimsPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');

  const initialTab = VALID_TABS.includes(requestedTab as ClaimsPageTab)
    ? (requestedTab as ClaimsPageTab)
    : 'open';
  const [activeTab, setActiveTab] = useState<ClaimsPageTab>(initialTab);

  const canView = useAnyPermissionRules(RiPerm.viewClaim);

  return (
    <div className="flex flex-col">
      <div>
        <div className={pageHeader}>
          <h2 className="text-base font-semibold text-gray-900">Claims</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage claim submissions and processing</p>
          {canView && <ClaimsStatsRow />}
        </div>
        {canView && (
          <TabBar
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={(t) => setActiveTab(t as ClaimsPageTab)}
            className={pagePx}
          />
        )}
      </div>

      <div className={cn(pageContent, 'flex flex-col gap-6', 'pt-2')}>
        {!canView ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            You don&apos;t have permission to view claims.
          </div>
        ) : (
          <>
            {activeTab === 'notification' && <ClaimsTable tab="notification" />}
            {activeTab === 'open' && <ClaimsTable tab="open" />}
            {activeTab === 'closed' && <ClaimsTable tab="closed" />}
          </>
        )}
      </div>
    </div>
  );
}
