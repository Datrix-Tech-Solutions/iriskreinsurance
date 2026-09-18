'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { BrokerFormFields } from '@/components/molecules/reinsurance/forms/BrokerFormFields';
import {
  BrokerFormValues,
  BROKER_FORM_DEFAULTS,
  CreateCounterpartyPayload,
} from '@/types/reinsurance';
import { useCreateBroker } from '@/hooks';
import { countryToCode } from '@/lib/geo';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddBrokerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function buildPayload(data: BrokerFormValues): CreateCounterpartyPayload {
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
    type: 'BROKER',
    name: data.name,
    ...(data.email && { email: data.email }),
    ...(data.phone && { phone: data.phone }),
    ...(contacts.length && { contacts }),
    ...(addresses.length && { addresses }),
  };
}

export function AddBrokerPanel({ isOpen, onClose }: AddBrokerPanelProps) {
  const toast = useToast();
  const { mutateAsync: createBroker, isPending } = useCreateBroker();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BrokerFormValues>({
    defaultValues: BROKER_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(BROKER_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: BrokerFormValues) => {
    try {
      await createBroker(buildPayload(data));
      toast.success('Broker created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create broker'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Broker"
      description="Fill in the details to create a new broker."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Broker
          </Button>
        </div>
      }
    >
      <BrokerFormFields control={control} register={register} setValue={setValue} errors={errors} />
    </SidePanel>
  );
}
