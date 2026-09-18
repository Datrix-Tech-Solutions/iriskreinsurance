'use client';

import { cardClass, cn } from '@/lib/utils';

export type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

export interface PeriodWindow {
  /** Inclusive lower bound of the selected period. */
  start: Date;
  /** Inclusive upper bound — "now" for the running period, end-of-year for a past year. */
  end: Date;
  /** Lower bound of the preceding period, for trend comparisons. */
  prevStart: Date;
}

/**
 * Resolves a `Period` (plus an optional year, when `period` is `'yearly'` and the user has
 * picked one from the year dropdown) to concrete `start` / `end` / `prevStart` dates.
 * For every period except a past year, `end` is "now" — so behaviour is unchanged there.
 */
export function periodWindow(
  period: Period,
  opts: { year?: number; now?: Date } = {},
): PeriodWindow {
  const now = opts.now ?? new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const mondayOffset = (now.getDay() + 6) % 7;

  switch (period) {
    case 'daily':
      return { start: new Date(y, m, d), end: now, prevStart: new Date(y, m, d - 1) };
    case 'weekly':
      return {
        start: new Date(y, m, d - mondayOffset),
        end: now,
        prevStart: new Date(y, m, d - mondayOffset - 7),
      };
    case 'monthly':
      return { start: new Date(y, m, 1), end: now, prevStart: new Date(y, m - 1, 1) };
    case 'quarterly': {
      const q = Math.floor(m / 3) * 3;
      return { start: new Date(y, q, 1), end: now, prevStart: new Date(y, q - 3, 1) };
    }
    case 'yearly': {
      const yr = opts.year ?? y;
      return {
        start: new Date(yr, 0, 1),
        end: yr >= y ? now : new Date(yr, 11, 31, 23, 59, 59, 999),
        prevStart: new Date(yr - 1, 0, 1),
      };
    }
  }
}

interface PeriodToggleProps {
  value: Period;
  onChange: (value: Period) => void;
}

export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
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
