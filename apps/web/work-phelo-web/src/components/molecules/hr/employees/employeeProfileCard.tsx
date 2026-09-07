import Image from 'next/image';
import { BadgeCheck } from 'lucide-react';
import { DetailField } from '../../shared/DetailField';
import { EmploymentStatusBadge } from './EmploymentStatusBadge';
import type { Employee } from '@/types/hr';
import { cardClass } from '@/lib/utils';

interface EmployeeProfileCardProps {
  employee: Employee;
}

export function EmployeeProfileCard({ employee }: EmployeeProfileCardProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();
  const isPendingInvite = employee.userStatus === 'PENDING_VERIFICATION';

  return (
    <div className={cardClass('w-72 shrink-0 p-6 flex flex-col items-start gap-4')}>
      {/* Avatar */}
      {employee.avatarUrl ? (
        <Image
          src={employee.avatarUrl}
          alt={initials}
          width={96}
          height={96}
          className="w-24 h-24 rounded-full object-cover"
        />
      ) : (
        <div className="w-24 h-24 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold">
          {initials}
        </div>
      )}

      <div className="text-left">
        <div className="flex items-center gap-1.5">
          <p className="text-base font-bold text-gray-900">{name}</p>
          {!isPendingInvite && <BadgeCheck className="w-4.5 h-4.5 text-brand shrink-0" />}
        </div>
        {employee?.jobTitle && <p className="text-sm text-gray-400 mt-0.5">{employee.jobTitle}</p>}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <EmploymentStatusBadge status={employee.employmentStatus} />
        {isPendingInvite && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            Pending Verification
          </span>
        )}
      </div>

      <div className="w-full border-t border-gray-100" />

      {/* Contact Info */}
      <div className="w-full flex flex-col gap-3">
        <DetailField label="Email Address" value={employee.email} />
        {employee.phone && <DetailField label="Phone Number" value={employee.phone} />}
        {employee.employeeNumber && (
          <DetailField label="Employee No." value={employee.employeeNumber} />
        )}
      </div>
    </div>
  );
}
