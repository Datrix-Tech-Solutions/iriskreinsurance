import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';

export const MODULE_KEY = 'module';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();

    if (!request.user?.moduleConfig[requiredModule]) {
      throw new ForbiddenException(
        'This module is not available for your company.',
      );
    }

    return true;
  }
}
