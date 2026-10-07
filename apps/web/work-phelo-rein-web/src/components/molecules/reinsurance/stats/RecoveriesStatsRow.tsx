'use client';

import { useMemo } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';
import { useRecoveriesSummary } from '@/hooks';
import { RecoveriesWorklistCurrencySummary } from '@/types/reinsurance';

function fmtCurrencyAmount(currency: string, value: number): string {
  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CurrencyBreakdown({
  rows,
  field,
}: {
  rows: RecoveriesWorklistCurrencySummary[];
  field: 'calledAmount' | 'confirmedAmount' | 'outstandingAmount';
}) {
  if (rows.length === 0) return <>0.00</>;

  if (rows.length === 1) {
    const row = rows[0];
    return <>{fmtCurrencyAmount(row.currency, row[field])}</>;
  }

  return (
    <div className="flex flex-col gap-0.5 leading-tight text-sm">
      {rows.map((row) => (
        <span key={row.currency}>{fmtCurrencyAmount(row.currency, row[field])}</span>
      ))}
    </div>
  );
}

export function RecoveriesStatsRow() {
  const { data, isLoading } = useRecoveriesSummary();

  const { summaryRows, overdueCount } = useMemo(() => {
    const summaryRows = data?.byCurrency ?? [];
    const overdue = summaryRows.reduce((sum, row) => sum + row.overdueCount, 0);

    return { summaryRows, overdueCount: overdue };
  }, [data]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <KpiCard
        label="Amount Due"
        value={<CurrencyBreakdown rows={summaryRows} field="calledAmount" />}
        icon={Icons.FileCheck2}
        iconColor="#2a78d6"
        isLoading={isLoading}
      />
      <KpiCard
        label="Amount Received"
        value={<CurrencyBreakdown rows={summaryRows} field="confirmedAmount" />}
        icon={Icons.CircleDollarSign}
        iconColor="#008300"
        isLoading={isLoading}
      />
      <KpiCard
        label="Outstanding"
        value={<CurrencyBreakdown rows={summaryRows} field="outstandingAmount" />}
        icon={Icons.Clock}
        iconColor="#eda100"
        isLoading={isLoading}
      />
      <KpiCard
        label={`Aging Analysis`}
        value={overdueCount}
        icon={Icons.Activity}
        iconColor="#e34948"
        isLoading={isLoading}
      />
    </div>
  );
}
