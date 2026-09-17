'use client';

import { useMemo, useState } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { Icons } from '@/components/atoms/icons';
import {
  PremiumsPeriod,
  PremiumsPeriodToggle,
  premiumsPeriodStart,
  premiumsPeriodEnd,
} from '@/components/atoms/PremiumsPeriodToggle';
import { YearSelect } from '@/components/atoms/YearSelect';
import { useClaimsWorklistSummary, useCurrencies } from '@/hooks';
import type { ClaimsCurrencyAmount } from '@/types/reinsurance';

const toAmountMap = (rows: ClaimsCurrencyAmount[]) =>
  new Map(rows.map((row) => [row.code, row.amount]));

const CURRENT_YEAR = new Date().getFullYear();

export function ClaimsStatsRow() {
  // Period filter — same control as the Premiums page. Every card below reads from
  // `summary`, which is windowed by claim entry date to [since, until).
  const [period, setPeriod] = useState<PremiumsPeriod>('monthly');
  const [year, setYear] = useState(CURRENT_YEAR);

  const since = useMemo(() => premiumsPeriodStart(period, { year }).toISOString(), [period, year]);
  const until = useMemo(() => premiumsPeriodEnd(period, { year })?.toISOString(), [period, year]);

  const { data: summary, isLoading } = useClaimsWorklistSummary({ since, until });
  const { data: currencies = [] } = useCurrencies();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end items-center gap-2">
        {period === 'yearly' && <YearSelect value={year} onChange={setYear} />}
        <PremiumsPeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard
          label="Total Claims"
          value={summary?.totalClaims ?? 0}
          icon={Icons.FileWarning}
          iconColor="#2a78d6"
          isLoading={isLoading}
        />
        <KpiCard
          label="Open Claims"
          value={summary?.openClaims ?? 0}
          icon={Icons.Clock}
          iconColor="#4a3aa7"
          sub={[
            { label: 'Pending', value: summary?.openPendingClaims ?? 0 },
            { label: 'Finalized', value: summary?.openFinalizedClaims ?? 0 },
          ]}
          isLoading={isLoading}
        />
        <KpiCard
          label="Closed Claims"
          value={summary?.closedClaims ?? 0}
          icon={Icons.CircleCheckBig}
          iconColor="#6b7280"
          isLoading={isLoading}
        />
        <KpiCard
          label="Notifications"
          value={summary?.notificationClaims ?? 0}
          icon={Icons.Bell}
          iconColor="#eda100"
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CurrencyAmountListCard
          title="Total claim amount due to iRisk Reinsurance"
          columnLabel="Claim Share"
          amountsByCode={toAmountMap(summary?.claimsByCurrency ?? [])}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No finalized claims yet"
          className="h-55"
        />
        <CurrencyAmountListCard
          title="Outstanding claim amount due to iRisk Reinsurance"
          columnLabel="Outstanding"
          amountsByCode={toAmountMap(summary?.outstandingRecoveredByCurrency ?? [])}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No outstanding recovery"
          className="h-55"
        />
        <CurrencyAmountListCard
          title="Total amount recovered"
          columnLabel="Recovered"
          amountsByCode={toAmountMap(summary?.recoveredByCurrency ?? [])}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No recoveries yet"
          className="h-55"
        />
      </div>
    </div>
  );
}
