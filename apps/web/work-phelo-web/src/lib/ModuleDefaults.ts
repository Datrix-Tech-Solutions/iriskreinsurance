import { Module } from '@/components/organisms/shared/ModuleConfiguration';

export const DEFAULT_MODULES: Module[] = [
  {
    id: 'hr',
    key: 'hr',
    name: 'HR Module',
    description: 'Manage employees, leave, payroll, appraisals and more',
    enabled: false,
    options: [
      {
        key: 'departments',
        label: 'Departments',
        description: 'Manage company departments and structure',
      },
      {
        key: 'branches',
        label: 'Branches',
        description: 'Manage company branch locations',
      },
      {
        key: 'employees',
        label: 'Employees',
        description: 'Manage employee records and profiles',
      },
      {
        key: 'leave',
        label: 'Leave Management',
        description: 'Employee leave requests and balances',
      },
      {
        key: 'appraisal',
        label: 'Appraisal',
        description: 'Performance reviews and cycles',
      },
      {
        key: 'timeclock',
        label: 'Time Clock',
        description: 'Clock in/out and attendance tracking',
      },
      {
        key: 'scheduling',
        label: 'Smart Scheduling',
        description: 'Shift and workforce scheduling',
      },
      {
        key: 'payroll',
        label: 'Payroll',
        description: 'Process and manage payroll',
      },
      {
        key: 'assets',
        label: 'Asset Management',
        description: 'Company asset tracking',
      },
      {
        key: 'projects',
        label: 'Projects',
        description: 'Project and task management',
      },
      {
        key: 'smsAnnouncement',
        label: 'SMS Announcement',
        description: 'Allow announcements to be sent via SMS to employee phone numbers',
      },
    ],
  },
  {
    id: 'accounting',
    key: 'accounting',
    name: 'Accounting Module',
    description: 'Manage invoices, expenses, and financial reports',
    enabled: false,
    options: [],
  },
  {
    id: 'marketing',
    key: 'marketing',
    name: 'Marketing Module',
    description: 'Manage leads, sales pipeline, and contacts',
    enabled: false,
    options: [
      {
        key: 'leads',
        label: 'Lead Management',
        description: 'Manage leads and conversions',
      },
      {
        key: 'pipeline',
        label: 'Sales Pipeline',
        description: 'Track deals through pipeline stages',
      },
      {
        key: 'contacts',
        label: 'Contact Management',
        description: 'Manage customer contacts',
      },
    ],
  },
  {
    id: 'operations',
    key: 'operations',
    name: 'Operation Module',
    description: 'Manage industry-specific operational workflows',
    enabled: false,
    options: [
      {
        key: 'reinsurance',
        label: 'Reinsurance Operations',
        description: 'Broker placements, counterparties and correspondence',
      },
    ],
  },
];
