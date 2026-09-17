import { cn } from '@/lib/utils';

export type TypeChipColor = 'red' | 'green' | 'blue' | 'purple' | 'amber' | 'teal' | 'gray';

const COLOR_STYLES: Record<TypeChipColor, string> = {
  red: 'bg-rose-100 text-rose-800',
  green: 'bg-emerald-100 text-emerald-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-indigo-100 text-indigo-800',
  amber: 'bg-amber-100 text-amber-800',
  teal: 'bg-teal-100 text-teal-800',
  gray: 'bg-gray-100 text-gray-600',
};

interface TypeChipProps {
  label: string;
  color?: TypeChipColor;
}

export function TypeChip({ label, color = 'gray' }: TypeChipProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        COLOR_STYLES[color],
      )}
    >
      {label}
    </span>
  );
}
