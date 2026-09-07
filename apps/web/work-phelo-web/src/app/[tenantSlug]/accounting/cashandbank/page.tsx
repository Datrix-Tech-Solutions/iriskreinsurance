'use client';

import { useState } from 'react';
import { CashAndBankStatsRow } from '@/components/molecules/accounting/CashAndBankStatsRow';
import { CashAndBankTable } from '@/components/organisms/accounting/tables/CashAndBankTable';
import { CashAccountsTable } from '@/components/organisms/accounting/tables/CashAccountsTable';
import { CashbookTable } from '@/components/organisms/accounting/tables/CashbookTable';
import { ReinsuranceAccountingReadiness } from '@/components/organisms/accounting/ReinsuranceAccountingReadiness';
import { TabBar, TabItem } from '@/components/molecules/shared/TabBar';
import { useCashAndBankStats } from '@/hooks';

type CashAndBankTab = 'confirmation-queue' | 'cashbook' | 'accounts';

const TABS: TabItem[] = [
  { key: 'confirmation-queue', label: 'Confirmation Queue' },
  { key: 'cashbook', label: 'Cashbook' },
  { key: 'accounts', label: 'Cash/Bank Accounts' },
];

export default function CashAndBankPage() {
  const [activeTab, setActiveTab] = useState<CashAndBankTab>('confirmation-queue');
  const { data: stats, isLoading: isLoadingStats } = useCashAndBankStats();
  const formatTotals = (totals: Record<string, number> | undefined) => {
    const values = Object.entries(totals ?? {});
    if (values.length === 0) return '—';
    return values
      .sort(([first], [second]) => first.localeCompare(second))
      .map(
        ([currency, value]) =>
          `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      )
      .join(' · ');
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Cash and Bank</h2>
      </div>

      <CashAndBankStatsRow
        isLoading={isLoadingStats}
        totalCashPosition={formatTotals(stats?.netCashPosition)}
        cashInflowMtd={formatTotals(stats?.inflowMtd)}
        cashOutflowMtd={formatTotals(stats?.outflowMtd)}
      />

      <ReinsuranceAccountingReadiness />

      <div className="flex flex-col gap-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as CashAndBankTab)}
        />
        {activeTab === 'confirmation-queue' && <CashAndBankTable />}
        {activeTab === 'cashbook' && <CashbookTable />}
        {activeTab === 'accounts' && <CashAccountsTable />}
      </div>
    </div>
  );
}
