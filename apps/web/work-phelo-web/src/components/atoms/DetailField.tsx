import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DetailFieldProps {
  label: string;
  value: ReactNode;
  horizontal?: boolean;
  inline?: boolean;
  /** Only applies when `inline` is set. Defaults to text-base for both label and value. */
  compact?: boolean;
}

export function DetailField({
  label,
  value,
  horizontal = false,
  inline = false,
  compact = false,
}: DetailFieldProps) {
  if (inline) {
    return (
      <div className="flex items-baseline gap-6">
        <span
          className={cn(
            'font-semibold text-gray-700 shrink-0 min-w-70',
            compact ? 'text-xs' : 'text-base',
          )}
        >
          {label}:
        </span>
        <span className={cn('text-gray-800', compact ? 'text-sm' : 'text-base')}>
          {value ?? '—'}
        </span>
      </div>
    );
  }

  if (horizontal) {
    return (
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">
          {label}
        </span>
        <span className="text-sm font-medium text-gray-800 text-right">{value ?? '—'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}
