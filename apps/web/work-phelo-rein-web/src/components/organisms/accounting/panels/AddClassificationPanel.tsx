'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { GLAccountCategory } from '@/types/accounting';
import { useCreateAccountClassification } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddClassificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  accountName: string;
  accountType: GLAccountCategory | '';
  accountCode: string;
};

const DEFAULTS: FormValues = {
  accountName: '',
  accountType: '',
  accountCode: '',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
];

export function AddClassificationPanel({ isOpen, onClose }: AddClassificationPanelProps) {
  const toast = useToast();
  const { mutateAsync: createClassification, isPending } = useCreateAccountClassification();

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

  const onSubmit = async (data: FormValues) => {
    try {
      await createClassification({
        name: data.accountName,
        category: data.accountType as GLAccountCategory,
        code: data.accountCode,
      });
      toast.success('Classification created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create classification'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Classification"
      description="Add a new classification for grouping accounts in the chart of accounts."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Add Classification
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Account Name"
          registration={register('accountName', { required: 'Account name is required' })}
          error={errors.accountName}
          placeholder="e.g. Current Assets"
        />

        <Controller
          name="accountType"
          control={control}
          rules={{ required: 'Account type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Account Type"
              placeholder="Select account type…"
              options={TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountType?.message}
            />
          )}
        />

        <FormField
          label="Account Code"
          type="number"
          registration={register('accountCode', { required: 'Account code is required' })}
          error={errors.accountCode}
          placeholder="e.g. 1000"
        />
      </div>
    </SidePanel>
  );
}
