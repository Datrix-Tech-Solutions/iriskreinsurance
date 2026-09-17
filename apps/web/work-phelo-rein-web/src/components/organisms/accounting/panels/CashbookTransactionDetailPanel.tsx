'use client';

import { useState, ChangeEvent } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import { CashbookTransaction, CashbookTransactionStatus } from '@/types/accounting';
import { usePostCashbookTransaction, useReverseCashbookTransaction } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatJournalNumber } from '@/lib/formatters';

interface CashbookTransactionDetailPanelProps {
  transaction: CashbookTransaction | null;
  onClose: () => void;
}

const TYPE_LABEL: Record<CashbookTransaction['transactionType'], string> = {
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  TRANSFER: 'Transfer',
  CHARGE: 'Bank Charge',
  ADJUSTMENT: 'Adjustment',
};

const STATUS_VARIANT: Record<CashbookTransactionStatus, 'success' | 'neutral' | 'danger'> = {
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

export function CashbookTransactionDetailPanel({
  transaction,
  onClose,
}: CashbookTransactionDetailPanelProps) {
  const toast = useToast();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const postTransaction = usePostCashbookTransaction();
  const reverseTransaction = useReverseCashbookTransaction();

  const handleClose = () => {
    setReverseOpen(false);
    setReason('');
    onClose();
  };

  const handlePost = async () => {
    if (!transaction) return;
    try {
      await postTransaction.mutateAsync(transaction.id);
      toast.success('Cashbook transaction posted.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to post transaction'));
    }
  };

  const handleReverse = async () => {
    if (!transaction) return;
    if (!reason.trim()) {
      toast.error('A reversal reason is required.');
      return;
    }
    try {
      await reverseTransaction.mutateAsync({
        transactionId: transaction.id,
        reversalDate,
        reason: reason.trim(),
      });
      toast.success('Cashbook transaction reversed.');
      setReverseOpen(false);
      setReason('');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to reverse transaction'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={!!transaction}
        onClose={handleClose}
        title={transaction ? TYPE_LABEL[transaction.transactionType] : 'Transaction'}
        description={transaction?.description}
        footer={
          transaction?.status === 'DRAFT' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                isLoading={postTransaction.isPending}
                loadingText="Posting…"
                onClick={handlePost}
              >
                Post Transaction
              </Button>
            </div>
          ) : transaction?.status === 'POSTED' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
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
        {transaction && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge label={transaction.status} variant={STATUS_VARIANT[transaction.status]} />
              {transaction.reference && (
                <span className="text-xs text-gray-500">Ref: {transaction.reference}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount" value={fmtAmount(transaction.amount, transaction.currency)} />
              <Field label="Transaction Date" value={fmtDate(transaction.transactionDate)} />
              <Field label="Cash/Bank Account" value={transaction.cashAccount.name} />
              {transaction.destinationCashAccount && (
                <Field
                  label="Destination Account"
                  value={transaction.destinationCashAccount.name}
                />
              )}
              <Field
                label="Settlement Method"
                value={transaction.settlementMethod.replaceAll('_', ' ')}
              />
              {transaction.offsetGlAccount && (
                <Field
                  label="Offset GL Account"
                  value={`${transaction.offsetGlAccount.code} – ${transaction.offsetGlAccount.name}`}
                />
              )}
              {transaction.counterpartyType && (
                <Field label="Counterparty Type" value={transaction.counterpartyType} />
              )}
              {transaction.counterpartyId && (
                <Field label="Counterparty" value={transaction.counterpartyId} />
              )}
              {transaction.exchangeRate && (
                <Field label="Exchange Rate" value={transaction.exchangeRate} />
              )}
              {transaction.sourceModule && (
                <Field
                  label="Source"
                  value={`${transaction.sourceModule}${transaction.sourceReference ? ` – ${transaction.sourceReference}` : ''}`}
                />
              )}
            </div>

            {transaction.postedJournalEntry && (
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-900">
                Posted as journal{' '}
                {formatJournalNumber(transaction.postedJournalEntry.journalNumber)} on{' '}
                {fmtDate(transaction.postedJournalEntry.postedAt)}.
              </div>
            )}

            {transaction.reversalOfTransaction && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This is a reversal of transaction{' '}
                {transaction.reversalOfTransaction.reference ??
                  transaction.reversalOfTransaction.id}
                .
              </div>
            )}

            {transaction.reversalTransaction && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-900">
                Reversed by transaction{' '}
                {transaction.reversalTransaction.reference ?? transaction.reversalTransaction.id}.
              </div>
            )}
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title="Reverse Cashbook Transaction"
        description="This creates a linked reversal transaction and a reversing posted journal. The original posted facts are not edited."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={reverseTransaction.isPending}
              loadingText="Reversing…"
              onClick={handleReverse}
            >
              Reverse Transaction
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
            placeholder="e.g. Duplicate transaction captured in error"
          />
        </div>
      </Modal>
    </>
  );
}
