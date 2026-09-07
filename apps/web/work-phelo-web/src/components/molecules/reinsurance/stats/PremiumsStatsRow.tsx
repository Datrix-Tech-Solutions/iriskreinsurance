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
import { TopCedantsByOffersChart } from '@/components/molecules/reinsurance/stats/TopCedantsByOffersChart';
import {
  useFacultatives,
  usePremiumsSummary,
  usePremiumsPeriodSummary,
  useCurrencies,
  CLOSING_STATUSES,
  type CurrencyAmount,
} from '@/hooks';

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

  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingPlacements = useMemo(
    () => allPlacements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [allPlacements],
  );

  // Balances (due / outstanding) — not windowable, always current.
  const {
    dueByCurrency,
    outstandingByCurrency,
    isLoading: loadingPayments,
  } = usePremiumsSummary(closingPlacements);

  // Flows (paid / brokerage / collection rate) — scoped to the selected period.
  const periodSummary = usePremiumsPeriodSummary(closingPlacements, sinceIso, untilIso);

  const { data: currencies = [] } = useCurrencies();

  const isLoading = loadingPlacements || loadingPayments || periodSummary.isLoading;

  return (
    <div className="flex flex-col">
      <div className="flex justify-end items-center gap-2">
        {period === 'yearly' && <YearSelect value={year} onChange={setYear} />}
        <PremiumsPeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopCedantsByOffersChart
          period="monthly"
          closedOnly
          sinceIso={sinceIso}
          untilIso={untilIso}
          className="h-65"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-5">
          <CurrencyAmountListCard
            title="Total Premium"
            columnLabel="Total"
            amountsByCode={toAmountMap(dueByCurrency)}
            subAmountsByCode={toAmountMap(outstandingByCurrency)}
            subLabel="Outstanding"
            currencies={currencies}
            isLoading={isLoading}
            emptyMessage="No premium due yet"
            className="h-65"
          />
          <CurrencyAmountListCard
            title={`Brokerage Received ${periodLabel}`}
            columnLabel="Brokerage"
            amountsByCode={toAmountMap(periodSummary.brokerageEarnedByCurrency)}
            subAmountsByCode={toAmountMap(periodSummary.paidByCurrency)}
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
