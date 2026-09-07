'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useAccountingConfig,
  useCreateAccountingCurrency,
  useCreateExchangeRate,
  useUpdateAccountingConfig,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCurrencyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormValues {
  name: string;
  code: string;
  symbol: string;
  isBaseCurrency: boolean;
  rate: number | '';
}

const DEFAULTS: FormValues = {
  name: '',
  code: '',
  symbol: '',
  isBaseCurrency: false,
  rate: '',
};

export function AddCurrencyPanel({ isOpen, onClose }: AddCurrencyPanelProps) {
  const toast = useToast();
  const { data: config } = useAccountingConfig();
  const { mutateAsync: createCurrency, isPending: isCreatingCurrency } =
    useCreateAccountingCurrency();
  const { mutateAsync: updateConfig, isPending: isSettingBase } = useUpdateAccountingConfig();
  const { mutateAsync: createExchangeRate, isPending: isSettingRate } = useCreateExchangeRate();
  const isPending = isCreatingCurrency || isSettingBase || isSettingRate;

  const hasBaseCurrency = !!config?.baseCurrency;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const isBaseCurrency = useWatch({ control, name: 'isBaseCurrency' });

  // No base currency configured yet — the first currency added must become it.
  useEffect(() => {
    if (!hasBaseCurrency) setValue('isBaseCurrency', true);
  }, [hasBaseCurrency, setValue]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const currency = await createCurrency({
        code: data.code,
        name: data.name,
        symbol: data.symbol || undefined,
      });

      if (data.isBaseCurrency) {
        await updateConfig({ baseCurrency: currency.code });
      } else if (config?.baseCurrency) {
        await createExchangeRate({
          fromCurrency: currency.code,
          toCurrency: config.baseCurrency,
          rate: Number(data.rate),
          effectiveAt: new Date().toISOString(),
        });
      }

      toast.success('Currency created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create currency'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Currency"
      description="Add a new currency and set its exchange rate."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Currency
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Currency Name"
          registration={register('name', { required: 'Currency name is required' })}
          error={errors.name}
          placeholder="e.g. Ghana Cedi"
        />

        <FormField
          label="ISO Code"
          registration={register('code', {
            required: 'ISO code is required',
            maxLength: { value: 3, message: 'ISO code must be 3 characters' },
            minLength: { value: 3, message: 'ISO code must be 3 characters' },
            setValueAs: (v: string) => v.toUpperCase(),
          })}
          error={errors.code}
          placeholder="e.g. GHS"
        />

        <FormField
          label="Symbol"
          registration={register('symbol')}
          error={errors.symbol}
          placeholder="e.g. ₵"
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isBaseCurrency"
            {...register('isBaseCurrency')}
            disabled={!hasBaseCurrency}
            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 disabled:opacity-60"
          />
          <label htmlFor="isBaseCurrency" className="text-sm text-gray-700">
            Set as base currency
          </label>
        </div>
        {!hasBaseCurrency && (
          <p className="-mt-3 text-xs text-gray-400">
            No base currency is configured yet, so this currency will become the Accounting base
            currency.
          </p>
        )}

        {!isBaseCurrency && (
          <FormField
            label={`Exchange Rate to ${config?.baseCurrency ?? 'Base Currency'}`}
            type="number"
            registration={register('rate', {
              required: 'Exchange rate is required',
              min: { value: 0.000001, message: 'Rate must be greater than 0' },
              valueAsNumber: true,
            })}
            error={errors.rate}
            placeholder="e.g. 16.5"
          />
        )}
      </div>
    </SidePanel>
  );
}
