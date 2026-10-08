'use client';

import { useMemo } from 'react';
import { Period } from '@/components/atoms/PeriodToggle';
import { useReinsuranceTopCedants } from '@/hooks';
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
  const { data: topCedants, isLoading } = useReinsuranceTopCedants({ period, year });

  const rows = useMemo<TopCedantRow[]>(() => {
    void closedOnly;
    void sinceIso;
    void untilIso;
    return topCedants.map((row) => ({
      name: row.name,
      count: row.offerCount,
      premiumByCurrency: new Map(
        row.totalPremiumByCurrency.map((item) => [item.currency, item.amount]),
      ),
    }));
  }, [topCedants, closedOnly, sinceIso, untilIso]);

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
