import { NavGroup } from '@/components/organisms/shared/Sidebar';

import {
  LayoutDashboard,
  CircleDollarSign,
  Users,
  CalendarRange,
  Trophy,
  Timer,
  CalendarCheck,
  MonitorSmartphone,
  FileSliders,
  Megaphone,
  FolderKanban,
} from 'lucide-react';

/* ── Icons ── */
const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
const EmployeesIcon = () => <Users className="w-5 h-5" />;
const LeaveIcon = () => <CalendarRange className="w-5 h-5" />;
const AppraisalIcon = () => <Trophy className="w-5 h-5" />;
const TimeClockIcon = () => <Timer className="w-5 h-5" />;
const SchedulingIcon = () => <CalendarCheck className="w-5 h-5" />;
const PayrollIcon = () => <CircleDollarSign className="w-5 h-5" />;
const AssetIcon = () => <MonitorSmartphone className="w-5 h-5" />;
const ManagementIcon = () => <FileSliders className="w-5 h-5" />;
const MegaphoneIcon = () => <Megaphone className="w-5 h-5" />;
const ProjectsIcon = () => <FolderKanban className="w-5 h-5" />;

/* ── Nav groups — all items default enabled & active ── */

export const HR_NAV_GROUPS: NavGroup[] = [
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
    label: 'People Management',
    items: [
      {
        key: 'employees',
        label: 'Employees',
        icon: <EmployeesIcon />,
        href: 'employees',
        enabled: true,
        active: false,
      },
      {
        key: 'leave',
        label: 'Leave Management',
        icon: <LeaveIcon />,
        href: 'leave',
        enabled: true,
        active: false,
      },

      {
        key: 'assets',
        label: 'Asset Management',
        icon: <AssetIcon />,
        href: 'assets',
        enabled: true,
        active: false,
      },
      {
        key: 'payroll',
        label: 'Payroll',
        icon: <PayrollIcon />,
        href: 'payroll',
        enabled: true,
        active: false,
      },
      {
        key: 'announcements',
        label: 'Announcements',
        icon: <MegaphoneIcon />,
        href: 'announcements',
        enabled: true,
        active: false,
      },
    ],
  },
  {
    label: 'Workforce Management',
    items: [
      {
        key: 'timeclock',
        label: 'Time Clock',
        icon: <TimeClockIcon />,
        href: 'time-clock',
        enabled: true,
        active: false,
      },
      {
        key: 'scheduling',
        label: 'Smart Scheduling',
        icon: <SchedulingIcon />,
        href: 'scheduling',
        enabled: true,
        active: false,
      },
      {
        key: 'appraisal',
        label: 'Appraisal',
        icon: <AppraisalIcon />,
        href: 'appraisal',
        enabled: true,
        active: false,
      },
      {
        key: 'projects',
        label: 'Projects',
        icon: <ProjectsIcon />,
        href: 'projects',
        enabled: true,
        active: false,
      },
    ],
  },
  {
    label: 'Payroll and Compensation',
    items: [],
  },

  {
    label: 'Management',
    items: [
      {
        key: 'management',
        label: 'HR Settings',
        icon: <ManagementIcon />,
        href: 'hrmanagement',
        enabled: true,
        active: false,
      },
    ],
  },
];
