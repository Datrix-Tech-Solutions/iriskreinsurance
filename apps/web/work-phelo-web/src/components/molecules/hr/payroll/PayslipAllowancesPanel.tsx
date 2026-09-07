import { SectionCard } from '@/components/molecules/shared/sectionCard';
import type { EmployeeAllowance, EmployeeDeduction } from '@/types/hr';

function fmtGHS(amount: number) {
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PayslipAllowancesPanelProps {
  allowances: EmployeeAllowance[];
  deductions: EmployeeDeduction[];
  onManageAllowances?: () => void;
  onManageDeductions?: () => void;
}

export function PayslipAllowancesPanel({
  allowances,
  deductions,
  onManageAllowances,
  onManageDeductions,
}: PayslipAllowancesPanelProps) {
  const activeDeductions = deductions.filter((d) => d.amountPaid < d.totalAmount);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Allowances"
        headerAction={
          onManageAllowances ? (
            <button
              onClick={onManageAllowances}
              className="text-xs font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Manage
            </button>
          ) : undefined
        }
      >
        {allowances.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No allowances configured.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {allowances.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-700">{a.name}</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {fmtGHS(Number(a.amount))}
                  <span className="text-xs text-gray-400 font-normal">/mo</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Deductions"
        headerAction={
          onManageDeductions ? (
            <button
              onClick={onManageDeductions}
              className="text-xs font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Manage
            </button>
          ) : undefined
        }
      >
        {activeDeductions.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No active deductions.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {activeDeductions.map((d) => {
              const remaining = d.totalAmount - d.amountPaid;
              return (
                <div key={d.id} className="flex flex-col gap-0.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{d.name}</span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {fmtGHS(d.monthlyRate)}
                      <span className="text-xs text-gray-400 font-normal">/mo</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Remaining: {fmtGHS(remaining)}</p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
