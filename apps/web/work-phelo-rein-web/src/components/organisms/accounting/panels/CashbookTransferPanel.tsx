'use client';

import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCashAccountOptions, useCashAccounts, useCreateCashbookTransfer } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface CashbookTransferPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  cashAccountId: string;
  destinationCashAccountId: string;
  amount: number | '';
  currency: string;
  transactionDate: string;
  exchangeRate: string;
  reference: string;
  description: string;
};

const DEFAULTS: FormValues = {
  cashAccountId: '',
  destinationCashAccountId: '',
  amount: '',
  currency: '',
  transactionDate: new Date().toISOString().slice(0, 10),
  exchangeRate: '',
  reference: '',
  description: '',
};

export function CashbookTransferPanel({ isOpen, onClose }: CashbookTransferPanelProps) {
  const toast = useToast();
  const { mutateAsync: createTransfer, isPending } = useCreateCashbookTransfer();
  const { options: cashAccountOptions } = useCashAccountOptions();
  const { data: cashAccounts = [] } = useCashAccounts({ isActive: true });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const cashAccountId = useWatch({ control, name: 'cashAccountId' });
  const destinationCashAccountId = useWatch({ control, name: 'destinationCashAccountId' });

  // Default the transfer currency to the source account's own currency.
  useEffect(() => {
    const account = cashAccounts.find((a) => a.id === cashAccountId);
    if (account) setValue('currency', account.currency);
  }, [cashAccountId, cashAccounts, setValue]);

  const destinationOptions = cashAccountOptions.filter((o) => o.value !== cashAccountId);
  const sourceCurrency = cashAccounts.find((a) => a.id === cashAccountId)?.currency;
  const destinationCurrency = cashAccounts.find((a) => a.id === destinationCashAccountId)?.currency;
  const isCrossCurrency = Boolean(
    sourceCurrency && destinationCurrency && sourceCurrency !== destinationCurrency,
  );

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await createTransfer({
        cashAccountId: data.cashAccountId,
        destinationCashAccountId: data.destinationCashAccountId,
        amount: Number(data.amount),
        currency: data.currency,
        transactionDate: data.transactionDate,
        exchangeRate: data.exchangeRate.trim() ? Number(data.exchangeRate) : undefined,
        reference: data.reference || undefined,
        description: data.description,
      });
      toast.success('Transfer created as a draft.');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create transfer'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Cash/Bank Transfer"
      description="Move funds between two of the tenant's own cash/bank accounts."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Transfer
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Controller
          name="cashAccountId"
          control={control}
          rules={{ required: 'Source account is required' }}
          render={({ field }) => (
            <SearchSelect
              label="From Account"
              placeholder="Select source cash/bank account…"
              options={cashAccountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.cashAccountId?.message}
            />
          )}
        />

        <Controller
          name="destinationCashAccountId"
          control={control}
          rules={{ required: 'Destination account is required' }}
          render={({ field }) => (
            <SearchSelect
              label="To Account"
              placeholder="Select destination cash/bank account…"
              options={destinationOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.destinationCashAccountId?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Amount"
            type="number"
            step="0.01"
            registration={register('amount', {
              required: 'Amount is required',
              min: { value: 0.0001, message: 'Amount must be greater than 0' },
              valueAsNumber: true,
            })}
            error={errors.amount}
            placeholder="e.g. 1000"
          />
          <FormField
            label="Currency"
            registration={register('currency', {
              required: 'Currency is required',
              maxLength: { value: 3, message: 'Currency must be 3 characters' },
              minLength: { value: 3, message: 'Currency must be 3 characters' },
              setValueAs: (v: string) => v.toUpperCase(),
            })}
            error={errors.currency}
            placeholder="e.g. GHS"
          />
        </div>

        <FormField
          label="Transaction Date"
          type="date"
          registration={register('transactionDate', { required: 'Transaction date is required' })}
          error={errors.transactionDate}
        />

        {isCrossCurrency && (
          <FormField
            label={`Exchange Rate (${sourceCurrency} → ${destinationCurrency})`}
            type="number"
            step="0.00000001"
            registration={register('exchangeRate', {
              required: 'Exchange rate is required for cross-currency transfers',
            })}
            error={errors.exchangeRate}
            placeholder="Agreed rate — no live FX lookup is performed"
          />
        )}

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description', { required: 'Description is required' })}
          error={errors.description}
          placeholder="e.g. Transfer between Ecobank and mobile money wallet"
        />

        <FormField
          label="Reference"
          registration={register('reference')}
          error={errors.reference}
          placeholder="Optional reference"
        />
      </div>
    </SidePanel>
  );
}
