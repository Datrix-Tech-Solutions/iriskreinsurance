'use client';

import { useState, useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { Column, DataTable } from '../../shared/DataTable';
import { usePayrollSettings, usePayrollRuns, usePayrollRun, useUpdatePayrollItem } from '@/hooks';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { AllowanceItem } from '@/lib/payrollCalculations';
import { formatPayrollMoney, resolvePayrollCurrency } from '@/lib/payrollDisplay';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { Employee } from '@/types/hr';
import { AllowancesPanel } from './AllowancesPanel';
import { DeductionLineItem, DeductionsPanel } from './DeductionsPanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { NumberField } from '@/components/atoms/NumberField';
import { Modal } from '@/components/organisms/shared/Modal';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const COMMISSION_TAX_RATE = 0.1;

const PAYROLL_ELIGIBLE: Employee['employmentStatus'][] = ['ACTIVE', 'PROBATION', 'ON_LEAVE'];

interface CommissionRow {
  id: string;
  employeeName: string;
  department?: string;
  commission: number;
  allowances: number;
  deductions: number;
  gross: number;
  tax: number;
  netPay: number;
}

export function CommissionsTab() {
  const toast = useToast();
  const { data: empData, isLoading } = useAllEmployees();
  const { data: payrollSettings } = usePayrollSettings();
  const { data: allRuns = [] } = usePayrollRuns();
  const { mutateAsync: updateItem, isPending: isApplying } = useUpdatePayrollItem();

  const payrollCountry = (payrollSettings?.payrollCountry ?? 'GH') as Parameters<
    typeof resolvePayrollCurrency
  >[1];
  const payrollCurrency = resolvePayrollCurrency(payrollSettings?.payrollCurrency, payrollCountry);
  const money = (value: number) => formatPayrollMoney(value, payrollCurrency, payrollCountry);

  const draftRuns = useMemo(() => allRuns.filter((r) => r.status === 'DRAFT'), [allRuns]);

  const [selectedRunId, setSelectedRunId] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Tracks only values the user has manually changed this session
  const [commissionMap, setCommissionMap] = useState<Record<string, number>>({});
  const [allowancesMap, setAllowancesMap] = useState<Record<string, AllowanceItem[]>>({});
  const [deductionItemsMap, setDeductionItemsMap] = useState<Record<string, DeductionLineItem[]>>(
    {},
  );
  const [allowancePanel, setAllowancePanel] = useState<{ rowId: string; rowName: string } | null>(
    null,
  );
  const [deductionPanel, setDeductionPanel] = useState<{ rowId: string; rowName: string } | null>(
    null,
  );

  const { data: selectedRun } = usePayrollRun(selectedRunId);

  // Values from the persisted run — used as initial values before the user edits
  const runCommissionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of selectedRun?.items ?? []) {
      if (Number(item.commissionAmount) > 0) {
        map[item.employeeId] = Number(item.commissionAmount);
      }
    }
    return map;
  }, [selectedRun]);

  const profileDeductionItems = useMemo(() => {
    const map: Record<string, DeductionLineItem[]> = {};
    (empData?.data ?? []).forEach((e) => {
      if (e.deductions) {
        map[e.id] = e.deductions
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
    });
    return map;
  }, [empData]);

  const rows: CommissionRow[] = useMemo(() => {
    const employees = (empData?.data ?? []).filter(
      (e) =>
        PAYROLL_ELIGIBLE.includes(e.employmentStatus) &&
        e.userStatus !== 'PENDING_VERIFICATION' &&
        (e.compensationType === 'COMMISSION' || e.compensationType === 'SALARY_PLUS_COMMISSION'),
    );

    return employees.map((e) => {
      const commission = commissionMap[e.id] ?? runCommissionMap[e.id] ?? 0;

      const savedAllowances: AllowanceItem[] =
        e.allowances?.map((a) => ({
          name: a.name ?? (a.type as string),
          type: a.type,
          amount: Number(a.amount),
        })) ?? [];
      const allowanceItems = allowancesMap[e.id] ?? savedAllowances;
      const allowances = allowanceItems.reduce((sum, a) => sum + a.amount, 0);

      const deductionItems = deductionItemsMap[e.id] ?? profileDeductionItems[e.id] ?? [];
      const deductions = deductionItems.reduce((sum, d) => sum + d.amount, 0);

      const gross = commission + allowances;
      const tax = +(commission * COMMISSION_TAX_RATE).toFixed(2);
      const netPay = Math.max(0, gross - tax - deductions);

      return {
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`.trim(),
        department: e.department?.name,
        commission,
        allowances,
        deductions,
        gross,
        tax,
        netPay,
      };
    });
  }, [
    empData,
    commissionMap,
    runCommissionMap,
    allowancesMap,
    deductionItemsMap,
    profileDeductionItems,
  ]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => r.employeeName.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const handleApply = async () => {
    if (!selectedRun) return;
    try {
      for (const row of rows) {
        const item = selectedRun.items.find((i) => i.employeeId === row.id);
        if (!item) continue;
        await updateItem({
          payrollRunId: selectedRun.id,
          itemId: item.id,
          data: { commissionAmount: row.commission },
        });
      }
      const label = payrollMonthLabel(selectedRun.month, selectedRun.year);
      toast.success(`Commission applied to ${label} ${selectedRun.year} payroll`);
      setShowConfirm(false);
    } catch (err) {
      toast.error(extractError(err, 'Failed to apply commission'));
    }
  };

  const runOptions = draftRuns.map((r) => ({
    value: r.id,
    label: `${payrollMonthLabel(r.month, r.year)} ${r.year}`,
  }));

  const selectedRunLabel = runOptions.find((o) => o.value === selectedRunId)?.label ?? '';

  const columns: Column<CommissionRow>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: '2fr',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-medium shrink-0">
            {row.employeeName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{row.employeeName}</p>
            {row.department && <p className="text-xs text-gray-500">{row.department}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'commission',
      label: 'Commission',
      render: (row) => (
        <NumberField
          value={row.commission}
          onChange={(n) => setCommissionMap((prev) => ({ ...prev, [row.id]: n }))}
        />
      ),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (row) => (
        <button
          onClick={() => setAllowancePanel({ rowId: row.id, rowName: row.employeeName })}
          className="group w-28 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {row.allowances > 0 ? (
              row.allowances.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            ) : (
              <span className="text-gray-400">Add</span>
            )}
          </span>
          <Pencil className="w-3 h-3 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (row) => (
        <button
          onClick={() => setDeductionPanel({ rowId: row.id, rowName: row.employeeName })}
          className="group w-28 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {row.deductions > 0 ? (
              row.deductions.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            ) : (
              <span className="text-gray-400">Add</span>
            )}
          </span>
          <Pencil className="w-3 h-3 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      key: 'gross',
      label: 'Gross',
      render: (row) => money(row.gross),
    },
    {
      key: 'tax',
      label: 'Tax (10%)',
      render: (row) => <span className="text-amber-600">{money(row.tax)}</span>,
    },
    {
      key: 'netPay',
      label: 'Net Pay',
      render: (row) => <span className="font-semibold text-emerald-600">{money(row.netPay)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-3">
        <div className="w-64">
          <SearchSelect
            label="Payroll Run"
            placeholder={draftRuns.length === 0 ? 'No draft runs available' : 'Select a draft run'}
            value={selectedRunId}
            onChange={(id) => {
              setSelectedRunId(id);
              setCommissionMap({});
            }}
            options={runOptions}
          />
        </div>
        <Button disabled={!selectedRunId || rows.length === 0} onClick={() => setShowConfirm(true)}>
          Apply to Payroll
        </Button>
      </div>

      {draftRuns.length === 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">No draft payroll run found.</p>
          <p className="text-xs text-amber-700 mt-1">
            Go to Manage Payroll and run payroll for the period first, then come back to apply
            commission amounts.
          </p>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredRows}
        isLoading={isLoading}
        emptyMessage="No commission employees found. Set an employee's compensation type to Commission or Salary + Commission."
        searchPlaceholder="Search employee name..."
        onSearch={setSearchQuery}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />

      <AllowancesPanel
        isOpen={!!allowancePanel}
        onClose={() => setAllowancePanel(null)}
        employeeId={allowancePanel?.rowId ?? ''}
        employeeName={allowancePanel?.rowName ?? ''}
        onItems={(items) => {
          if (!allowancePanel) return;
          setAllowancesMap((prev) => ({ ...prev, [allowancePanel.rowId]: items }));
        }}
      />

      <DeductionsPanel
        isOpen={!!deductionPanel}
        onClose={() => setDeductionPanel(null)}
        employeeId={deductionPanel?.rowId ?? ''}
        employeeName={deductionPanel?.rowName ?? ''}
        onActiveItems={(items) => {
          if (!deductionPanel) return;
          setDeductionItemsMap((prev) => ({ ...prev, [deductionPanel.rowId]: items }));
        }}
      />

      <Modal
        isOpen={showConfirm}
        onClose={() => !isApplying && setShowConfirm(false)}
        title="Apply Commission"
        hideClose={isApplying}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isApplying}>
              Cancel
            </Button>
            <Button onClick={handleApply} isLoading={isApplying} loadingText="Applying…">
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          Commission amounts for{' '}
          <span className="font-medium text-gray-900">
            {rows.length} employee{rows.length !== 1 ? 's' : ''}
          </span>{' '}
          will be applied to the{' '}
          <span className="font-medium text-gray-900">{selectedRunLabel}</span> payroll run. Any
          previously entered commission values for this period will be overwritten.
        </p>
      </Modal>
    </div>
  );
}
