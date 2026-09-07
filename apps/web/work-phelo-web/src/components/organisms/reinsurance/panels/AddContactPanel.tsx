'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { Input } from '@/components/atoms/Input';
import { FormSection } from '@/components/atoms/FormSection';
import { Icons } from '@/components/atoms/icons';
import { useAddCounterpartyContact, useRemoveCounterpartyContact } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Counterparty } from '@/types/reinsurance';

interface ContactFormValues {
  fullName: string;
  email: string;
  phone: string;
}

const DEFAULTS: ContactFormValues = { fullName: '', email: '', phone: '' };

interface AddContactPanelProps {
  /** Pass a counterparty to open the panel; null closes it. */
  counterparty: Counterparty | null;
  onClose: () => void;
}

export function AddContactPanel({ counterparty, onClose }: AddContactPanelProps) {
  const toast = useToast();
  const { mutateAsync: addContact, isPending: isAdding } = useAddCounterpartyContact();
  const { mutate: removeContact, isPending: isRemoving } = useRemoveCounterpartyContact();

  /** Track which contact id is currently being deleted (for per-row loading state). */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({ defaultValues: DEFAULTS });

  const phoneValue = useWatch({ control, name: 'phone' });

  const handleClose = () => {
    reset(DEFAULTS);
    setDeletingId(null);
    onClose();
  };

  const onSubmit = async (data: ContactFormValues) => {
    if (!counterparty) return;
    try {
      await addContact({
        counterparty,
        contact: {
          fullName: data.fullName,
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
        },
      });
      toast.success('Contact added successfully');
      reset(DEFAULTS);
    } catch (err) {
      toast.error(extractError(err, 'Failed to add contact'));
    }
  };

  const handleRemove = (contactId: string) => {
    if (!counterparty || isRemoving) return;
    setDeletingId(contactId);
    removeContact(
      { counterparty, contactId },
      {
        onSuccess: () => {
          toast.success('Contact removed');
          setDeletingId(null);
        },
        onError: (err) => {
          toast.error(extractError(err, 'Failed to remove contact'));
          setDeletingId(null);
        },
      },
    );
  };

  const existingContacts = counterparty?.contacts ?? [];

  return (
    <SidePanel
      isOpen={!!counterparty}
      onClose={handleClose}
      title="Manage Contacts"
      description={counterparty ? `Contacts for ${counterparty.name}` : ''}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isAdding || isRemoving}>
            Close
          </Button>
          <Button isLoading={isAdding} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Add Contact
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        {/* ── Existing contacts ── */}
        {existingContacts.length > 0 && (
          <FormSection title="Existing Contacts">
            <div className="flex flex-col gap-2">
              {existingContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {contact.fullName}
                      {contact.isPrimary && (
                        <span className="ml-2 text-xs font-medium text-brand bg-brand/10 rounded px-1.5 py-0.5">
                          Primary
                        </span>
                      )}
                    </span>
                    {contact.email && (
                      <span className="text-xs text-gray-500 truncate">{contact.email}</span>
                    )}
                    {contact.phone && (
                      <span className="text-xs text-gray-500">{contact.phone}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(contact.id)}
                    disabled={deletingId === contact.id || isRemoving}
                    className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Remove ${contact.fullName}`}
                  >
                    <Icons.Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </FormSection>
        )}

        {/* ── Add new contact form ── */}
        <FormSection title="Add New Contact">
          <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
            <FormField
              label="Contact Name"
              registration={register('fullName', { required: 'Contact name is required' })}
              error={errors.fullName}
              placeholder="e.g. Ama Mensah"
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
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="00 000 0000"
                value={phoneValue ?? ''}
                onChange={(e) => setValue('phone', e.target.value.replace(/\D/g, ''))}
                error={errors.phone?.message}
              />
            </div>
          </div>
        </FormSection>
      </div>
    </SidePanel>
  );
}
