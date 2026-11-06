'use client';

import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { useCurrencies } from '@/hooks';
import type {
  PremiumsReportCurrencyTotals,
  PremiumsReportSummary,
} from '@/hooks/reinsurance/usePremiumsReport';

interface PremiumsCurrencySummaryCardsProps {
  summary: PremiumsReportSummary;
  isLoading: boolean;
}

type AmountKey = keyof Pick<
  PremiumsReportCurrencyTotals,
  | 'grossPremium'
  | 'cedantCurrentObligation'
  | 'premiumReceived'
  | 'cedantOutstanding'
  | 'reinsurerPayable'
  | 'reinsurerDisbursed'
  | 'reinsurerOutstanding'
  | 'brokerage'
>;

const CARDS: { title: string; columnLabel: string; key: AmountKey }[] = [
  { title: 'Gross Premium', columnLabel: 'Gross Premium', key: 'grossPremium' },
  { title: 'Due From Cedants', columnLabel: 'Due', key: 'cedantCurrentObligation' },
  { title: 'Premium Received', columnLabel: 'Received', key: 'premiumReceived' },
  { title: 'Cedant Outstanding', columnLabel: 'Outstanding', key: 'cedantOutstanding' },
  { title: 'Payable To Reinsurers', columnLabel: 'Payable', key: 'reinsurerPayable' },
  { title: 'Paid To Reinsurers', columnLabel: 'Paid', key: 'reinsurerDisbursed' },
  { title: 'Reinsurer Outstanding', columnLabel: 'Outstanding', key: 'reinsurerOutstanding' },
  { title: 'Total Brokerage', columnLabel: 'Brokerage', key: 'brokerage' },
];

function totalsByCode(rows: PremiumsReportCurrencyTotals[], key: AmountKey): Map<string, number> {
  return rows.reduce<Map<string, number>>((acc, row) => {
    if (Math.abs(row[key]) > 0.0001) acc.set(row.currency, row[key]);
    return acc;
  }, new Map());
}

export function PremiumsCurrencySummaryCards({
  summary,
  isLoading,
}: PremiumsCurrencySummaryCardsProps) {
  const { data: currencies = [] } = useCurrencies();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      {CARDS.map((card) => (
        <CurrencyAmountListCard
          key={card.key}
          title={card.title}
          columnLabel={card.columnLabel}
          amountsByCode={totalsByCode(summary.totalsByCurrency ?? [], card.key)}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No data for the selected filters"
          className="h-auto"
          compactEmpty
        />
      ))}
    </div>
  );
}
