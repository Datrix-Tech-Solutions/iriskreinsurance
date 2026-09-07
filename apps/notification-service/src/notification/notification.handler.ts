import { Controller, HttpException, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { NotificationService } from './notification.service';
import {
  WithMeta,
  EmailVerificationEvent,
  InviteUserEvent,
  PasswordResetLinkEvent,
  PasswordResetOtpEvent,
  SmsOtpEvent,
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
  EventPatterns,
} from '@work-phelo/types';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';

@Controller()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly inAppNotifications: InAppNotificationsService,
  ) {}

  private ack(context: RmqContext) {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;
    channel.ack(message);
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private shouldRequeue(error: unknown) {
    if (error instanceof HttpException) {
      return false;
    }

    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;

    return !['P2002', 'P2003', 'P2014', 'P2025'].includes(code ?? '');
  }

  private settleFailure(
    context: RmqContext,
    pattern: string,
    error: unknown,
    details: string,
  ) {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (this.shouldRequeue(error)) {
      this.logger.error(
        `[${pattern}] Transient failure — requeueing | ${details} | error=${this.formatError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      channel.nack(message, false, true);
      return;
    }

    this.logger.warn(
      `[${pattern}] Permanent failure — acknowledging | ${details} | error=${this.formatError(error)}`,
    );
    channel.ack(message);
  }

  @EventPattern(EventPatterns.NOTIFICATION_IN_APP_CREATE)
  async handleInAppCreate(
    @Payload() data: WithMeta<InAppNotificationCreateEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[${EventPatterns.NOTIFICATION_IN_APP_CREATE}] Received | tenant=${data.tenantId} | recipient=${data.recipientUserId} | type=${data.type} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.inAppNotifications.create({
        ...data,
        eventId: data.eventId ?? data._meta?.messageId,
      });
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        EventPatterns.NOTIFICATION_IN_APP_CREATE,
        err,
        `tenant=${data.tenantId} | recipient=${data.recipientUserId} | type=${data.type} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.email_verification')
  async handleEmailVerification(
    @Payload() data: WithMeta<EmailVerificationEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.email_verification] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendEmailVerification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.email_verification',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.invite_user')
  async handleInviteUser(
    @Payload() data: WithMeta<InviteUserEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.invite_user] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendInvite(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.invite_user',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.password_reset_link')
  async handlePasswordResetLink(
    @Payload() data: WithMeta<PasswordResetLinkEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.password_reset_link] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPasswordResetLink(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.password_reset_link',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.password_reset_otp')
  async handlePasswordResetOtp(
    @Payload() data: WithMeta<PasswordResetOtpEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.password_reset_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPasswordResetOtp(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.password_reset_otp',
        err,
        `phone=${data.phone} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.employee_termination')
  async handleEmployeeTermination(
    @Payload() data: WithMeta<EmployeeTerminationEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.employee_termination] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendTerminationNotice(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.employee_termination',
        err,
        `email=${data.email} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.resignation_submitted')
  async handleResignationSubmitted(
    @Payload() data: WithMeta<ResignationSubmittedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.resignation_submitted] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | adminEmail=${data.adminEmail} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendResignationSubmittedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.resignation_submitted',
        err,
        `adminEmail=${data.adminEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notification.sms_otp')
  async handleSmsOtp(
    @Payload() data: WithMeta<SmsOtpEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notification.sms_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendSmsOtp(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notification.sms_otp',
        err,
        `phone=${data.phone} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.leave_requested')
  async handleLeaveRequested(
    @Payload() data: WithMeta<LeaveRequestedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.leave_requested] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.managerEmail) {
      this.ack(context);
      return;
    }
    try {
      await this.notificationService.sendLeaveRequestedNotification({
        ...data,
        managerEmail: data.managerEmail,
      });
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.leave_requested',
        err,
        `managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.leave_reviewed')
  async handleLeaveReviewed(
    @Payload() data: WithMeta<LeaveReviewedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.leave_reviewed] Received | email=${data.employeeEmail} | status=${data.status} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendLeaveReviewedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.leave_reviewed',
        err,
        `email=${data.employeeEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.leave_cancelled')
  async handleLeaveCancelled(
    @Payload() data: WithMeta<LeaveCancelledEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.leave_cancelled] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.managerEmail) {
      this.ack(context);
      return;
    }
    try {
      await this.notificationService.sendLeaveCancelledNotification({
        ...data,
        managerEmail: data.managerEmail,
      });
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.leave_cancelled',
        err,
        `managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.time_correction_submitted')
  async handleTimeCorrectionSubmitted(
    @Payload() data: WithMeta<TimeCorrectionSubmittedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.time_correction_submitted] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | adminEmail=${data.adminEmail} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.adminEmail && !data.managerEmail) {
      this.logger.warn(
        `[notify.time_correction_submitted] No recipients available for correction ${data.correctionId} — acking without sending`,
      );
      this.ack(context);
      return;
    }
    try {
      await this.notificationService.sendTimeCorrectionSubmittedNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.time_correction_submitted',
        err,
        `correctionId=${data.correctionId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.appraisal_self_submitted')
  async handleAppraisalSelfSubmitted(
    @Payload() data: WithMeta<AppraisalSelfSubmittedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.appraisal_self_submitted] Received | employee=${data.employeeFirstName} ${data.employeeLastName} | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    if (!data.managerEmail) {
      this.logger.warn(
        `[notify.appraisal_self_submitted] No manager email for appraisal ${data.appraisalId} — acking without sending`,
      );
      this.ack(context);
      return;
    }
    try {
      await this.notificationService.sendAppraisalSelfSubmittedNotification({
        ...data,
        managerEmail: data.managerEmail,
        managerFirstName: data.managerFirstName ?? 'Manager',
      });
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.appraisal_self_submitted',
        err,
        `appraisalId=${data.appraisalId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.appraisal_cycle_started')
  async handleAppraisalCycleStarted(
    @Payload() data: WithMeta<AppraisalCycleStartedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.appraisal_cycle_started] Received | employeeEmail=${data.employeeEmail} | cycleId=${data.cycleId} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendAppraisalCycleStartedNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.appraisal_cycle_started',
        err,
        `appraisalId=${data.appraisalId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.appraisal_manager_reviewed')
  async handleAppraisalManagerReviewed(
    @Payload() data: WithMeta<AppraisalManagerReviewedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.appraisal_manager_reviewed] Received | employeeEmail=${data.employeeEmail} | finalScore=${data.finalScore} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendAppraisalManagerReviewedNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.appraisal_manager_reviewed',
        err,
        `appraisalId=${data.appraisalId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.appraisal_self_reminder')
  async handleAppraisalSelfReminder(
    @Payload() data: WithMeta<AppraisalSelfReminderEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.appraisal_self_reminder] Received | employeeEmail=${data.employeeEmail} | daysRemaining=${data.daysRemaining} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendAppraisalSelfReminderNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.appraisal_self_reminder',
        err,
        `appraisalId=${data.appraisalId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.appraisal_manager_reminder')
  async handleAppraisalManagerReminder(
    @Payload() data: WithMeta<AppraisalManagerReminderEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.appraisal_manager_reminder] Received | managerEmail=${data.managerEmail} | daysRemaining=${data.daysRemaining} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendAppraisalManagerReminderNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.appraisal_manager_reminder',
        err,
        `appraisalId=${data.appraisalId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.schedule_published')
  async handleSchedulePublished(
    @Payload() data: WithMeta<SchedulePublishedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.schedule_published] Received | employeeEmail=${data.employeeEmail} | effectiveFrom=${data.effectiveFrom} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendSchedulePublishedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.schedule_published',
        err,
        `employeeId=${data.employeeId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.shift_swap_requested')
  async handleShiftSwapRequested(
    @Payload() data: WithMeta<ShiftSwapRequestedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.shift_swap_requested] Received | email=${data.recipientEmail} | role=${data.recipientRole} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendShiftSwapRequestedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.shift_swap_requested',
        err,
        `shiftSwapId=${data.shiftSwapId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.shift_swap_pending_manager')
  async handleShiftSwapPendingManager(
    @Payload() data: WithMeta<ShiftSwapPendingManagerEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.shift_swap_pending_manager] Received | managerEmail=${data.managerEmail} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendShiftSwapPendingManagerNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.shift_swap_pending_manager',
        err,
        `shiftSwapId=${data.shiftSwapId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.shift_swap_declined')
  async handleShiftSwapDeclined(
    @Payload() data: WithMeta<ShiftSwapDeclinedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.shift_swap_declined] Received | email=${data.employeeEmail} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendShiftSwapDeclinedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.shift_swap_declined',
        err,
        `shiftSwapId=${data.shiftSwapId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.shift_swap_approved')
  async handleShiftSwapApproved(
    @Payload() data: WithMeta<ShiftSwapApprovedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.shift_swap_approved] Received | email=${data.employeeEmail} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendShiftSwapApprovedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.shift_swap_approved',
        err,
        `shiftSwapId=${data.shiftSwapId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.shift_swap_rejected')
  async handleShiftSwapRejected(
    @Payload() data: WithMeta<ShiftSwapRejectedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.shift_swap_rejected] Received | email=${data.employeeEmail} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendShiftSwapRejectedNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.shift_swap_rejected',
        err,
        `shiftSwapId=${data.shiftSwapId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.shift_swap_expired')
  async handleShiftSwapExpired(
    @Payload() data: WithMeta<ShiftSwapExpiredEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.shift_swap_expired] Received | email=${data.employeeEmail} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendShiftSwapExpiredNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.shift_swap_expired',
        err,
        `shiftSwapId=${data.shiftSwapId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.announcement_published')
  async handleAnnouncementPublished(
    @Payload() data: WithMeta<AnnouncementPublishedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.announcement_published] Received | announcementId=${data.announcementId} | recipients=${data.recipients.length} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendAnnouncementPublishedNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.announcement_published',
        err,
        `announcementId=${data.announcementId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.payroll_approval_requested')
  async handlePayrollApprovalRequested(
    @Payload() data: WithMeta<PayrollApprovalRequestedEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.payroll_approval_requested] Received | payrollRunId=${data.payrollRunId} | recipients=${data.recipients.length} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPayrollApprovalRequestedNotification(
        data,
      );
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.payroll_approval_requested',
        err,
        `payrollRunId=${data.payrollRunId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }

  @EventPattern('notify.payroll_decision')
  async handlePayrollDecision(
    @Payload() data: WithMeta<PayrollDecisionEvent>,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[notify.payroll_decision] Received | payrollRunId=${data.payrollRunId} | decision=${data.decision} | recipients=${data.recipients.length} | corrId=${data._meta?.correlationId}`,
    );
    try {
      await this.notificationService.sendPayrollDecisionNotification(data);
      this.ack(context);
    } catch (err) {
      this.settleFailure(
        context,
        'notify.payroll_decision',
        err,
        `payrollRunId=${data.payrollRunId} | corrId=${data._meta?.correlationId}`,
      );
    }
  }
}
