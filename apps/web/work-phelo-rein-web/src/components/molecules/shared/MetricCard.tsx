'use client';

import { LucideIcon } from 'lucide-react';
import { cn, cardClass, waterIconStyle } from '@/lib/utils';

interface MetricCardProps {
  title?: string;
  label?: string;
  value?: string | number;
  sub?: string;
  unit?: string;
  icon?: LucideIcon;
  /** Hex color seed for the icon's water-glass circle. Defaults to a color matching `variant`. */
  iconColor?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'highlight' | 'success' | 'warning' | 'danger';
  highlight?: 'green' | 'red';
  className?: string;
}

const VARIANT_ICON_COLORS: Record<string, string> = {
  default: 'var(--module-btn-bg, var(--brand))',
  highlight: 'var(--module-btn-bg, var(--brand))',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export function MetricCard({
  title,
  label,
  value,
  sub,
  unit,
  icon: Icon,
  iconColor,
  actionLabel,
  onAction,
  variant = 'default',
  highlight,
  className = '',
}: MetricCardProps) {
  const heading = title ?? label;

  const variantStyles: Record<string, string> = {
    default: 'text-gray-900',
    highlight: 'text-brand',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-500',
  };

  const valueColor =
    highlight === 'green'
      ? 'text-green-600'
      : highlight === 'red'
        ? 'text-red-500'
        : variantStyles[variant];

  const resolvedIconColor = iconColor ?? VARIANT_ICON_COLORS[variant];

  return (
    <div className={cardClass(cn('px-5 py-5 flex flex-col', className), 'glass')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-sm text-gray-500 font-medium leading-snug line-clamp-2 min-w-0">
          {heading}
        </span>
        {Icon && (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={waterIconStyle(resolvedIconColor)}
          >
            <Icon
              className="w-4.5 h-4.5"
              style={{ color: `color-mix(in oklab, ${resolvedIconColor} 65%, black)` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between flex-1">
        <div>
          <p className={cn('text-l ', valueColor)}>
            {value}
            {unit && <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>}
          </p>
          {sub && <span className="text-xs text-gray-400 mt-0.5 block">{sub}</span>}
        </div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
