'use client';

import { Calendar } from 'lucide-react';
import { formatHolidayDate } from '@/lib/formatters';
import { transparentCardClass, waterIconStyle } from '@/lib/utils';
import { DataList, type Column } from '@/components/organisms/shared/DataList';

interface Holiday {
  id: string;
  name: string;
  date: string;
  observedDate?: string;
}

interface UpcomingHolidaysCardProps {
  holidays: Holiday[];
}

const columns: Column<Holiday>[] = [
  {
    key: 'holiday',
    label: 'Holiday',
    render: (h) => (
      <div className="flex items-center gap-3">
        <div
          className="relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center overflow-hidden"
          style={waterIconStyle('#3b82f6')}
        >
          <span className="absolute top-1 left-1.5 w-2 h-1.5 rounded-full bg-white/85 blur-[1px]" />
          <Calendar className="w-4 h-4 text-blue-700/80 relative" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 group-hover/row:text-gray-600">
            {formatHolidayDate(h.observedDate ?? h.date, true)}
          </p>
          <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
        </div>
      </div>
    ),
  },
];

export function UpcomingHolidaysCard({ holidays }: UpcomingHolidaysCardProps) {
  return (
    <div className={transparentCardClass('py-5 flex flex-col gap-3 min-h-60 flex-1')}>
      <h2 className="text-base font-bold text-gray-900">Upcoming Holidays</h2>
      <div className="-mx-3 px-3">
        <DataList columns={columns} data={holidays} emptyMessage="No upcoming public holidays" />
      </div>
    </div>
  );
}
