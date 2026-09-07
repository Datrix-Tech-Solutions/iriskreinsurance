import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';

export const MODULE_KEY = 'module';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModule = this.reflector.get<string>(
      MODULE_KEY,
      context.getHandler(),
    );
    if (!requiredModule) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const moduleConfig = request.user?.moduleConfig;

    if (!moduleConfig || !moduleConfig[requiredModule]) {
      throw new ForbiddenException(
        'This module is not available for your company. Please contact your platform administrator.',
      );
    }

    return true;
  }
}
