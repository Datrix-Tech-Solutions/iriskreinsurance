'use client';

import { useMemo } from 'react';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Period } from '@/components/atoms/PeriodToggle';
import { useReinsuranceTopReinsurers, useCurrencies } from '@/hooks';
import { transparentCardClass } from '@/lib/utils';

interface ReinsurerRow {
  id: string;
  name: string;
  offerCount: number;
  totalPremiumByCurrency: Array<{ currency: string; amount: number }>;
}

function fmtAmount(value: number, symbol: string, isoCode: string): string {
  const abs = Math.abs(value);
  const prefix = symbol || isoCode;
  if (abs >= 1_000_000_000) return `${prefix} ${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${prefix} ${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix} ${(value / 1_000).toFixed(2)}K`;
  return `${prefix} ${value.toFixed(2)}`;
}

function buildColumns(symbolFor: (currency: string) => string): Column<ReinsurerRow>[] {
  return [
    {
      key: 'name',
      label: 'Reinsurer',
      width: '0.5fr',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-900">{row.name}</span>
          <span className="text-s text-gray-400">
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
        <span className="flex flex-col items-end gap-0.5 font-semibold text-gray-900">
          {row.totalPremiumByCurrency.length === 0
            ? '—'
            : row.totalPremiumByCurrency.map((item) => (
                <span key={item.currency}>
                  {fmtAmount(item.amount, symbolFor(item.currency), item.currency)}
                </span>
              ))}
        </span>
      ),
    },
  ];
}

interface TopReinsurersCardProps {
  period: Period;
  year?: number;
  currency: string;
}

export function TopReinsurersCard({ period, year, currency: _currency }: TopReinsurersCardProps) {
  void _currency;
  const { data: topReinsurers, isLoading: loadingReinsurers } = useReinsuranceTopReinsurers({
    period,
    year,
  });
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const symbolFor = useMemo(
    () => (code: string) => currencies.find((c) => c.isoCode === code)?.symbol ?? code,
    [currencies],
  );
  const rows = topReinsurers.map((row) => ({
    id: row.id,
    name: row.name,
    offerCount: row.offerCount,
    totalPremiumByCurrency: row.totalPremiumByCurrency,
  }));

  return (
    <div className={transparentCardClass('flex flex-col gap-3 py-5 h-80')}>
      <h3 className="text-sm font-semibold text-gray-900">Top 5 Reinsurers</h3>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        <DataList
          columns={buildColumns(symbolFor)}
          data={rows}
          isLoading={loadingReinsurers || loadingCur}
          emptyMessage="No reinsurer data for this period"
        />
      </div>
    </div>
  );
}
