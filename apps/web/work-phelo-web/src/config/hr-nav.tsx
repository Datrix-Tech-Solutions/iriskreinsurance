import { NavGroup } from '@/components/organisms/shared/Sidebar';

import {
  Users,
  DollarSign,
  Handshake,
  House,
  Settings,
  UserCircle,
  // Wallet,
  // Trophy,
  // CalendarRange,
} from 'lucide-react';

/* ── Icons ── */
const DashboardIcon = () => <House className="w-5 h-5" />;
const ProfileIcon = () => <UserCircle className="w-5 h-5" />;
const TeamIcon = () => <Users className="w-5 h-5" />;
const SettingsIcon = () => <Settings className="w-5 h-5" />;
// const PayrollIcon = () => <Wallet className="w-5 h-5" />;
// const AppraisalIcon = () => <Trophy className="w-5 h-5" />;
// const LeaveIcon = () => <CalendarRange className="w-5 h-5" />;
const HrIcon = () => <Users className="w-5 h-5" />;
const AccountingIcon = () => <DollarSign className="w-5 h-5" />;
const OperationsIcon = () => <Handshake className="w-5 h-5" />;

export const HR_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Home',
        icon: <DashboardIcon />,
        href: '',
        enabled: true,
        active: true,
        exact: true,
      },
      {
        key: 'profile',
        label: 'Profile',
        icon: <ProfileIcon />,
        href: 'profile',
        enabled: true,
        active: true,
      },
      {
        key: 'employees',
        label: 'My Team',
        icon: <TeamIcon />,
        href: 'employees',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      // {
      //   key: 'leave',
      //   label: 'Leave',
      //   icon: <LeaveIcon />,
      //   href: 'leave',
      //   enabled: true,
      //   active: true,
      // },
      // {
      //   key: 'payroll',
      //   label: 'Payroll',
      //   icon: <PayrollIcon />,
      //   href: 'payroll',
      //   enabled: true,
      //   active: true,
      // },
      // {
      //   key: 'appraisal',
      //   label: 'Performance',
      //   icon: <AppraisalIcon />,
      //   href: 'appraisal',
      //   enabled: true,
      //   active: true,
      // },
      {
        key: 'management',
        label: 'HR Settings',
        icon: <SettingsIcon />,
        href: 'hrmanagement',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Modules',
    items: [
      {
        key: 'hr',
        label: 'Human Resource',
        icon: <HrIcon />,
        href: '/hr',
        enabled: true,
        active: true,
      },
      {
        key: 'accounting',
        label: 'Accounting',
        icon: <AccountingIcon />,
        href: '/accounting',
        enabled: true,
        active: true,
      },
      {
        key: 'operations',
        label: 'Reinsurance',
        icon: <OperationsIcon />,
        href: '/operations',
        enabled: true,
        active: true,
      },
    ],
  },
];
