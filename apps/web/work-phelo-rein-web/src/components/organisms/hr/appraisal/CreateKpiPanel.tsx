'use client';

import { useEffect, useCallback } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { inputClass, cn } from '@/lib/utils';
import { AppraisalKpi, CreateAppraisalKpiDto } from '@/types/hr';

interface CreateKpiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  cycleId: string;
  editKpi?: AppraisalKpi;
  usedWeight: number; // sum of all other KPIs' weights
}

type FormValues = {
  title: string;
  description: string;
  weight: number | '';
  maxScore: number | '';
  selfWeight: number | '';
};

const KPI_EMPTY_DEFAULTS = {
  title: '',
  description: '',
  weight: '' as const,
  maxScore: '' as const,
  selfWeight: 40,
};

export function CreateKpiPanel({
  isOpen,
  onClose,
  cycleId,
  editKpi,
  usedWeight,
}: CreateKpiPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editKpi;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { title: '', description: '', weight: '', maxScore: '', selfWeight: 40 },
  });

  useEffect(() => {
    if (editKpi) {
      reset({
        title: editKpi.title,
        description: editKpi.description ?? '',
        weight: editKpi.weight,
        maxScore: editKpi.maxScore,
        selfWeight: editKpi.selfWeight,
      });
    } else {
      reset(KPI_EMPTY_DEFAULTS);
    }
  }, [editKpi, reset]);

  const handleClose = useCallback(() => {
    reset(KPI_EMPTY_DEFAULTS);
    onClose();
  }, [reset, onClose]);

  const selfWeight = useWatch({ control, name: 'selfWeight' });
  const managerWeight = selfWeight !== '' ? Math.max(0, 100 - Number(selfWeight)) : 60;
  const weight = useWatch({ control, name: 'weight' });

  // Remaining weight budget (exclude current KPI's own weight when editing)
  const ownWeight = isEditing ? (editKpi?.weight ?? 0) : 0;
  const remaining = 100 - usedWeight + ownWeight;
  const newTotal = usedWeight - ownWeight + (Number(weight) || 0);
  const weightOk = newTotal <= 100;

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateAppraisalKpiDto) =>
      isEditing
        ? api.put(`/hr/appraisals/cycles/${cycleId}/kpis/${editKpi!.id}`, data)
        : api.post(`/hr/appraisals/cycles/${cycleId}/kpis`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-kpis', cycleId] });
      toast.success(isEditing ? 'KPI updated' : 'KPI added');
      handleClose();
    },
    onError: (err) => {
      toast.error(extractError(err, 'Something went wrong'));
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!values.weight || !values.maxScore || values.selfWeight === '') return;
    if (!weightOk) {
      toast.error(`Weight exceeds budget. Max allowed: ${remaining}%`);
      return;
    }
    mutate({
      cycleId,
      title: values.title,
      description: values.description || undefined,
      weight: Number(values.weight),
      maxScore: Number(values.maxScore),
      selfWeight: Number(values.selfWeight),
      managerWeight: managerWeight,
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit KPI' : 'Add KPI'}
      description="Define a performance objective for this cycle."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Add KPI'}
          </Button>
        </div>
      }
    >
      {/* Weight budget indicator */}
      <div className="flex flex-col gap-2 p-4 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-gray-500">Weight budget used</span>
          <span
            className={cn(
              'font-bold',
              newTotal > 100 ? 'text-red-500' : newTotal === 100 ? 'text-green-600' : 'text-brand',
            )}
          >
            {newTotal}% / 100%
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              newTotal > 100 ? 'bg-red-500' : newTotal === 100 ? 'bg-green-500' : 'bg-brand',
            )}
            style={{ width: `${Math.min(newTotal, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">
          {remaining}% remaining — all KPI weights must sum to exactly 100%
        </p>
      </div>

      {/* Title */}
      <FormField
        label="KPI Title"
        registration={register('title', { required: 'Title is required' })}
        error={errors.title}
        placeholder="e.g. Increase sales revenue by 20%"
      />

      {/* Description */}
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('description')}
          placeholder="Additional context or measurement criteria..."
          rows={3}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>

      {/* Weight + Max Score */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Weight (%)"
          type="number"
          min={1}
          max={remaining}
          placeholder={`Max ${remaining}%`}
          error={errors.weight?.message}
          {...register('weight', {
            required: 'Weight is required',
            min: { value: 1, message: 'Minimum 1%' },
            max: { value: remaining, message: `Max ${remaining}%` },
          })}
        />

        <Controller
          name="maxScore"
          control={control}
          rules={{ required: 'Max score is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Max Score"
              placeholder="Select"
              options={[
                { value: '3', label: '3 points' },
                { value: '5', label: '5 points' },
                { value: '10', label: '10 points' },
              ]}
              value={String(field.value ?? '')}
              onChange={(v) => field.onChange(Number(v))}
              error={errors.maxScore?.message}
            />
          )}
        />
      </div>

      {/* Self / Manager split */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Assessment Weighting</p>
          <p className="text-xs text-gray-400 mt-0.5">
            How much each party&apos;s score contributes to the final KPI score
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Self (%)"
            type="number"
            min={0}
            max={100}
            error={errors.selfWeight?.message}
            {...register('selfWeight', {
              required: 'Required',
              min: { value: 0, message: 'Min 0' },
              max: { value: 100, message: 'Max 100' },
            })}
          />
          <div className="flex flex-col gap-1">
            <Input
              label="Manager (%)"
              type="number"
              value={managerWeight}
              readOnly
              className="bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400">Auto: 100 − self</p>
          </div>
        </div>

        {/* Visual split bar */}
        <div className="flex h-2 rounded-full overflow-hidden">
          <div
            className="bg-brand transition-all duration-300"
            style={{ width: `${Math.min(Number(selfWeight) || 0, 100)}%` }}
          />
          <div className="flex-1 bg-orange-400" />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand inline-block" /> Self {selfWeight || 0}%
          </span>
          <span className="flex items-center gap-1.5">
            Manager {managerWeight}%{' '}
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          </span>
        </div>
      </div>
    </SidePanel>
  );
}
