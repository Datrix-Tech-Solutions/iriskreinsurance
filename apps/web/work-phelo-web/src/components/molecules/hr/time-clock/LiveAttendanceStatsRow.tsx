import { cn } from '@/lib/utils';
import type { AttendanceStats } from '@/types/timeclock';

interface LiveAttendanceStatsRowProps {
  stats?: AttendanceStats;
}

export function LiveAttendanceStatsRow({ stats }: LiveAttendanceStatsRowProps) {
  const cards = [
    {
      label: 'Clocked In',
      value: stats?.clockedIn ?? 0,
      color: 'text-green-700',
      bg: 'bg-green-50 border-green-100',
    },
    {
      label: 'Absent',
      value: stats?.absent ?? 0,
      color: 'text-red-700',
      bg: 'bg-red-50 border-red-100',
    },
    {
      label: 'Late Arrivals',
      value: stats?.late ?? 0,
      color: 'text-orange-700',
      bg: 'bg-orange-50 border-orange-100',
    },
    {
      label: 'Flagged',
      value: stats?.flagged ?? 0,
      color: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-100',
    },
    {
      label: 'On Break',
      value: stats?.onBreak ?? 0,
      color: 'text-blue-700',
      bg: 'bg-blue-50 border-blue-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 shrink-0">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn('rounded-card border px-4 py-3 flex flex-col gap-1', card.bg)}
        >
          <p className="text-xs font-medium text-gray-500">{card.label}</p>
          <div className="flex items-baseline gap-1.5">
            <p className={cn('text-2xl font-bold tabular-nums', card.color)}>{card.value}</p>
            {stats && <span className="text-xs text-gray-400">/ {stats.total}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
