'use client';

import { useMemo } from 'react';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Period, periodWindow } from '@/components/atoms/PeriodToggle';
import { useFacultatives, useCurrencies } from '@/hooks';
import { Currency } from '@/types/reinsurance';
import { transparentCardClass } from '@/lib/utils';

interface CedantRow {
  id: string;
  name: string;
  offerCount: number;
  totalPremium: number;
}

function getRate(currencies: Currency[], isoCode: string | null): number {
  if (!isoCode) return 1;
  const c = currencies.find((x) => x.isoCode === isoCode);
  return c?.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : 1;
}

function fmtAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${symbol} ${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${symbol} ${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${symbol} ${(value / 1_000).toFixed(2)}K`;
  return `${symbol} ${value.toFixed(2)}`;
}

function buildColumns(symbol: string): Column<CedantRow>[] {
  return [
    {
      key: 'name',
      label: 'Cedant',
      width: '0.5fr',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-900">{row.name}</span>
          <span className="text-xs text-gray-400">
            {row.offerCount} {row.offerCount === 1 ? 'offer' : 'offers'}
          </span>
        </div>
      ),
    },
    {
      key: 'totalPremium',
      label: 'Total Premium',
      width: '160px',
      className: 'text-right',
      render: (row) => (
        <span className="font-semibold text-gray-900">{fmtAmount(row.totalPremium, symbol)}</span>
      ),
    },
  ];
}

interface TopCedantsListProps {
  period: Period;
  year?: number;
  currency: string;
}

export function TopCedantsList({ period, year, currency }: TopCedantsListProps) {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const { rows, symbol } = useMemo(() => {
    const { start, end } = periodWindow(period, { year });

    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetRate = getRate(currencies, targetIso);
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    const symbol = targetCurrency?.symbol ?? targetIso;

    const map = new Map<string, { name: string; count: number; premium: number }>();

    for (const f of all) {
      const createdAt = new Date(f.createdAt);
      if (createdAt < start || createdAt > end) continue;

      const { id, name } = f.cedant;
      const prev = map.get(id) ?? { name, count: 0, premium: 0 };
      const sourceRate = getRate(currencies, f.currency);
      const premiumInTarget = f.premium != null ? (f.premium * sourceRate) / targetRate : 0;

      map.set(id, {
        name,
        count: prev.count + 1,
        premium: prev.premium + premiumInTarget,
      });
    }

    const rows: CedantRow[] = Array.from(map.entries())
      .map(([id, d]) => ({ id, name: d.name, offerCount: d.count, totalPremium: d.premium }))
      .sort((a, b) => b.totalPremium - a.totalPremium)
      .slice(0, 5);

    return { rows, symbol };
  }, [all, currencies, period, year, currency]);

  return (
    <div className={transparentCardClass('flex flex-col gap-3 py-5 h-80')}>
      <h3 className="text-sm font-semibold text-gray-900">Top 5 Cedants</h3>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        <DataList
          columns={buildColumns(symbol)}
          data={rows}
          isLoading={loadingFac || loadingCur}
          emptyMessage="No cedant data for this period"
        />
      </div>
    </div>
  );
}
