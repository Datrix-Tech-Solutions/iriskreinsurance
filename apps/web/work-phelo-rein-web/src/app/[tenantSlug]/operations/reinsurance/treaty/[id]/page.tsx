'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { TreatyOverview } from '@/components/molecules/reinsurance/stats/TreatyOverview';
import { TreatyDistributionListTab } from '@/components/molecules/reinsurance/tabs/TreatyDistributionListTab';
import { TreatyPlacementClosingsTab } from '@/components/molecules/reinsurance/tabs/TreatyPlacementClosingsTab';
import { TreatyEndorsementTab } from '@/components/molecules/reinsurance/tabs/TreatyEndorsementTab';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { Treaty } from '@/types/reinsurance';

// TODO: replace with useTreaty(id) hook once API is ready
const MOCK_TREATIES: Treaty[] = [
  {
    id: '1',
    name: 'Quota Share Treaty 1',
    type: 'Quota Share',
    classofBusiness: 'Property',
    cedant: 'Glico Insurance',
    share: 25,
    periodStart: '2023-01-01',
    periodEnd: '2023-12-31',
    year: 2026,
    status: 'Active',
    accountingArrangement: 'Quarterly',
  },
];

type TreatyTab = 'distribution' | 'closings' | 'endorsement';

const TABS = [
  { key: 'distribution', label: 'Distribution List' },
  { key: 'closings', label: 'Placement Closings' },
  { key: 'endorsement', label: 'Endorsement' },
];

export default function TreatyDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const treaty = MOCK_TREATIES.find((t) => t.id === id) ?? null;
  const [activeTab, setActiveTab] = useState<TreatyTab>('distribution');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/treaty`}
            className="hover:text-gray-700 transition-colors"
          >
            Treaties
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{treaty?.name ?? '—'}</span>
        </nav>
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {!treaty ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Treaty not found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <TreatyOverview treaty={treaty} />

            <div className="flex flex-col">
              <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as TreatyTab)}
              />

              <div className="pt-5">
                {activeTab === 'distribution' && <TreatyDistributionListTab treaty={treaty} />}
                {activeTab === 'closings' && <TreatyPlacementClosingsTab />}
                {activeTab === 'endorsement' && <TreatyEndorsementTab />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
