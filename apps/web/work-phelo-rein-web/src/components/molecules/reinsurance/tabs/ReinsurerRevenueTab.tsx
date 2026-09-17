'use client';

import { useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Facultative, Currency, Reinsurer } from '@/types/reinsurance';
import { useReinsurerPaymentSummary } from '@/hooks';
import { useReinsuranceCharges } from '@/hooks/reinsurance/useReinsuranceCharges';
import { isForeignCedant, selectChargeRate } from '@/lib/reinsuranceTax';

type RevenueRow = Currency & {
  brokerage: number | null;
  nicLevy: number | null;
  withholdingTax: number | null;
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

// Statutory deductions on premium ceded abroad — only shown for reinsurers not based in Ghana.
const FOREIGN_CHARGE_COLUMNS: Column<RevenueRow>[] = [
  {
    key: 'nicLevy',
    label: 'NIC Levy',
    width: '160px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.nicLevy} currency={row} />,
  },
  {
    key: 'withholdingTax',
    label: 'Withholding Tax',
    width: '170px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.withholdingTax} currency={row} />,
  },
];

interface ReinsurerRevenueTabProps {
  placements: Facultative[];
  reinsurerId: string;
  reinsurer: Reinsurer;
  reinsurerDefaultBrokerageFee: number | null;
  currencies: Currency[];
}

export function ReinsurerRevenueTab({
  placements,
  reinsurerId,
  reinsurer,
  reinsurerDefaultBrokerageFee,
  currencies,
}: ReinsurerRevenueTabProps) {
  const { paidByCode } = useReinsurerPaymentSummary(placements, reinsurerId);
  const { data: charges } = useReinsuranceCharges();

  const isForeignReinsurer = isForeignCedant(reinsurer);

  const columns = useMemo(
    () =>
      isForeignReinsurer
        ? [
            ...REVENUE_COLUMNS.slice(0, 2), // Currency, Brokerage
            ...FOREIGN_CHARGE_COLUMNS,
            ...REVENUE_COLUMNS.slice(2), // Paid / Outstanding Premiums
          ]
        : REVENUE_COLUMNS,
    [isForeignReinsurer],
  );

  const { brokerageByCode, grossByCode } = useMemo(() => {
    const brokerage = new Map<string, number>();
    const gross = new Map<string, number>();

    for (const placement of placements) {
      const participant = placement.participants.find((pt) => pt.counterpartyId === reinsurerId);
      if (!participant) continue;
      if (participant.status !== 'ACCEPTED' && participant.status !== 'CLOSED') continue;
      if (placement.premium == null || placement.currency == null) continue;

      const share = participant.sharePercent != null ? parseFloat(participant.sharePercent) : null;
      if (share == null) continue;

      const shareAmount = placement.premium * (share / 100);
      gross.set(placement.currency, (gross.get(placement.currency) ?? 0) + shareAmount);

      const feeRaw =
        participant.brokerageFee ??
        (reinsurerDefaultBrokerageFee != null ? String(reinsurerDefaultBrokerageFee) : null);
      const fee = feeRaw != null ? parseFloat(feeRaw) : null;
      if (fee != null) {
        const brokerageAmount = shareAmount * (fee / 100);
        brokerage.set(
          placement.currency,
          (brokerage.get(placement.currency) ?? 0) + brokerageAmount,
        );
      }
    }

    return { brokerageByCode: brokerage, grossByCode: gross };
  }, [placements, reinsurerId, reinsurerDefaultBrokerageFee]);

  const rows: RevenueRow[] = currencies.map((c) => {
    const gross = grossByCode.get(c.isoCode) ?? null;
    const paid = paidByCode.get(c.isoCode) ?? null;
    const outstanding = gross != null ? gross - (paid ?? 0) : null;

    const nicRate = isForeignReinsurer ? selectChargeRate(charges, 'NIC_LEVY', c.isoCode) : 0;
    const whtRate = isForeignReinsurer
      ? selectChargeRate(charges, 'WITHHOLDING_TAX', c.isoCode)
      : 0;

    return {
      ...c,
      brokerage: brokerageByCode.get(c.isoCode) ?? null,
      nicLevy: gross != null && nicRate > 0 ? gross * (nicRate / 100) : null,
      withholdingTax: gross != null && whtRate > 0 ? gross * (whtRate / 100) : null,
      paidPremiums: paid,
      outstandingPremiums: outstanding,
    };
  });

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No currencies configured"
      currentPage={1}
      totalPages={0}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
