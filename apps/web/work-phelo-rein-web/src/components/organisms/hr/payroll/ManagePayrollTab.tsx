'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Avatar } from '@/components/atoms/Avatar';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { NumberField } from '@/components/atoms/NumberField';
import { Column, DataTable } from '../../shared/DataTable';
import { usePayrollSettings, usePayrollRuns } from '@/hooks';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { calculatePayroll, AllowanceItem, Country } from '@/lib/payrollCalculations';
import { formatPayrollMoney, getPayrollLabels, resolvePayrollCurrency } from '@/lib/payrollDisplay';
import { Employee, PayrollTaxPolicy } from '@/types/hr';
import { AllowancesPanel } from './AllowancesPanel';
import { DeductionLineItem, DeductionsPanel } from './DeductionsPanel';
import { RunPayrollPanel, EmployeeOverride } from './RunPayrollPanel';
import { PayrollDraftsPanel, DraftLoadData } from './PayrollDraftsPanel';

const COMMISSION_TAX_RATE = 0.1;

interface PayrollRow {
  id: string;
  employeeName: string;
  avatarUrl?: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  grossSalary: number;
  employeeStatutoryContrib: number;
  employerStatutoryContrib: number;
  tier1Contribution: number;
  tier2Contribution: number;
  taxableIncome: number;
  paye: number;
  netSalary: number;
  totalEmployerCost: number;
  department?: string;
  validationError?: string;
}

interface CommissionRow {
  id: string;
  employeeName: string;
  avatarUrl?: string;
  department?: string;
  commission: number;
  allowances: number;
  deductions: number;
  gross: number;
  tax: number;
  netPay: number;
}

type PayrollView = 'salary' | 'commission';

// Keep in sync with hr-service/src/payroll/payroll.service.ts employee eligibility filter
const PAYROLL_ELIGIBLE: Employee['employmentStatus'][] = ['ACTIVE', 'PROBATION', 'ON_LEAVE'];

function isTransportAllowance(item: AllowanceItem) {
  const label = `${item.type ?? ''} ${item.name ?? ''}`.toLowerCase();
  return label.includes('transport');
}

