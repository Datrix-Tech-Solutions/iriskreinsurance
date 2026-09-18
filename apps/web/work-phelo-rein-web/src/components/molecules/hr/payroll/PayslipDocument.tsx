import type { PayrollItem } from '@/types/hr';
import { formatPayrollMoney, getPayrollLabels } from '@/lib/payrollDisplay';
import { payrollMonthLabel } from '@/lib/payrollUtils';

interface PayslipDocumentProps {
  item: PayrollItem;
  companyName: string;
  employeeName: string;
}

function getAllowanceRows(item: PayrollItem): Array<{ label: string; amount: number }> {
  if (item.allowanceItems?.length) {
    return item.allowanceItems
      .map((a) => ({ label: a.name, amount: parseFloat(a.amount) }))
      .filter((a) => a.amount > 0);
  }
  const rows: Array<{ label: string; amount: number }> = [];
  const transport = parseFloat(item.transportAmount);
  const other = parseFloat(item.totalAllowances);
  if (transport > 0) rows.push({ label: 'Transport Allowance', amount: transport });
  if (other > 0) rows.push({ label: 'Allowances', amount: other });
  return rows;
}

function getDeductionRows(item: PayrollItem): Array<{ label: string; amount: number }> {
  if (item.deductionItems?.length) {
    return item.deductionItems
      .map((d) => ({ label: d.name, amount: parseFloat(d.amount) }))
      .filter((d) => d.amount > 0);
  }
  const other = parseFloat(item.otherDeductions);
  return other > 0 ? [{ label: 'Deductions', amount: other }] : [];
}

function DocRow({
  label,
  value,
  bold,
  deduction,
}: {
  label: string;
  value: string | null;
  bold?: boolean;
  deduction?: boolean;
}) {
  if (value === null) return null;
  return (
    <div className="flex justify-between items-center py-2.5">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${
          deduction ? 'text-gray-700' : bold ? 'font-semibold text-gray-900' : 'text-gray-800'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase mb-1">
      {children}
    </p>
  );
}

function Separator() {
  return <div className="border-t border-gray-200 my-1" />;
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export function PayslipDocument({ item, companyName, employeeName }: PayslipDocumentProps) {
  const country = item.payrollRun?.payrollCountry;
  const currency = item.payrollRun?.payrollCurrency;
  const labels = getPayrollLabels(country);
  const money = (v: string | number) => formatPayrollMoney(v, currency, country);
  const inParens = (v: string | number) => {
    const amt = typeof v === 'string' ? parseFloat(v) : v;
    if (!amt || amt <= 0) return null;
    return `(${money(amt)})`;
  };

  const isBoth = item.compensationTypeSnapshot === 'SALARY_PLUS_COMMISSION';
  const commissionTax = isBoth ? r2(parseFloat(item.commissionAmount) * 0.1) : 0;
  const salaryPaye = isBoth ? r2(parseFloat(item.payeTax) - commissionTax) : null;

  const period = item.payrollRun
    ? payrollMonthLabel(item.payrollRun.month, item.payrollRun.year)
    : '—';

  const allowanceRows = getAllowanceRows(item);
  const deductionRows = getDeductionRows(item);
  const tier3 = parseFloat(item.tier3Employee);
  const tier3Label =
    item.payrollRun?.tier3Enabled && item.payrollRun.tier3Rate
      ? `Tier 3 (${parseFloat(item.payrollRun.tier3Rate).toFixed(2).replace(/\.00$/, '')}%)`
      : 'Tier 3';

  return (
    <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
      {/* Document header */}
      <div className="flex items-start justify-between gap-4 px-5 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-gray-100">
        <h2 className="text-xl sm:text-2xl font-bold text-brand shrink-0">Payslip</h2>
        <div className="text-right min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{companyName}</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{employeeName}</p>
          <p className="text-sm text-gray-500">{period}</p>
        </div>
      </div>

      <div className="px-5 sm:px-8 py-2 flex flex-col">
        {/* Earnings */}
        <div className="py-4">
          <SectionLabel>Earnings</SectionLabel>
          {parseFloat(item.basicSalary) > 0 && (
            <DocRow label="Basic Salary" value={money(item.basicSalary)} />
          )}
          {parseFloat(item.commissionAmount ?? '0') > 0 && (
            <DocRow label="Commission" value={money(item.commissionAmount)} />
          )}
          {allowanceRows.map((row, i) => (
            <DocRow key={`${row.label}-${i}`} label={row.label} value={money(row.amount)} />
          ))}
          {parseFloat(item.overtimePay) > 0 && (
            <DocRow label="Overtime" value={money(item.overtimePay)} />
          )}
          {parseFloat(item.bonus) > 0 && <DocRow label="Bonus" value={money(item.bonus)} />}
          {parseFloat(item.thirteenthMonth) > 0 && (
            <DocRow label="13th Month" value={money(item.thirteenthMonth)} />
          )}
          <Separator />
          <DocRow label="Gross Salary" value={money(item.grossSalary)} bold />
        </div>

        <div className="border-t border-gray-100" />

        {/* Deductions */}
        <div className="py-4">
          <SectionLabel>Deductions</SectionLabel>
          <DocRow label={labels.employeeLabel} value={inParens(item.employeeSSNIT)} deduction />
          {isBoth ? (
            <>
              <DocRow label="PAYE Tax" value={inParens(salaryPaye!)} deduction />
              <DocRow label="Commission Tax (10%)" value={inParens(commissionTax)} deduction />
            </>
          ) : (
            <DocRow
              label={
                item.compensationTypeSnapshot === 'COMMISSION'
                  ? 'Commission Tax (10%)'
                  : item.taxPolicySnapshot === 'FIXED_AMOUNT'
                    ? 'PAYE Tax (Fixed)'
                    : 'PAYE Tax'
              }
              value={inParens(item.payeTax)}
              deduction
            />
          )}
          {tier3 > 0 && <DocRow label={tier3Label} value={inParens(tier3)} deduction />}
          {deductionRows.map((row, i) => (
            <DocRow
              key={`${row.label}-${i}`}
              label={row.label}
              value={inParens(row.amount)}
              deduction
            />
          ))}
          <Separator />
          <DocRow label="Total Deductions" value={money(item.totalDeductions)} bold />
        </div>

        <div className="border-t border-gray-100" />

        {/* Net summary */}
        <div className="py-4">
          <DocRow label="Gross Salary" value={money(item.grossSalary)} />
          <DocRow label="Total Deductions" value={`- ${money(item.totalDeductions)}`} />
          <Separator />
          <DocRow label="Net Salary Disbursed" value={money(item.netSalary)} bold />
        </div>
      </div>
    </div>
  );
}
