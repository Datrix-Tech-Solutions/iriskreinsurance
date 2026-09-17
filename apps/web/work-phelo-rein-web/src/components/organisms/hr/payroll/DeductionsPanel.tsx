'use client';

import { useState } from 'react';
import { Plus, CheckCircle2, Clock } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';
import {
  useEmployeeDeductions,
  useCreateDeduction,
  useUpdateDeduction,
  useDeleteDeduction,
  usePayrollSettings,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatPayrollMoney } from '@/lib/payrollDisplay';
import { EmployeeDeduction } from '@/types/hr';
import { useTenantConfig } from '@/hooks/useTenantConfig';

export type { EmployeeDeduction as DeductionItem };
import type { DeductionLineItem } from '@/types/payroll';
export type { DeductionLineItem };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  onActiveTotal?: (total: number) => void;
  onActiveItems?: (items: DeductionLineItem[]) => void;
}

interface FormState {
  name: string;
  totalAmount: string;
  monthlyRate: string;
  startDate: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    totalAmount: '',
    monthlyRate: '',
    startDate: new Date().toISOString().slice(0, 10),
  };
}

function getActiveDeductionItems(deductions: EmployeeDeduction[]): DeductionLineItem[] {
  return deductions
    .filter((d) => d.amountPaid < d.totalAmount)
    .map((d) => {
      const balance = Math.max(0, d.totalAmount - d.amountPaid);
      return {
        employeeDeductionId: d.id,
        name: d.name,
        amount: Math.min(balance, d.monthlyRate),
      };
    })
    .filter((d) => d.amount > 0);
}

function DeductionCard({
  item,
  onEdit,
  onDelete,
  isDeleting,
  payrollCurrency,
  payrollCountry,
}: {
  item: EmployeeDeduction;
  currency: string;
  onEdit: (item: EmployeeDeduction) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  payrollCurrency?: string;
  payrollCountry?: string;
}) {
  const balance = Math.max(0, item.totalAmount - item.amountPaid);
  const isCompleted = balance === 0;
  const progress =
    item.totalAmount > 0 ? Math.min(100, (item.amountPaid / item.totalAmount) * 100) : 0;
  const monthsLeft =
    !isCompleted && item.monthlyRate > 0 ? Math.ceil(balance / item.monthlyRate) : 0;

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
        isCompleted ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`font-semibold text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-900'}`}>
          {item.name}
        </p>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {isCompleted ? 'Completed' : 'Active'}
        </span>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-400' : 'bg-brand'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-gray-400">Total Amount</p>
          <p className="font-medium text-gray-700">
            {formatPayrollMoney(item.totalAmount, payrollCurrency, payrollCountry)}
          </p>
        </div>
        <div>
          <p className="text-gray-400">Monthly Rate</p>
          <p className="font-semibold text-gray-900">
            {formatPayrollMoney(item.monthlyRate, payrollCurrency, payrollCountry)}
          </p>
        </div>
        <div>
          <p className="text-gray-400">Paid So Far</p>
          <p className="font-medium text-emerald-600">
            {formatPayrollMoney(item.amountPaid, payrollCurrency, payrollCountry)}
          </p>
        </div>
        <div>
          <p className="text-gray-400">Balance</p>
          <p className={`font-semibold ${isCompleted ? 'text-gray-400' : 'text-gray-900'}`}>
            {formatPayrollMoney(balance, payrollCurrency, payrollCountry)}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Started{' '}
        {new Date(item.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
        {monthsLeft > 0 && ` · ~${monthsLeft} month${monthsLeft !== 1 ? 's' : ''} remaining`}
      </p>

      {!isCompleted && (
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100">
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
      )}
    </div>
  );
}

