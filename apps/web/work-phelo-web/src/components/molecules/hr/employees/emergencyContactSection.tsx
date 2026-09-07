import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee } from '@/types/hr';

interface Props {
  employee: Employee;
}

export function EmergencyContactSection({ employee }: Props) {
  if (!employee.emergencyName && !employee.emergencyPhone) return null;

  return (
    <SectionCard title="Emergency Contact">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        {employee.emergencyName && <DetailField label="Full Name" value={employee.emergencyName} />}
        {employee.emergencyRelation && (
          <DetailField label="Relationship" value={employee.emergencyRelation} />
        )}
        {employee.emergencyPhone && (
          <DetailField label="Phone Number" value={employee.emergencyPhone} />
        )}
      </div>
    </SectionCard>
  );
}
