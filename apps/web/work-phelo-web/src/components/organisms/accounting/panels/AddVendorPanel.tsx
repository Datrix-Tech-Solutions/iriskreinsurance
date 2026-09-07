'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { useAccountingCurrencyOptions, useCreateVendor } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddVendorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  code: string;
  legalName: string;
  currency: string;
  contactName: string;
  contactNumber: string;
  email: string;
};

const DEFAULTS: FormValues = {
  code: '',
  legalName: '',
  currency: '',
  contactName: '',
  contactNumber: '',
  email: '',
};

export function AddVendorPanel({ isOpen, onClose }: AddVendorPanelProps) {
  const toast = useToast();
  const createVendor = useCreateVendor();
  const { options: currencyOptions, isLoading: isLoadingCurrencies } =
    useAccountingCurrencyOptions();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await createVendor.mutateAsync({
        code: data.code,
        legalName: data.legalName,
        currency: data.currency,
        primaryContactName: data.contactName || undefined,
        phone: data.contactNumber || undefined,
        email: data.email || undefined,
      });
      toast.success('Vendor created successfully.');
      handleClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to create vendor'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Vendor"
      description="Register a new vendor to your accounting records."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={createVendor.isPending}>
            Cancel
          </Button>
          <Button
            isLoading={createVendor.isPending}
            loadingText="Creating…"
            onClick={handleSubmit(onSubmit)}
          >
            Add Vendor
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Vendor Code"
          registration={register('code', { required: 'Vendor code is required' })}
          error={errors.code}
          placeholder="e.g. VEN-0001"
        />

        <FormField
          label="Vendor Name"
          registration={register('legalName', { required: 'Vendor name is required' })}
          error={errors.legalName}
          placeholder="e.g. Acme Supplies Ltd."
        />

        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder={isLoadingCurrencies ? 'Loading currencies…' : 'Select currency…'}
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />

        <FormSection title="Contact Person">
          <FormField
            label="Primary Contact Name"
            registration={register('contactName')}
            error={errors.contactName}
            placeholder="e.g. John Mensah"
          />

          <Controller
            name="contactNumber"
            control={control}
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Contact Number"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
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
            placeholder="e.g. john@acmesupplies.com"
          />
        </FormSection>
      </div>
    </SidePanel>
  );
}
