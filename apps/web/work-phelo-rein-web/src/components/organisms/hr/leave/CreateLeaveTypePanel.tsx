'use client';

import { useEffect } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { ApplicableTo, ALL_SPECIFIC } from '@/components/molecules/hr/leave/ApplicableTo';
import { useToast } from '@/hooks/useToast';
import { useCreateLeaveType, useUpdateLeaveType } from '@/hooks/hr/useLeave';
import { LeaveType, LeaveApplicableTo } from '@/types/hr';

interface CreateLeaveTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editLeaveType?: LeaveType;
}

type FormValues = {
  name: string;
  isPaid: boolean;
  daysAllowed: number | '';
  isCarryOver: boolean;
  maxCarryOverDays: number | '';
  requiresDocument: boolean;
  applicableTo: LeaveApplicableTo[];
};

const emptyDefaults: FormValues = {
  name: '',
  isPaid: false,
  daysAllowed: '',
  isCarryOver: false,
  maxCarryOverDays: '',
  requiresDocument: false,
  applicableTo: ['ALL', ...ALL_SPECIFIC],
};

/* ── Main Panel ── */
export function CreateLeaveTypePanel({
  isOpen,
  onClose,
  tenantSlug,
  editLeaveType,
}: CreateLeaveTypePanelProps) {
  const toast = useToast();
  const isEditing = !!editLeaveType;

  const { mutate: createLeaveType, isPending: isCreating } = useCreateLeaveType(tenantSlug);
  const { mutate: updateLeaveType, isPending: isUpdating } = useUpdateLeaveType(tenantSlug);
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: emptyDefaults });

  useEffect(() => {
    if (editLeaveType) {
      const applicable = editLeaveType.applicableTo?.length
        ? editLeaveType.applicableTo
        : (['ALL', ...ALL_SPECIFIC] as LeaveApplicableTo[]);
      reset({
        name: editLeaveType.name,
        isPaid: editLeaveType.isPaid,
        daysAllowed: editLeaveType.daysAllowed,
        isCarryOver: editLeaveType.isCarryOver,
        maxCarryOverDays: editLeaveType.maxCarryOverDays ?? '',
        requiresDocument: editLeaveType.requiresDocument ?? false,
        applicableTo: applicable,
      });
    } else {
      reset(emptyDefaults);
    }
  }, [editLeaveType, reset]);

  const handleClose = () => onClose();

  const isCarryOver = useWatch({ control, name: 'isCarryOver' });

  const onSubmit = (values: FormValues) => {
    // Strip the synthetic 'ALL' sentinel — backend expects only EmploymentType values.
    // If every specific type is selected we send [] (= applies to all).
    const specificTypes = values.applicableTo.filter(
      (t): t is Exclude<LeaveApplicableTo, 'ALL'> => t !== 'ALL',
    );
    const applicableTo = specificTypes.length === ALL_SPECIFIC.length ? [] : specificTypes;

    const payload = {
      name: values.name,
      isPaid: values.isPaid,
      daysAllowed: Number(values.daysAllowed),
      isCarryOver: values.isCarryOver,
      maxCarryOverDays:
        values.isCarryOver && values.maxCarryOverDays !== ''
          ? Number(values.maxCarryOverDays)
          : undefined,
      requiresApproval: true,
      applicableTo,
    };

    const handleSuccess = () => {
      toast.success(isEditing ? 'Leave type updated' : 'Leave type created');
      reset(emptyDefaults);
      onClose();
    };
    const handleError = (err: unknown) => {
      toast.error(extractError(err, 'Something went wrong'));
    };

    if (isEditing) {
      updateLeaveType(
        { id: editLeaveType!.id, ...payload },
        { onSuccess: handleSuccess, onError: handleError },
      );
    } else {
      createLeaveType(payload, { onSuccess: handleSuccess, onError: handleError });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Leave Type' : 'Add New Leave Type'}
      description="Define the leave type and its entitlement rules."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Add Leave Type'}
          </Button>
        </div>
      }
    >
      {/* Leave Type Name */}
      <FormField
        label="Leave Type Name"
        registration={register('name', { required: 'Leave type name is required' })}
        error={errors.name}
        placeholder="e.g. Sick Leave"
      />

      {/* Days Allowed */}
      <FormField
        label="Days Allowed Per Year"
        registration={register('daysAllowed', {
          required: 'Days allowed is required',
          min: { value: 1, message: 'Must be at least 1' },
        })}
        error={errors.daysAllowed}
        type="number"
        placeholder="e.g. 10"
      />

      {/* Toggle fields */}
      <div className="flex flex-col gap-5 py-2">
        <Controller
          name="isPaid"
          control={control}
          render={({ field }) => (
            <ToggleRow
              label="Paid Leave"
              description="Employees are paid during this leave"
              enabled={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="requiresDocument"
          control={control}
          render={({ field }) => (
            <ToggleRow
              label="Requires Approval Document"
              description="Employee must upload a supporting document when applying"
              enabled={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="isCarryOver"
          control={control}
          render={({ field }) => (
            <ToggleRow
              label="Carry Over Allowed"
              description="Unused days can roll over to the next year"
              enabled={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Max Carry Over Days — conditional */}
      {isCarryOver && (
        <FormField
          label="Maximum Carry Over Days"
          registration={register('maxCarryOverDays', {
            min: { value: 1, message: 'Must be at least 1' },
          })}
          error={errors.maxCarryOverDays}
          type="number"
          placeholder="e.g. 5"
        />
      )}

      {/* Applicable To */}
      <Controller
        name="applicableTo"
        control={control}
        render={({ field }) => <ApplicableTo selected={field.value} onChange={field.onChange} />}
      />
    </SidePanel>
  );
}
