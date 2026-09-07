import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

export function useHrManagementAccess() {
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canViewPermissionSets = usePermission(Permission.VIEW_PERMISSION_SETS);
  const canGrantPermissions = usePermission(Permission.GRANT_PERMISSION);
  const canViewAuditLogs = usePermission(Permission.VIEW_AUDIT_LOGS);
  const canReadDepartments = usePermission(Permission.READ_DEPARTMENTS);
  const canReadBranches = usePermission(Permission.READ_BRANCHES);
  const canReadHrSettings = usePermission(Permission.READ_HR_SETTINGS);
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);

  const canAccessRoles = canViewPermissionSets || canGrantPermissions;
  const hasAnyManagementAccess =
    canManageLeaveTypes ||
    canConfigureAppraisal ||
    canAccessRoles ||
    canViewAuditLogs ||
    canReadDepartments ||
    canReadBranches ||
    canReadHrSettings ||
    canManagePayroll;

  return {
    canManageLeaveTypes,
    canConfigureAppraisal,
    canViewPermissionSets,
    canGrantPermissions,
    canAccessRoles,
    canViewAuditLogs,
    canReadDepartments,
    canReadBranches,
    canReadHrSettings,
    canManagePayroll,
    hasAnyManagementAccess,
  };
}
