'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useRunPayroll, useSubmitPayroll, useUpdatePayrollItem } from '@/hooks';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatPayrollMoney } from '@/lib/payrollDisplay';
import { MetricPreview } from '@/components/molecules/shared/MetricPreview';
import { MONTH_OPTIONS } from '@/lib/payrollUtils';
import type { EmployeeOverride } from '@/types/payroll';

export type { EmployeeOverride };

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => {
  const y = currentYear - 1 + i;
  return { value: String(y), label: String(y) };
});

interface Totals {
  gross: number;
  net: number;
  paye: number;
  statutory: number;
  employerCost: number;
}

interface CommissionTotals {
  gross: number;
  tax: number;
  net: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  totals: Totals;
  commissionTotals?: CommissionTotals;
  overrides: Record<string, EmployeeOverride>;
  payrollCountry?: string;
  payrollCurrency?: string;
}

export function RunPayrollPanel({
  isOpen,
  onClose,
  totals,
  commissionTotals,
  overrides,
  payrollCountry,
  payrollCurrency,
}: Props) {
  const toast = useToast();
  useTenantConfig();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { mutateAsync: runPayroll, isPending: isRunning } = useRunPayroll();
  const { mutateAsync: submitPayroll, isPending: isSubmitting } = useSubmitPayroll();
  const { mutateAsync: updateItem, isPending: isUpdating } = useUpdatePayrollItem();
  const isPending = isRunning || isUpdating || isSubmitting;

  const selectedMonthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? '';
  const money = (value: number) => formatPayrollMoney(value, payrollCurrency, payrollCountry);

  const handleClose = () => {
    setShowConfirm(false);
    onClose();
  };

  const handleConfirm = async () => {
    try {
      const run = await runPayroll({
        month: Number(month),
        year: Number(year),
        notes: notes.trim() || undefined,
      });

      for (const item of run.items) {
        const override = overrides[item.employeeId];
        if (override) {
          await updateItem({
            payrollRunId: run.id,
            itemId: item.id,
            data: override,
          });
        }
      }

      await submitPayroll(run.id);

      toast.success(`${selectedMonthLabel} ${year} payroll submitted for approval`);
      setShowConfirm(false);
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to process payroll'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="Run Payroll"
        description="Select the payroll period and review the summary before submitting for approval."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={() => setShowConfirm(true)}>Run Payroll</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <SearchSelect label="Month" options={MONTH_OPTIONS} value={month} onChange={setMonth} />
          <SearchSelect label="Year" options={YEARS} value={year} onChange={setYear} />

          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-medium text-gray-700">
              Details <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a short report or notes for this payroll run..."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
            />
          </div>

          <MetricPreview
            title="Salary Summary"
            metrics={[
              { label: 'Total Gross', value: money(totals.gross) },
              { label: 'Total PAYE', value: money(totals.paye) },
              { label: 'Employer Cost', value: money(totals.employerCost), highlight: true },
            ]}
          />
          {commissionTotals && commissionTotals.gross > 0 && (
            <MetricPreview
              title="Commission Summary"
              metrics={[
                { label: 'Total Gross', value: money(commissionTotals.gross) },
                { label: 'Total Tax (10%)', value: money(commissionTotals.tax) },
                { label: 'Total Net Pay', value: money(commissionTotals.net), highlight: true },
              ]}
            />
          )}
        </div>
      </SidePanel>

      <Modal
        isOpen={showConfirm}
        onClose={() => !isPending && setShowConfirm(false)}
        title="Confirm Payroll Run"
        hideClose={isPending}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} isLoading={isPending} loadingText="Processing…">
              Run Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to run payroll for{' '}
          <span className="font-medium text-gray-900">
            {selectedMonthLabel} {year}
          </span>
          . Payslips will be calculated for all active employees and submitted for approval.{' '}
          {commissionTotals && commissionTotals.gross > 0 ? (
            <>
              Total employer cost:{' '}
              <span className="font-semibold text-orange-500">{money(totals.employerCost)}</span>.
              Commission net payout:{' '}
              <span className="font-semibold text-orange-500">{money(commissionTotals.net)}</span>.
            </>
          ) : (
            <>
              The total employer cost for this period is{' '}
              <span className="font-semibold text-orange-500">{money(totals.employerCost)}</span>.
            </>
          )}{' '}
          This action cannot be undone once submitted.
        </p>
      </Modal>
    </>
  );
}
