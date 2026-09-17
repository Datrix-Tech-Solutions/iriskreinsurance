'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';
import {
  useReinsuranceFinancials,
  useReinsuranceClaimStats,
  useReinsuranceClaimRatio,
} from '@/hooks';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const PERIOD_PREV_LABELS: Record<Period, string> = {
  daily: 'Yesterday',
  weekly: 'Last week',
  monthly: 'Last month',
  quarterly: 'Last quarter',
  yearly: 'Last year',
};

function fmtAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) {
    formatted = `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (abs >= 1_000_000) {
    formatted = `${(value / 1_000_000).toFixed(2)}M`;
  } else if (abs >= 1_000) {
    formatted = `${(value / 1_000).toFixed(2)}K`;
  } else {
    formatted = value.toFixed(2);
  }
  return symbol ? `${symbol} ${formatted}` : formatted;
}

interface KpiStatsRowProps {
  period: Period;
  year: number;
  currency: string;
}

export function KpiStatsRow({ period, year, currency }: KpiStatsRowProps) {
  const { data: financials, isLoading: loadingFinancials } = useReinsuranceFinancials({
    period,
    year,
    currency,
  });
  const {
    totalAmount: claimsIncurred,
    recoveriesAmount,
    outstandingAmount,
    prevTotalAmount: prevClaimsIncurred,
    trend: claimsTrend,
    isLoading: loadingClaims,
  } = useReinsuranceClaimStats({ period, year, currency });
  const {
    ratio: lossRatio,
    trend: lossRatioTrend,
    prevRatio,
    isLoading: loadingRatio,
  } = useReinsuranceClaimRatio({ period, currency });

  const periodLabel = PERIOD_LABELS[period];
  const prevLabel = PERIOD_PREV_LABELS[period];
  const sym = financials.currencySymbol;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <KpiCard
        label="Gross Premium"
        value={fmtAmount(financials.totalPremium, sym)}
        icon={Icons.FileCheck2}
        iconColor="#2a78d6"
        trend={financials.trends.totalPremium}
        trendTooltip={`${prevLabel}: ${fmtAmount(financials.previous.totalPremium, sym)}`}
        periodLabel={periodLabel}
        isLoading={loadingFinancials}
      />
      <KpiCard
        label="Brokerage Earned"
        value={fmtAmount(financials.totalBrokerage, sym)}
        icon={Icons.Handshake}
        iconColor="#1baf7a"
        trend={financials.trends.totalBrokerage}
        trendTooltip={`${prevLabel}: ${fmtAmount(financials.previous.totalBrokerage, sym)}`}
        periodLabel={periodLabel}
        isLoading={loadingFinancials}
      />
      <KpiCard
        label="Claims Incurred"
        value={fmtAmount(claimsIncurred, sym)}
        icon={Icons.FileWarning}
        iconColor="#eda100"
        trend={claimsTrend}
        trendTooltip={`${prevLabel}: ${fmtAmount(prevClaimsIncurred, sym)}`}
        periodLabel={periodLabel}
        isLoading={loadingClaims}
      />
      <KpiCard
        label="Recoveries Received"
        value={fmtAmount(recoveriesAmount, sym)}
        icon={Icons.CircleDollarSign}
        iconColor="#008300"
        periodLabel={periodLabel}
        isLoading={loadingClaims}
      />
      <KpiCard
        label="Outstanding Recoveries"
        value={fmtAmount(outstandingAmount, sym)}
        icon={Icons.Clock}
        iconColor="#4a3aa7"
        periodLabel={periodLabel}
        isLoading={loadingClaims}
      />
      <KpiCard
        label="Loss Ratio"
        value={`${lossRatio.toFixed(1)}%`}
        icon={Icons.Activity}
        iconColor="#e34948"
        trend={lossRatioTrend}
        trendTooltip={`${prevLabel}: ${prevRatio.toFixed(1)}%`}
        periodLabel={periodLabel}
        isLoading={loadingRatio}
      />
    </div>
  );
}
