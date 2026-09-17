'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { AllowancesPanel } from '@/components/organisms/hr/payroll/AllowancesPanel';
import { DeductionsPanel } from '@/components/organisms/hr/payroll/DeductionsPanel';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { Employee } from '@/types/hr';

function fmtAmt(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  employee: Employee;
}

export function PayrollSection({ employee }: Props) {
  const canManage = usePermission(Permission.RUN_PAYROLL);
  const [allowancesOpen, setAllowancesOpen] = useState(false);
  const [deductionsOpen, setDeductionsOpen] = useState(false);

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const savedAllowances = employee.allowances ?? [];
  const savedDeductions = employee.deductions ?? [];

  const totalAllowances = savedAllowances.reduce((sum, a) => sum + Number(a.amount), 0);
  const activeDeductions = savedDeductions.filter((d) => d.amountPaid < d.totalAmount);
  const monthlyDeductions = activeDeductions.reduce(
    (sum, d) => sum + Math.min(Math.max(0, d.totalAmount - d.amountPaid), d.monthlyRate),
    0,
  );

  return (
    <>
      <SectionCard title="Payroll">
        <div className="flex flex-col gap-4">
          {/* Allowances row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-gray-700">Allowances</p>
              {savedAllowances.length === 0 ? (
                <p className="text-xs text-gray-400">No allowances set</p>
              ) : (
                <p className="text-xs text-gray-500">
                  {savedAllowances.length} allowance{savedAllowances.length !== 1 ? 's' : ''} ·{' '}
                  <span className="font-medium text-gray-700">{fmtAmt(totalAllowances)}</span>/month
                </p>
              )}
            </div>
            {canManage && (
              <button
                onClick={() => setAllowancesOpen(true)}
                className="text-xs font-medium text-brand hover:text-brand/80 transition-colors shrink-0"
              >
                Manage
              </button>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* Deductions row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-gray-700">Deductions</p>
              {savedDeductions.length === 0 ? (
                <p className="text-xs text-gray-400">No deductions set</p>
              ) : activeDeductions.length === 0 ? (
                <p className="text-xs text-gray-400">
                  {savedDeductions.length} deduction{savedDeductions.length !== 1 ? 's' : ''} · all
                  completed
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  {activeDeductions.length} active deduction
                  {activeDeductions.length !== 1 ? 's' : ''} ·{' '}
                  <span className="font-medium text-gray-700">{fmtAmt(monthlyDeductions)}</span>
                  /month
                </p>
              )}
            </div>
            {canManage && (
              <button
                onClick={() => setDeductionsOpen(true)}
                className="text-xs font-medium text-brand hover:text-brand/80 transition-colors shrink-0"
              >
                Manage
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <AllowancesPanel
        isOpen={allowancesOpen}
        onClose={() => setAllowancesOpen(false)}
        employeeId={employee.id}
        employeeName={employeeName}
      />

      <DeductionsPanel
        isOpen={deductionsOpen}
        onClose={() => setDeductionsOpen(false)}
        employeeId={employee.id}
        employeeName={employeeName}
      />
    </>
  );
}
