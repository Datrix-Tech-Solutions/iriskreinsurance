'use client';

import { cn } from '@/lib/utils';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export interface CalendarProps {
  viewYear: number;
  viewMonth: number; // 0-11
  value?: string; // ISO: YYYY-MM-DD — selected date
  onSelectDay: (iso: string) => void;
  disableFuture?: boolean;
  disablePast?: boolean;
  minDate?: string; // ISO: YYYY-MM-DD — disables all days before this date
  maxDate?: string; // ISO: YYYY-MM-DD — disables all days after this date
  /** ISO dates (YYYY-MM-DD) to mark with a dot indicator — e.g. days that have appointments. */
  markedDates?: string[];
  className?: string;
}

/** The day-grid rendered inside DatePicker's popup — pulled out so it can also be
 *  used as a plain, always-visible calendar (no trigger/dropdown) elsewhere. */
export function Calendar({
  viewYear,
  viewMonth,
  value,
  onSelectDay,
  disableFuture = false,
  disablePast = false,
  minDate,
  maxDate,
  markedDates,
  className,
}: CalendarProps) {
  const today = new Date();
  const parsed = value ? new Date(value) : null;
  const markedSet = new Set(markedDates ?? []);

  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const minDateNorm = minDate
    ? (() => {
        const d = new Date(minDate);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      })()
    : null;
  const maxDateNorm = maxDate
    ? (() => {
        const d = new Date(maxDate);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      })()
    : null;

  const isDisabledDay = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    if (disableFuture && date > todayNorm) return true;
    if (disablePast && date < todayNorm) return true;
    if (minDateNorm && date < minDateNorm) return true;
    if (maxDateNorm && date > maxDateNorm) return true;
    return false;
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={className}>
      <div className="grid grid-cols-7 text-xs text-gray-500 py-2 px-3 border-b">
        {DAYS.map((d) => (
          <div key={d} className="text-center font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 p-3">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-9" />;
          const iso = new Date(viewYear, viewMonth, day).toISOString().split('T')[0];
          const disabled = isDisabledDay(day);
          const isSelected =
            parsed &&
            parsed.getDate() === day &&
            parsed.getMonth() === viewMonth &&
            parsed.getFullYear() === viewYear;
          const isCurrentDay =
            today.getDate() === day &&
            today.getMonth() === viewMonth &&
            today.getFullYear() === viewYear;
          const isMarked = markedSet.has(iso);

          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onSelectDay(iso)}
              disabled={disabled}
              className={cn(
                'relative h-9 w-full text-sm rounded-lg transition-all',
                disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : isSelected
                    ? 'bg-brand text-white font-semibold shadow-sm'
                    : isCurrentDay
                      ? 'border-2 border-brand text-brand font-medium'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              {day}
              {isMarked && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
