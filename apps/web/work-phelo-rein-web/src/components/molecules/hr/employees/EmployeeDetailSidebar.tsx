import { ProfileSummaryCard } from './ProfileSummaryCard';
import { RolesAndPermissionsCard } from './RolesAndPermissionsCard';
import type { Employee } from '@/types/hr';

interface EmployeeDetailSidebarProps {
  employee: Employee;
  managerName?: string;
  roles: string[];
  canEditRoles: boolean;
  canManagePermissions: boolean;
  onEditRoles: () => void;
  onManageRoles?: () => void;
  onManagePermissions: () => void;
  directPermissions?: Array<{ resourceName: string; action: string }>;
}

export function EmployeeDetailSidebar({
  employee,
  managerName,
  roles,
  canEditRoles,
  canManagePermissions,
  onEditRoles,
  onManageRoles,
  onManagePermissions,
  directPermissions,
}: EmployeeDetailSidebarProps) {
  const isOffboarded = employee.employmentStatus === 'OFFBOARDED';

  return (
    <div className="flex flex-col gap-4">
      <ProfileSummaryCard employee={employee} managerName={managerName} />

      {employee.userId && (
        <RolesAndPermissionsCard
          roles={roles}
          canEditRoles={canEditRoles && !isOffboarded}
          onEditRoles={onEditRoles}
          onManageRoles={onManageRoles}
          canManagePermissions={canManagePermissions && !isOffboarded}
          onManagePermissions={onManagePermissions}
          directPermissions={directPermissions}
        />
      )}
    </div>
  );
}
