'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, FileText } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { usePayrollRuns } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PayrollRun, PayrollRunDetail } from '@/types/hr';
import { AllowanceItem } from '@/lib/payrollCalculations';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { api } from '@/lib/api';
import type { DeductionLineItem, DraftLoadData } from '@/types/payroll';
import { formatPayrollMoney } from '@/lib/payrollDisplay';

export type { DraftLoadData };

async function loadRunData(
  run: PayrollRun,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<DraftLoadData> {
  const detail = await queryClient.fetchQuery<PayrollRunDetail>({
    queryKey: ['payroll', run.id],
    queryFn: async () => {
      const res = await api.get<PayrollRunDetail>(`/hr/payroll/${run.id}`);
      return res.data;
    },
  });

  const basicMap: Record<string, number> = {};
  const commissionMap: Record<string, number> = {};
  const taxPolicyMap: DraftLoadData['taxPolicyMap'] = {};
  const fixedTaxAmountMap: DraftLoadData['fixedTaxAmountMap'] = {};
  const commissionTaxableMap: DraftLoadData['commissionTaxableMap'] = {};
  const allowancesMap: Record<string, AllowanceItem[]> = {};
  const deductionItemsMap: Record<string, DeductionLineItem[]> = {};

  for (const item of detail.items) {
    basicMap[item.employeeId] = parseFloat(item.basicSalary);
    commissionMap[item.employeeId] = parseFloat(item.commissionAmount ?? '0');
    if (item.taxPolicySnapshot) taxPolicyMap[item.employeeId] = item.taxPolicySnapshot;
    fixedTaxAmountMap[item.employeeId] =
      item.fixedTaxAmount != null ? parseFloat(item.fixedTaxAmount) : null;
    commissionTaxableMap[item.employeeId] = item.commissionTaxableSnapshot ?? true;
    if (item.allowanceItems?.length) {
      allowancesMap[item.employeeId] = item.allowanceItems.map((allowance) => ({
        name: allowance.name,
        type: allowance.type ?? undefined,
        amount: parseFloat(allowance.amount),
      }));
    } else {
      const transportAmount = parseFloat(item.transportAmount);
      const totalAllowances = parseFloat(item.totalAllowances);
      const allowances: AllowanceItem[] = [];
      if (transportAmount > 0) {
        allowances.push({
          name: 'Transport Allowance',
          type: 'TRANSPORT',
          amount: transportAmount,
        });
      }
      if (totalAllowances > 0) {
        allowances.push({ name: 'Allowances', amount: totalAllowances });
      }
      if (allowances.length > 0) {
        allowancesMap[item.employeeId] = allowances;
      }
    }

    if (item.deductionItems?.length) {
      deductionItemsMap[item.employeeId] = item.deductionItems.map((deduction) => ({
        employeeDeductionId: deduction.employeeDeductionId ?? null,
        name: deduction.name,
        amount: parseFloat(deduction.amount),
      }));
    } else if (parseFloat(item.otherDeductions) > 0) {
      deductionItemsMap[item.employeeId] = [
        { name: 'Deductions', amount: parseFloat(item.otherDeductions) },
      ];
    }
  }

  return {
    basicMap,
    commissionMap,
    taxPolicyMap,
    fixedTaxAmountMap,
    commissionTaxableMap,
    allowancesMap,
    deductionItemsMap,
  };
}

function fmtRunMoney(run: PayrollRun, value: string | number) {
  return formatPayrollMoney(value, run.payrollCurrency, run.payrollCountry);
}

type RunVariant = 'approved' | 'rejected' | 'draft';

function getVariant(run: PayrollRun): RunVariant {
  if (run.status === 'APPROVED' || run.status === 'PAID') return 'approved';
  if (run.returnToDraftNote) return 'rejected';
  return 'draft';
}

const VARIANT_STYLES: Record<RunVariant, { border: string; bg: string; icon: React.ReactNode }> = {
  approved: {
    border: 'border-emerald-100',
    bg: 'bg-emerald-50',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />,
  },
  rejected: {
    border: 'border-red-100',
    bg: 'bg-red-50',
    icon: <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />,
  },
  draft: {
    border: 'border-gray-100',
    bg: 'bg-gray-50',
    icon: <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />,
  },
};

function RunCard({ run, onClick }: { run: PayrollRun; onClick: () => void }) {
  const variant = getVariant(run);
  const { border, bg, icon } = VARIANT_STYLES[variant];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border ${border} ${bg} hover:brightness-95 transition-all`}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {payrollMonthLabel(run.month, run.year)}
            </p>
            {variant === 'rejected' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-600 shrink-0">
                Rejected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Gross: {fmtRunMoney(run, run.totalGross)} · Net: {fmtRunMoney(run, run.totalNet)}
          </p>
          {variant === 'rejected' && run.returnToDraftNote && (
            <p className="text-xs text-red-500 truncate italic">
              &quot;{run.returnToDraftNote}&quot;
            </p>
          )}
          {variant === 'draft' && run.notes && (
            <p className="text-xs text-gray-400 truncate italic">{run.notes}</p>
          )}
          {variant === 'approved' && run.approvedAt && (
            <p className="text-xs text-emerald-600">
              Approved{' '}
              {new Date(run.approvedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function RunDetailModal({
  run,
  onClose,
  onLoad,
}: {
  run: PayrollRun;
  onClose: () => void;
  onLoad: (data: DraftLoadData) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const variant = getVariant(run);
  const period = payrollMonthLabel(run.month, run.year);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const data = await loadRunData(run, queryClient);
      onLoad(data);
      toast.success(`${period} loaded into payroll table`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load payroll run'));
    } finally {
      setLoading(false);
    }
  };

  const actionLabel = variant === 'rejected' ? 'Revise Payroll' : 'Load into Table';

  return (
    <Modal
      isOpen
      onClose={() => !loading && onClose()}
      title={period}
      hideClose={loading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button onClick={handleLoad} isLoading={loading} loadingText="Loading…">
            {actionLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Gross', value: fmtRunMoney(run, run.totalGross) },
            { label: 'Total Net Pay', value: fmtRunMoney(run, run.totalNet) },
            { label: 'Total PAYE', value: fmtRunMoney(run, run.totalPAYE) },
            { label: 'Employer Cost', value: fmtRunMoney(run, run.totalEmployerCost) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5 bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {variant === 'rejected' && run.returnToDraftNote && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-gray-500">Rejection Note</p>
            <p className="text-sm text-red-600 leading-relaxed bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              {run.returnToDraftNote}
            </p>
          </div>
        )}

        {variant === 'approved' && run.approvalNote && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-gray-500">Approval Note</p>
            <p className="text-sm text-emerald-700 leading-relaxed bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
              {run.approvalNote}
            </p>
          </div>
        )}

        {variant === 'draft' && run.notes && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-gray-500">Notes</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
              {run.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
      <span className="text-xs text-gray-400 font-medium">{count}</span>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (data: DraftLoadData) => void;
}

export function PayrollDraftsPanel({ isOpen, onClose, onLoad }: Props) {
  const { data: runs = [], isLoading } = usePayrollRuns();
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);

  const recentApproved = runs
    .filter((r) => r.status === 'APPROVED' || r.status === 'PAID')
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month))
    .slice(0, 3);

  const returned = runs
    .filter((r) => r.status === 'DRAFT' && !!r.returnToDraftNote)
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

  const drafts = runs
    .filter((r) => r.status === 'DRAFT' && !r.returnToDraftNote)
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

  const handleLoad = (data: DraftLoadData) => {
    onLoad(data);
    setSelectedRun(null);
    onClose();
  };

  const isEmpty = recentApproved.length === 0 && returned.length === 0 && drafts.length === 0;

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={onClose}
        title="Payroll History"
        description="Open any run to view its summary and load its values."
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-400">No payroll runs found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {recentApproved.length > 0 && (
              <div className="flex flex-col gap-3">
                <SectionHeader title="Recent Approved" count={recentApproved.length} />
                {recentApproved.map((run) => (
                  <RunCard key={run.id} run={run} onClick={() => setSelectedRun(run)} />
                ))}
              </div>
            )}

            {returned.length > 0 && (
              <div className="flex flex-col gap-3">
                <SectionHeader title="Rejected" count={returned.length} />
                {returned.map((run) => (
                  <RunCard key={run.id} run={run} onClick={() => setSelectedRun(run)} />
                ))}
              </div>
            )}

            {drafts.length > 0 && (
              <div className="flex flex-col gap-3">
                <SectionHeader title="Drafts" count={drafts.length} />
                {drafts.map((run) => (
                  <RunCard key={run.id} run={run} onClick={() => setSelectedRun(run)} />
                ))}
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onLoad={handleLoad}
        />
      )}
    </>
  );
}
