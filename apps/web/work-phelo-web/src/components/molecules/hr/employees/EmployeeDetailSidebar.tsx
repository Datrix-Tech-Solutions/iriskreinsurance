import { ProfileSummaryCard } from './ProfileSummaryCard';
import { EmployeeRolesCard } from './EmployeeRolesCard';
import { EmployeePermissionsCard } from './EmployeePermissionsCard';
import type { Employee } from '@/types/hr';

interface EmployeeDetailSidebarProps {
  employee: Employee;
  managerName?: string;
  roles: string[];
  canEditRoles: boolean;
  canManagePermissions: boolean;
  onEditRoles: () => void;
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
  onManagePermissions,
  directPermissions,
}: EmployeeDetailSidebarProps) {
  const isOffboarded = employee.employmentStatus === 'OFFBOARDED';

  return (
    <div className="flex flex-col gap-4">
      {/* Pass empty roles so the Roles section doesn't duplicate — EmployeeRolesCard handles that */}
      <ProfileSummaryCard employee={employee} managerName={managerName} roles={[]} />

      {employee.userId && (
        <EmployeeRolesCard
          roles={roles}
          canEdit={canEditRoles && !isOffboarded}
          onEdit={onEditRoles}
        />
      )}

      {employee.userId && canManagePermissions && (
        <EmployeePermissionsCard
          canManage={!isOffboarded}
          onManage={onManagePermissions}
          directPermissions={directPermissions}
        />
      )}
    </div>
  );
}
