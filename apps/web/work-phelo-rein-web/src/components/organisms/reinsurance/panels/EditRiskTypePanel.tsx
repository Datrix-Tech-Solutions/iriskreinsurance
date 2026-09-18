'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { RiskType } from '@/types/reinsurance';
import { useUpdateRiskType, useCreateRiskTypeField, useDeleteRiskTypeField } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Trash2, Plus } from 'lucide-react';
import { inputClass } from '@/lib/utils';

interface EditRiskTypeFormValues {
  name: string;
  description: string;
  newFields: { label: string }[];
}

function toFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '');
}

interface EditRiskTypePanelProps {
  riskType: RiskType | null;
  onClose: () => void;
}

export function EditRiskTypePanel({ riskType, onClose }: EditRiskTypePanelProps) {
  const toast = useToast();
  const { mutateAsync: updateRiskType, isPending: isUpdating } = useUpdateRiskType();
  const { mutateAsync: createField } = useCreateRiskTypeField();
  const { mutate: deleteField } = useDeleteRiskTypeField();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<EditRiskTypeFormValues>();

  const { fields: newFields, append, remove } = useFieldArray({ control, name: 'newFields' });

  useEffect(() => {
    if (riskType) {
      reset({ name: riskType.name, description: riskType.description ?? '', newFields: [] });
    }
  }, [riskType, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDeleteExistingField = (fieldId: string) => {
    if (!riskType) return;
    deleteField(
      { riskTypeId: riskType.id, fieldId },
      { onError: (err) => toast.error(extractError(err, 'Failed to delete field')) },
    );
  };

  const onSubmit = async (data: EditRiskTypeFormValues) => {
    if (!riskType) return;
    try {
      await updateRiskType({
        id: riskType.id,
        name: data.name,
        description: data.description || undefined,
      });

      const existingCount = riskType.fields?.length ?? 0;
      for (let i = 0; i < data.newFields.length; i++) {
        const f = data.newFields[i];
        const fieldKey = toFieldKey(f.label);
        if (!fieldKey) continue;
        await createField({
          riskTypeId: riskType.id,
          label: f.label,
          fieldKey,
          fieldType: 'TEXT',
          section: 'BUSINESS_DETAILS',
          displayOrder: existingCount + i,
        });
      }

      toast.success('Risk type updated successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update risk type'));
    }
  };

  const existingFields = riskType?.fields ?? [];

  return (
    <SidePanel
      isOpen={!!riskType}
      onClose={handleClose}
      title="Edit Risk Type"
      description="Update the risk type details and manage its fields."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button isLoading={isUpdating} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Risk Type Name"
          registration={register('name', { required: 'Risk type name is required' })}
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

        {(existingFields.length > 0 || newFields.length > 0) && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-gray-900">Fields</p>

            {existingFields.map((f, index) => (
              <div key={f.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Field {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExistingField(f.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-sm text-gray-800">{f.label}</p>
              </div>
            ))}

            {newFields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Field {existingFields.length + index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div>
                  <input
                    {...register(`newFields.${index}.label`, {
                      required: 'Field name is required',
                    })}
                    placeholder="e.g. Coverage Limit"
                    className={inputClass(errors.newFields?.[index]?.label?.message)}
                  />
                  {errors.newFields?.[index]?.label && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.newFields[index]!.label!.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => append({ label: '' })}
          className="flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors w-fit"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>
    </SidePanel>
  );
}
