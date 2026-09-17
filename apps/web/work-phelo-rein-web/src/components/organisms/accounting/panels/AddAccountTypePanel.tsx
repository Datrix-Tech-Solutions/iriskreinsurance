'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';

interface AddAccountTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  name: string;
  description: string;
};

const DEFAULTS: FormValues = {
  name: '',
  description: '',
};

export function AddAccountTypePanel({ isOpen, onClose }: AddAccountTypePanelProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = () => {
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Account Type"
      description="Create a new account type for classifying accounts."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Add Account Type</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Account Type Name"
          registration={register('name', { required: 'Account type name is required' })}
          error={errors.name}
          placeholder="e.g. Fixed Asset"
        />

        <FormField
          label="Description"
          type="textarea"
          rows={4}
          registration={register('description')}
          error={errors.description}
          placeholder="Provide a brief description of this account type…"
        />
      </div>
    </SidePanel>
  );
}
