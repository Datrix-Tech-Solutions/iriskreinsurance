'use client';

import { InlineTable, InlineTableColumn } from '@/components/organisms/shared/InlineTable';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { inputClass } from '@/lib/utils';

export interface ProductServiceRow {
  id: string;
  productType: string;
  expectedRevenue: string;
  achievedRevenue: string;
  expectedCloseDate: string;
}

function emptyRow(): ProductServiceRow {
  return {
    id: crypto.randomUUID(),
    productType: '',
    expectedRevenue: '',
    achievedRevenue: '',
    expectedCloseDate: '',
  };
}

interface Props {
  rows: ProductServiceRow[];
  onChange: (rows: ProductServiceRow[]) => void;
  productTypeOptions?: { value: string; label: string }[];
}

export function ProductServiceForm({ rows, onChange, productTypeOptions = [] }: Props) {
  function update(index: number, key: keyof ProductServiceRow, value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  const totalExpected = rows.reduce((sum, r) => sum + (parseFloat(r.expectedRevenue) || 0), 0);
  const totalAchieved = rows.reduce((sum, r) => sum + (parseFloat(r.achievedRevenue) || 0), 0);

  const fmt = (n: number) =>
    n === 0
      ? '—'
      : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const columns: InlineTableColumn[] = [
    {
      key: 'product',
      label: 'Product',
      width: '2fr',
      renderField: (i) => (
        <SearchSelect
          placeholder="Select product"
          options={productTypeOptions}
          value={rows[i].productType}
          onChange={(v) => update(i, 'productType', v)}
        />
      ),
    },
    {
      key: 'expectedRevenue',
      label: 'Expected Revenue',
      width: '1.5fr',
      renderField: (i) => (
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={rows[i].expectedRevenue}
          onChange={(e) => update(i, 'expectedRevenue', e.target.value)}
          className={inputClass(undefined, 'text-right')}
        />
      ),
      renderFooter: () => (
        <span className="text-sm font-semibold text-gray-900">{fmt(totalExpected)}</span>
      ),
    },
    {
      key: 'achievedRevenue',
      label: 'Achieved Revenue',
      width: '1.5fr',
      renderField: (i) => (
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={rows[i].achievedRevenue}
          onChange={(e) => update(i, 'achievedRevenue', e.target.value)}
          className={inputClass(undefined, 'text-right')}
        />
      ),
      renderFooter: () => (
        <span className="text-sm font-semibold text-gray-900">{fmt(totalAchieved)}</span>
      ),
    },
    {
      key: 'expectedCloseDate',
      label: 'Expected Close Date',
      width: '1.5fr',
      renderField: (i) => (
        <DatePicker
          value={rows[i].expectedCloseDate}
          onChange={(v) => update(i, 'expectedCloseDate', v)}
        />
      ),
    },
  ];

  return (
    <InlineTable
      title="Products / Services"
      addLabel="Add Product"
      columns={columns}
      fieldIds={rows.map((r) => r.id)}
      onAddRow={() => onChange([...rows, emptyRow()])}
      onRemoveRow={(i) => onChange(rows.filter((_, idx) => idx !== i))}
    />
  );
}
