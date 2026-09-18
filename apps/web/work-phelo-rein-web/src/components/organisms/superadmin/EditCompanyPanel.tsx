'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useUpdateTenant } from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';
import {
  COMPANY_SIZE_OPTIONS,
  COUNTRY_CONFIG,
  COUNTRY_OPTIONS,
  INDUSTRY_OPTIONS,
  swapDialCode,
} from '@/lib/CompanyOptions';

interface EditCompanyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: {
    id: string;
    name: string;
    size?: string;
    industry?: string;
    country?: string;
    address?: string;
    phone?: string;
  };
}

interface FormValues {
  name: string;
  size?: string;
  industry?: string;
  country?: string;
  address?: string;
  phone?: string;
}

export function EditCompanyPanel({ isOpen, onClose, tenant }: EditCompanyPanelProps) {
  const toast = useToast();
  const { mutate: updateTenant, isPending } = useUpdateTenant(tenant.id);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (isOpen) {
      reset({
        name: tenant.name,
        size: tenant.size,
        industry: tenant.industry,
        country: tenant.country,
        address: tenant.address,
        phone: tenant.phone,
      });
    }
  }, [isOpen, tenant, reset]);

  const size = useWatch({ control, name: 'size' }) ?? '';
  const industry = useWatch({ control, name: 'industry' }) ?? '';
  const country = useWatch({ control, name: 'country' }) ?? '';
  const phone = useWatch({ control, name: 'phone' }) ?? '';

  const handleCountryChange = (v: string) => {
    setValue('country', v);
    const config = COUNTRY_CONFIG[v];
    if (config) {
      setValue('phone', swapDialCode(phone, config.dialCode));
    }
  };

  const onSubmit = (data: FormValues) => {
    updateTenant(data, {
      onSuccess: () => {
        toast.success('Company updated successfully');
        onClose();
      },
      onError: () => toast.error('Failed to update company'),
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Company"
      description={`Editing ${tenant.name}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            Save Changes
          </Button>
        </div>
      }
    >
      <FormSection title="Company Information">
        <FormField
          label="Company Name"
          registration={register('name', { required: 'Company name is required' })}
          error={errors.name}
          placeholder="eg; Companyname Corp Ltd"
        />
        <SearchSelect
          label="Company Size"
          placeholder="Select size range"
          options={COMPANY_SIZE_OPTIONS}
          value={size}
          onChange={(v) => setValue('size', v)}
        />
        <SearchSelect
          label="Industry"
          placeholder="Select industry"
          options={INDUSTRY_OPTIONS}
          value={industry}
          onChange={(v) => setValue('industry', v)}
        />
        <SearchSelect
          label="Country"
          placeholder="Select country"
          options={COUNTRY_OPTIONS}
          value={country}
          onChange={handleCountryChange}
        />
        <FormField
          label="Address"
          registration={register('address')}
          placeholder="eg; 123 Main Street, Accra"
        />
        <PhoneInput
          label="Contact"
          placeholder="00 000 0000"
          value={phone}
          onChange={(v) => setValue('phone', v)}
        />
      </FormSection>
    </SidePanel>
  );
}
