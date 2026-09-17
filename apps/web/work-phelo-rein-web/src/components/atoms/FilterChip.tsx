import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}

export function FilterChip({ label, count, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition cursor-pointer whitespace-nowrap border hover:scale-[1.1] active:scale-[0.97]',
        active
          ? 'bg-(--module-btn-bg,var(--color-brand)) text-white border-(--module-btn-bg,var(--color-brand)) hover:bg-(--module-btn-bg-hover,var(--color-brand-hover))'
          : 'bg-gray-100 text-gray-600 border-transparent hover:border-(--module-btn-bg,var(--color-brand))',
      )}
    >
      {label}
      <span className={cn('text-xs font-semibold', active ? 'text-white/60' : 'text-gray-400')}>
        {count}
      </span>
    </button>
  );
}
