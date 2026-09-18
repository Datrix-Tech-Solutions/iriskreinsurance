'use client';

import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { RiskTypeFormValues, RISK_TYPE_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateRiskType, useCreateRiskTypeField, useRiskClassOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Trash2, Plus } from 'lucide-react';
import { inputClass } from '@/lib/utils';

function toFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '');
}

interface AddRiskTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRiskClassId?: string;
}

export function AddRiskTypePanel({
  isOpen,
  onClose,
  defaultRiskClassId = '',
}: AddRiskTypePanelProps) {
  const toast = useToast();
  const { mutateAsync: createRiskType, isPending: isCreating } = useCreateRiskType();
  const { mutateAsync: createField } = useCreateRiskTypeField();
  const { data: riskClassOptions = [] } = useRiskClassOptions();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RiskTypeFormValues>({
    defaultValues: { ...RISK_TYPE_FORM_DEFAULTS, riskClassId: defaultRiskClassId },
  });

  const riskClassId = useWatch({ control, name: 'riskClassId' });
  const { fields, append, remove } = useFieldArray({ control, name: 'customFields' });

  const handleClose = () => {
    reset(RISK_TYPE_FORM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: RiskTypeFormValues) => {
    try {
      const newRiskType = await createRiskType({
        name: data.name,
        riskClassId: data.riskClassId,
      });

      for (let i = 0; i < data.customFields.length; i++) {
        const f = data.customFields[i];
        const fieldKey = toFieldKey(f.label);
        if (!fieldKey) continue;
        await createField({
          riskTypeId: newRiskType.id,
          label: f.label,
          fieldKey,
          fieldType: 'TEXT',
          section: 'BUSINESS_DETAILS',
          displayOrder: i,
        });
      }

      toast.success('Risk type created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create risk type'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Risk Type"
      description="Create a new risk type and define its fields."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button isLoading={isCreating} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Risk Type
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Risk Type Name"
          registration={register('name', { required: 'Risk type name is required' })}
          error={errors.name}
          placeholder="e.g. Fire & Allied Perils"
        />

        <SearchSelect
          label="Risk Class"
          placeholder="Select a risk class…"
          value={riskClassId}
          onChange={(v) => setValue('riskClassId', v)}
          options={riskClassOptions}
          error={errors.riskClassId?.message}
        />

        {fields.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-gray-900">Fields</p>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Field {index + 1}</span>
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
                    {...register(`customFields.${index}.label`, {
                      required: 'Field name is required',
                    })}
                    placeholder="e.g. Coverage Limit"
                    className={inputClass(errors.customFields?.[index]?.label?.message)}
                  />
                  {errors.customFields?.[index]?.label && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.customFields[index]!.label!.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => append({ label: '', value: '' })}
          className="flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors w-fit"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>
    </SidePanel>
  );
}
