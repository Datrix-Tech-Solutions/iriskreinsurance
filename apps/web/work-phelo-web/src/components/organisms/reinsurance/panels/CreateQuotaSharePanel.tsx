'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { QuotaShareFormFields } from '@/components/molecules/reinsurance/forms/QuotaShareFormFields';
import { QuotaShareFormValues, QUOTA_SHARE_DEFAULTS } from '@/types/reinsurance';

interface CreateQuotaSharePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateQuotaSharePanel({ isOpen, onClose }: CreateQuotaSharePanelProps) {
  const form = useForm<QuotaShareFormValues>({ defaultValues: QUOTA_SHARE_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const handleClose = () => {
    reset(QUOTA_SHARE_DEFAULTS);
    onClose();
  };

  const onSubmit = () => {
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Quota Share Treaty"
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
      <QuotaShareFormFields form={form} />
    </SidePanel>
  );
}
