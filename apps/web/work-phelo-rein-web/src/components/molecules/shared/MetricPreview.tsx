import { cn } from '@/lib/utils';

export interface MetricItem {
  label: string;
  value: string;
  highlight?: boolean; // renders value in orange
}

interface MetricPreviewProps {
  title: string;
  metrics: MetricItem[];
  className?: string;
}

export function MetricPreview({ title, metrics, className }: MetricPreviewProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-100 bg-gray-50 p-5 flex flex-col gap-4',
        className,
      )}
    >
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <div
        className="grid gap-0 divide-x divide-gray-200"
        style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}
      >
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn('flex flex-col gap-1', {
              'pr-4': i === 0,
              'px-4': i > 0 && i < metrics.length - 1,
              'pl-4': i === metrics.length - 1 && metrics.length > 1,
            })}
          >
            <p className="text-xs text-gray-500">{m.label}</p>
            <p
              className={cn(
                'text-sm font-semibold',
                m.highlight ? 'text-orange-500' : 'text-gray-900',
              )}
            >
              {m.value || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
