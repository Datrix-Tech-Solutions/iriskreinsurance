import { NavGroup } from '@/components/organisms/shared/Sidebar';

import {
  LayoutDashboard,
  // ScrollText,
  BarChart3,
  ShieldCheck,
  Settings,
  BanknoteArrowDown,
  // BanknoteArrowUp,
  AtSign,
  Landmark,
  Handshake,
  Banknote,
} from 'lucide-react';

/* ── Icons ── */
const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
// const TreatyIcon = () => <ScrollText className="w-5 h-5" />;
const FacultativeIcon = () => <ShieldCheck className="w-5 h-5" />;
const EmailIcon = () => <AtSign className="w-5 h-5" />;
const PaymentIcon = () => <BanknoteArrowDown className="w-5 h-5" />;
const ClaimsIcon = () => <Banknote className="w-5 h-5" />;
// const RecoveriesIcon = () => <BanknoteArrowUp className="w-5 h-5" />;
const CedantIcon = () => <Landmark className="w-5 h-5" />;
const ReinsurerIcon = () => <Handshake className="w-5 h-5" />;
const ReportsIcon = () => <BarChart3 className="w-5 h-5" />;
const SettingsIcon = () => <Settings className="w-5 h-5" />;

/* ── Nav groups ── */

export const REINSURANCE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <DashboardIcon />,
        href: '',
        enabled: true,
        active: true,
        exact: true,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        key: 'emails',
        label: 'Emails',
        icon: <EmailIcon />,
        href: 'emails',
        enabled: true,
        active: true,
      },
      // {
      //   key: 'treaty',
      //   label: 'Treaty',
      //   icon: <TreatyIcon />,
      //   href: 'treaty',
      //   enabled: true,
      //   active: true,
      // },
      {
        key: 'facultative',
        label: 'Facultative',
        icon: <FacultativeIcon />,
        href: 'facultative',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Payments & Claims',
    items: [
      {
        key: 'payments',
        label: 'Premiums',
        icon: <PaymentIcon />,
        href: 'payments',
        enabled: true,
        active: true,
      },
      {
        key: 'claims',
        label: 'Claims',
        icon: <ClaimsIcon />,
        href: 'claims',
        enabled: true,
        active: true,
      },
      // {
      //   key: 'recoveries',
      //   label: 'Recoveries',
      //   icon: <RecoveriesIcon />,
      //   href: 'recoveries',
      //   enabled: true,
      //   active: true,
      // },
    ],
  },
  {
    label: 'Clients',
    items: [
      {
        key: 'cedants',
        label: 'Cedants',
        icon: <CedantIcon />,
        href: 'cedants',
        enabled: true,
        active: true,
      },
      {
        key: 'reinsurers',
        label: 'Reinsurers',
        icon: <ReinsurerIcon />,
        href: 'reinsurers',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        key: 'reports',
        label: 'Reports',
        icon: <ReportsIcon />,
        href: 'reports',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Configuration',
    items: [
      {
        key: 'settings',
        label: 'Settings',
        icon: <SettingsIcon />,
        href: 'settings',
        enabled: true,
        active: true,
      },
    ],
  },
];
