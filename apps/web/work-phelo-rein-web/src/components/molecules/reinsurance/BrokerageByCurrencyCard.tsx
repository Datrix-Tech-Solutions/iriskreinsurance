'use client';

import { useMemo } from 'react';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Period, periodWindow } from '@/components/atoms/PeriodToggle';
import { Currency } from '@/types/reinsurance';
import { useFacultatives, useCurrencies } from '@/hooks';
import { transparentCardClass } from '@/lib/utils';

type AmountRow = Currency & { amount: number | null };

function fmtAmount(amount: number, symbol: string | null, isoCode: string): string {
  const prefix = symbol ? `${symbol} ` : `${isoCode} `;
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BROKERAGE_COLUMNS: Column<AmountRow>[] = [
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
    key: 'amount',
    label: 'Total Brokerage',
    width: '140px',
    className: 'text-right',
    render: (row) => (
      <span className="font-medium text-gray-900">
        {row.amount != null ? fmtAmount(row.amount, row.symbol, row.isoCode) : '—'}
      </span>
    ),
  },
];

interface BrokerageByCurrencyCardProps {
  period: Period;
  year?: number;
}

export function BrokerageByCurrencyCard({ period, year }: BrokerageByCurrencyCardProps) {
  const { data: all = [] } = useFacultatives();
  const { data: currencies = [] } = useCurrencies();

  const brokerageByCode = useMemo(() => {
    const { start, end } = periodWindow(period, { year });
    const map = new Map<string, number>();

    for (const f of all) {
      if (f.premium == null || f.currency == null) continue;
      const createdAt = new Date(f.createdAt);
      if (createdAt < start || createdAt > end) continue;

      for (const p of f.participants) {
        if (p.status !== 'ACCEPTED' && p.status !== 'CLOSED') continue;
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) : null;
        const fee = p.brokerageFee != null ? parseFloat(p.brokerageFee) : null;
        if (share == null || fee == null) continue;
        map.set(f.currency, (map.get(f.currency) ?? 0) + f.premium * (share / 100) * (fee / 100));
      }
    }

    return map;
  }, [all, period, year]);

  const rows = currencies
    .map((c) => ({ ...c, amount: brokerageByCode.get(c.isoCode) ?? null }))
    .filter((row) => row.amount != null);

  return (
    <div className={transparentCardClass('flex flex-col gap-3 py-5 h-80')}>
      <h3 className="text-sm font-semibold text-gray-900">Brokerage by Currency</h3>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        <DataList columns={BROKERAGE_COLUMNS} data={rows} emptyMessage="No data for this period" />
      </div>
    </div>
  );
}
