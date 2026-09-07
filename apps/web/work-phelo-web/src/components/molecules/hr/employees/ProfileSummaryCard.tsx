import { ShieldCheck } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee } from '@/types/hr';

interface ProfileSummaryCardProps {
  employee: Employee;
  managerName?: string;
  roles: string[];
}

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

export function ProfileSummaryCard({ employee, managerName, roles }: ProfileSummaryCardProps) {
  const probationActive =
    employee.employmentType !== 'CONTRACT' &&
    !!employee.probationEndsAt &&
    new Date(employee.probationEndsAt) >= new Date();

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Summary Information">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <DetailField label="Employee ID" value={employee.employeeNumber} />
          <DetailField label="Date of Hire" value={formatDate(employee.hireDate)} />
          <DetailField label="Manager" value={managerName} />
          <DetailField label="Job Title" value={employee.jobTitle} />
          <DetailField label="Department" value={employee.department?.name} />
          <DetailField label="Employment Type" value={formatEnum(employee.employmentType)} />
          <DetailField label="Employment Status" value={formatEnum(employee.employmentStatus)} />
          {probationActive && (
            <DetailField label="Probation End Date" value={formatDate(employee.probationEndsAt)} />
          )}
        </div>
      </SectionCard>

      {roles.length > 0 && (
        <SectionCard title="Roles">
          <div className="flex flex-col gap-2.5">
            {roles.map((role) => (
              <div key={role} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm font-medium text-gray-700">{role}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
