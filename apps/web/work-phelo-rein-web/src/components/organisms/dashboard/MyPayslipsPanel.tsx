'use client';

import { useState, useMemo } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PayrollItem } from '@/types/hr';
import { useTenantConfig } from '@/hooks/useTenantConfig';

interface MyPayslipsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  payslips: PayrollItem[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function MyPayslipsPanel({ isOpen, onClose, payslips }: MyPayslipsPanelProps) {
  const { currency } = useTenantConfig();
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const approved = useMemo(
    () => payslips.filter((p) => p.payrollRun?.status === 'APPROVED'),
    [payslips],
  );

  const monthOptions = useMemo(() => {
    const seen = new Set<number>();
    const options = approved
      .filter((p) => p.payrollRun && !seen.has(p.payrollRun.month) && seen.add(p.payrollRun.month))
      .map((p) => ({
        value: String(p.payrollRun!.month),
        label: MONTH_NAMES[p.payrollRun!.month - 1],
      }))
      .sort((a, b) => Number(a.value) - Number(b.value));
    return [{ value: '', label: 'All months' }, ...options];
  }, [approved]);

  const yearOptions = useMemo(() => {
    const seen = new Set<number>();
    const options = approved
      .filter((p) => p.payrollRun && !seen.has(p.payrollRun.year) && seen.add(p.payrollRun.year))
      .map((p) => ({ value: String(p.payrollRun!.year), label: String(p.payrollRun!.year) }))
      .sort((a, b) => Number(b.value) - Number(a.value));
    return [{ value: '', label: 'All years' }, ...options];
  }, [approved]);

  const filtered = useMemo(
    () =>
      approved.filter((p) => {
        if (filterMonth && String(p.payrollRun?.month) !== filterMonth) return false;
        if (filterYear && String(p.payrollRun?.year) !== filterYear) return false;
        return true;
      }),
    [approved, filterMonth, filterYear],
  );

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Payslips"
      description="Your approved payslips."
      width="sm:w-[480px]"
    >
      {approved.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">No approved payslips yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <SearchSelect
              label="Month"
              options={monthOptions}
              value={filterMonth}
              onChange={setFilterMonth}
            />
            <SearchSelect
              label="Year"
              options={yearOptions}
              value={filterYear}
              onChange={setFilterYear}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No payslips match the selected filters.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((p) => {
                const run = p.payrollRun;
                const month = run
                  ? new Date(run.year, run.month - 1).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—';
                const fmt = (v: string) =>
                  `${currency} ${parseFloat(v || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{month}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Gross: {fmt(p.grossSalary)}
                        <span className="mx-1.5">|</span>
                        Deductions: {fmt(p.totalDeductions)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{fmt(p.netSalary)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </SidePanel>
  );
}
