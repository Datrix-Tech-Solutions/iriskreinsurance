'use client';

import { User, CalendarDays, Clock } from 'lucide-react';
import { cn, glassStrongClass } from '@/lib/utils';
import { Avatar } from '@/components/atoms/Avatar';
import { PillColor } from '@/components/molecules/ContactCard';

const PILL_COLORS: Record<PillColor, string> = {
  green: 'border-green-300 text-green-800',
  yellow: 'border-amber-300 text-amber-800',
  red: 'border-red-300 text-red-800',
  blue: 'border-blue-300 text-blue-800',
  gray: 'border-gray-300 text-gray-600',
};

function Pill({ color, children }: { color: PillColor; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold w-fit',
        PILL_COLORS[color],
      )}
    >
      {children}
    </span>
  );
}

export interface Appointment {
  id: string;
  prospectName: string;
  date: string; // ISO: YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  manager: string;
  comment: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export const APPOINTMENT_STATUS_PILL: Record<
  Appointment['status'],
  { label: string; color: PillColor }
> = {
  scheduled: { label: 'Scheduled', color: 'blue' },
  completed: { label: 'Completed', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'gray' },
};

export interface AppointmentCardProps {
  prospectName: string;
  date: string;
  time: string;
  manager: string;
  statusPill: { label: string; color: PillColor };
  onClick?: () => void;
  className?: string;
}

export function AppointmentCard({
  prospectName,
  date,
  time,
  manager,
  statusPill,
  onClick,
  className,
}: AppointmentCardProps) {
  return (
    <div
      className={glassStrongClass(
        cn(
          'group relative rounded-xl p-4 w-95 h-full flex flex-col gap-4',
          'border border-gray-100 shadow-lg transition-all duration-200',
          'hover:border-(--module-border,var(--color-purple-100)) hover:shadow-xl hover:-translate-y-1.5',
          onClick && 'cursor-pointer',
          className,
        ),
        'none',
      )}
      onClick={onClick}
    >
      {/* Header: avatar + prospect name — status pill on the right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={prospectName} />
          <span className="text-sm font-bold text-gray-900 leading-snug">{prospectName}</span>
        </div>
        <Pill color={statusPill.color}>{statusPill.label}</Pill>
      </div>

      {/* Date + time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400">Date</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
            <CalendarDays size={14} className="shrink-0 text-gray-400" />
            {date}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Time</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
            <Clock size={14} className="shrink-0 text-gray-400" />
            {time}
          </p>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Manager */}
      <div className="flex items-center gap-2 text-gray-600 text-sm">
        <User size={14} className="shrink-0 text-gray-400" />
        <span>{manager}</span>
      </div>
    </div>
  );
}
