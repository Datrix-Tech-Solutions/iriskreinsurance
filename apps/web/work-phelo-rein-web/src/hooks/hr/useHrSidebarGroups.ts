import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { HR_NAV_GROUPS } from '@/config/hr-nav';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { useTeamAppraisals } from '@/hooks';
import { Permission } from '@/lib/permissionMap';

/**
 * Builds HR's sidebar groups (Home, Profile, My Team, Modules), resolved to
 * real tenant-scoped hrefs and filtered by permission/enabled-module access.
 *
 * `currentModuleKey` is whichever module the sidebar is being rendered for —
 * `'hr'` when it's HR's own full sidebar, or the module you're currently
 * browsing (e.g. `'accounting'`) when this is the parked HR rail shown
 * alongside another module's sidebar. Either way, the module matching
 * `currentModuleKey` is left out of the Modules list, since you're already
 * looking at it.
 */
export function useHrSidebarGroups(tenantSlug: string, currentModuleKey: string): NavGroup[] {
  const user = useAuthStore((s) => s.user);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  const canReadEmployees = usePermission(Permission.READ_EMPLOYEES);
  const canReadOwnProfile = usePermission(Permission.READ_OWN_PROFILE);
  // Operations' landing page (reinsurance dashboard) redirects back to /modules
  // for anyone lacking this permission — so a user without it shouldn't see
  // "Operations" listed here in the first place, even if the tenant has the
  // module enabled for other users.
  const canViewReinsuranceDashboard = usePermission(Permission.VIEW_REINSURANCE_DASHBOARD);
  // Payroll's own sidebar only has Manage/Contributions (RUN_PAYROLL) and
  // Approve/History (RUN_PAYROLL or APPROVE_PAYROLL) — so the "Payroll" entry
  // here should only show if at least one of those pages is actually
  // reachable, not for permissions (like READ_OWN_PAYSLIP) that don't unlock
  // anything inside Payroll's own section anymore.
  const canRunPayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canAccessPayroll = canRunPayroll || canApprovePayroll;
  // Same idea for Appraisal — only show it if HR/Admin Review, Team Review, or
  // Configuration is actually reachable inside its own sidebar.
  const canCreateAppraisal = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canFinalizeAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);
  const canViewAppraisals = canCreateAppraisal || canConfigureAppraisal || canFinalizeAppraisal;
  const { data: teamAppraisals } = useTeamAppraisals();
  const isAppraisalManager = (teamAppraisals?.length ?? 0) > 0;
  const canAccessAppraisal = canViewAppraisals || isAppraisalManager;
  // Leave section: Requests (APPROVE_LEAVE or tenant admin) + config (MANAGE_LEAVE_TYPES).
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);
  const canAccessLeave = canApproveLeave || isTenantAdmin || canManageLeaveTypes;

  const moduleConfig = user?.moduleConfig ?? {};

  const navAccess: Record<string, boolean> = {
    // The dashboard is a self-service "my" view (my leave, my payslips, clock in/out) —
    // not relevant for a tenant admin, so it's hidden for that role.
    dashboard: !isTenantAdmin,
    profile: canReadOwnProfile,
    employees: canReadEmployees || canReadOwnProfile,
    leave: canAccessLeave,
    payroll: canAccessPayroll,
    appraisal: canAccessAppraisal,
    accounting: moduleConfig.accounting ?? false,
    operations: (moduleConfig.operations ?? false) && canViewReinsuranceDashboard,
  };

  const resolveHref = (href: string) =>
    href.startsWith('/') ? `/${tenantSlug}${href}` : `/${tenantSlug}/hr${href ? `/${href}` : ''}`;

  return HR_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => item.key !== currentModuleKey)
      .map((item) => ({
        ...item,
        href: resolveHref(item.href),
        enabled: item.enabled !== false && (navAccess[item.key] ?? true),
        active: true,
      })),
  }));
}
