'use client';

import { use, useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Download, Loader2 } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { usePayrollRun, useMarkPayrollPaid } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PayrollItem, PayrollRunDetail } from '@/types/hr';
import { useAuthStore } from '@/store/auth.store';
import {
  payrollMonthLabel,
  downloadPayrollBankFormat,
  downloadPayrollFullFormat,
  downloadPayrollPDFFormat,
} from '@/lib/payrollUtils';
import {
  formatPayrollMoney,
  getPayrollLabels,
  normalizePayrollCountry,
} from '@/lib/payrollDisplay';

function DownloadAllMenu({ detail, label }: { detail: PayrollRunDetail; label: string }) {
  const [open, setOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'bank' | 'full' | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const companyName = useAuthStore((s) => s.user?.tenantName ?? '');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingFormat(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFileType = async (type: 'csv' | 'pdf') => {
    const format = pendingFormat!;
    setPendingFormat(null);
    setLoading(true);
    try {
      if (type === 'csv') {
        if (format === 'bank') downloadPayrollBankFormat(detail, label, companyName);
        else downloadPayrollFullFormat(detail, label, companyName);
      } else {
        await downloadPayrollPDFFormat(detail, label, format, companyName);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!loading) {
            setOpen((v) => !v);
            setPendingFormat(null);
          }
        }}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Download
        <Icons.ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-10 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => {
              setOpen(false);
              setPendingFormat('bank');
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Bank format
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setPendingFormat('full');
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Full format
          </button>
        </div>
      )}

      {pendingFormat && (
        <div className="absolute right-0 top-full mt-1.5 z-10 w-44 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
          <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {pendingFormat === 'bank' ? 'Bank format' : 'Full format'}
          </p>
          <button
            onClick={() => handleFileType('csv')}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            CSV
          </button>
          <button
            onClick={() => handleFileType('pdf')}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function itemAllowances(row: PayrollItem): number {
  if (row.allowanceItems?.length) {
    return row.allowanceItems.reduce((s, a) => s + parseFloat(a.amount), 0);
  }
  return parseFloat(row.totalAllowances) + parseFloat(row.transportAmount);
}

function itemDeductions(row: PayrollItem): number {
  if (row.deductionItems?.length) {
    return row.deductionItems.reduce((s, d) => s + parseFloat(d.amount), 0);
  }
  return parseFloat(row.otherDeductions);
}

function salarySectionFigures(row: PayrollItem) {
  if (row.compensationTypeSnapshot !== 'SALARY_PLUS_COMMISSION') return null;
  const commission = parseFloat(row.commissionAmount);
  const commissionTax = r2(commission * 0.1);
  const commissionNet = commission - commissionTax;
  return {
    gross: parseFloat(row.grossSalary) - commission,
    paye: r2(parseFloat(row.payeTax) - commissionTax),
    net: r2(parseFloat(row.netSalary) - commissionNet),
  };
}

function commissionSectionFigures(row: PayrollItem) {
  const commission = parseFloat(row.commissionAmount);
  if (row.compensationTypeSnapshot === 'SALARY_PLUS_COMMISSION') {
    const tax = r2(commission * 0.1);
    return {
      commission,
      allowances: 0,
      deductions: 0,
      gross: commission,
      tax,
      net: r2(commission - tax),
    };
  }
  return {
    commission,
    allowances: itemAllowances(row),
    deductions: itemDeductions(row),
    gross: parseFloat(row.grossSalary),
    tax: parseFloat(row.payeTax),
    net: parseFloat(row.netSalary),
  };
}

function EmployeeCell({ row }: { row: PayrollItem }) {
  return (
    <div>
      <p className="font-medium text-gray-900">
        {row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '—'}
      </p>
      {row.employee?.jobTitle && <p className="text-xs text-gray-400">{row.employee.jobTitle}</p>}
    </div>
  );
}

export default function PayrollHistoryDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; runId: string }>;
}) {
  const { tenantSlug, runId } = use(params);
  const toast = useToast();
  const { data: run, isLoading } = usePayrollRun(runId);
  const { mutate: markPaid, isPending: isMarkingPaid } = useMarkPayrollPaid();

  const periodLabel = run ? payrollMonthLabel(run.month, run.year) : '—';
  const fileLabel = periodLabel.replace(' ', '-');
  const isPaid = run?.status === 'PAID';
  const payrollLabels = getPayrollLabels(run?.payrollCountry);
  const showGhanaTiers = normalizePayrollCountry(run?.payrollCountry) === 'GH';

  const money = (value: string | number | null | undefined) =>
    formatPayrollMoney(value, run?.payrollCurrency, run?.payrollCountry);

  const handleMarkPaid = () => {
    markPaid(runId, {
      onSuccess: () => toast.success(`${periodLabel} marked as paid`),
      onError: (err) => toast.error(extractError(err, 'Failed to mark payroll as paid')),
    });
  };

  const allItems = useMemo(() => run?.items ?? [], [run]);

  const salaryItems = useMemo(
    () => allItems.filter((i) => i.compensationTypeSnapshot !== 'COMMISSION'),
    [allItems],
  );

  const commissionItems = useMemo(
    () => allItems.filter((i) => i.compensationTypeSnapshot !== 'SALARY'),
    [allItems],
  );

  const hasBoth = salaryItems.length > 0 && commissionItems.length > 0;

  // ── Salary columns ──────────────────────────────────────────────────────────
  const salaryColumns: Column<PayrollItem>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => <EmployeeCell row={row} />,
    },
    {
      key: 'basicSalary',
      label: 'Basic Salary',
      width: '100px',
      render: (row) => money(row.basicSalary),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      width: '100px',
      render: (row) => money(itemAllowances(row)),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      width: '100px',
      render: (row) => money(itemDeductions(row)),
    },
    {
      key: 'grossSalary',
      label: 'Gross',
      width: '100px',
      render: (row) => {
        const s = salarySectionFigures(row);
        return money(s ? s.gross : parseFloat(row.grossSalary));
      },
    },
    ...(showGhanaTiers
      ? [
          {
            key: 'tier1Contribution',
            label: 'Tier 1 (0.5%)',
            width: '100px',
            render: (row: PayrollItem) => money(row.tier1Contribution),
          },
          {
            key: 'tier2Contribution',
            label: 'Tier 2 (5%)',
            width: '100px',
            render: (row: PayrollItem) => money(row.tier2Contribution),
          },
        ]
      : [
          {
            key: 'employeeSSNIT',
            label: payrollLabels.employeeLabel,
            width: '100px',
            render: (row: PayrollItem) => money(row.employeeSSNIT),
          },
        ]),
    {
      key: 'payeTax',
      label: 'PAYE',
      width: '100px',
      render: (row) => {
        const s = salarySectionFigures(row);
        return money(s ? s.paye : parseFloat(row.payeTax));
      },
    },
    {
      key: 'netSalary',
      label: 'Net Salary',
      width: '150px',
      render: (row) => {
        const s = salarySectionFigures(row);
        return (
          <span className="font-semibold text-emerald-600">
            {money(s ? s.net : parseFloat(row.netSalary))}
          </span>
        );
      },
    },
  ];

  // ── Commission columns ──────────────────────────────────────────────────────
  const commissionColumns: Column<PayrollItem>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => <EmployeeCell row={row} />,
    },
    {
      key: 'commissionAmount',
      label: 'Commission',
      width: '150px',
      render: (row) => money(commissionSectionFigures(row).commission),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      width: '150px',
      render: (row) => money(commissionSectionFigures(row).allowances),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      width: '150px',
      render: (row) => money(commissionSectionFigures(row).deductions),
    },
    {
      key: 'gross',
      label: 'Gross',
      width: '150px',
      render: (row) => money(commissionSectionFigures(row).gross),
    },
    {
      key: 'tax',
      label: 'Tax (10%)',
      width: '150px',
      render: (row) => (
        <span className="text-amber-600">{money(commissionSectionFigures(row).tax)}</span>
      ),
    },
    {
      key: 'netPay',
      label: 'Net Pay',
      width: '200px',
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {money(commissionSectionFigures(row).net)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/hr/payroll?tab=history`}
            className="hover:text-gray-700 transition-colors"
          >
            History
          </Link>
          <Icons.ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{periodLabel}</span>
        </nav>

        {run &&
          (isPaid ? (
            <DownloadAllMenu detail={run} label={fileLabel} />
          ) : (
            <Button onClick={handleMarkPaid} isLoading={isMarkingPaid} loadingText="Marking…">
              Mark as Paid
            </Button>
          ))}
      </div>

      {/* Salary section */}
      {(salaryItems.length > 0 || isLoading) && (
        <div className="flex flex-col gap-3">
          {hasBoth && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Salary</p>
          )}
          <DataTable
            columns={salaryColumns}
            data={salaryItems}
            isLoading={isLoading}
            currentPage={1}
            totalPages={1}
            onPageChange={() => {}}
          />
        </div>
      )}

      {/* Commission section */}
      {commissionItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {hasBoth && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Commission
            </p>
          )}
          <DataTable
            columns={commissionColumns}
            data={commissionItems}
            isLoading={isLoading}
            currentPage={1}
            totalPages={1}
            onPageChange={() => {}}
          />
        </div>
      )}
    </div>
  );
}
