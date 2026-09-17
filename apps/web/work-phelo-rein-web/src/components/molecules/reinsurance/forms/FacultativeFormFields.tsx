'use client';

import { Controller, UseFormReturn, useFieldArray } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { RichTextEditor } from '@/components/molecules/shared/RichTextEditor';
import { Icons } from '@/components/atoms/icons';
import { FacultativeFormValues } from '@/types/reinsurance';
import { useCedantOptions, useRiskTypeOptions, useCurrencyOptions, useRiskTypes } from '@/hooks';
import { cn, inputClass } from '@/lib/utils';

function DocumentVisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
      title={
        visible ? 'Shown on documents — click to hide' : 'Hidden from documents — click to show'
      }
      className={cn(
        'inline-flex shrink-0 cursor-pointer rounded p-1 transition-colors',
        visible
          ? 'text-(--module-btn-bg,var(--color-brand)) hover:bg-orange-50'
          : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50',
      )}
    >
      {visible ? <Icons.FileText className="w-4 h-4" /> : <Icons.FileX2 className="w-4 h-4" />}
    </span>
  );
}

interface FacultativeFormFieldsProps {
  form: UseFormReturn<FacultativeFormValues>;
  commentLabel?: string;
}

export default function FacultativeFormFields({
  form,
  commentLabel = 'Comment',
}: FacultativeFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const {
    fields: extraFields,
    append: appendExtra,
    remove: removeExtra,
  } = useFieldArray({
    control,
    name: 'extraRiskFields',
    keyName: 'fieldArrayId',
  });

  const periodFrom = watch('periodFrom');
  const periodTo = watch('periodTo');

  const sumInsuredValue = watch('sumInsured');
  const premiumValue = watch('premium');
  const computedRate =
    typeof sumInsuredValue === 'number' &&
    Number.isFinite(sumInsuredValue) &&
    typeof premiumValue === 'number' &&
    Number.isFinite(premiumValue) &&
    sumInsuredValue > 0
      ? (premiumValue / sumInsuredValue) * 100
      : null;
  const rateLabel = computedRate != null ? `Rate (${computedRate.toFixed(2)}%)` : 'Rate (%)';
  const riskClassId = watch('riskClassId');

  const durationDays =
    periodFrom && periodTo
      ? Math.round((new Date(periodTo).getTime() - new Date(periodFrom).getTime()) / 86_400_000)
      : null;

  const selectedRiskTypeId = watch('riskType');

  const { options: cedantOptions, isLoading: isLoadingCedants } = useCedantOptions();
  const { data: riskTypeOptions = [], isLoading: isLoadingRiskTypes } =
    useRiskTypeOptions(riskClassId);
  const { data: currencyOptions = [] } = useCurrencyOptions();
  const { data: allRiskTypes = [] } = useRiskTypes();

  const selectedRiskType = allRiskTypes.find((rt) => rt.id === selectedRiskTypeId);
  const riskFields = selectedRiskType?.fields?.filter((f) => f.isActive) ?? [];

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      {/* ── Policy Details ── */}
      <FormSection title="Policy Details">
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <Controller
            name="insuranceCompany"
            control={control}
            rules={{ required: 'Insurance company is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Ceding Company"
                placeholder={isLoadingCedants ? 'Loading…' : 'Select insurance company…'}
                value={field.value}
                onChange={field.onChange}
                error={errors.insuranceCompany?.message}
                options={cedantOptions}
              />
            )}
          />

          <Controller
            name="riskType"
            control={control}
            rules={{ required: 'Risk type is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Risk Type"
                placeholder={
                  isLoadingRiskTypes
                    ? 'Loading…'
                    : riskClassId
                      ? 'Select risk type…'
                      : 'Select a risk class first…'
                }
                value={field.value}
                onChange={field.onChange}
                error={errors.riskType?.message}
                options={riskTypeOptions}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Risk Details ── */}
      {selectedRiskTypeId && (
        <FormSection title="Risk Details">
          <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
            {riskFields.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {riskFields.map((field) => {
                  const name = `riskDetails.${field.fieldKey}` as const;
                  const visibilityName = `riskDetailsVisibility.${field.fieldKey}` as const;

                  const visibilityToggle = (
                    <Controller
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      name={visibilityName as any}
                      control={control}
                      render={({ field: vf }) => (
                        <DocumentVisibilityToggle
                          visible={vf.value !== false}
                          onToggle={() => vf.onChange(vf.value === false)}
                        />
                      )}
                    />
                  );

                  if (field.fieldType === 'TEXTAREA') {
                    return (
                      <div key={field.id} className="col-span-2">
                        <FormField
                          label={field.label}
                          type="textarea"
                          rows={3}
                          registration={register(name as 'riskDetails', {
                            required: field.required ? `${field.label} is required` : false,
                          })}
                          placeholder={field.placeholder ?? ''}
                          rightElement={visibilityToggle}
                        />
                      </div>
                    );
                  }
                  if (field.fieldType === 'SELECT' && field.options?.length) {
                    return (
                      <Controller
                        key={field.id}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        name={name as any}
                        control={control}
                        rules={{ required: field.required ? `${field.label} is required` : false }}
                        render={({ field: f }) => (
                          <SearchSelect
                            label={field.label}
                            placeholder={field.placeholder ?? `Select ${field.label}…`}
                            options={field.options!.map((o) => ({ value: o, label: o }))}
                            value={String(f.value ?? '')}
                            onChange={f.onChange}
                            rightSlot={visibilityToggle}
                          />
                        )}
                      />
                    );
                  }
                  if (field.fieldType === 'DATE') {
                    return (
                      <Controller
                        key={field.id}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        name={name as any}
                        control={control}
                        rules={{ required: field.required ? `${field.label} is required` : false }}
                        render={({ field: f }) => (
                          <DatePicker
                            label={field.label}
                            value={String(f.value ?? '')}
                            onChange={f.onChange}
                            rightSlot={visibilityToggle}
                          />
                        )}
                      />
                    );
                  }
                  if (field.fieldType === 'CHECKBOX') {
                    return (
                      <div
                        key={field.id}
                        className="flex flex-col gap-(--field-label-gap,0.125rem)"
                      >
                        <label className="text-sm font-bold text-gray-900">{field.label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            {...register(name as 'riskDetails')}
                            className="w-4 h-4 accent-orange-500"
                          />
                          {visibilityToggle}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <FormField
                      key={field.id}
                      label={field.label}
                      type={field.fieldType === 'NUMBER' ? 'number' : 'text'}
                      registration={register(name as 'riskDetails', {
                        required: field.required ? `${field.label} is required` : false,
                      })}
                      placeholder={field.placeholder ?? ''}
                      rightElement={visibilityToggle}
                    />
                  );
                })}
              </div>
            )}

            {/* Extra / custom fields */}
            {extraFields.length > 0 && (
              <div className="flex flex-col gap-2">
                {extraFields.map((ef, index) => (
                  <div key={ef.fieldArrayId} className="grid grid-cols-2 gap-2 items-end">
                    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                      <label className="text-sm font-bold text-gray-900">Field Name</label>
                      <input
                        {...register(`extraRiskFields.${index}.label`)}
                        className={cn(inputClass())}
                        placeholder="e.g. Extra Title"
                      />
                    </div>
                    <div className="flex items-end gap-1.5">
                      <div className="flex flex-col gap-(--field-label-gap,0.125rem) flex-1">
                        <label className="text-sm font-bold text-gray-900">Value</label>
                        <div className="relative">
                          <input
                            {...register(`extraRiskFields.${index}.value`)}
                            className={cn(inputClass(undefined, 'pr-9'))}
                            placeholder="e.g. Extra details"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Controller
                              name={`extraRiskFields.${index}.showOnDocument`}
                              control={control}
                              render={({ field: vf }) => (
                                <DocumentVisibilityToggle
                                  visible={vf.value !== false}
                                  onToggle={() => vf.onChange(vf.value === false)}
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExtra(index)}
                        className="mb-2 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                        title="Remove field"
                      >
                        <Icons.Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                appendExtra({
                  id:
                    typeof crypto !== 'undefined' && 'randomUUID' in crypto
                      ? crypto.randomUUID()
                      : `custom-${Date.now()}`,
                  label: '',
                  value: '',
                  type: 'TEXT',
                  displayOrder: extraFields.length + 1,
                  showOnDocument: true,
                })
              }
              className="self-start text-sm font-medium flex items-center gap-1 transition-colors text-(--module-btn-bg,var(--color-brand)) hover:text-(--module-btn-bg-hover,var(--color-brand-hover))"
            >
              <span className="text-base leading-none">+</span> Add Extra Field
            </button>
          </div>
        </FormSection>
      )}

      {/* ── Offer Details ── */}
      <FormSection title="Offer Details">
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Policy Number"
              registration={register('policyNumber', {
                minLength: { value: 2, message: 'Min 2 characters' },
                maxLength: { value: 80, message: 'Max 80 characters' },
              })}
              error={errors.policyNumber}
              placeholder="e.g. POL-2024-001"
            />

            <FormField
              label="Insured"
              registration={register('title', {
                required: 'Insured is required',
                minLength: { value: 2, message: 'Min 2 characters' },
                maxLength: { value: 200, message: 'Max 200 characters' },
              })}
              error={errors.title}
              placeholder="e.g. Accra Breweries"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="sumInsured"
              control={control}
              rules={{ min: { value: 0.01, message: 'Sum insured is required' } }}
              render={({ field }) => (
                <NumberField
                  label="100% Sum Insured"
                  value={typeof field.value === 'number' ? field.value : 0}
                  onChange={field.onChange}
                  error={errors.sumInsured?.message}
                  placeholder="e.g. 50000"
                />
              )}
            />
            <Controller
              name="premium"
              control={control}
              rules={{ min: { value: 0.01, message: 'Premium is required' } }}
              render={({ field }) => (
                <NumberField
                  label="100% Premium"
                  value={typeof field.value === 'number' ? field.value : 0}
                  onChange={field.onChange}
                  error={errors.premium?.message}
                  placeholder="e.g. 75000"
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={rateLabel}
              type="number"
              registration={register('rate', {
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.rate}
              placeholder="e.g. 1.5"
            />
            <FormField
              label="Facultative Offer (%)"
              type="number"
              registration={register('facultativeOffer', {
                required: 'Facultative offer is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.facultativeOffer}
              placeholder="e.g. 60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Cedant Commission (%)"
              type="number"
              registration={register('commission', {
                required: 'Commission is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.commission}
              placeholder="e.g. 15"
            />

            <Controller
              name="currency"
              control={control}
              rules={{ required: 'Currency is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Currency"
                  placeholder="Select currency…"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.currency?.message}
                  options={currencyOptions}
                />
              )}
            />
          </div>
        </div>
      </FormSection>

      {/* ── Period of Insurance ── */}
      <FormSection title="Period of Insurance">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="periodFrom"
              control={control}
              rules={{ required: 'Start date is required' }}
              render={({ field }) => (
                <DatePicker
                  label="Inception"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.periodFrom?.message}
                />
              )}
            />

            <Controller
              name="periodTo"
              control={control}
              rules={{ required: 'End date is required' }}
              render={({ field }) => (
                <DatePicker
                  label="Expiry"
                  value={field.value}
                  onChange={field.onChange}
                  minDate={periodFrom || undefined}
                  error={errors.periodTo?.message}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <div
              className={inputClass(
                undefined,
                'bg-gray-50 text-gray-500 cursor-default select-none',
              )}
            >
              {durationDays !== null && durationDays >= 0 ? (
                `${durationDays} days`
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>
        </div>
      </FormSection>

      {/* ── Comment ── */}
      <FormSection title={commentLabel}>
        <Controller
          name="comment"
          control={control}
          render={({ field }) => (
            <RichTextEditor
              value={field.value}
              onChange={field.onChange}
              error={errors.comment?.message}
              placeholder="Add any relevant notes or comments…"
            />
          )}
        />
      </FormSection>
    </div>
  );
}
