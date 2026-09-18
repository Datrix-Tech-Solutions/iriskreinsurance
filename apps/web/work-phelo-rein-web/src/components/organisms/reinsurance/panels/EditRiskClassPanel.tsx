'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { RiskClass, RiskClassFormValues } from '@/types/reinsurance';
import { useUpdateRiskClass } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface EditRiskClassPanelProps {
  riskClass: RiskClass | null;
  onClose: () => void;
}

export function EditRiskClassPanel({ riskClass, onClose }: EditRiskClassPanelProps) {
  const toast = useToast();
  const { mutateAsync: updateRiskClass, isPending } = useUpdateRiskClass();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RiskClassFormValues>();

  useEffect(() => {
    if (riskClass) {
      reset({
        name: riskClass.name,
        description: riskClass.description ?? '',
      });
    }
  }, [riskClass, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: RiskClassFormValues) => {
    if (!riskClass) return;
    try {
      await updateRiskClass({
        id: riskClass.id,
        name: data.name,
        description: data.description || undefined,
      });
      toast.success('Risk class updated successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update risk class'));
    }
  };

  return (
    <SidePanel
      isOpen={!!riskClass}
      onClose={handleClose}
      title="Edit Risk Class"
      description="Update the name or description of this risk class."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Class Name"
          registration={register('name', { required: 'Class name is required' })}
          error={errors.name}
          placeholder="e.g. Marine Cargo"
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
