'use client';

import { useState, useMemo } from 'react';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useShiftSchedules, useCreateShiftSchedule } from '@/hooks/hr/useScheduling';
import { useToast } from '@/hooks/useToast';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { ShiftSchedule, BackendShiftType } from '@/types/scheduling';
import { Shift } from './ShiftPanel';
import { ShiftPanel } from './ShiftPanel';
import { ShiftDetailPanel } from './ShiftDetailPanel';
import { SchedulingGrid } from './SchedulingGrid';
import { SchedulingToolbar } from '@/components/molecules/hr/scheduling/SchedulingToolbar';
import { SchedulingGridSkeleton } from '@/components/molecules/hr/scheduling/SchedulingGridSkeleton';
import {
  getSundayOf,
  addDays,
  toISODate,
  WEEKDAYS,
} from '@/components/molecules/hr/scheduling/WeekSelector';

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    dates.push(toISODate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

interface Props {
  tenantSlug: string;
}

export function SchedulingContent({ tenantSlug }: Props) {
  void tenantSlug;
  const canManageSchedules = usePermission(Permission.MANAGE_SCHEDULES);

  /* ── Week ── */
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOf(new Date()));
  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));

  /* ── Search & filter ── */
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  /* ── Add panel ── */
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelEmployeeId, setPanelEmployeeId] = useState('');
  const [panelDate, setPanelDate] = useState('');

  /* ── Detail panel ── */
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ShiftSchedule | null>(null);
  const [selectedCellDate, setSelectedCellDate] = useState('');

  /* ── Data ── */
  const { data: empData, isLoading: empLoading } = useEmployees({
    search: search || undefined,
    departmentId: departmentId || undefined,
    limit: 100,
  });
  const employees = useMemo(
    () =>
      (empData?.data ?? []).filter(
        (e) => e.employmentStatus !== 'OFFBOARDED' && e.employmentStatus !== 'TERMINATED',
      ),
    [empData],
  );
  const { data: departments = [] } = useDepartmentOptions();
  const { data: schedules = [], isLoading: schedulesLoading } = useShiftSchedules();
  const isLoading = empLoading || schedulesLoading;
  const { mutate: createSchedule, isPending } = useCreateShiftSchedule();
  const toast = useToast();

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
    sublabel: e.jobTitle,
  }));

  const weekDates = useMemo(
    () => WEEKDAYS.map(({ isoDay }) => toISODate(addDays(weekStart, isoDay - 1))),
    [weekStart],
  );

  const shiftsByKey = useMemo(() => {
    const map: Record<string, ShiftSchedule[]> = {};
    for (const s of schedules) {
      for (const date of weekDates) {
        const dow = new Date(date + 'T00:00:00').getDay();
        const from = s.effectiveFrom.slice(0, 10);
        const to = s.effectiveTo?.slice(0, 10) ?? null;
        if (s.dayOfWeek.includes(dow) && from <= date && (to === null || to >= date)) {
          const key = `${s.employeeId}-${date}`;
          if (!map[key]) map[key] = [];
          map[key].push(s);
        }
      }
    }
    return map;
  }, [schedules, weekDates]);

  /* ── Handlers ── */
  const openAdd = (empId: string, date: string) => {
    setPanelEmployeeId(empId);
    setPanelDate(date);
    setPanelOpen(true);
  };

  const openDetail = (schedule: ShiftSchedule, cellDate: string) => {
    setSelectedSchedule(schedule);
    setSelectedCellDate(cellDate);
    setDetailOpen(true);
  };

  const handleSave = (data: Omit<Shift, 'id'>, endDate: string) => {
    if (data.shiftType === 'on-leave') return;
    const datesInRange = getDatesInRange(data.date, endDate);
    const dayOfWeek = [...new Set(datesInRange.map((d) => new Date(d + 'T00:00:00').getDay()))];
    createSchedule(
      {
        employeeId: data.employeeId,
        shiftType: data.shiftType.toUpperCase() as BackendShiftType,
        workMode: data.workMode,
        startTime: data.startTime,
        endTime: data.endTime,
        dayOfWeek,
        effectiveFrom: data.date,
        effectiveTo: endDate,
      },
      {
        onSuccess: () => {
          toast.success('Shift schedule added successfully');
          setPanelOpen(false);
        },
      },
    );
  };

  return (
    <>
      <SchedulingToolbar
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departments={departments}
        weekStart={weekStart}
        onPrevWeek={prevWeek}
        onNextWeek={nextWeek}
      />

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <SchedulingGridSkeleton />
        ) : (
          <SchedulingGrid
            employees={employees}
            weekStart={weekStart}
            weekDates={weekDates}
            shiftsByKey={shiftsByKey}
            canManage={canManageSchedules}
            onAddShift={openAdd}
            onOpenDetail={openDetail}
          />
        )}
      </div>

      <ShiftDetailPanel
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        schedule={selectedSchedule}
        cellDate={selectedCellDate}
        canManage={canManageSchedules}
      />

      <ShiftPanel
        isOpen={panelOpen}
        isLoading={isPending}
        onClose={() => setPanelOpen(false)}
        employeeOptions={employeeOptions}
        employeeId={panelEmployeeId}
        date={panelDate}
        shift={null}
        onSave={handleSave}
      />
    </>
  );
}
