import { createHmac, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedInternalRequest extends Request {
  internalServiceName: string;
}

export const INTERNAL_SERVICE_AUTH_HEADERS = {
  service: 'x-workphelo-service',
  timestamp: 'x-workphelo-timestamp',
  signature: 'x-workphelo-signature',
} as const;

const DEFAULT_MAX_CLOCK_SKEW_SECONDS = 300;

@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const serviceName = this.header(
      request,
      INTERNAL_SERVICE_AUTH_HEADERS.service,
    );
    const timestamp = this.header(
      request,
      INTERNAL_SERVICE_AUTH_HEADERS.timestamp,
    );
    const signature = this.header(
      request,
      INTERNAL_SERVICE_AUTH_HEADERS.signature,
    );
    const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();

    if (
      !serviceName ||
      !timestamp ||
      !signature ||
      !secret ||
      secret.length < 32 ||
      !this.isAllowedService(serviceName) ||
      !this.isFreshTimestamp(timestamp)
    ) {
      throw new UnauthorizedException('Invalid internal service credentials.');
    }

    const path = request.originalUrl.split('?')[0];
    const payload = [
      serviceName,
      timestamp,
      request.method.toUpperCase(),
      path,
    ].join(':');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    if (!this.signaturesMatch(expected, signature)) {
      throw new UnauthorizedException('Invalid internal service credentials.');
    }

    (request as AuthenticatedInternalRequest).internalServiceName = serviceName;
    return true;
  }

  private header(request: Request, name: string): string {
    const value = request.headers[name];
    return Array.isArray(value)
      ? (value[0]?.trim() ?? '')
      : value?.trim() || '';
  }

  private isAllowedService(serviceName: string): boolean {
    const allowedServices = (
      process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES || ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return allowedServices.includes(serviceName);
  }

  private isFreshTimestamp(timestamp: string): boolean {
    if (!/^\d+$/.test(timestamp)) return false;
    const timestampSeconds = Number(timestamp);
    const maxClockSkewSeconds = this.positiveInteger(
      process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS,
      DEFAULT_MAX_CLOCK_SKEW_SECONDS,
    );
    return (
      Number.isSafeInteger(timestampSeconds) &&
      Math.abs(Date.now() - timestampSeconds * 1000) <=
        maxClockSkewSeconds * 1000
    );
  }

  private signaturesMatch(expected: string, supplied: string): boolean {
    if (!/^[a-f\d]{64}$/i.test(supplied)) return false;
    const expectedBuffer = Buffer.from(expected, 'hex');
    const suppliedBuffer = Buffer.from(supplied, 'hex');
    return (
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer)
    );
  }

  private positiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
