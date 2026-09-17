'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { CedantFormFields } from '@/components/molecules/reinsurance/forms/CedantFormFields';
import {
  Counterparty,
  CedantFormValues,
  CEDANT_FORM_DEFAULTS,
  UpdateCounterpartyPayload,
} from '@/types/reinsurance';
import { useUpdateCedant } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { countryToCode, codeToCountry } from '@/lib/geo';

interface EditCedantPanelProps {
  cedant: Counterparty | null;
  onClose: () => void;
}

function toFormValues(c: Counterparty): CedantFormValues {
  const primary = c.addresses.find((a) => a.isPrimary) ?? c.addresses[0];
  return {
    name: c.name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    contacts: c.contacts
      .filter((ct) => !ct.isPrimary)
      .map((ct) => ({ fullName: ct.fullName, email: ct.email ?? '', phone: ct.phone ?? '' })),
    address: {
      country: primary ? codeToCountry(primary.country) : '',
      state: primary?.state ?? '',
      streetName: primary?.country === 'GH' ? (primary?.line1 ?? '') : '',
      city: primary?.city ?? '',
    },
  };
}

function buildPayload(data: CedantFormValues): UpdateCounterpartyPayload {
  const contacts = data.contacts
    .filter((c) => c.fullName.trim())
    .map((c) => ({
      fullName: c.fullName,
      ...(c.email && { email: c.email }),
      ...(c.phone && { phone: c.phone }),
    }));

  const addr = data.address;
  const addresses = addr.country
    ? addr.country === 'Ghana' && addr.city
      ? [
          {
            line1: addr.streetName.trim() ? addr.streetName : addr.city,
            city: addr.city,
            country: 'GH',
            ...(addr.state && { state: addr.state }),
            isPrimary: true,
          },
        ]
      : addr.country !== 'Ghana'
        ? [
            {
              line1: addr.country,
              city: addr.country,
              country: countryToCode(addr.country),
              isPrimary: true,
            },
          ]
        : []
    : [];

  return {
    name: data.name,
    ...(data.email && { email: data.email }),
    ...(data.phone && { phone: data.phone }),
    ...(contacts.length && { contacts }),
    ...(addresses.length && { addresses }),
  };
}

export function EditCedantPanel({ cedant, onClose }: EditCedantPanelProps) {
  const toast = useToast();
  const { mutateAsync: updateCedant, isPending } = useUpdateCedant();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CedantFormValues>({ defaultValues: CEDANT_FORM_DEFAULTS });

  useEffect(() => {
    if (cedant) reset(toFormValues(cedant));
  }, [cedant, reset]);

  const handleClose = () => {
    reset(CEDANT_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: CedantFormValues) => {
    if (!cedant) return;
    try {
      await updateCedant({ id: cedant.id, ...buildPayload(data) });
      toast.success('Cedant updated successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update cedant'));
    }
  };

  return (
    <SidePanel
      isOpen={!!cedant}
      onClose={handleClose}
      title="Edit Cedant"
      description="Update the details for this cedant."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Changes
          </Button>
        </div>
      }
    >
      <CedantFormFields control={control} register={register} setValue={setValue} errors={errors} />
    </SidePanel>
  );
}
