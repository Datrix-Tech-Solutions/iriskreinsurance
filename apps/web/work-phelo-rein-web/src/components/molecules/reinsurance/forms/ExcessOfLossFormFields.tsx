'use client';

import { Controller, UseFormReturn, useFieldArray } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FileUpload } from '@/components/atoms/FileUpload';
import { Icons } from '@/components/atoms/icons';
import { inputClass } from '@/lib/utils';
import {
  ExcessOfLossFormValues,
  DEFAULT_TREATY_LAYER,
  TERRITORIAL_SCOPE_OPTIONS,
  ACCOUNTING_ARRANGEMENT_OPTIONS,
  BASIS_OF_ATTACHMENT_OPTIONS,
  REINSTATEMENT_TYPE_OPTIONS,
  EXCESS_OF_LOSS_TYPE_OPTIONS,
} from '@/types/reinsurance';
import { useCedantOptions, useBrokerOptions, useCurrencyOptions } from '@/hooks';

/* Year options: 2000 → current year + 5 */
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2000 + 6 }, (_, i) => {
  const y = String(2000 + i);
  return { value: y, label: y };
});

/* Read-only computed field */
function ComputedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className={inputClass(undefined, 'bg-gray-50 text-gray-500 cursor-default select-none')}>
        {value || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

interface ExcessOfLossFormFieldsProps {
  form: UseFormReturn<ExcessOfLossFormValues>;
}

export function ExcessOfLossFormFields({ form }: ExcessOfLossFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'layers' });

  const effectiveDate = watch('effectiveDate');

  const { options: cedantOptions } = useCedantOptions();
  const { options: brokerOptions } = useBrokerOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();
  const egnpi = watch('egnpi');
  const rate = watch('rate');
  const mAndD = watch('mAndD');

  /* Calculated M&D Premium = EGNPI × (rate / 100) × (mAndD / 100) */
  const calculatedMandD =
    typeof egnpi === 'number' &&
    typeof rate === 'number' &&
    typeof mAndD === 'number' &&
    egnpi > 0 &&
    rate > 0 &&
    mAndD > 0
      ? (egnpi * (rate / 100) * (mAndD / 100)).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '';

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      {/* ── Basic Information ── */}
      <FormSection title="Basic Information">
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <Controller
            name="classOfBusiness"
            control={control}
            rules={{ required: 'Class of business is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Class of Business"
                placeholder="Type to add class of business…"
                value={field.value}
                onChange={field.onChange}
                error={errors.classOfBusiness?.message}
                options={[]}
              />
            )}
          />

          <Controller
            name="excessOfLossType"
            control={control}
            rules={{ required: 'Excess of loss type is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Excess of Loss Type"
                placeholder="Select type…"
                options={EXCESS_OF_LOSS_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.excessOfLossType?.message}
              />
            )}
          />

          <Controller
            name="year"
            control={control}
            rules={{ required: 'Accounting year is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Accounting Year"
                placeholder="Select year…"
                options={YEAR_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.year?.message}
              />
            )}
          />

          <FormField
            label="Treaty Name"
            registration={register('treatyName', { required: 'Treaty name is required' })}
            error={errors.treatyName}
            placeholder="e.g. Ghana Property XL 2025"
          />

          <Controller
            name="territorialScope"
            control={control}
            rules={{ required: 'Territorial scope is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Territorial Scope"
                placeholder="Select territory…"
                options={TERRITORIAL_SCOPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.territorialScope?.message}
              />
            )}
          />

          <Controller
            name="accountingArrangement"
            control={control}
            rules={{ required: 'Accounting arrangement is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Accounting Arrangement"
                placeholder="Select arrangement…"
                options={ACCOUNTING_ARRANGEMENT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.accountingArrangement?.message}
              />
            )}
          />

          <Controller
            name="currency"
            control={control}
            rules={{ required: 'Currency is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Currency"
                placeholder="Select currency…"
                options={currencyOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.currency?.message}
              />
            )}
          />

          <Controller
            name="cedantCompany"
            control={control}
            rules={{ required: 'Cedant company is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Cedant Company"
                placeholder="Select cedant…"
                value={field.value}
                onChange={field.onChange}
                error={errors.cedantCompany?.message}
                options={cedantOptions}
              />
            )}
          />

          <Controller
            name="broker"
            control={control}
            rules={{ required: 'Broker is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Broker"
                placeholder="Select broker…"
                value={field.value}
                onChange={field.onChange}
                error={errors.broker?.message}
                options={brokerOptions}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Treaty Period ── */}
      <FormSection title="Treaty Period">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="effectiveDate"
            control={control}
            rules={{ required: 'Effective date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Effective Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.effectiveDate?.message}
              />
            )}
          />
          <Controller
            name="expiryDate"
            control={control}
            rules={{ required: 'Expiry date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Expiry Date"
                value={field.value}
                onChange={field.onChange}
                minDate={effectiveDate || undefined}
                error={errors.expiryDate?.message}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Financial Terms ── */}
      <FormSection title="Financial Terms">
        <FormField
          label="Brokerage Fee (%)"
          type="number"
          registration={register('brokerageFee', {
            required: 'Brokerage fee is required',
            min: { value: 0, message: 'Cannot be negative' },
            max: { value: 100, message: 'Cannot exceed 100%' },
            valueAsNumber: true,
          })}
          error={errors.brokerageFee}
          placeholder="e.g. 5"
        />
      </FormSection>

      {/* ── Basis & Rating ── */}
      <FormSection title="Basis &amp; Rating">
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <Controller
            name="basisOfAttachment"
            control={control}
            rules={{ required: 'Basis of attachment is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Basis of Attachment"
                placeholder="Select basis…"
                options={BASIS_OF_ATTACHMENT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.basisOfAttachment?.message}
              />
            )}
          />

          <FormField
            label="EGNPI"
            type="number"
            registration={register('egnpi', {
              required: 'EGNPI is required',
              min: { value: 0, message: 'Cannot be negative' },
              valueAsNumber: true,
            })}
            error={errors.egnpi}
            placeholder="e.g. 1000000"
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Rate (%)"
              type="number"
              registration={register('rate', {
                required: 'Rate is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.rate}
              placeholder="e.g. 2.5"
            />
            <FormField
              label="M&amp;D (%)"
              type="number"
              registration={register('mAndD', {
                required: 'M&D is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.mAndD}
              placeholder="e.g. 10"
            />
          </div>

          <ComputedField label="Calculated M&amp;D Premium" value={calculatedMandD} />
        </div>
      </FormSection>

      {/* ── Treaty Layers ── */}
      <FormSection title="Treaty Layers">
        <div className="flex flex-col gap-4">
          {fields.map((field, index) => {
            const layerErrors = errors.layers?.[index];
            return (
              <div
                key={field.id}
                className="flex flex-col gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50"
              >
                {/* Layer header */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Layer {index + 1}
                  </p>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      aria-label="Remove layer"
                    >
                      <Icons.X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Layer name */}
                <FormField
                  label="Layer Name"
                  registration={register(`layers.${index}.name`, {
                    required: 'Layer name is required',
                  })}
                  error={layerErrors?.name}
                  placeholder="e.g. First Layer"
                />

                {/* Retention & Limit */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Retention"
                    type="number"
                    registration={register(`layers.${index}.retention`, {
                      required: 'Retention is required',
                      min: { value: 0, message: 'Cannot be negative' },
                      valueAsNumber: true,
                    })}
                    error={layerErrors?.retention}
                    placeholder="e.g. 500000"
                  />
                  <FormField
                    label="Limit"
                    type="number"
                    registration={register(`layers.${index}.limit`, {
                      required: 'Limit is required',
                      min: { value: 1, message: 'Must be greater than 0' },
                      valueAsNumber: true,
                    })}
                    error={layerErrors?.limit}
                    placeholder="e.g. 1000000"
                  />
                </div>

                {/* Reinstatements */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Reinstatements"
                    type="number"
                    registration={register(`layers.${index}.reinstatements`, {
                      required: 'Reinstatements is required',
                      min: { value: 0, message: 'Cannot be negative' },
                      valueAsNumber: true,
                    })}
                    error={layerErrors?.reinstatements}
                    placeholder="e.g. 2"
                  />
                  <Controller
                    name={`layers.${index}.reinstatementsType`}
                    control={control}
                    rules={{ required: 'Reinstatement type is required' }}
                    render={({ field: f }) => (
                      <SearchSelect
                        label="Type"
                        placeholder="Select…"
                        options={REINSTATEMENT_TYPE_OPTIONS}
                        value={f.value}
                        onChange={f.onChange}
                        error={layerErrors?.reinstatementsType?.message}
                      />
                    )}
                  />
                </div>
              </div>
            );
          })}

          {/* Add Layer button */}
          <button
            type="button"
            onClick={() => append({ ...DEFAULT_TREATY_LAYER })}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
          >
            <Icons.Plus className="w-4 h-4" />
            Add Layer
          </button>
        </div>
      </FormSection>

      {/* ── Reinsurer Panel ── */}
      <FormSection title="Reinsurer Panel">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Reinsurer Share (%)"
            type="number"
            registration={register('reinsurerShare', {
              required: 'Reinsurer share is required',
              min: { value: 0, message: 'Cannot be negative' },
              max: { value: 100, message: 'Cannot exceed 100%' },
              valueAsNumber: true,
            })}
            error={errors.reinsurerShare}
            placeholder="e.g. 75"
          />
          <FormField
            label="Your Share (%)"
            type="number"
            registration={register('yourShare', {
              required: 'Your share is required',
              min: { value: 0, message: 'Cannot be negative' },
              max: { value: 100, message: 'Cannot exceed 100%' },
              valueAsNumber: true,
            })}
            error={errors.yourShare}
            placeholder="e.g. 25"
          />
        </div>
      </FormSection>

      {/* ── Documentation ── */}
      <FormSection title="Documentation">
        <Controller
          name="supportingDocument"
          control={control}
          render={({ field }) => (
            <FileUpload
              label="Supporting Document"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              value={field.value}
              onChange={field.onChange}
              hint="PDF, Word or Excel — optional"
              error={errors.supportingDocument?.message}
            />
          )}
        />
      </FormSection>
    </div>
  );
}
