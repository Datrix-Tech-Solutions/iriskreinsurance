import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '../../prisma/generated/client';
import { AnnouncementDeliveryChannel, InviteUserKind } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import type { SmsSendResult } from '../channels/sms-provider.interface';
import { formatAnnouncementSms } from './announcement-sms.formatter';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  private shouldDeliverAnnouncementChannel(
    channels: AnnouncementDeliveryChannel[] | undefined,
    channel: Extract<AnnouncementDeliveryChannel, 'EMAIL' | 'SMS'>,
  ): boolean {
    if (!channels || channels.length === 0) {
      return channel === 'EMAIL';
    }

    return channels.includes(channel);
  }

  private async isDuplicate(
    recipient: string,
    type: NotificationType,
    tenantId?: string,
  ): Promise<boolean> {
    const since = new Date(Date.now() - 2 * 60 * 1000);
    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        recipient,
        type,
        tenantId: tenantId ?? 'system',
        status: 'SENT',
        sentAt: { gt: since },
      },
    });
    return !!existing;
  }

  async sendEmailVerification(data: {
    userId?: string;
    tenantId?: string;
    email: string;
    firstName: string;
    otp: string;
    tenantName?: string;
  }) {
    if (
      await this.isDuplicate(
        data.email,
        NotificationType.EMAIL_VERIFICATION,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate EMAIL_VERIFICATION suppressed for ${data.email}`,
      );
      return;
    }
    const success = await this.email.sendEmailVerificationOtp(
      data.email,
      data.firstName,
      data.otp,
    );
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'EMAIL_VERIFICATION',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Verify your email',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendInvite(data: {
    userId?: string;
    tenantId?: string;
    email: string;
    firstName: string;
    inviteToken?: string;
    acceptInviteUrl: string;
    tenantName: string;
    inviteKind?: InviteUserKind;
    isResend?: boolean;
  }) {
    if (
      !data.isResend &&
      (await this.isDuplicate(
        data.email,
        NotificationType.INVITE_USER,
        data.tenantId,
      ))
    ) {
      this.logger.warn(`Duplicate INVITE_USER suppressed for ${data.email}`);
      return;
    }
    const isTenantAdminInvite = data.inviteKind === 'TENANT_ADMIN';
    const success = isTenantAdminInvite
      ? await this.email.sendTenantAdminWelcomeEmail(
          data.email,
          data.firstName,
          data.tenantName,
          data.acceptInviteUrl,
        )
      : await this.email.sendEmployeeInviteEmail(
          data.email,
          data.firstName,
          data.tenantName,
          data.acceptInviteUrl,
        );
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'INVITE_USER',
      channel: 'EMAIL',
      recipient: data.email,
      subject: isTenantAdminInvite
        ? `Welcome to ${data.tenantName}`
        : `Invitation to ${data.tenantName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendPasswordResetLink(data: {
    userId?: string;
    tenantId?: string;
    email: string;
    firstName: string;
    resetLink: string;
    tenantName?: string;
  }) {
    if (
      await this.isDuplicate(
        data.email,
        NotificationType.PASSWORD_RESET_LINK,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate PASSWORD_RESET_LINK suppressed for ${data.email}`,
      );
      return;
    }
    const success = await this.email.sendPasswordResetLink(
      data.email,
      data.firstName,
      data.resetLink,
    );
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'PASSWORD_RESET_LINK',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Reset your password',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendPasswordResetOtp(data: {
    userId?: string;
    tenantId?: string;
    phone?: string;
    email?: string;
    firstName: string;
    otp: string;
  }) {
    const recipient = data.email ?? data.phone ?? 'unknown';
    if (
      await this.isDuplicate(
        recipient,
        NotificationType.PASSWORD_RESET_OTP,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate PASSWORD_RESET_OTP suppressed for ${recipient}`,
      );
      return;
    }
    const success = data.email
      ? await this.email.sendPasswordResetLink(
          data.email,
          data.firstName,
          data.otp,
        )
      : false;
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'PASSWORD_RESET_OTP',
      channel: 'EMAIL',
      recipient,
      subject: 'Password reset code',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendTerminationNotice(data: {
    tenantId: string;
    employeeId: string;
    email: string;
    firstName: string;
    lastName: string;
    reason: string;
    lastWorkingDate: string;
    platformLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.email,
        NotificationType.EMPLOYEE_TERMINATION,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate EMPLOYEE_TERMINATION suppressed for ${data.email}`,
      );
      return;
    }
    const success = await this.email.sendTerminationNotice(
      data.email,
      data.firstName,
      data.lastName,
      data.reason,
      data.lastWorkingDate,
      data.platformLink,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'EMPLOYEE_TERMINATION',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Important notice regarding your employment',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendResignationSubmittedNotification(data: {
    tenantId: string;
    adminEmail: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    lastWorkingDate: string;
    reason?: string;
    additionalNotes?: string;
    detailLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.adminEmail,
        NotificationType.RESIGNATION_SUBMITTED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate RESIGNATION_SUBMITTED suppressed for ${data.adminEmail}`,
      );
      return;
    }

    const success = await this.email.sendResignationSubmittedNotification(
      data.adminEmail,
      data.employeeFirstName,
      data.employeeLastName,
      data.lastWorkingDate,
      data.reason,
      data.additionalNotes,
      data.detailLink,
    );

    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'RESIGNATION_SUBMITTED',
      channel: 'EMAIL',
      recipient: data.adminEmail,
      subject: `Resignation submitted by ${data.employeeFirstName} ${data.employeeLastName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendAnnouncementPublishedNotification(data: {
    tenantId: string;
    announcementId: string;
    tenantName?: string;
    title: string;
    body: string;
    publishedAt: string;
    deliveryChannels?: AnnouncementDeliveryChannel[];
    platformLink?: string;
    recipients: {
      employeeId: string;
      userId: string;
      email: string;
      phone?: string;
      firstName: string;
      lastName: string;
    }[];
  }) {
    const shouldSendEmail = this.shouldDeliverAnnouncementChannel(
      data.deliveryChannels,
      'EMAIL',
    );
    const shouldSendSms = this.shouldDeliverAnnouncementChannel(
      data.deliveryChannels,
      'SMS',
    );

    if (data.recipients.length === 0) {
      this.logger.warn(
        `[ANNOUNCEMENT_PUBLISHED] No recipients resolved for announcement ${data.announcementId} in tenant ${data.tenantId}`,
      );
      const channelsToSkip = [
        shouldSendEmail ? 'EMAIL' : null,
        shouldSendSms ? 'SMS' : null,
      ].filter((channel): channel is 'EMAIL' | 'SMS' => channel !== null);

      await Promise.all(
        channelsToSkip.map((channel) =>
          this.log({
            userId: undefined,
            tenantId: data.tenantId,
            type: 'ANNOUNCEMENT_PUBLISHED',
            channel,
            recipient: `announcement:${data.announcementId}`,
            subject: data.title,
            status: 'SKIPPED',
            metadata: {
              announcementId: data.announcementId,
              reason: 'NO_RECIPIENTS',
            },
          }),
        ),
      );
      return;
    }

    const emailTasks = shouldSendEmail
      ? data.recipients.map(async (recipient) => {
          const success =
            await this.email.sendAnnouncementPublishedNotification(
              recipient.email,
              recipient.firstName,
              data.title,
              data.body,
              data.publishedAt,
              data.platformLink,
            );

          await this.log({
            userId: recipient.userId,
            tenantId: data.tenantId,
            type: 'ANNOUNCEMENT_PUBLISHED',
            channel: 'EMAIL',
            recipient: recipient.email,
            subject: data.title,
            status: success ? 'SENT' : 'FAILED',
            metadata: {
              announcementId: data.announcementId,
              employeeId: recipient.employeeId,
            },
          });
        })
      : [];

    const smsMessage = formatAnnouncementSms({
      companyName: data.tenantName,
      title: data.title,
      body: data.body,
    });
    const smsTasks = shouldSendSms
      ? data.recipients.map(async (recipient) => {
          if (!recipient.phone) {
            await this.log({
              userId: recipient.userId,
              tenantId: data.tenantId,
              type: 'ANNOUNCEMENT_PUBLISHED',
              channel: 'SMS',
              recipient: recipient.email,
              subject: data.title,
              status: 'SKIPPED',
              metadata: {
                announcementId: data.announcementId,
                employeeId: recipient.employeeId,
                reason: 'MISSING_PHONE',
              },
            });
            return;
          }

          const smsResult = await this.sms.sendMessage(
            recipient.phone,
            smsMessage,
          );

          await this.log({
            userId: recipient.userId,
            tenantId: data.tenantId,
            type: 'ANNOUNCEMENT_PUBLISHED',
            channel: 'SMS',
            recipient: recipient.phone,
            subject: data.title,
            status: smsResult.status,
            error: smsResult.error,
            metadata: {
              announcementId: data.announcementId,
              employeeId: recipient.employeeId,
              ...this.smsProviderMetadata(smsResult),
            },
          });
        })
      : [];

    await Promise.all([...emailTasks, ...smsTasks]);
  }

  async sendPayrollApprovalRequestedNotification(data: {
    tenantId: string;
    payrollRunId: string;
    month: number;
    year: number;
    submittedByName: string;
    totalGross: string;
    totalNet: string;
    notes?: string;
    reviewLink?: string;
    recipients: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      source: 'APPROVER' | 'TENANT_ADMIN_ESCALATION';
    }[];
  }) {
    await Promise.all(
      data.recipients.map(async (recipient) => {
        if (
          await this.isDuplicate(
            recipient.email,
            NotificationType.PAYROLL_APPROVAL_REQUESTED,
            data.tenantId,
          )
        ) {
          this.logger.warn(
            `Duplicate PAYROLL_APPROVAL_REQUESTED suppressed for ${recipient.email}`,
          );
          return;
        }

        const success =
          await this.email.sendPayrollApprovalRequestedNotification(
            recipient.email,
            recipient.firstName,
            data.month,
            data.year,
            data.submittedByName,
            data.totalGross,
            data.totalNet,
            data.notes,
            data.reviewLink,
            recipient.source === 'TENANT_ADMIN_ESCALATION',
          );

        await this.log({
          userId: recipient.userId,
          tenantId: data.tenantId,
          type: 'PAYROLL_APPROVAL_REQUESTED',
          channel: 'EMAIL',
          recipient: recipient.email,
          subject: `Payroll approval required — ${data.month}/${data.year}`,
          status: success ? 'SENT' : 'FAILED',
          metadata: {
            payrollRunId: data.payrollRunId,
            recipientSource: recipient.source,
          },
        });
      }),
    );
  }

  async sendPayrollDecisionNotification(data: {
    tenantId: string;
    payrollRunId: string;
    month: number;
    year: number;
    decision: 'APPROVED' | 'RETURNED_TO_DRAFT';
    reviewerName: string;
    decisionNote: string;
    totalGross: string;
    totalNet: string;
    detailLink?: string;
    recipients: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
    }[];
  }) {
    await Promise.all(
      data.recipients.map(async (recipient) => {
        if (
          await this.isDuplicate(
            recipient.email,
            NotificationType.PAYROLL_DECISION,
            data.tenantId,
          )
        ) {
          this.logger.warn(
            `Duplicate PAYROLL_DECISION suppressed for ${recipient.email}`,
          );
          return;
        }

        const success = await this.email.sendPayrollDecisionNotification(
          recipient.email,
          recipient.firstName,
          data.month,
          data.year,
          data.decision,
          data.reviewerName,
          data.decisionNote,
          data.totalGross,
          data.totalNet,
          data.detailLink,
        );

        await this.log({
          userId: recipient.userId,
          tenantId: data.tenantId,
          type: 'PAYROLL_DECISION',
          channel: 'EMAIL',
          recipient: recipient.email,
          subject:
            data.decision === 'APPROVED'
              ? `Payroll approved — ${data.month}/${data.year}`
              : `Payroll returned to draft — ${data.month}/${data.year}`,
          status: success ? 'SENT' : 'FAILED',
          metadata: {
            payrollRunId: data.payrollRunId,
            decision: data.decision,
          },
        });
      }),
    );
  }

  async sendLeaveRequestedNotification(data: {
    tenantId: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    managerEmail: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason?: string;
    detailLink?: string;
    platformLink?: string;
    autoApproved?: boolean;
  }) {
    if (
      await this.isDuplicate(
        data.managerEmail,
        NotificationType.LEAVE_REQUESTED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate LEAVE_REQUESTED suppressed for ${data.managerEmail}`,
      );
      return;
    }
    const success = await this.email.sendLeaveRequestedNotification(
      data.managerEmail,
      data.employeeFirstName,
      data.employeeLastName,
      data.leaveTypeName,
      data.startDate,
      data.endDate,
      data.totalDays,
      data.reason,
      data.detailLink,
      data.platformLink,
      data.autoApproved,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'LEAVE_REQUESTED',
      channel: 'EMAIL',
      recipient: data.managerEmail,
      subject: data.autoApproved
        ? `Leave auto-approved for ${data.employeeFirstName} ${data.employeeLastName}`
        : `Leave request from ${data.employeeFirstName} ${data.employeeLastName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendLeaveReviewedNotification(data: {
    tenantId: string;
    employeeId: string;
    employeeEmail: string;
    employeeFirstName: string;
    status: 'APPROVED' | 'REJECTED';
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    note?: string;
    platformLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.LEAVE_REVIEWED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate LEAVE_REVIEWED suppressed for ${data.employeeEmail}`,
      );
      return;
    }
    const success = await this.email.sendLeaveReviewedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.status,
      data.leaveTypeName,
      data.startDate,
      data.endDate,
      data.totalDays,
      data.note,
      data.platformLink,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'LEAVE_REVIEWED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Your ${data.leaveTypeName} request has been ${data.status.toLowerCase()}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendLeaveCancelledNotification(data: {
    tenantId: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    managerEmail: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    platformLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.managerEmail,
        NotificationType.LEAVE_CANCELLED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate LEAVE_CANCELLED suppressed for ${data.managerEmail}`,
      );
      return;
    }
    const success = await this.email.sendLeaveCancelledNotification(
      data.managerEmail,
      data.employeeFirstName,
      data.employeeLastName,
      data.leaveTypeName,
      data.startDate,
      data.endDate,
      data.totalDays,
      data.platformLink,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'LEAVE_CANCELLED',
      channel: 'EMAIL',
      recipient: data.managerEmail,
      subject: `Leave request cancelled — ${data.employeeFirstName} ${data.employeeLastName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendTimeCorrectionSubmittedNotification(data: {
    tenantId: string;
    correctionId: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    attendanceDate: string;
    requestedIn: string | null;
    requestedOut: string | null;
    reason: string;
    adminEmail: string | null;
    managerEmail: string | null;
    detailLink?: string;
  }) {
    const employeeFullName = `${data.employeeFirstName} ${data.employeeLastName}`;
    const recipients: { email: string; firstName: string }[] = [];

    if (data.adminEmail) {
      recipients.push({ email: data.adminEmail, firstName: 'Approver' });
    }

    if (data.managerEmail && data.managerEmail !== data.adminEmail) {
      recipients.push({ email: data.managerEmail, firstName: 'Manager' });
    }

    if (recipients.length === 0) {
      this.logger.warn(
        `[TIME_CORRECTION_SUBMITTED] No recipients resolved for correction ${data.correctionId} in tenant ${data.tenantId}`,
      );
      return;
    }

    for (const recipient of recipients) {
      if (
        await this.isDuplicate(
          recipient.email,
          NotificationType.TIME_CORRECTION_SUBMITTED,
          data.tenantId,
        )
      ) {
        this.logger.warn(
          `Duplicate TIME_CORRECTION_SUBMITTED suppressed for ${recipient.email}`,
        );
        continue;
      }

      const success = await this.email.sendTimeCorrectionNotification(
        recipient.email,
        recipient.firstName,
        employeeFullName,
        data.attendanceDate,
        data.requestedIn,
        data.requestedOut,
        data.reason,
        data.detailLink,
      );

      await this.log({
        userId: data.employeeId,
        tenantId: data.tenantId,
        type: 'TIME_CORRECTION_SUBMITTED',
        channel: 'EMAIL',
        recipient: recipient.email,
        subject: `Time correction request pending your approval — ${employeeFullName}`,
        status: success ? 'SENT' : 'FAILED',
      });
    }
  }

  async sendAppraisalSelfSubmittedNotification(data: {
    tenantId: string;
    appraisalId: string;
    cycleId?: string;
    cycleTitle: string;
    employeeFirstName: string;
    employeeLastName: string;
    managerEmail: string;
    managerFirstName: string;
    managerReviewLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.managerEmail,
        NotificationType.APPRAISAL_SELF_SUBMITTED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate APPRAISAL_SELF_SUBMITTED suppressed for ${data.managerEmail}`,
      );
      return;
    }

    const success = await this.email.sendAppraisalSelfSubmittedNotification(
      data.managerEmail,
      data.managerFirstName,
      `${data.employeeFirstName} ${data.employeeLastName}`,
      data.cycleTitle,
      data.managerReviewLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'APPRAISAL_SELF_SUBMITTED',
      channel: 'EMAIL',
      recipient: data.managerEmail,
      subject: `Self-assessment submitted by ${data.employeeFirstName} ${data.employeeLastName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendAppraisalCycleStartedNotification(data: {
    tenantId: string;
    appraisalId: string;
    cycleId: string;
    cycleTitle: string;
    employeeEmail: string;
    employeeFirstName: string;
    selfAssessmentLink: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.APPRAISAL_CYCLE_STARTED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate APPRAISAL_CYCLE_STARTED suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendAppraisalCycleStartedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.cycleTitle,
      data.selfAssessmentLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'APPRAISAL_CYCLE_STARTED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Appraisal cycle started — ${data.cycleTitle}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendAppraisalManagerReviewedNotification(data: {
    tenantId: string;
    appraisalId: string;
    cycleTitle: string;
    employeeEmail: string;
    employeeFirstName: string;
    finalScore: number;
    finalRating: string;
    platformLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.APPRAISAL_MANAGER_REVIEWED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate APPRAISAL_MANAGER_REVIEWED suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendAppraisalManagerReviewedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.cycleTitle,
      data.finalScore,
      data.finalRating,
      data.platformLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'APPRAISAL_MANAGER_REVIEWED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Your appraisal review is complete — ${data.cycleTitle}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendAppraisalSelfReminderNotification(data: {
    tenantId: string;
    appraisalId: string;
    cycleId: string;
    cycleTitle: string;
    employeeEmail: string;
    employeeFirstName: string;
    deadline: string;
    daysRemaining: number;
    selfAssessmentLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.APPRAISAL_SELF_REMINDER,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate APPRAISAL_SELF_REMINDER suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendAppraisalSelfReminderNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.cycleTitle,
      data.deadline,
      data.daysRemaining,
      data.selfAssessmentLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'APPRAISAL_SELF_REMINDER',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject:
        data.daysRemaining === 0
          ? `Your self-assessment is due today — ${data.cycleTitle}`
          : `Self-assessment reminder — ${data.cycleTitle}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendAppraisalManagerReminderNotification(data: {
    tenantId: string;
    appraisalId: string;
    cycleId: string;
    cycleTitle: string;
    managerEmail: string;
    managerFirstName: string;
    employeeFirstName: string;
    employeeLastName: string;
    deadline: string;
    daysRemaining: number;
    managerReviewLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.managerEmail,
        NotificationType.APPRAISAL_MANAGER_REMINDER,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate APPRAISAL_MANAGER_REMINDER suppressed for ${data.managerEmail}`,
      );
      return;
    }

    const success = await this.email.sendAppraisalManagerReminderNotification(
      data.managerEmail,
      data.managerFirstName,
      `${data.employeeFirstName} ${data.employeeLastName}`,
      data.cycleTitle,
      data.deadline,
      data.daysRemaining,
      data.managerReviewLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'APPRAISAL_MANAGER_REMINDER',
      channel: 'EMAIL',
      recipient: data.managerEmail,
      subject:
        data.daysRemaining === 0
          ? `Manager review is due today — ${data.cycleTitle}`
          : `Manager review reminder — ${data.cycleTitle}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendSchedulePublishedNotification(data: {
    tenantId: string;
    employeeId: string;
    employeeEmail: string;
    employeeFirstName: string;
    effectiveFrom: string;
    shiftType: string;
    startTime: string;
    endTime: string;
    scheduleLink: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.SCHEDULE_PUBLISHED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate SCHEDULE_PUBLISHED suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendSchedulePublishedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.effectiveFrom,
      data.shiftType,
      data.startTime,
      data.endTime,
      data.scheduleLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'SCHEDULE_PUBLISHED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: 'Your shift schedule has been published',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendShiftSwapRequestedNotification(data: {
    tenantId: string;
    shiftSwapId: string;
    recipientEmail: string;
    recipientFirstName: string;
    recipientRole: 'REQUESTER' | 'COLLEAGUE';
    counterpartFullName: string;
    requesterFullName: string;
    requesterShiftLabel: string;
    targetShiftLabel: string;
    reason?: string | null;
    scheduleLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.recipientEmail,
        NotificationType.SHIFT_SWAP_REQUESTED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate SHIFT_SWAP_REQUESTED suppressed for ${data.recipientEmail}`,
      );
      return;
    }

    const success = await this.email.sendShiftSwapRequestedNotification(
      data.recipientEmail,
      data.recipientFirstName,
      data.recipientRole,
      data.counterpartFullName,
      data.requesterFullName,
      data.requesterShiftLabel,
      data.targetShiftLabel,
      data.reason,
      data.scheduleLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'SHIFT_SWAP_REQUESTED',
      channel: 'EMAIL',
      recipient: data.recipientEmail,
      subject:
        data.recipientRole === 'REQUESTER'
          ? `Your shift swap request with ${data.counterpartFullName} has been submitted`
          : `${data.requesterFullName} requested a shift swap with you`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendShiftSwapPendingManagerNotification(data: {
    tenantId: string;
    shiftSwapId: string;
    managerEmail: string;
    managerFirstName: string;
    requesterFullName: string;
    targetFullName: string;
    requesterShiftLabel: string;
    targetShiftLabel: string;
    reason?: string | null;
    reviewLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.managerEmail,
        NotificationType.SHIFT_SWAP_PENDING_MANAGER,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate SHIFT_SWAP_PENDING_MANAGER suppressed for ${data.managerEmail}`,
      );
      return;
    }

    const success = await this.email.sendShiftSwapPendingManagerNotification(
      data.managerEmail,
      data.managerFirstName,
      data.requesterFullName,
      data.targetFullName,
      data.requesterShiftLabel,
      data.targetShiftLabel,
      data.reason,
      data.reviewLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'SHIFT_SWAP_PENDING_MANAGER',
      channel: 'EMAIL',
      recipient: data.managerEmail,
      subject: `Shift swap awaiting your approval — ${data.requesterFullName} and ${data.targetFullName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendShiftSwapDeclinedNotification(data: {
    tenantId: string;
    shiftSwapId: string;
    employeeEmail: string;
    employeeFirstName: string;
    counterpartFullName: string;
    scheduleLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.SHIFT_SWAP_DECLINED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate SHIFT_SWAP_DECLINED suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendShiftSwapDeclinedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.counterpartFullName,
      data.scheduleLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'SHIFT_SWAP_DECLINED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Shift swap update with ${data.counterpartFullName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendShiftSwapApprovedNotification(data: {
    tenantId: string;
    shiftSwapId: string;
    employeeEmail: string;
    employeeFirstName: string;
    counterpartFullName: string;
    requesterShiftLabel: string;
    targetShiftLabel: string;
    scheduleLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.SHIFT_SWAP_APPROVED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate SHIFT_SWAP_APPROVED suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendShiftSwapApprovedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.counterpartFullName,
      data.requesterShiftLabel,
      data.targetShiftLabel,
      data.scheduleLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'SHIFT_SWAP_APPROVED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Your shift swap with ${data.counterpartFullName} was approved`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendShiftSwapRejectedNotification(data: {
    tenantId: string;
    shiftSwapId: string;
    employeeEmail: string;
    employeeFirstName: string;
    counterpartFullName: string;
    rejectionReason: string;
    requesterShiftLabel: string;
    targetShiftLabel: string;
    scheduleLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.SHIFT_SWAP_REJECTED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate SHIFT_SWAP_REJECTED suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendShiftSwapRejectedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.counterpartFullName,
      data.rejectionReason,
      data.requesterShiftLabel,
      data.targetShiftLabel,
      data.scheduleLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'SHIFT_SWAP_REJECTED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Your shift swap with ${data.counterpartFullName} was rejected`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendShiftSwapExpiredNotification(data: {
    tenantId: string;
    shiftSwapId: string;
    employeeEmail: string;
    employeeFirstName: string;
    counterpartFullName: string;
    requesterShiftLabel: string;
    targetShiftLabel: string;
    scheduleLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.SHIFT_SWAP_EXPIRED,
        data.tenantId,
      )
    ) {
      this.logger.warn(
        `Duplicate SHIFT_SWAP_EXPIRED suppressed for ${data.employeeEmail}`,
      );
      return;
    }

    const success = await this.email.sendShiftSwapExpiredNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.counterpartFullName,
      data.requesterShiftLabel,
      data.targetShiftLabel,
      data.scheduleLink,
    );

    await this.log({
      userId: undefined,
      tenantId: data.tenantId,
      type: 'SHIFT_SWAP_EXPIRED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Your shift swap with ${data.counterpartFullName} expired`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendSmsOtp(data: {
    userId?: string;
    tenantId?: string;
    phone: string;
    otp: string;
    context: string;
  }) {
    if (
      await this.isDuplicate(
        data.phone,
        NotificationType.SMS_OTP,
        data.tenantId,
      )
    ) {
      this.logger.warn(`Duplicate SMS_OTP suppressed for ${data.phone}`);
      return;
    }
    const smsResult = await this.sms.sendOtp(
      data.phone,
      data.otp,
      data.context,
    );
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'SMS_OTP',
      channel: 'SMS',
      recipient: data.phone,
      status: smsResult.status,
      error: smsResult.error,
      metadata: this.smsProviderMetadata(smsResult),
    });
  }

  private smsProviderMetadata(result: SmsSendResult): Prisma.InputJsonObject {
    return {
      provider: result.provider,
      ...(result.providerStatus
        ? { providerStatus: result.providerStatus }
        : {}),
      ...(result.providerDetail
        ? { providerDetail: result.providerDetail }
        : {}),
    };
  }

  private async log(entry: {
    userId: string | undefined;
    tenantId: string;
    type: any;
    channel: any;
    recipient: string;
    subject?: string;
    status: any;
    error?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    try {
      await this.prisma.notificationLog.create({
        data: {
          ...entry,
          sentAt: entry.status === 'SENT' ? new Date() : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to log notification', err);
    }
  }
}
