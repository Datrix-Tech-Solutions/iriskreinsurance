'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FacObligatoryFormFields } from '@/components/molecules/reinsurance/forms/FacObligatoryFormFields';
import { FacObligatoryFormValues, FAC_OBLIGATORY_DEFAULTS } from '@/types/reinsurance';

interface CreateFacObligatoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateFacObligatoryPanel({ isOpen, onClose }: CreateFacObligatoryPanelProps) {
  const form = useForm<FacObligatoryFormValues>({ defaultValues: FAC_OBLIGATORY_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const handleClose = () => {
    reset(FAC_OBLIGATORY_DEFAULTS);
    onClose();
  };

  // TODO: wire to API mutation when fac. obligatory endpoints are ready
  const onSubmit = () => {
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Fac. Obligatory Treaty"
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
      <FacObligatoryFormFields form={form} />
    </SidePanel>
  );
}
