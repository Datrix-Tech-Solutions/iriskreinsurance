import { ClipboardList, Landmark, CheckCircle2, History } from 'lucide-react';
import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { usePermission } from '@/hooks/hr/usePermission';
import { usePayrollSettings } from '@/hooks';
import { getPayrollLabels } from '@/lib/payrollDisplay';
import { Permission } from '@/lib/permissionMap';

/* ── Icons ── */
const ManageIcon = () => <ClipboardList className="w-5 h-5" />;
const ContributionsIcon = () => <Landmark className="w-5 h-5" />;
const ApproveIcon = () => <CheckCircle2 className="w-5 h-5" />;
const HistoryIcon = () => <History className="w-5 h-5" />;

/**
 * Payroll's own sidebar — management-side tabs it used to have on one page
 * (Manage Payroll, statutory contributions, Approve, History), now each a
 * single page with its own nav entry, same as Accounting/Operations. Same
 * permission gating as the old tabbed page. "My Payslip" stays out of here —
 * it's personal/self-service, so it lives in the Profile page instead.
 */
export function usePayrollSidebarGroups(tenantSlug: string): {
  groups: NavGroup[];
  canManagePayroll: boolean;
  canApprovePayroll: boolean;
  canViewHistory: boolean;
} {
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canViewHistory = canManagePayroll || canApprovePayroll;

  const { data: payrollSettings } = usePayrollSettings();
  const contributionsLabel = getPayrollLabels(payrollSettings?.payrollCountry).tabLabel;

  const base = `/${tenantSlug}/hr/payroll`;

  const groups: NavGroup[] = [
    {
      label: 'Payroll',
      items: [
        {
          key: 'manage',
          label: 'Manage Payroll',
          icon: <ManageIcon />,
          href: `${base}/manage`,
          enabled: canManagePayroll,
          active: true,
        },
        {
          key: 'contributions',
          label: contributionsLabel,
          icon: <ContributionsIcon />,
          href: `${base}/contributions`,
          enabled: canManagePayroll,
          active: true,
        },
      ],
    },
    {
      label: 'Approvals',
      items: [
        {
          key: 'approve',
          label: 'Approve Payroll',
          icon: <ApproveIcon />,
          href: `${base}/approve`,
          enabled: canApprovePayroll,
          active: true,
        },
        {
          key: 'history',
          label: 'History',
          icon: <HistoryIcon />,
          href: `${base}/history`,
          enabled: canViewHistory,
          active: true,
        },
      ],
    },
  ];

  return { groups, canManagePayroll, canApprovePayroll, canViewHistory };
}
