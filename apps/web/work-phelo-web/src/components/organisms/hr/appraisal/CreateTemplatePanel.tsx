'use client';

import { useEffect } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { FormField } from '@/components/molecules/shared/FormField';
import { useToast } from '@/hooks/useToast';
import { useCreateAppraisalTemplate, useUpdateAppraisalTemplate } from '@/hooks';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import { AppraisalTemplate, CreateAppraisalTemplateDto } from '@/types/hr';
import { Icons } from '@/components/atoms/icons';

interface CreateTemplatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editTemplate?: AppraisalTemplate;
}

type KpiFormValue = {
  title: string;
  weight: number | '';
  maxScore: number | '';
  description: string;
};

type FormValues = {
  name: string;
  selfAssessmentWeight: number | '';
  managerAssessmentWeight: number | '';
  kpis: KpiFormValue[];
};

export function CreateTemplatePanel({ isOpen, onClose, editTemplate }: CreateTemplatePanelProps) {
  const toast = useToast();
  const isEditing = !!editTemplate;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      selfAssessmentWeight: '',
      managerAssessmentWeight: '',
      kpis: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'kpis' });

  useEffect(() => {
    if (editTemplate) {
      reset({
        name: editTemplate.name,
        selfAssessmentWeight: editTemplate.selfAssessmentWeight,
        managerAssessmentWeight: editTemplate.managerAssessmentWeight,
        kpis: editTemplate.kpis.map((k) => ({
          title: k.title,
          weight: k.weight,
          maxScore: k.maxScore,
          description: k.description ?? '',
        })),
      });
    } else {
      reset({
        name: '',
        selfAssessmentWeight: '',
        managerAssessmentWeight: '',
        kpis: [],
      });
    }
  }, [editTemplate, reset]);

  const selfWeightRaw = useWatch({ control, name: 'selfAssessmentWeight' });
  const selfWeight = Number(selfWeightRaw || 0);
  const managerWeight = Number(useWatch({ control, name: 'managerAssessmentWeight' }) || 0);
  const totalWeight = selfWeight + managerWeight;
  const weightIsValid = totalWeight === 100;

  // Manager weight is derived from the self weight so the two always add up to 100%.
  useEffect(() => {
    if (selfWeightRaw === '' || selfWeightRaw == null) {
      setValue('managerAssessmentWeight', '', { shouldValidate: true });
      return;
    }
    const clamped = Math.min(100, Math.max(0, Number(selfWeightRaw)));
    setValue('managerAssessmentWeight', 100 - clamped, { shouldValidate: true });
  }, [selfWeightRaw, setValue]);

  const kpisWatch = useWatch({ control, name: 'kpis' }) ?? [];
  const totalKpiWeight = kpisWatch.reduce((sum, k) => sum + Number(k?.weight || 0), 0);
  const kpiWeightIsValid = totalKpiWeight === 100;
  const remainingKpiWeight = Math.max(0, 100 - totalKpiWeight);

  const createTemplate = useCreateAppraisalTemplate();
  const updateTemplate = useUpdateAppraisalTemplate();
  const isPending = createTemplate.isPending || updateTemplate.isPending;

  const onSubmit = (values: FormValues) => {
    if (!weightIsValid) {
      toast.error('Self and manager assessment weights must add up to 100%');
      return;
    }
    if (values.kpis.length === 0) {
      toast.error('Add at least one KPI');
      return;
    }
    if (!kpiWeightIsValid) {
      toast.error(`KPI weights must total 100%. Current total is ${totalKpiWeight}%`);
      return;
    }

    const payload: Partial<CreateAppraisalTemplateDto> = {
      name: values.name,
      selfAssessmentWeight: Number(values.selfAssessmentWeight),
      managerAssessmentWeight: Number(values.managerAssessmentWeight),
      kpis: values.kpis.map((k) => ({
        title: k.title,
        weight: Number(k.weight),
        maxScore: Number(k.maxScore),
        description: k.description || undefined,
      })),
    };

    const callbacks = {
      onSuccess: () => {
        toast.success(isEditing ? 'Template updated' : 'Template created');
        reset({ name: '', selfAssessmentWeight: '', managerAssessmentWeight: '', kpis: [] });
        onClose();
      },
      onError: (err: unknown) => {
        toast.error(extractError(err, 'Something went wrong'));
      },
    };

    if (isEditing) {
      updateTemplate.mutate({ id: editTemplate!.id, ...payload }, callbacks);
    } else {
      createTemplate.mutate(payload, callbacks);
    }
  };

  const addKpi = () => append({ title: '', weight: '', maxScore: '', description: '' });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Template' : 'Add Appraisal Template'}
      description="Define KPI-based templates for performance reviews."
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-600">KPI Weight</span>
              <span
                className={`font-semibold ${
                  kpiWeightIsValid
                    ? 'text-green-600'
                    : totalKpiWeight > 100
                      ? 'text-red-500'
                      : 'text-gray-500'
                }`}
              >
                {totalKpiWeight} of 100%
              </span>
            </div>
            <ProgressBar
              value={totalKpiWeight}
              showLabel={false}
              fillClassName={
                kpiWeightIsValid ? 'bg-green-500' : totalKpiWeight > 100 ? 'bg-red-500' : 'bg-brand'
              }
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      {/* Template Details */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-gray-800">Template Details</p>

        <FormField
          label="Template Name"
          registration={register('name', { required: 'Template name is required' })}
          error={errors.name}
          placeholder="eg; Annual Performance Review"
        />

        <Controller
          name="selfAssessmentWeight"
          control={control}
          rules={{
            required: 'Required',
            min: { value: 0, message: 'Min 0' },
            max: { value: 100, message: 'Max 100' },
          }}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Self Assessment Weight (%)
              </label>
              <Input
                type="number"
                placeholder="40"
                error={errors.selfAssessmentWeight?.message}
                {...field}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
          )}
        />

        <Controller
          name="managerAssessmentWeight"
          control={control}
          rules={{ required: 'Set the self assessment weight first' }}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Manager Assessment Weight ({field.value === '' ? '—' : field.value}%)
              </label>
              <Input
                type="number"
                placeholder="60"
                readOnly
                disabled
                error={errors.managerAssessmentWeight?.message}
                value={field.value}
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400">
                Automatically set to what&apos;s left of the 100% total.
              </p>
            </div>
          )}
        />

        <div
          className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
            weightIsValid
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-50 text-gray-500 border border-gray-200'
          }`}
        >
          Total Assessment Weight: {totalWeight} of 100%
        </div>
      </div>

      {/* KPIs */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-800">Key Performance Indicators</p>

        {fields.map((field, index) => {
          const kpiErrors = errors.kpis?.[index];
          return (
            <div
              key={field.id}
              className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Add KPI
                </p>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  aria-label="Remove KPI"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">KPI Title</label>
                <Input
                  placeholder="eg; Standard Appraisal"
                  error={kpiErrors?.title?.message}
                  {...register(`kpis.${index}.title`, { required: 'KPI title is required' })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Weight (
                    <span className="text-gray-600 font-normal">
                      {remainingKpiWeight === 0 ? '%' : `${remainingKpiWeight}% left`}
                    </span>
                    )
                  </label>
                  <Input
                    type="number"
                    placeholder="eg; 30"
                    error={kpiErrors?.weight?.message}
                    {...register(`kpis.${index}.weight`, {
                      required: 'Required',
                      min: { value: 1, message: 'Min 1' },
                    })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Controller
                    name={`kpis.${index}.maxScore`}
                    control={control}
                    rules={{ required: 'Required' }}
                    render={({ field }) => (
                      <SearchSelect
                        label="Max Score"
                        placeholder="Select"
                        options={[
                          { value: '5', label: '1 – 5' },
                          { value: '10', label: '1 – 10' },
                        ]}
                        value={field.value === '' ? '' : String(field.value)}
                        onChange={(v) => field.onChange(v === '' ? '' : Number(v))}
                        error={kpiErrors?.maxScore?.message}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  placeholder="Describe what this KPI measures"
                  rows={3}
                  className={inputClass(undefined, 'resize-none')}
                  {...register(`kpis.${index}.description`)}
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addKpi}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <Icons.Plus className="w-4 h-4" />
          Add KPI
        </button>
      </div>
    </SidePanel>
  );
}
