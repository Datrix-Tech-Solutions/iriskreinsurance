'use client';

import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { useCurrencies } from '@/hooks';
import { ReportCurrencyTotals } from '@/hooks/reinsurance/useReportCurrencyTotals';

interface ReportCurrencySummaryCardsProps {
  totals: ReportCurrencyTotals;
  isLoading: boolean;
}

export function ReportCurrencySummaryCards({ totals, isLoading }: ReportCurrencySummaryCardsProps) {
  const { data: currencies = [] } = useCurrencies();
  const loading = isLoading || totals.isLoading;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 shrink-0">
      <CurrencyAmountListCard
        title="Total Fac Sum Insured"
        columnLabel="Sum Insured"
        amountsByCode={totals.sumInsured}
        currencies={currencies}
        isLoading={loading}
        emptyMessage="No data for the selected filters"
      />
      <CurrencyAmountListCard
        title="Total Fac Premium"
        columnLabel="Premium"
        amountsByCode={totals.premium}
        currencies={currencies}
        isLoading={loading}
        emptyMessage="No data for the selected filters"
      />
      <CurrencyAmountListCard
        title="Total Brokerage"
        columnLabel="Brokerage"
        amountsByCode={totals.brokerage}
        currencies={currencies}
        isLoading={loading}
        emptyMessage="No data for the selected filters"
      />
      <CurrencyAmountListCard
        title="Total Commission"
        columnLabel="Commission"
        amountsByCode={totals.commission}
        currencies={currencies}
        isLoading={loading}
        emptyMessage="No data for the selected filters"
      />
      <CurrencyAmountListCard
        title="Total NIC Levy"
        columnLabel="NIC Levy"
        amountsByCode={totals.nicLevy}
        currencies={currencies}
        isLoading={loading}
        emptyMessage="No data for the selected filters"
      />
      <CurrencyAmountListCard
        title="Total WHT"
        columnLabel="WHT"
        amountsByCode={totals.wht}
        currencies={currencies}
        isLoading={loading}
        emptyMessage="No data for the selected filters"
      />
    </div>
  );
}
