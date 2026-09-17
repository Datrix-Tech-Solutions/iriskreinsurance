import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cardClass } from '@/lib/utils';

/* ── Shared week helpers ── */

export function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getSundayOf(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatWeekRange(start: Date, endOffset = 4): string {
  const end = addDays(start, endOffset);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', opts)}`;
}

export const WEEKDAYS = [
  { label: 'SUN', isoDay: 1 },
  { label: 'MON', isoDay: 2 },
  { label: 'TUE', isoDay: 3 },
  { label: 'WED', isoDay: 4 },
  { label: 'THU', isoDay: 5 },
  { label: 'FRI', isoDay: 6 },
  { label: 'SAT', isoDay: 7 },
] as const;

/* ── Component ── */

interface WeekSelectorProps {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  endOffset?: number;
}

export function WeekSelector({ weekStart, onPrev, onNext, endOffset = 4 }: WeekSelectorProps) {
  return (
    <div className={cardClass('flex items-center gap-2 px-4 py-2.5 shrink-0')}>
      <button
        onClick={onPrev}
        className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
        aria-label="Previous week"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-semibold text-gray-800 min-w-45 text-center">
        {formatWeekRange(weekStart, endOffset)}
      </span>
      <button
        onClick={onNext}
        className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
        aria-label="Next week"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
