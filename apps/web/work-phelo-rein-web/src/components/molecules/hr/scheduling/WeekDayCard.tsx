'use client';

import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DayShiftType = 'morning' | 'afternoon' | 'night' | 'on-leave';

export interface DayShift {
  scheduleId?: string;
  type: DayShiftType;
  workMode?: 'ONSITE' | 'REMOTE' | 'HYBRID';
  startTime?: string;
  endTime?: string;
  leaveType?: string;
}

interface WeekDayCardProps {
  day: string;
  date: number;
  isToday?: boolean;
  shifts: DayShift[];
  isSelected?: boolean;
  onClick?: () => void;
  onSwapShift?: (shift: DayShift) => void;
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')}${period}`;
}

const SHIFT_STYLES: Record<DayShiftType, { bg: string; text: string }> = {
  morning: { bg: 'bg-green-100', text: 'text-green-600' },
  afternoon: { bg: 'bg-purple-100', text: 'text-purple-600' },
  night: { bg: 'bg-shift-night', text: 'text-white' },
  'on-leave': { bg: 'bg-blue-200', text: 'text-blue-600' },
};

function SingleShift({
  shift,
  onSwapShift,
}: {
  shift: DayShift;
  onSwapShift?: (shift: DayShift) => void;
}) {
  const isLeave = shift.type === 'on-leave';
  const styles = SHIFT_STYLES[shift.type];
  const typeLabel = shift.type === 'on-leave' ? 'ON LEAVE' : shift.type.toUpperCase();
  const timeStr =
    !isLeave && shift.startTime && shift.endTime
      ? `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`
      : '';
  const workModeLabel = shift.workMode
    ? shift.workMode.charAt(0) + shift.workMode.slice(1).toLowerCase()
    : '';

  return (
    <div className={cn('flex flex-col flex-1 p-4 min-h-36', styles.bg)}>
      <div className="flex-1">
        <p className={cn('text-xs font-bold uppercase tracking-wide', styles.text)}>{typeLabel}</p>
        {timeStr && <p className={cn('text-xs mt-1', styles.text)}>{timeStr}</p>}
        {!isLeave && workModeLabel && (
          <p className={cn('text-[11px] mt-1', styles.text, 'opacity-80')}>{workModeLabel}</p>
        )}
        {isLeave && shift.leaveType && (
          <p className={cn('text-sm mt-1', styles.text)}>{shift.leaveType}</p>
        )}
      </div>

      {!isLeave && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSwapShift?.(shift);
          }}
          className="mt-3 flex items-center justify-center gap-2 w-full bg-gray-50 rounded-xl py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Swap Shift
        </button>
      )}
    </div>
  );
}

function MultiShift({
  shifts,
  onSwapShift,
}: {
  shifts: DayShift[];
  onSwapShift?: (shift: DayShift) => void;
}) {
  return (
    <div className="flex flex-col flex-1 p-3 gap-2 min-h-36 bg-gray-50">
      {shifts.map((shift, i) => {
        const isLeave = shift.type === 'on-leave';
        const styles = SHIFT_STYLES[shift.type];
        const typeLabel =
          shift.type === 'on-leave'
            ? 'On Leave'
            : shift.type.charAt(0).toUpperCase() + shift.type.slice(1);
        const timeStr =
          !isLeave && shift.startTime && shift.endTime
            ? `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`
            : (shift.leaveType ?? '');
        const workModeLabel = shift.workMode
          ? shift.workMode.charAt(0) + shift.workMode.slice(1).toLowerCase()
          : '';

        return (
          <div
            key={i}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg px-3 py-2',
              styles.bg,
            )}
          >
            <div className="min-w-0">
              <p className={cn('text-xs font-semibold truncate', styles.text)}>{typeLabel}</p>
              {timeStr && (
                <p className={cn('text-[11px] truncate', styles.text, 'opacity-80')}>{timeStr}</p>
              )}
              {!isLeave && workModeLabel && (
                <p className={cn('text-[11px] truncate', styles.text, 'opacity-80')}>
                  {workModeLabel}
                </p>
              )}
            </div>

            {!isLeave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwapShift?.(shift);
                }}
                className="shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="Swap shift"
              >
                <ArrowLeftRight className={cn('w-3.5 h-3.5', styles.text)} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WeekDayCard({
  day,
  date,
  isToday,
  shifts,
  isSelected,
  onClick,
  onSwapShift,
}: WeekDayCardProps) {
  const isEmpty = shifts.length === 0;
  const isSingle = shifts.length === 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={cn(
        'flex flex-col rounded-2xl overflow-hidden border-2 w-full text-left transition-all duration-150 cursor-pointer',
        isSelected ? 'border-shift-night' : 'border-gray-200',
      )}
    >
      {/* Header */}
      <div className="bg-gray-100 px-4 py-3 text-center w-full shrink-0">
        <p
          className={cn(
            'text-xs font-semibold tracking-widest uppercase',
            isToday ? 'text-brand' : 'text-gray-500',
          )}
        >
          {day}
        </p>
        <p
          className={cn(
            'text-3xl font-bold leading-none mt-1',
            isToday ? 'text-brand' : 'text-gray-800',
          )}
        >
          {date}
        </p>
      </div>

      {/* Body */}
      {isEmpty ? (
        <div className="flex flex-col flex-1 p-4 min-h-36 bg-gray-50 items-center justify-center">
          <p className="text-sm text-gray-400 font-medium">OFF</p>
        </div>
      ) : isSingle ? (
        <SingleShift shift={shifts[0]} onSwapShift={onSwapShift} />
      ) : (
        <MultiShift shifts={shifts} onSwapShift={onSwapShift} />
      )}
    </div>
  );
}
