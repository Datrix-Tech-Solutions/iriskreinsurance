'use client';

import { useMemo } from 'react';
import { Period, periodWindow } from '@/components/atoms/PeriodToggle';
import { useFacultatives } from '@/hooks';
import {
  TopCedantsBarChart,
  type TopCedantRow,
} from '@/components/molecules/reinsurance/stats/TopCedantsBarChart';

interface TopCedantsByOffersChartProps {
  period: Period;
  /** Calendar year for the window when `period` is `'yearly'` (from the year dropdown). */
  year?: number;
  /** Overrides the card's default height (`h-72`). */
  className?: string;
  /** Rank by closed offers only (status CLOSED). Retitles the card
   *  "Top 5 Cedants by Closed Offers". All-time unless `sinceIso` is given. */
  closedOnly?: boolean;
  /** Overrides the `period`-derived window start. With `closedOnly`, offers are then
   *  filtered by close date (`updatedAt`, the same close proxy the Closings tab uses). */
  sinceIso?: string;
  /** Upper bound paired with `sinceIso` — set for a past calendar year, otherwise runs to now. */
  untilIso?: string;
}

export function TopCedantsByOffersChart({
  period,
  year,
  className,
  closedOnly = false,
  sinceIso,
  untilIso,
}: TopCedantsByOffersChartProps) {
  const { data: all = [], isLoading } = useFacultatives();

  const rows = useMemo<TopCedantRow[]>(() => {
    const { start, end } = sinceIso
      ? { start: new Date(sinceIso), end: untilIso ? new Date(untilIso) : new Date() }
      : periodWindow(period, { year });
    const counts = new Map<string, TopCedantRow>();

    for (const f of all) {
      if (closedOnly) {
        if (f.status !== 'CLOSED') continue;
        if (sinceIso) {
          const closedAt = new Date(f.updatedAt);
          if (closedAt < start || closedAt > end) continue;
        }
      } else {
        const createdAt = new Date(f.createdAt);
        if (createdAt < start || createdAt > end) continue;
      }
      const { id, name } = f.cedant;
      const prev = counts.get(id) ?? {
        name,
        count: 0,
        premiumByCurrency: new Map<string, number>(),
      };
      if (f.premium != null && f.currency != null) {
        prev.premiumByCurrency.set(
          f.currency,
          (prev.premiumByCurrency.get(f.currency) ?? 0) + f.premium,
        );
      }
      counts.set(id, { name, count: prev.count + 1, premiumByCurrency: prev.premiumByCurrency });
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [all, period, year, closedOnly, sinceIso, untilIso]);

  return (
    <TopCedantsBarChart
      title={closedOnly ? 'Top 5 Cedants by Closed Offers' : 'Top 5 Cedants by Offers'}
      rows={rows}
      isLoading={isLoading}
      emptyMessage={
        closedOnly
          ? sinceIso
            ? 'No offers closed in this period.'
            : 'No closed offers yet.'
          : 'No offers for this period.'
      }
      valueNoun="offer"
      countLabel="Offers"
      className={className}
    />
  );
}
