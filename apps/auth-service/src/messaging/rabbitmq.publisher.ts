import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  WithMeta,
  TenantApprovedEvent,
  EmployeeActivatedEvent,
  ProvisionTenantWorkspaceCommand,
  ProvisionTenantWorkspaceResult,
  LinkEmployeeIdentityCommand,
  LinkEmployeeIdentityResult,
  EmailVerificationEvent,
  InviteUserEvent,
  PasswordResetLinkEvent,
  PasswordResetOtpEvent,
  SmsOtpEvent,
} from '@work-phelo/types';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('HR_SERVICE') private readonly hrClient: ClientProxy,
  ) {}

  private normalizeRpcError(err: unknown): Error & {
    statusCode?: number;
    error?: string;
  } {
    if (err instanceof Error) {
      return err;
    }

    const remote =
      err && typeof err === 'object' && 'message' in err
        ? (err as {
            message?: unknown;
            statusCode?: unknown;
            error?: unknown;
          })
        : undefined;

    const payload =
      remote?.message &&
      typeof remote.message === 'object' &&
      !Array.isArray(remote.message)
        ? (remote.message as {
            message?: unknown;
            statusCode?: unknown;
            error?: unknown;
          })
        : remote;

    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof remote?.message === 'string'
          ? remote.message
          : String(err);
    const wrapped = new Error(message) as Error & {
      statusCode?: number;
      error?: string;
    };

    if (typeof payload?.statusCode === 'number') {
      wrapped.statusCode = payload.statusCode;
    } else if (typeof remote?.statusCode === 'number') {
      wrapped.statusCode = remote.statusCode;
    }

    if (typeof payload?.error === 'string') {
      wrapped.error = payload.error;
    } else if (typeof remote?.error === 'string') {
      wrapped.error = remote.error;
    }

    return wrapped;
  }

  private formatPublishError(err: unknown): string {
    if (err instanceof Error) {
      return `${err.name}: ${err.message}`;
    }

    if (err && typeof err === 'object') {
      const details = err as {
        message?: unknown;
        code?: unknown;
        errno?: unknown;
        syscall?: unknown;
      };
      const parts = [
        typeof details.message === 'string' ? details.message : undefined,
        typeof details.code === 'string' ? `code=${details.code}` : undefined,
        typeof details.errno === 'string' || typeof details.errno === 'number'
          ? `errno=${details.errno}`
          : undefined,
        typeof details.syscall === 'string'
          ? `syscall=${details.syscall}`
          : undefined,
      ].filter(Boolean);

      return parts.length > 0 ? parts.join(' | ') : JSON.stringify(err);
    }

    return String(err);
  }

  // ── Internal publish ───────────────────────────────────────────────────────

  private publish<T extends object>(
    client: ClientProxy,
    pattern: string,
    data: T,
    correlationId?: string,
  ): Promise<void> {
    const envelope: WithMeta<T> = {
      ...data,
      _meta: {
        messageId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.log(
      `Publishing ${pattern} | msgId=${envelope._meta.messageId} | corrId=${envelope._meta.correlationId}`,
    );

    return new Promise((resolve, reject) => {
      client.emit(pattern, envelope).subscribe({
        complete: () => resolve(),
        error: (err) => {
          this.logger.error(
            `Failed to publish ${pattern} | corrId=${envelope._meta.correlationId} | error=${this.formatPublishError(err)}`,
            err,
          );
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      });
    });
  }

  private request<T extends object, TResult>(
    client: ClientProxy,
    pattern: string,
    data: T,
    correlationId?: string,
  ): Promise<TResult> {
    const envelope: WithMeta<T> = {
      ...data,
      _meta: {
        messageId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.log(
      `Requesting ${pattern} | msgId=${envelope._meta.messageId} | corrId=${envelope._meta.correlationId}`,
    );

    return new Promise<TResult>((resolve, reject) => {
      client.send<TResult, WithMeta<T>>(pattern, envelope).subscribe({
        next: (result) => resolve(result),
        error: (err) => {
          this.logger.error(
            `Failed to request ${pattern} | corrId=${envelope._meta.correlationId}`,
            err,
          );
          reject(this.normalizeRpcError(err));
        },
      });
    });
  }

  // ── Auth → HR ──────────────────────────────────────────────────────────────

  hrTenantApproved(
    data: TenantApprovedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.hrClient,
      EventPatterns.HR_TENANT_APPROVED,
      data,
      correlationId,
    );
  }

  hrEmployeeActivated(
    data: EmployeeActivatedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.hrClient,
      EventPatterns.HR_EMPLOYEE_ACTIVATED,
      data,
      correlationId,
    );
  }

  hrProvisionTenantWorkspace(
    data: ProvisionTenantWorkspaceCommand,
    correlationId?: string,
  ): Promise<ProvisionTenantWorkspaceResult> {
    return this.request(
      this.hrClient,
      EventPatterns.HR_PROVISION_TENANT_WORKSPACE,
      data,
      correlationId,
    );
  }

  hrLinkEmployeeIdentity(
    data: LinkEmployeeIdentityCommand,
    correlationId?: string,
  ): Promise<LinkEmployeeIdentityResult> {
    return this.request(
      this.hrClient,
      EventPatterns.HR_LINK_EMPLOYEE_IDENTITY,
      data,
      correlationId,
    );
  }

  // ── Auth → Notification ────────────────────────────────────────────────────

  notificationEmailVerification(
    data: EmailVerificationEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_EMAIL_VERIFICATION,
      data,
      correlationId,
    );
  }

  notificationInviteUser(
    data: InviteUserEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_INVITE_USER,
      data,
      correlationId,
    );
  }

  notificationPasswordResetLink(
    data: PasswordResetLinkEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_PASSWORD_RESET_LINK,
      data,
      correlationId,
    );
  }

  notificationPasswordResetOtp(
    data: PasswordResetOtpEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_PASSWORD_RESET_OTP,
      data,
      correlationId,
    );
  }

  notificationSmsOtp(data: SmsOtpEvent, correlationId?: string): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_SMS_OTP,
      data,
      correlationId,
    );
  }
}
