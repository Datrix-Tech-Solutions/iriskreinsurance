'use client';

import { cardClass, cn } from '@/lib/utils';

interface SegmentedToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}

export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: SegmentedToggleProps<T>) {
  return (
    <div className={cardClass('flex items-center gap-1 p-1 shadow-none w-fit')}>
      {options.map(({ label, value: v }) => (
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
