'use client';

import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingTradeSide } from '@/types/accounting';
import {
  useCreatePayableCreditNote,
  useCreateReceivableCreditNote,
  useCustomers,
  useGLAccountOptions,
  usePayableBills,
  useReceivableInvoices,
  useVendors,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddTradeCreditNotePanelProps {
  isOpen: boolean;
  onClose: () => void;
  side: AccountingTradeSide;
}

type FormValues = {
  partyId: string;
  documentDate: string;
  currency: string;
  amount: number | '';
  offsetGlAccountId: string;
  originalDocumentId: string;
  description: string;
  externalReference: string;
};

const DEFAULTS: FormValues = {
  partyId: '',
  documentDate: new Date().toISOString().slice(0, 10),
  currency: '',
  amount: '',
  offsetGlAccountId: '',
  originalDocumentId: '',
  description: '',
  externalReference: '',
};

export function AddTradeCreditNotePanel({ isOpen, onClose, side }: AddTradeCreditNotePanelProps) {
  const toast = useToast();
  const isReceivable = side === 'RECEIVABLE';
  const partyLabel = isReceivable ? 'Customer' : 'Vendor';
  const documentLabel = isReceivable ? 'invoice' : 'bill';

  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers();
  const { data: vendorsData, isLoading: isLoadingVendors } = useVendors();
  const parties = isReceivable ? (customersData?.items ?? []) : (vendorsData?.items ?? []);
  const partyOptions: SearchSelectOption[] = parties.map((p) => ({
    value: p.id,
    label: `${p.code} — ${p.legalName}`,
  }));

  const { options: glAccountOptions, isLoading: isLoadingGLAccounts } = useGLAccountOptions();

  const createReceivableCreditNote = useCreateReceivableCreditNote();
  const createPayableCreditNote = useCreatePayableCreditNote();
  const isPending = isReceivable
    ? createReceivableCreditNote.isPending
    : createPayableCreditNote.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const partyId = useWatch({ control, name: 'partyId' });

  // Only posted invoices/bills for the selected party can be credited against.
  const { data: receivableInvoices } = useReceivableInvoices(
    isReceivable && partyId ? { partyId, status: 'POSTED' } : { limit: 1 },
  );
  const { data: payableBills } = usePayableBills(
    !isReceivable && partyId ? { partyId, status: 'POSTED' } : { limit: 1 },
  );
  const originalDocumentOptions: SearchSelectOption[] = partyId
    ? (isReceivable ? (receivableInvoices?.items ?? []) : (payableBills?.items ?? [])).map((d) => ({
        value: d.id,
        label: `${d.documentNumber} — ${d.currency} ${Number(d.totalAmount).toLocaleString()}`,
      }))
    : [];

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    const payload = {
      partyId: data.partyId,
      documentDate: data.documentDate,
      currency: data.currency,
      amount: Number(data.amount),
      offsetGlAccountId: data.offsetGlAccountId,
      originalDocumentId: data.originalDocumentId || undefined,
      description: data.description || undefined,
      externalReference: data.externalReference || undefined,
    };

    try {
      if (isReceivable) {
        await createReceivableCreditNote.mutateAsync(payload);
      } else {
        await createPayableCreditNote.mutateAsync(payload);
      }
      toast.success('Credit note created as a draft.');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create credit note'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={`New ${partyLabel} Credit Note`}
      description={`Issue a credit note to a ${partyLabel.toLowerCase()}, optionally applied against a specific posted ${documentLabel}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Credit Note
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
                setValue('originalDocumentId', '');
                const party = parties.find((p) => p.id === value);
                if (party) setValue('currency', party.currency);
              }}
              error={errors.partyId?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Document Date"
            type="date"
            registration={register('documentDate', { required: 'Document date is required' })}
            error={errors.documentDate}
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
          label="Amount"
          type="number"
          step="0.01"
          registration={register('amount', {
            required: 'Amount is required',
            min: { value: 0.0001, message: 'Amount must be greater than 0' },
            valueAsNumber: true,
          })}
          error={errors.amount}
          placeholder="e.g. 250"
        />

        <Controller
          name="offsetGlAccountId"
          control={control}
          rules={{ required: 'Offset account is required' }}
          render={({ field }) => (
            <SearchSelect
              label={isReceivable ? 'Offset Account (Debited)' : 'Offset Account (Credited)'}
              placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select GL account…'}
              options={glAccountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.offsetGlAccountId?.message}
            />
          )}
        />

        {partyId && (
          <Controller
            name="originalDocumentId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label={`Apply to ${documentLabel} (optional)`}
                placeholder={`Select a posted ${documentLabel}, or leave unapplied…`}
                options={originalDocumentOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        )}

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional"
        />

        <FormField
          label="External Reference"
          registration={register('externalReference')}
          error={errors.externalReference}
          placeholder="Optional"
        />
      </div>
    </SidePanel>
  );
}
