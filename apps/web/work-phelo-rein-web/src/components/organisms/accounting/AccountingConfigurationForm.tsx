'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  useAccountingConfig,
  useAccountingCurrencyOptions,
  useGLAccountOptions,
  useUpdateAccountingConfig,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';

interface FormValues {
  baseCurrency: string;
  fiscalYearStartMonth: number;
  decimalPlaces: number;
  accountsReceivableControlAccountId: string;
  accountsPayableControlAccountId: string;
}

const DEFAULTS: FormValues = {
  baseCurrency: '',
  fiscalYearStartMonth: 1,
  decimalPlaces: 2,
  accountsReceivableControlAccountId: '',
  accountsPayableControlAccountId: '',
};

export function AccountingConfigurationForm() {
  const toast = useToast();
  const { data: config, isLoading } = useAccountingConfig();
  const { options: currencyOptions, isLoading: isLoadingCurrencies } =
    useAccountingCurrencyOptions();
  const { options: receivableAccountOptions, isLoading: isLoadingReceivableAccounts } =
    useGLAccountOptions({ category: 'ASSET' });
  const { options: payableAccountOptions, isLoading: isLoadingPayableAccounts } =
    useGLAccountOptions({ category: 'LIABILITY' });
  const { mutateAsync: updateConfig, isPending } = useUpdateAccountingConfig();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (!config) return;
    reset({
      baseCurrency: config.baseCurrency ?? '',
      fiscalYearStartMonth: config.fiscalYearStartMonth,
      decimalPlaces: config.decimalPlaces,
      accountsReceivableControlAccountId: config.accountsReceivableControlAccountId ?? '',
      accountsPayableControlAccountId: config.accountsPayableControlAccountId ?? '',
    });
  }, [config, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      await updateConfig({
        baseCurrency: values.baseCurrency,
        fiscalYearStartMonth: Number(values.fiscalYearStartMonth),
        decimalPlaces: Number(values.decimalPlaces),
        ...(values.accountsReceivableControlAccountId
          ? { accountsReceivableControlAccountId: values.accountsReceivableControlAccountId }
          : {}),
        ...(values.accountsPayableControlAccountId
          ? { accountsPayableControlAccountId: values.accountsPayableControlAccountId }
          : {}),
      });
      toast.success('Accounting configuration saved');
    } catch (error) {
      toast.error(extractError(error, 'Unable to save Accounting configuration'));
    }
  };

  return (
    <form className="flex max-w-3xl flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <h2 className="text-base font-semibold text-gray-900">Accounting Configuration</h2>
        <p className="mt-1 text-sm text-gray-600">
          Set the tenant defaults used for fiscal periods, currency precision, and standalone AR/AP.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="baseCurrency"
          control={control}
          rules={{ required: 'Base currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Base Currency"
              placeholder={isLoadingCurrencies ? 'Loading currencies…' : 'Select base currency'}
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.baseCurrency?.message}
            />
          )}
        />
        <FormField
          label="Fiscal Year Start Month"
          type="number"
          registration={register('fiscalYearStartMonth', {
            required: 'Fiscal year start month is required',
            valueAsNumber: true,
            min: { value: 1, message: 'Enter a month from 1 to 12' },
            max: { value: 12, message: 'Enter a month from 1 to 12' },
          })}
          error={errors.fiscalYearStartMonth}
        />
        <FormField
          label="Decimal Places"
          type="number"
          registration={register('decimalPlaces', {
            required: 'Decimal places is required',
            valueAsNumber: true,
            min: { value: 0, message: 'Enter a value from 0 to 4' },
            max: { value: 4, message: 'Enter a value from 0 to 4' },
          })}
          error={errors.decimalPlaces}
        />
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900">Standalone control accounts</h3>
        <p className="mt-1 text-sm text-gray-600">
          These accounts are used for standalone customer and vendor documents.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Controller
            name="accountsReceivableControlAccountId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Accounts Receivable Control Account"
                placeholder={
                  isLoadingReceivableAccounts ? 'Loading asset accounts…' : 'Select asset account'
                }
                options={receivableAccountOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="accountsPayableControlAccountId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Accounts Payable Control Account"
                placeholder={
                  isLoadingPayableAccounts
                    ? 'Loading liability accounts…'
                    : 'Select liability account'
                }
                options={payableAccountOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isPending} loadingText="Saving…" disabled={isLoading}>
          Save Configuration
        </Button>
      </div>
    </form>
  );
}
