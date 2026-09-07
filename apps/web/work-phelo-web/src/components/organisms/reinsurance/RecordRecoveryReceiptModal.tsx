'use client';

import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { NumberField } from '@/components/atoms/NumberField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  useCreateClaimRecoveryReceipt,
  useConfirmClaimRecoveryReceiptBank,
  useCurrencyOptions,
  RecoveryRow,
} from '@/hooks';
import { DetailField } from '@/components/atoms/DetailField';
import { extractError } from '@/lib/extractError';
import { cardClass, cn, inputClass } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import { PlacementSettlementMethod } from '@/types/reinsurance';

interface RecordPaymentValues {
  mode: string;
  paymentType: string;
  chequeNumber: string;
  valueDate: string;
  paymentDate: string;
  amount: string;
  bankName: string;
  currency: string;
  rate: string;
  notes: string;
}

const RECORD_PAYMENT_DEFAULTS: RecordPaymentValues = {
  mode: '',
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  paymentDate: '',
  amount: '',
  bankName: '',
  currency: '',
  rate: '',
  notes: '',
};

const MODE_OPTIONS = [
  { value: 'broker', label: 'Through Broker' },
  { value: 'cedant', label: 'Direct to Cedant' },
  { value: 'offset', label: 'Offset Claim' },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RecordRecoveryReceiptModal({
  row,
  onClose,
}: {
  row: RecoveryRow | null;
  onClose: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentValues>({
    defaultValues: RECORD_PAYMENT_DEFAULTS,
    shouldUnregister: true,
  });

  const createReceipt = useCreateClaimRecoveryReceipt();
  const confirmReceiptBank = useConfirmClaimRecoveryReceiptBank();
  const addToast = useToastStore((s) => s.addToast);

  const mode = useWatch({ control, name: 'mode' });
  const paymentType = useWatch({ control, name: 'paymentType' });
  const directCurrency = useWatch({ control, name: 'currency' });
  const { data: currencyOptions = [] } = useCurrencyOptions();
  const isDirectEntry = mode === 'cedant' || mode === 'offset';

  const showRate =
    isDirectEntry && !!directCurrency && !!row?.currency && directCurrency !== row.currency;

  useEffect(() => {
    if (!showRate) setValue('rate', '');
  }, [showRate, setValue]);

  useEffect(() => {
    if (row) {
      reset({
        ...RECORD_PAYMENT_DEFAULTS,
        amount: row.outstandingAmount > 0 ? String(row.outstandingAmount) : '',
        currency: row.currency,
      });
    }
  }, [row, reset]);

  const handleClose = () => {
    reset(RECORD_PAYMENT_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: RecordPaymentValues) => {
    if (!row) {
      addToast({ message: 'No cash call selected — please reopen this panel.', type: 'error' });
      return;
    }
    try {
      const amount = Math.round((parseFloat(values.amount) || 0) * 100) / 100;
      const isDirectEntry = values.mode === 'cedant' || values.mode === 'offset';
      const notes = (values.notes ?? '').trim() || undefined;

      let confirmedAt: string;
      let settlementMethod: PlacementSettlementMethod;
      let confirmNotes: string | undefined;
      let newReceipt;

      if (isDirectEntry) {
        const needsConversion = values.currency !== row.currency;
        const convertedAmount = needsConversion
          ? Math.round(amount * (parseFloat(values.rate) || 1) * 100) / 100
          : amount;

        newReceipt = await createReceipt.mutateAsync({
          placementId: row.placementId,
          claimId: row.claimId,
          cashCallId: row.cashCallId,
          payload: {
            amount: convertedAmount,
            currency: row.currency,
            paymentDate: new Date(values.paymentDate).toISOString(),
            notes,
          },
        });
        confirmedAt = new Date(values.paymentDate).toISOString();

        settlementMethod = values.mode === 'cedant' ? 'OTHER' : 'INTERNAL_OFFSET';
        // OTHER settlement (direct-to-cedant) needs a reference or confirmation notes —
        // there's no reference in this branch. Notes are optional in the form, so fall
        // back to a default note when left blank to satisfy that backend requirement.
        confirmNotes = values.mode === 'cedant' ? (notes ?? 'Direct to cedant') : undefined;
      } else {
        const resolvedDate =
          values.paymentType === 'cheque' ? values.valueDate : values.paymentDate;
        const refParts: string[] = [];
        if (values.chequeNumber) refParts.push(values.chequeNumber);
        if (values.bankName) refParts.push(values.bankName);

        newReceipt = await createReceipt.mutateAsync({
          placementId: row.placementId,
          claimId: row.claimId,
          cashCallId: row.cashCallId,
          payload: {
            amount,
            currency: row.currency,
            paymentDate: new Date(resolvedDate).toISOString(),
            reference: refParts.join(' - ') || undefined,
            notes,
          },
        });
        confirmedAt = new Date(resolvedDate).toISOString();
        settlementMethod = values.paymentType === 'cheque' ? 'CHEQUE' : 'BANK_TRANSFER';
      }

      addToast({ message: 'Recovery receipt recorded', type: 'success' });

      try {
        await confirmReceiptBank.mutateAsync({
          placementId: row.placementId,
          claimId: row.claimId,
          receiptId: newReceipt.id,
          bankConfirmedAt: confirmedAt,
          settlementMethod,
          notes: confirmNotes,
        });
      } catch (confirmError) {
        addToast({
          message: `Recorded, but confirming it failed: ${extractError(confirmError)} — confirm it from the History tab.`,
          type: 'error',
        });
      }

      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const chequeFields = paymentType === 'cheque' && (
    <>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <FormField
            label="Cheque Number"
            registration={register('chequeNumber', { required: 'Cheque number is required' })}
            placeholder="Enter cheque number..."
            error={errors.chequeNumber}
          />
        </div>
        <div className="col-span-2">
          <Controller
            name="valueDate"
            control={control}
            rules={{ required: 'Value date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Value Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.valueDate?.message}
                size="sm"
              />
            )}
          />
        </div>
      </div>

      <FormField
        label="Bank Name"
        registration={register('bankName', { required: 'Bank name is required' })}
        placeholder="Enter bank name..."
        error={errors.bankName}
      />

      <Controller
        name="amount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <NumberField
            label="Amount Received"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(n ? String(n) : '')}
            error={errors.amount?.message}
          />
        )}
      />
    </>
  );

  const bankFields = paymentType === 'bank_transfer' && (
    <>
      <Controller
        name="paymentDate"
        control={control}
        rules={{ required: 'Payment date is required' }}
        render={({ field }) => (
          <DatePicker
            label="Payment Date"
            value={field.value}
            onChange={field.onChange}
            error={errors.paymentDate?.message}
            size="sm"
          />
        )}
      />

      <FormField
        label="Bank Name"
        registration={register('bankName', { required: 'Bank name is required' })}
        placeholder="Enter bank name..."
        error={errors.bankName}
      />

      <Controller
        name="amount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <NumberField
            label="Amount Received"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(n ? String(n) : '')}
            error={errors.amount?.message}
          />
        )}
      />
    </>
  );

  const directEntryFields = isDirectEntry && (
    <>
      <div className={showRate ? 'grid grid-cols-2 gap-4' : ''}>
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency..."
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
              size="sm"
            />
          )}
        />
        {showRate && (
          <Controller
            name="rate"
            control={control}
            rules={{ min: { value: 0.000001, message: 'Rate is required' } }}
            render={({ field }) => (
              <NumberField
                label={`Rate to ${row?.currency ?? ''}`}
                value={field.value ? Number(field.value) : 0}
                onChange={(n) => field.onChange(String(n))}
                error={errors.rate?.message}
                placeholder="0.00"
              />
            )}
          />
        )}
      </div>
      <Controller
        name="amount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <NumberField
            label="Amount"
            value={field.value ? Number(field.value) : 0}
            onChange={(n) => field.onChange(n ? String(n) : '')}
            error={errors.amount?.message}
          />
        )}
      />
      <Controller
        name="paymentDate"
        control={control}
        rules={{ required: 'Date of payment is required' }}
        render={({ field }) => (
          <DatePicker
            label="Date of Payment"
            value={field.value}
            onChange={field.onChange}
            error={errors.paymentDate?.message}
            size="sm"
          />
        )}
      />
    </>
  );

  return (
    <SidePanel
      isOpen={!!row}
      onClose={handleClose}
      title="Record Recovery Receipt"
      description={row ? `${row.reinsurerName} - ${row.claimNumber}` : undefined}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              handleSubmit(onSubmit, (formErrors) => {
                const [firstError] = Object.values(formErrors);
                addToast({
                  message: firstError?.message ?? 'Please check the form and try again.',
                  type: 'error',
                });
              })().catch((error) => {
                addToast({ message: extractError(error), type: 'error' });
              });
            }}
            isLoading={isSubmitting}
          >
            Record Recovery
          </Button>
        </div>
      }
    >
      {row && (
        <div className={cardClass('flex flex-col gap-2 p-4 mt-5')}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
            <span className="font-medium text-gray-900">{row.policyNumber}</span>
            <span className="text-gray-300">·</span>
            <span>{row.insuredTitle}</span>
            <span className="text-gray-300">·</span>
            <span>{row.riskType ?? '—'}</span>
            <span className="text-gray-300">·</span>
            <span>{row.reinsurerName}</span>
            <span className="text-gray-300">·</span>
            <span>{row.claimNumber}</span>
            <span className="text-gray-300">·</span>
            <span>{row.cashCallNumber}</span>
            <span className="text-gray-300">·</span>
            <span>{row.currency}</span>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <DetailField
              horizontal
              label="Outstanding Recovery"
              value={
                <span className="font-semibold text-gray-900">
                  {fmtAmount(row.outstandingAmount, row.currency)}
                </span>
              }
            />
          </div>
        </div>
      )}

      <Controller
        name="mode"
        control={control}
        rules={{ required: 'Mode of payment is required' }}
        render={({ field }) => (
          <SearchSelect
            label="Mode of Payment"
            placeholder="Select mode of payment..."
            options={MODE_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={errors.mode?.message}
            size="sm"
          />
        )}
      />

      {mode === 'broker' && (
        <Controller
          name="paymentType"
          control={control}
          rules={{ required: 'Payment type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Payment Type"
              placeholder="Select payment type..."
              options={PAYMENT_TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.paymentType?.message}
              size="sm"
            />
          )}
        />
      )}

      {chequeFields}
      {bankFields}
      {directEntryFields}

      {mode && (
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Notes (optional)</label>
          <textarea
            {...register('notes')}
            placeholder="Add any notes about this recovery…"
            rows={3}
            className={cn(inputClass(), 'resize-none')}
          />
          {errors.notes && <p className="text-xs text-red-500">{errors.notes.message}</p>}
        </div>
      )}
    </SidePanel>
  );
}
