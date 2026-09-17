'use client';

import { PremiumTrendChart } from '@/components/molecules/reinsurance/PremiumTrendChart';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useReinsurancePremiumTrend } from '@/hooks';
import { cardClass } from '@/lib/utils';

interface PremiumTrendCardProps {
  currency: string;
}

export function PremiumTrendCard({ currency }: PremiumTrendCardProps) {
  const { data, currencySymbol, isLoading } = useReinsurancePremiumTrend({ currency });

  return (
    <div className={cardClass('flex flex-col gap-3 p-5 h-80', 'glass')}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Premium Trend</span>
        <span className="text-xs text-gray-400">Last 12 Months</span>
      </div>

      <div className="flex-1 min-h-0 flex items-center">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <PremiumTrendChart
            data={data.map((d) => ({ date: d.month, amount: d.amount }))}
            currency={currencySymbol}
          />
        )}
      </div>
    </div>
  );
}
