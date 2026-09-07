'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import type { AllowanceItem } from '@/lib/payrollCalculations';
import { usePayrollSettings } from '@/hooks';
import { formatPayrollMoney } from '@/lib/payrollDisplay';
import { COMMON_ALLOWANCE_NAMES } from '@/lib/payrollUtils';

const KNOWN_VALUES = new Set(
  COMMON_ALLOWANCE_NAMES.map((o) => o.value).filter((v) => v !== '__other__'),
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'allowance';
  employeeName: string;
  items: AllowanceItem[];
  onSave: (items: AllowanceItem[]) => void;
}

interface DraftItem {
  _key: number;
  selectedOption: string;
  customName: string;
  amount: number;
}

function itemToDraft(item: AllowanceItem, idx: number): DraftItem {
  const isKnown = KNOWN_VALUES.has(item.name);
  return {
    _key: idx,
    selectedOption: isKnown ? item.name : '__other__',
    customName: isKnown ? '' : item.name,
    amount: item.amount,
  };
}

function draftToItem(d: DraftItem): AllowanceItem | null {
  const name = d.selectedOption === '__other__' ? d.customName.trim() : d.selectedOption;
  if (!name || d.amount <= 0) return null;
  return { name, amount: d.amount };
}

function emptyDraft(): DraftItem {
  return { _key: Date.now(), selectedOption: '', customName: '', amount: 0 };
}

function PayrollItemsForm({
  onClose,
  employeeName,
  items,
  onSave,
}: Omit<Props, 'isOpen' | 'type'>) {
  const { data: payrollSettings } = usePayrollSettings();
  const [draft, setDraft] = useState<DraftItem[]>(
    items.length > 0 ? items.map(itemToDraft) : [emptyDraft()],
  );

  const update = <K extends keyof DraftItem>(key: number, field: K, value: DraftItem[K]) => {
    setDraft((prev) => prev.map((d) => (d._key === key ? { ...d, [field]: value } : d)));
  };

  const remove = (key: number) => {
    setDraft((prev) => {
      const next = prev.filter((d) => d._key !== key);
      return next.length > 0 ? next : [emptyDraft()];
    });
  };

  const handleSave = () => {
    const valid = draft.map(draftToItem).filter((i): i is AllowanceItem => i !== null);
    onSave(valid);
    onClose();
  };

  const total = draft.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Edit Allowances"
      description={employeeName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Allowances</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {draft.map((item) => (
          <div key={item._key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchSelect
                  placeholder="Select allowance type…"
                  options={COMMON_ALLOWANCE_NAMES}
                  value={item.selectedOption}
                  onChange={(v) => {
                    update(item._key, 'selectedOption', v);
                    if (v !== '__other__') update(item._key, 'customName', '');
                  }}
                />
              </div>
              <input
                type="number"
                placeholder="0.00"
                min="0"
                value={item.amount || ''}
                onChange={(e) => update(item._key, 'amount', Number(e.target.value))}
                className={inputClass(undefined, 'w-28')}
              />
              <button
                onClick={() => remove(item._key)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {item.selectedOption === '__other__' && (
              <input
                type="text"
                placeholder="Enter allowance name"
                value={item.customName}
                onChange={(e) => update(item._key, 'customName', e.target.value)}
                className={inputClass(undefined, 'ml-0')}
              />
            )}
          </div>
        ))}

        <button
          onClick={() => setDraft((prev) => [...prev, emptyDraft()])}
          className="flex items-center gap-2 text-sm text-brand hover:text-brand/80 transition-colors py-1"
        >
          <Plus className="w-4 h-4" />
          Add Allowance
        </button>
      </div>

      {total > 0 && (
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mt-2">
          <span className="text-sm font-medium text-gray-600">Total Allowances</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatPayrollMoney(
              total,
              payrollSettings?.payrollCurrency,
              payrollSettings?.payrollCountry,
            )}
          </span>
        </div>
      )}
    </SidePanel>
  );
}

export function PayrollItemsPanel({ isOpen, ...props }: Props) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }

  return <PayrollItemsForm key={`${props.employeeName}-${props.items.length}`} {...props} />;
}
