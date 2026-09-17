'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { InvoiceDetailsSection } from '@/components/molecules/accounting/InvoiceDetailsSection';
import { InvoiceLineDetailsSection } from '@/components/molecules/accounting/InvoiceLineDetailsSection';
import { SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingTradeSide, InvoiceFormValues, INVOICE_DEFAULTS } from '@/types/accounting';
import {
  useCreatePayableBill,
  useCreateReceivableInvoice,
  useEntityTypes,
  useGLAccountOptions,
  useSubledgers,
} from '@/hooks';
import {
  matchesTradeSide,
  resolveEntityAccountingRelation,
} from '@/lib/accounting/entityAccountingRelation';
import { Icons } from '@/components/atoms/icons';
import { cardClass } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface NewInvoiceFormProps {
  onCancel: () => void;
  onCreated: () => void;
  side: AccountingTradeSide;
  vendorLabel?: string;
}

export function NewInvoiceForm({ onCancel, onCreated, side, vendorLabel }: NewInvoiceFormProps) {
  const toast = useToast();
  const isReceivable = side === 'RECEIVABLE';
  const partyLabel = vendorLabel ?? (isReceivable ? 'Customer' : 'Vendor');

  const form = useForm<InvoiceFormValues>({ defaultValues: INVOICE_DEFAULTS });
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: entities, isLoading: isLoadingEntities } = useSubledgers({ status: 'ACTIVE' });
  const { data: entityTypes, isLoading: isLoadingEntityTypes } = useEntityTypes();
  const isLoadingParties = isLoadingEntities || isLoadingEntityTypes;

  const parties = useMemo(
    () =>
      (entities ?? []).filter((entity) =>
        matchesTradeSide(resolveEntityAccountingRelation(entity, entityTypes), side),
      ),
    [entities, entityTypes, side],
  );
  const partyOptions: SearchSelectOption[] = parties.map((p) => ({
    value: p.id,
    label: `${p.code} — ${p.name}`,
  }));

  const { options: glAccountOptions, isLoading: isLoadingGLAccounts } = useGLAccountOptions();

  const createInvoice = useCreateReceivableInvoice();
  const createBill = useCreatePayableBill();
  const isPending = isReceivable ? createInvoice.isPending : createBill.isPending;

  const onSubmit = async (data: InvoiceFormValues) => {
    
    const subtotalAmount = data.lines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
      0,
    );
    const taxAmount = data.lines.reduce((sum, line) => {
      const lineAmount = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
      return sum + (lineAmount * (Number(line.tax) || 0)) / 100;
    }, 0);
    const offsetGlAccountId = data.lines.find((line) => line.glAccount)?.glAccount;

    if (subtotalAmount <= 0) {
      toast.error('Add at least one line with a quantity and unit price.');
      return;
    }
    if (!offsetGlAccountId) {
      toast.error('Select a GL account on at least one line.');
      return;
    }

    const payload = {
      partyId: data.vendor,
      documentDate: data.invoiceDate,
      dueDate: data.dueDate || undefined,
      currency: data.currency,
      amount: subtotalAmount,
      taxAmount: taxAmount || undefined,
      offsetGlAccountId,
      description: data.description || undefined,
      externalReference: data.invoiceNumber || undefined,
    };

    try {
      if (isReceivable) {
        await createInvoice.mutateAsync(payload);
      } else {
        await createBill.mutateAsync(payload);
      }
      toast.success('Invoice created as a draft.');
      onCreated();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create invoice'));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className={cardClass('p-6')}>
          <InvoiceDetailsSection
            form={form}
            vendorLabel={partyLabel}
            partyOptions={partyOptions}
            isLoadingParties={isLoadingParties}
          />
        </div>

        <InvoiceLineDetailsSection
          form={form}
          glAccountOptions={glAccountOptions}
          isLoadingGLAccounts={isLoadingGLAccounts}
        />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowCancelModal(true)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={<Icons.Save className="w-4 h-4" />}
            isLoading={isPending}
            loadingText="Saving…"
            onClick={form.handleSubmit(onSubmit)}
          >
            Save as Draft
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={form.handleSubmit(onSubmit)}>
            Submit for Approval
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Entry"
        description="Are you sure you want to cancel the invoice creation?"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Go Back
            </Button>
            <Button variant="danger" onClick={onCancel}>
              Yes, Cancel
            </Button>
          </>
        }
      />
    </>
  );
}
