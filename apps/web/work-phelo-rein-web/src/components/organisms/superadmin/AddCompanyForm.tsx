'use client';

import { useForm } from 'react-hook-form';
import { useRegisterTenant } from '@/hooks/useTenants';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SearchSelect } from '../../atoms/SearchSelect';
import { useState } from 'react';
import {
  COMPANY_SIZE_OPTIONS,
  COUNTRY_CONFIG,
  COUNTRY_OPTIONS,
  INDUSTRY_OPTIONS,
  swapDialCode,
} from '@/lib/CompanyOptions';

interface AddCompanyPayload {
  name: string;
  email: string;
  slug: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  address?: string;
  currency?: string;
  industry?: string;
  customIndustry?: string;
  size?: string;
}

interface AddCompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function AddCompanyInner({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [phone, setPhone] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddCompanyPayload>();

  const { mutate: registerTenant, isPending } = useRegisterTenant();

  const handleCountryChange = (v: string) => {
    setCountry(v);
    setValue('country', v);

    const config = COUNTRY_CONFIG[v];
    if (config) {
      // Swap dial code while preserving any number already typed
      const updatedPhone = swapDialCode(phone, config.dialCode);
      setPhone(updatedPhone);
      setValue('phone', updatedPhone);

      // Auto-fill currency only if not yet manually chosen
      if (!currency) {
        setCurrency(config.currency);
        setValue('currency', config.currency);
      }
    }
  };

  const onSubmit = (data: AddCompanyPayload) => {
    const payload = { ...data, slug: generateSlug(data.name) };
    if (payload.industry === 'Other' && payload.customIndustry) {
      payload.industry = payload.customIndustry;
    }
    delete payload.customIndustry;

    registerTenant(payload, {
      onSuccess: (_, vars) => {
        onSuccess(vars.name);
        onClose();
      },
    });
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Add New Company"
      description="Add a new company to onboard them onto WorkPhelo."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            isLoading={isPending}
            loadingText="Saving..."
            onClick={handleSubmit(onSubmit)}
          >
            Save
          </Button>
        </div>
      }
    >
      {/* Company Information */}
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
          onChange={(v) => {
            setSize(v);
            setValue('size', v);
          }}
          error={errors.size?.message}
        />
        <SearchSelect
          label="Select Industry"
          placeholder="Industry"
          options={INDUSTRY_OPTIONS}
          value={industry}
          onChange={(v) => {
            setIndustry(v);
            setValue('industry', v);
            if (v !== 'Other') setValue('customIndustry', undefined);
          }}
        />
        {industry === 'Other' && (
          <FormField
            label="Please specify industry"
            registration={register('customIndustry', { required: 'Please specify your industry' })}
            error={errors.customIndustry}
            placeholder="eg; Space Tourism"
          />
        )}
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
          placeholder="eg; 12 Independence Ave, Accra"
        />
      </FormSection>

      {/* Administrator Information */}
      <FormSection title="Administrator Information">
        <FormField
          label="First Name"
          registration={register('firstName', { required: 'First name is required' })}
          error={errors.firstName}
          placeholder="eg; Daniel"
        />
        <FormField
          label="Last Name"
          registration={register('lastName', { required: 'Last name is required' })}
          error={errors.lastName}
          placeholder="eg; Asante"
        />
        <PhoneInput
          label="Contact"
          placeholder="00 000 0000"
          value={phone}
          onChange={(v) => {
            setPhone(v);
            setValue('phone', v);
          }}
        />
        <FormField
          label="Email Address"
          registration={register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
          })}
          error={errors.email}
          type="email"
          placeholder="eg; name@companydomain.com"
        />
      </FormSection>
    </SidePanel>
  );
}

export function AddCompanyForm({ isOpen, onClose }: AddCompanyFormProps) {
  const [successCompany, setSuccessCompany] = useState<string | null>(null);

  return (
    <>
      <SuccessModal
        isOpen={!!successCompany}
        onClose={() => setSuccessCompany(null)}
        title="Company Created!"
        message={`${successCompany} has been onboarded successfully. An invite will be sent to the administrator.`}
        actionLabel="Done"
      />
      {isOpen ? (
        <AddCompanyInner onClose={onClose} onSuccess={(name) => setSuccessCompany(name)} />
      ) : (
        <SidePanel isOpen={false} onClose={onClose} title="">
          {null}
        </SidePanel>
      )}
    </>
  );
}
