'use client';

import { useState } from 'react';
import { TradeCreditNotesTable } from '@/components/organisms/accounting/tables/TradeCreditNotesTable';
import { TradeSettlementsTable } from '@/components/organisms/accounting/tables/TradeSettlementsTable';
import { TabBar, TabItem } from '@/components/molecules/shared/TabBar';

type AccountsReceivableTab = 'credit-notes' | 'receipts';

const TABS: TabItem[] = [
  { key: 'credit-notes', label: 'Credit Notes' },
  { key: 'receipts', label: 'Receipts' },
];

export default function AccountsReceivablePage() {
  const [activeTab, setActiveTab] = useState<AccountsReceivableTab>('credit-notes');

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Receivable</h2>
      </div>

      <div className="flex flex-col gap-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as AccountsReceivableTab)}
        />
        {activeTab === 'credit-notes' && <TradeCreditNotesTable side="RECEIVABLE" />}
        {activeTab === 'receipts' && <TradeSettlementsTable side="RECEIVABLE" />}
      </div>
    </div>
  );
}
