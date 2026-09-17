'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { FormSection } from '@/components/atoms/FormSection';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { InvoiceFormValues } from '@/types/accounting';

// TODO: populate from currencies API
const CURRENCY_OPTIONS: SearchSelectOption[] = [
  { value: 'GHS', label: 'Ghana Cedi (GHS)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
];

interface InvoiceDetailsSectionProps {
  form: UseFormReturn<InvoiceFormValues>;
  vendorLabel?: string;
  /** Real customer/vendor records to pick from — the backend keys invoices/bills
   * to a party id, not a free-text name. */
  partyOptions: SearchSelectOption[];
  isLoadingParties?: boolean;
}

export function InvoiceDetailsSection({
  form,
  vendorLabel = 'Vendor',
  partyOptions,
  isLoadingParties,
}: InvoiceDetailsSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <FormSection title="Entry Details">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Controller
          name="vendor"
          control={control}
          rules={{ required: `${vendorLabel} is required` }}
          render={({ field }) => (
            <SearchSelect
              label={vendorLabel}
              placeholder={isLoadingParties ? 'Loading…' : `Select ${vendorLabel.toLowerCase()}…`}
              options={partyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.vendor?.message}
            />
          )}
        />

        <FormField
          label="Reference Number"
          registration={register('invoiceNumber')}
          error={errors.invoiceNumber}
          placeholder="Optional — the posted document number is generated automatically"
        />

        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={CURRENCY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="invoiceDate"
          control={control}
          rules={{ required: 'Invoice date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Invoice Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.invoiceDate?.message}
            />
          )}
        />
        <Controller
          name="dueDate"
          control={control}
          rules={{ required: 'Due date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Due Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.dueDate?.message}
            />
          )}
        />
      </div>

      <FormField
        label="Description"
        type="textarea"
        rows={3}
        registration={register('description')}
        error={errors.description}
        placeholder="Provide a brief description of this invoice…"
      />
    </FormSection>
  );
}
