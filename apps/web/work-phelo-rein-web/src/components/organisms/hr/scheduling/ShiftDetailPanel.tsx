'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ShiftSchedule, BackendShiftType, WorkMode } from '@/types/scheduling';
import { useUpdateShiftSchedule, useDeleteShiftSchedule } from '@/hooks/hr/useScheduling';
import { useToast } from '@/hooks/useToast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  schedule: ShiftSchedule | null;
  cellDate?: string;
  canManage?: boolean;
}

/* ── Helpers ── */

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')}${period}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const TYPE_LABEL: Record<string, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  NIGHT: 'Night',
};

const TYPE_COLORS: Record<string, string> = {
  MORNING: 'bg-green-100 text-green-700',
  AFTERNOON: 'bg-purple-100 text-purple-700',
  NIGHT: 'bg-shift-night text-white',
};

const SHIFT_TYPE_OPTIONS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'NIGHT', label: 'Night' },
];

const WORK_MODE_OPTIONS = [
  { value: 'ONSITE', label: 'Onsite' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
];

const WORK_MODE_LABEL: Record<WorkMode, string> = {
  ONSITE: 'Onsite',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── Read-only view (past / today) ── */

function ReadOnlyView({
  schedule,
  cellDate,
  onClose,
}: {
  schedule: ShiftSchedule;
  cellDate: string;
  onClose: () => void;
}) {
  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Shift Details"
      description={`${schedule.employee.firstName} ${schedule.employee.lastName}`}
      footer={
        <div className="flex gap-3">
          <Button variant="primary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Shift type */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-gray-900">Shift Type</p>
          <span
            className={`inline-flex self-start px-3 py-1 rounded-full text-sm font-semibold ${TYPE_COLORS[schedule.shiftType] ?? 'bg-gray-100 text-gray-700'}`}
          >
            {TYPE_LABEL[schedule.shiftType] ?? schedule.shiftType}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-gray-900">Work Mode</p>
          <span className="inline-flex self-start px-3 py-1 rounded-full text-sm font-semibold bg-sky-100 text-sky-700">
            {WORK_MODE_LABEL[schedule.workMode]}
          </span>
        </div>

        {/* Time */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-gray-900">Time</p>
          <p className="text-sm text-gray-700">
            {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
          </p>
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-gray-900">Date</p>
          <p className="text-sm text-gray-700">{formatDate(cellDate)}</p>
        </div>

        {/* Days of week */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-gray-900">Repeats on</p>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day, i) => (
              <span
                key={day}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  schedule.dayOfWeek.includes(i)
                    ? 'bg-shift-night text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {day}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SidePanel>
  );
}

/* ── Editable form (future dates) ── */

function EditForm({
  schedule,
  onClose,
}: {
  schedule: ShiftSchedule;
  cellDate: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [shiftType, setShiftType] = useState<BackendShiftType>(schedule.shiftType);
  const [workMode, setWorkMode] = useState<WorkMode>(schedule.workMode);
  const [startTime, setStartTime] = useState(schedule.startTime);
  const [endTime, setEndTime] = useState(schedule.endTime);
  const [effectiveTo, setEffectiveTo] = useState(schedule.effectiveTo?.slice(0, 10) ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { mutate: updateShift, isPending: isSaving } = useUpdateShiftSchedule();
  const { mutate: deleteShift, isPending: isDeleting } = useDeleteShiftSchedule();

  const inputClass =
    'border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand w-full';

  const handleSave = () => {
    updateShift(
      {
        id: schedule.id,
        payload: { shiftType, workMode, startTime, endTime, effectiveTo: effectiveTo || undefined },
      },
      {
        onSuccess: () => {
          toast.success('Shift updated successfully');
          onClose();
        },
      },
    );
  };

  const handleDelete = () => {
    deleteShift(schedule.id, {
      onSuccess: () => {
        toast.success('Shift deleted');
        onClose();
      },
    });
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Edit Shift"
      description={`${schedule.employee.firstName} ${schedule.employee.lastName}`}
      footer={
        confirmDelete ? (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDelete}
              isLoading={isDeleting}
              loadingText="Deleting…"
            >
              Confirm Delete
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => setConfirmDelete(true)}
              disabled={isSaving}
            >
              Delete
            </Button>
            <Button
              className="flex-1 bg-shift-night hover:bg-shift-night/90 focus:ring-shift-night"
              onClick={handleSave}
              isLoading={isSaving}
              loadingText="Saving…"
            >
              Save
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {/* Shift type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Shift Type</label>
          <SearchSelect
            placeholder="Select shift type…"
            options={SHIFT_TYPE_OPTIONS}
            value={shiftType}
            onChange={(v) => setShiftType(v as BackendShiftType)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">Start Date</label>
            <input
              type="date"
              value={schedule.effectiveFrom.slice(0, 10)}
              readOnly
              className={inputClass + ' bg-gray-50 text-gray-400 cursor-default'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">End Date</label>
            <input
              type="date"
              value={effectiveTo}
              min={schedule.effectiveFrom.slice(0, 10)}
              onChange={(e) => setEffectiveTo(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Times — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Days of week — read-only display */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-gray-900">Repeats on</p>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day, i) => (
              <span
                key={day}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  schedule.dayOfWeek.includes(i)
                    ? 'bg-shift-night text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {day}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SidePanel>
  );
}

/* ── Public wrapper ── */

export function ShiftDetailPanel({
  isOpen,
  onClose,
  schedule,
  cellDate,
  canManage = false,
}: Props) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={onClose} title="">
        {null}
      </SidePanel>
    );
  }

  if (!schedule) return null;

  const today = toISODate(new Date());
  const isFuture = cellDate ? cellDate > today : false;

  if (canManage && isFuture) {
    return (
      <EditForm key={schedule.id} schedule={schedule} cellDate={cellDate ?? ''} onClose={onClose} />
    );
  }

  return (
    <ReadOnlyView
      key={schedule.id}
      schedule={schedule}
      cellDate={cellDate ?? ''}
      onClose={onClose}
    />
  );
}
