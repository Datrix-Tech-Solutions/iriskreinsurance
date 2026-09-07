import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';

const DENY_MESSAGE =
  "You don't have permission to access this. Contact your administrator.";

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'TENANT_ADMIN']);

export function userHasAnyPermission(
  user: RequestUser,
  permissions: readonly string[],
): boolean {
  if (ADMIN_ROLES.has(user.role)) return true;
  const userPermissions = new Set(user.permissions ?? []);
  return permissions.some((permission) => userPermissions.has(permission));
}

export function assertUserHasAnyPermission(
  user: RequestUser,
  permissions: readonly string[],
): void {
  if (!userHasAnyPermission(user, permissions)) {
    throw new ForbiddenException(DENY_MESSAGE);
  }
}
