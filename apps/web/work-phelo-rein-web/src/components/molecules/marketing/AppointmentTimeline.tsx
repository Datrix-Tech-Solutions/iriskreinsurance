'use client';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { Appointment } from '@/components/molecules/marketing/AppointmentCard';

interface Props {
  appointments: Appointment[];
}

export function AppointmentTimeline({ appointments }: Props) {
  if (appointments.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No upcoming appointments</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-1.5 top-3 bottom-3 w-0.5 bg-orange-500" />

      <div className="flex flex-col gap-5">
        {appointments.map((appt, i) => (
          <div key={appt.id} className="flex items-center gap-4">
            <span
              className={cn(
                'relative z-10 w-3.5 h-3.5 rounded-full border-2 shrink-0',
                i === 0 ? 'bg-brand border-brand' : 'bg-white border-gray-300',
              )}
            />
            <div className="flex-1 flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 min-w-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{formatDate(appt.date)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {appt.startTime} – {appt.endTime}
                </p>
              </div>
              <span className="w-px h-8 bg-gray-200 shrink-0" />
              <p className="text-sm text-gray-500 text-right truncate">{appt.prospectName}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
