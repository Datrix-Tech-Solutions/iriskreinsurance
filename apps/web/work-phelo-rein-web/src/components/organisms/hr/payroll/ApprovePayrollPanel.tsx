'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { PayrollRun } from '@/types/hr';
import { useApprovePayroll } from '@/hooks';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { formatPayrollMoney } from '@/lib/payrollDisplay';

interface Props {
  run: PayrollRun | null;
  onClose: () => void;
  onApproved?: () => void;
}

export function ApprovePayrollPanel({ run, onClose, onApproved }: Props) {
  const toast = useToast();
  useTenantConfig();
  const [showConfirm, setShowConfirm] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const { mutate: approve, isPending } = useApprovePayroll();

  const isOpen = run !== null;
  const periodLabel = run ? payrollMonthLabel(run.month, run.year) : '';
  const money = (value: string | number) =>
    formatPayrollMoney(value, run?.payrollCurrency, run?.payrollCountry);

  const handleClose = () => {
    setShowConfirm(false);
    setApprovalNote('');
    onClose();
  };

  const handleConfirm = () => {
    if (!run || !approvalNote.trim()) return;
    approve(
      { id: run.id, note: approvalNote.trim() },
      {
        onSuccess: () => {
          toast.success(`${periodLabel} payroll approved`);
          setShowConfirm(false);
          setApprovalNote('');
          onClose();
          onApproved?.();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to approve payroll')),
      },
    );
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="Approve Payroll"
        description="Review the payroll summary before approving for payment."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button disabled={!approvalNote.trim()} onClick={() => setShowConfirm(true)}>
              Approve Payroll
            </Button>
          </div>
        }
      >
        {run && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-500">Payroll Period</p>
              <p className="text-sm font-semibold text-gray-900">{periodLabel}</p>
            </div>

            {run.notes && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-500">Details</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-input px-3 py-2.5">
                  {run.notes}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
              <p className="text-xs text-gray-500">Approval Note</p>
              <textarea
                rows={4}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Explain why this payroll is being approved…"
                className="w-full px-3 py-2.5 text-sm rounded-lg border text-gray-900 border-gray-200 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-gray-400 resize-none transition-colors"
              />
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 flex flex-col gap-4">
              <p className="text-sm font-medium text-gray-600">Payroll Summary</p>
              <div className="grid grid-cols-2 gap-y-4 gap-x-0 divide-y divide-gray-200">
                <div className="flex flex-col gap-1 pb-4 pr-4 border-r border-gray-200">
                  <p className="text-xs text-gray-500">Total Gross</p>
                  <p className="text-sm font-semibold text-gray-900">{money(run.totalGross)}</p>
                </div>
                <div className="flex flex-col gap-1 pb-4 pl-4">
                  <p className="text-xs text-gray-500">Total Net Pay</p>
                  <p className="text-sm font-semibold text-emerald-600">{money(run.totalNet)}</p>
                </div>
                <div className="flex flex-col gap-1 pt-4 pr-4 border-r border-gray-200">
                  <p className="text-xs text-gray-500">Total PAYE</p>
                  <p className="text-sm font-semibold text-gray-900">{money(run.totalPAYE)}</p>
                </div>
                <div className="flex flex-col gap-1 pt-4 pl-4">
                  <p className="text-xs text-gray-500">Employer Cost</p>
                  <p className="text-sm font-semibold text-orange-500">
                    {money(run.totalEmployerCost)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={showConfirm}
        onClose={() => !isPending && setShowConfirm(false)}
        title="Confirm Payroll Approval"
        hideClose={isPending}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              isLoading={isPending}
              loadingText="Approving…"
              disabled={!approvalNote.trim()}
            >
              Approve Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to approve payroll for{' '}
          <span className="font-medium text-gray-900">{periodLabel}</span>. Payslips will be
          distributed to all active employees and the payroll will be marked as approved. The total
          employer cost for this period is{' '}
          <span className="font-semibold text-orange-500">
            {run ? money(run.totalEmployerCost) : '—'}
          </span>
          . This action cannot be undone once approved.
        </p>
        {approvalNote.trim() && (
          <p className="text-sm text-gray-500 leading-relaxed mt-3">
            Approval note: <span className="text-gray-700">{approvalNote.trim()}</span>
          </p>
        )}
      </Modal>
    </>
  );
}
