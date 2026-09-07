'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { RiskClassPieChart } from '@/components/molecules/reinsurance/RiskClassPieChart';
import { cardClass } from '@/lib/utils';

interface RiskClassBreakdownCardProps {
  period: Period;
  year: number;
}

export function RiskClassBreakdownCard({ period, year }: RiskClassBreakdownCardProps) {
  return (
    <div className={cardClass('flex flex-col gap-3 p-5 h-80', 'glass')}>
      <h3 className="text-sm font-semibold text-gray-900">Offers by Risk Class</h3>
      <div className="flex-1 min-h-0">
        <RiskClassPieChart period={period} year={year} />
      </div>
    </div>
  );
}
