'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ContactCard } from '@/components/molecules/ContactCard';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { useUpdateCounterpartyContact, useRemoveCounterpartyContact } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { extractError } from '@/lib/extractError';
import { Counterparty, CounterpartyContact } from '@/types/reinsurance';

interface CedantContactsTabProps {
  counterparty: Counterparty;
}

interface ContactFormValues {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
}

export function CedantContactsTab({ counterparty }: CedantContactsTabProps) {
  const toast = useToast();
  const canEdit = usePermissionRule('operations.reinsurance.counterparties:EDIT');
  const canDelete = usePermissionRule('operations.reinsurance.counterparties:DELETE');
  const { mutateAsync: updateContact, isPending: isSaving } = useUpdateCounterpartyContact();
  const { mutateAsync: removeContact, isPending: isRemoving } = useRemoveCounterpartyContact();

  const [editTarget, setEditTarget] = useState<CounterpartyContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CounterpartyContact | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    defaultValues: { fullName: '', jobTitle: '', email: '', phone: '' },
  });

  const phoneValue = useWatch({ control, name: 'phone' });

  const openEdit = (contact: CounterpartyContact) => {
    setEditTarget(contact);
    setValue('fullName', contact.fullName);
    setValue('jobTitle', contact.jobTitle ?? '');
    setValue('email', contact.email ?? '');
    setValue('phone', contact.phone ?? '');
  };

  const onSubmit = async (data: ContactFormValues) => {
    if (!editTarget) return;
    try {
      await updateContact({
        counterparty,
        contactId: editTarget.id,
        contact: {
          fullName: data.fullName,
          isPrimary: editTarget.isPrimary,
          ...(data.jobTitle && { jobTitle: data.jobTitle }),
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
        },
      });
      toast.success('Contact updated');
      setEditTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to update contact'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeContact({ counterparty, contactId: deleteTarget.id });
      toast.success('Contact removed');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to remove contact'));
    }
  };

  if (counterparty.contacts.length === 0) {
    return <p className="text-sm text-gray-400">No contacts on record.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {counterparty.contacts.map((c) => (
          <ContactCard
            key={c.id}
            name={c.fullName}
            subtitle={c.jobTitle ?? undefined}
            statusPill={c.isPrimary ? { label: 'Primary', color: 'green' } : undefined}
            email={c.email ?? '—'}
            phone={c.phone ?? '—'}
            onEdit={canEdit ? () => openEdit(c) : undefined}
            onDelete={canDelete ? () => setDeleteTarget(c) : undefined}
          />
        ))}
      </div>

      <SidePanel
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Contact"
        description={editTarget ? `Update details for ${editTarget.fullName}` : undefined}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button isLoading={isSaving} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <FormField
            label="Contact Name"
            registration={register('fullName', { required: 'Contact name is required' })}
            error={errors.fullName}
            placeholder="e.g. Ama Mensah"
          />
          <FormField
            label="Job Title"
            registration={register('jobTitle')}
            error={errors.jobTitle}
            placeholder="e.g. Underwriting Manager"
          />
          <FormField
            label="Email"
            type="email"
            registration={register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
            error={errors.email}
            placeholder="e.g. ama@example.com"
          />
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <span className="text-sm font-bold text-gray-900">Phone Number</span>
            <PhoneInput
              placeholder="00 000 0000"
              value={phoneValue ?? ''}
              onChange={(v) => setValue('phone', v)}
              error={errors.phone?.message}
            />
          </div>
        </div>
      </SidePanel>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Contact"
        description={`Are you sure you want to remove "${deleteTarget?.fullName}" from your contacts?`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isRemoving}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isRemoving}
              loadingText="Removing…"
              onClick={handleDelete}
            >
              Remove
            </Button>
          </div>
        }
      />
    </>
  );
}
