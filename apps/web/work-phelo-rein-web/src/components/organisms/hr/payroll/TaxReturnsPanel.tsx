'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PayrollItem } from '@/types/hr';
import {
  payrollMonthLabel,
  downloadTAXFormPDF,
  PayslipCompanyInfo,
  PayslipEmployeeInfo,
  MONTH_OPTIONS,
} from '@/lib/payrollUtils';
import { formatPayrollMoney, getPayrollLabels } from '@/lib/payrollDisplay';

interface TaxReturnsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  payslips: PayrollItem[];
  companyInfo?: PayslipCompanyInfo;
  employeeInfo?: PayslipEmployeeInfo;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => {
  const y = currentYear - 5 + i + 1;
  return { value: String(y), label: String(y) };
}).reverse();

export function TaxReturnsPanel({
  isOpen,
  onClose,
  payslips,
  companyInfo,
  employeeInfo,
}: TaxReturnsPanelProps) {
  const [startMonth, setStartMonth] = useState('1');
  const [startYear, setStartYear] = useState(String(currentYear));
  const [endMonth, setEndMonth] = useState(String(new Date().getMonth() + 1));
  const [endYear, setEndYear] = useState(String(currentYear));
  const [downloading, setDownloading] = useState(false);

  const startVal = Number(startYear) * 12 + Number(startMonth);
  const endVal = Number(endYear) * 12 + Number(endMonth);
  const rangeValid = endVal >= startVal;

  const filtered = rangeValid
    ? payslips.filter((p) => {
        if (!p.payrollRun) return false;
        const val = p.payrollRun.year * 12 + p.payrollRun.month;
        return val >= startVal && val <= endVal;
      })
    : [];
  const primaryRun = filtered[0]?.payrollRun;
  const payrollLabels = getPayrollLabels(primaryRun?.payrollCountry);
  const money = (value: string | number) =>
    formatPayrollMoney(value, primaryRun?.payrollCurrency, primaryRun?.payrollCountry);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Tax Returns"
      description="Select a date range to view payslips for that period."
      footer={
        <div className="flex flex-col gap-4">
          {filtered.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                {filtered.length} month{filtered.length !== 1 ? 's' : ''} total
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">Gross</span>
                  <span className="text-xs text-gray-700">
                    {money(filtered.reduce((s, p) => s + parseFloat(p.grossSalary), 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">{payrollLabels.tabLabel}</span>
                  <span className="text-xs text-gray-700">
                    {money(filtered.reduce((s, p) => s + parseFloat(p.employeeSSNIT), 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">Taxable</span>
                  <span className="text-xs text-gray-700">
                    {money(filtered.reduce((s, p) => s + parseFloat(p.taxableIncome), 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400">PAYE</span>
                  <span className="text-xs text-gray-700">
                    {money(filtered.reduce((s, p) => s + parseFloat(p.payeTax), 0))}
                  </span>
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-600">Net</span>
                <span className="text-sm font-bold text-gray-900">
                  {money(filtered.reduce((s, p) => s + parseFloat(p.netSalary), 0))}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={filtered.length === 0 || !rangeValid || downloading}
              className="flex items-center gap-2 bg-brand hover:bg-brand-hover"
              onClick={async () => {
                if (filtered.length === 0) return;
                const year = Number(endYear);
                setDownloading(true);
                try {
                  await downloadTAXFormPDF(
                    filtered,
                    year,
                    companyInfo ?? { name: '' },
                    employeeInfo,
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
              {downloading ? 'Generating…' : 'TAX Form'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Date range pickers */}
      <div className="flex flex-col gap-4 shrink-0">
        <div className="grid grid-cols-2 gap-3">
          <SearchSelect
            label="Start Month"
            options={MONTH_OPTIONS}
            value={startMonth}
            onChange={setStartMonth}
          />
          <SearchSelect
            label="Start Year"
            options={YEARS}
            value={startYear}
            onChange={setStartYear}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SearchSelect
            label="End Month"
            options={MONTH_OPTIONS}
            value={endMonth}
            onChange={setEndMonth}
          />
          <SearchSelect label="End Year" options={YEARS} value={endYear} onChange={setEndYear} />
        </div>

        {!rangeValid && (
          <p className="text-xs text-red-500">End date must be on or after the start date.</p>
        )}
      </div>

      <div className="h-px bg-gray-100 shrink-0" />

      {/* Results */}
      <div className="flex flex-col gap-3">
        {!rangeValid ? null : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No payslips found for the selected range.
          </p>
        ) : (
          <>
            {filtered.map((p) => {
              const run = p.payrollRun!;
              const label = payrollMonthLabel(run.month, run.year);
              const rowLabels = getPayrollLabels(run.payrollCountry);
              const rowMoney = (value: string | number) =>
                formatPayrollMoney(value, run.payrollCurrency, run.payrollCountry);
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 border border-gray-200 rounded-card bg-white flex flex-col gap-2"
                >
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Gross</span>
                      <span className="text-xs text-gray-700">{rowMoney(p.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">{rowLabels.tabLabel}</span>
                      <span className="text-xs text-gray-700">{rowMoney(p.employeeSSNIT)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Taxable</span>
                      <span className="text-xs text-gray-700">{rowMoney(p.taxableIncome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">PAYE</span>
                      <span className="text-xs text-gray-700">{rowMoney(p.payeTax)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-500">Net</span>
                    <span className="text-sm font-bold text-gray-900">{rowMoney(p.netSalary)}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </SidePanel>
  );
}
