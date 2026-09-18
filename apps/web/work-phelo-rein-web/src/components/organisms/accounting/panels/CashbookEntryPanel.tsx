'use client';

import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingCashbookSettlementMethod } from '@/types/accounting';
import {
  useCashAccountOptions,
  useCashAccounts,
  useCreateCashbookAdjustment,
  useCreateCashbookCharge,
  useCreateCashbookPayment,
  useCreateCashbookReceipt,
  useGLAccountOptions,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type EntryType = 'RECEIPT' | 'PAYMENT' | 'CHARGE' | 'ADJUSTMENT';

interface CashbookEntryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactionType: EntryType;
}

type FormValues = {
  cashAccountId: string;
  amount: number | '';
  currency: string;
  transactionDate: string;
  settlementMethod: AccountingCashbookSettlementMethod | '';
  reference: string;
  counterpartyType: string;
  counterpartyId: string;
  description: string;
  offsetGlAccountId: string;
  exchangeRate: string;
  direction: 'INFLOW' | 'OUTFLOW' | '';
};

const DEFAULTS: FormValues = {
  cashAccountId: '',
  amount: '',
  currency: '',
  transactionDate: new Date().toISOString().slice(0, 10),
  settlementMethod: '',
  reference: '',
  counterpartyType: '',
  counterpartyId: '',
  description: '',
  offsetGlAccountId: '',
  exchangeRate: '',
  direction: 'INFLOW',
};

const SETTLEMENT_METHOD_OPTIONS: SearchSelectOption[] = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'INTERNAL_TRANSFER', label: 'Internal Transfer' },
  { value: 'JOURNAL', label: 'Journal' },
  { value: 'OTHER', label: 'Other' },
];

const DIRECTION_OPTIONS: SearchSelectOption[] = [
  { value: 'INFLOW', label: 'Inflow (increases the account)' },
  { value: 'OUTFLOW', label: 'Outflow (reduces the account)' },
];

const COPY: Record<
  EntryType,
  { title: string; description: string; submitLabel: string; offsetLabel: string }
> = {
  RECEIPT: {
    title: 'New Cashbook Receipt',
    description: 'Record money received directly into a cash/bank account.',
    submitLabel: 'Save Receipt',
    offsetLabel: 'Offset Account (Credited)',
  },
  PAYMENT: {
    title: 'New Cashbook Payment',
    description: 'Record money paid out directly from a cash/bank account.',
    submitLabel: 'Save Payment',
    offsetLabel: 'Offset Account (Debited)',
  },
  CHARGE: {
    title: 'New Bank Charge',
    description: 'Record a bank fee or charge against a cash/bank account.',
    submitLabel: 'Save Charge',
    offsetLabel: 'Expense Account (Debited)',
  },
  ADJUSTMENT: {
    title: 'New Cashbook Adjustment',
    description: 'Correct a cash/bank account balance with a manual inflow or outflow adjustment.',
    submitLabel: 'Save Adjustment',
    offsetLabel: 'Offset Account',
  },
};

export function CashbookEntryPanel({ isOpen, onClose, transactionType }: CashbookEntryPanelProps) {
  const toast = useToast();
  const copy = COPY[transactionType];

  const createReceipt = useCreateCashbookReceipt();
  const createPayment = useCreateCashbookPayment();
  const createCharge = useCreateCashbookCharge();
  const createAdjustment = useCreateCashbookAdjustment();
  const isPending =
    createReceipt.isPending ||
    createPayment.isPending ||
    createCharge.isPending ||
    createAdjustment.isPending;

  const { options: cashAccountOptions } = useCashAccountOptions();
  const { data: cashAccounts = [] } = useCashAccounts({ isActive: true });
  const { options: glAccountOptions, isLoading: isLoadingGLAccounts } = useGLAccountOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const cashAccountId = useWatch({ control, name: 'cashAccountId' });

  // Default the transaction currency to the selected cash account's own currency.
  useEffect(() => {
    const account = cashAccounts.find((a) => a.id === cashAccountId);
    if (account) setValue('currency', account.currency);
  }, [cashAccountId, cashAccounts, setValue]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    const basePayload = {
      cashAccountId: data.cashAccountId,
      amount: Number(data.amount),
      currency: data.currency,
      transactionDate: data.transactionDate,
      settlementMethod: data.settlementMethod as AccountingCashbookSettlementMethod,
      reference: data.reference || undefined,
      counterpartyType: data.counterpartyType || undefined,
      counterpartyId: data.counterpartyId || undefined,
      description: data.description,
      offsetGlAccountId: data.offsetGlAccountId,
      exchangeRate: data.exchangeRate.trim() ? Number(data.exchangeRate) : undefined,
    };

    try {
      if (transactionType === 'RECEIPT') {
        await createReceipt.mutateAsync(basePayload);
      } else if (transactionType === 'PAYMENT') {
        await createPayment.mutateAsync(basePayload);
      } else if (transactionType === 'CHARGE') {
        await createCharge.mutateAsync(basePayload);
      } else {
        await createAdjustment.mutateAsync({
          ...basePayload,
          direction: data.direction as 'INFLOW' | 'OUTFLOW',
        });
      }
      toast.success(`${copy.title.replace('New ', '')} created as a draft.`);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, `Failed to create ${transactionType.toLowerCase()}`));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={copy.title}
      description={copy.description}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {copy.submitLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Controller
          name="cashAccountId"
          control={control}
          rules={{ required: 'Cash/bank account is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Cash/Bank Account"
              placeholder="Select cash/bank account…"
              options={cashAccountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.cashAccountId?.message}
            />
          )}
        />

        {transactionType === 'ADJUSTMENT' && (
          <Controller
            name="direction"
            control={control}
            rules={{ required: 'Direction is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Direction"
                options={DIRECTION_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.direction?.message}
              />
            )}
          />
        )}

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

        <Controller
          name="settlementMethod"
          control={control}
          rules={{ required: 'Settlement method is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Settlement Method"
              placeholder="Select settlement method…"
              options={SETTLEMENT_METHOD_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.settlementMethod?.message}
            />
          )}
        />

        <Controller
          name="offsetGlAccountId"
          control={control}
          rules={{ required: 'Offset account is required' }}
          render={({ field }) => (
            <SearchSelect
              label={copy.offsetLabel}
              placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select GL account…'}
              options={glAccountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.offsetGlAccountId?.message}
            />
          )}
        />

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description', { required: 'Description is required' })}
          error={errors.description}
          placeholder="What is this transaction for?"
        />

        <FormField
          label="Reference"
          registration={register('reference')}
          error={errors.reference}
          placeholder="Optional bank/cheque reference"
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Counterparty Type"
            registration={register('counterpartyType')}
            error={errors.counterpartyType}
            placeholder="Optional, e.g. CUSTOMER"
          />
          <FormField
            label="Counterparty ID"
            registration={register('counterpartyId')}
            error={errors.counterpartyId}
            placeholder="Optional"
          />
        </div>

        <FormField
          label="Exchange Rate"
          type="number"
          step="0.00000001"
          registration={register('exchangeRate')}
          error={errors.exchangeRate}
          placeholder="Optional, only if currency differs from base currency"
        />
      </div>
    </SidePanel>
  );
}
