import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';

export const FEATURE_KEY = 'feature';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<{
      module: string;
      feature: string;
    }>(FEATURE_KEY, [context.getHandler(), context.getClass()]);

    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();

    if (!request.user?.featureConfig[required.module]?.[required.feature]) {
      throw new ForbiddenException(
        'This feature is not available for your company.',
      );
    }

    return true;
  }
}
