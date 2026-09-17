'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import {
  MANUAL_SUBLEDGER_TYPES,
  SUBLEDGER_TYPE_LABELS,
  SubledgerAccount,
  SubledgerType,
} from '@/types/accounting';
import {
  useAccountingConfig,
  useAccountingCurrencies,
  useCreateSubledger,
  useGLAccounts,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AddEntityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fills the entity name — e.g. with what the caller had already typed while
   *  searching for a subledger that didn't exist yet. */
  initialName?: string;
  /** Pins the entity to a specific control account instead of leaving it up to the user —
   *  e.g. when creating one for a journal line that's already targeting that account. When
   *  set, the Control Account field is shown read-only (must be paired with
   *  `initialControlAccountLabel` for a readable display). */
  initialControlAccountId?: string;
  initialControlAccountLabel?: string;
  /** Restricts the Entity Type dropdown to a subset — e.g. `['CUSTOMER', 'VENDOR']` for a
   *  quick-add flow that shouldn't also offer Employee/Statutory/Other. Defaults to every
   *  manually-creatable type. */
  allowedTypes?: SubledgerType[];
  /** Fires with the newly created subledger after a successful save, before the panel
   *  closes — lets a caller (e.g. a journal line picker) select it immediately instead of
   *  making the user reopen the dropdown and search again. */
  onCreated?: (subledger: SubledgerAccount) => void;
}

type FormValues = {
  code: string;
  name: string;
  type: SubledgerType | '';
  controlAccountId: string;
  currency: string;
};

const DEFAULTS: FormValues = {
  code: '',
  name: '',
  type: '',
  controlAccountId: '',
  currency: '',
};

export function AddEntityPanel({
  isOpen,
  onClose,
  initialName,
  initialControlAccountId,
  initialControlAccountLabel,
  allowedTypes,
  onCreated,
}: AddEntityPanelProps) {
  const toast = useToast();
  const { mutateAsync: createSubledger, isPending } = useCreateSubledger();
  const { data: glAccounts, isLoading: isLoadingAccounts } = useGLAccounts({ status: 'ACTIVE' });
  const { data: currencies, isLoading: isLoadingCurrencies } = useAccountingCurrencies();
  const { data: config } = useAccountingConfig();

  const typeOptions: SearchSelectOption[] = (allowedTypes ?? MANUAL_SUBLEDGER_TYPES).map(
    (type) => ({ value: type, label: SUBLEDGER_TYPE_LABELS[type] }),
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  // Seed the name and (when the caller already knows it) the control account each time the
  // panel opens.
  useEffect(() => {
    if (isOpen) {
      reset({
        ...DEFAULTS,
        name: initialName ?? '',
        controlAccountId: initialControlAccountId ?? '',
      });
    }
  }, [isOpen, initialName, initialControlAccountId, reset]);

  // Control account picker mirrors the backend's own validation: active, posting-enabled,
  // and a leaf account (no children) — anything else gets rejected on submit anyway.
  const controlAccountOptions = useMemo<SearchSelectOption[]>(() => {
    const accounts = glAccounts ?? [];
    const parentIds = new Set(accounts.map((a) => a.parentAccountId).filter(Boolean));
    return accounts
      .filter((a) => a.allowPosting && !parentIds.has(a.id))
      .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}`, sublabel: a.category }));
  }, [glAccounts]);

  const currencyOptions: SearchSelectOption[] = useMemo(
    () =>
      (currencies ?? [])
        .filter((c) => c.isActive)
        .map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
    [currencies],
  );

  useEffect(() => {
    if (config?.baseCurrency) setValue('currency', config.baseCurrency);
  }, [config?.baseCurrency, setValue]);

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const subledger = await createSubledger({
        code: data.code.trim(),
        name: data.name.trim(),
        type: data.type as SubledgerType,
        controlAccountId: data.controlAccountId,
        currency: data.currency || undefined,
      });
      toast.success('Entity created successfully');
      onCreated?.(subledger);
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create entity'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Entity"
      description="Register a new subledger entity in your accounting records."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Add Entity
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField
          label="Entity Code"
          registration={register('code', { required: 'Entity code is required' })}
          error={errors.code}
          placeholder="e.g. ENT-0001"
        />

        <FormField
          label="Entity Name"
          registration={register('name', { required: 'Entity name is required' })}
          error={errors.name}
          placeholder="e.g. Acme Supplies Ltd."
        />

        <Controller
          name="type"
          control={control}
          rules={{ required: 'Entity type is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Entity Type"
              placeholder="Select type…"
              options={typeOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.type?.message}
            />
          )}
        />

        {initialControlAccountId ? (
          <Input label="Control Account" value={initialControlAccountLabel ?? ''} readOnly />
        ) : (
          <Controller
            name="controlAccountId"
            control={control}
            rules={{ required: 'Control account is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Control Account"
                placeholder={isLoadingAccounts ? 'Loading…' : 'Select control account…'}
                options={controlAccountOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.controlAccountId?.message}
              />
            )}
          />
        )}

        <Controller
          name="currency"
          control={control}
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
      </div>
    </SidePanel>
  );
}
