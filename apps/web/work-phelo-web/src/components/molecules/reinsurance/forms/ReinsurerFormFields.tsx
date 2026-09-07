'use client';

import { useState } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Input } from '@/components/atoms/Input';
import { Icons } from '@/components/atoms/icons';
import { CounterpartyAddressFields } from '@/components/molecules/reinsurance/forms/CounterpartyAddressFields';
import { CONTACT_PERSON_DEFAULTS } from '@/types/reinsurance';
import type { ReinsurerFormValues } from '@/types/reinsurance';
import { inputClass } from '@/lib/utils';
import { useCedants } from '@/hooks';
import { codeToCountry } from '@/lib/geo';

interface ReinsurerFormFieldsProps {
  control: Control<ReinsurerFormValues>;
  register: UseFormRegister<ReinsurerFormValues>;
  setValue: UseFormSetValue<ReinsurerFormValues>;
  errors: FieldErrors<ReinsurerFormValues>;
}

export function ReinsurerFormFields({
  control,
  register,
  setValue,
  errors,
}: ReinsurerFormFieldsProps) {
  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({ control, name: 'contacts' });

  const primaryPhone = useWatch({ control, name: 'phone' });
  const watchedContacts = useWatch({ control, name: 'contacts' });

  const { data: cedants = [] } = useCedants();
  const [prefillId, setPrefillId] = useState('');

  const cedantOptions = cedants.map((c) => ({ value: c.id, label: c.name }));

  const handlePrefill = (cedantId: string) => {
    setPrefillId(cedantId);
    const cedant = cedants.find((c) => c.id === cedantId);
    if (!cedant) return;

    setValue('name', cedant.name);
    setValue('email', cedant.email ?? '');
    setValue('phone', cedant.phone ?? '');

    const additionalContacts = cedant.contacts
      .filter((c) => !c.isPrimary)
      .map((c) => ({ fullName: c.fullName, email: c.email ?? '', phone: c.phone ?? '' }));
    setValue('contacts', additionalContacts);

    const primaryAddr = cedant.addresses.find((a) => a.isPrimary) ?? cedant.addresses[0];
    if (primaryAddr) {
      setValue('address.country', codeToCountry(primaryAddr.country));
      setValue('address.state', primaryAddr.state ?? '');
      setValue('address.city', primaryAddr.city ?? '');
    }
  };

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      {/* ── Prefill from cedant ── */}
      <div className="flex flex-col gap-1">
        <SearchSelect
          label="Prefill from Cedant"
          placeholder="Search cedant to prefill…"
          options={cedantOptions}
          value={prefillId}
          onChange={handlePrefill}
        />
        <p className="text-xs text-gray-400">Selecting a cedant prefills the fields below.</p>
      </div>

      {/* ── Basic info ── */}
      <FormSection title="Basic Info">
        <FormField
          label="Reinsurer Name"
          registration={register('name', { required: 'Reinsurer name is required' })}
          error={errors.name}
          placeholder="e.g. Reinsurance Company Ltd."
          readOnly={!!prefillId}
        />
      </FormSection>

      {/* ── Brokerage fee ── */}
      <FormSection title="Financials">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Brokerage Fee (%)</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="e.g. 5.00"
              {...register('brokerageFee', {
                min: { value: 0, message: 'Must be at least 0' },
                max: { value: 100, message: 'Cannot exceed 100' },
              })}
              className={inputClass(errors.brokerageFee?.message)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              %
            </span>
          </div>
          {errors.brokerageFee && (
            <p className="text-xs text-red-500">{errors.brokerageFee.message}</p>
          )}
        </div>
      </FormSection>

      {/* ── Primary contact ── */}
      <FormSection title="Primary Contact">
        <div className="flex flex-col gap-4">
          <FormField
            label="Primary Email"
            type="email"
            registration={register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
            error={errors.email}
            placeholder="e.g. info@reinsurancecompany.com"
          />

          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <span className="text-sm font-bold text-gray-900">Primary Phone Number</span>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="00 000 0000"
              value={primaryPhone ?? ''}
              onChange={(e) => setValue('phone', e.target.value.replace(/\D/g, ''))}
              error={errors.phone?.message}
            />
          </div>
        </div>
      </FormSection>

      {/* ── Additional contacts ── */}
      <FormSection title="Additional Contacts">
        <div className="flex flex-col gap-4">
          {contactFields.map((field, index) => (
            <div
              key={field.id}
              className="relative flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4"
            >
              <button
                type="button"
                onClick={() => removeContact(index)}
                className="absolute top-3 right-3 p-1 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-200 transition-colors"
                aria-label="Remove contact"
              >
                <Icons.Trash2 className="w-4 h-4" />
              </button>

              <FormField
                label="Contact Name"
                registration={register(`contacts.${index}.fullName`, {
                  required: 'Contact name is required',
                })}
                error={errors.contacts?.[index]?.fullName}
                placeholder="e.g. Kwame Asante"
              />

              <FormField
                label="Contact Email"
                type="email"
                registration={register(`contacts.${index}.email`, {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
                error={errors.contacts?.[index]?.email}
                placeholder="e.g. kwame@example.com"
              />

              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <span className="text-sm font-bold text-gray-900">Contact Phone</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="00 000 0000"
                  value={watchedContacts?.[index]?.phone ?? ''}
                  onChange={(e) =>
                    setValue(`contacts.${index}.phone`, e.target.value.replace(/\D/g, ''))
                  }
                  error={errors.contacts?.[index]?.phone?.message}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => appendContact({ ...CONTACT_PERSON_DEFAULTS })}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-brand/40 hover:text-brand transition-colors"
          >
            <Icons.Plus className="w-4 h-4" />
            Add another contact
          </button>
        </div>
      </FormSection>

      {/* ── Location / Territory ── */}
      <CounterpartyAddressFields
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
      />
    </div>
  );
}
