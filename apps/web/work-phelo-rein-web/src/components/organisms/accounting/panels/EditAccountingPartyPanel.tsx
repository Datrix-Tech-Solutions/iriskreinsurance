'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { Modal } from '@/components/organisms/shared/Modal';

export interface AccountingPartyEditValues {
  legalName: string;
  tradingName: string;
  primaryContactName: string;
  email: string;
  phone: string;
  billingAddress: string;
  countryCode: string;
  paymentTermsDays: number;
  taxNumber: string;
  notes: string;
}

interface Party {
  legalName: string;
  tradingName: string | null;
  primaryContactName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  countryCode: string | null;
  paymentTermsDays: number;
  taxNumber: string | null;
  notes: string | null;
}

interface EditAccountingPartyPanelProps {
  party: Party;
  label: 'Customer' | 'Vendor';
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: AccountingPartyEditValues) => Promise<void>;
}

export function EditAccountingPartyPanel({
  party,
  label,
  isOpen,
  isSaving,
  onClose,
  onSave,
}: EditAccountingPartyPanelProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountingPartyEditValues>();

  useEffect(() => {
    if (!isOpen) return;
    reset({
      legalName: party.legalName,
      tradingName: party.tradingName ?? '',
      primaryContactName: party.primaryContactName ?? '',
      email: party.email ?? '',
      phone: party.phone ?? '',
      billingAddress: party.billingAddress ?? '',
      countryCode: party.countryCode ?? '',
      paymentTermsDays: party.paymentTermsDays,
      taxNumber: party.taxNumber ?? '',
      notes: party.notes ?? '',
    });
  }, [isOpen, party, reset]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${label}`}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            form="accounting-party-edit"
            type="submit"
            isLoading={isSaving}
            loadingText="Saving…"
          >
            Save Changes
          </Button>
        </>
      }
    >
      <form
        id="accounting-party-edit"
        className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit(onSave)}
      >
        <FormField
          label="Legal Name"
          registration={register('legalName', { required: 'Legal name is required' })}
          error={errors.legalName}
        />
        <FormField label="Trading Name" registration={register('tradingName')} />
        <FormField label="Primary Contact" registration={register('primaryContactName')} />
        <FormField label="Email" type="email" registration={register('email')} />
        <FormField label="Phone" registration={register('phone')} />
        <FormField label="Country Code" registration={register('countryCode')} />
        <FormField
          label="Payment Terms (days)"
          type="number"
          registration={register('paymentTermsDays', { valueAsNumber: true, min: 0 })}
          error={errors.paymentTermsDays}
        />
        <FormField label="Tax Number" registration={register('taxNumber')} />
        <div className="sm:col-span-2">
          <FormField
            label="Billing Address"
            type="textarea"
            rows={2}
            registration={register('billingAddress')}
          />
        </div>
        <div className="sm:col-span-2">
          <FormField label="Notes" type="textarea" rows={3} registration={register('notes')} />
        </div>
      </form>
    </Modal>
  );
}
