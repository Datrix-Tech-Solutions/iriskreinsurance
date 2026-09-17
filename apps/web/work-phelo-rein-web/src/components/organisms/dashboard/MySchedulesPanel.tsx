'use client';

import { useState, useMemo } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useMyScheduleOverview } from '@/hooks/hr/useScheduling';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { addDays, toISODate, getSundayOf } from '@/components/molecules/hr/scheduling/WeekSelector';
import type { WorkMode, BackendShiftType } from '@/types/scheduling';

interface ScheduleEntry {
  date: string;
  shiftType: BackendShiftType;
  workMode: WorkMode;
  startTime: string;
  endTime: string;
}

const SHIFT_TYPE_LABELS: Record<BackendShiftType, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  NIGHT: 'Night',
  FLEXIBLE: 'Flexible',
};

const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: 'On-site',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
};

const WORK_MODE_STYLES: Record<WorkMode, string> = {
  ONSITE: 'bg-blue-50 text-blue-700',
  REMOTE: 'bg-green-50 text-green-700',
  HYBRID: 'bg-purple-50 text-purple-700',
};

const SHIFT_TYPE_STYLES: Record<BackendShiftType, string> = {
  MORNING: 'bg-amber-50 text-amber-700',
  AFTERNOON: 'bg-orange-50 text-orange-700',
  NIGHT: 'bg-indigo-50 text-indigo-700',
  FLEXIBLE: 'bg-gray-100 text-gray-600',
};

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function ScheduleRow({ entry }: { entry: ScheduleEntry }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl bg-gray-50">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 w-20 shrink-0">{formatShortDate(entry.date)}</span>
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            SHIFT_TYPE_STYLES[entry.shiftType],
          )}
        >
          {SHIFT_TYPE_LABELS[entry.shiftType]}
        </span>
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            WORK_MODE_STYLES[entry.workMode],
          )}
        >
          {WORK_MODE_LABELS[entry.workMode]}
        </span>
      </div>
      <span className="text-xs font-semibold text-gray-700 shrink-0 ml-4">
        {formatTime12(entry.startTime)} – {formatTime12(entry.endTime)}
      </span>
    </div>
  );
}

