import { NavGroup } from '@/components/organisms/shared/Sidebar';

import { BookSearch, CarFront, ClipboardClock, Handshake, LayoutDashboard } from 'lucide-react';

const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;

const ProspectIcon = () => <Handshake className="w-5 h-5" />;
const AppointmentIcon = () => <ClipboardClock className="w-5 h-5" />;
const NavigateIcon = () => <CarFront className="w-5 h-5" />;

const ProspectingIcon = () => <BookSearch className="w-5 h-5" />;

export const MARKETING_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <DashboardIcon />,
        href: 'dashboard',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      {
        key: 'prospects',
        label: 'Prospects',
        icon: <ProspectIcon />,
        href: 'prospects',
        enabled: true,
        active: true,
      },
      {
        key: 'appointments',
        label: 'Appointments',
        icon: <AppointmentIcon />,
        href: 'appointments',
        enabled: true,
        active: true,
      },
      {
        key: 'navigate',
        label: 'Navigate',
        icon: <NavigateIcon />,
        href: 'navigate',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'CRM Settings',
    items: [
      {
        key: 'prospecting',
        label: 'Prospecting',
        icon: <ProspectingIcon />,
        href: 'prospecting',
        enabled: true,
        active: true,
      },
    ],
  },
];
