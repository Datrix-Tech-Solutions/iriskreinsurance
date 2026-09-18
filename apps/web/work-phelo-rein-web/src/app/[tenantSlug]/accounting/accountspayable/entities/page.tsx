'use client';

import { useState } from 'react';
import { EntitiesTable } from '@/components/organisms/accounting/tables/EntitiesTable';
import { EntityTypesTable } from '@/components/organisms/accounting/tables/EntityTypesTable';
import { TabBar, TabItem } from '@/components/molecules/shared/TabBar';

type EntitiesTab = 'entities' | 'types';

const TABS: TabItem[] = [
  { key: 'entities', label: 'Entities' },
  { key: 'types', label: 'Types' },
];

export default function EntitiesPage() {
  const [activeTab, setActiveTab] = useState<EntitiesTab>('entities');

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Entities</h2>
      </div>

      <div className="flex flex-col gap-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as EntitiesTab)}
        />
        {activeTab === 'entities' && <EntitiesTable />}
        {activeTab === 'types' && <EntityTypesTable />}
      </div>
    </div>
  );
}
