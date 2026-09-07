'use client';

import { BillsStatsRow } from '@/components/molecules/accounting/BillsStatsRow';
import { BillsTable } from '@/components/organisms/accounting/tables/BillsTable';
import { useAccountsPayableSummary } from '@/hooks';

export default function BillsPage() {
  const { data: summary, isLoading } = useAccountsPayableSummary();
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
        <h2 className="text-base font-semibold text-gray-900">Bills</h2>
      </div>

      <BillsStatsRow
        isLoading={isLoading}
        totalPayables={formatTotals(summary?.outstandingByCurrency)}
        overdueBills={summary?.overdueInvoices ?? 0}
        dueThisWeek={summary?.dueThisWeek ?? 0}
        pendingApproval={summary?.pendingApproval ?? 0}
      />

      <BillsTable />
    </div>
  );
}
