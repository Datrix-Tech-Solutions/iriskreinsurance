export const PERMISSIONS = {
  // HR
  HR_VIEW_EMPLOYEES: 'hr:view_employees',
  HR_MANAGE_EMPLOYEES: 'hr:manage_employees',
  HR_APPROVE_LEAVE: 'hr:approve_leave',
  HR_MANAGE_PAYROLL: 'hr:manage_payroll',
  HR_VIEW_PAYROLL: 'hr:view_payroll',
  HR_MANAGE_CLOCKING: 'hr:manage_clocking',
  HR_MANAGE_SCHEDULING: 'hr:manage_scheduling',
  HR_MANAGE_APPRAISAL: 'hr:manage_appraisal',
  HR_MANAGE_ASSETS: 'hr:manage_assets',
  // Admin
  ADMIN_MANAGE_ROLES: 'admin:manage_roles',
  ADMIN_MANAGE_BILLING: 'admin:manage_billing',
  ADMIN_MANAGE_SETTINGS: 'admin:manage_settings',
  // Marketing
  MARKETING_VIEW: 'marketing:view',
  MARKETING_MANAGE: 'marketing:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
