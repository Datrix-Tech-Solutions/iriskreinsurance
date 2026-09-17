'use client';

import { LucideIcon } from 'lucide-react';
import { TrendBadge } from '@/components/atoms/TrendBadge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass, waterIconStyle } from '@/lib/utils';

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendTooltip?: string;
  isLoading?: boolean;
  periodLabel: string;
  subtext?: string;
  icon?: LucideIcon;
  /** Hex color seed for the icon's water-glass circle. Defaults to the module color. */
  iconColor?: string;
}

export function DashboardStatCard({
  label,
  value,
  trend,
  trendTooltip,
  isLoading,
  periodLabel,
  subtext,
  icon: Icon,
  iconColor = 'var(--module-btn-bg, var(--brand))',
}: DashboardStatCardProps) {
  return (
    <div className={cardClass('flex flex-col gap-2 p-5', 'glass')}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
        {Icon && (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={waterIconStyle(iconColor)}
          >
            <Icon
              className="w-4.5 h-4.5"
              style={{ color: `color-mix(in oklab, ${iconColor} 65%, black)` }}
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-20" />
        </>
      ) : (
        <>
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {trend !== undefined && <TrendBadge change={trend} tooltip={trendTooltip} />}
              <span className="text-xs text-gray-400">vs previous {periodLabel}</span>
            </div>
            {subtext && <span className="text-s font-medium text-gray-400">{subtext}</span>}
          </div>
        </>
      )}
    </div>
  );
}
