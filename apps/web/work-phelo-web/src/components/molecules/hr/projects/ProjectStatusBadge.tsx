import { cn } from '@/lib/utils';
import { ProjectStatus } from '@/types/hr';

const STATUS_STYLES: Record<
  ProjectStatus,
  { dot: string; text: string; bg: string; label: string }
> = {
  PLANNING: { dot: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Planning' },
  ACTIVE: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Active' },
  ON_HOLD: { dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'On Hold' },
  COMPLETED: { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100', label: 'Completed' },
  CANCELLED: { dot: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50', label: 'Cancelled' },
};

export { STATUS_STYLES };

interface Props {
  status: ProjectStatus;
}

export function ProjectStatusBadge({ status }: Props) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
        s.bg,
        s.text,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}
