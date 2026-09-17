'use client';

import { useFieldArray, useWatch, Controller, UseFormReturn } from 'react-hook-form';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import { InlineTable, InlineTableColumn } from '@/components/organisms/shared/InlineTable';
import { InvoiceFormValues, InvoiceLine } from '@/types/accounting';

const EMPTY_LINE: InvoiceLine = {
  description: '',
  glAccount: '',
  unitPrice: '',
  quantity: '',
  tax: '',
};

function fmt(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface InvoiceLineDetailsSectionProps {
  form: UseFormReturn<InvoiceFormValues>;
  glAccountOptions: SearchSelectOption[];
  isLoadingGLAccounts?: boolean;
}

export function InvoiceLineDetailsSection({
  form,
  glAccountOptions,
  isLoadingGLAccounts,
}: InvoiceLineDetailsSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const lines = useWatch({ control, name: 'lines' });
  const currency = useWatch({ control, name: 'currency' });

  const getAmount = (index: number) => {
    const l = lines?.[index];
    return (Number(l?.quantity) || 0) * (Number(l?.unitPrice) || 0);
  };

  const getTotal = (index: number) => {
    const amount = getAmount(index);
    const tax = Number(lines?.[index]?.tax) || 0;
    return amount + (amount * tax) / 100;
  };

  const grandTotal = (lines ?? []).reduce((sum, _, i) => sum + getTotal(i), 0);

  const columns: InlineTableColumn[] = [
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(150px, 1fr)',
      renderField: (index) => (
        <input
          {...register(`lines.${index}.description`)}
          placeholder="Line description…"
          className={inputClass(undefined, 'py-2 text-sm')}
        />
      ),
    },
    {
      key: 'glAccount',
      label: 'GL Account',
      width: 'minmax(150px, 1fr)',
      renderField: (index) => {
        const err = errors.lines?.[index]?.glAccount;
        return (
          <Controller
            name={`lines.${index}.glAccount`}
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <SearchSelect
                placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select account…'}
                options={glAccountOptions}
                value={field.value}
                onChange={field.onChange}
                error={err ? '' : undefined}
                size="sm"
              />
            )}
          />
        );
      },
    },
    {
      key: 'unitPrice',
      label: 'Unit Price',
      width: '100px',
      align: 'right',
      renderField: (index) => {
        const err = errors.lines?.[index]?.unitPrice;
        return (
          <input
            {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={inputClass(err ? 'error' : undefined, 'py-2 text-sm text-right')}
          />
        );
      },
    },
    {
      key: 'quantity',
      label: 'Qty',
      width: '80px',
      align: 'right',
      renderField: (index) => {
        const err = errors.lines?.[index]?.quantity;
        return (
          <input
            {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
            type="number"
            min={0}
            step="1"
            placeholder="0"
            className={inputClass(err ? 'error' : undefined, 'py-2 text-sm text-right')}
          />
        );
      },
    },
    {
      key: 'tax',
      label: 'Tax (%)',
      width: '70px',
      align: 'right',
      renderField: (index) => (
        <input
          {...register(`lines.${index}.tax`, { valueAsNumber: true })}
          type="number"
          min={0}
          max={100}
          step="0.1"
          placeholder="0"
          className={inputClass(undefined, 'py-2 text-sm text-right')}
        />
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '120px',
      align: 'right',
      renderField: (index) => (
        <div className="py-2 px-1 text-sm text-right text-gray-700 font-medium">
          {fmt(getAmount(index))}
        </div>
      ),
    },
    {
      key: 'total',
      label: `Total${currency ? ` (${currency})` : ''}`,
      width: '120px',
      align: 'right',
      renderField: (index) => (
        <div className="py-2 px-1 text-sm text-right text-gray-900 font-semibold">
          {fmt(getTotal(index))}
        </div>
      ),
      renderFooter: () => (currency ? `${currency} ` : '') + fmt(grandTotal),
    },
  ];

  return (
    <InlineTable
      title="Line Details"
      addLabel="Add Line"
      columns={columns}
      fieldIds={fields.map((f) => f.id)}
      onAddRow={() => append({ ...EMPTY_LINE })}
      onRemoveRow={(index) => remove(index)}
    />
  );
}
