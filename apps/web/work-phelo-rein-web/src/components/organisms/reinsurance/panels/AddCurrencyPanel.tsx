'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { CurrencyFormValues, CURRENCY_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateCurrency } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCurrencyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddCurrencyPanel({ isOpen, onClose }: AddCurrencyPanelProps) {
  const toast = useToast();
  const { mutateAsync: createCurrency, isPending } = useCreateCurrency();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CurrencyFormValues>({
    defaultValues: CURRENCY_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(CURRENCY_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: CurrencyFormValues) => {
    try {
      await createCurrency({
        name: data.name,
        isoCode: data.isoCode,
        symbol: data.symbol || undefined,
        exchangeRateToBase: 1,
        isBaseCurrency: false,
        isActive: true,
        displayOrder: 0,
      });
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
      description="Add a new currency."
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
          registration={register('isoCode', {
            required: 'ISO code is required',
            maxLength: { value: 3, message: 'ISO code must be 3 characters' },
            minLength: { value: 3, message: 'ISO code must be 3 characters' },
            setValueAs: (v: string) => v.toUpperCase(),
          })}
          error={errors.isoCode}
          placeholder="e.g. GHS"
        />

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
