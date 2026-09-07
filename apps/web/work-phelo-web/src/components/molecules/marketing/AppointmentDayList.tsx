'use client';

import { Clock, User } from 'lucide-react';
import { cardClass } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { Appointment } from '@/components/molecules/marketing/AppointmentCard';

interface Props {
  date: string; // ISO
  appointments: Appointment[];
}

export function AppointmentDayList({ date, appointments }: Props) {
  return (
    <div className={cardClass('p-4 flex flex-col gap-3')}>
      <h3 className="text-sm font-bold text-gray-900">{formatDate(date)}</h3>

      {appointments.length === 0 ? (
        <p className="text-sm text-gray-400">No appointments on this day</p>
      ) : (
        <div className="flex flex-col gap-2">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{appt.prospectName}</p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <Clock size={12} className="shrink-0" />
                  {appt.startTime} – {appt.endTime}
                </p>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                <User size={12} className="shrink-0" />
                {appt.manager}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
