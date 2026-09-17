import { cn } from '@/lib/utils';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const variants = {
    success: 'border-green-400 text-green-600',
    warning: 'border-amber-300 text-amber-800',
    danger: 'border-red-300 text-red-800',
    info: 'border-blue-300 text-blue-800',
    neutral: 'border-gray-300 text-gray-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-px rounded-full border text-xs font-semibold w-fit whitespace-nowrap',
        variants[variant],
      )}
    >
      {label}
    </span>
  );
}
