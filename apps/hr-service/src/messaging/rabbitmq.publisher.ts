import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  EventPatterns,
  WithMeta,
  InviteEmployeeEvent,
  EmployeeOffboardedEvent,
  DeactivateEmployeeAccessCommand,
  DeactivateEmployeeAccessResult,
  ResendEmployeeInviteEvent,
  ProvisionEmployeeInviteCommand,
  ProvisionEmployeeInviteResult,
  DeletePendingEmployeeInviteCommand,
  DeletePendingEmployeeInviteResult,
  ResolvePermissionRecipientsCommand,
  PermissionRecipient,
  GetUserStatusesCommand,
  UserStatusSnapshot,
  EmployeeTerminationEvent,
  ResignationSubmittedEvent,
  LeaveRequestedEvent,
  LeaveReviewedEvent,
  LeaveCancelledEvent,
  TimeCorrectionSubmittedEvent,
  AppraisalCycleStartedEvent,
  AppraisalSelfSubmittedEvent,
  AppraisalManagerReviewedEvent,
  AppraisalSelfReminderEvent,
  AppraisalManagerReminderEvent,
  SchedulePublishedEvent,
  ShiftSwapRequestedEvent,
  ShiftSwapPendingManagerEvent,
  ShiftSwapDeclinedEvent,
  ShiftSwapApprovedEvent,
  ShiftSwapRejectedEvent,
  ShiftSwapExpiredEvent,
  AnnouncementPublishedEvent,
  PayrollApprovalRequestedEvent,
  PayrollDecisionEvent,
  InAppNotificationCreateEvent,
} from '@work-phelo/types';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);
  private readonly rmqTimeoutMs = Number(
    process.env.RABBITMQ_RPC_TIMEOUT_MS ?? 10000,
  );

  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
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
      let settled = false;
      const subscription = client.emit(pattern, envelope).subscribe({
        complete: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        },
        error: (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.logger.error(
            `Failed to publish ${pattern} | corrId=${envelope._meta.correlationId}`,
            err,
          );
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      });
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        subscription.unsubscribe();
        const error = new Error(
          `Timed out publishing ${pattern} after ${this.rmqTimeoutMs}ms`,
        );
        this.logger.error(
          `${error.message} | corrId=${envelope._meta.correlationId}`,
        );
        reject(error);
      }, this.rmqTimeoutMs);
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
      let settled = false;
      const subscription = client
        .send<TResult, WithMeta<T>>(pattern, envelope)
        .subscribe({
          next: (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
            subscription.unsubscribe();
          },
          error: (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            this.logger.error(
              `Failed to request ${pattern} | corrId=${envelope._meta.correlationId}`,
              err,
            );
            reject(this.normalizeRpcError(err));
          },
          complete: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(
              new Error(
                `Request ${pattern} completed without a response payload`,
              ),
            );
          },
        });
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        subscription.unsubscribe();
        const error = new Error(
          `Timed out requesting ${pattern} after ${this.rmqTimeoutMs}ms`,
        );
        this.logger.error(
          `${error.message} | corrId=${envelope._meta.correlationId}`,
        );
        reject(error);
      }, this.rmqTimeoutMs);
    });
  }

  // ── HR → Auth ──────────────────────────────────────────────────────────────

  authInviteEmployee(
    data: InviteEmployeeEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.authClient,
      EventPatterns.AUTH_INVITE_EMPLOYEE,
      data,
      correlationId,
    );
  }

  authEmployeeOffboarded(
    data: EmployeeOffboardedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.authClient,
      EventPatterns.AUTH_EMPLOYEE_OFFBOARDED,
      data,
      correlationId,
    );
  }

  authResendEmployeeInvite(
    data: ResendEmployeeInviteEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.authClient,
      EventPatterns.AUTH_RESEND_EMPLOYEE_INVITE,
      data,
      correlationId,
    );
  }

  authProvisionEmployeeInvite(
    data: ProvisionEmployeeInviteCommand,
    correlationId?: string,
  ): Promise<ProvisionEmployeeInviteResult> {
    return this.request(
      this.authClient,
      EventPatterns.AUTH_PROVISION_EMPLOYEE_INVITE,
      data,
      correlationId,
    );
  }

  authDeletePendingEmployeeInvite(
    data: DeletePendingEmployeeInviteCommand,
    correlationId?: string,
  ): Promise<DeletePendingEmployeeInviteResult> {
    return this.request(
      this.authClient,
      EventPatterns.AUTH_DELETE_PENDING_EMPLOYEE_INVITE,
      data,
      correlationId,
    );
  }

  authDeactivateEmployeeAccess(
    data: DeactivateEmployeeAccessCommand,
    correlationId?: string,
  ): Promise<DeactivateEmployeeAccessResult> {
    return this.request(
      this.authClient,
      EventPatterns.AUTH_DEACTIVATE_EMPLOYEE_ACCESS,
      data,
      correlationId,
    );
  }

  authResolvePermissionRecipients(
    data: ResolvePermissionRecipientsCommand,
    correlationId?: string,
  ): Promise<PermissionRecipient[]> {
    return this.request(
      this.authClient,
      EventPatterns.AUTH_RESOLVE_PERMISSION_RECIPIENTS,
      data,
      correlationId,
    );
  }

  authGetUserStatuses(
    data: GetUserStatusesCommand,
    correlationId?: string,
  ): Promise<UserStatusSnapshot[]> {
    return this.request(
      this.authClient,
      EventPatterns.AUTH_GET_USER_STATUSES,
      data,
      correlationId,
    );
  }

  // ── HR → Notification ──────────────────────────────────────────────────────

  notificationInAppCreate(
    data: InAppNotificationCreateEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFICATION_IN_APP_CREATE,
      data,
      correlationId,
    );
  }

  async notificationInAppCreateMany(
    notifications: InAppNotificationCreateEvent[],
    correlationId?: string,
  ): Promise<void> {
    await Promise.all(
      notifications.map((notification) =>
        this.notificationInAppCreate(notification, correlationId),
      ),
    );
  }

  notificationEmployeeTermination(
    data: EmployeeTerminationEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_EMPLOYEE_TERMINATION,
      data,
      correlationId,
    );
  }

  notificationAnnouncementPublished(
    data: AnnouncementPublishedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_ANNOUNCEMENT_PUBLISHED,
      data,
      correlationId,
    );
  }

  notificationResignationSubmitted(
    data: ResignationSubmittedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_RESIGNATION_SUBMITTED,
      data,
      correlationId,
    );
  }

  notificationLeaveRequested(
    data: LeaveRequestedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_LEAVE_REQUESTED,
      data,
      correlationId,
    );
  }

  notificationLeaveReviewed(
    data: LeaveReviewedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_LEAVE_REVIEWED,
      data,
      correlationId,
    );
  }

  notificationLeaveCancelled(
    data: LeaveCancelledEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_LEAVE_CANCELLED,
      data,
      correlationId,
    );
  }

  notificationTimeCorrectionSubmitted(
    data: TimeCorrectionSubmittedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_TIME_CORRECTION_SUBMITTED,
      data,
      correlationId,
    );
  }

  notificationAppraisalCycleStarted(
    data: AppraisalCycleStartedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_APPRAISAL_CYCLE_STARTED,
      data,
      correlationId,
    );
  }

  notificationAppraisalSelfSubmitted(
    data: AppraisalSelfSubmittedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_APPRAISAL_SELF_SUBMITTED,
      data,
      correlationId,
    );
  }

  notificationAppraisalManagerReviewed(
    data: AppraisalManagerReviewedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_APPRAISAL_MANAGER_REVIEWED,
      data,
      correlationId,
    );
  }

  notificationAppraisalSelfReminder(
    data: AppraisalSelfReminderEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_APPRAISAL_SELF_REMINDER,
      data,
      correlationId,
    );
  }

  notificationAppraisalManagerReminder(
    data: AppraisalManagerReminderEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_APPRAISAL_MANAGER_REMINDER,
      data,
      correlationId,
    );
  }

  notificationSchedulePublished(
    data: SchedulePublishedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_SCHEDULE_PUBLISHED,
      data,
      correlationId,
    );
  }

  notificationShiftSwapRequested(
    data: ShiftSwapRequestedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_SHIFT_SWAP_REQUESTED,
      data,
      correlationId,
    );
  }

  notificationShiftSwapPendingManager(
    data: ShiftSwapPendingManagerEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_SHIFT_SWAP_PENDING_MANAGER,
      data,
      correlationId,
    );
  }

  notificationShiftSwapDeclined(
    data: ShiftSwapDeclinedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_SHIFT_SWAP_DECLINED,
      data,
      correlationId,
    );
  }

  notificationShiftSwapApproved(
    data: ShiftSwapApprovedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_SHIFT_SWAP_APPROVED,
      data,
      correlationId,
    );
  }

  notificationShiftSwapRejected(
    data: ShiftSwapRejectedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_SHIFT_SWAP_REJECTED,
      data,
      correlationId,
    );
  }

  notificationShiftSwapExpired(
    data: ShiftSwapExpiredEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_SHIFT_SWAP_EXPIRED,
      data,
      correlationId,
    );
  }

  notificationPayrollApprovalRequested(
    data: PayrollApprovalRequestedEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_PAYROLL_APPROVAL_REQUESTED,
      data,
      correlationId,
    );
  }

  notificationPayrollDecision(
    data: PayrollDecisionEvent,
    correlationId?: string,
  ): Promise<void> {
    return this.publish(
      this.notificationClient,
      EventPatterns.NOTIFY_PAYROLL_DECISION,
      data,
      correlationId,
    );
  }
}
