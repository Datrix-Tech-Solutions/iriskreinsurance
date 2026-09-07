'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { useAccountingCurrencyOptions, useCreateCustomer } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCustomerPanelProps {
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

export function AddCustomerPanel({ isOpen, onClose }: AddCustomerPanelProps) {
  const toast = useToast();
  const createCustomer = useCreateCustomer();
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
      await createCustomer.mutateAsync({
        code: data.code,
        legalName: data.legalName,
        currency: data.currency,
        primaryContactName: data.contactName || undefined,
        phone: data.contactNumber || undefined,
        email: data.email || undefined,
      });
      toast.success('Customer created successfully.');
      handleClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to create customer'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Customer"
      description="Register a new customer to your accounting records."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={createCustomer.isPending}>
            Cancel
          </Button>
          <Button
            isLoading={createCustomer.isPending}
            loadingText="Creating…"
            onClick={handleSubmit(onSubmit)}
          >
            Add Customer
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Customer Code"
          registration={register('code', { required: 'Customer code is required' })}
          error={errors.code}
          placeholder="e.g. CUS-0001"
        />

        <FormField
          label="Customer Name"
          registration={register('legalName', { required: 'Customer name is required' })}
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
