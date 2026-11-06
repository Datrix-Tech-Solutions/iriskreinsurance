'use client';

import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { useCurrencies } from '@/hooks';
import type {
  BrokerageReportCurrencyTotals,
  BrokerageReportScope,
  BrokerageReportSummary,
} from '@/hooks/reinsurance/useBrokerageReport';

interface BrokerageCurrencySummaryCardsProps {
  summary: BrokerageReportSummary;
  scope: BrokerageReportScope;
  isLoading: boolean;
}

type CardDef = {
  title: string;
  columnLabel: string;
  amount: (row: BrokerageReportCurrencyTotals) => number;
};

const CARDS: CardDef[] = [
  { title: 'Total Premium', columnLabel: 'Premium', amount: (r) => r.premium },
  { title: 'Gross Premium', columnLabel: 'Gross Premium', amount: (r) => r.grossPremium },
  { title: 'Brokerage Earned', columnLabel: 'Brokerage', amount: (r) => r.brokerageAmount },
  { title: 'Brokerage Paid', columnLabel: 'Paid', amount: (r) => r.brokeragePaid },
  {
    title: 'Brokerage Outstanding',
    columnLabel: 'Outstanding',
    amount: (r) => r.brokerageAmount - r.brokeragePaid,
  },
];

// Withholding tax and NIC levy are only calculated per reinsurer, so they apply to that scope only.
const REINSURER_CARDS: CardDef[] = [
  { title: 'Withholding Tax', columnLabel: 'WHT', amount: (r) => r.withholdingTax },
  { title: 'NIC Levy', columnLabel: 'NIC Levy', amount: (r) => r.nicLevy },
];

function totalsByCode(rows: BrokerageReportCurrencyTotals[], card: CardDef): Map<string, number> {
  return rows.reduce<Map<string, number>>((acc, row) => {
    const value = card.amount(row);
    if (Math.abs(value) > 0.0001) acc.set(row.currency, value);
    return acc;
  }, new Map());
}

export function BrokerageCurrencySummaryCards({
  summary,
  scope,
  isLoading,
}: BrokerageCurrencySummaryCardsProps) {
  const { data: currencies = [] } = useCurrencies();
  const cards = scope === 'reinsurer' ? [...CARDS, ...REINSURER_CARDS] : CARDS;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      {cards.map((card) => (
        <CurrencyAmountListCard
          key={card.title}
          title={card.title}
          columnLabel={card.columnLabel}
          amountsByCode={totalsByCode(summary.totalsByCurrency ?? [], card)}
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
