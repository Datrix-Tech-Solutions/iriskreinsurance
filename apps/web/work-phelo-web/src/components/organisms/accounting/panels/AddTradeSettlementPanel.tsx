'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingCashbookSettlementMethod, AccountingTradeSide } from '@/types/accounting';
import {
  useCashAccountOptions,
  useCreatePayablePayment,
  useCreateReceivableReceipt,
  useCustomers,
  useVendors,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddTradeSettlementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  side: AccountingTradeSide;
}

type FormValues = {
  partyId: string;
  cashAccountId: string;
  amount: number | '';
  currency: string;
  settlementDate: string;
  settlementMethod: AccountingCashbookSettlementMethod | '';
  reference: string;
  description: string;
};

const DEFAULTS: FormValues = {
  partyId: '',
  cashAccountId: '',
  amount: '',
  currency: '',
  settlementDate: new Date().toISOString().slice(0, 10),
  settlementMethod: '',
  reference: '',
  description: '',
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

export function AddTradeSettlementPanel({ isOpen, onClose, side }: AddTradeSettlementPanelProps) {
  const toast = useToast();
  const isReceivable = side === 'RECEIVABLE';
  const partyLabel = isReceivable ? 'Customer' : 'Vendor';
  const documentLabel = isReceivable ? 'Receipt' : 'Payment';

  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers();
  const { data: vendorsData, isLoading: isLoadingVendors } = useVendors();
  const parties = isReceivable ? (customersData?.items ?? []) : (vendorsData?.items ?? []);
  const partyOptions: SearchSelectOption[] = parties.map((p) => ({
    value: p.id,
    label: `${p.code} — ${p.legalName}`,
  }));

  const { options: cashAccountOptions, isLoading: isLoadingCashAccounts } = useCashAccountOptions();

  const createReceipt = useCreateReceivableReceipt();
  const createPayment = useCreatePayablePayment();
  const isPending = isReceivable ? createReceipt.isPending : createPayment.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    const payload = {
      partyId: data.partyId,
      cashAccountId: data.cashAccountId,
      amount: Number(data.amount),
      currency: data.currency,
      settlementDate: data.settlementDate,
      settlementMethod: data.settlementMethod as AccountingCashbookSettlementMethod,
      reference: data.reference || undefined,
      description: data.description || undefined,
    };

    try {
      if (isReceivable) {
        await createReceipt.mutateAsync(payload);
      } else {
        await createPayment.mutateAsync(payload);
      }
      toast.success(`${documentLabel} created as a draft.`);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, `Failed to create ${documentLabel.toLowerCase()}`));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={`New ${partyLabel} ${documentLabel}`}
      description={`Record money ${isReceivable ? 'received from' : 'paid to'} a ${partyLabel.toLowerCase()} through Cashbook.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save {documentLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Controller
          name="partyId"
          control={control}
          rules={{ required: `${partyLabel} is required` }}
          render={({ field }) => (
            <SearchSelect
              label={partyLabel}
              placeholder={
                (isReceivable ? isLoadingCustomers : isLoadingVendors)
                  ? 'Loading…'
                  : `Select ${partyLabel.toLowerCase()}…`
              }
              options={partyOptions}
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                const party = parties.find((p) => p.id === value);
                if (party) setValue('currency', party.currency);
              }}
              error={errors.partyId?.message}
            />
          )}
        />

        <Controller
          name="cashAccountId"
          control={control}
          rules={{ required: 'Cash/bank account is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Cash/Bank Account"
              placeholder={isLoadingCashAccounts ? 'Loading…' : 'Select cash/bank account…'}
              options={cashAccountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.cashAccountId?.message}
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
          label={`${documentLabel} Date`}
          type="date"
          registration={register('settlementDate', {
            required: `${documentLabel} date is required`,
          })}
          error={errors.settlementDate}
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

        <FormField
          label="Reference"
          registration={register('reference')}
          error={errors.reference}
          placeholder="Optional bank/cheque reference"
        />

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional"
        />
      </div>
    </SidePanel>
  );
}
