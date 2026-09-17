'use client';

import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  useAccountingCurrencyOptions,
  useCreateExchangeRate,
  useExchangeRates,
  useUpdateExchangeRate,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import type { ExchangeRate } from '@/types/accounting';

interface RateFormValues {
  fromCurrency: string;
  toCurrency: string;
  rate: number | '';
  effectiveAt: string;
}

const DEFAULTS: RateFormValues = {
  fromCurrency: '',
  toCurrency: '',
  rate: '',
  effectiveAt: '',
};
const PAGE_SIZE = 10;

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExchangeRatesTable() {
  const toast = useToast();
  const { data = [], isLoading } = useExchangeRates();
  const { options: currencyOptions } = useAccountingCurrencyOptions();
  const { mutateAsync: createRate, isPending: isCreating } = useCreateExchangeRate();
  const { mutateAsync: updateRate, isPending: isUpdating } = useUpdateExchangeRate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExchangeRate | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RateFormValues>({ defaultValues: DEFAULTS });
  const isPending = isCreating || isUpdating;

  const openCreate = () => {
    setEditTarget(null);
    reset({ ...DEFAULTS, effectiveAt: toDateTimeLocal(new Date().toISOString()) });
    setPanelOpen(true);
  };

  const openEdit = (rate: ExchangeRate) => {
    setEditTarget(rate);
    reset({
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: Number(rate.rate),
      effectiveAt: toDateTimeLocal(rate.effectiveAt),
    });
    setPanelOpen(true);
  };

  const closePanel = () => {
    if (isPending) return;
    setPanelOpen(false);
    setEditTarget(null);
    reset(DEFAULTS);
  };

  const submit = async (values: RateFormValues) => {
    if (values.fromCurrency === values.toCurrency) {
      toast.error('The source and target currencies must be different');
      return;
    }

    try {
      if (editTarget) {
        await updateRate({
          id: editTarget.id,
          rate: Number(values.rate),
          effectiveAt: new Date(values.effectiveAt).toISOString(),
        });
        toast.success('Exchange rate updated');
      } else {
        await createRate({
          fromCurrency: values.fromCurrency,
          toCurrency: values.toCurrency,
          rate: Number(values.rate),
          effectiveAt: new Date(values.effectiveAt).toISOString(),
        });
        toast.success('Exchange rate created');
      }
      closePanel();
    } catch (error) {
      toast.error(extractError(error, 'Unable to save exchange rate'));
    }
  };

  const deactivate = async (rate: ExchangeRate) => {
    try {
      await updateRate({ id: rate.id, isActive: false });
      toast.success('Exchange rate deactivated');
    } catch (error) {
      toast.error(extractError(error, 'Unable to deactivate exchange rate'));
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter((rate) =>
      `${rate.fromCurrency} ${rate.toCurrency}`.toLowerCase().includes(query),
    );
  }, [data, search]);

  const columns = useMemo<Column<ExchangeRate>[]>(
    () => [
      {
        key: 'pair',
        label: 'Currency Pair',
        width: 'minmax(180px, 1fr)',
        render: (row) => (
          <span className="font-medium text-gray-900">
            {row.fromCurrency} / {row.toCurrency}
          </span>
        ),
      },
      {
        key: 'rate',
        label: 'Rate',
        width: '140px',
        render: (row) => (
          <span className="text-sm text-gray-700">{Number(row.rate).toFixed(8)}</span>
        ),
      },
      {
        key: 'effectiveAt',
        label: 'Effective At',
        width: '210px',
        render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.effectiveAt)}</span>,
      },
      {
        key: 'isActive',
        label: 'Status',
        width: '110px',
        render: (row) => (
          <Badge
            label={row.isActive ? 'Active' : 'Inactive'}
            variant={row.isActive ? 'success' : 'neutral'}
          />
        ),
      },
    ],
    [],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search currency pairs…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actionButton={{ label: 'Add Exchange Rate', onClick: openCreate }}
        rowActions={(row) => [
          { label: 'Edit', onClick: () => openEdit(row) },
          ...(row.isActive
            ? [{ label: 'Deactivate', onClick: () => deactivate(row), danger: true }]
            : []),
        ]}
        emptyMessage="No exchange rates found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <SidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        title={editTarget ? 'Edit Exchange Rate' : 'Add Exchange Rate'}
        description="Rates are effective-dated. Historical transactions retain their recorded exchange facts."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closePanel} disabled={isPending}>
              Cancel
            </Button>
            <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(submit)}>
              Save Rate
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Controller
            name="fromCurrency"
            control={control}
            rules={{ required: 'Source currency is required' }}
            render={({ field }) => (
              <SearchSelect
                label="From Currency"
                options={currencyOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.fromCurrency?.message}
              />
            )}
          />
          <Controller
            name="toCurrency"
            control={control}
            rules={{ required: 'Target currency is required' }}
            render={({ field }) => (
              <SearchSelect
                label="To Currency"
                options={currencyOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.toCurrency?.message}
              />
            )}
          />
          <FormField
            label="Rate"
            type="number"
            step="0.00000001"
            registration={register('rate', {
              required: 'Rate is required',
              valueAsNumber: true,
              min: { value: 0.00000001, message: 'Rate must be greater than zero' },
            })}
            error={errors.rate}
          />
          <FormField
            label="Effective At"
            type="datetime-local"
            registration={register('effectiveAt', {
              required: 'Effective date and time is required',
            })}
            error={errors.effectiveAt}
          />
        </div>
      </SidePanel>
    </>
  );
}
