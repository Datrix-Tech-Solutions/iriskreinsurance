'use client';

import { cardClass, cn } from '@/lib/utils';

export type DashboardView = 'detailed' | 'general';

const VIEWS: { label: string; value: DashboardView }[] = [
  { label: 'General Dashboard', value: 'general' },
  { label: 'Detailed Dashboard', value: 'detailed' },
];

interface DashboardViewToggleProps {
  value: DashboardView;
  onChange: (value: DashboardView) => void;
}

export function DashboardViewToggle({ value, onChange }: DashboardViewToggleProps) {
  return (
    <div className={cardClass('flex items-center gap-1 p-1 shadow-none')}>
      {VIEWS.map(({ label, value: v }) => (
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
