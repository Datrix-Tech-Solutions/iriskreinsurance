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

  // ── Branches ──────────────────────────────────────────────────────────────
  READ_BRANCHES = 'read:branches',
  CREATE_BRANCH = 'create:branch',
  UPDATE_BRANCH = 'update:branch',
  DELETE_BRANCH = 'delete:branch',

  // ── Departments ───────────────────────────────────────────────────────────
  CREATE_DEPARTMENT = 'create:department',
  READ_DEPARTMENTS = 'read:departments',
  UPDATE_DEPARTMENT = 'update:department',
  DELETE_DEPARTMENT = 'delete:department',

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

// Maps each Permission to the resource:ACTION strings returned in effectivePermissions.
// Action values match the backend PermissionAction enum: VIEW, CREATE, EDIT, DELETE, APPROVE, RUN, EXPORT, ASSIGN
export const PERMISSION_MAP: Record<string, string[]> = {
  // Tenant / Platform
  [Permission.READ_TENANT]: ['tenants:VIEW'],
  [Permission.UPDATE_TENANT]: ['tenants:EDIT'],
  [Permission.MANAGE_MODULES]: ['tenants:EDIT'],
  [Permission.VIEW_AUDIT_LOGS]: ['audit-logs:VIEW'],

  // Users
  [Permission.INVITE_USER]: ['users:CREATE'],
  [Permission.READ_USERS]: ['users:VIEW'],
  [Permission.UPDATE_USER]: ['users:EDIT'],
  [Permission.DEACTIVATE_USER]: ['users:DELETE'],
  [Permission.FORCE_RESET_USER]: ['user-security:EDIT'],
  [Permission.VIEW_PERMISSION_SETS]: ['permission-sets:VIEW'],
  [Permission.GRANT_PERMISSION]: [
    'permission-sets:CREATE',
    'permission-sets:EDIT',
    'permission-sets:DELETE',
    'permission-sets:ASSIGN',
  ],

  // Employees
  [Permission.CREATE_EMPLOYEE]: ['employees:CREATE'],
  [Permission.READ_EMPLOYEES]: ['employees:VIEW'],
  [Permission.READ_OWN_PROFILE]: ['employee-profile:VIEW'],
  [Permission.UPDATE_EMPLOYEE]: ['employees:EDIT'],
  [Permission.UPDATE_OWN_PROFILE]: ['employee-profile:EDIT'],
  [Permission.DELETE_EMPLOYEE]: ['employees:DELETE'],
  [Permission.OFFBOARD_EMPLOYEE]: ['offboarding:EDIT'],
  [Permission.SUBMIT_RESIGNATION]: ['resignations:CREATE'],
  [Permission.WITHDRAW_RESIGNATION]: ['resignations:DELETE'],
  [Permission.MANAGE_DOCUMENTS]: ['documents:CREATE', 'documents:EDIT'],
  [Permission.EXPORT_EMPLOYEES]: ['employees:EXPORT'],
  [Permission.READ_HR_SETTINGS]: ['hr-settings:VIEW'],
  [Permission.MANAGE_HR_SETTINGS]: ['hr-settings:EDIT'],

  // Branches
  [Permission.READ_BRANCHES]: ['branches:VIEW'],
  [Permission.CREATE_BRANCH]: ['branches:CREATE'],
  [Permission.UPDATE_BRANCH]: ['branches:EDIT'],
  [Permission.DELETE_BRANCH]: ['branches:DELETE'],

  // Departments
  [Permission.CREATE_DEPARTMENT]: ['departments:CREATE'],
  [Permission.READ_DEPARTMENTS]: ['departments:VIEW'],
  [Permission.UPDATE_DEPARTMENT]: ['departments:EDIT'],
  [Permission.DELETE_DEPARTMENT]: ['departments:DELETE'],

  // Leave
  [Permission.REQUEST_LEAVE]: ['leave-self:CREATE'],
  [Permission.APPROVE_LEAVE]: ['leave:APPROVE'],
  [Permission.READ_ALL_LEAVES]: ['leave:VIEW'],
  [Permission.READ_OWN_LEAVE]: ['leave-self:VIEW'],
  [Permission.MANAGE_LEAVE_TYPES]: ['leave-settings:EDIT'],

  // Time Management
  [Permission.CLOCK_IN_OUT]: ['attendance:CREATE'],
  [Permission.READ_ATTENDANCE]: ['attendance:VIEW'],
  [Permission.SUBMIT_TIME_CORRECTION]: ['time-corrections:CREATE'],
  [Permission.APPROVE_TIME_CORRECTION]: ['time-corrections:APPROVE'],
  [Permission.READ_TIMESHEETS]: ['timesheets:VIEW'],
  [Permission.APPROVE_TIMESHEET]: ['timesheets:APPROVE'],
  [Permission.MANAGE_SCHEDULES]: ['schedules:CREATE', 'schedules:EDIT'],
  [Permission.APPROVE_SHIFT_SWAP]: ['schedules:APPROVE'],

  // Payroll
  [Permission.READ_PAYROLL]: ['payroll:VIEW', 'payroll:RUN', 'payroll:APPROVE', 'payroll:EDIT'],
  [Permission.RUN_PAYROLL]: ['payroll:RUN'],
  [Permission.APPROVE_PAYROLL]: ['payroll:APPROVE'],
  [Permission.READ_OWN_PAYSLIP]: ['payslip-self:VIEW'],
  [Permission.MANAGE_PAYROLL_SETTINGS]: ['payroll:EDIT'],
  [Permission.WRITE_EMPLOYEE_PAYROLL]: ['payroll:RUN', 'payroll:EDIT'],

  // Appraisal
  [Permission.CONFIGURE_APPRAISAL]: ['appraisal-settings:EDIT'],
  [Permission.CREATE_APPRAISAL]: ['appraisals:CREATE'],
  [Permission.READ_APPRAISALS]: ['appraisals:VIEW'],
  [Permission.SUBMIT_SELF_ASSESSMENT]: ['self-appraisals:EDIT'],
  [Permission.SUBMIT_MANAGER_REVIEW]: ['appraisal-reviews:EDIT'],
  [Permission.FINALIZE_APPRAISAL]: ['appraisals:APPROVE'],
  [Permission.READ_OWN_REVIEW]: ['self-appraisals:VIEW'],

  // Assets
  [Permission.MANAGE_ASSETS]: ['assets:CREATE', 'assets:EDIT'],
  [Permission.READ_ASSETS]: ['assets:VIEW'],
  [Permission.ASSIGN_ASSET]: ['assets:ASSIGN'],

  // Projects & Tasks
  [Permission.CREATE_PROJECT]: ['projects:CREATE'],
  [Permission.READ_PROJECTS]: ['projects:VIEW'],
  [Permission.UPDATE_PROJECT]: ['projects:EDIT'],
  [Permission.DELETE_PROJECT]: ['projects:DELETE'],
  [Permission.ASSIGN_PROJECT]: ['projects:ASSIGN'],
  [Permission.CREATE_PROJECT_TASK]: ['project-tasks:CREATE'],
  [Permission.READ_PROJECT_TASKS]: ['project-tasks:VIEW'],
  [Permission.UPDATE_PROJECT_TASK]: ['project-tasks:EDIT'],
  [Permission.DELETE_PROJECT_TASK]: ['project-tasks:DELETE'],
  [Permission.ASSIGN_PROJECT_TASK]: ['project-tasks:ASSIGN'],

  [Permission.READ_ANNOUNCEMENTS]: ['announcements:VIEW'],
  [Permission.MANAGE_ANNOUNCEMENTS]: [
    'announcements:CREATE',
    'announcements:EDIT',
    'announcements:DELETE',
  ],

  // Reinsurance Operations
  [Permission.VIEW_REINSURANCE_DASHBOARD]: ['operations.reinsurance.dashboard:VIEW'],
};

