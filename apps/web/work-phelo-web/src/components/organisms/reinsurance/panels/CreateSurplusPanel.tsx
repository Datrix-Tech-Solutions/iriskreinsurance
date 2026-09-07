'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SurplusFormFields } from '@/components/molecules/reinsurance/forms/SurplusFormFields';
import { SurplusFormValues, SURPLUS_DEFAULTS } from '@/types/reinsurance';

interface CreateSurplusPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSurplusPanel({ isOpen, onClose }: CreateSurplusPanelProps) {
  const form = useForm<SurplusFormValues>({ defaultValues: SURPLUS_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const handleClose = () => {
    reset(SURPLUS_DEFAULTS);
    onClose();
  };

  const onSubmit = () => {
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Surplus Treaty"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Treaty
          </Button>
        </div>
      }
    >
      <SurplusFormFields form={form} />
    </SidePanel>
  );
}
