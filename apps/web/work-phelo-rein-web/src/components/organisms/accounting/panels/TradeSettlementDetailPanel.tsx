'use client';

import { useState, ChangeEvent } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import {
  AccountingTradeDocumentStatus,
  AccountingTradeSettlement,
  AccountingTradeSide,
} from '@/types/accounting';
import {
  useAllocatePayablePayment,
  useAllocateReceivableReceipt,
  usePayableBills,
  usePayablePaymentAllocations,
  usePostPayablePayment,
  usePostReceivableReceipt,
  useReceivableInvoices,
  useReceivableReceiptAllocations,
  useReversePayableAllocation,
  useReversePayablePayment,
  useReverseReceivableAllocation,
  useReverseReceivableReceipt,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface TradeSettlementDetailPanelProps {
  side: AccountingTradeSide;
  settlement: AccountingTradeSettlement | null;
  onClose: () => void;
}

const STATUS_VARIANT: Record<AccountingTradeDocumentStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

type AllocateFormValues = {
  documentId: string;
  amount: number | '';
};

export function TradeSettlementDetailPanel({
  side,
  settlement,
  onClose,
}: TradeSettlementDetailPanelProps) {
  const toast = useToast();
  const isReceivable = side === 'RECEIVABLE';
  const documentLabel = isReceivable ? 'Receipt' : 'Payment';

  const [reverseOpen, setReverseOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [allocateOpen, setAllocateOpen] = useState(false);

  const postReceipt = usePostReceivableReceipt();
  const postPayment = usePostPayablePayment();
  const reverseReceipt = useReverseReceivableReceipt();
  const reversePayment = useReversePayablePayment();
  const post = isReceivable ? postReceipt : postPayment;
  const reverse = isReceivable ? reverseReceipt : reversePayment;

  const receivableAllocations = useReceivableReceiptAllocations(
    isReceivable ? settlement?.id : undefined,
  );
  const payableAllocations = usePayablePaymentAllocations(
    !isReceivable ? settlement?.id : undefined,
  );
  const allocations = (isReceivable ? receivableAllocations.data : payableAllocations.data) ?? [];

  const reverseReceivableAllocation = useReverseReceivableAllocation();
  const reversePayableAllocation = useReversePayableAllocation();
  const reverseAllocation = isReceivable ? reverseReceivableAllocation : reversePayableAllocation;

  const handleClose = () => {
    setReverseOpen(false);
    setReason('');
    setAllocateOpen(false);
    onClose();
  };

  const handlePost = async () => {
    if (!settlement) return;
    try {
      await post.mutateAsync(settlement.id);
      toast.success(`${documentLabel} posted.`);
    } catch (err) {
      toast.error(extractError(err, `Failed to post ${documentLabel.toLowerCase()}`));
    }
  };

  const handleReverse = async () => {
    if (!settlement) return;
    if (!reason.trim()) {
      toast.error('A reversal reason is required.');
      return;
    }
    try {
      await reverse.mutateAsync({ id: settlement.id, reversalDate, reason: reason.trim() });
      toast.success(`${documentLabel} reversed.`);
      setReverseOpen(false);
      setReason('');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, `Failed to reverse ${documentLabel.toLowerCase()}`));
    }
  };

  const handleReverseAllocation = async (allocationId: string) => {
    try {
      await reverseAllocation.mutateAsync({ allocationId, reason: 'Allocation reversed' });
      toast.success('Allocation reversed.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to reverse allocation'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={!!settlement}
        onClose={handleClose}
        title={settlement?.settlementNumber ?? documentLabel}
        description={settlement?.description ?? undefined}
        footer={
          settlement?.status === 'DRAFT' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button isLoading={post.isPending} loadingText="Posting…" onClick={handlePost}>
                Post
              </Button>
            </div>
          ) : settlement?.status === 'POSTED' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button variant="secondary" onClick={() => setAllocateOpen(true)}>
                Allocate
              </Button>
              <Button variant="danger" onClick={() => setReverseOpen(true)}>
                Reverse
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          )
        }
      >
        {settlement && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge label={settlement.status} variant={STATUS_VARIANT[settlement.status]} />
              {settlement.reference && (
                <span className="text-xs text-gray-500">Ref: {settlement.reference}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={isReceivable ? 'Customer' : 'Vendor'}
                value={`${settlement.party.legalName} (${settlement.party.code})`}
              />
              <Field label="Date" value={fmtDate(settlement.settlementDate)} />
              <Field label="Amount" value={fmtAmount(settlement.amount, settlement.currency)} />
              {settlement.exchangeRate && (
                <Field label="Exchange Rate" value={settlement.exchangeRate} />
              )}
              {settlement.externalReference && (
                <Field label="External Reference" value={settlement.externalReference} />
              )}
            </div>

            {settlement.cashbookTransaction?.postedJournalEntryId && (
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-900">
                Posted through Cashbook (transaction{' '}
                {settlement.cashbookTransaction.reference ?? settlement.cashbookTransaction.id}).
              </div>
            )}

            {settlement.status === 'POSTED' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-500">Allocations</span>
                {allocations.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Not yet applied to any {isReceivable ? 'invoice' : 'bill'}.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {allocations.map((allocation) => (
                      <div
                        key={allocation.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {allocation.document.documentNumber}
                          </span>
                          <span className="text-xs text-gray-400">
                            {fmtAmount(allocation.amount, allocation.currency)} on{' '}
                            {fmtDate(allocation.allocatedAt)}
                          </span>
                        </div>
                        {allocation.reversedAt ? (
                          <Badge label="Reversed" variant="danger" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReverseAllocation(allocation.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title={`Reverse ${documentLabel}`}
        description="Active allocations must be reversed first. Cashbook creates the reversing cash journal."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={reverse.isPending}
              loadingText="Reversing…"
              onClick={handleReverse}
            >
              Reverse {documentLabel}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Reversal Date"
            type="date"
            value={reversalDate}
            onChange={(e) => setReversalDate(e.target.value)}
          />
          <Input
            label="Reason"
            type="textarea"
            rows={3}
            value={reason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            placeholder="e.g. Duplicate entry captured in error"
          />
        </div>
      </Modal>

      {settlement && (
        <AllocateModal
          isOpen={allocateOpen}
          onClose={() => setAllocateOpen(false)}
          side={side}
          settlement={settlement}
        />
      )}
    </>
  );
}

function AllocateModal({
  isOpen,
  onClose,
  side,
  settlement,
}: {
  isOpen: boolean;
  onClose: () => void;
  side: AccountingTradeSide;
  settlement: AccountingTradeSettlement;
}) {
  const toast = useToast();
  const isReceivable = side === 'RECEIVABLE';

  const { data: receivableInvoices } = useReceivableInvoices(
    isReceivable ? { partyId: settlement.party.id, status: 'POSTED' } : { limit: 1 },
  );
  const { data: payableBills } = usePayableBills(
    !isReceivable ? { partyId: settlement.party.id, status: 'POSTED' } : { limit: 1 },
  );
  const documentOptions: SearchSelectOption[] = (
    isReceivable ? (receivableInvoices?.items ?? []) : (payableBills?.items ?? [])
  ).map((d) => ({
    value: d.id,
    label: `${d.documentNumber} — ${d.currency} ${Number(d.totalAmount).toLocaleString()}`,
  }));

  const allocateReceipt = useAllocateReceivableReceipt();
  const allocatePayment = useAllocatePayablePayment();
  const allocate = isReceivable ? allocateReceipt : allocatePayment;

  const {
    handleSubmit,
    control,
    register,
    reset,
    formState: { errors },
  } = useForm<AllocateFormValues>({ defaultValues: { documentId: '', amount: '' } });

  const handleClose = () => {
    reset({ documentId: '', amount: '' });
    onClose();
  };

  const onSubmit = async (data: AllocateFormValues) => {
    try {
      await allocate.mutateAsync({
        settlementId: settlement.id,
        documentId: data.documentId,
        amount: Number(data.amount),
      });
      toast.success('Allocation recorded.');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to allocate'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Allocate to ${isReceivable ? 'Invoice' : 'Bill'}`}
      description={`Apply part or all of this ${isReceivable ? 'receipt' : 'payment'}'s balance to a posted ${isReceivable ? 'invoice' : 'bill'}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            isLoading={allocate.isPending}
            loadingText="Allocating…"
            onClick={handleSubmit(onSubmit)}
          >
            Allocate
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Controller
          name="documentId"
          control={control}
          rules={{ required: `${isReceivable ? 'Invoice' : 'Bill'} is required` }}
          render={({ field }) => (
            <SearchSelect
              label={isReceivable ? 'Invoice' : 'Bill'}
              placeholder={`Select posted ${isReceivable ? 'invoice' : 'bill'}…`}
              options={documentOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.documentId?.message}
            />
          )}
        />
        <Input
          label="Amount"
          type="number"
          step="0.01"
          {...register('amount', {
            required: 'Amount is required',
            min: { value: 0.0001, message: 'Amount must be greater than 0' },
          })}
          error={errors.amount?.message}
        />
      </div>
    </Modal>
  );
}