export const PERMISSION_ACTION_LABELS: Record<string, string> = {
  VIEW: 'View',
  CREATE: 'Create',
  EDIT: 'Edit',
  DELETE: 'Delete',
  APPROVE: 'Approve',
  RUN: 'Run',
  EXPORT: 'Export',
  ASSIGN: 'Assign',
};

export const RESOURCE_ACTIONS: Record<string, string[]> = {
  users: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  'user-security': ['EDIT'],
  tenants: ['VIEW', 'EDIT'],
  'permission-sets': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  'audit-logs': ['VIEW'],
  employees: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'],
  'employee-profile': ['VIEW', 'EDIT'],
  offboarding: ['EDIT'],
  resignations: ['CREATE', 'DELETE'],
  departments: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  branches: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  'hr-settings': ['VIEW', 'EDIT'],
  leave: ['VIEW', 'APPROVE'],
  'leave-self': ['VIEW', 'CREATE'],
  'leave-settings': ['EDIT'],
  attendance: ['VIEW', 'CREATE'],
  'time-corrections': ['VIEW', 'CREATE', 'APPROVE'],
  timesheets: ['VIEW', 'APPROVE'],
  schedules: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'],
  payroll: ['VIEW', 'RUN', 'APPROVE', 'EDIT'],
  'payslip-self': ['VIEW'],
  appraisals: ['VIEW', 'CREATE', 'APPROVE'],
  'appraisal-settings': ['EDIT'],
  'self-appraisals': ['VIEW', 'EDIT'],
  'appraisal-reviews': ['EDIT'],
  assets: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN'],
  projects: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  'project-tasks': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  announcements: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  documents: ['VIEW', 'CREATE', 'EDIT'],
  allowances: ['VIEW', 'CREATE', 'EDIT'],
  'payroll-reports': ['VIEW', 'EXPORT'],
  'expense-reports': ['VIEW', 'EXPORT'],
  'platform-settings': ['VIEW', 'EDIT'],
  subscriptions: ['VIEW', 'EDIT'],
  'operations.reinsurance.dashboard': ['VIEW'],
  'operations.reinsurance.placements': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT'],
  'operations.reinsurance.counterparties': ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  'operations.reinsurance.claims': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT'],
  'operations.reinsurance.email': ['VIEW', 'CREATE', 'EDIT'],
  'operations.reinsurance.email-settings': ['VIEW', 'EDIT'],
  'operations.reinsurance.reports': ['VIEW', 'EXPORT'],
  'operations.reinsurance.settings': ['VIEW', 'EDIT'],
  'operations.reinsurance.taxes-levies': ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  // Granular reinsurance workflow resources — RUN-gated (auth-service seed-resources.ts).
  'operations.reinsurance.facultative-offers.create-offer': ['RUN'],
  'operations.reinsurance.facultative-offers.edit-offer': ['RUN'],
  'operations.reinsurance.facultative-offers.partial-edit': ['RUN'],
  'operations.reinsurance.facultative-offers.reopen-offer': ['RUN'],
  'operations.reinsurance.facultative-offers.force-close': ['RUN'],
  'operations.reinsurance.facultative-offers.endorse-offer': ['RUN'],
  'operations.reinsurance.facultative-offers.archive-offer': ['RUN'],
  'operations.reinsurance.premiums.receive-from-cedant': ['RUN'],
  'operations.reinsurance.premiums.disburse-to-reinsurer': ['RUN'],
  'operations.reinsurance.premiums.reverse-payment': ['RUN'],
  'operations.reinsurance.claims.add-claim': ['RUN'],
  'operations.reinsurance.claims.create-notification': ['RUN'],
  'operations.reinsurance.claims.record-recovery': ['RUN'],
  'operations.reinsurance.claims.void-claim': ['RUN'],
};

