import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  ACTIVE: {
    dot: 'bg-green-500',
    text: 'text-green-700',
    bg: 'bg-green-50',
    label: 'Permanent Staff',
  },
  PROBATION: {
    dot: 'bg-yellow-400',
    text: 'text-yellow-700',
    bg: 'bg-yellow-50',
    label: 'Probation',
  },
  ON_LEAVE: { dot: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', label: 'On Leave' },
  SUSPENDED: { dot: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50', label: 'Suspended' },
  TERMINATED: {
    dot: 'bg-red-600',
    text: 'text-red-800',
    bg: 'bg-red-100',
    label: 'Terminated',
  },
  OFFBOARDED: {
    dot: 'bg-gray-400',
    text: 'text-gray-600',
    bg: 'bg-gray-100',
    label: 'Offboarded',
  },
  PENDING_VERIFICATION: {
    dot: 'bg-orange-400',
    text: 'text-orange-700',
    bg: 'bg-orange-50',
    label: 'Invite Pending',
  },
  INACTIVE: { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100', label: 'Inactive' },
};

interface Props {
  status: string;
  className?: string;
}

export function EmploymentStatusBadge({ status, className }: Props) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.OFFBOARDED;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}
