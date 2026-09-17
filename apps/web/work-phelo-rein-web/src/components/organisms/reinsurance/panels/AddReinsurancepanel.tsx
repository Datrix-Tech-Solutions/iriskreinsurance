'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { ReinsurerFormFields } from '@/components/molecules/reinsurance/forms/ReinsurerFormFields';
import {
  ReinsurerFormValues,
  REINSURER_FORM_DEFAULTS,
  CreateCounterpartyPayload,
} from '@/types/reinsurance';
import { useCreateReinsurer } from '@/hooks';
import { countryToCode } from '@/lib/geo';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddReinsurancePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function buildPayload(data: ReinsurerFormValues): CreateCounterpartyPayload {
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
    type: 'REINSURER',
    name: data.name,
    ...(data.email && { email: data.email }),
    ...(data.phone && { phone: data.phone }),
    ...(data.brokerageFee !== '' && { brokerageFee: Number(data.brokerageFee) }),
    ...(contacts.length && { contacts }),
    ...(addresses.length && { addresses }),
  };
}

export function AddReinsurancePanel({ isOpen, onClose }: AddReinsurancePanelProps) {
  const toast = useToast();
  const { mutateAsync: createReinsurer, isPending } = useCreateReinsurer();

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

  const handleClose = () => {
    reset(REINSURER_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: ReinsurerFormValues) => {
    try {
      await createReinsurer(buildPayload(data));
      toast.success('Reinsurer created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create reinsurer'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Reinsurer"
      description="Fill in the details to create a new reinsurer."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Reinsurer
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
