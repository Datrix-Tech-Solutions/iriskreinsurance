import { ClipboardCheck, Users2, LayoutTemplate, CalendarRange, SlidersHorizontal } from 'lucide-react';
import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { usePermission } from '@/hooks/hr/usePermission';
import { useTeamAppraisals } from '@/hooks';
import { Permission } from '@/lib/permissionMap';

/* ── Icons ── */
const HrReviewIcon = () => <ClipboardCheck className="w-5 h-5" />;
const TeamReviewIcon = () => <Users2 className="w-5 h-5" />;
const TemplatesIcon = () => <LayoutTemplate className="w-5 h-5" />;
const CyclesIcon = () => <CalendarRange className="w-5 h-5" />;
const SettingsIcon = () => <SlidersHorizontal className="w-5 h-5" />;

/**
 * Appraisal's own sidebar — HR/manager review plus what used to be "Appraisal
 * Templates/Cycles/Settings" tabs inside the generic HR Settings page, now
 * grouped with the rest of appraisal instead. "My Appraisal" (self-assessment)
 * stays out of here — it's personal, so it lives in the Profile page instead.
 */
export function useAppraisalSidebarGroups(tenantSlug: string): {
  groups: NavGroup[];
  canViewAppraisals: boolean;
  isManager: boolean;
  canConfigureAppraisal: boolean;
} {
  const canCreateAppraisal = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canApproveAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);
  const canViewAppraisals = canCreateAppraisal || canConfigureAppraisal || canApproveAppraisal;

  const { data: teamData } = useTeamAppraisals();
  const isManager = (teamData?.length ?? 0) > 0;

  const base = `/${tenantSlug}/hr/appraisal`;

  const groups: NavGroup[] = [
    {
      label: 'Review',
      items: [
        {
          key: 'hr-review',
          label: 'HR Review',
          icon: <HrReviewIcon />,
          href: `${base}/hr-review`,
          enabled: canViewAppraisals,
          active: true,
        },
        {
          key: 'team',
          label: 'Team Review',
          icon: <TeamReviewIcon />,
          href: `${base}/team`,
          enabled: isManager,
          active: true,
        },
      ],
    },
    {
      label: 'Configuration',
      items: [
        {
          key: 'templates',
          label: 'Templates',
          icon: <TemplatesIcon />,
          href: `${base}/settings/templates`,
          enabled: canConfigureAppraisal,
          active: true,
        },
        {
          key: 'cycles',
          label: 'Cycles',
          icon: <CyclesIcon />,
          href: `${base}/settings/cycles`,
          enabled: canConfigureAppraisal,
          active: true,
        },
        {
          key: 'settings',
          label: 'Settings',
          icon: <SettingsIcon />,
          href: `${base}/settings`,
          enabled: canConfigureAppraisal,
          active: true,
          // Without this, /settings/templates and /settings/cycles would also
          // highlight "Settings" (they're nested under the same base path).
          exact: true,
        },
      ],
    },
  ];

  return { groups, canViewAppraisals, isManager, canConfigureAppraisal };
}
