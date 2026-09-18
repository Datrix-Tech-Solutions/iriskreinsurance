'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { Currency, CurrencyFormValues, CURRENCY_FORM_DEFAULTS } from '@/types/reinsurance';
import { useUpdateCurrency } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { inputClass } from '@/lib/utils';

interface EditCurrencyPanelProps {
  currency: Currency | null;
  onClose: () => void;
}

function toFormValues(c: Currency): CurrencyFormValues {
  return {
    name: c.name,
    isoCode: c.isoCode,
    symbol: c.symbol ?? '',
  };
}

export function EditCurrencyPanel({ currency, onClose }: EditCurrencyPanelProps) {
  const toast = useToast();
  const { mutateAsync: updateCurrency, isPending } = useUpdateCurrency();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CurrencyFormValues>({ defaultValues: CURRENCY_FORM_DEFAULTS });

  useEffect(() => {
    if (currency) reset(toFormValues(currency));
  }, [currency, reset]);

  const handleClose = () => {
    reset(CURRENCY_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: CurrencyFormValues) => {
    if (!currency) return;
    try {
      await updateCurrency({
        id: currency.id,
        name: data.name,
        symbol: data.symbol || undefined,
      });
      toast.success('Currency updated successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update currency'));
    }
  };

  return (
    <SidePanel
      isOpen={!!currency}
      onClose={handleClose}
      title="Update Currency"
      description="Update the details for this currency."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <FormField
          label="Currency Name"
          registration={register('name', { required: 'Currency name is required' })}
          error={errors.name}
          placeholder="e.g. Ghana Cedi"
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">ISO Code</label>
          <div
            className={inputClass(undefined, 'bg-gray-50 text-gray-500 cursor-default select-none')}
          >
            {currency?.isoCode}
          </div>
          <p className="text-xs text-gray-400">ISO code cannot be changed after creation.</p>
        </div>

        {/* <FormField
          label="Symbol"
          registration={register('symbol')}
          error={errors.symbol}
          placeholder="e.g. ₵"
        /> */}
      </div>
    </SidePanel>
  );
}
