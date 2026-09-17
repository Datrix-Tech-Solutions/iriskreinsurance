'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Search } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { inputClass, cn } from '@/lib/utils';
import type { TaskStatus, ProjectTask } from '@/types/hr';

interface TaskEditValues {
  name: string;
  dueDate: string;
  status: TaskStatus;
}

interface Props {
  task: ProjectTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, values: TaskEditValues & { assignedEmployeeId?: string }) => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DONE', label: 'Done' },
];

const STATUS_META: Record<TaskStatus, { dot: string; label: string; text: string }> = {
  TODO: { dot: 'bg-gray-400', label: 'To Do', text: 'text-gray-600' },
  IN_PROGRESS: { dot: 'bg-blue-500', label: 'In Progress', text: 'text-blue-600' },
  DONE: { dot: 'bg-green-500', label: 'Done', text: 'text-green-600' },
  ON_HOLD: { dot: 'bg-red-500', label: 'On Hold', text: 'text-red-600' },
};

function formatDisplay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

export function EditTaskPanel({ task, isOpen, onClose, onSave, isSaving, readOnly }: Props) {
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(task?.id ?? null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);

  // Reset local selections when the task changes. Normalise to null so that
  // `undefined` (task prop absent) and `null` (no task) compare equal and don't
  // trigger an infinite setState loop during render.
  const incomingTaskId = task?.id ?? null;
  if (incomingTaskId !== currentTaskId) {
    setCurrentTaskId(incomingTaskId);
    setSelectedEmployeeId(undefined);
    setEmployeeSearch('');
  }

  const { data: employees = [], isLoading: loadingEmployees } = useEmployeeOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskEditValues>();

  useEffect(() => {
    if (task) {
      reset({ name: task.name, dueDate: task.dueDate ?? '', status: task.status });
    }
  }, [task, reset]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.employmentStatus === 'ACTIVE'),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.jobTitle?.toLowerCase().includes(q),
    );
  }, [activeEmployees, employeeSearch]);

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => e.id === selectedEmployeeId),
    [activeEmployees, selectedEmployeeId],
  );

  const handleClose = () => {
    reset();
    setEmployeeSearch('');
    setSelectedEmployeeId(undefined);
    onClose();
  };

  const onSubmit = (values: TaskEditValues) => {
    if (!task) return;
    onSave(task.id, { ...values, assignedEmployeeId: selectedEmployeeId });
  };

  const isDone = task?.status === 'DONE';
  const isReadOnly = readOnly || isDone;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isReadOnly ? 'Task Details' : 'Edit Task'}
      description={
        isDone
          ? 'This task is complete and cannot be edited.'
          : readOnly
            ? 'You can view this task but cannot edit it.'
            : undefined
      }
      footer={
        isReadOnly ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} isLoading={isSaving} loadingText="Saving…">
              Save Changes
            </Button>
          </div>
        )
      }
    >
      {isReadOnly ? (
        /* ── Read-only view ── */
        <div className="flex flex-col gap-6">
          <ReadOnlyField label="Task Name">
            <p className="line-through text-gray-400">{task?.name}</p>
          </ReadOnlyField>
          <ReadOnlyField label="Due Date">
            {task?.dueDate ? formatDisplay(task.dueDate) : '—'}
          </ReadOnlyField>
          <ReadOnlyField label="Status">
            {task && (
              <div className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', STATUS_META[task.status].dot)} />
                <span className={cn('font-medium', STATUS_META[task.status].text)}>
                  {STATUS_META[task.status].label}
                </span>
              </div>
            )}
          </ReadOnlyField>
          <ReadOnlyField label="Assigned To">{task?.assignedEmployeeName ?? '—'}</ReadOnlyField>
        </div>
      ) : (
        /* ── Edit form ── */
        <>
          {/* Task name */}
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-medium text-gray-700">Task Name</label>
            <input
              {...register('name', { required: 'Task name is required' })}
              className={inputClass(errors.name?.message)}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Due date */}
          <Controller
            name="dueDate"
            control={control}
            rules={{ required: 'Due date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Due Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.dueDate?.message}
              />
            )}
          />

          {/* Status */}
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select {...register('status')} className={inputClass()}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assign to employee */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Assigned To <span className="text-gray-400 font-normal">(optional)</span>
            </label>

            {selectedEmployee ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand/5 border border-brand/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-brand">
                    {selectedEmployee.firstName[0]}
                    {selectedEmployee.lastName[0]}
                  </span>
                </div>
                <span className="text-sm text-gray-800 flex-1">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeId(undefined)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Remove
                </button>
              </div>
            ) : task?.assignedEmployeeName ? (
              <p className="text-sm text-gray-500 px-1">
                Currently assigned to{' '}
                <span className="font-medium text-gray-700">{task.assignedEmployeeName}</span>
              </p>
            ) : null}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search by name or job title…"
                className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {loadingEmployees ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
                ))
              ) : filteredEmployees.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No employees found</p>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(isSelected ? undefined : emp.id)}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors',
                        isSelected ? 'bg-brand/5 ring-1 ring-brand/20' : 'hover:bg-gray-50',
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-brand">
                          {emp.firstName[0]}
                          {emp.lastName[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{emp.jobTitle}</p>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-medium text-brand shrink-0">Selected</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </SidePanel>
  );
}
