'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Search } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useProjectMembers } from '@/hooks';
import { inputClass, cn } from '@/lib/utils';

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

interface TaskFormValues {
  name: string;
  dueDate: string;
}

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (values: {
    name: string;
    dueDate: string;
    status: 'TODO';
    assignedEmployeeId?: string;
  }) => void;
  isCreating?: boolean;
}

export function CreateTaskPanel({ projectId, isOpen, onClose, onCreate, isCreating }: Props) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);

  const { data: members = [], isLoading: loadingMembers } = useProjectMembers(projectId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>();

  const filteredMembers = useMemo(() => {
    const q = employeeSearch.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.jobTitle?.toLowerCase().includes(q),
    );
  }, [members, employeeSearch]);

  const selectedMember = useMemo(
    () => members.find((m) => m.employeeId === selectedEmployeeId),
    [members, selectedEmployeeId],
  );

  const handleClose = () => {
    setEmployeeSearch('');
    setSelectedEmployeeId(undefined);
    onClose();
  };

  const onSubmit = (values: TaskFormValues) => {
    onCreate({ ...values, status: 'TODO', assignedEmployeeId: selectedMember?.employeeId });
    reset({ name: '', dueDate: '' });
    setEmployeeSearch('');
    setSelectedEmployeeId(undefined);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Task"
      description="Add a new task and optionally assign it to a team member."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isCreating} loadingText="Creating…">
            Create Task
          </Button>
        </div>
      }
    >
      {/* Task name */}
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-medium text-gray-700">Task Name</label>
        <input
          {...register('name', { required: 'Task name is required' })}
          placeholder="e.g. Design the Database Schema"
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

      {/* Assign to employee */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Assign To</label>

        {/* Selected pill */}
        {selectedMember && (
          <div className="flex items-center gap-2 px-3 py-2 bg-brand/5 border border-brand/20 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-brand">
                {getInitials(selectedMember.name)}
              </span>
            </div>
            <span className="text-sm text-gray-800 flex-1">{selectedMember.name}</span>
            <button
              type="button"
              onClick={() => setSelectedEmployeeId(undefined)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Remove
            </button>
          </div>
        )}

        {/* Search */}
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

        {/* Member list */}
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {loadingMembers ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
            ))
          ) : filteredMembers.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No members found</p>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = selectedEmployeeId === member.employeeId;
              return (
                <button
                  key={member.employeeId}
                  type="button"
                  onClick={() => setSelectedEmployeeId(isSelected ? undefined : member.employeeId)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors',
                    isSelected ? 'bg-brand/5 ring-1 ring-brand/20' : 'hover:bg-gray-50',
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-brand">
                      {getInitials(member.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                    <p className="text-xs text-gray-400 truncate">{member.jobTitle}</p>
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
    </SidePanel>
  );
}
