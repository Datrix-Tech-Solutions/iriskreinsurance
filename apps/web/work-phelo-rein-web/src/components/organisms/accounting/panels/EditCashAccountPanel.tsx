'use client';

import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingCashAccount, AccountingCashAccountKind } from '@/types/accounting';
import { useAccountingCurrencyOptions, useGLAccountOptions, useUpdateCashAccount } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface EditCashAccountPanelProps {
  account: AccountingCashAccount | null;
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

function toFormValues(account: AccountingCashAccount): FormValues {
  return {
    name: account.name,
    accountKind: account.accountKind,
    currency: account.currency,
    glAccountId: account.glAccountId,
    bankName: account.bankName ?? '',
    accountNumber: account.accountNumber ?? '',
    branch: account.branch ?? '',
    description: account.description ?? '',
  };
}

export function EditCashAccountPanel({ account, onClose }: EditCashAccountPanelProps) {
  const toast = useToast();
  const { mutateAsync: updateCashAccount, isPending } = useUpdateCashAccount();
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

  useEffect(() => {
    if (account) reset(toFormValues(account));
  }, [account, reset]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    if (!account) return;
    try {
      await updateCashAccount({
        id: account.id,
        name: data.name,
        accountKind: data.accountKind as AccountingCashAccountKind,
        currency: data.currency,
        glAccountId: data.glAccountId,
        bankName: data.bankName || undefined,
        accountNumber: data.accountNumber || undefined,
        branch: data.branch || undefined,
        description: data.description || undefined,
      });
      toast.success('Cash account updated successfully');
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update cash account'));
    }
  };

  return (
    <SidePanel
      isOpen={!!account}
      onClose={handleClose}
      title="Update Cash/Bank Account"
      description="Update this account's details. Its currency and GL link should stay accurate for postings."
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
