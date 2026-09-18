import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee, EmployeeOption } from '@/types/hr';

interface Props {
  employee: Employee;
  allHrEmployees: EmployeeOption[];
  currentRoleName?: string | null;
}

export function EmploymentDetailsSection({ employee, allHrEmployees }: Props) {
  const manager = employee?.managerId
    ? allHrEmployees.find((e) => e.id === employee.managerId)
    : null;

  const managerName = manager ? `${manager.firstName} ${manager.lastName}` : undefined;

  const isContract = employee?.employmentType === 'CONTRACT';

  const probationActive =
    !isContract && employee?.probationEndsAt && new Date(employee.probationEndsAt) >= new Date();

  return (
    <SectionCard title="Employment Details">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        <DetailField label="Department" value={employee?.department?.name} />
        <DetailField label="Branch" value={employee?.branch?.name} />
        <DetailField label="Job Title" value={employee?.jobTitle} />
        <DetailField label="Reporting Manager" value={managerName} />
        <DetailField label="Date of Hire" value={formatDate(employee?.hireDate)} />
        {isContract && employee?.contractEndDate && (
          <DetailField label="Contract End Date" value={formatDate(employee.contractEndDate)} />
        )}
        {probationActive && (
          <DetailField label="Probation End Date" value={formatDate(employee.probationEndsAt)} />
        )}
        <DetailField label="Employment Type" value={formatType(employee?.employmentType)} />
        {employee?.dateOfBirth && (
          <DetailField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
        )}
        {employee?.nationality && <DetailField label="Nationality" value={employee.nationality} />}
        {employee?.address && (
          <DetailField
            label="Address"
            value={[employee.address, employee.city, employee.region].filter(Boolean).join(', ')}
          />
        )}
      </div>
    </SectionCard>
  );
}

// Keep your helper functions here or move to a utils file
function formatDate(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatType(t?: string) {
  if (!t) return undefined;
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
