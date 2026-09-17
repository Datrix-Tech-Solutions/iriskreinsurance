'use client';

import { useState, ChangeEvent } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import {
  AccountingTradeDocument,
  AccountingTradeDocumentPaymentState,
  AccountingTradeDocumentStatus,
  AccountingTradeSide,
} from '@/types/accounting';
import {
  usePayableBillBalance,
  usePostPayableBill,
  usePostPayableCreditNote,
  usePostReceivableCreditNote,
  usePostReceivableInvoice,
  useReceivableInvoiceBalance,
  useReversePayableBill,
  useReversePayableCreditNote,
  useReverseReceivableCreditNote,
  useReverseReceivableInvoice,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatJournalNumber } from '@/lib/formatters';

interface TradeDocumentDetailPanelProps {
  side: AccountingTradeSide;
  document: AccountingTradeDocument | null;
  onClose: () => void;
  /** 'invoice' (default) covers both AR invoices and AP bills — they share the
   * balance endpoint. Credit notes don't have a balance endpoint, so that fetch
   * and display are skipped for 'creditNote'. */
  documentKind?: 'invoice' | 'creditNote';
}

const STATUS_VARIANT: Record<AccountingTradeDocumentStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

const PAYMENT_STATE_VARIANT: Record<
  AccountingTradeDocumentPaymentState,
  'success' | 'neutral' | 'danger' | 'warning' | 'info'
> = {
  DRAFT: 'neutral',
  REVERSED: 'danger',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  OPEN: 'info',
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

export function TradeDocumentDetailPanel({
  side,
  document,
  onClose,
  documentKind = 'invoice',
}: TradeDocumentDetailPanelProps) {
  const toast = useToast();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const isReceivable = side === 'RECEIVABLE';
  const isCreditNote = documentKind === 'creditNote';
  const partyLabel = isReceivable ? 'Customer' : 'Vendor';
  const settlementLabel = isReceivable ? 'Applied Receipts' : 'Applied Payments';

  const receivableBalance = useReceivableInvoiceBalance(
    isReceivable && !isCreditNote ? document?.id : undefined,
  );
  const payableBalance = usePayableBillBalance(
    !isReceivable && !isCreditNote ? document?.id : undefined,
  );
  const balance = isReceivable ? receivableBalance.data : payableBalance.data;

  const postReceivableInvoice = usePostReceivableInvoice();
  const postPayableBill = usePostPayableBill();
  const postReceivableCreditNote = usePostReceivableCreditNote();
  const postPayableCreditNote = usePostPayableCreditNote();
  const reverseReceivableInvoice = useReverseReceivableInvoice();
  const reversePayableBill = useReversePayableBill();
  const reverseReceivableCreditNote = useReverseReceivableCreditNote();
  const reversePayableCreditNote = useReversePayableCreditNote();

  const postReceivable = isCreditNote ? postReceivableCreditNote : postReceivableInvoice;
  const postPayable = isCreditNote ? postPayableCreditNote : postPayableBill;
  const reverseReceivable = isCreditNote ? reverseReceivableCreditNote : reverseReceivableInvoice;
  const reversePayable = isCreditNote ? reversePayableCreditNote : reversePayableBill;

  const isPosting = isReceivable ? postReceivable.isPending : postPayable.isPending;
  const isReversing = isReceivable ? reverseReceivable.isPending : reversePayable.isPending;

  const handleClose = () => {
    setReverseOpen(false);
    setReason('');
    onClose();
  };

  const handlePost = async () => {
    if (!document) return;
    try {
      if (isReceivable) {
        await postReceivable.mutateAsync(document.id);
      } else {
        await postPayable.mutateAsync(document.id);
      }
      toast.success(isCreditNote ? 'Credit note posted.' : 'Invoice posted.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to post document'));
    }
  };

  const handleReverse = async () => {
    if (!document) return;
    if (!reason.trim()) {
      toast.error('A reversal reason is required.');
      return;
    }
    try {
      if (isReceivable) {
        await reverseReceivable.mutateAsync({
          id: document.id,
          reversalDate,
          reason: reason.trim(),
        });
      } else {
        await reversePayable.mutateAsync({
          id: document.id,
          reversalDate,
          reason: reason.trim(),
        });
      }
      toast.success('Document reversed.');
      setReverseOpen(false);
      setReason('');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to reverse document'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={!!document}
        onClose={handleClose}
        title={document?.documentNumber ?? 'Document'}
        description={document?.description ?? undefined}
        footer={
          document?.status === 'DRAFT' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button isLoading={isPosting} loadingText="Posting…" onClick={handlePost}>
                Post
              </Button>
            </div>
          ) : document?.status === 'POSTED' ? (
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
        {document && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge label={document.status} variant={STATUS_VARIANT[document.status]} />
              {balance && (
                <Badge
                  label={balance.paymentState.replaceAll('_', ' ')}
                  variant={PAYMENT_STATE_VARIANT[balance.paymentState]}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={partyLabel}
                value={`${document.party.legalName} (${document.party.code})`}
              />
              <Field label="Document Date" value={fmtDate(document.documentDate)} />
              <Field label="Due Date" value={fmtDate(document.dueDate)} />
              <Field
                label="Total Amount"
                value={fmtAmount(document.totalAmount, document.currency)}
              />
              <Field
                label="Subtotal / Tax"
                value={`${fmtAmount(document.subtotalAmount, document.currency)} / ${fmtAmount(document.taxAmount, document.currency)}`}
              />
              <Field
                label="Offset GL Account"
                value={`${document.offsetGlAccount.code} – ${document.offsetGlAccount.name}`}
              />
              {document.externalReference && (
                <Field label="External Reference" value={document.externalReference} />
              )}
              {document.originalDocument && (
                <Field label="Applied To" value={document.originalDocument.documentNumber} />
              )}
            </div>

            {balance && document.status === 'POSTED' && (
              <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-500">Balance</span>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-600">Original</span>
                  <span className="text-right text-gray-900">
                    {fmtAmount(balance.originalAmount, balance.currency)}
                  </span>
                  <span className="text-gray-600">{settlementLabel}</span>
                  <span className="text-right text-gray-900">
                    {fmtAmount(balance.appliedSettlements, balance.currency)}
                  </span>
                  <span className="text-gray-600">Applied Credit Notes</span>
                  <span className="text-right text-gray-900">
                    {fmtAmount(balance.appliedCreditNotes, balance.currency)}
                  </span>
                  <span className="font-semibold text-gray-900">Outstanding</span>
                  <span className="text-right font-semibold text-gray-900">
                    {fmtAmount(balance.outstandingAmount, balance.currency)}
                  </span>
                </div>
              </div>
            )}

            {document.postedJournalEntry && (
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-900">
                Posted as journal {formatJournalNumber(document.postedJournalEntry.journalNumber)}{' '}
                on {fmtDate(document.postedJournalEntry.postedAt)}.
              </div>
            )}
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title="Reverse Document"
        description="Posted documents are immutable. Reversal creates a reversing journal. Active allocations must be reversed first."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isReversing}
              loadingText="Reversing…"
              onClick={handleReverse}
            >
              Reverse Document
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
            placeholder="e.g. Correction approved by finance"
          />
        </div>
      </Modal>
    </>
  );
}
