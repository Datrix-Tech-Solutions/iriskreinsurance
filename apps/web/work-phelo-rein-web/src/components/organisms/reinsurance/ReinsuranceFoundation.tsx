'use client';

import { useState } from 'react';
import { Period } from '@/components/atoms/PeriodToggle';
import {
  DashboardView,
  // DashboardViewToggle
} from '@/components/atoms/DashboardViewToggle';
import { DashboardFiltersBar } from '@/components/molecules/reinsurance/DashboardFiltersBar';
import { KpiStatsRow } from '@/components/molecules/reinsurance/stats/KpiStatsRow';
import { PremiumTrendCard } from '@/components/molecules/reinsurance/PremiumTrendCard';
import { RiskClassBreakdownCard } from '@/components/molecules/reinsurance/RiskClassBreakdownCard';
import { BrokerageByCurrencyCard } from '@/components/molecules/reinsurance/BrokerageByCurrencyCard';
import { TopCedantsList } from '@/components/molecules/reinsurance/TopCedantsList';
import { TopReinsurersCard } from '@/components/molecules/reinsurance/TopReinsurersCard';
import { ClaimsOverviewCard } from '@/components/molecules/reinsurance/ClaimsOverviewCard';
import { QuickActionsCard } from '@/components/molecules/reinsurance/QuickActionsCard';
import { GeneralDashboard } from '@/components/organisms/reinsurance/GeneralDashboard';

export default function ReinsuranceFoundation() {
  const [currency, setCurrency] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [
    view,
    // setView
  ] = useState<DashboardView>('general');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <DashboardFiltersBar
          currency={currency}
          onCurrencyChange={setCurrency}
          period={period}
          onPeriodChange={setPeriod}
          year={year}
          onYearChange={setYear}
          showCurrency={view === 'detailed'}
        />
        {/* <DashboardViewToggle value={view} onChange={setView} /> */}
      </div>

      {view === 'general' ? (
        <GeneralDashboard period={period} year={year} />
      ) : (
        <>
          <KpiStatsRow period={period} year={year} currency={currency} />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <PremiumTrendCard currency={currency} />
            </div>
            <div className="lg:col-span-4">
              <RiskClassBreakdownCard period={period} year={year} />
            </div>
            <div className="lg:col-span-3">
              <BrokerageByCurrencyCard period={period} year={year} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <TopCedantsList period={period} year={year} currency={currency} />
            </div>
            <div className="lg:col-span-3">
              <TopReinsurersCard period={period} year={year} currency={currency} />
            </div>
            <div className="lg:col-span-4">
              <ClaimsOverviewCard period={period} currency={currency} />
            </div>
            <div className="lg:col-span-2">
              <QuickActionsCard />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
