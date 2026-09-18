'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { useUpdateTenantAdmin } from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';

interface EditAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  admin?: { name: string; email: string };
  onSuccess?: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
}

export function EditAdminPanel({
  isOpen,
  onClose,
  tenantId,
  admin,
  onSuccess,
}: EditAdminPanelProps) {
  const toast = useToast();
  const { mutate: updateAdmin, isPending } = useUpdateTenantAdmin(tenantId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (isOpen && admin) {
      const [firstName = '', ...rest] = admin.name.split(' ');
      reset({ firstName, lastName: rest.join(' '), email: admin.email });
    } else if (isOpen) {
      reset({ firstName: '', lastName: '', email: '' });
    }
  }, [isOpen, admin, reset]);

  const onSubmit = (data: FormValues) => {
    updateAdmin(data, {
      onSuccess: () => {
        toast.success('Administrator updated successfully');
        onSuccess?.();
        onClose();
      },
      onError: () => toast.error('Failed to update administrator'),
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={admin ? 'Update Administrator' : 'Assign Administrator'}
      description="Set the administrator for this company."
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
      <FormSection title="Administrator Details">
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
        <FormField
          label="Email Address"
          type="email"
          registration={register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
          })}
          error={errors.email}
          placeholder="eg; name@companydomain.com"
        />
      </FormSection>
    </SidePanel>
  );
}
