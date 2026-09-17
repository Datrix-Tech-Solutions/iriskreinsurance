import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee } from '@/types/hr';

interface Props {
  employee: Employee;
}

const COMPENSATION_LABELS: Record<string, string> = {
  SALARY: 'Salary',
  COMMISSION: 'Commission',
  SALARY_PLUS_COMMISSION: 'Salary + Commission',
};

const TAX_POLICY_LABELS: Record<string, string> = {
  STANDARD_PAYE: 'Standard PAYE',
  FIXED_AMOUNT: 'Fixed Amount',
  EXEMPT: 'Exempt',
};

export function BankingComplianceSection({ employee }: Props) {
  const hasSalary = employee.basicSalary !== undefined && employee.basicSalary !== null;
  const compensationType = employee.compensationType ?? 'SALARY';
  const taxPolicy = employee.taxPolicy ?? 'STANDARD_PAYE';
  const hasBankDetails = employee.bankName || employee.bankAccountNumber || employee.bankBranch;
  const hasCompliance = employee.ssnit || employee.tinNumber;

  if (!hasSalary && !hasBankDetails && !hasCompliance && compensationType === 'SALARY') return null;

  return (
    <SectionCard title="Banking & Compliance">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        <DetailField
          label="Compensation Type"
          value={COMPENSATION_LABELS[compensationType] ?? compensationType}
        />
        <DetailField label="Tax Policy" value={TAX_POLICY_LABELS[taxPolicy] ?? taxPolicy} />
        {taxPolicy === 'FIXED_AMOUNT' && employee.fixedTaxAmount != null && (
          <DetailField
            label="Fixed Tax"
            value={`GHS ${Number(employee.fixedTaxAmount).toLocaleString('en-GH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          />
        )}
        {hasSalary && (
          <DetailField
            label="Basic Salary"
            value={`GHS ${Number(employee.basicSalary).toLocaleString('en-GH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          />
        )}
        {employee.bankName && <DetailField label="Bank Name" value={employee.bankName} />}
        {employee.bankAccountNumber && (
          <DetailField label="Account Number" value={employee.bankAccountNumber} />
        )}
        {employee.bankBranch && <DetailField label="Bank Branch" value={employee.bankBranch} />}
        {employee.ssnit && <DetailField label="SSNIT Number" value={employee.ssnit} />}
        {employee.tinNumber && <DetailField label="TIN Number" value={employee.tinNumber} />}
      </div>
    </SectionCard>
  );
}
