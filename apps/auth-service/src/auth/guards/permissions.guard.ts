import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { PermissionAction } from '../../../prisma/generated/client';

type PermissionRule = {
  resource: string;
  actions: PermissionAction[];
};

type AuthenticatedUser = {
  id: string;
  tenantId: string;
  role: string;
};

type AuthenticatedRequest = {
  user?: AuthenticatedUser;
};

const DENY_MESSAGE =
  "You don't have permission to access this. Contact your administrator.";

const PERMISSION_TO_RULES: Record<string, PermissionRule[]> = {
  [Permission.READ_TENANT]: [
    { resource: 'tenants', actions: [PermissionAction.VIEW] },
  ],
  [Permission.UPDATE_TENANT]: [
    { resource: 'tenants', actions: [PermissionAction.EDIT] },
  ],
  [Permission.MANAGE_MODULES]: [
    { resource: 'tenants', actions: [PermissionAction.EDIT] },
  ],
  [Permission.VIEW_AUDIT_LOGS]: [
    { resource: 'audit-logs', actions: [PermissionAction.VIEW] },
  ],
  [Permission.INVITE_USER]: [
    { resource: 'users', actions: [PermissionAction.CREATE] },
  ],
  [Permission.READ_USERS]: [
    { resource: 'users', actions: [PermissionAction.VIEW] },
  ],
  [Permission.UPDATE_USER]: [
    { resource: 'users', actions: [PermissionAction.EDIT] },
  ],
  [Permission.DEACTIVATE_USER]: [
    { resource: 'users', actions: [PermissionAction.DELETE] },
  ],
  [Permission.FORCE_RESET_USER]: [
    { resource: 'user-security', actions: [PermissionAction.EDIT] },
  ],
  [Permission.VIEW_PERMISSION_SETS]: [
    { resource: 'permission-sets', actions: [PermissionAction.VIEW] },
  ],
  [Permission.GRANT_PERMISSION]: [
    {
      resource: 'permission-sets',
      actions: [
        PermissionAction.CREATE,
        PermissionAction.EDIT,
        PermissionAction.DELETE,
        PermissionAction.ASSIGN,
      ],
    },
  ],
  [Permission.APPROVE_SHIFT_SWAP]: [
    { resource: 'schedules', actions: [PermissionAction.APPROVE] },
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  private async getResourceIdByName(
    resourceName: string,
    resourceIdCache: Map<string, string | null>,
  ): Promise<string | null> {
    if (resourceIdCache.has(resourceName)) {
      return resourceIdCache.get(resourceName) ?? null;
    }

    const resource = await this.prisma.resource.findUnique({
      where: { name: resourceName },
      select: { id: true },
    });

    const resourceId = resource?.id ?? null;
    resourceIdCache.set(resourceName, resourceId);
    return resourceId;
  }

  private async hasPermissionForRule(
    tenantId: string,
    userId: string,
    rule: PermissionRule,
    resourceIdCache: Map<string, string | null>,
  ): Promise<boolean> {
    const resourceId = await this.getResourceIdByName(
      rule.resource,
      resourceIdCache,
    );

    if (!resourceId) return false;

    const hasDirectPermission = Boolean(
      await this.prisma.userPermission.findFirst({
        where: {
          tenantId,
          userId,
          resourceId,
          action: { in: rule.actions },
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
    );

    if (hasDirectPermission) return true;

    return Boolean(
      await this.prisma.userPermissionSet.findFirst({
        where: {
          userId,
          permissionSet: {
            tenantId,
            isActive: true,
            resources: {
              some: {
                resourceId,
                action: { in: rule.actions },
              },
            },
          },
        },
      }),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission decorator — endpoint is protected by JwtAuthGuard only
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(DENY_MESSAGE);
    }

    // ── Step 1: SUPER_ADMIN bypass (global) ─────────────────────────────────
    if (user.role === 'SUPER_ADMIN') return true;

    // ── Step 2: TENANT_ADMIN bypass (within their own tenant) ───────────────
    if (user.role === 'TENANT_ADMIN') return true;

    const tenantId = user.tenantId;
    const userId = user.id;
    const resourceIdCache = new Map<string, string | null>();

    // ── Step 3: Enforce each declared permission (fail closed if unknown) ───
    for (const permission of requiredPermissions) {
      const rules = PERMISSION_TO_RULES[permission];
      if (!rules || rules.length === 0) {
        throw new ForbiddenException(DENY_MESSAGE);
      }

      let hasPermission = false;
      for (const rule of rules) {
        if (
          await this.hasPermissionForRule(
            tenantId,
            userId,
            rule,
            resourceIdCache,
          )
        ) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        throw new ForbiddenException(DENY_MESSAGE);
      }
    }

    return true;
  }
}