export function ManagePayrollTab() {
  const toast = useToast();
  const { data: empData, isLoading } = useAllEmployees();
  const { data: payrollSettings } = usePayrollSettings();
  const { data: runs = [] } = usePayrollRuns();
  const rejectedDraftsCount = runs.filter(
    (r) => r.status === 'DRAFT' && !!r.returnToDraftNote,
  ).length;

  const [view, setView] = useState<PayrollView>('salary');
  const [searchQuery, setSearchQuery] = useState('');
  const [basicMap, setBasicMap] = useState<Record<string, number>>({});
  const [commissionMap, setCommissionMap] = useState<Record<string, number>>({});
  const [taxPolicyMap, setTaxPolicyMap] = useState<Record<string, PayrollTaxPolicy>>({});
  const [fixedTaxAmountMap, setFixedTaxAmountMap] = useState<Record<string, number | null>>({});
  const [commissionTaxableMap, setCommissionTaxableMap] = useState<Record<string, boolean>>({});
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
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const [draftsPanelOpen, setDraftsPanelOpen] = useState(false);

  const payrollCountry = (payrollSettings?.payrollCountry ?? 'GH') as Country;
  const payrollCurrency = resolvePayrollCurrency(payrollSettings?.payrollCurrency, payrollCountry);
  const payrollLabels = getPayrollLabels(payrollCountry);
  const money = (value: string | number | null | undefined) =>
    formatPayrollMoney(value, payrollCurrency, payrollCountry);
  const tier3Rate =
    payrollSettings?.payrollTier3Enabled && payrollSettings.payrollTier3Rate != null
      ? Number(payrollSettings.payrollTier3Rate) / 100
      : 0;

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

  // ── Salary rows (SALARY + SALARY_PLUS_COMMISSION) ──────────────────────────
  const payrollRows: PayrollRow[] = useMemo(() => {
    const employees: Employee[] = (empData?.data ?? []).filter(
      (e) =>
        PAYROLL_ELIGIBLE.includes(e.employmentStatus) &&
        e.userStatus !== 'PENDING_VERIFICATION' &&
        e.compensationType !== 'COMMISSION',
    );
    return employees.map((e) => {
      const basic = basicMap[e.id] ?? (Number(e.basicSalary) || 0);
      const savedAllowances: AllowanceItem[] =
        e.allowances?.map((a) => ({
          name: a.name ?? (a.type as string),
          type: a.type,
          amount: Number(a.amount),
        })) ?? [];
      const allowances = allowancesMap[e.id] ?? savedAllowances;
      const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
      const deductionItems = deductionItemsMap[e.id] ?? profileDeductionItems[e.id] ?? [];
      const otherDeductions = deductionItems.reduce((sum, d) => sum + d.amount, 0);
      const baseRow = {
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        avatarUrl: e.avatarUrl,
        basicSalary: basic,
        allowances: totalAllowances,
        deductions: otherDeductions,
        department: e.department?.name,
      };
      try {
        const calc = calculatePayroll({
          basicSalary: basic,
          allowances,
          otherDeductions,
          country: payrollCountry,
          ...(payrollCountry === 'GH' && tier3Rate > 0
            ? {
                ghanaPension: {
                  providentFundEmployeeRate: tier3Rate,
                  providentFundName: payrollSettings?.payrollTier3SchemeName ?? undefined,
                },
              }
            : {}),
        });
        return {
          ...baseRow,
          grossSalary: calc.grossSalary,
          employeeStatutoryContrib: calc.employeeStatutoryContrib,
          employerStatutoryContrib: calc.employerStatutoryContrib,
          tier1Contribution: calc.tier1Contribution ?? 0,
          tier2Contribution: calc.tier2Contribution ?? 0,
          taxableIncome: calc.taxableIncome,
          paye: calc.paye,
          netSalary: calc.netSalary,
          totalEmployerCost: calc.totalEmployerCost,
        };
      } catch (err) {
        return {
          ...baseRow,
          grossSalary: 0,
          employeeStatutoryContrib: 0,
          employerStatutoryContrib: 0,
          tier1Contribution: 0,
          tier2Contribution: 0,
          taxableIncome: 0,
          paye: 0,
          netSalary: 0,
          totalEmployerCost: 0,
          validationError: err instanceof Error ? err.message : 'Calculation error',
        };
      }
    });
  }, [
    empData,
    basicMap,
    allowancesMap,
    deductionItemsMap,
    payrollCountry,
    payrollSettings,
    profileDeductionItems,
    tier3Rate,
  ]);

  // ── Commission rows (COMMISSION + SALARY_PLUS_COMMISSION) ──────────────────
  const commissionRows: CommissionRow[] = useMemo(() => {
    const employees: Employee[] = (empData?.data ?? []).filter(
      (e) =>
        PAYROLL_ELIGIBLE.includes(e.employmentStatus) &&
        e.userStatus !== 'PENDING_VERIFICATION' &&
        e.compensationType !== 'SALARY',
    );
    return employees.map((e) => {
      const commission = commissionMap[e.id] ?? 0;
      // SALARY_PLUS_COMMISSION: allowances and deductions are already accounted for
      // in the salary section — exclude them here so figures aren't double-counted.
      const isBoth = e.compensationType === 'SALARY_PLUS_COMMISSION';
      const savedAllowances: AllowanceItem[] =
        e.allowances?.map((a) => ({
          name: a.name ?? (a.type as string),
          type: a.type,
          amount: Number(a.amount),
        })) ?? [];
      const allowanceItems = allowancesMap[e.id] ?? savedAllowances;
      const allowances = isBoth ? 0 : allowanceItems.reduce((sum, a) => sum + a.amount, 0);
      const deductionItems = deductionItemsMap[e.id] ?? profileDeductionItems[e.id] ?? [];
      const deductions = isBoth ? 0 : deductionItems.reduce((sum, d) => sum + d.amount, 0);
      const gross = commission + allowances;
      const tax = +(commission * COMMISSION_TAX_RATE).toFixed(2);
      const netPay = Math.max(0, gross - tax - deductions);
      return {
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`.trim(),
        avatarUrl: e.avatarUrl,
        department: e.department?.name,
        commission,
        allowances,
        deductions,
        gross,
        tax,
        netPay,
      };
    });
  }, [empData, commissionMap, allowancesMap, deductionItemsMap, profileDeductionItems]);

  const filteredSalaryRows = useMemo(() => {
    if (!searchQuery) return payrollRows;
    const q = searchQuery.toLowerCase();
    return payrollRows.filter((r) => r.employeeName.toLowerCase().includes(q));
  }, [payrollRows, searchQuery]);

  const filteredCommissionRows = useMemo(() => {
    if (!searchQuery) return commissionRows;
    const q = searchQuery.toLowerCase();
    return commissionRows.filter((r) => r.employeeName.toLowerCase().includes(q));
  }, [commissionRows, searchQuery]);

  const sumSalaryRows = (rows: PayrollRow[]) =>
    rows
      .filter((r) => !r.validationError)
      .reduce(
        (acc, r) => ({
          gross: acc.gross + r.grossSalary,
          net: acc.net + r.netSalary,
          paye: acc.paye + r.paye,
          statutory: acc.statutory + r.employeeStatutoryContrib + r.employerStatutoryContrib,
          employerCost: acc.employerCost + r.totalEmployerCost,
        }),
        { gross: 0, net: 0, paye: 0, statutory: 0, employerCost: 0 },
      );

  const sumCommissionRows = (rows: CommissionRow[]) =>
    rows.reduce(
      (acc, r) => ({
        gross: acc.gross + r.gross,
        tax: acc.tax + r.tax,
        net: acc.net + r.netPay,
      }),
      { gross: 0, tax: 0, net: 0 },
    );

  const salaryTotals = useMemo(() => sumSalaryRows(filteredSalaryRows), [filteredSalaryRows]);
  const commissionTotals = useMemo(
    () => sumCommissionRows(filteredCommissionRows),
    [filteredCommissionRows],
  );
  const allSalaryTotals = useMemo(() => sumSalaryRows(payrollRows), [payrollRows]);
  const allCommissionTotals = useMemo(() => sumCommissionRows(commissionRows), [commissionRows]);

  // ── Overrides (all eligible employees) ─────────────────────────────────────
  const overrides = useMemo(() => {
    const result: Record<string, EmployeeOverride> = {};
    const employees = (empData?.data ?? []).filter(
      (e) =>
        PAYROLL_ELIGIBLE.includes(e.employmentStatus) && e.userStatus !== 'PENDING_VERIFICATION',
    );
    for (const e of employees) {
      const savedAllowances: AllowanceItem[] =
        e.allowances?.map((a) => ({
          name: a.name ?? (a.type as string),
          type: a.type,
          amount: Number(a.amount),
        })) ?? [];
      const allowances = allowancesMap[e.id] ?? savedAllowances;
      const deductionItems = deductionItemsMap[e.id] ?? profileDeductionItems[e.id] ?? [];
      const basicSalary =
        e.compensationType === 'COMMISSION' ? 0 : (basicMap[e.id] ?? (Number(e.basicSalary) || 0));
      const commissionAmount = e.compensationType === 'SALARY' ? 0 : (commissionMap[e.id] ?? 0);
      const taxPolicy = taxPolicyMap[e.id] ?? e.taxPolicy ?? 'STANDARD_PAYE';
      const fixedTaxAmount =
        fixedTaxAmountMap[e.id] !== undefined
          ? fixedTaxAmountMap[e.id]
          : (e.fixedTaxAmount ?? null);
      const commissionTaxable = commissionTaxableMap[e.id] ?? e.commissionTaxable ?? true;
      const nonTransportAllowances = allowances
        .filter((item) => !isTransportAllowance(item))
        .reduce((sum, item) => sum + item.amount, 0);
      const transportAmount = allowances
        .filter(isTransportAllowance)
        .reduce((sum, item) => sum + item.amount, 0);
      result[e.id] = {
        basicSalary,
        commissionAmount,
        totalAllowances: nonTransportAllowances,
        transportAmount,
        taxPolicy,
        fixedTaxAmount,
        commissionTaxable,
        allowanceItems: allowances.map((item) => ({
          name: item.name,
          type: item.type ?? null,
          amount: item.amount,
        })),
        otherDeductions: deductionItems.reduce((sum, item) => sum + item.amount, 0),
        deductionItems,
      };
    }
    return result;
  }, [
    empData,
    basicMap,
    commissionMap,
    taxPolicyMap,
    fixedTaxAmountMap,
    commissionTaxableMap,
    allowancesMap,
    deductionItemsMap,
    profileDeductionItems,
  ]);

  const handleBasicChange = (employeeId: string, amount: number) => {
    setBasicMap((prev) => ({ ...prev, [employeeId]: amount }));
  };

  const handleCommissionChange = (employeeId: string, amount: number) => {
    setCommissionMap((prev) => ({ ...prev, [employeeId]: amount }));
  };

  const handleRunPayroll = () => {
    const invalidRows = payrollRows.filter((r) => r.validationError);
    if (invalidRows.length > 0) {
      const names = invalidRows.map((r) => r.employeeName).join(', ');
      toast.error(`Fix salary issues before running payroll: ${names}`);
      return;
    }
    setRunPanelOpen(true);
  };

  // ── Salary columns ──────────────────────────────────────────────────────────
  const salaryColumns: Column<PayrollRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.employeeName} avatarUrl={row.avatarUrl} size="sm" />
          <div>
            <div className="flex items-center gap-1.5">
              <p
                className={`font-medium ${row.validationError ? 'text-red-500' : 'text-gray-900'}`}
              >
                {row.employeeName}
              </p>
              {row.validationError && (
                <div
                  title={row.validationError}
                  className="w-2 h-2 rounded-full bg-red-500 shrink-0 cursor-help"
                />
              )}
            </div>
            {!row.validationError && row.department && (
              <p className="text-xs text-gray-500">{row.department}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'basicSalary',
      label: 'Basic Salary',
      width: 'minmax(150px, 0.5fr)',
      render: (row) => (
        <NumberField value={row.basicSalary} onChange={(n) => handleBasicChange(row.id, n)} />
      ),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      width: 'minmax(150px, 0.5fr)',
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
      width: 'minmax(150px, 0.5fr)',
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
      key: 'grossSalary',
      label: 'Gross',
      width: '100px',
      render: (row) => (row.validationError ? '—' : money(row.grossSalary)),
    },
    {
      key: 'employeeSSNIT',
      label: payrollLabels.employeeLabel,
      width: '100px',
      render: (row) => (row.validationError ? '—' : money(row.employeeStatutoryContrib)),
    },
    {
      key: 'paye',
      label: 'PAYE',
      width: '100px',
      render: (row) => (row.validationError ? '—' : money(row.paye)),
    },
    {
      key: 'netSalary',
      label: 'Net Salary',
      width: '150px',
      render: (row) =>
        row.validationError ? (
          '—'
        ) : (
          <span className="font-semibold text-emerald-600">{money(row.netSalary)}</span>
        ),
    },
  ];

  // ── Commission columns ──────────────────────────────────────────────────────
  const commissionColumns: Column<CommissionRow>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: 'minmax(200px, 2fr)',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.employeeName} avatarUrl={row.avatarUrl} size="sm" />
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
      width: 'minmax(150px, 1.5fr)',
      render: (row) => (
        <NumberField value={row.commission} onChange={(n) => handleCommissionChange(row.id, n)} />
      ),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      width: 'minmax(150px, 1.5fr)',
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
      width: 'minmax(150px, 1.5fr)',
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
      width: '100px',
      render: (row) => money(row.gross),
    },
    {
      key: 'tax',
      label: 'Tax (10%)',
      width: '100px',
      render: (row) => <span className="text-amber-600">{money(row.tax)}</span>,
    },
    {
      key: 'netPay',
      label: 'Net Pay',
      width: '150px',
      render: (row) => <span className="font-semibold text-emerald-600">{money(row.netPay)}</span>,
    },
  ];

  const hasSalaryEmployees = payrollRows.length > 0;
  const hasCommissionEmployees = commissionRows.length > 0;

  const viewToggle = hasSalaryEmployees && hasCommissionEmployees && (
    <SegmentedToggle
      value={view}
      onChange={(v) => {
        setView(v);
        setSearchQuery('');
      }}
      options={[
        { label: 'Salary', value: 'salary' },
        { label: 'Commission', value: 'commission' },
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Metric cards — context-aware */}
      {view === 'salary' ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
          <KpiCard
            label="Total Gross"
            value={money(salaryTotals.gross)}
            icon={TrendingUp}
            iconColor="#2a78d6"
          />
          <KpiCard
            label="Total Net Pay"
            value={money(salaryTotals.net)}
            icon={TrendingUp}
            iconColor="#1baf7a"
          />
          <KpiCard
            label="Total PAYE"
            value={money(salaryTotals.paye)}
            icon={TrendingDown}
            iconColor="#eda100"
          />
          <KpiCard
            label={payrollLabels.summaryLabel}
            value={money(salaryTotals.statutory)}
            icon={TrendingUp}
            iconColor="#2a78d6"
          />
          <KpiCard
            label="Employer Cost"
            value={money(salaryTotals.employerCost)}
            icon={TrendingUp}
            iconColor="#2a78d6"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 shrink-0">
          <KpiCard
            label="Total Gross"
            value={money(commissionTotals.gross)}
            icon={TrendingUp}
            iconColor="#2a78d6"
          />
          <KpiCard
            label="Total Tax (10%)"
            value={money(commissionTotals.tax)}
            icon={TrendingDown}
            iconColor="#eda100"
          />
          <KpiCard
            label="Total Net Pay"
            value={money(commissionTotals.net)}
            icon={TrendingUp}
            iconColor="#1baf7a"
          />
        </div>
      )}

      {view === 'salary' ? (
        <DataTable
          columns={salaryColumns}
          data={filteredSalaryRows}
          isLoading={isLoading}
          emptyMessage={
            payrollRows.length === 0
              ? 'No salary employees found. Employees must be Active or Probation with Salary or Salary + Commission type.'
              : 'No employees match your search.'
          }
          searchPlaceholder="Search employee name..."
          onSearch={setSearchQuery}
          extraFilters={viewToggle}
          secondaryButton={{
            label: 'Drafts',
            badgeCount: rejectedDraftsCount,
            onClick: () => setDraftsPanelOpen(true),
          }}
          actionButton={{ label: 'Run Payroll', onClick: handleRunPayroll }}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
        />
      ) : (
        <DataTable
          columns={commissionColumns}
          data={filteredCommissionRows}
          isLoading={isLoading}
          emptyMessage="No commission employees found."
          searchPlaceholder="Search employee name..."
          onSearch={setSearchQuery}
          extraFilters={viewToggle}
          secondaryButton={{
            label: 'Drafts',
            badgeCount: rejectedDraftsCount,
            onClick: () => setDraftsPanelOpen(true),
          }}
          actionButton={{ label: 'Run Payroll', onClick: handleRunPayroll }}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
        />
      )}

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

      <RunPayrollPanel
        isOpen={runPanelOpen}
        onClose={() => setRunPanelOpen(false)}
        totals={allSalaryTotals}
        commissionTotals={allCommissionTotals}
        overrides={overrides}
        payrollCountry={payrollCountry}
        payrollCurrency={payrollCurrency}
      />

      <PayrollDraftsPanel
        isOpen={draftsPanelOpen}
        onClose={() => setDraftsPanelOpen(false)}
        onLoad={({
          basicMap,
          commissionMap,
          taxPolicyMap,
          fixedTaxAmountMap,
          commissionTaxableMap,
          allowancesMap,
          deductionItemsMap,
        }: DraftLoadData) => {
          setBasicMap(basicMap);
          setCommissionMap(commissionMap);
          setTaxPolicyMap(taxPolicyMap);
          setFixedTaxAmountMap(fixedTaxAmountMap);
          setCommissionTaxableMap(commissionTaxableMap);
          setAllowancesMap(allowancesMap);
          setDeductionItemsMap(deductionItemsMap);
        }}
      />
    </div>
  );
}