// All seeded resource actions stay in RESOURCE_ACTIONS so hidden or future
// resources can still round-trip safely when editing existing roles/sets.
// Only this allowlist controls what the HR permission UI should expose today.
export const PERMISSION_UI_VISIBLE_RESOURCES = new Set([
  'users',
  'user-security',
  'permission-sets',
  'audit-logs',
  'employees',
  'employee-profile',
  'offboarding',
  'resignations',
  'documents',
  'departments',
  'branches',
  'assets',
  'announcements',
  'leave',
  'leave-self',
  'leave-settings',
  'attendance',
  'time-corrections',
  'timesheets',
  'schedules',
  'payroll',
  'payslip-self',
  'appraisals',
  'appraisal-settings',
  'self-appraisals',
  'appraisal-reviews',
  'projects',
  'project-tasks',
  'hr-settings',
  'operations.reinsurance.dashboard',
  'operations.reinsurance.placements',
  'operations.reinsurance.counterparties',
  'operations.reinsurance.claims',
  'operations.reinsurance.email',
  'operations.reinsurance.email-settings',
  'operations.reinsurance.reports',
  'operations.reinsurance.settings',
]);

export function isPermissionUiVisibleResource(resourceName: string): boolean {
  return PERMISSION_UI_VISIBLE_RESOURCES.has(resourceName);
}

