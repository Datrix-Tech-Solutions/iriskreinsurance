'use client';

import { useMemo, useState } from 'react';
import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import {
  PremiumsPeriod,
  PremiumsPeriodToggle,
  PREMIUMS_PERIOD_LABEL,
  premiumsPeriodStart,
  premiumsPeriodEnd,
} from '@/components/atoms/PremiumsPeriodToggle';
import { YearSelect } from '@/components/atoms/YearSelect';
import { TopCedantsByPaidOffersChart } from '@/components/molecules/reinsurance/stats/TopCedantsByPaidOffersChart';
import { usePremiumsStats, useCurrencies, type CurrencyAmount } from '@/hooks';

const toAmountMap = (rows: CurrencyAmount[]) => new Map(rows.map((row) => [row.code, row.amount]));

const CURRENT_YEAR = new Date().getFullYear();

export function PremiumsStatsRow() {
  const [period, setPeriod] = useState<PremiumsPeriod>('monthly');
  const [year, setYear] = useState(CURRENT_YEAR);

  const sinceIso = useMemo(
    () => premiumsPeriodStart(period, { year }).toISOString(),
    [period, year],
  );
  const untilIso = useMemo(
    () => premiumsPeriodEnd(period, { year })?.toISOString(),
    [period, year],
  );

  const isPastYear = period === 'yearly' && year !== CURRENT_YEAR;
  const periodLabel = isPastYear ? String(year) : PREMIUMS_PERIOD_LABEL[period];

  const { data: stats, isLoading: loadingStats } = usePremiumsStats({
    since: sinceIso,
    until: untilIso,
  });
  const { data: currencies = [] } = useCurrencies();

  const isLoading = loadingStats;
  const dueByCurrency = stats?.dueByCurrency ?? [];
  const outstandingByCurrency = stats?.outstandingByCurrency ?? [];
  const paidByCurrency = stats?.paidByCurrency ?? [];
  const brokerageEarnedByCurrency = stats?.brokerageEarnedByCurrency ?? [];

  return (
    <div className="flex flex-col">
      <div className="flex justify-end items-center gap-2">
        {period === 'yearly' && <YearSelect value={year} onChange={setYear} />}
        <PremiumsPeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopCedantsByPaidOffersChart
          rows={stats?.topCedantsByPaidOffers ?? []}
          isLoading={loadingStats}
          isPastYear={isPastYear}
          className="h-65"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-5">
          <CurrencyAmountListCard
            title="Current Premium Due"
            columnLabel="Total"
            amountsByCode={toAmountMap(dueByCurrency)}
            subAmountsByCode={toAmountMap(outstandingByCurrency)}
            subLabel="Current outstanding"
            currencies={currencies}
            isLoading={isLoading}
            emptyMessage="No premium due yet"
            className="h-65"
          />
          <CurrencyAmountListCard
            title={`Brokerage Received ${periodLabel}`}
            columnLabel="Brokerage"
            amountsByCode={toAmountMap(brokerageEarnedByCurrency)}
            subAmountsByCode={toAmountMap(paidByCurrency)}
            subLabel="Premium received"
            currencies={currencies}
            isLoading={isLoading}
            emptyMessage="No brokerage received in this period"
            className="h-65"
          />
        </div>
      </div>
    </div>
  );
}
