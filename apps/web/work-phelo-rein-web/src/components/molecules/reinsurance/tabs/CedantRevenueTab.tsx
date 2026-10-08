'use client';

import { useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Currency } from '@/types/reinsurance';
import { useCedantsReport } from '@/hooks';

type RevenueRow = Currency & {
  netPremium: number | null;
  brokerage: number | null;
  paidPremiums: number | null;
  outstandingPremiums: number | null;
};

function fmt(amount: number, symbol: string | null, isoCode: string): string {
  const prefix = symbol ? `${symbol} ` : `${isoCode} `;
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AmountCell({ amount, currency }: { amount: number | null; currency: Currency }) {
  if (amount == null) return <span className="text-gray-400">—</span>;
  return (
    <span className="font-medium text-gray-900">
      {fmt(amount, currency.symbol, currency.isoCode)}
    </span>
  );
}

function OutstandingCell({ amount, currency }: { amount: number | null; currency: Currency }) {
  if (amount == null) return <span className="text-gray-400">—</span>;
  return (
    <span className={`font-medium ${amount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
      {fmt(amount, currency.symbol, currency.isoCode)}
    </span>
  );
}

const REVENUE_COLUMNS: Column<RevenueRow>[] = [
  {
    key: 'currency',
    label: 'Currency',
    width: '1fr',
    render: (row) => (
      <span>
        <span className="font-medium text-gray-900">{row.isoCode}</span>
        <span className="ml-2 text-xs text-gray-400">{row.name}</span>
      </span>
    ),
  },
  {
    key: 'netPremium',
    label: 'Net Premium',
    width: '180px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.netPremium} currency={row} />,
  },
  {
    key: 'brokerage',
    label: 'Brokerage',
    width: '180px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.brokerage} currency={row} />,
  },
  {
    key: 'paidPremiums',
    label: 'Paid Premiums',
    width: '180px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.paidPremiums} currency={row} />,
  },
  {
    key: 'outstandingPremiums',
    label: 'Outstanding Premiums',
    width: '200px',
    className: 'text-right',
    render: (row) => <OutstandingCell amount={row.outstandingPremiums} currency={row} />,
  },
];

interface CedantRevenueTabProps {
  cedantId: string;
  currencies: Currency[];
}

export function CedantRevenueTab({ cedantId, currencies }: CedantRevenueTabProps) {
  const { summary, isLoading } = useCedantsReport({
    cedantIds: [cedantId],
    page: 1,
    limit: 1,
  });

  const { brokerageByCode, netPremiumByCode, paidByCode, outstandingByCode } = useMemo(() => {
    const brokerage = new Map<string, number>();
    const netPremium = new Map<string, number>();
    const paid = new Map<string, number>();
    const outstanding = new Map<string, number>();

    for (const row of summary.totalsByCurrency) {
      brokerage.set(row.currency, row.brokerage);
      netPremium.set(row.currency, row.totalPremium);
      paid.set(row.currency, row.received);
      outstanding.set(row.currency, row.outstanding);
    }

    return {
      brokerageByCode: brokerage,
      netPremiumByCode: netPremium,
      paidByCode: paid,
      outstandingByCode: outstanding,
    };
  }, [summary.totalsByCurrency]);

  const rows: RevenueRow[] = currencies.map((c) => {
    const net = netPremiumByCode.get(c.isoCode) ?? null;
    const paid = paidByCode.get(c.isoCode) ?? null;
    return {
      ...c,
      netPremium: net,
      brokerage: brokerageByCode.get(c.isoCode) ?? null,
      paidPremiums: paid,
      outstandingPremiums: outstandingByCode.get(c.isoCode) ?? null,
    };
  });

  return (
    <DataTable
      columns={REVENUE_COLUMNS}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No currencies configured"
      currentPage={1}
      totalPages={0}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
