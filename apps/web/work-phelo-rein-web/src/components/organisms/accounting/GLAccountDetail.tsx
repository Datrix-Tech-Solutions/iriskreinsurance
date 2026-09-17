'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { FormField } from '@/components/molecules/shared/FormField';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { Modal } from '@/components/organisms/shared/Modal';
import { useDeactivateGLAccount, useUpdateGLAccount } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { GLAccountLedger } from '@/components/organisms/accounting/GLAccountLedger';
import type { GLAccount } from '@/types/accounting';

interface GLAccountDetailProps {
  account: GLAccount;
}

interface FormValues {
  name: string;
  description: string;
  allowPosting: boolean;
}

const TABS = [
  { key: 'ledger', label: 'Ledger Activity' },
  { key: 'details', label: 'Details' },
];

export function GLAccountDetail({ account }: GLAccountDetailProps) {
  const toast = useToast();
  const { mutateAsync: updateAccount, isPending: isUpdating } = useUpdateGLAccount();
  const { mutateAsync: deactivateAccount, isPending: isDeactivating } = useDeactivateGLAccount();
  const [activeTab, setActiveTab] = useState('ledger');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  const formValues = () => ({
    name: account.name,
    description: account.description ?? '',
    allowPosting: account.allowPosting,
  });

  useEffect(() => {
    reset(formValues());
    setIsEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, reset]);

  const startEditing = () => {
    reset(formValues());
    setIsEditing(true);
  };

  const cancelEditing = () => {
    reset(formValues());
    setIsEditing(false);
  };

  const save = async (values: FormValues) => {
    try {
      await updateAccount({
        id: account.id,
        name: values.name,
        description: values.description || undefined,
        allowPosting: values.allowPosting,
      });
      toast.success('Account updated');
      setIsEditing(false);
    } catch (error) {
      toast.error(extractError(error, 'Unable to update account'));
    }
  };

  const deactivate = async () => {
    try {
      await deactivateAccount(account.id);
      toast.success('Account deactivated');
      setConfirmDeactivateOpen(false);
    } catch (error) {
      toast.error(extractError(error, 'Unable to deactivate account'));
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-end justify-between gap-4 border-b border-gray-200">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="border-b-0"
        />
        <div className="flex items-center gap-3 pb-2 shrink-0">
          <div className="text-right">
            <h3 className="text-sm font-semibold text-gray-900">{account.name}</h3>
            <p className="text-xs text-gray-500">{account.code}</p>
          </div>
          <Badge
            label={account.status}
            variant={account.status === 'ACTIVE' ? 'success' : 'neutral'}
          />
          {account.status === 'ACTIVE' && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmDeactivateOpen(true)}
            >
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'details' ? (
        <div className="flex flex-1 flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Category" value={account.category} />
            <DetailField label="Normal Balance" value={account.normalBalance} />
            <DetailField
              label="Account Group"
              value={
                account.accountGroup
                  ? `${account.accountGroup.code} — ${account.accountGroup.name}`
                  : 'Unclassified'
              }
            />
            <DetailField label="Parent Account" value={account.parentAccount?.name ?? '—'} />
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-5">
            <h4 className="text-sm font-semibold text-gray-900">Account settings</h4>
            {!isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={startEditing}>
                Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit(save)}>
              <FormField
                label="Account Name"
                registration={register('name', { required: 'Account name is required' })}
                error={errors.name}
              />
              <FormField
                label="Description"
                type="textarea"
                rows={4}
                registration={register('description')}
                error={errors.description}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4" {...register('allowPosting')} />
                Allow postings to this account
              </label>

              <div className="mt-2 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={cancelEditing} disabled={isUpdating}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isUpdating} loadingText="Saving…">
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4">
              <DetailField label="Account Name" value={account.name} />
              <DetailField label="Description" value={account.description || '—'} />
              <DetailField
                label="Allow postings to this account"
                value={account.allowPosting ? 'Yes' : 'No'}
              />
            </div>
          )}
        </div>
      ) : (
        <GLAccountLedger accountId={account.id} />
      )}

      <Modal
        isOpen={confirmDeactivateOpen}
        onClose={() => setConfirmDeactivateOpen(false)}
        title="Deactivate account?"
        description={`"${account.name}" will no longer accept new postings. Existing ledger history is preserved. This cannot be undone from here — contact an administrator if you need it reinstated.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmDeactivateOpen(false)}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deactivate}
              isLoading={isDeactivating}
              loadingText="Deactivating…"
            >
              Deactivate
            </Button>
          </>
        }
      />
    </div>
  );
}
