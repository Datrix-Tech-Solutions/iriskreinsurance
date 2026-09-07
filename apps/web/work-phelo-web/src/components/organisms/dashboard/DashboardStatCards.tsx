'use client';

import { ModuleIcons } from '@/components/atoms/icons';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { AttendanceMetricCard } from '@/components/molecules/shared/AttendanceMetricCard';
import { formatDateRange } from '@/lib/formatters';

interface AnnualBalance {
  remaining: number;
  entitled: number;
}

interface UpcomingLeave {
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface DashboardStatCardsProps {
  annualBalance: AnnualBalance | null;
  upcomingLeave: UpcomingLeave | null;
  clockedIn: boolean;
  isDone: boolean;
  clockInTime?: string;
  hoursWorked?: string;
  isClockLoading: boolean;
  onRequestLeave: () => void;
  onClockIn: (location?: string) => void;
  onClockOut: () => void;
}

export function DashboardStatCards({
  annualBalance,
  upcomingLeave,
  clockedIn,
  isDone,
  clockInTime,
  hoursWorked,
  isClockLoading,
  onRequestLeave,
  onClockIn,
  onClockOut,
}: DashboardStatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
      <MetricCard
        title="Annual Leave"
        value={annualBalance ? `${annualBalance.remaining}/${annualBalance.entitled}` : '—'}
        sub={annualBalance ? 'Days remaining' : undefined}
        icon={ModuleIcons.leave}
        actionLabel="Request Leave"
        onAction={onRequestLeave}
      />

      <MetricCard
        title="Upcoming Leave"
        value={upcomingLeave ? upcomingLeave.leaveType : 'No upcoming leave'}
        sub={
          upcomingLeave
            ? upcomingLeave.status === 'PENDING'
              ? `${formatDateRange(upcomingLeave.startDate, upcomingLeave.endDate)} · Pending approval`
              : formatDateRange(upcomingLeave.startDate, upcomingLeave.endDate)
            : undefined
        }
        variant={upcomingLeave?.status === 'PENDING' ? 'warning' : 'default'}
        icon={ModuleIcons.leave}
      />

      <AttendanceMetricCard
        clockedIn={clockedIn}
        isDone={isDone}
        clockInTime={clockInTime}
        hoursWorked={hoursWorked}
        onClockIn={onClockIn}
        onClockOut={onClockOut}
        isLoading={isClockLoading}
      />
    </div>
  );
}
