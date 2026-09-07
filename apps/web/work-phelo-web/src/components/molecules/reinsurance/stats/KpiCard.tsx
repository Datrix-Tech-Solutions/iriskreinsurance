'use client';

import { LucideIcon } from 'lucide-react';
import { TrendBadge } from '@/components/atoms/TrendBadge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass, waterIconStyle } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Hex/CSS color seed for the icon's water-glass circle. */
  iconColor?: string;
  trend?: number;
  trendTooltip?: string;
  periodLabel?: string;
  /** Optional breakdown shown under the value, e.g. Pending / Finalized splits. */
  sub?: { label: string; value: string | number }[];
  isLoading?: boolean;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = 'var(--module-btn-bg, var(--brand))',
  trend,
  trendTooltip,
  periodLabel,
  sub,
  isLoading,
}: KpiCardProps) {
  return (
    <div className={cardClass('flex items-center gap-2 p-2', 'glass')}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={waterIconStyle(iconColor)}
      >
        <Icon
          className="w-4 h-4"
          style={{ color: `color-mix(in oklab, ${iconColor} 65%, black)` }}
        />
      </div>

      <div className="flex flex-col gap-px min-w-0">
        <span className="text-xs font-light text-gray-700">{label}</span>
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-lg font-bold text-gray-900">{value}</span>
              {sub && sub.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                  {sub.map((s) => (
                    <span key={s.label}>
                      {s.label} <span className="font-semibold text-gray-700">{s.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {trend !== undefined && (
              <div className="flex items-center gap-1">
                <TrendBadge change={trend} tooltip={trendTooltip} />
                <span className="text-[10px] text-gray-400">vs previous {periodLabel}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
