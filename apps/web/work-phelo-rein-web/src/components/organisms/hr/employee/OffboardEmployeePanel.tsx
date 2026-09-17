'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import {
  useOffboardingRecord,
  useInitiateOffboard,
  useUpdateOffboardChecklist,
  useCompleteOffboard,
} from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { InitiateOffboardDto, OffboardReason } from '@/types/hr';
import type { EmployeeAsset } from '@/types/asset';

interface OffboardEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  assignedAssets?: EmployeeAsset[];
}

type ChecklistItem = 'assetReturn' | 'hrClearance' | 'financeClearance' | 'reportingClearance';

const CHECKLIST_ITEMS: { field: ChecklistItem; label: string }[] = [
  { field: 'assetReturn', label: 'Assets returned' },
  { field: 'hrClearance', label: 'HR clearance' },
  { field: 'financeClearance', label: 'Finance clearance' },
  { field: 'reportingClearance', label: 'Reporting clearance' },
];

const REASONS: { value: OffboardReason; label: string }[] = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'CONTRACT_ENDED', label: 'Contract ended' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'REDUNDANCY', label: 'Redundancy' },
  { value: 'OTHER', label: 'Other' },
];

interface FormValues {
  reason: OffboardReason | '';
  otherReason: string;
  lastWorkingDate: string;
  exitNotes: string;
}

const EMPTY_CHECKLIST: Record<ChecklistItem, boolean> = {
  assetReturn: false,
  hrClearance: false,
  financeClearance: false,
  reportingClearance: false,
};

export function OffboardEmployeePanel({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  assignedAssets = [],
}: OffboardEmployeePanelProps) {
  const toast = useToast();
  const { data: record } = useOffboardingRecord(employeeId);
  const { mutateAsync: initiate, isPending: isInitiating } = useInitiateOffboard(employeeId);
  const { mutateAsync: updateItem, isPending: isUpdating } = useUpdateOffboardChecklist(employeeId);
  const { mutateAsync: complete, isPending: isCompleting } = useCompleteOffboard(employeeId);

  // Local checklist state — used only before a record exists on the server.
  // Once a record exists, checklist is derived directly from it.
  const [localChecklist, setLocalChecklist] =
    useState<Record<ChecklistItem, boolean>>(EMPTY_CHECKLIST);

  const checklist: Record<ChecklistItem, boolean> = record
    ? {
        assetReturn: record.assetReturnDone ?? false,
        hrClearance: record.hrClearanceDone ?? false,
        financeClearance: record.financeClearanceDone ?? false,
        reportingClearance: record.managerApprovalDone ?? false,
      }
    : localChecklist;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { reason: '', otherReason: '', lastWorkingDate: '', exitNotes: '' },
  });

  useEffect(() => {
    if (record) {
      reset({
        reason: record.reason as OffboardReason,
        otherReason: record.otherReason ?? '',
        lastWorkingDate: record.lastWorkingDate ?? '',
        exitNotes: record.exitNotes ?? '',
      });
    }
  }, [record, reset]);

  const reason = useWatch({ control, name: 'reason' });
  const lastWorkingDate = useWatch({ control, name: 'lastWorkingDate' });

  const allDone = CHECKLIST_ITEMS.every(({ field }) => checklist[field]);
  const isBusy = isInitiating || isUpdating || isCompleting;

  const handleToggle = (item: ChecklistItem, done: boolean) => {
    if (record) {
      updateItem({ item, done }).catch((err) =>
        toast.error(extractError(err, 'Failed to update checklist')),
      );
    } else {
      setLocalChecklist((prev) => ({ ...prev, [item]: done }));
    }
  };

  const buildDto = (values: FormValues): InitiateOffboardDto => ({
    reason: values.reason as OffboardReason,
    otherReason: values.reason === 'OTHER' ? values.otherReason : undefined,
    lastWorkingDate: values.lastWorkingDate,
    exitNotes: values.exitNotes || undefined,
  });

  const syncChecklist = () =>
    Promise.all(
      CHECKLIST_ITEMS.filter(({ field }) => localChecklist[field]).map(({ field }) =>
        updateItem({ item: field, done: true }),
      ),
    );

  const handleSaveDraft = handleSubmit(async (values) => {
    try {
      if (!record) {
        await initiate(buildDto(values));
        await syncChecklist();
      }
      toast.success('Off boarding saved as draft');
    } catch (err) {
      toast.error(extractError(err, 'Failed to save draft'));
    }
  });

  const handleOffboard = handleSubmit(async (values) => {
    try {
      if (!record) {
        await initiate(buildDto(values));
        await syncChecklist();
      }
      await complete();
      toast.success('Employee off boarded successfully');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to off board employee'));
    }
  });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Offboard Employee"
      description={`Processing departure for ${employeeName}`}
      width="sm:w-[520px]"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            isLoading={isInitiating && !isCompleting}
            loadingText="Saving…"
            disabled={isBusy}
          >
            Save to Draft
          </Button>
          <Button
            onClick={handleOffboard}
            isLoading={isBusy}
            loadingText="Offboarding…"
            disabled={isBusy || (!!record && !allDone)}
          >
            Off board
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        {/* Reason */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Reason for leaving</label>
          <select
            {...register('reason', { required: 'Reason is required' })}
            className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand"
          >
            <option value="">Select reason</option>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
        </div>

        {reason === 'OTHER' && (
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Please specify</label>
            <input
              {...register('otherReason', { required: 'Please specify the reason' })}
              placeholder="Describe the reason…"
              className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand"
            />
            {errors.otherReason && (
              <p className="text-xs text-red-500">{errors.otherReason.message}</p>
            )}
          </div>
        )}

        {/* Last working date */}
        <DatePicker
          label="Last Working Day"
          value={lastWorkingDate}
          onChange={(v) => setValue('lastWorkingDate', v)}
          error={errors.lastWorkingDate?.message}
        />

        {/* Exit notes */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">
            Exit Interview Notes
            <span className="text-gray-400 font-normal ml-1">(optional)</span>
          </label>
          <textarea
            {...register('exitNotes')}
            rows={3}
            placeholder="Add any notes from the exit interview…"
            className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none"
          />
        </div>

        {/* Clearance checklist */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Clearance Checklist
          </p>
          {CHECKLIST_ITEMS.map(({ field, label }) => {
            const hasUnreturnedAssets = field === 'assetReturn' && assignedAssets.length > 0;
            return hasUnreturnedAssets ? (
              <div key={field} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="w-4 h-4 rounded shrink-0"
                />
                <span className="text-sm text-red-600">
                  {assignedAssets.length === 1
                    ? '1 asset still assigned'
                    : `${assignedAssets.length} assets still assigned`}
                  . Unassign before offboarding.
                </span>
              </div>
            ) : (
              <label key={field} className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checklist[field]}
                  onChange={(e) => handleToggle(field, e.target.checked)}
                  disabled={isUpdating}
                  className="w-4 h-4 rounded accent-brand shrink-0"
                />
                <span
                  className={`text-sm ${checklist[field] ? 'line-through text-gray-400' : 'text-gray-700'}`}
                >
                  {label}
                </span>
              </label>
            );
          })}
          {record && !allDone && (
            <p className="text-xs text-gray-400">
              All four clearance items must be ticked to offboard.
            </p>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
