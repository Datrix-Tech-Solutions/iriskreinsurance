'use client';

import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { useCurrencies } from '@/hooks';
import type {
  ClaimsReportCurrencyTotals,
  ClaimsReportScope,
  ClaimsReportSummary,
} from '@/hooks/reinsurance/useClaimsReport';

interface ClaimsCurrencySummaryCardsProps {
  summary: ClaimsReportSummary;
  scope: ClaimsReportScope;
  isLoading: boolean;
}

type AmountKey = keyof Pick<
  ClaimsReportCurrencyTotals,
  | 'claimAmount'
  | 'iriskShareAmount'
  | 'bankConfirmedRecovery'
  | 'outstandingRecovery'
  | 'reinsurerShareAmount'
  | 'reinsurerPaidAmount'
  | 'reinsurerOutstandingAmount'
>;

const CLAIM_CARD = { title: 'Total Claim Amount', columnLabel: 'Claim Amount', key: 'claimAmount' };

const IRISK_CARDS: { title: string; columnLabel: string; key: AmountKey }[] = [
  { title: 'iRisk Share', columnLabel: 'Share', key: 'iriskShareAmount' },
  { title: 'iRisk Share Recovered', columnLabel: 'Recovered', key: 'bankConfirmedRecovery' },
  { title: 'iRisk Share Outstanding', columnLabel: 'Outstanding', key: 'outstandingRecovery' },
];

const REINSURER_CARDS: { title: string; columnLabel: string; key: AmountKey }[] = [
  { title: 'Reinsurer Share', columnLabel: 'Share', key: 'reinsurerShareAmount' },
  { title: 'Reinsurer Paid', columnLabel: 'Paid', key: 'reinsurerPaidAmount' },
  { title: 'Reinsurer Outstanding', columnLabel: 'Outstanding', key: 'reinsurerOutstandingAmount' },
];

function totalsByCode(rows: ClaimsReportCurrencyTotals[], key: AmountKey): Map<string, number> {
  return rows.reduce<Map<string, number>>((acc, row) => {
    const value = row[key] ?? 0;
    if (Math.abs(value) > 0.0001) acc.set(row.currency, value);
    return acc;
  }, new Map());
}

// General shows both share blocks, Cedants drops the reinsurer block, Reinsurer drops iRisk —
// mirrors the column sets of the table.
export function ClaimsCurrencySummaryCards({
  summary,
  scope,
  isLoading,
}: ClaimsCurrencySummaryCardsProps) {
  const { data: currencies = [] } = useCurrencies();
  const cards = [
    CLAIM_CARD as { title: string; columnLabel: string; key: AmountKey },
    ...(scope === 'reinsurer' ? [] : IRISK_CARDS),
    ...(scope === 'cedant' ? [] : REINSURER_CARDS),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      {cards.map((card) => (
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
