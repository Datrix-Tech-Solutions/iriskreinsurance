'use client';

import { useState, ChangeEvent } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import { JournalEntryRecord, JournalRecordStatus } from '@/types/accounting';
import { useFiscalPeriods, usePostJournal, useReverseJournal } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { formatJournalNumber } from '@/lib/formatters';

interface JournalDetailPanelProps {
  journal: JournalEntryRecord | null;
  onClose: () => void;
}

const STATUS_VARIANT: Record<JournalRecordStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export function JournalDetailPanel({ journal, onClose }: JournalDetailPanelProps) {
  const toast = useToast();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const { data: fiscalPeriods = [] } = useFiscalPeriods();
  const fiscalPeriodName =
    fiscalPeriods.find((p) => p.id === journal?.fiscalPeriodId)?.name ?? journal?.fiscalPeriodId;

  const postJournal = usePostJournal();
  const reverseJournal = useReverseJournal();

  const debitTotal =
    journal?.lines.reduce((sum, line) => sum + Number(line.transactionDebit), 0) ?? 0;
  const creditTotal =
    journal?.lines.reduce((sum, line) => sum + Number(line.transactionCredit), 0) ?? 0;

  const handleClose = () => {
    setReverseOpen(false);
    setReason('');
    onClose();
  };

  const handlePost = async () => {
    if (!journal) return;
    try {
      await postJournal.mutateAsync(journal.id);
      toast.success('Journal posted.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to post journal'));
    }
  };

  const handleReverse = async () => {
    if (!journal) return;
    if (!reason.trim()) {
      toast.error('A reversal reason is required.');
      return;
    }
    try {
      await reverseJournal.mutateAsync({ id: journal.id, reversalDate, reason: reason.trim() });
      toast.success('Journal reversed.');
      setReverseOpen(false);
      setReason('');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to reverse journal'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={!!journal}
        onClose={handleClose}
        title={journal ? formatJournalNumber(journal.journalNumber) : 'Journal'}
        description={journal ? formatSourceEventDescription(journal.description) : undefined}
        footer={
          journal?.status === 'DRAFT' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button isLoading={postJournal.isPending} loadingText="Posting…" onClick={handlePost}>
                Post
              </Button>
            </div>
          ) : journal?.status === 'POSTED' ? (
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
        {journal && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge label={journal.status} variant={STATUS_VARIANT[journal.status]} />
              {journal.reference && (
                <span className="text-xs text-gray-500">Ref: {journal.reference}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Transaction Date" value={fmtDate(journal.transactionDate)} />
              <Field label="Posting Date" value={fmtDate(journal.postingDate)} />
              <Field label="Fiscal Period" value={fiscalPeriodName ?? '—'} />
              <Field
                label="Currency"
                value={
                  journal.transactionCurrency === journal.baseCurrency
                    ? journal.transactionCurrency
                    : `${journal.transactionCurrency} (base ${journal.baseCurrency} @ ${journal.exchangeRate})`
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500">Lines</span>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">GL Account</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Debit</th>
                      <th className="px-3 py-2 text-right font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.lines.map((line) => (
                      <tr key={line.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-900">
                          {line.glAccount.code} – {line.glAccount.name}
                          {line.subledgerAccount && (
                            <div className="text-xs text-gray-400">
                              {line.subledgerAccount.code} {line.subledgerAccount.name}
                            </div>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-gray-600"
                          title={line.description ?? undefined}
                        >
                          {formatSourceEventDescription(line.description)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900">
                          {Number(line.transactionDebit) > 0
                            ? fmtAmount(Number(line.transactionDebit), journal.transactionCurrency)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900">
                          {Number(line.transactionCredit) > 0
                            ? fmtAmount(Number(line.transactionCredit), journal.transactionCurrency)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-900">
                    <tr>
                      <td className="px-3 py-2" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right">
                        {fmtAmount(debitTotal, journal.transactionCurrency)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {fmtAmount(creditTotal, journal.transactionCurrency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {journal.reversalOfJournalId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This journal reverses another posted journal.
              </div>
            )}
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title="Reverse Journal"
        description="Creates an exact linked reversal. The original posted journal is not edited."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={reverseJournal.isPending}
              loadingText="Reversing…"
              onClick={handleReverse}
            >
              Reverse Journal
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
