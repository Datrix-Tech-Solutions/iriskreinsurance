'use client';

import { cardClass, cn } from '@/lib/utils';

export type PremiumsPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIODS: { label: string; value: PremiumsPeriod }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

export const PREMIUMS_PERIOD_LABEL: Record<PremiumsPeriod, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  quarterly: 'This Quarter',
  yearly: 'This Year',
};

/**
 * Start of the calendar week (Mon) / month / quarter / year the window covers. For `'yearly'`,
 * `opts.year` picks the calendar year (from the year dropdown); otherwise the current one.
 */
export function premiumsPeriodStart(
  period: PremiumsPeriod,
  opts: { year?: number; now?: Date } = {},
): Date {
  const now = opts.now ?? new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (period) {
    case 'weekly': {
      const mondayOffset = (now.getDay() + 6) % 7;
      return new Date(y, m, d - mondayOffset);
    }
    case 'monthly':
      return new Date(y, m, 1);
    case 'quarterly':
      return new Date(y, Math.floor(m / 3) * 3, 1);
    case 'yearly':
      return new Date(opts.year ?? y, 0, 1);
  }
}

/**
 * Exclusive upper bound of the window, or `undefined` when it runs right up to "now" — which is
 * every case except a past calendar year picked from the year dropdown.
 */
export function premiumsPeriodEnd(
  period: PremiumsPeriod,
  opts: { year?: number; now?: Date } = {},
): Date | undefined {
  const now = opts.now ?? new Date();
  if (period === 'yearly' && opts.year != null && opts.year < now.getFullYear()) {
    return new Date(opts.year + 1, 0, 1);
  }
  return undefined;
}

interface PremiumsPeriodToggleProps {
  value: PremiumsPeriod;
  onChange: (value: PremiumsPeriod) => void;
}

export function PremiumsPeriodToggle({ value, onChange }: PremiumsPeriodToggleProps) {
  return (
    <div className={cardClass('flex items-center gap-1 p-1 shadow-none')}>
      {PERIODS.map(({ label, value: v }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-input transition-colors',
            value === v
              ? 'bg-(--module-btn-bg,var(--color-brand)) text-white'
              : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
