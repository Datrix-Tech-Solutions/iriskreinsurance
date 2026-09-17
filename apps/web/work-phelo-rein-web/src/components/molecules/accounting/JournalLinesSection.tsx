'use client';

import { useState } from 'react';
import { useFieldArray, useWatch, Controller, UseFormReturn } from 'react-hook-form';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Icons } from '@/components/atoms/icons';
import { cn, inputClass } from '@/lib/utils';
import { InlineTable, InlineTableColumn } from '@/components/organisms/shared/InlineTable';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { AddEntityPanel } from '@/components/organisms/accounting/panels/AddEntityPanel';
import { JournalEntryFormValues, JournalLine, SubledgerType } from '@/types/accounting';
import { useGLAccountOptions, useSubledgers } from '@/hooks';

const EMPTY_LINE: JournalLine = {
  targetAccount: '',
  subledgerAccountId: '',
  description: '',
  debit: '',
  credit: '',
};

// A journal line's subledger is a client or supplier relationship, not an employee/statutory/
// other entity — narrow the quick-create panel to those two types.
const CUSTOMER_VENDOR_TYPES: SubledgerType[] = ['CUSTOMER', 'VENDOR'];

function fmtAmount(value: number, currency: string) {
  const n = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${n}` : n;
}

interface JournalLinesSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
}

export function JournalLinesSection({ form }: JournalLinesSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const [createAccountForIndex, setCreateAccountForIndex] = useState<number | null>(null);
  const [createAccountQuery, setCreateAccountQuery] = useState('');

  // Same idea for the subledger column's "create customer/vendor" action — also needs to
  // remember which control account the new entity must be pinned to.
  const [createSubledgerForIndex, setCreateSubledgerForIndex] = useState<number | null>(null);
  const [createSubledgerQuery, setCreateSubledgerQuery] = useState('');
  const [createSubledgerControlAccount, setCreateSubledgerControlAccount] = useState({
    id: '',
    label: '',
  });

  const lines = useWatch({ control, name: 'lines' });
  const currency = useWatch({ control, name: 'currency' });
  const { options: accountOptions, isLoading: isLoadingAccounts } = useGLAccountOptions();

  const { data: subledgers = [] } = useSubledgers();
  const controlAccountIds = new Set(subledgers.map((s) => s.controlAccountId));
  const subledgerOptionsByControlAccount = new Map<string, { value: string; label: string }[]>();
  for (const s of subledgers) {
    const list = subledgerOptionsByControlAccount.get(s.controlAccountId) ?? [];
    list.push({ value: s.id, label: `${s.code} – ${s.name}` });
    subledgerOptionsByControlAccount.set(s.controlAccountId, list);
  }

  const debitTotal = (lines ?? []).reduce((sum, l) => sum + (Number(l?.debit) || 0), 0);
  const creditTotal = (lines ?? []).reduce((sum, l) => sum + (Number(l?.credit) || 0), 0);
  const difference = debitTotal - creditTotal;
  const isBalanced = difference === 0;

  const columns: InlineTableColumn[] = [
    {
      key: 'targetAccount',
      label: 'Target Account',
      width: 'minmax(120px,1fr)',
      renderField: (index) => {
        const err = errors.lines?.[index]?.targetAccount;
        return (
          <Controller
            name={`lines.${index}.targetAccount`}
            control={control}
            rules={{ required: 'Account is required' }}
            render={({ field }) => (
              <SearchSelect
                placeholder={isLoadingAccounts ? 'Loading…' : 'Select account…'}
                options={accountOptions}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);

                  form.setValue(`lines.${index}.subledgerAccountId`, '');
                }}
                error={err?.message}
                size="sm"
                emptyState={({ query, close }) => (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCreateAccountQuery(query);
                      setCreateAccountForIndex(index);
                      close();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-brand hover:bg-gray-300 transition-colors"
                  >
                    <Icons.Plus className="w-4 h-4 shrink-0" />
                    <span>
                      No account found — <span className="font-semibold">Create account</span>
                    </span>
                  </button>
                )}
              />
            )}
          />
        );
      },
    },
    {
      key: 'subledgerAccountId',
      label: 'Subledger',
      width: 'minmax(120px,1fr)',
      renderField: (index) => {
        const targetAccount = lines?.[index]?.targetAccount ?? '';
        const isControlAccount = controlAccountIds.has(targetAccount);
        const err = errors.lines?.[index]?.subledgerAccountId;

        return (
          <Controller
            name={`lines.${index}.subledgerAccountId`}
            control={control}
            rules={{
              validate: (value) =>
                !isControlAccount ||
                !!value ||
                'Subledger account is required for this control account',
            }}
            render={({ field }) =>
              isControlAccount ? (
                <SearchSelect
                  placeholder="Select subledger…"
                  options={subledgerOptionsByControlAccount.get(targetAccount) ?? []}
                  value={field.value}
                  onChange={field.onChange}
                  error={err?.message}
                  size="sm"
                  emptyState={({ query, close }) => (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCreateSubledgerQuery(query);
                        setCreateSubledgerControlAccount({
                          id: targetAccount,
                          label: accountOptions.find((o) => o.value === targetAccount)?.label ?? '',
                        });
                        setCreateSubledgerForIndex(index);
                        close();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-brand hover:bg-gray-300 transition-colors"
                    >
                      <Icons.Plus className="w-4 h-4 shrink-0" />
                      <span>
                        No subledger found —{' '}
                        <span className="font-semibold">Create customer/vendor</span>
                      </span>
                    </button>
                  )}
                />
              ) : (
                <span className="block px-3 py-2 text-sm text-gray-400">N/A</span>
              )
            }
          />
        );
      },
    },
    {
      key: 'description',
      label: 'Description',
      width: '170px',
      renderField: (index) => (
        <input
          {...register(`lines.${index}.description`)}
          placeholder="Line description…"
          className={inputClass(undefined, 'py-2 text-sm')}
        />
      ),
    },
    {
      key: 'debit',
      label: 'Debit',
      width: '100px',
      align: 'right',
      renderField: (index) => {
        const err = errors.lines?.[index]?.debit;
        return (
          <input
            {...register(`lines.${index}.debit`, { valueAsNumber: true })}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={inputClass(err ? 'error' : undefined, 'py-2 text-sm text-right')}
          />
        );
      },
      renderFooter: () => (
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtAmount(debitTotal, currency)}</span>
        </div>
      ),
    },
    {
      key: 'credit',
      label: 'Credit',
      width: '100px',
      align: 'right',
      renderField: (index) => {
        const err = errors.lines?.[index]?.credit;
        return (
          <input
            {...register(`lines.${index}.credit`, { valueAsNumber: true })}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={inputClass(err ? 'error' : undefined, 'py-2 text-sm text-right')}
          />
        );
      },
      renderFooter: () => (
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtAmount(creditTotal, currency)}</span>
        </div>
      ),
    },
  ];

  return (
    <>
      <InlineTable
        title="Journal Lines"
        addLabel="Add Line"
        columns={columns}
        fieldIds={fields.map((f) => f.id)}
        onAddRow={() => append({ ...EMPTY_LINE })}
        onRemoveRow={(index) => remove(index)}
        footerNote={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Difference
            </span>
            <span
              className={cn('text-sm font-semibold', isBalanced ? 'text-gray-900' : 'text-red-600')}
            >
              {fmtAmount(Math.abs(difference), currency)}
            </span>
          </div>
        }
      />

      <AddLeafAccountPanel
        isOpen={createAccountForIndex !== null}
        onClose={() => setCreateAccountForIndex(null)}
        initialName={createAccountQuery}
        onCreated={(account) => {
          if (createAccountForIndex === null) return;
          form.setValue(`lines.${createAccountForIndex}.targetAccount`, account.id);
          form.setValue(`lines.${createAccountForIndex}.subledgerAccountId`, '');
        }}
      />

      <AddEntityPanel
        isOpen={createSubledgerForIndex !== null}
        onClose={() => setCreateSubledgerForIndex(null)}
        initialName={createSubledgerQuery}
        initialControlAccountId={createSubledgerControlAccount.id}
        initialControlAccountLabel={createSubledgerControlAccount.label}
        allowedTypes={CUSTOMER_VENDOR_TYPES}
        onCreated={(subledger) => {
          if (createSubledgerForIndex === null) return;
          form.setValue(`lines.${createSubledgerForIndex}.subledgerAccountId`, subledger.id);
        }}
      />
    </>
  );
}
