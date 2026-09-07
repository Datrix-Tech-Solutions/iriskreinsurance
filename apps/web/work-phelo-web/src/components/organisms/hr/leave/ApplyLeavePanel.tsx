'use client';

import { useCallback, useMemo, useState } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import { useLeaveTypes, useCreateLeaveRequest } from '@/hooks/hr/useLeave';
import { usePublicHolidays } from '@/hooks/hr/usePublicHolidays';
import { useMyProfile, useEmployeeOptions } from '@/hooks';
import { CreateLeaveRequestDto, LeaveBalance, PublicHoliday } from '@/types/hr';
import { FileUpload } from '@/components/atoms/FileUpload';
import { LeaveBalanceBar } from '@/components/molecules/hr/leave/LeaveBalanceBar';

interface ApplyLeavePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  balances: LeaveBalance[];
}

type FormValues = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  careOfEmployeeId?: string;
};

/* ── Working days calculator ── */
function calcWorkingDays(start: string, end: string, holidays: PublicHoliday[]): number {
  if (!start || !end || end < start) return 0;

  const holidaySet = new Set<string>(holidays.map((h) => (h.observedDate ?? h.date).slice(0, 10)));

  let count = 0;
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(cur.toISOString().slice(0, 10))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function ApplyLeavePanel({ isOpen, onClose, tenantSlug, balances }: ApplyLeavePanelProps) {
  const toast = useToast();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState('');

  const { data: leaveTypes = [] } = useLeaveTypes(tenantSlug);
  const { data: holidays = [] } = usePublicHolidays();
  const { data: myProfile } = useMyProfile();
  const { data: allEmployees = [] } = useEmployeeOptions();

  const careOfOptions = useMemo(
    () =>
      allEmployees
        .filter((e) => e.employmentStatus !== 'ON_LEAVE' && e.id !== myProfile?.id)
        .map((e) => ({
          value: e.id,
          label: `${e.firstName} ${e.lastName}`,
          sublabel: e.jobTitle,
        })),
    [allEmployees, myProfile?.id],
  );

  const visibleLeaveTypes = useMemo(() => {
    const gender = myProfile?.gender;
    return leaveTypes.filter((t) => {
      const name = t.name.toLowerCase();
      if (name.includes('maternity') && gender !== 'FEMALE') return false;
      if (name.includes('paternity') && gender !== 'MALE') return false;
      return true;
    });
  }, [leaveTypes, myProfile?.gender]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      leaveTypeId: '',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  const handleClose = useCallback(() => {
    reset();
    setDocumentFile(null);
    setDocumentError('');
    onClose();
  }, [reset, onClose]);

  const leaveTypeId = useWatch({ control, name: 'leaveTypeId' });
  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((t) => t.id === leaveTypeId),
    [leaveTypes, leaveTypeId],
  );

  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveTypeId === leaveTypeId),
    [balances, leaveTypeId],
  );

  const workingDays = useMemo(
    () => calcWorkingDays(startDate, endDate, holidays),
    [startDate, endDate, holidays],
  );

  const isOverBalance =
    selectedBalance != null && workingDays > 0 && workingDays > selectedBalance.remaining;

  const { mutate, isPending } = useCreateLeaveRequest();

  const onSubmit = (values: FormValues) => {
    if (!values.leaveTypeId) return;

    if (selectedLeaveType?.requiresDocument && !documentFile) {
      setDocumentError('A supporting document is required for this leave type');
      return;
    }

    const payload: CreateLeaveRequestDto = {
      leaveTypeId: values.leaveTypeId,
      startDate: values.startDate,
      endDate: values.endDate,
      reason: values.reason || undefined,
      coverageEmployeeId: values.careOfEmployeeId || undefined,
      documentationUrl: documentFile ? documentFile.name : undefined,
    };

    mutate(payload, {
      onSuccess: (result) => {
        toast.success(result.message ?? 'Leave request submitted');
        handleClose();
      },
      onError: (err: unknown) => {
        toast.error(extractError(err, 'Something went wrong'));
      },
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Apply for Leave"
      description="Submit a leave request for Company Admin review."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Submitting..."
            onClick={handleSubmit(onSubmit)}
          >
            Submit Request
          </Button>
        </div>
      }
    >
      {/* Leave Type */}
      <Controller
        name="leaveTypeId"
        control={control}
        rules={{ required: 'Please select a leave type' }}
        render={({ field }) => (
          <SearchSelect
            label="Leave Type"
            placeholder="Select leave type"
            options={visibleLeaveTypes.map((t) => ({ value: t.id, label: t.name }))}
            value={field.value}
            onChange={field.onChange}
            error={errors.leaveTypeId?.message}
          />
        )}
      />

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="startDate"
          control={control}
          rules={{ required: 'Start date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Start Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.startDate?.message}
              // disablePast
            />
          )}
        />
        <Controller
          name="endDate"
          control={control}
          rules={{
            required: 'End date is required',
            validate: (v) => !startDate || v >= startDate || 'Cannot be before start date',
          }}
          render={({ field }) => (
            <DatePicker
              label="End Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.endDate?.message}
              // disablePast
            />
          )}
        />
      </div>

      {/* Balance bar — shown as soon as a leave type is selected */}
      {selectedBalance && (
        <LeaveBalanceBar
          balance={selectedBalance}
          overBy={isOverBalance ? workingDays - selectedBalance.remaining : 0}
        />
      )}

      {/* Working days summary */}
      {workingDays > 0 && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${isOverBalance ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}
        >
          <p
            className={isOverBalance ? 'text-orange-700 font-medium' : 'text-blue-700 font-medium'}
          >
            This request covers {workingDays} working {workingDays === 1 ? 'day' : 'days'}.
          </p>
        </div>
      )}

      {/* Reason / Notes */}
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">
          Reason <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('reason')}
          placeholder="Add a note for your manager"
          rows={3}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>

      {/* Care of */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Care of</p>
          <p className="text-xs text-gray-500 mt-1">
            Assign a colleague to cover your responsibilities while you are away.
          </p>
        </div>
        <Controller
          name="careOfEmployeeId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Cover Person (optional)"
              placeholder="Select a colleague"
              options={careOfOptions}
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Supporting document — required when leave type demands it */}
      {selectedLeaveType?.requiresDocument && (
        <FileUpload
          label="Supporting Document"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          value={documentFile}
          onChange={(file) => {
            setDocumentFile(file);
            if (file) setDocumentError('');
          }}
          error={documentError}
          hint="Required for this leave type"
        />
      )}
    </SidePanel>
  );
}
