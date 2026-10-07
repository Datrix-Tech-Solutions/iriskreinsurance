'use client';

import { useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Currency, Reinsurer } from '@/types/reinsurance';
import { useReinsurersReport } from '@/hooks';
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
  reinsurerId: string;
  reinsurer: Reinsurer;
  currencies: Currency[];
}

export function ReinsurerRevenueTab({
  reinsurerId,
  reinsurer,
  currencies,
}: ReinsurerRevenueTabProps) {
  const { summary, isLoading } = useReinsurersReport({
    reinsurerIds: [reinsurerId],
    page: 1,
    limit: 1,
  });
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

  const { brokerageByCode, grossByCode, disbursedByCode, outstandingByCode } = useMemo(() => {
    const brokerage = new Map<string, number>();
    const gross = new Map<string, number>();
    const disbursed = new Map<string, number>();
    const outstanding = new Map<string, number>();

    for (const row of summary.totalsByCurrency) {
      brokerage.set(row.currency, row.brokerage);
      gross.set(row.currency, row.cededPremium);
      disbursed.set(row.currency, row.disbursed);
      outstanding.set(row.currency, row.outstanding);
    }

    return {
      brokerageByCode: brokerage,
      grossByCode: gross,
      disbursedByCode: disbursed,
      outstandingByCode: outstanding,
    };
  }, [summary.totalsByCurrency]);

  const rows: RevenueRow[] = currencies.map((c) => {
    const gross = grossByCode.get(c.isoCode) ?? null;

    const nicRate = isForeignReinsurer ? selectChargeRate(charges, 'NIC_LEVY', c.isoCode) : 0;
    const whtRate = isForeignReinsurer
      ? selectChargeRate(charges, 'WITHHOLDING_TAX', c.isoCode)
      : 0;

    return {
      ...c,
      brokerage: brokerageByCode.get(c.isoCode) ?? null,
      nicLevy: gross != null && nicRate > 0 ? gross * (nicRate / 100) : null,
      withholdingTax: gross != null && whtRate > 0 ? gross * (whtRate / 100) : null,
      paidPremiums: disbursedByCode.get(c.isoCode) ?? null,
      outstandingPremiums: outstandingByCode.get(c.isoCode) ?? null,
    };
  });

  return (
    <DataTable
      columns={columns}
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
