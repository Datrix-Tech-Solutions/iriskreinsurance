'use client';

import { useMemo, useState } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';
import { useFacultatives, useAllReinsurerClaims } from '@/hooks';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const OVERDUE_DAYS = 90;

function fmtAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

export function RecoveriesStatsRow() {
  const [now] = useState(() => Date.now());
  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const reinsuredPlacements = useMemo(
    () =>
      allPlacements.filter((p) =>
        p.participants.some((pt) => pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
      ),
    [allPlacements],
  );

  const { rows, isLoading: loadingClaims } = useAllReinsurerClaims(reinsuredPlacements);

  const isLoading = loadingPlacements || loadingClaims;

  const { amountDue, amountReceived, outstanding, overdueCount } = useMemo(() => {
    let due = 0;
    let received = 0;
    let overdueCount = 0;

    rows.forEach((row) => {
      const rowOutstanding = Math.max(0, row.outstandingAmount);
      due += row.calledAmount;
      received += row.recoveredAmount;
      if (
        rowOutstanding > 0 &&
        (now - new Date(row.occurrenceDate).getTime()) / MS_PER_DAY > OVERDUE_DAYS
      ) {
        overdueCount += 1;
      }
    });

    return { amountDue: due, amountReceived: received, outstanding: due - received, overdueCount };
  }, [rows, now]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <KpiCard
        label="Amount Due"
        value={fmtAmount(amountDue)}
        icon={Icons.FileCheck2}
        iconColor="#2a78d6"
        isLoading={isLoading}
      />
      <KpiCard
        label="Amount Received"
        value={fmtAmount(amountReceived)}
        icon={Icons.CircleDollarSign}
        iconColor="#008300"
        isLoading={isLoading}
      />
      <KpiCard
        label="Outstanding"
        value={fmtAmount(outstanding)}
        icon={Icons.Clock}
        iconColor="#eda100"
        isLoading={isLoading}
      />
      <KpiCard
        label={`Aging Analysis`}
        value={overdueCount}
        icon={Icons.Activity}
        iconColor="#e34948"
        isLoading={isLoading}
      />
    </div>
  );
}
