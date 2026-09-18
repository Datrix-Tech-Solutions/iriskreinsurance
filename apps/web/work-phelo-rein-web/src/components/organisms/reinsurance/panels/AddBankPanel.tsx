'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { BankFormValues, BANK_FORM_DEFAULTS } from '@/types/reinsurance';

interface AddBankPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: BankFormValues) => void;
  isPending?: boolean;
}

export function AddBankPanel({ isOpen, onClose, onAdd, isPending = false }: AddBankPanelProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BankFormValues>({
    defaultValues: BANK_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(BANK_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = (data: BankFormValues) => {
    onAdd(data);
    reset(BANK_FORM_DEFAULTS);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Bank"
      description="Add a new bank account to the system."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Bank
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Account Name"
          registration={register('accountName', { required: 'Account name is required' })}
          error={errors.accountName}
          placeholder="e.g. Main Operations Account"
        />

        <FormField
          label="Account Number"
          registration={register('accountNumber', { required: 'Account number is required' })}
          error={errors.accountNumber}
          placeholder="e.g. 0012345678"
        />

        <FormField
          label="Bank Name"
          registration={register('bankName', { required: 'Bank name is required' })}
          error={errors.bankName}
          placeholder="e.g. Ghana Commercial Bank"
        />

        <FormField
          label="Branch Name"
          registration={register('branchName', { required: 'Branch name is required' })}
          error={errors.branchName}
          placeholder="e.g. Accra Main Branch"
        />
      </div>
    </SidePanel>
  );
}