// ── Role permission matrix integration ────────────────────────────────────────
//
// Maps each PermissionMatrix UI action (CREATE/VIEW/EDIT/DELETE) per feature key
// to one or more { resource, action } pairs that the backend PermissionSet expects.
// Resources match seed-resources.ts names; actions match the PermissionAction enum.

type BackendPerm = { resource: string; action: string };
type FeatureActionMapping = Record<string, BackendPerm[]>; // uiAction → backend permissions

export const FEATURE_PERMISSION_MAPPING: Record<string, FeatureActionMapping> = {
  // resource: 'departments'
  departments: {
    CREATE: [{ resource: 'departments', action: 'CREATE' }],
    VIEW: [{ resource: 'departments', action: 'VIEW' }],
    EDIT: [{ resource: 'departments', action: 'EDIT' }],
    DELETE: [{ resource: 'departments', action: 'DELETE' }],
  },

  // resource: 'branches' (seeded)
  branches: {
    CREATE: [{ resource: 'branches', action: 'CREATE' }],
    VIEW: [{ resource: 'branches', action: 'VIEW' }],
    EDIT: [{ resource: 'branches', action: 'EDIT' }],
    DELETE: [{ resource: 'branches', action: 'DELETE' }],
  },

  // resource: 'employees'
  employees: {
    CREATE: [{ resource: 'employees', action: 'CREATE' }],
    VIEW: [{ resource: 'employees', action: 'VIEW' }],
    EDIT: [{ resource: 'employees', action: 'EDIT' }],
    DELETE: [{ resource: 'employees', action: 'DELETE' }], // offboard
  },

  // resource: 'leave' — DELETE col maps to APPROVE (not delete a leave record)
  leave: {
    CREATE: [{ resource: 'leave', action: 'CREATE' }],
    VIEW: [{ resource: 'leave', action: 'VIEW' }],
    EDIT: [{ resource: 'leave', action: 'EDIT' }], // manage leave types
    DELETE: [{ resource: 'leave', action: 'APPROVE' }], // approve/reject leave
  },

  // resource: 'appraisals' — DELETE col maps to APPROVE
  appraisal: {
    CREATE: [{ resource: 'appraisals', action: 'CREATE' }],
    VIEW: [{ resource: 'appraisals', action: 'VIEW' }],
    EDIT: [{ resource: 'appraisals', action: 'EDIT' }], // configure cycles
    DELETE: [{ resource: 'appraisals', action: 'APPROVE' }],
  },

  // resources: 'attendance', 'time-corrections', 'timesheets', 'schedules'
  // CREATE → clock in/out + submit correction
  // VIEW   → view all time resources
  // EDIT   → approve corrections/timesheets + manage schedules
  // DELETE → delete schedules
  timeclock: {
    CREATE: [
      { resource: 'attendance', action: 'CREATE' },
      { resource: 'time-corrections', action: 'CREATE' },
    ],
    VIEW: [
      { resource: 'attendance', action: 'VIEW' },
      { resource: 'time-corrections', action: 'VIEW' },
      { resource: 'timesheets', action: 'VIEW' },
      { resource: 'schedules', action: 'VIEW' },
    ],
    EDIT: [
      { resource: 'time-corrections', action: 'APPROVE' },
      { resource: 'timesheets', action: 'APPROVE' },
      { resource: 'schedules', action: 'CREATE' },
      { resource: 'schedules', action: 'EDIT' },
    ],
    DELETE: [{ resource: 'schedules', action: 'DELETE' }],
  },

  // resource: 'payroll' — CREATE → RUN, DELETE → APPROVE
  payroll: {
    CREATE: [{ resource: 'payroll', action: 'RUN' }], // run payroll
    VIEW: [{ resource: 'payroll', action: 'VIEW' }],
    EDIT: [{ resource: 'payroll', action: 'EDIT' }], // manage payroll settings
    DELETE: [{ resource: 'payroll', action: 'APPROVE' }], // approve payroll run
  },

  // resource: 'assets' — DELETE col maps to ASSIGN
  assets: {
    CREATE: [{ resource: 'assets', action: 'CREATE' }],
    VIEW: [{ resource: 'assets', action: 'VIEW' }],
    EDIT: [{ resource: 'assets', action: 'EDIT' }],
    DELETE: [{ resource: 'assets', action: 'ASSIGN' }], // assign asset to employee
  },

  // resources: 'projects', 'project-tasks'
  projects: {
    CREATE: [
      { resource: 'projects', action: 'CREATE' },
      { resource: 'project-tasks', action: 'CREATE' },
    ],
    VIEW: [
      { resource: 'projects', action: 'VIEW' },
      { resource: 'project-tasks', action: 'VIEW' },
    ],
    EDIT: [
      { resource: 'projects', action: 'EDIT' },
      { resource: 'projects', action: 'ASSIGN' },
      { resource: 'project-tasks', action: 'EDIT' },
      { resource: 'project-tasks', action: 'ASSIGN' },
    ],
    DELETE: [
      { resource: 'projects', action: 'DELETE' },
      { resource: 'project-tasks', action: 'DELETE' },
    ],
  },

  // resources: 'permission-sets', 'audit-logs'
  management: {
    CREATE: [{ resource: 'permission-sets', action: 'CREATE' }],
    VIEW: [
      { resource: 'permission-sets', action: 'VIEW' },
      { resource: 'audit-logs', action: 'VIEW' },
    ],
    EDIT: [{ resource: 'permission-sets', action: 'EDIT' }],
    DELETE: [{ resource: 'permission-sets', action: 'DELETE' }],
  },
};

