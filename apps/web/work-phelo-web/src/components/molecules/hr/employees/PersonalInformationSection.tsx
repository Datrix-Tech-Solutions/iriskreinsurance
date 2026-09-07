import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee } from '@/types/hr';

function formatDate(iso?: string | null) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatEnum(val?: string | null) {
  if (!val) return undefined;
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  employee: Employee;
  showNationalId?: boolean;
}

export function PersonalInformationSection({ employee, showNationalId }: Props) {
  return (
    <SectionCard title="Personal Information">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        <DetailField label="First Name" value={employee.firstName} />
        <DetailField label="Last Name" value={employee.lastName} />
        <DetailField label="Phone" value={employee.phone} />
        <DetailField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
        <DetailField label="Gender" value={formatEnum(employee.gender)} />
        <DetailField label="Marital Status" value={formatEnum(employee.maritalStatus)} />
        <DetailField label="Nationality" value={employee.nationality} />
        {showNationalId && <DetailField label="National ID" value={employee.nationalId} />}
        <DetailField label="Address" value={employee.address} />
        <DetailField
          label="City / Region"
          value={[employee.city, employee.region].filter(Boolean).join(', ') || undefined}
        />
      </div>
    </SectionCard>
  );
}
