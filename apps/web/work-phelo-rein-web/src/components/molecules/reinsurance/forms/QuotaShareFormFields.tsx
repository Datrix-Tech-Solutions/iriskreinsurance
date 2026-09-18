'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FileUpload } from '@/components/atoms/FileUpload';
import { inputClass } from '@/lib/utils';
import {
  QuotaShareFormValues,
  TERRITORIAL_SCOPE_OPTIONS,
  ACCOUNTING_ARRANGEMENT_OPTIONS,
} from '@/types/reinsurance';
import { useCedantOptions, useCurrencyOptions } from '@/hooks';

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

/* Year options: 2000 → current year + 5 */
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2000 + 6 }, (_, i) => {
  const y = String(2000 + i);
  return { value: y, label: y };
});

interface QuotaShareFormFieldsProps {
  form: UseFormReturn<QuotaShareFormValues>;
}

export function QuotaShareFormFields({ form }: QuotaShareFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const effectiveDate = watch('effectiveDate');
  const cedantShare = watch('cedantShare');

  const { options: cedantOptions } = useCedantOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const reinsuranceShareNum =
    typeof cedantShare === 'number' && cedantShare >= 0 && cedantShare <= 100
      ? 100 - cedantShare
      : null;

  const reinsuranceShare = reinsuranceShareNum !== null ? String(reinsuranceShareNum) : '';

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
            placeholder="e.g. Ghana Motor XL 2025"
          />

          {/* ── Scope & Arrangement ── */}

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

          {/* ── Parties ── */}

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
        </div>
      </FormSection>

      {/* ── Period ── */}
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
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
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
        </div>
      </FormSection>

      {/* ── Quota Share Structure ── */}

      <FormSection title="Quota Share Structure">
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <FormField
            label="Limit of Liability"
            type="number"
            registration={register('limitOfLiability', {
              required: 'Limit of liability is required',
              min: { value: 0, message: 'Cannot be negative' },
              valueAsNumber: true,
            })}
            error={errors.limitOfLiability}
            placeholder="e.g. 1000000"
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Cedant Share (%)"
              type="number"
              registration={register('cedantShare', {
                required: 'Cedant share is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.cedantShare}
              placeholder="e.g. 50"
            />
            <ComputedField label="Reinsurance Share (%)" value={reinsuranceShare} />
          </div>
        </div>
      </FormSection>

      {/* ── Reinsurer Panel ── */}
      <FormSection title="Participations">
        <div className="flex flex-col gap-4">
          <FormField
            label="Broker Participation (%)"
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

          {/* <ReinsurerPanel
            control={control as unknown as Control<FieldValues>}
            register={register as unknown as UseFormRegister<FieldValues>}
            errors={errors as unknown as ReinsurerPanelErrors}
            reinsurerPanelValues={reinsurerPanelValues}
            maxShare={reinsuranceShareNum}
            reinsurerOptions={reinsurerOptions}
          /> */}
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
