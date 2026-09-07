'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { RiskClassFormValues, RISK_CLASS_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateRiskClass } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddRiskClassPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRiskClassPanel({ isOpen, onClose }: AddRiskClassPanelProps) {
  const toast = useToast();
  const { mutateAsync: createRiskClass, isPending } = useCreateRiskClass();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RiskClassFormValues>({
    defaultValues: RISK_CLASS_FORM_DEFAULTS,
  });

  const handleClose = () => {
    reset(RISK_CLASS_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: RiskClassFormValues) => {
    try {
      await createRiskClass({
        name: data.name,
        description: data.description || undefined,
      });
      toast.success('Risk class created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create risk class'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Risk Class"
      description="Create a new risk class for classification."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Risk Class
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Class Name"
          registration={register('name', { required: 'Class name is required' })}
          error={errors.name}
          placeholder="e.g. Fire, Marine, Motor, etc."
        />

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description', {
            maxLength: { value: 500, message: 'Description cannot exceed 500 characters' },
          })}
          error={errors.description}
          placeholder="e.g. Covers goods transported by sea."
        />
      </div>
    </SidePanel>
  );
}
