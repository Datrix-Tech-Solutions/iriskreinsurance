'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { FacultativeTable } from '@/components/organisms/reinsurance/tables/FacultativeTable';
import { TabBar } from '@/components/molecules/shared/TabBar';

type FacultativePageTab = 'placements' | 'closing' | 'archived';

const TABS = [
  { key: 'placements', label: 'Open' },
  { key: 'closing', label: 'Closed' },
  { key: 'archived', label: 'Archived' },
];

export default function FacultativePage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'closing' ? 'closing' : 'placements';
  const [activeTab, setActiveTab] = useState<FacultativePageTab>(initialTab);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h2 className="text-base font-semibold text-gray-900">Facultative</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage individual risk placements and facultative certificates
          </p>
        </div>
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as FacultativePageTab)}
          className={pagePx}
        />
      </div>

      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}>
        <FacultativeTable key={activeTab} tab={activeTab} />
      </div>
    </div>
  );
}
