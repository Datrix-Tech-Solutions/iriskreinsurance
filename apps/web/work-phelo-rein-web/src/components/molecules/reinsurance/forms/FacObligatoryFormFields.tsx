'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FileUpload } from '@/components/atoms/FileUpload';
import {
  FacObligatoryFormValues,
  TERRITORIAL_SCOPE_OPTIONS,
  ACCOUNTING_ARRANGEMENT_OPTIONS,
} from '@/types/reinsurance';
import { useCedantOptions, useBrokerOptions, useCurrencyOptions } from '@/hooks';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2000 + 6 }, (_, i) => {
  const y = String(2000 + i);
  return { value: y, label: y };
});

interface FacObligatoryFormFieldsProps {
  form: UseFormReturn<FacObligatoryFormValues>;
}

export function FacObligatoryFormFields({ form }: FacObligatoryFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const effectiveDate = watch('effectiveDate');

  const { options: cedantOptions } = useCedantOptions();
  const { options: brokerOptions } = useBrokerOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      {/* ── Basic Information ── */}
      <FormSection title="Basic Information">
        <div className="flex flex-col gap-5">
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
            placeholder="e.g. Ghana Fire Fac. Oblig. 2025"
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
            label="Commission (%)"
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

      {/* ── Reinsurer Panel ── */}
      <FormSection title="Reinsurer Panel">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Reinsurer Share (%)"
            type="number"
            registration={register('reinsurererShare', {
              required: 'Reinsurer share is required',
              min: { value: 0, message: 'Cannot be negative' },
              max: { value: 100, message: 'Cannot exceed 100%' },
              valueAsNumber: true,
            })}
            error={errors.reinsurererShare}
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
