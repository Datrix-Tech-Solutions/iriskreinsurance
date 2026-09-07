'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import {
  useListAllowances,
  useAddAllowance,
  useUpdateAllowance,
  useDeleteAllowance,
  usePayrollSettings,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatPayrollMoney } from '@/lib/payrollDisplay';
import { EmployeeAllowance, AllowanceType } from '@/types/hr';
import type { AllowanceItem } from '@/lib/payrollCalculations';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import {
  ALLOWANCE_TYPE_OPTIONS,
  ALLOWANCE_TYPE_LABEL,
  ALLOWANCE_TYPE_COLOR,
} from '@/lib/payrollUtils';

function toPayrollItems(allowances: EmployeeAllowance[]): AllowanceItem[] {
  return allowances.map((a) => ({
    name: a.name,
    type: a.type,
    amount: Number(a.amount),
  }));
}

interface FormState {
  type: AllowanceType | '';
  amount: string;
  name: string;
}

function emptyForm(): FormState {
  return { type: '', amount: '', name: '' };
}

function AllowanceCard({
  item,
  onEdit,
  onDelete,
  isDeleting,
  payrollCurrency,
  payrollCountry,
}: {
  item: EmployeeAllowance;
  currency: string;
  onEdit: (item: EmployeeAllowance) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  payrollCurrency?: string;
  payrollCountry?: string;
}) {
  const typeColor = ALLOWANCE_TYPE_COLOR[item.type] ?? ALLOWANCE_TYPE_COLOR.OTHER;
  const typeLabel = ALLOWANCE_TYPE_LABEL[item.type] ?? item.type;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeColor}`}
        >
          {item.type === 'OTHER' ? item.name : typeLabel}
        </span>
        <p className="text-sm font-semibold text-gray-900">
          {formatPayrollMoney(Number(item.amount), payrollCurrency, payrollCountry)}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onEdit(item)}
          className="text-xs text-brand hover:text-brand/80 font-medium transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
          className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  onItems?: (items: AllowanceItem[]) => void;
}

function AllowancesPanelContent({
  employeeId,
  employeeName,
  onClose,
  onItems,
}: Omit<Props, 'isOpen'>) {
  const toast = useToast();
  const { data: payrollSettings } = usePayrollSettings();
  const { data: allowances = [], isLoading } = useListAllowances(employeeId);
  const { mutate: addAllowance, isPending: isAdding } = useAddAllowance(employeeId);
  const { mutate: updateAllowance, isPending: isUpdating } = useUpdateAllowance(employeeId);
  const { mutate: deleteAllowance, isPending: isDeleting } = useDeleteAllowance(employeeId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const isMutating = isAdding || isUpdating;
  const totalMonthly = allowances.reduce((sum, a) => sum + Number(a.amount), 0);
  const payrollCurrency = payrollSettings?.payrollCurrency;
  const payrollCountry = payrollSettings?.payrollCountry;
  const { currency } = useTenantConfig();

  const notify = (next: EmployeeAllowance[]) => onItems?.(toPayrollItems(next));

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.type) e.type = 'Required';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
    if (form.type === 'OTHER' && !form.name.trim()) e.name = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const type = form.type as AllowanceType;
    const payload = {
      type,
      amount: Number(form.amount),
      ...(type === 'OTHER' ? { name: form.name.trim() } : {}),
    };

    if (editingId) {
      updateAllowance(
        { allowanceId: editingId, payload },
        {
          onSuccess: (updated) => {
            toast.success('Allowance updated');
            notify(allowances.map((a) => (a.id === editingId ? updated : a)));
            resetForm();
          },
          onError: (err) => toast.error(extractError(err, 'Failed to update allowance')),
        },
      );
    } else {
      addAllowance(payload, {
        onSuccess: (created) => {
          toast.success('Allowance added');
          notify([...allowances, created]);
          resetForm();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to add allowance')),
      });
    }
  };

  const handleEdit = (item: EmployeeAllowance) => {
    setEditingId(item.id);
    setForm({
      type: item.type as AllowanceType,
      amount: String(item.amount),
      name: item.type === 'OTHER' ? item.name : '',
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteAllowance(id, {
      onSuccess: () => {
        toast.success('Allowance removed');
        notify(allowances.filter((a) => a.id !== id));
      },
      onError: (err) => toast.error(extractError(err, 'Failed to remove allowance')),
    });
  };

  const resetForm = () => {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <SidePanel isOpen onClose={onClose} title="Allowances" description={employeeName}>
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-brand animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Loading...</p>
          </div>
        ) : (
          <>
            {totalMonthly > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-brand/5 rounded-xl border border-brand/10">
                <span className="text-sm font-medium text-gray-600">Total monthly</span>
                <span className="text-sm font-semibold text-brand">
                  {formatPayrollMoney(totalMonthly, payrollCurrency, payrollCountry)}
                </span>
              </div>
            )}

            {allowances.map((item) => (
              <AllowanceCard
                key={item.id}
                item={item}
                currency={currency}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={isDeleting}
                payrollCurrency={payrollCurrency}
                payrollCountry={payrollCountry}
              />
            ))}

            {showForm ? (
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700">
                  {editingId ? 'Edit Allowance' : 'New Allowance'}
                </p>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Type</label>
                  <SearchSelect
                    placeholder="Select type…"
                    options={ALLOWANCE_TYPE_OPTIONS}
                    value={form.type}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        type: v as AllowanceType,
                        name: v === 'OTHER' ? p.name : '',
                      }))
                    }
                    error={errors.type}
                  />
                </div>

                {form.type === 'OTHER' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Allowance Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Uniform Allowance"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className={inputClass(errors.name)}
                    />
                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Monthly Amount</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    className={inputClass(errors.amount)}
                  />
                  {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button size="sm" variant="outline" onClick={resetForm} disabled={isMutating}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    isLoading={isMutating}
                    loadingText="Saving…"
                  >
                    {editingId ? 'Update' : 'Add'}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 text-sm text-brand hover:text-brand/80 transition-colors py-1"
              >
                <Plus className="w-4 h-4" />
                Add Allowance
              </button>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}

export function AllowancesPanel({ isOpen, ...props }: Props) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return <AllowancesPanelContent key={props.employeeId} {...props} />;
}
