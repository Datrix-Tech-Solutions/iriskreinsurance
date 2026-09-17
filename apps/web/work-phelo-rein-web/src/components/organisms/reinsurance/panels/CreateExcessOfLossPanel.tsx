'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { ExcessOfLossFormFields } from '@/components/molecules/reinsurance/forms/ExcessOfLossFormFields';
import {
  ExcessOfLossFormValues,
  EXCESS_OF_LOSS_DEFAULTS,
  DEFAULT_TREATY_LAYER,
} from '@/types/reinsurance';

interface CreateExcessOfLossPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateExcessOfLossPanel({ isOpen, onClose }: CreateExcessOfLossPanelProps) {
  const form = useForm<ExcessOfLossFormValues>({
    defaultValues: {
      ...EXCESS_OF_LOSS_DEFAULTS,
      layers: [{ ...DEFAULT_TREATY_LAYER }],
    },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const handleClose = () => {
    reset({
      ...EXCESS_OF_LOSS_DEFAULTS,
      layers: [{ ...DEFAULT_TREATY_LAYER }],
    });
    onClose();
  };

  // TODO: wire to API mutation when excess of loss endpoints are ready
  const onSubmit = (_values: ExcessOfLossFormValues) => {
    void _values;
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Excess of Loss Treaty"
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
      <ExcessOfLossFormFields form={form} />
    </SidePanel>
  );
}
