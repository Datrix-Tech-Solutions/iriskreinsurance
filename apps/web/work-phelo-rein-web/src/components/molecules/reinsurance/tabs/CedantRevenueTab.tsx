'use client';

import { useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Facultative, Currency } from '@/types/reinsurance';
import { useCedantPaymentSummary } from '@/hooks';

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
  placements: Facultative[];
  currencies: Currency[];
}

export function CedantRevenueTab({ placements, currencies }: CedantRevenueTabProps) {
  const { paidByCode } = useCedantPaymentSummary(placements);

  const { brokerageByCode, netPremiumByCode } = useMemo(() => {
    const brokerage = new Map<string, number>();
    const netPremium = new Map<string, number>();

    for (const p of placements) {
      if (p.premium == null || p.currency == null) continue;

      // Match the canonical formula used throughout the codebase
      const facPremium =
        p.facultativeOffer != null ? (p.facultativeOffer / 100) * p.premium : p.premium;
      const net = p.commission != null ? facPremium * (1 - p.commission / 100) : facPremium;
      netPremium.set(p.currency, (netPremium.get(p.currency) ?? 0) + net);

      for (const pt of p.participants) {
        if (pt.status !== 'ACCEPTED' && pt.status !== 'CLOSED') continue;
        const share = pt.sharePercent != null ? parseFloat(pt.sharePercent) : null;
        const fee = pt.brokerageFee != null ? parseFloat(pt.brokerageFee) : null;
        if (share == null || fee == null) continue;
        brokerage.set(
          p.currency,
          (brokerage.get(p.currency) ?? 0) + p.premium * (share / 100) * (fee / 100),
        );
      }
    }

    return { brokerageByCode: brokerage, netPremiumByCode: netPremium };
  }, [placements]);

  const rows: RevenueRow[] = currencies.map((c) => {
    const net = netPremiumByCode.get(c.isoCode) ?? null;
    const paid = paidByCode.get(c.isoCode) ?? null;
    const outstanding = net != null ? net - (paid ?? 0) : null;

    return {
      ...c,
      netPremium: net,
      brokerage: brokerageByCode.get(c.isoCode) ?? null,
      paidPremiums: paid,
      outstandingPremiums: outstanding,
    };
  });

  return (
    <DataTable
      columns={REVENUE_COLUMNS}
      data={rows}
      emptyMessage="No currencies configured"
      currentPage={1}
      totalPages={0}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
