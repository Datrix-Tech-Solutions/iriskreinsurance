'use client';

import { AccountsReceivableStatsRow } from '@/components/molecules/accounting/AccountsReceivableStatsRow';
import { AccountsReceivableTable } from '@/components/organisms/accounting/tables/AccountsReceivableTable';
import { useAccountsReceivableSummary } from '@/hooks';

export default function ReceivableInvoicesPage() {
  const { data: summary, isLoading } = useAccountsReceivableSummary();
  const formatTotals = (totals: { currency: string; amount: string }[] | undefined) =>
    totals?.length
      ? totals
          .map(
            ({ currency, amount }) =>
              `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          )
          .join(' · ')
      : '—';

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
      </div>

      <AccountsReceivableStatsRow
        isLoading={isLoading}
        totalReceivables={formatTotals(summary?.outstandingByCurrency)}
        overdueInvoices={summary?.overdueInvoices ?? 0}
        dueThisWeek={summary?.dueThisWeek ?? 0}
        collectedMtd={formatTotals(summary?.collectedMtdByCurrency)}
      />

      <AccountsReceivableTable />
    </div>
  );
}
