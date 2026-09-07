'use client';

import { useState, useMemo, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useEmployeePayslips } from '@/hooks/hr/usePayroll';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';
import { useTenant } from '@/hooks';
import { PayslipDocument } from '@/components/molecules/hr/payroll/PayslipDocument';
import { PayslipAllowancesPanel } from '@/components/molecules/hr/payroll/PayslipAllowancesPanel';
import { BankingComplianceCard } from '@/components/molecules/hr/payroll/BankingComplianceCard';
import { AllowancesPanel } from '@/components/organisms/hr/payroll/AllowancesPanel';
import { DeductionsPanel } from '@/components/organisms/hr/payroll/DeductionsPanel';
import { TaxReturnsPanel } from '@/components/organisms/hr/payroll/TaxReturnsPanel';
import {
  payrollMonthLabel,
  downloadPayslipPDF,
  type PayslipCompanyInfo,
  type PayslipEmployeeInfo,
  type PayslipYTD,
} from '@/lib/payrollUtils';
import type { Employee, PayrollItem } from '@/types/hr';

function payslipLabel(p: PayrollItem) {
  if (!p.payrollRun) return '—';
  return payrollMonthLabel(p.payrollRun.month, p.payrollRun.year);
}

interface EmployeePayslipTabProps {
  employee: Employee;
}

export function EmployeePayslipTab({ employee }: EmployeePayslipTabProps) {
  const [selectedId, setSelectedId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [taxReturnsOpen, setTaxReturnsOpen] = useState(false);
  const [allowancesOpen, setAllowancesOpen] = useState(false);
  const [deductionsOpen, setDeductionsOpen] = useState(false);

  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);

  const { data: payslipsRaw } = useEmployeePayslips(employee.id);
  const user = useAuthStore((s) => s.user);
  const { data: tenantData } = useTenant(user?.tenantId ?? '');

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const employeeBranch = employee.branch;

  const companyInfo: PayslipCompanyInfo = {
    name: user?.tenantName ?? '',
    email: tenantData?.email,
    phone: tenantData?.phone,
  };

  const employeeInfo: PayslipEmployeeInfo = {
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeNumber: employee.employeeNumber,
    jobTitle: employee.jobTitle,
    department: employee.department?.name,
    tinNumber: employee.tinNumber,
    ssnit: employee.ssnit,
    branchName: employeeBranch?.name,
    branchAddress: employeeBranch?.address,
    branchCity: employeeBranch?.city,
    branchRegion: employeeBranch?.region,
    branchCountry: employeeBranch?.country,
    bankName: employee.bankName,
    bankBranch: employee.bankBranch,
    bankAccountNumber: employee.bankAccountNumber,
  };

  const payslips: PayrollItem[] = useMemo(() => {
    const raw = Array.isArray(payslipsRaw) ? (payslipsRaw as PayrollItem[]) : [];
    return raw
      .filter((p) => p.payrollRun?.status === 'APPROVED' || p.payrollRun?.status === 'PAID')
      .sort((a, b) => {
        const ay = a.payrollRun?.year ?? 0,
          by = b.payrollRun?.year ?? 0;
        const am = a.payrollRun?.month ?? 0,
          bm = b.payrollRun?.month ?? 0;
        return by !== ay ? by - ay : bm - am;
      });
  }, [payslipsRaw]);

  const calcYTD = useCallback(
    (p: PayrollItem): PayslipYTD | undefined => {
      if (!p.payrollRun) return undefined;
      const { year, month } = p.payrollRun;
      const ytdSlips = payslips.filter(
        (s) => s.payrollRun?.year === year && s.payrollRun.month <= month,
      );
      return {
        grossEarnings: ytdSlips.reduce((s, x) => s + parseFloat(x.grossSalary), 0),
        ssnitContribution: ytdSlips.reduce((s, x) => s + parseFloat(x.employeeSSNIT), 0),
        payeTax: ytdSlips.reduce((s, x) => s + parseFloat(x.payeTax), 0),
        netPay: ytdSlips.reduce((s, x) => s + parseFloat(x.netSalary), 0),
      };
    },
    [payslips],
  );

  const selected = payslips.find((p) => p.id === selectedId) ?? payslips[0] ?? null;
  const runStatus = selected?.payrollRun?.status ?? '';
  const canDownload = runStatus === 'APPROVED' || runStatus === 'PAID';

  if (payslips.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">No payslips available yet.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setTaxReturnsOpen(true)}>
            Tax Returns
          </Button>
          <div className="w-48">
            <SearchSelect
              placeholder="Select month…"
              options={payslips.map((p) => ({
                value: p.id,
                label: payslipLabel(p),
                sublabel: p.payrollRun?.status ?? undefined,
              }))}
              value={selected?.id ?? ''}
              onChange={setSelectedId}
            />
          </div>
          {canDownload && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              disabled={downloading}
              onClick={async () => {
                if (!selected) return;
                setDownloading(true);
                try {
                  await downloadPayslipPDF(
                    selected,
                    payslipLabel(selected),
                    companyInfo,
                    employeeInfo,
                    calcYTD(selected),
                  );
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? 'Generating…' : 'Download PDF'}
            </Button>
          )}
        </div>

        {selected && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <PayslipDocument
                item={selected}
                companyName={user?.tenantName ?? ''}
                employeeName={employeeName}
              />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-4">
              <BankingComplianceCard employee={employee} />
              <PayslipAllowancesPanel
                allowances={employee.allowances ?? []}
                deductions={employee.deductions ?? []}
                onManageAllowances={canManagePayroll ? () => setAllowancesOpen(true) : undefined}
                onManageDeductions={canManagePayroll ? () => setDeductionsOpen(true) : undefined}
              />
            </div>
          </div>
        )}
      </div>

      <TaxReturnsPanel
        isOpen={taxReturnsOpen}
        onClose={() => setTaxReturnsOpen(false)}
        payslips={payslips}
        companyInfo={companyInfo}
        employeeInfo={employeeInfo}
      />

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
