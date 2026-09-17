'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { ENTITY_ACCOUNTING_RELATION_LABELS, EntityAccountingRelation } from '@/types/accounting';
import { useCreateEntityType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddEntityTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  name: string;
  accountingRelation: EntityAccountingRelation | '';
};

const DEFAULTS: FormValues = { name: '', accountingRelation: '' };

const RELATION_OPTIONS: SearchSelectOption[] = (
  Object.entries(ENTITY_ACCOUNTING_RELATION_LABELS) as [EntityAccountingRelation, string][]
).map(([value, label]) => ({ value, label }));

export function AddEntityTypePanel({ isOpen, onClose }: AddEntityTypePanelProps) {
  const toast = useToast();
  const { mutateAsync: createEntityType, isPending } = useCreateEntityType();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await createEntityType({
        name: values.name,
        accountingRelation: values.accountingRelation as EntityAccountingRelation,
      });
      toast.success('Type created successfully');
      handleClose();
    } catch (error) {
      toast.error(extractError(error, 'Failed to create type'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Type"
      description="Define a new entity type and the accounting relation it maps to."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Adding…" onClick={handleSubmit(onSubmit)}>
            Add Type
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Name"
          registration={register('name', { required: 'Name is required' })}
          error={errors.name}
          placeholder="e.g. Landlord"
        />

        <Controller
          name="accountingRelation"
          control={control}
          rules={{ required: 'Accounting relation is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Accounting Relation"
              placeholder="Select relation…"
              options={RELATION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountingRelation?.message}
            />
          )}
        />
      </div>
    </SidePanel>
  );
}
