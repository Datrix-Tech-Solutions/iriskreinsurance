export enum Permission {
  // ── Tenant / Platform ─────────────────────────────────────────────────────
  READ_TENANT = 'read:tenant',
  UPDATE_TENANT = 'update:tenant',
  MANAGE_MODULES = 'manage:modules',
  VIEW_AUDIT_LOGS = 'view:audit_logs',

  // ── Users ─────────────────────────────────────────────────────────────────
  INVITE_USER = 'invite:user',
  READ_USERS = 'read:users',
  UPDATE_USER = 'update:user',
  DEACTIVATE_USER = 'deactivate:user',
  FORCE_RESET_USER = 'force_reset:user',
  VIEW_PERMISSION_SETS = 'view:permission_sets',
  GRANT_PERMISSION = 'grant:permission',

  // ── Employees ─────────────────────────────────────────────────────────────
  CREATE_EMPLOYEE = 'create:employee',
  READ_EMPLOYEES = 'read:employees',
  READ_OWN_PROFILE = 'read:own_profile',
  UPDATE_EMPLOYEE = 'update:employee',
  UPDATE_OWN_PROFILE = 'update:own_profile',
  DELETE_EMPLOYEE = 'delete:employee',
  OFFBOARD_EMPLOYEE = 'offboard:employee',
  SUBMIT_RESIGNATION = 'submit:resignation',
  WITHDRAW_RESIGNATION = 'withdraw:resignation',
  MANAGE_DOCUMENTS = 'manage:documents',
  EXPORT_EMPLOYEES = 'export:employees',
  READ_HR_SETTINGS = 'read:hr_settings',
  MANAGE_HR_SETTINGS = 'manage:hr_settings',

  // ── Departments ───────────────────────────────────────────────────────────
  CREATE_DEPARTMENT = 'create:department',
  READ_DEPARTMENTS = 'read:departments',
  UPDATE_DEPARTMENT = 'update:department',
  DELETE_DEPARTMENT = 'delete:department',

  // ── Branches ───────────────────────────────────────────────────────────────
  CREATE_BRANCH = 'create:branch',
  READ_BRANCHES = 'read:branches',
  UPDATE_BRANCH = 'update:branch',
  DELETE_BRANCH = 'delete:branch',

  // ── Leave ─────────────────────────────────────────────────────────────────
  REQUEST_LEAVE = 'request:leave',
  APPROVE_LEAVE = 'approve:leave',
  READ_ALL_LEAVES = 'read:all_leaves',
  READ_OWN_LEAVE = 'read:own_leave',
  MANAGE_LEAVE_TYPES = 'manage:leave_types',

  // ── Time Management ───────────────────────────────────────────────────────
  CLOCK_IN_OUT = 'clock:in_out',
  READ_ATTENDANCE = 'read:attendance',
  SUBMIT_TIME_CORRECTION = 'submit:time_correction',
  APPROVE_TIME_CORRECTION = 'approve:time_correction',
  READ_TIMESHEETS = 'read:timesheets',
  APPROVE_TIMESHEET = 'approve:timesheet',
  MANAGE_SCHEDULES = 'manage:schedules',
  APPROVE_SHIFT_SWAP = 'approve:shift_swap',

  // ── Payroll ───────────────────────────────────────────────────────────────
  READ_PAYROLL = 'read:payroll',
  RUN_PAYROLL = 'run:payroll',
  APPROVE_PAYROLL = 'approve:payroll',
  READ_OWN_PAYSLIP = 'read:own_payslip',
  MANAGE_PAYROLL_SETTINGS = 'manage:payroll_settings',
  WRITE_EMPLOYEE_PAYROLL = 'write:employee_payroll',

  // ── Appraisal ─────────────────────────────────────────────────────────────
  CONFIGURE_APPRAISAL = 'configure:appraisal',
  CREATE_APPRAISAL = 'create:appraisal',
  READ_APPRAISALS = 'read:appraisals',
  SUBMIT_SELF_ASSESSMENT = 'submit:self_assessment',
  SUBMIT_MANAGER_REVIEW = 'submit:manager_review',
  FINALIZE_APPRAISAL = 'finalize:appraisal',
  READ_OWN_REVIEW = 'read:own_review',

  // ── Assets ────────────────────────────────────────────────────────────────
  MANAGE_ASSETS = 'manage:assets',
  READ_ASSETS = 'read:assets',
  ASSIGN_ASSET = 'assign:asset',

  // ── Projects & Tasks ────────────────────────────────────────────────────
  CREATE_PROJECT = 'create:project',
  READ_PROJECTS = 'read:projects',
  UPDATE_PROJECT = 'update:project',
  DELETE_PROJECT = 'delete:project',
  ASSIGN_PROJECT = 'assign:project',
  CREATE_PROJECT_TASK = 'create:project_task',
  READ_PROJECT_TASKS = 'read:project_tasks',
  UPDATE_PROJECT_TASK = 'update:project_task',
  DELETE_PROJECT_TASK = 'delete:project_task',
  ASSIGN_PROJECT_TASK = 'assign:project_task',

  READ_ANNOUNCEMENTS = 'read:announcements',
  MANAGE_ANNOUNCEMENTS = 'manage:announcements',

  // ── Reinsurance Operations ────────────────────────────────────────────────
  VIEW_REINSURANCE_DASHBOARD = 'view:reinsurance_dashboard',
}

// System role platform access — controls WHERE you go after login
export const SYSTEM_ROLE_ACCESS: Record<string, string[]> = {
  SUPER_ADMIN: ['platform_admin'],
  TENANT_ADMIN: ['company_admin'],
  EMPLOYEE: ['employee_home'],
};
