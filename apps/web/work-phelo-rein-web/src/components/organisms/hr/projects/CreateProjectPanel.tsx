'use client';

import { useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import { CreateProjectDto } from '@/types/hr';
import { EmployeeOption } from '@/types/hr';

interface CreateProjectPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeOption[];
  onSubmit: (data: CreateProjectDto) => void;
  isSubmitting?: boolean;
}

type FormValues = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: string;
  managerId: string;
};

export function CreateProjectPanel({
  isOpen,
  onClose,
  employees,
  onSubmit,
  isSubmitting,
}: CreateProjectPanelProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      budget: '',
      managerId: '',
    },
  });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const onValid = (values: FormValues) => {
    onSubmit({
      name: values.name,
      description: values.description || undefined,
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      budget: values.budget ? Number(values.budget) : undefined,
      managerId: values.managerId || undefined,
    });
  };

  const managerOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
    sublabel: e.jobTitle,
  }));

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Project"
      description="Create a new project and assign an owner."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} loadingText="Creating…" onClick={handleSubmit(onValid)}>
            Create Project
          </Button>
        </div>
      }
    >
      <FormField
        label="Project Name"
        registration={register('name', { required: 'Project name is required' })}
        error={errors.name}
        placeholder="e.g. Website Redesign"
      />

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('description')}
          placeholder="Brief overview of the project"
          rows={3}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>

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
              disablePast
            />
          )}
        />
        <Controller
          name="endDate"
          control={control}
          render={({ field }) => (
            <DatePicker
              label="End Date"
              value={field.value}
              onChange={field.onChange}
              disablePast
            />
          )}
        />
      </div>

      <Controller
        name="budget"
        control={control}
        rules={{ min: { value: 0, message: 'Budget must be a positive number' } }}
        render={({ field }) => (
          <NumberField
            label="Budget (GHS)"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(String(n))}
            error={errors.budget?.message}
            placeholder="e.g. 50000"
          />
        )}
      />

      <Controller
        name="managerId"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Project Owner"
            placeholder="Select owner (optional)"
            options={managerOptions}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </SidePanel>
  );
}