function CollapsibleGroup({ title, entries }: { title: string; entries: ScheduleEntry[] }) {
  const [open, setOpen] = useState(true);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {title}
          </span>
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {entries.length}
          </span>
        </div>
        <Icons.ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform duration-200',
            open ? 'rotate-180' : '',
          )}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <ScheduleRow key={`${entry.date}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

interface MySchedulesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MySchedulesPanel({ isOpen, onClose }: MySchedulesPanelProps) {
  const { todayIso, queryFromIso, endOfNextMonthIso } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return {
      todayIso: toISODate(now),
      // Start the API query from Sunday of the current week so the backend
      // returns schedules whose effectiveFrom pre-dates today.
      queryFromIso: toISODate(getSundayOf(now)),
      endOfNextMonthIso: toISODate(new Date(now.getFullYear(), now.getMonth() + 2, 0)),
    };
  }, []);

  const { data: overview, isLoading } = useMyScheduleOverview({
    from: queryFromIso,
    to: endOfNextMonthIso,
  });

  const allEntries = useMemo<ScheduleEntry[]>(() => {
    if (!overview) return [];

    const schedules = overview.schedules ?? [];
    const overrides = overview.assignmentOverrides ?? [];
    const swaps = overview.shiftSwaps ?? [];

    const rangeEnd = new Date(`${endOfNextMonthIso}T00:00:00`);
    // Entries are shown from today onwards even though the query starts earlier.
    const rangeStart = new Date(`${todayIso}T00:00:00`);
    const entries: ScheduleEntry[] = [];

    // Collect dates removed by approved swaps
    const removedDates = new Set<string>();
    for (const swap of swaps) {
      if (swap.status !== 'APPROVED') continue;
      const removed =
        swap.role === 'REQUESTER'
          ? swap.requesterShiftDate.slice(0, 10)
          : swap.targetShiftDate.slice(0, 10);
      removedDates.add(removed);
    }

    // Expand recurring schedules into individual dates
    for (const s of schedules) {
      const effectiveFrom = new Date(`${s.effectiveFrom.slice(0, 10)}T00:00:00`);
      const effectiveTo = s.effectiveTo ? new Date(`${s.effectiveTo.slice(0, 10)}T00:00:00`) : null;

      let cur = new Date(Math.max(rangeStart.getTime(), effectiveFrom.getTime()));
      while (cur <= rangeEnd) {
        const iso = toISODate(cur);
        const dow = cur.getDay();
        if (
          s.dayOfWeek.includes(dow) &&
          (!effectiveTo || cur <= effectiveTo) &&
          !removedDates.has(iso)
        ) {
          entries.push({
            date: iso,
            shiftType: s.shiftType,
            workMode: s.workMode,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
        cur = addDays(cur, 1);
      }
    }

    // Add shifts received via approved swaps
    for (const o of overrides) {
      const date = o.shiftDate.slice(0, 10);
      if (date >= todayIso && date <= endOfNextMonthIso) {
        entries.push({
          date,
          shiftType: o.shiftType,
          workMode: o.workMode,
          startTime: o.startTime,
          endTime: o.endTime,
        });
      }
    }

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [overview, todayIso, endOfNextMonthIso]);

  const groups = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const todayStr = toISODate(now);
    const tomorrowStr = toISODate(addDays(now, 1));

    const thisWeekSun = getSundayOf(now);
    const thisWeekSat = addDays(thisWeekSun, 6);
    const thisWeekSatStr = toISODate(thisWeekSat);

    const nextWeekSun = addDays(thisWeekSun, 7);
    const nextWeekSat = addDays(nextWeekSun, 6);
    const nextWeekSunStr = toISODate(nextWeekSun);
    const nextWeekSatStr = toISODate(nextWeekSat);

    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const thisMonthEndStr = toISODate(thisMonthEnd);
    const afterNextWeekStr = toISODate(addDays(nextWeekSat, 1));

    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const nextMonthStartStr = toISODate(nextMonthStart);
    const nextMonthEndStr = toISODate(nextMonthEnd);

    const result = {
      today: [] as ScheduleEntry[],
      tomorrow: [] as ScheduleEntry[],
      thisWeek: [] as ScheduleEntry[],
      nextWeek: [] as ScheduleEntry[],
      thisMonth: [] as ScheduleEntry[],
      nextMonth: [] as ScheduleEntry[],
    };

    for (const entry of allEntries) {
      const d = entry.date;
      if (d === todayStr) {
        result.today.push(entry);
      } else if (d === tomorrowStr) {
        result.tomorrow.push(entry);
      } else if (d <= thisWeekSatStr) {
        result.thisWeek.push(entry);
      } else if (d >= nextWeekSunStr && d <= nextWeekSatStr) {
        result.nextWeek.push(entry);
      } else if (d >= afterNextWeekStr && d <= thisMonthEndStr) {
        result.thisMonth.push(entry);
      } else if (d >= nextMonthStartStr && d <= nextMonthEndStr) {
        result.nextMonth.push(entry);
      }
    }

    return result;
  }, [allEntries]);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Schedules"
      description="Your upcoming shifts grouped by time period."
    >
      {isLoading ? (
        <div className="flex flex-col gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-sm font-medium text-gray-600">No upcoming schedules</p>
          <p className="text-xs text-gray-400">
            You have no scheduled shifts for the coming period.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <CollapsibleGroup title="Today" entries={groups.today} />
          <CollapsibleGroup title="Tomorrow" entries={groups.tomorrow} />
          <CollapsibleGroup title="This Week" entries={groups.thisWeek} />
          <CollapsibleGroup title="Next Week" entries={groups.nextWeek} />
          <CollapsibleGroup title="This Month" entries={groups.thisMonth} />
          <CollapsibleGroup title="Next Month" entries={groups.nextMonth} />
        </div>
      )}
    </SidePanel>
  );
}
