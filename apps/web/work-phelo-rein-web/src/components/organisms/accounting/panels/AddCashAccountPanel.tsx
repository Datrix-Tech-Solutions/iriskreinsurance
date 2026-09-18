'use client';

import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingCashAccountKind } from '@/types/accounting';
import { useAccountingCurrencyOptions, useCreateCashAccount, useGLAccountOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddCashAccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = {
  name: string;
  accountKind: AccountingCashAccountKind | '';
  currency: string;
  glAccountId: string;
  bankName: string;
  accountNumber: string;
  branch: string;
  description: string;
};

const DEFAULTS: FormValues = {
  name: '',
  accountKind: '',
  currency: '',
  glAccountId: '',
  bankName: '',
  accountNumber: '',
  branch: '',
  description: '',
};

const KIND_OPTIONS: SearchSelectOption[] = [
  { value: 'BANK', label: 'Bank' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'OTHER', label: 'Other' },
];

export function AddCashAccountPanel({ isOpen, onClose }: AddCashAccountPanelProps) {
  const toast = useToast();
  const { mutateAsync: createCashAccount, isPending } = useCreateCashAccount();
  // Only active, posting-enabled ASSET accounts can back a cash/bank account.
  const { options: glAccountOptions, isLoading: isLoadingGLAccounts } = useGLAccountOptions({
    category: 'ASSET',
  });
  // Currency choices come from the tenant's configured currencies (Settings > Currency).
  const { options: currencyOptions, isLoading: isLoadingCurrencies } =
    useAccountingCurrencyOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const accountKind = useWatch({ control, name: 'accountKind' });

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await createCashAccount({
        name: data.name,
        accountKind: data.accountKind as AccountingCashAccountKind,
        currency: data.currency,
        glAccountId: data.glAccountId,
        bankName: data.bankName || undefined,
        accountNumber: data.accountNumber || undefined,
        branch: data.branch || undefined,
        description: data.description || undefined,
      });
      toast.success('Cash account created successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create cash account'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Cash/Bank Account"
      description="Add a bank, cash or mobile money account and link it to a GL asset account."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Account
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Account Name"
          registration={register('name', { required: 'Account name is required' })}
          error={errors.name}
          placeholder="e.g. Ecobank Current Account"
        />

        <Controller
          name="accountKind"
          control={control}
          rules={{ required: 'Account type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Account Type"
              placeholder="Select account type…"
              options={KIND_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountKind?.message}
            />
          )}
        />

        <div className="flex flex-col gap-1">
          <Controller
            name="currency"
            control={control}
            rules={{ required: 'Currency is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Currency"
                placeholder={isLoadingCurrencies ? 'Loading…' : 'Select currency…'}
                options={currencyOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.currency?.message}
              />
            )}
          />
          {!isLoadingCurrencies && currencyOptions.length === 0 && (
            <span className="text-xs text-amber-700">
              No active currency is configured. Add one under Settings &gt; Currency first.
            </span>
          )}
        </div>

        <Controller
          name="glAccountId"
          control={control}
          rules={{ required: 'GL asset account is required' }}
          render={({ field }) => (
            <SearchSelect
              label="GL Asset Account"
              placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select GL asset account…'}
              options={glAccountOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.glAccountId?.message}
            />
          )}
        />

        {accountKind === 'BANK' && (
          <>
            <FormField
              label="Bank Name"
              registration={register('bankName')}
              error={errors.bankName}
              placeholder="e.g. Ecobank Ghana"
            />
            <FormField
              label="Branch"
              registration={register('branch')}
              error={errors.branch}
              placeholder="e.g. Accra Main"
            />
          </>
        )}

        {accountKind !== 'CASH' && (
          <FormField
            label="Account Number"
            registration={register('accountNumber')}
            error={errors.accountNumber}
            placeholder="Masked identifier, e.g. ****1234"
          />
        )}

        <FormField
          label="Description"
          type="textarea"
          rows={3}
          registration={register('description')}
          error={errors.description}
          placeholder="Optional notes about this account"
        />
      </div>
    </SidePanel>
  );
}
