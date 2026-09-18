'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useCreateFiscalPeriod } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddFiscalPeriodPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormValues {
  name: string;
  startDate: string;
  endDate: string;
}

const DEFAULTS: FormValues = {
  name: '',
  startDate: '',
  endDate: '',
};

export function AddFiscalPeriodPanel({ isOpen, onClose }: AddFiscalPeriodPanelProps) {
  const toast = useToast();
  const { mutateAsync: createFiscalPeriod, isPending } = useCreateFiscalPeriod();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const startDate = useWatch({ control, name: 'startDate' });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await createFiscalPeriod({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      toast.success('Fiscal year created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create fiscal year'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Fiscal Year"
      description="Define a new fiscal year for accounting periods."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Fiscal Year
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Fiscal Year Name"
          type="number"
          registration={register('name', { required: 'Fiscal year name is required' })}
          error={errors.name}
          placeholder="e.g. 2026"
        />

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
            />
          )}
        />

        <Controller
          name="endDate"
          control={control}
          rules={{
            required: 'End date is required',
            validate: (value) =>
              !startDate || value >= startDate || 'End date must be on or after the start date',
          }}
          render={({ field }) => (
            <DatePicker
              label="End Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.endDate?.message}
              minDate={startDate || undefined}
            />
          )}
        />
      </div>
    </SidePanel>
  );
}
