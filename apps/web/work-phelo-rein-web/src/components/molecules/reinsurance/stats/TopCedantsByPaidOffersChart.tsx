'use client';

import { useMemo } from 'react';
import { useTopCedantsByPaidOffers } from '@/hooks';
import type { Facultative } from '@/types/reinsurance';
import {
  TopCedantsBarChart,
  type TopCedantRow,
} from '@/components/molecules/reinsurance/stats/TopCedantsBarChart';

interface TopCedantsByPaidOffersChartProps {
  /** Closing-status placements to rank (same set the Premiums row's balances use). */
  placements: Facultative[];
  /** Window start — an offer counts once its cedant premium is settled in full within it. */
  sinceIso: string;
  /** Window end; omit to run up to now. */
  untilIso?: string;
  /** Whether the window is a past calendar year (changes the empty-state wording). */
  isPastYear?: boolean;
  /** Overrides the card's default height (`h-72`). */
  className?: string;
}

export function TopCedantsByPaidOffersChart({
  placements,
  sinceIso,
  untilIso,
  isPastYear = false,
  className,
}: TopCedantsByPaidOffersChartProps) {
  const { rows: paidRows, isLoading } = useTopCedantsByPaidOffers(placements, sinceIso, untilIso);

  const rows = useMemo<TopCedantRow[]>(
    () =>
      paidRows.map((r) => ({
        name: r.name,
        count: r.count,
        premiumByCurrency: r.premiumByCurrency,
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
