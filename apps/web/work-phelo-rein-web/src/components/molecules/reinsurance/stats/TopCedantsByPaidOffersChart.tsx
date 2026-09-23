'use client';

import { useMemo } from 'react';
import type { PremiumsStatsTopCedant } from '@/hooks';
import {
  TopCedantsBarChart,
  type TopCedantRow,
} from '@/components/molecules/reinsurance/stats/TopCedantsBarChart';

interface TopCedantsByPaidOffersChartProps {
  /** Server-ranked cedants whose offers became fully paid in the selected period. */
  rows: PremiumsStatsTopCedant[];
  isLoading?: boolean;
  /** Whether the window is a past calendar year (changes the empty-state wording). */
  isPastYear?: boolean;
  /** Overrides the card's default height (`h-72`). */
  className?: string;
}

export function TopCedantsByPaidOffersChart({
  rows: paidRows,
  isLoading = false,
  isPastYear = false,
  className,
}: TopCedantsByPaidOffersChartProps) {
  const rows = useMemo<TopCedantRow[]>(
    () =>
      paidRows.map((r) => ({
        name: r.name,
        count: r.count,
        premiumByCurrency: new Map(
          r.premiumByCurrency.map((amount) => [amount.code, amount.amount]),
        ),
      })),
    [paidRows],
  );

  return (
    <TopCedantsBarChart
      title="Top 5 Cedants by Paid Offers"
      rows={rows}
      isLoading={isLoading}
      emptyMessage={
        isPastYear ? 'No offers paid in full that year.' : 'No offers paid in full in this period.'
      }
      valueNoun="paid offer"
      countLabel="Paid offers"
      className={className}
    />
  );
}
