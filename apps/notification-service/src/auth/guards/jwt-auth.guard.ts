import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwtPayload, RequestUser } from '@work-phelo/types';

const PERMISSIONS_SIGNATURE_HEADER = 'x-gateway-permissions-signature';

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCookieToken(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('access_token='))
    ?.slice('access_token='.length);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();

    const token =
      parseCookieToken(firstHeader(request.headers.cookie)) ||
      firstHeader(request.headers.authorization)?.replace('Bearer ', '');

    if (!token) throw new UnauthorizedException('No token provided');
    if (!process.env.JWT_SECRET) {
      throw new UnauthorizedException('Notification auth is not configured');
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
      if (!payload.sub || !payload.tenantId) {
        throw new UnauthorizedException(
          'Invalid gateway authorization context',
        );
      }
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        tenantName:
          firstHeader(request.headers['x-tenant-name']) ??
          payload.tenantName ??
          '',
        firstName:
          firstHeader(request.headers['x-user-first-name']) ??
          payload.firstName ??
          '',
        moduleConfig: payload.moduleConfig ?? {},
        featureConfig: payload.featureConfig ?? {},
        permissions: this.resolvePermissions(
          request,
          payload,
          process.env.JWT_SECRET,
        ),
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private resolvePermissions(
    request: Request,
    payload: JwtPayload,
    secret: string,
  ): string[] {
    const rawPermissions = firstHeader(request.headers['x-user-permissions']);
    const signature = firstHeader(
      request.headers[PERMISSIONS_SIGNATURE_HEADER],
    );

    if (!rawPermissions && !signature) return payload.permissions ?? [];
    if (!rawPermissions || !signature) {
      throw new UnauthorizedException('Invalid gateway authorization context');
    }

    const expected = createHmac('sha256', secret)
      .update(`${payload.sub}:${payload.tenantId}:${rawPermissions}`)
      .digest('hex');

    if (!this.matchesSignature(signature, expected)) {
      throw new UnauthorizedException('Invalid gateway authorization context');
    }

    try {
      const permissions: unknown = JSON.parse(rawPermissions);
      if (
        !Array.isArray(permissions) ||
        !permissions.every((permission) => typeof permission === 'string')
      ) {
        throw new UnauthorizedException(
          'Invalid gateway authorization context',
        );
      }
      return permissions;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid gateway authorization context');
    }
  }

  private matchesSignature(signature: string, expected: string): boolean {
    const supplied = Buffer.from(signature);
    const calculated = Buffer.from(expected);
    return (
      supplied.length === calculated.length &&
      timingSafeEqual(supplied, calculated)
    );
  }
}
