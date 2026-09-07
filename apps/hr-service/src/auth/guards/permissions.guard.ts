import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { Permission } from '@work-phelo/config';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

type PermissionRule = { resource: string; actions: string[] };

const DENY_MESSAGE =
  "You don't have permission to access this. Contact your administrator.";

const PERMISSION_TO_RULES: Record<string, PermissionRule[]> = {
  // ── Employees ────────────────────────────────────────────────────────────
  [Permission.CREATE_EMPLOYEE]: [
    { resource: 'employees', actions: ['CREATE'] },
  ],
  [Permission.READ_EMPLOYEES]: [{ resource: 'employees', actions: ['VIEW'] }],
  [Permission.READ_OWN_PROFILE]: [
    { resource: 'employee-profile', actions: ['VIEW'] },
  ],
  [Permission.UPDATE_EMPLOYEE]: [{ resource: 'employees', actions: ['EDIT'] }],
  [Permission.UPDATE_OWN_PROFILE]: [
    { resource: 'employee-profile', actions: ['EDIT'] },
  ],
  [Permission.DELETE_EMPLOYEE]: [
    { resource: 'employees', actions: ['DELETE'] },
  ],
  [Permission.OFFBOARD_EMPLOYEE]: [
    { resource: 'offboarding', actions: ['EDIT'] },
  ],
  [Permission.SUBMIT_RESIGNATION]: [
    { resource: 'resignations', actions: ['CREATE'] },
  ],
  [Permission.WITHDRAW_RESIGNATION]: [
    { resource: 'resignations', actions: ['DELETE'] },
  ],
  [Permission.MANAGE_DOCUMENTS]: [
    { resource: 'documents', actions: ['CREATE', 'EDIT'] },
  ],
  [Permission.EXPORT_EMPLOYEES]: [
    { resource: 'employees', actions: ['EXPORT'] },
  ],
  [Permission.READ_HR_SETTINGS]: [
    { resource: 'hr-settings', actions: ['VIEW'] },
  ],
  [Permission.MANAGE_HR_SETTINGS]: [
    { resource: 'hr-settings', actions: ['EDIT'] },
  ],

  // ── Departments ───────────────────────────────────────────────────────────
  [Permission.CREATE_BRANCH]: [{ resource: 'branches', actions: ['CREATE'] }],
  [Permission.READ_BRANCHES]: [{ resource: 'branches', actions: ['VIEW'] }],
  [Permission.UPDATE_BRANCH]: [{ resource: 'branches', actions: ['EDIT'] }],
  [Permission.DELETE_BRANCH]: [{ resource: 'branches', actions: ['DELETE'] }],
  [Permission.CREATE_DEPARTMENT]: [
    { resource: 'departments', actions: ['CREATE'] },
  ],
  [Permission.READ_DEPARTMENTS]: [
    { resource: 'departments', actions: ['VIEW'] },
  ],
  [Permission.UPDATE_DEPARTMENT]: [
    { resource: 'departments', actions: ['EDIT'] },
  ],
  [Permission.DELETE_DEPARTMENT]: [
    { resource: 'departments', actions: ['DELETE'] },
  ],

  // ── Leave ─────────────────────────────────────────────────────────────────
  [Permission.REQUEST_LEAVE]: [{ resource: 'leave-self', actions: ['CREATE'] }],
  [Permission.APPROVE_LEAVE]: [{ resource: 'leave', actions: ['APPROVE'] }],
  [Permission.READ_ALL_LEAVES]: [{ resource: 'leave', actions: ['VIEW'] }],
  [Permission.READ_OWN_LEAVE]: [{ resource: 'leave-self', actions: ['VIEW'] }],
  [Permission.MANAGE_LEAVE_TYPES]: [
    { resource: 'leave-settings', actions: ['EDIT'] },
  ],

  // ── Time Management ───────────────────────────────────────────────────────
  [Permission.CLOCK_IN_OUT]: [{ resource: 'attendance', actions: ['CREATE'] }],
  [Permission.READ_ATTENDANCE]: [{ resource: 'attendance', actions: ['VIEW'] }],
  [Permission.SUBMIT_TIME_CORRECTION]: [
    { resource: 'time-corrections', actions: ['CREATE'] },
  ],
  [Permission.APPROVE_TIME_CORRECTION]: [
    { resource: 'time-corrections', actions: ['APPROVE'] },
  ],
  [Permission.READ_TIMESHEETS]: [{ resource: 'timesheets', actions: ['VIEW'] }],
  [Permission.APPROVE_TIMESHEET]: [
    { resource: 'timesheets', actions: ['APPROVE'] },
  ],
  [Permission.MANAGE_SCHEDULES]: [
    { resource: 'schedules', actions: ['CREATE', 'EDIT'] },
  ],
  [Permission.APPROVE_SHIFT_SWAP]: [
    { resource: 'schedules', actions: ['APPROVE'] },
  ],

  // ── Assets ────────────────────────────────────────────────────────────────
  [Permission.MANAGE_ASSETS]: [
    { resource: 'assets', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  ],
  [Permission.READ_ASSETS]: [{ resource: 'assets', actions: ['VIEW'] }],
  [Permission.ASSIGN_ASSET]: [
    { resource: 'assets', actions: ['VIEW', 'ASSIGN'] },
  ],

  // ── Projects & Tasks ────────────────────────────────────────────────────
  [Permission.CREATE_PROJECT]: [{ resource: 'projects', actions: ['CREATE'] }],
  [Permission.READ_PROJECTS]: [{ resource: 'projects', actions: ['VIEW'] }],
  [Permission.UPDATE_PROJECT]: [{ resource: 'projects', actions: ['EDIT'] }],
  [Permission.DELETE_PROJECT]: [{ resource: 'projects', actions: ['DELETE'] }],
  [Permission.ASSIGN_PROJECT]: [{ resource: 'projects', actions: ['ASSIGN'] }],
  [Permission.CREATE_PROJECT_TASK]: [
    { resource: 'project-tasks', actions: ['CREATE'] },
  ],
  [Permission.READ_PROJECT_TASKS]: [
    { resource: 'project-tasks', actions: ['VIEW'] },
  ],
  [Permission.UPDATE_PROJECT_TASK]: [
    { resource: 'project-tasks', actions: ['EDIT'] },
  ],
  [Permission.DELETE_PROJECT_TASK]: [
    { resource: 'project-tasks', actions: ['DELETE'] },
  ],
  [Permission.ASSIGN_PROJECT_TASK]: [
    { resource: 'project-tasks', actions: ['ASSIGN'] },
  ],

  [Permission.READ_ANNOUNCEMENTS]: [
    { resource: 'announcements', actions: ['VIEW'] },
  ],
  [Permission.MANAGE_ANNOUNCEMENTS]: [
    {
      resource: 'announcements',
      actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    },
  ],

  // ── Payroll ───────────────────────────────────────────────────────────────
  [Permission.READ_PAYROLL]: [
    { resource: 'payroll', actions: ['VIEW', 'RUN', 'APPROVE', 'EDIT'] },
  ],
  [Permission.RUN_PAYROLL]: [{ resource: 'payroll', actions: ['RUN'] }],
  [Permission.APPROVE_PAYROLL]: [{ resource: 'payroll', actions: ['APPROVE'] }],
  [Permission.READ_OWN_PAYSLIP]: [
    { resource: 'payslip-self', actions: ['VIEW'] },
  ],
  [Permission.MANAGE_PAYROLL_SETTINGS]: [
    { resource: 'payroll', actions: ['EDIT'] },
  ],
  // Grants access to anyone who can either run or manage payroll (RUN or EDIT)
  [Permission.WRITE_EMPLOYEE_PAYROLL]: [
    { resource: 'payroll', actions: ['RUN', 'EDIT'] },
  ],

  // ── Appraisals ────────────────────────────────────────────────────────────
  [Permission.CONFIGURE_APPRAISAL]: [
    { resource: 'appraisal-settings', actions: ['EDIT'] },
  ],
  [Permission.CREATE_APPRAISAL]: [
    { resource: 'appraisals', actions: ['CREATE'] },
  ],
  [Permission.READ_APPRAISALS]: [{ resource: 'appraisals', actions: ['VIEW'] }],
  [Permission.SUBMIT_SELF_ASSESSMENT]: [
    { resource: 'self-appraisals', actions: ['EDIT'] },
  ],
  [Permission.SUBMIT_MANAGER_REVIEW]: [
    { resource: 'appraisal-reviews', actions: ['EDIT'] },
  ],
  [Permission.FINALIZE_APPRAISAL]: [
    { resource: 'appraisals', actions: ['APPROVE'] },
  ],
  [Permission.READ_OWN_REVIEW]: [
    { resource: 'self-appraisals', actions: ['VIEW'] },
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    if (!user) throw new ForbiddenException(DENY_MESSAGE);

    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;

    const userPerms = new Set<string>(user.permissions ?? []);

    for (const permission of requiredPermissions) {
      const rules = PERMISSION_TO_RULES[permission];
      if (!rules || rules.length === 0) {
        throw new ForbiddenException(DENY_MESSAGE);
      }

      const hasPermission = rules.some((rule) =>
        rule.actions.some((action) =>
          userPerms.has(`${rule.resource}:${action}`),
        ),
      );

      if (!hasPermission) throw new ForbiddenException(DENY_MESSAGE);
    }

    return true;
  }
}
