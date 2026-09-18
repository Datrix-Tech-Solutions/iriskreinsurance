'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FileUpload } from '@/components/atoms/FileUpload';
import {
  SurplusFormValues,
  TERRITORIAL_SCOPE_OPTIONS,
  ACCOUNTING_ARRANGEMENT_OPTIONS,
} from '@/types/reinsurance';
import { inputClass } from '@/lib/utils';
import { useCedantOptions, useBrokerOptions, useCurrencyOptions } from '@/hooks';

/* Year options: 2000 → current year + 5 */
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2000 + 6 }, (_, i) => {
  const y = String(2000 + i);
  return { value: y, label: y };
});

/* Read-only computed field — styled like an input but non-editable */
function ComputedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className={inputClass(undefined, 'bg-gray-50 text-gray-500 cursor-default select-none')}>
        {value || <span className="text-gray-400">—</span>}
      </div>
      <p className="text-xs text-gray-400">Auto-calculated</p>
    </div>
  );
}

interface SurplusFormFieldsProps {
  form: UseFormReturn<SurplusFormValues>;
}

export function SurplusFormFields({ form }: SurplusFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const effectiveDate = watch('effectiveDate');
  const cedantRetentionLine = watch('cedantRetentionLine');
  const reinsuranceLine = watch('reinsuranceLine');

  const { options: cedantOptions } = useCedantOptions();
  const { options: brokerOptions } = useBrokerOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  /* Compute total capacity — only when both fields have valid numbers */
  const totalCapacity =
    typeof cedantRetentionLine === 'number' &&
    typeof reinsuranceLine === 'number' &&
    cedantRetentionLine > 0 &&
    reinsuranceLine > 0
      ? (cedantRetentionLine * reinsuranceLine).toLocaleString()
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
            placeholder="e.g. Ghana Motor Surplus 2025"
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
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Cedant's Commission (%)"
            type="number"
            registration={register('cedantCommission', {
              required: "Cedant's commission is required",
              min: { value: 0, message: 'Cannot be negative' },
              max: { value: 100, message: 'Cannot exceed 100%' },
              valueAsNumber: true,
            })}
            error={errors.cedantCommission}
            placeholder="e.g. 30"
          />
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
        </div>
      </FormSection>

      {/* ── Capacity Structure ── */}
      <FormSection title="Capacity Structure">
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <FormField
            label="Cedant Retention Line"
            type="number"
            registration={register('cedantRetentionLine', {
              required: 'Cedant retention line is required',
              min: { value: 1, message: 'Must be greater than 0' },
              valueAsNumber: true,
            })}
            error={errors.cedantRetentionLine}
            placeholder="e.g. 500000"
          />

          <FormField
            label="Reinsurance Line"
            type="number"
            registration={register('reinsuranceLine', {
              required: 'Reinsurance line is required',
              min: { value: 1, message: 'Must be greater than 0' },
              valueAsNumber: true,
            })}
            error={errors.reinsuranceLine}
            placeholder="e.g. 9"
          />

          <ComputedField label="Total Capacity" value={totalCapacity} />
        </div>
      </FormSection>

      {/* ── Reinsurer Panel ── */}
      <FormSection title="Reinsurer Panel">
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
