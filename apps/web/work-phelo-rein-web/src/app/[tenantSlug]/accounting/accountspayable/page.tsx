'use client';

import { useState } from 'react';
import { TradeCreditNotesTable } from '@/components/organisms/accounting/tables/TradeCreditNotesTable';
import { TradeSettlementsTable } from '@/components/organisms/accounting/tables/TradeSettlementsTable';
import { TabBar, TabItem } from '@/components/molecules/shared/TabBar';

type AccountsPayableTab = 'credit-notes' | 'payments';

const TABS: TabItem[] = [
  { key: 'credit-notes', label: 'Credit Notes' },
  { key: 'payments', label: 'Payments' },
];

export default function AccountsPayablePage() {
  const [activeTab, setActiveTab] = useState<AccountsPayableTab>('credit-notes');

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Accounts Payable</h2>
      </div>

      <div className="flex flex-col gap-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as AccountsPayableTab)}
        />
        {activeTab === 'credit-notes' && <TradeCreditNotesTable side="PAYABLE" />}
        {activeTab === 'payments' && <TradeSettlementsTable side="PAYABLE" />}
      </div>
    </div>
  );
}
