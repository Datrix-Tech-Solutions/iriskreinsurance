'use client';

import { useMemo } from 'react';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Period, periodWindow } from '@/components/atoms/PeriodToggle';
import { useFacultatives, useCurrencies } from '@/hooks';
import { Currency } from '@/types/reinsurance';
import { transparentCardClass } from '@/lib/utils';

const REINSURER_ROLES = new Set(['REINSURER', 'LEAD_REINSURER', 'CO_REINSURER']);
const QUALIFYING_STATUSES = new Set(['ACCEPTED', 'CLOSED']);

interface ReinsurerRow {
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

function buildColumns(symbol: string): Column<ReinsurerRow>[] {
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
        <span className="font-semibold text-gray-900">{fmtAmount(row.totalPremium, symbol)}</span>
      ),
    },
  ];
}

interface TopReinsurersCardProps {
  period: Period;
  year?: number;
  currency: string;
}

export function TopReinsurersCard({ period, year, currency }: TopReinsurersCardProps) {
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
      if (f.premium == null) continue;
      const createdAt = new Date(f.createdAt);
      if (createdAt < start || createdAt > end) continue;

      const sourceRate = getRate(currencies, f.currency);
      const premiumInTarget = (f.premium * sourceRate) / targetRate;

      for (const p of f.participants) {
        if (!REINSURER_ROLES.has(p.role) || !QUALIFYING_STATUSES.has(p.status)) continue;
        if (p.sharePercent == null) continue;
        const share = parseFloat(p.sharePercent) / 100;

        const prev = map.get(p.counterpartyId) ?? {
          name: p.counterparty.name,
          count: 0,
          premium: 0,
        };
        map.set(p.counterpartyId, {
          name: prev.name,
          count: prev.count + 1,
          premium: prev.premium + premiumInTarget * share,
        });
      }
    }

    const rows: ReinsurerRow[] = Array.from(map.entries())
      .map(([id, d]) => ({ id, name: d.name, offerCount: d.count, totalPremium: d.premium }))
      .sort((a, b) => b.totalPremium - a.totalPremium)
      .slice(0, 5);

    return { rows, symbol };
  }, [all, currencies, period, year, currency]);

  return (
    <div className={transparentCardClass('flex flex-col gap-3 py-5 h-80')}>
      <h3 className="text-sm font-semibold text-gray-900">Top 5 Reinsurers</h3>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        <DataList
          columns={buildColumns(symbol)}
          data={rows}
          isLoading={loadingFac || loadingCur}
          emptyMessage="No reinsurer data for this period"
        />
      </div>
    </div>
  );
}
