import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee } from '@/types/hr';

interface BankingComplianceCardProps {
  employee: Pick<Employee, 'bankName' | 'bankAccountNumber' | 'bankBranch' | 'ssnit' | 'tinNumber'>;
}

export function BankingComplianceCard({ employee }: BankingComplianceCardProps) {
  return (
    <SectionCard title="Banking & Compliance">
      <div className="flex flex-col gap-4">
        <DetailField label="Bank Name" value={employee.bankName} />
        <DetailField label="Account Number" value={employee.bankAccountNumber} />
        <DetailField label="Bank Branch" value={employee.bankBranch} />
        <DetailField label="SSNIT Number" value={employee.ssnit} />
        <DetailField label="TIN Number" value={employee.tinNumber} />
      </div>
    </SectionCard>
  );
}
