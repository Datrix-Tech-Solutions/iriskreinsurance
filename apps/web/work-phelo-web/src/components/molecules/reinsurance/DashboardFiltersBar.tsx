'use client';

import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PeriodToggle, Period } from '@/components/atoms/PeriodToggle';
import { YearSelect } from '@/components/atoms/YearSelect';
import { useCurrencyOptions } from '@/hooks';

interface DashboardFiltersBarProps {
  currency: string;
  onCurrencyChange: (value: string) => void;
  period: Period;
  onPeriodChange: (value: Period) => void;
  year: number;
  onYearChange: (value: number) => void;
  showCurrency?: boolean;
}

export function DashboardFiltersBar({
  currency,
  onCurrencyChange,
  period,
  onPeriodChange,
  year,
  onYearChange,
  showCurrency = true,
}: DashboardFiltersBarProps) {
  const { data: currencyOptions = [] } = useCurrencyOptions();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {showCurrency && (
        <div className="w-64">
          <SearchSelect
            placeholder="Select currency…"
            options={currencyOptions}
            value={currency}
            onChange={onCurrencyChange}
            size="sm"
          />
        </div>
      )}

      {period === 'yearly' && <YearSelect value={year} onChange={onYearChange} />}

      <PeriodToggle value={period} onChange={onPeriodChange} />
    </div>
  );
}
