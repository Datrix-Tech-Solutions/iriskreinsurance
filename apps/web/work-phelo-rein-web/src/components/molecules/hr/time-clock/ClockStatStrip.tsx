import { formatMinutes } from '@/lib/formatters';
import type { TodaySession } from '@/types/timeclock';

function formatTime24(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

function getStatusLabel(status: string | undefined) {
  if (status === 'CLOCKED_IN') return 'In Progress';
  if (status === 'ON_BREAK') return 'On Break';
  if (status === 'CLOCKED_OUT') return 'Completed';
  return 'Not Started';
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-0.5">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800 tabular-nums">{value}</p>
    </div>
  );
}

interface Props {
  session: TodaySession | undefined;
  isLoading: boolean;
  netMinutes: number;
}

export function ClockStatStrip({ session, isLoading, netMinutes }: Props) {
  return (
    <div className="grid grid-cols-4 bg-background divide-x divide-gray-100">
      <StatCell label="Clock In" value={session?.clockIn ? formatTime24(session.clockIn) : '—'} />
      <StatCell
        label="Clock Out"
        value={session?.clockOut ? formatTime24(session.clockOut) : '—'}
      />
      <StatCell label="Hours Worked" value={netMinutes > 0 ? formatMinutes(netMinutes) : '—'} />
      <StatCell label="Status" value={isLoading ? '…' : getStatusLabel(session?.status)} />
    </div>
  );
}
