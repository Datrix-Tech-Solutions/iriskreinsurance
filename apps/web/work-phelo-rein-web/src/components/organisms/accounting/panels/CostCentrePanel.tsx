'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCreateCostCentre, useUpdateCostCentre } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import type { CostCentre } from '@/types/accounting';

type FormValues = { code: string; name: string; description: string; externalRef: string };
const DEFAULTS: FormValues = { code: '', name: '', description: '', externalRef: '' };

export function CostCentrePanel({
  costCentre,
  onClose,
}: {
  costCentre: CostCentre | null | undefined;
  onClose: () => void;
}) {
  const isEditing = costCentre !== null && costCentre !== undefined;
  const toast = useToast();
  const { mutateAsync: create, isPending: isCreating } = useCreateCostCentre();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateCostCentre();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (costCentre)
      reset({
        code: costCentre.code,
        name: costCentre.name,
        description: costCentre.description ?? '',
        externalRef: costCentre.externalRef ?? '',
      });
    else reset(DEFAULTS);
  }, [costCentre, reset]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };
  const submit = async (values: FormValues) => {
    try {
      const payload = {
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        externalRef: values.externalRef || undefined,
      };
      if (costCentre) await update({ id: costCentre.id, ...payload });
      else await create(payload);
      toast.success(
        isEditing ? 'Cost centre updated successfully' : 'Cost centre created successfully',
      );
      close();
    } catch (error) {
      toast.error(extractError(error, `Unable to ${isEditing ? 'update' : 'create'} cost centre`));
    }
  };

  return (
    <SidePanel
      isOpen={costCentre !== undefined}
      onClose={close}
      title={isEditing ? 'Update Cost Centre' : 'Add Cost Centre'}
      description="Use cost centres to tag journal lines for management reporting."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isCreating || isUpdating}>
            Cancel
          </Button>
          <Button
            isLoading={isCreating || isUpdating}
            loadingText="Saving…"
            onClick={handleSubmit(submit)}
          >
            {isEditing ? 'Save Changes' : 'Add Cost Centre'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Code"
          registration={register('code', {
            required: 'Code is required',
            maxLength: { value: 30, message: 'Code must be 30 characters or fewer' },
            setValueAs: (value: string) => value.toUpperCase(),
          })}
          error={errors.code}
          placeholder="e.g. ACC"
        />
        <FormField
          label="Name"
          registration={register('name', {
            required: 'Name is required',
            maxLength: { value: 160, message: 'Name must be 160 characters or fewer' },
          })}
          error={errors.name}
          placeholder="e.g. Accra Branch"
        />
        <FormField
          label="Description"
          registration={register('description', {
            maxLength: { value: 500, message: 'Description must be 500 characters or fewer' },
          })}
          error={errors.description}
          placeholder="Optional description"
        />
        <FormField
          label="External Reference"
          registration={register('externalRef', {
            maxLength: { value: 100, message: 'Reference must be 100 characters or fewer' },
          })}
          error={errors.externalRef}
          placeholder="Optional branch or department ID"
        />
      </div>
    </SidePanel>
  );
}