function DeductionsPanelContent({
  employeeId,
  employeeName,
  onClose,
  onActiveTotal,
  onActiveItems,
}: Omit<Props, 'isOpen'>) {
  const toast = useToast();
  const { data: payrollSettings } = usePayrollSettings();
  const { data: deductions = [], isLoading } = useEmployeeDeductions(employeeId);
  const { mutate: createDeduction, isPending: isCreating } = useCreateDeduction(employeeId);
  const { mutate: updateDeduction, isPending: isUpdating } = useUpdateDeduction(employeeId);
  const { mutate: deleteDeduction, isPending: isDeleting } = useDeleteDeduction(employeeId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const isMutating = isCreating || isUpdating;

  const activeItems = getActiveDeductionItems(deductions);
  const activeMonthlyTotal = activeItems.reduce((sum, d) => sum + d.amount, 0);
  const payrollCurrency = payrollSettings?.payrollCurrency;
  const payrollCountry = payrollSettings?.payrollCountry;
  const { currency } = useTenantConfig();

  const notifyActiveDeductions = (next: EmployeeDeduction[]) => {
    const items = getActiveDeductionItems(next);
    onActiveItems?.(items);
    onActiveTotal?.(items.reduce((sum, item) => sum + item.amount, 0));
  };

  const validate = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.totalAmount || Number(form.totalAmount) <= 0) e.totalAmount = 'Enter a valid amount';
    if (!form.monthlyRate || Number(form.monthlyRate) <= 0) e.monthlyRate = 'Enter a valid rate';
    else if (Number(form.monthlyRate) > Number(form.totalAmount))
      e.monthlyRate = 'Rate cannot exceed total';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmitForm = () => {
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      totalAmount: Number(form.totalAmount),
      monthlyRate: Number(form.monthlyRate),
      startDate: form.startDate,
    };

    if (editingId) {
      updateDeduction(
        { deductionId: editingId, ...payload },
        {
          onSuccess: (updated) => {
            toast.success('Deduction updated');
            notifyActiveDeductions(deductions.map((d) => (d.id === editingId ? updated : d)));
            resetForm();
          },
          onError: (err) => toast.error(extractError(err, 'Failed to update deduction')),
        },
      );
    } else {
      createDeduction(payload, {
        onSuccess: (created) => {
          toast.success('Deduction added');
          notifyActiveDeductions([...deductions, created]);
          resetForm();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to add deduction')),
      });
    }
  };

  const handleEdit = (item: EmployeeDeduction) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      totalAmount: String(item.totalAmount),
      monthlyRate: String(item.monthlyRate),
      startDate: item.startDate,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteDeduction(id, {
      onSuccess: () => {
        toast.success('Deduction removed');
        const remaining = deductions.filter((d) => d.id !== id);
        notifyActiveDeductions(remaining);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to remove deduction')),
    });
  };

  const resetForm = () => {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  const previewMonths =
    form.totalAmount && form.monthlyRate && Number(form.monthlyRate) > 0
      ? Math.ceil(Number(form.totalAmount) / Number(form.monthlyRate))
      : null;

  return (
    <SidePanel isOpen onClose={onClose} title="Deductions" description={employeeName}>
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
            {activeMonthlyTotal > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-brand/5 rounded-xl border border-brand/10">
                <span className="text-sm font-medium text-gray-600">
                  This month&apos;s deduction
                </span>
                <span className="text-sm font-semibold text-brand">
                  {formatPayrollMoney(activeMonthlyTotal, payrollCurrency, payrollCountry)}
                </span>
              </div>
            )}

            {deductions.map((item) => (
              <DeductionCard
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
                  {editingId ? 'Edit Deduction' : 'New Deduction'}
                </p>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Staff Loan"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className={inputClass(errors.name)}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Total Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      min="0"
                      value={form.totalAmount}
                      onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))}
                      className={inputClass(errors.totalAmount)}
                    />
                    {errors.totalAmount && (
                      <p className="text-xs text-red-500">{errors.totalAmount}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Monthly Rate</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      min="0"
                      value={form.monthlyRate}
                      onChange={(e) => setForm((p) => ({ ...p, monthlyRate: e.target.value }))}
                      className={inputClass(errors.monthlyRate)}
                    />
                    {errors.monthlyRate && (
                      <p className="text-xs text-red-500">{errors.monthlyRate}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className={inputClass(undefined)}
                  />
                </div>

                {previewMonths !== null && previewMonths > 0 && (
                  <p className="text-xs text-gray-400">
                    ~{previewMonths} month{previewMonths !== 1 ? 's' : ''} to clear at this rate
                  </p>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <Button size="sm" variant="outline" onClick={resetForm} disabled={isMutating}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitForm}
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
                Add Deduction
              </button>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}

export function DeductionsPanel({ isOpen, ...props }: Props) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return <DeductionsPanelContent key={props.employeeId} {...props} />;
}
