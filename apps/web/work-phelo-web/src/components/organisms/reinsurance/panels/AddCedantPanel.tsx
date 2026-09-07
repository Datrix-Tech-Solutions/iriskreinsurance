'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { CedantFormFields } from '@/components/molecules/reinsurance/forms/CedantFormFields';
import {
  CedantFormValues,
  CEDANT_FORM_DEFAULTS,
  CreateCounterpartyPayload,
} from '@/types/reinsurance';
import { useCreateCedant } from '@/hooks';
import { countryToCode } from '@/lib/geo';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCedantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function buildPayload(data: CedantFormValues): CreateCounterpartyPayload {
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
    type: 'CEDANT',
    name: data.name,
    ...(data.email && { email: data.email }),
    ...(data.phone && { phone: data.phone }),
    ...(contacts.length && { contacts }),
    ...(addresses.length && { addresses }),
  };
}

export function AddCedantPanel({ isOpen, onClose }: AddCedantPanelProps) {
  const toast = useToast();
  const { mutateAsync: createCedant, isPending } = useCreateCedant();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CedantFormValues>({
    defaultValues: CEDANT_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(CEDANT_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: CedantFormValues) => {
    try {
      await createCedant(buildPayload(data));
      toast.success('Cedant created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create cedant'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Cedant"
      description="Fill in the details to create a new cedant."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Cedant
          </Button>
        </div>
      }
    >
      <CedantFormFields control={control} register={register} setValue={setValue} errors={errors} />
    </SidePanel>
  );
}
