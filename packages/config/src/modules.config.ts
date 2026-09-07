export const ERP_MODULES = {
  HR_CORE: 'hr_core',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
  CLOCKING: 'clocking',
  SCHEDULING: 'scheduling',
  APPRAISAL: 'appraisal',
  ASSETS: 'assets',
  MARKETING: 'marketing',
  ACCOUNTING: 'accounting',
} as const;

export type ErpModule = (typeof ERP_MODULES)[keyof typeof ERP_MODULES];
