'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { JournalEntryDetailsSection } from '@/components/molecules/accounting/JournalEntryDetailsSection';
import { JournalLinesSection } from '@/components/molecules/accounting/JournalLinesSection';
import { JournalEntryFormValues, JOURNAL_ENTRY_DEFAULTS } from '@/types/accounting';
import { cardClass } from '@/lib/utils';
import { useCreateJournal } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface NewJournalEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function NewJournalEntryForm({ isOpen, onClose, onSaved }: NewJournalEntryFormProps) {
  const form = useForm<JournalEntryFormValues>({ defaultValues: JOURNAL_ENTRY_DEFAULTS });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const toast = useToast();
  const { mutateAsync: createJournal, isPending } = useCreateJournal();

  // Start each fresh open with a clean form
  useEffect(() => {
    if (isOpen) form.reset(JOURNAL_ENTRY_DEFAULTS);
  }, [isOpen, form]);

  const handleCancel = () => {
    setShowCancelModal(false);
    onClose();
  };

  const onSubmit = async (data: JournalEntryFormValues) => {
    if (!data.fiscalPeriodId) {
      toast.error('No open fiscal period covers this transaction date');
      return;
    }

    const lines = data.lines.filter((l) => l.targetAccount && (l.debit || l.credit));
    const debitTotal = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const creditTotal = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    if (lines.length < 2) {
      toast.error('A journal entry needs at least 2 lines');
      return;
    }
    if (debitTotal !== creditTotal) {
      toast.error('Debit and credit totals must be equal');
      return;
    }

    try {
      await createJournal({
        transactionDate: data.transactionDate,
        fiscalPeriodId: data.fiscalPeriodId,
        transactionCurrency: data.currency,
        exchangeRate: data.exchangeRate || undefined,
        reference: data.reference || undefined,
        description: data.description,
        lines: lines.map((l) => ({
          glAccountId: l.targetAccount,
          subledgerAccountId: l.subledgerAccountId || undefined,
          description: l.description || undefined,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      });
      toast.success('Journal entry saved as draft');
      onSaved();
    } catch (err) {
      toast.error(extractError(err, 'Failed to save journal entry'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={() => setShowCancelModal(true)}
        title="New Journal Entry"
        description="Record a manual journal entry"
        width="sm:w-[1020px] sm:max-w-[100vw]"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCancelModal(true)} disabled={isPending}>
              Cancel
            </Button>
            {/* No backend workflow status for "review" yet (JournalStatus is only
                DRAFT/POSTED/REVERSED) — this creates the same draft as "Save as Draft". */}
            <Button
              variant="primary"
              isLoading={isPending}
              loadingText="Saving…"
              onClick={form.handleSubmit(onSubmit)}
            >
              Submit for Review
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Entry details card */}
          <div className={cardClass('p-6')}>
            <JournalEntryDetailsSection form={form} />
          </div>

          {/* Journal lines */}
          <JournalLinesSection form={form} />
        </div>
      </SidePanel>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Entry"
        description="Are you sure you want to cancel the journal entry creation?"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Go Back
            </Button>
            <Button variant="danger" onClick={handleCancel}>
              Yes, Cancel
            </Button>
          </>
        }
      />
    </>
  );
}
