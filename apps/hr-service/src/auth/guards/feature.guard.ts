import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';

export const FEATURE_KEY = 'feature';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<{ module: string; feature: string }>(
      FEATURE_KEY,
      context.getHandler(),
    );
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const featureConfig = request.user?.featureConfig;

    if (
      !featureConfig ||
      !featureConfig[required.module] ||
      !featureConfig[required.module][required.feature]
    ) {
      throw new ForbiddenException(
        'This feature is not available on your current plan. Please contact your administrator to upgrade.',
      );
    }

    return true;
  }
}