/**
 * Reverse of transformFeaturePermissions.
 * Converts the backend resource:action format back to the PermissionMatrix UI state.
 * Input:  { leave: ['CREATE', 'APPROVE'], payroll: ['VIEW', 'RUN'] }
 * Output: { leave: ['CREATE', 'DELETE'], payroll: ['VIEW', 'CREATE'] }
 */
export function reverseTransformFeaturePermissions(
  backendPermissions: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [resource, actions] of Object.entries(backendPermissions)) {
    const allowedActions = RESOURCE_ACTIONS[resource];
    if (!allowedActions) continue;
    result[resource] = actions.filter((action) => allowedActions.includes(action));
  }

  for (const [featureKey, actionMapping] of Object.entries(FEATURE_PERMISSION_MAPPING)) {
    if (result[featureKey]) continue;
    for (const [uiAction, backendPerms] of Object.entries(actionMapping)) {
      const hasAny = backendPerms.some(({ resource, action }) =>
        (backendPermissions[resource] ?? []).includes(action),
      );
      if (hasAny) {
        if (!result[featureKey]) result[featureKey] = [];
        if (!result[featureKey].includes(uiAction)) result[featureKey].push(uiAction);
      }
    }
  }

  return result;
}

/**
 * Transforms PermissionMatrix UI state into the backend PermissionSet format.
 * Input:  { leave: ['CREATE', 'DELETE'], payroll: ['VIEW'] }
 * Output: { leave: ['CREATE', 'APPROVE'], payroll: ['VIEW'] }
 */
export function transformFeaturePermissions(
  featurePermissions: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [key, uiActions] of Object.entries(featurePermissions)) {
    if (!uiActions.length) continue;

    const allowedResourceActions = RESOURCE_ACTIONS[key];
    if (allowedResourceActions) {
      result[key] = uiActions.filter((action) => allowedResourceActions.includes(action));
      continue;
    }

    const mapping = FEATURE_PERMISSION_MAPPING[key];
    if (!mapping) continue;

    for (const uiAction of uiActions) {
      const backendPerms = mapping[uiAction] ?? [];
      for (const { resource, action } of backendPerms) {
        if (!result[resource]) result[resource] = [];
        if (!result[resource].includes(action)) result[resource].push(action);
      }
    }
  }

  return result;
}
