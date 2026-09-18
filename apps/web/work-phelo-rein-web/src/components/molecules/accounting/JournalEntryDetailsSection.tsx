'use client';

import { useEffect } from 'react';
import { Controller, useWatch, UseFormReturn } from 'react-hook-form';
import { FormSection } from '@/components/atoms/FormSection';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { JournalEntryFormValues } from '@/types/accounting';
import { useAccountingConfig, useAccountingCurrencyOptions, useFiscalPeriods } from '@/hooks';
import { cn } from '@/lib/utils';

interface JournalEntryDetailsSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
}

export function JournalEntryDetailsSection({ form }: JournalEntryDetailsSectionProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const { options: currencyOptions } = useAccountingCurrencyOptions();
  const { data: config } = useAccountingConfig();
  const { data: openPeriods = [] } = useFiscalPeriods({ status: 'OPEN' });

  const transactionDate = useWatch({ control, name: 'transactionDate' });
  const currency = useWatch({ control, name: 'currency' });

  const matchedPeriod = transactionDate
    ? openPeriods.find((p) => {
        const date = new Date(transactionDate).getTime();
        return date >= new Date(p.startDate).getTime() && date <= new Date(p.endDate).getTime();
      })
    : undefined;

  useEffect(() => {
    setValue('fiscalPeriodId', matchedPeriod?.id ?? '');
  }, [matchedPeriod, setValue]);

  const needsExchangeRate =
    !!currency && !!config?.baseCurrency && currency !== config.baseCurrency;

  return (
    <FormSection title="Entry Details">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <Controller
            name="transactionDate"
            control={control}
            rules={{ required: 'Transaction date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Transaction Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.transactionDate?.message}
              />
            )}
          />
          {transactionDate && (
            <p className={cn('text-xs', matchedPeriod ? 'text-gray-400' : 'text-red-500')}>
              {matchedPeriod
                ? `Fiscal Period: ${matchedPeriod.name}`
                : 'No open fiscal period covers this date'}
            </p>
          )}
        </div>

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

        <FormField
          label="Reference Number"
          registration={register('reference', { required: 'Reference is required' })}
          error={errors.reference}
          placeholder="e.g. JE-2025-001"
        />
      </div>

      {needsExchangeRate && (
        <FormField
          label={`Exchange Rate to ${config?.baseCurrency}`}
          type="number"
          registration={register('exchangeRate', {
            valueAsNumber: true,
            required: 'Exchange rate is required',
            min: { value: 0.00000001, message: 'Rate must be greater than 0' },
          })}
          error={errors.exchangeRate}
          placeholder="e.g. 16.5"
        />
      )}

      <FormField
        label="Description"
        type="textarea"
        rows={3}
        registration={register('description', { required: 'Description is required' })}
        error={errors.description}
        placeholder="Provide a brief description of this journal entry…"
      />
    </FormSection>
  );
}
