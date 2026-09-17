'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';
import type { WorkMode } from '@/types/scheduling';

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'on-leave';

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  workMode: WorkMode;
  isDraft?: boolean;
  leaveType?: string;
  date: string; // ISO "YYYY-MM-DD"
}

interface ShiftPanelProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  employeeOptions: SearchSelectOption[];
  /** Pre-selected employee when opening from a row cell */
  employeeId?: string;
  /** Pre-filled start date (cell's date); cannot be changed by the user */
  date?: string;
  /** Populated when editing an existing shift */
  shift?: Shift | null;
  /** endDate allows multi-day range creation */
  onSave: (data: Omit<Shift, 'id'>, endDate: string) => void;
}

const SHIFT_TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'night', label: 'Night' },
];

const WORK_MODE_OPTIONS: SearchSelectOption[] = [
  { value: 'ONSITE', label: 'Onsite' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
];

/* ── Inner form ── */

interface FormProps {
  isOpen: boolean;
  isEditing: boolean;
  isLoading?: boolean;
  employeeName: string;
  employeeOptions: SearchSelectOption[];
  initial: {
    employeeId: string;
    startDate: string;
    startTime: string;
    endTime: string;
    shiftType: ShiftType;
    workMode: WorkMode;
  };
  shift: Shift | null | undefined;
  onSave: (data: Omit<Shift, 'id'>, endDate: string) => void;
  onClose: () => void;
}

function ShiftForm({
  isOpen,
  isEditing,
  isLoading,
  employeeName,
  initial,
  onSave,
  onClose,
}: FormProps) {
  const [shiftType, setShiftType] = useState<ShiftType>(initial.shiftType);
  const [workMode, setWorkMode] = useState<WorkMode>(initial.workMode);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [endDate, setEndDate] = useState(initial.startDate);
  const [errors, setErrors] = useState<{ shiftType?: string; start?: string; end?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!shiftType) next.shiftType = 'Please select a shift type';
    if (!startTime) next.start = 'Start time is required';
    if (!endTime) next.end = 'End time is required';
    if (startTime && endTime && initial.startDate === endDate && startTime >= endTime)
      next.end = 'End time must be after start time';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (isDraft: boolean) => {
    if (!validate()) return;
    onSave(
      {
        employeeId: initial.employeeId,
        employeeName,
        startTime,
        endTime,
        shiftType,
        workMode,
        isDraft,
        date: initial.startDate,
      },
      endDate,
    );
  };

  const inputClass =
    'border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand w-full';
  const readonlyClass =
    'border border-gray-200 rounded-input px-4 py-3 text-sm text-gray-400 bg-gray-50 w-full cursor-not-allowed';

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={employeeName}
      description={isEditing ? 'Edit shift details' : 'Add a new shift'}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            type="button"
            disabled={isLoading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            type="button"
            disabled={isLoading}
            onClick={() => handleSubmit(true)}
          >
            Save to Draft
          </Button>
          <Button
            className="flex-1 bg-shift-night hover:bg-shift-night/90 focus:ring-shift-night"
            type="button"
            isLoading={isLoading}
            loadingText="Saving..."
            onClick={() => handleSubmit(false)}
          >
            Save
          </Button>
        </div>
      }
    >
      {/* Shift type */}
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">Shift Type</label>
        <SearchSelect
          placeholder="Select shift type…"
          options={SHIFT_TYPE_OPTIONS}
          value={shiftType}
          onChange={(v) => setShiftType(v as ShiftType)}
          error={errors.shiftType}
        />
      </div>

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">Work Mode</label>
        <SearchSelect
          placeholder="Select work mode…"
          options={WORK_MODE_OPTIONS}
          value={workMode}
          onChange={(v) => setWorkMode(v as WorkMode)}
        />
      </div>

      {/* Dates — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Start Date</label>
          <input type="date" value={initial.startDate} readOnly className={readonlyClass} />
        </div>
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">End Date</label>
          <input
            type="date"
            value={endDate}
            min={initial.startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Times — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
          {errors.start && <p className="text-xs text-red-500">{errors.start}</p>}
        </div>
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
          {errors.end && <p className="text-xs text-red-500">{errors.end}</p>}
        </div>
      </div>

      {endDate > initial.startDate && (
        <p className="text-xs text-blue-500">
          Shifts will be created for each day from{' '}
          <span className="font-semibold">{initial.startDate}</span> to{' '}
          <span className="font-semibold">{endDate}</span>.
        </p>
      )}
    </SidePanel>
  );
}

/* ── Public wrapper ── */

export function ShiftPanel({
  isOpen,
  isLoading,
  onClose,
  employeeOptions,
  employeeId = '',
  date = '',
  shift,
  onSave,
}: ShiftPanelProps) {
  const resolvedEmployeeId = shift?.employeeId ?? employeeId;
  const employeeName =
    employeeOptions.find((o) => o.value === resolvedEmployeeId)?.label ?? 'Employee';

  return (
    <ShiftForm
      key={shift?.id ?? `new-${employeeId}-${date}`}
      isOpen={isOpen}
      isEditing={!!shift}
      isLoading={isLoading}
      employeeName={employeeName}
      employeeOptions={employeeOptions}
      initial={{
        employeeId: resolvedEmployeeId,
        startDate: shift?.date ?? date,
        startTime: shift?.startTime ?? '',
        endTime: shift?.endTime ?? '',
        shiftType: shift?.shiftType ?? 'morning',
        workMode: shift?.workMode ?? 'ONSITE',
      }}
      shift={shift}
      onSave={onSave}
      onClose={onClose}
    />
  );
}
