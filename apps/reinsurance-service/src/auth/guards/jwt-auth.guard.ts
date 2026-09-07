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

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const cookies = request.cookies as Record<string, string> | undefined;
    const token =
      cookies?.access_token ||
      request.headers.authorization?.replace('Bearer ', '');
    const secret = process.env.JWT_SECRET;

    if (!token) throw new UnauthorizedException('No token provided');
    if (!secret) throw new UnauthorizedException('Authentication unavailable');

    try {
      const payload = jwt.verify(token, secret) as JwtPayload;

      if (!payload.sub || !payload.tenantId) {
        throw new UnauthorizedException(
          'Tenant-scoped authentication is required',
        );
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        tenantName: payload.tenantName ?? '',
        firstName: payload.firstName ?? '',
        moduleConfig: payload.moduleConfig ?? {},
        featureConfig: payload.featureConfig ?? {},
        integrationConfig: payload.integrationConfig ?? {},
        permissions: this.resolvePermissions(request, payload, secret),
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
    const rawPermissions = this.firstHeader(
      request.headers['x-user-permissions'],
    );
    const signature = this.firstHeader(
      request.headers[PERMISSIONS_SIGNATURE_HEADER],
    );

    if (!rawPermissions || !signature) return payload.permissions ?? [];

    const expected = createHmac('sha256', secret)
      .update(`${payload.sub}:${payload.tenantId}:${rawPermissions}`)
      .digest('hex');

    if (!this.matchesSignature(signature, expected)) return [];

    try {
      const permissions: unknown = JSON.parse(rawPermissions);
      return Array.isArray(permissions)
        ? permissions.filter((permission): permission is string => {
            return typeof permission === 'string';
          })
        : [];
    } catch {
      return [];
    }
  }

  private firstHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
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
