'use client';

import { cn, cardClass } from '@/lib/utils';
import { Employee } from '@/types/hr';
import { ShiftSchedule } from '@/types/scheduling';
import { WEEKDAYS, addDays, toISODate } from '@/components/molecules/hr/scheduling/WeekSelector';
import { SchedulingGridCell } from '@/components/molecules/hr/scheduling/SchedulingGridCell';

interface Props {
  employees: Employee[];
  weekStart: Date;
  weekDates: string[];
  shiftsByKey: Record<string, ShiftSchedule[]>;
  canManage: boolean;
  onAddShift: (employeeId: string, date: string) => void;
  onOpenDetail: (schedule: ShiftSchedule, date: string) => void;
}

function OnLeaveCell({ isToday }: { isToday: boolean }) {
  return (
    <div
      className={cn(
        'border-l border-gray-100 p-3 min-h-20 flex items-center justify-center',
        isToday ? 'bg-blue-50' : 'bg-gray-50/80',
      )}
    >
      <span className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        On Leave
      </span>
    </div>
  );
}

export function SchedulingGrid({
  employees,
  weekStart,
  weekDates,
  shiftsByKey,
  canManage,
  onAddShift,
  onOpenDetail,
}: Props) {
  const today = toISODate(new Date());

  return (
    <div className={cardClass('overflow-hidden')} style={{ minWidth: 1000 }}>
      {/* Header row */}
      <div
        className="grid bg-gray-50 border-b border-gray-200"
        style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
      >
        <div className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
          Employee
        </div>
        {WEEKDAYS.map(({ label, isoDay }) => {
          const dayDate = addDays(weekStart, isoDay - 1);
          const dateStr = toISODate(dayDate);
          const isToday = dateStr === today;
          const isPast = dateStr < today;
          return (
            <div
              key={label}
              className={cn(
                'px-4 py-3.5 text-center border-l border-gray-200',
                isToday && 'bg-blue-300',
                isPast && 'bg-gray-50',
              )}
            >
              <span
                className={cn(
                  'text-xs font-semibold tracking-wider',
                  isToday ? 'text-brand' : isPast ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                {label} {dayDate.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Employee rows */}
      {employees.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">No employees found</div>
      ) : (
        employees.map((emp) => {
          const isOnLeave = emp.employmentStatus === 'ON_LEAVE';
          return (
            <div
              key={emp.id}
              className={cn('grid border-t border-gray-100', isOnLeave && 'opacity-60')}
              style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
            >
              <div className="px-5 py-4 flex items-center gap-2 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">
                <span
                  className={cn(
                    'text-sm font-medium leading-snug',
                    isOnLeave ? 'text-gray-400' : 'text-gray-800',
                  )}
                >
                  {emp.firstName} {emp.lastName}
                </span>
                {isOnLeave && (
                  <span className="shrink-0 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                    Leave
                  </span>
                )}
              </div>

              {weekDates.map((date) =>
                isOnLeave ? (
                  <OnLeaveCell key={date} isToday={date === today} />
                ) : (
                  <SchedulingGridCell
                    key={date}
                    shifts={shiftsByKey[`${emp.id}-${date}`] ?? []}
                    canManage={canManage}
                    isToday={date === today}
                    isPast={date < today}
                    onAddShift={() => onAddShift(emp.id, date)}
                    onOpenDetail={(s) => onOpenDetail(s, date)}
                  />
                ),
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
