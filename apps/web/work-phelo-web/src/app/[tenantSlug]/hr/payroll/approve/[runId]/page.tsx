'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { usePayrollRun, useReturnPayrollToDraft } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PayrollItem } from '@/types/hr';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import {
  formatPayrollMoney,
  getPayrollLabels,
  normalizePayrollCountry,
} from '@/lib/payrollDisplay';
import { ApprovePayrollPanel } from '@/components/organisms/hr/payroll/ApprovePayrollPanel';

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

// Round to 2dp to match the Decimal.js precision the backend uses when storing payeTax.
function r2(n: number) {
  return Math.round(n * 100) / 100;
}

// For SALARY_PLUS_COMMISSION, derive salary-only figures from the combined payroll item.
// The backend stores payeTax = salary_progressive_PAYE + commission × 0.10.
// We must use the same rounded commissionTax (r2) that the backend applied, otherwise
// the subtraction leaves a floating-point residual in the displayed salary PAYE.
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

// For SALARY_PLUS_COMMISSION, commission section shows commission-only figures.
// Allowances and deductions are already shown in the salary section.
// For pure COMMISSION, use the stored figures directly — the backend calculates those
// with allowances included and flat 10% tax (via our compensationType branch).
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

export default function ApprovePayrollDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; runId: string }>;
}) {
  const { tenantSlug, runId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const { data: run, isLoading } = usePayrollRun(runId);
  const { mutateAsync: returnToDraft, isPending: isRejecting } = useReturnPayrollToDraft();

  const [showApprovePanel, setShowApprovePanel] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [returnNote, setReturnNote] = useState('');

  const periodLabel = run ? payrollMonthLabel(run.month, run.year) : '—';
  const backHref = `/${tenantSlug}/hr/payroll?tab=approve`;
  const payrollLabels = getPayrollLabels(run?.payrollCountry);
  const money = (value: string | number | null | undefined) =>
    formatPayrollMoney(value, run?.payrollCurrency, run?.payrollCountry);
  const showGhanaTiers = normalizePayrollCountry(run?.payrollCountry) === 'GH';

  const allItems = useMemo(() => run?.items ?? [], [run]);

  const salaryItems = useMemo(
    () => allItems.filter((i) => i.compensationTypeSnapshot !== 'COMMISSION'),
    [allItems],
  );

  const commissionItems = useMemo(
    () => allItems.filter((i) => i.compensationTypeSnapshot !== 'SALARY'),
    [allItems],
  );

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

  const handleReject = async () => {
    try {
      await returnToDraft({ id: runId, note: returnNote.trim() });
      toast.success(`${periodLabel} payroll rejected`);
      router.push(backHref);
    } catch (err) {
      toast.error(extractError(err, 'Failed to reject payroll'));
    }
  };

  const hasBoth = salaryItems.length > 0 && commissionItems.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={backHref} className="hover:text-gray-700 transition-colors">
            Approve
          </Link>
          <Icons.ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{periodLabel}</span>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowRejectModal(true)} disabled={isRejecting}>
            Reject
          </Button>
          <Button onClick={() => setShowApprovePanel(true)} disabled={isRejecting}>
            Approve Payroll
          </Button>
        </div>
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

      <ApprovePayrollPanel
        run={showApprovePanel ? (run ?? null) : null}
        onClose={() => setShowApprovePanel(false)}
        onApproved={() => router.push(backHref)}
      />

      {/* Reject modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => !isRejecting && setShowRejectModal(false)}
        title="Reject Payroll"
        hideClose={isRejecting}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={isRejecting}
              loadingText="Rejecting…"
              disabled={!returnNote.trim()}
            >
              Reject Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to reject the payroll for{' '}
          <span className="font-medium text-gray-900">{periodLabel}</span>. The payroll manager will
          need to revise and resubmit.
        </p>
        <div className="flex flex-col gap-(--field-label-gap,0.125rem) mt-4">
          <label className="text-sm font-bold text-gray-900">
            Rejection Note <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="Explain why this payroll is being rejected…"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg border text-gray-900 border-gray-200 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-gray-400 resize-none transition-colors"
          />
        </div>
      </Modal>
    </div>
  );
}
