'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Facultative } from '@/types/reinsurance';
import { RecoveryRow, useAllReinsurerClaims, useCreateClaimRecoveryReceipt } from '@/hooks';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface RecordRecoveryValues {
  paymentType: string;
  chequeNumber: string;
  valueDate: string;
  paymentDate: string;
  amount: string;
  bankName: string;
}

const RECORD_RECOVERY_DEFAULTS: RecordRecoveryValues = {
  paymentType: '',
  chequeNumber: '',
  valueDate: '',
  paymentDate: '',
  amount: '',
  bankName: '',
};

const PAYMENT_TYPE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-700">
        {value || '-'}
      </div>
    </div>
  );
}

function RecordRecoveryReceiptModal({
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
    formState: { errors, isSubmitting },
  } = useForm<RecordRecoveryValues>({ defaultValues: RECORD_RECOVERY_DEFAULTS });

  const createReceipt = useCreateClaimRecoveryReceipt();
  const addToast = useToastStore((s) => s.addToast);
  const paymentType = useWatch({ control, name: 'paymentType' });

  useEffect(() => {
    if (row) {
      reset({
        ...RECORD_RECOVERY_DEFAULTS,
        amount: row.outstandingAmount > 0 ? String(row.outstandingAmount) : '',
      });
    }
  }, [row, reset]);

  const handleClose = () => {
    reset(RECORD_RECOVERY_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: RecordRecoveryValues) => {
    if (!row) return;
    try {
      const resolvedDate = values.paymentType === 'cheque' ? values.valueDate : values.paymentDate;
      const amount = Math.round((parseFloat(values.amount) || 0) * 100) / 100;
      const refParts = [values.chequeNumber, values.bankName].filter(Boolean);

      await createReceipt.mutateAsync({
        placementId: row.placementId,
        claimId: row.claimId,
        cashCallId: row.cashCallId,
        payload: {
          currency: row.currency,
          amount,
          paymentDate: new Date(resolvedDate).toISOString(),
          reference: refParts.join(' - ') || undefined,
          notes: values.bankName ? `Received via ${values.bankName}` : undefined,
        },
      });
      addToast({ message: 'Recovery receipt recorded', type: 'success' });
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={!!row}
      onClose={handleClose}
      title="Record Recovery Receipt"
      description={row ? `${row.cashCallNumber} - ${row.claimNumber}` : undefined}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="record-reinsurer-recovery-form" isLoading={isSubmitting}>
            Record Recovery
          </Button>
        </div>
      }
    >
      <form
        id="record-reinsurer-recovery-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem)"
      >
        {row && (
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Cash Call" value={row.cashCallNumber} />
            <ReadOnlyField label="Claim Number" value={row.claimNumber} />
            <ReadOnlyField label="Currency" value={row.currency} />
            <ReadOnlyField
              label="Outstanding Recovery"
              value={fmtAmount(row.outstandingAmount, row.currency)}
            />
          </div>
        )}

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

        {paymentType === 'cheque' && (
          <>
            <FormField
              label="Cheque Number"
              registration={register('chequeNumber', { required: 'Cheque number is required' })}
              placeholder="Enter cheque number..."
              error={errors.chequeNumber}
            />
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
          </>
        )}

        {paymentType === 'bank_transfer' && (
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
        )}

        {!!paymentType && (
          <>
            <FormField
              label="Bank Name"
              registration={register('bankName', { required: 'Bank name is required' })}
              placeholder="Enter bank name..."
              error={errors.bankName}
            />
            <FormField
              label="Amount Received"
              registration={register('amount', { required: 'Amount is required' })}
              placeholder="0.00"
              type="number"
              step="any"
              error={errors.amount}
            />
          </>
        )}
      </form>
    </SidePanel>
  );
}

interface ReinsurerRecoveriesTabProps {
  placements: Facultative[];
  reinsurerId: string;
}

export function ReinsurerRecoveriesTab({ placements, reinsurerId }: ReinsurerRecoveriesTabProps) {
  const { rows, isLoading } = useAllReinsurerClaims(placements);
  const canRecordRecovery = useAnyPermissionRules(RiPerm.recordRecovery);
  const [paymentRow, setPaymentRow] = useState<RecoveryRow | null>(null);

  const recoveryRows = useMemo(
    () => rows.filter((row) => row.reinsurerId === reinsurerId),
    [rows, reinsurerId],
  );

  const columns: Column<RecoveryRow>[] = [
    {
      key: 'policyNumber',
      label: 'Policy',
      width: 'minmax(130px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.policyNumber}</span>,
    },
    {
      key: 'claimNumber',
      label: 'Claim',
      width: '120px',
      render: (row) => <span className="text-gray-700">{row.claimNumber}</span>,
    },

    {
      key: 'occurrenceDate',
      label: 'Occurrence Date',
      width: '120px',
      render: (row) => <span className="text-gray-700">{fmtDate(row.occurrenceDate)}</span>,
    },
    {
      key: 'calledAmount',
      label: 'Recovery Amount',
      width: '140px',
      render: (row) => (
        <span className="font-medium text-gray-900 block">
          {fmtAmount(row.calledAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'recoveredAmount',
      label: 'Recovered',
      width: '140px',
      render: (row) => (
        <span className="text-gray-700 block">{fmtAmount(row.recoveredAmount, row.currency)}</span>
      ),
    },
    {
      key: 'outstandingAmount',
      label: 'Outstanding',
      width: '140px',
      render: (row) => (
        <span
          className={`font-medium ${
            row.outstandingAmount > 0 ? 'text-orange-600' : 'text-gray-900'
          }`}
        >
          {fmtAmount(row.outstandingAmount, row.currency)}
        </span>
      ),
    },
    ...(canRecordRecovery
      ? [
          {
            key: 'actions',
            label: 'Actions',
            width: '130px',
            render: (row: RecoveryRow) => (
              <TableButton
                variant={
                  row.outstandingAmount > 0 && row.cashCallStatus === 'ISSUED' ? 'blue' : 'gray'
                }
                disabled={row.outstandingAmount <= 0 || row.cashCallStatus !== 'ISSUED'}
                tooltip={
                  row.cashCallStatus === 'ISSUED'
                    ? undefined
                    : 'Only issued cash calls can receive recovery receipts.'
                }
                onClick={() => setPaymentRow(row)}
              >
                Record Recovery
              </TableButton>
            ),
          } as Column<RecoveryRow>,
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={recoveryRows}
        emptyMessage={isLoading ? 'Loading...' : 'No cash-call recoveries for this reinsurer yet'}
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      <RecordRecoveryReceiptModal row={paymentRow} onClose={() => setPaymentRow(null)} />
    </>
  );
}
