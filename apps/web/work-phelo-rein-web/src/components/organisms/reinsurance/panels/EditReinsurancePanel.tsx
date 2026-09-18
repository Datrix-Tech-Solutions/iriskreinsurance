'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { ReinsurerFormFields } from '@/components/molecules/reinsurance/forms/ReinsurerFormFields';
import {
  Counterparty,
  ReinsurerFormValues,
  REINSURER_FORM_DEFAULTS,
  UpdateCounterpartyPayload,
} from '@/types/reinsurance';
import { useUpdateReinsurer } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { countryToCode, codeToCountry } from '@/lib/geo';

interface EditReinsurancePanelProps {
  reinsurer: Counterparty | null;
  onClose: () => void;
}

function toFormValues(r: Counterparty): ReinsurerFormValues {
  const primary = r.addresses.find((a) => a.isPrimary) ?? r.addresses[0];
  return {
    name: r.name,
    email: r.email ?? '',
    phone: r.phone ?? '',
    brokerageFee: r.brokerageFee ?? '',
    contacts: r.contacts.map((c) => ({
      fullName: c.fullName,
      email: c.email ?? '',
      phone: c.phone ?? '',
    })),
    address: {
      country: primary ? codeToCountry(primary.country) : '',
      state: primary?.state ?? '',
      streetName: primary?.country === 'GH' ? (primary?.line1 ?? '') : '',
      city: primary?.city ?? '',
    },
  };
}

function buildPayload(data: ReinsurerFormValues): UpdateCounterpartyPayload {
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
    ...(data.brokerageFee !== '' && { brokerageFee: Number(data.brokerageFee) }),
    ...(contacts.length && { contacts }),
    ...(addresses.length && { addresses }),
  };
}

export function EditReinsurancePanel({ reinsurer, onClose }: EditReinsurancePanelProps) {
  const toast = useToast();
  const { mutateAsync: updateReinsurer, isPending } = useUpdateReinsurer();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ReinsurerFormValues>({
    defaultValues: REINSURER_FORM_DEFAULTS,
  });

  useEffect(() => {
    if (reinsurer) {
      reset(toFormValues(reinsurer));
    }
  }, [reinsurer, reset]);

  const handleClose = () => {
    reset(REINSURER_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: ReinsurerFormValues) => {
    if (!reinsurer) return;
    try {
      await updateReinsurer({ id: reinsurer.id, ...buildPayload(data) });
      toast.success('Reinsurer updated successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update reinsurer'));
    }
  };

  return (
    <SidePanel
      isOpen={!!reinsurer}
      onClose={handleClose}
      title="Edit Reinsurer"
      description="Update the details for this reinsurer."
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
      <ReinsurerFormFields
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
      />
    </SidePanel>
  );
}
