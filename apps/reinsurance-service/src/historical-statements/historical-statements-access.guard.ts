import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { HistoricalStatementsAccessClient } from './historical-statements-access.client';
import { HistoricalStatementsPermission } from './historical-statements.permissions';

@Injectable()
export class HistoricalStatementsAccessGuard implements CanActivate {
  constructor(
    private readonly client: HistoricalStatementsAccessClient,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    const cookies = request.cookies as Record<string, string> | undefined;
    // Keep selection identical to JwtAuthGuard, including cookie precedence.
    const token =
      cookies?.access_token ||
      request.headers.authorization?.replace('Bearer ', '');
    if (!user?.id || !user.tenantId || !token) {
      throw new UnauthorizedException(
        'Tenant-scoped authentication is required',
      );
    }
    const required = this.reflector.getAllAndOverride<unknown>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      !Array.isArray(required) ||
      required.length === 0 ||
      !required.every(
        (permission: unknown) =>
          permission === HistoricalStatementsPermission.VIEW ||
          permission === HistoricalStatementsPermission.EXPORT,
      )
    ) {
      throw new ForbiddenException('ARCHIVE_PERMISSION_DENIED');
    }
    const access = await this.client.getAccess(token);
    if (access.tenantId !== user.tenantId || access.userId !== user.id) {
      throw new UnauthorizedException('Archive access identity mismatch');
    }
    if (!access.enabled) throw new ForbiddenException('ARCHIVE_NOT_ENABLED');
    if (
      !access.canView ||
      (required.includes(HistoricalStatementsPermission.EXPORT) &&
        !access.canExport)
    ) {
      throw new ForbiddenException('ARCHIVE_PERMISSION_DENIED');
    }
    return true;
  }
}
