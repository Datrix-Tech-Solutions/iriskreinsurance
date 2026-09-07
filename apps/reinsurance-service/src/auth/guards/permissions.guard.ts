import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';

const DENY_MESSAGE =
  "You don't have permission to access this. Contact your administrator.";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const anyRequiredPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!anyRequiredPermissions || anyRequiredPermissions.length === 0)
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    if (!user) throw new ForbiddenException(DENY_MESSAGE);

    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    const userPermissions = new Set(user.permissions);

    if (
      requiredPermissions?.length &&
      !requiredPermissions.every((permission) =>
        userPermissions.has(permission),
      )
    ) {
      throw new ForbiddenException(DENY_MESSAGE);
    }

    if (
      anyRequiredPermissions?.length &&
      !anyRequiredPermissions.some((permission) =>
        userPermissions.has(permission),
      )
    ) {
      throw new ForbiddenException(DENY_MESSAGE);
    }

    return true;
  }
}
