'use client';

import { useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import type { AllowanceType } from '@/types/hr';
import { ALLOWANCE_TYPE_OPTIONS } from '@/lib/payrollUtils';

export interface AllowanceFormValues {
  name: string;
  type: AllowanceType;
  description?: string;
}

export interface CompanyAllowance {
  id: string;
  name: string;
  type: AllowanceType;
  description?: string;
  createdAt: string;
}

interface AddAllowancePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AllowanceFormValues) => void;
  isSubmitting?: boolean;
  allowance?: Pick<CompanyAllowance, 'id' | 'name' | 'type' | 'description'> | null;
}

export function AddAllowancePanel({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  allowance,
}: AddAllowancePanelProps) {
  const isEdit = !!allowance;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AllowanceFormValues>();

  useEffect(() => {
    if (isOpen && allowance) {
      reset({ name: allowance.name, type: allowance.type, description: allowance.description });
    }
  }, [isOpen, allowance, reset]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Allowance' : 'Add Allowance'}
      description={
        isEdit
          ? 'Update the details of this allowance.'
          : 'Define a company allowance that can be assigned to employees.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            isLoading={isSubmitting}
            loadingText={isEdit ? 'Saving…' : 'Creating…'}
            onClick={handleSubmit(onSubmit)}
          >
            {isEdit ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      }
    >
      <FormField
        label="Allowance Name"
        registration={register('name', { required: 'Name is required' })}
        error={errors.name}
        placeholder="e.g. Monthly Transport Allowance"
      />

      <Controller
        name="type"
        control={control}
        rules={{ required: 'Allowance type is required' }}
        render={({ field }) => (
          <SearchSelect
            label="Allowance Type"
            placeholder="Select allowance type"
            options={ALLOWANCE_TYPE_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={errors.type?.message}
          />
        )}
      />

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('description')}
          placeholder="Describe what this allowance covers…"
          rows={4}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>
    </SidePanel>
  );
}
