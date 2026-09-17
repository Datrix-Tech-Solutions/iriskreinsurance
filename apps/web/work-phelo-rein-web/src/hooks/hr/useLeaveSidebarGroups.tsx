import { ClipboardList, ListChecks, CalendarDays } from 'lucide-react';
import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

/* ── Icons ── */
const RequestsIcon = () => <ClipboardList className="w-5 h-5" />;
const TypesIcon = () => <ListChecks className="w-5 h-5" />;
const HolidaysIcon = () => <CalendarDays className="w-5 h-5" />;

/**
 * Leave's own sidebar — the review/config tabs it used to have on one page
 * (Leave Requests) plus what used to be "Leave Types / Public Holidays" tabs
 * inside the generic HR Settings page, now grouped with the rest of leave.
 * "My Leave" stays out of here — it's personal, so it lives in the Profile
 * page instead.
 */
export function useLeaveSidebarGroups(tenantSlug: string): {
  groups: NavGroup[];
  canSeeRequests: boolean;
  canManageLeaveTypes: boolean;
} {
  const isAdmin = useAuthStore((s) => s.user?.role === 'TENANT_ADMIN');
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);
  const canSeeRequests = canApproveLeave || isAdmin;

  const base = `/${tenantSlug}/hr/leave`;

  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        {
          key: 'requests',
          label: 'Leave Requests',
          icon: <RequestsIcon />,
          href: `${base}/requests`,
          enabled: canSeeRequests,
          active: true,
        },
      ],
    },
    {
      label: 'Configuration',
      items: [
        {
          key: 'types',
          label: 'Leave Types',
          icon: <TypesIcon />,
          href: `${base}/settings/types`,
          enabled: canManageLeaveTypes,
          active: true,
        },
        {
          key: 'holidays',
          label: 'Public Holidays',
          icon: <HolidaysIcon />,
          href: `${base}/settings/holidays`,
          enabled: canManageLeaveTypes,
          active: true,
        },
      ],
    },
  ];

  return { groups, canSeeRequests, canManageLeaveTypes };
}
