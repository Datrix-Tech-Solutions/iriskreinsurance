'use client';

import { useState } from 'react';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ClaimOverview } from '@/components/molecules/reinsurance/stats/ClaimOverview';
import { ClaimOverviewTab } from '@/components/organisms/reinsurance/claim/ClaimOverviewTab';
import { ClaimCashCallsTable } from '@/components/organisms/reinsurance/claim/ClaimCashCallsTable';
import { ClaimFinancialHistoryTable } from '@/components/organisms/reinsurance/claim/ClaimFinancialHistoryTable';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

type ClaimTab = 'details' | 'cashCalls' | 'history';

const CLAIM_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'cashCalls', label: 'Recoveries' },
  { key: 'history', label: 'History' },
];

interface ClaimOverviewSectionProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

export function ClaimOverviewSection({ placement, claim }: ClaimOverviewSectionProps) {
  const [activeTab, setActiveTab] = useState<ClaimTab>('details');
  const canManageRecoveries = useAnyPermissionRules(RiPerm.recordRecovery);

  const isNotification = !claim || claim.finalLossAmount == null;
  const visibleTabs = CLAIM_TABS.filter((t) => {
    if (isNotification) return t.key === 'details';
    if (t.key === 'cashCalls' && !canManageRecoveries) return false;
    return true;
  });
  const effectiveTab: ClaimTab = visibleTabs.some((t) => t.key === activeTab)
    ? activeTab
    : 'details';

  return (
    <div className="flex flex-col gap-4">
      <ClaimOverview placement={placement} claim={claim} />

      <div className="flex flex-col">
        <TabBar
          tabs={visibleTabs}
          activeTab={effectiveTab}
          onTabChange={(tab) => setActiveTab(tab as ClaimTab)}
        />

        <div className="pt-5">
          {effectiveTab === 'details' && <ClaimOverviewTab placement={placement} claim={claim} />}
          {claim && effectiveTab === 'cashCalls' && canManageRecoveries && (
            <ClaimCashCallsTable placement={placement} claim={claim} />
          )}
          {claim && effectiveTab === 'history' && (
            <ClaimFinancialHistoryTable placement={placement} claim={claim} />
          )}
        </div>
      </div>
    </div>
  );
}
