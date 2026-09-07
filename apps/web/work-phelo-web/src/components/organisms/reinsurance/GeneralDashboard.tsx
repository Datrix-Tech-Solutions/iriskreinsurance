'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { OffersOverviewRow } from '@/components/molecules/reinsurance/stats/OffersOverviewRow';
import { FinancialStatsRow } from '@/components/molecules/reinsurance/stats/FinancialStatsRow';

interface GeneralDashboardProps {
  period: Period;
  year: number;
}

export function GeneralDashboard({ period, year }: GeneralDashboardProps) {
  return (
    <div className="flex flex-col">
      <OffersOverviewRow period={period} year={year} />
      <FinancialStatsRow period={period} year={year} />
    </div>
  );
}
