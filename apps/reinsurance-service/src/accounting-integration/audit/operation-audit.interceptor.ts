import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { ReinsuranceAccountingOperationAuditPublisher } from './operation-audit.publisher';

@Injectable()
export class ReinsuranceAccountingOperationAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: ReinsuranceAccountingOperationAuditPublisher,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: RequestUser }>();
    const user = request.user;
    return next.handle().pipe(
      tap((result: unknown) => {
        this.audit.executed({
          tenantId: user.tenantId,
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          operation: request.path,
          resourceId: this.stringParam(request.params.counterpartyId),
          changes: {
            dryRun: request.query.dryRun === 'true',
            processedCount: this.numberProperty(result, 'processedCount'),
            enqueuedCount: this.numberProperty(result, 'enqueuedCount'),
            status: this.stringProperty(result, 'status'),
          },
        });
      }),
    );
  }

  private numberProperty(value: unknown, key: string): number | undefined {
    const candidate = value as Record<string, unknown> | undefined;
    return typeof candidate?.[key] === 'number' ? candidate[key] : undefined;
  }

  private stringProperty(value: unknown, key: string): string | undefined {
    const candidate = value as Record<string, unknown> | undefined;
    return typeof candidate?.[key] === 'string' ? candidate[key] : undefined;
  }

  private stringParam(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
