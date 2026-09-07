import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  renderAppraisalCycleStartedTemplate,
  renderAppraisalManagerReminderTemplate,
  renderAppraisalManagerReviewedTemplate,
  renderAppraisalSelfReminderTemplate,
  renderAppraisalSelfSubmittedTemplate,
  renderAnnouncementPublishedTemplate,
  renderEmailVerificationOtpTemplate,
  renderEmployeeInviteEmailTemplate,
  renderLeaveCancelledTemplate,
  renderLeaveRequestedTemplate,
  renderLeaveReviewedTemplate,
  renderPasswordResetLinkTemplate,
  renderPayrollApprovalRequestedTemplate,
  renderPayrollDecisionTemplate,
  renderResignationSubmittedTemplate,
  renderSchedulePublishedTemplate,
  renderShiftSwapTemplate,
  renderTenantAdminWelcomeEmailTemplate,
  renderTerminationNoticeTemplate,
  renderTimeCorrectionTemplate,
} from './templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly appName = 'WorkPhelo ERP';
  private readonly frontendBaseUrl: URL;

  constructor() {
    if (!process.env.RESEND_API_KEY)
      throw new Error('RESEND_API_KEY is required');
    if (!process.env.RESEND_FROM_EMAIL)
      throw new Error('RESEND_FROM_EMAIL is required');
    if (!process.env.FRONTEND_BASE_URL)
      throw new Error('FRONTEND_BASE_URL is required');
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL;
    this.frontendBaseUrl = new URL(process.env.FRONTEND_BASE_URL);
  }

  private escapeHtml(value: unknown): string {
    const normalized =
      typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '';

    return normalized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeHtmlWithBreaks(value: unknown): string {
    return this.escapeHtml(value).replace(/\r?\n/g, '<br />');
  }

  private sanitizeUrl(url?: string): string | undefined {
    if (!url) {
      return undefined;
    }

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return undefined;
      }

      if (parsed.origin !== this.frontendBaseUrl.origin) {
        this.logger.warn(`Blocked email URL with unexpected origin: ${url}`);
        return undefined;
      }

      return this.escapeHtml(parsed.toString());
    } catch {
      this.logger.warn(`Blocked invalid email URL: ${url}`);
      return undefined;
    }
  }

  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatDateOnly(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatTime(iso: string | null): string {
    return iso
      ? new Date(iso).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : '—';
  }

  private async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    try {
      const res = await axios.post(
        'https://api.resend.com/emails',
        { from: this.fromEmail, to, subject, html },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const resData = res.data as { id?: string };
      this.logger.log(`Email sent to ${to} — ID: ${resData?.id}`);
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown }; message?: string };
      this.logger.error(
        `Failed to send email to ${to}: ${JSON.stringify(e?.response?.data || e?.message)}`,
      );
      return false;
    }
  }

  async sendEmailVerificationOtp(
    to: string,
    firstName: string,
    otp: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `${otp} is your ${this.appName} verification code`,
      renderEmailVerificationOtpTemplate({
        appName: this.appName,
        firstName: this.escapeHtml(firstName),
        otp: this.escapeHtml(otp),
      }),
    );
  }

  async sendEmployeeInviteEmail(
    to: string,
    firstName: string,
    tenantName: string,
    acceptInviteUrl: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `You're invited to ${tenantName} on ${this.appName}`,
      renderEmployeeInviteEmailTemplate({
        firstName: this.escapeHtml(firstName),
        tenantName: this.escapeHtml(tenantName),
        acceptInviteUrl: this.sanitizeUrl(acceptInviteUrl),
      }),
    );
  }

  async sendTenantAdminWelcomeEmail(
    to: string,
    firstName: string,
    tenantName: string,
    acceptInviteUrl: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Welcome to ${tenantName} on ${this.appName}`,
      renderTenantAdminWelcomeEmailTemplate({
        firstName: this.escapeHtml(firstName),
        tenantName: this.escapeHtml(tenantName),
        acceptInviteUrl: this.sanitizeUrl(acceptInviteUrl),
      }),
    );
  }

  async sendTerminationNotice(
    to: string,
    firstName: string,
    lastName: string,
    reason: string,
    lastWorkingDate: string,
    platformLink?: string,
  ): Promise<boolean> {
    const reasonLabels: Record<string, string> = {
      TERMINATION: 'Termination',
      CONTRACT_ENDED: 'End of Contract',
      RESIGNATION: 'Resignation',
      RETIREMENT: 'Retirement',
      REDUNDANCY: 'Redundancy',
      OTHER: 'Other',
    };

    return this.send(
      to,
      `Important notice regarding your employment — ${this.appName}`,
      renderTerminationNoticeTemplate({
        firstName: this.escapeHtml(firstName),
        lastName: this.escapeHtml(lastName),
        reasonLabel: this.escapeHtml(reasonLabels[reason] ?? reason),
        formattedDate: this.escapeHtml(this.formatDate(lastWorkingDate)),
        platformLink: this.sanitizeUrl(platformLink),
      }),
    );
  }

  async sendResignationSubmittedNotification(
    to: string,
    employeeFirstName: string,
    employeeLastName: string,
    lastWorkingDate: string,
    reason?: string,
    additionalNotes?: string,
    detailLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Resignation submitted by ${employeeFirstName} ${employeeLastName}`,
      renderResignationSubmittedTemplate({
        employeeFirstName: this.escapeHtml(employeeFirstName),
        employeeLastName: this.escapeHtml(employeeLastName),
        formattedDate: this.escapeHtml(this.formatDate(lastWorkingDate)),
        reason: reason ? this.escapeHtml(reason) : undefined,
        additionalNotes: additionalNotes
          ? this.escapeHtmlWithBreaks(additionalNotes)
          : undefined,
        detailLink: this.sanitizeUrl(detailLink),
      }),
    );
  }

  async sendLeaveRequestedNotification(
    to: string,
    employeeFirstName: string,
    employeeLastName: string,
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    reason?: string,
    detailLink?: string,
    platformLink?: string,
    autoApproved?: boolean,
  ): Promise<boolean> {
    return this.send(
      to,
      autoApproved
        ? `Leave auto-approved for ${employeeFirstName} ${employeeLastName}`
        : `Leave request from ${employeeFirstName} ${employeeLastName}`,
      renderLeaveRequestedTemplate({
        employeeFirstName: this.escapeHtml(employeeFirstName),
        employeeLastName: this.escapeHtml(employeeLastName),
        leaveTypeName: this.escapeHtml(leaveTypeName),
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        totalDays,
        reason: reason ? this.escapeHtmlWithBreaks(reason) : undefined,
        detailLink: this.sanitizeUrl(detailLink),
        platformLink: this.sanitizeUrl(platformLink),
        autoApproved,
      }),
    );
  }

  async sendLeaveReviewedNotification(
    to: string,
    firstName: string,
    status: 'APPROVED' | 'REJECTED',
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    note?: string,
    platformLink?: string,
  ): Promise<boolean> {
    const isApproved = status === 'APPROVED';
    const heroLabel = isApproved
      ? 'Leave Request Approved'
      : 'Leave Request Not Approved';

    return this.send(
      to,
      `Your ${leaveTypeName} request has been ${status.toLowerCase()}`,
      renderLeaveReviewedTemplate({
        firstName: this.escapeHtml(firstName),
        isApproved,
        heroLabel: this.escapeHtml(heroLabel),
        leaveTypeName: this.escapeHtml(leaveTypeName),
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        totalDays,
        note: note ? this.escapeHtmlWithBreaks(note) : undefined,
        platformLink: this.sanitizeUrl(platformLink),
      }),
    );
  }

  async sendLeaveCancelledNotification(
    to: string,
    employeeFirstName: string,
    employeeLastName: string,
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    platformLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Leave request cancelled — ${employeeFirstName} ${employeeLastName}`,
      renderLeaveCancelledTemplate({
        employeeFirstName: this.escapeHtml(employeeFirstName),
        employeeLastName: this.escapeHtml(employeeLastName),
        leaveTypeName: this.escapeHtml(leaveTypeName),
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        totalDays,
        platformLink: this.sanitizeUrl(platformLink),
      }),
    );
  }

  async sendPasswordResetLink(
    to: string,
    firstName: string,
    resetLink: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Reset your ${this.appName} password`,
      renderPasswordResetLinkTemplate({
        appName: this.appName,
        firstName: this.escapeHtml(firstName),
        resetLink: this.sanitizeUrl(resetLink),
      }),
    );
  }

  async sendTimeCorrectionNotification(
    to: string,
    recipientFirstName: string,
    employeeFullName: string,
    attendanceDate: string,
    requestedIn: string | null,
    requestedOut: string | null,
    reason: string,
    detailLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Time correction request pending your approval — ${employeeFullName}`,
      renderTimeCorrectionTemplate({
        recipientFirstName: this.escapeHtml(recipientFirstName),
        employeeFullName: this.escapeHtml(employeeFullName),
        attendanceDate: this.escapeHtml(attendanceDate),
        requestedIn: this.formatTime(requestedIn),
        requestedOut: this.formatTime(requestedOut),
        reason: this.escapeHtmlWithBreaks(reason),
        detailLink: this.sanitizeUrl(detailLink),
      }),
    );
  }

  async sendAppraisalSelfSubmittedNotification(
    to: string,
    managerFirstName: string,
    employeeFullName: string,
    cycleTitle: string,
    managerReviewLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Self-assessment submitted by ${employeeFullName}`,
      renderAppraisalSelfSubmittedTemplate({
        managerFirstName: this.escapeHtml(managerFirstName),
        employeeFullName: this.escapeHtml(employeeFullName),
        cycleTitle: this.escapeHtml(cycleTitle),
        managerReviewLink: this.sanitizeUrl(managerReviewLink),
      }),
    );
  }

  async sendAppraisalCycleStartedNotification(
    to: string,
    employeeFirstName: string,
    cycleTitle: string,
    selfAssessmentLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Appraisal cycle started — ${cycleTitle}`,
      renderAppraisalCycleStartedTemplate({
        employeeFirstName: this.escapeHtml(employeeFirstName),
        cycleTitle: this.escapeHtml(cycleTitle),
        selfAssessmentLink: this.sanitizeUrl(selfAssessmentLink),
      }),
    );
  }

  async sendAnnouncementPublishedNotification(
    to: string,
    firstName: string,
    title: string,
    body: string,
    publishedAt: string,
    platformLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      title,
      renderAnnouncementPublishedTemplate({
        firstName: this.escapeHtml(firstName),
        title: this.escapeHtml(title),
        body: this.escapeHtmlWithBreaks(body),
        publishedAt: this.escapeHtml(this.formatDate(publishedAt)),
        platformLink: this.sanitizeUrl(platformLink),
      }),
    );
  }

  async sendPayrollApprovalRequestedNotification(
    to: string,
    firstName: string,
    month: number,
    year: number,
    submittedByName: string,
    totalGross: string,
    totalNet: string,
    notes?: string,
    reviewLink?: string,
    escalated?: boolean,
  ): Promise<boolean> {
    return this.send(
      to,
      `Payroll approval required — ${month}/${year}`,
      renderPayrollApprovalRequestedTemplate({
        recipientFirstName: this.escapeHtml(firstName),
        month,
        year,
        submittedByName: this.escapeHtml(submittedByName),
        totalGross: this.escapeHtml(totalGross),
        totalNet: this.escapeHtml(totalNet),
        notes: notes ? this.escapeHtmlWithBreaks(notes) : undefined,
        reviewLink: this.sanitizeUrl(reviewLink),
        escalated,
      }),
    );
  }

  async sendPayrollDecisionNotification(
    to: string,
    firstName: string,
    month: number,
    year: number,
    decision: 'APPROVED' | 'RETURNED_TO_DRAFT',
    reviewerName: string,
    decisionNote: string,
    totalGross: string,
    totalNet: string,
    detailLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      decision === 'APPROVED'
        ? `Payroll approved — ${month}/${year}`
        : `Payroll rejected — ${month}/${year}`,
      renderPayrollDecisionTemplate({
        recipientFirstName: this.escapeHtml(firstName),
        month,
        year,
        decision,
        reviewerName: this.escapeHtml(reviewerName),
        decisionNote: this.escapeHtmlWithBreaks(decisionNote),
        totalGross: this.escapeHtml(totalGross),
        totalNet: this.escapeHtml(totalNet),
        detailLink: this.sanitizeUrl(detailLink),
      }),
    );
  }

  async sendAppraisalSelfReminderNotification(
    to: string,
    employeeFirstName: string,
    cycleTitle: string,
    deadline: string,
    daysRemaining: number,
    selfAssessmentLink?: string,
  ): Promise<boolean> {
    const heading =
      daysRemaining === 0
        ? 'Your Self-Assessment Is Due Today'
        : 'Self-Assessment Reminder';
    const bodyCopy =
      daysRemaining === 0
        ? `Your self-assessment for the <strong>${this.escapeHtml(cycleTitle)}</strong> appraisal cycle is due today.`
        : `Your self-assessment for the <strong>${this.escapeHtml(cycleTitle)}</strong> appraisal cycle is due in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.`;

    return this.send(
      to,
      daysRemaining === 0
        ? `Your self-assessment is due today — ${cycleTitle}`
        : `Self-assessment reminder — ${cycleTitle}`,
      renderAppraisalSelfReminderTemplate({
        subject: cycleTitle,
        heading: this.escapeHtml(heading),
        employeeFirstName: this.escapeHtml(employeeFirstName),
        bodyCopy,
        deadlineLabel: this.formatDateOnly(deadline),
        selfAssessmentLink: this.sanitizeUrl(selfAssessmentLink),
      }),
    );
  }

  async sendAppraisalManagerReminderNotification(
    to: string,
    managerFirstName: string,
    employeeFullName: string,
    cycleTitle: string,
    deadline: string,
    daysRemaining: number,
    managerReviewLink?: string,
  ): Promise<boolean> {
    const heading =
      daysRemaining === 0
        ? 'Manager Review Due Today'
        : 'Manager Review Reminder';
    const bodyCopy =
      daysRemaining === 0
        ? `Your manager review for <strong>${this.escapeHtml(employeeFullName)}</strong> in the <strong>${this.escapeHtml(cycleTitle)}</strong> appraisal cycle is due today.`
        : `Your manager review for <strong>${this.escapeHtml(employeeFullName)}</strong> in the <strong>${this.escapeHtml(cycleTitle)}</strong> appraisal cycle is due in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.`;

    return this.send(
      to,
      daysRemaining === 0
        ? `Manager review is due today — ${cycleTitle}`
        : `Manager review reminder — ${cycleTitle}`,
      renderAppraisalManagerReminderTemplate({
        heading: this.escapeHtml(heading),
        managerFirstName: this.escapeHtml(managerFirstName),
        bodyCopy,
        deadlineLabel: this.formatDateOnly(deadline),
        managerReviewLink: this.sanitizeUrl(managerReviewLink),
      }),
    );
  }

  async sendSchedulePublishedNotification(
    to: string,
    employeeFirstName: string,
    effectiveFrom: string,
    shiftType: string,
    startTime: string,
    endTime: string,
    scheduleLink: string,
  ): Promise<boolean> {
    const shiftLabel = shiftType.charAt(0) + shiftType.slice(1).toLowerCase();

    return this.send(
      to,
      'Your shift schedule has been published',
      renderSchedulePublishedTemplate({
        employeeFirstName: this.escapeHtml(employeeFirstName),
        formattedDate: this.formatDateOnly(effectiveFrom),
        shiftLabel: this.escapeHtml(shiftLabel),
        startTime,
        endTime,
        scheduleLink: this.sanitizeUrl(scheduleLink),
      }),
    );
  }

  private sendShiftSwapEmail(
    to: string,
    subject: string,
    heading: string,
    firstName: string,
    bodyHtml: string,
    ctaLabel?: string,
    ctaLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      subject,
      renderShiftSwapTemplate({
        heading: this.escapeHtml(heading),
        firstName: this.escapeHtml(firstName),
        bodyHtml,
        ctaLabel: ctaLabel ? this.escapeHtml(ctaLabel) : undefined,
        ctaLink: this.sanitizeUrl(ctaLink),
      }),
    );
  }

  async sendShiftSwapRequestedNotification(
    to: string,
    firstName: string,
    recipientRole: 'REQUESTER' | 'COLLEAGUE',
    counterpartFullName: string,
    requesterFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    reason?: string | null,
    scheduleLink?: string,
  ): Promise<boolean> {
    const safeCounterpartFullName = this.escapeHtml(counterpartFullName);
    const safeRequesterFullName = this.escapeHtml(requesterFullName);
    const safeRequesterShiftLabel = this.escapeHtml(requesterShiftLabel);
    const safeTargetShiftLabel = this.escapeHtml(targetShiftLabel);
    const safeReason = reason ? this.escapeHtmlWithBreaks(reason) : '';
    const body = [
      recipientRole === 'REQUESTER'
        ? `<p>Your shift swap request with <strong>${safeCounterpartFullName}</strong> has been submitted and is awaiting their response.</p>`
        : `<p><strong>${safeRequesterFullName}</strong> has requested a shift swap with you.</p>`,
      `<table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Their shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeRequesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Swap target</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeTargetShiftLabel}</td>
        </tr>
      </table>`,
      safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : '',
      recipientRole === 'COLLEAGUE'
        ? `<p>Please log in to WorkPhelo to accept or decline this request within 48 hours.</p>`
        : '<p>You can track the request status from your schedule screen.</p>',
    ].join('');

    return this.sendShiftSwapEmail(
      to,
      recipientRole === 'REQUESTER'
        ? `Shift swap request submitted with ${counterpartFullName}`
        : `${requesterFullName} requested a shift swap with you`,
      recipientRole === 'REQUESTER'
        ? 'Shift Swap Request Submitted'
        : 'Shift Swap Request Received',
      firstName,
      body,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapPendingManagerNotification(
    to: string,
    firstName: string,
    requesterFullName: string,
    targetFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    reason?: string | null,
    reviewLink?: string,
  ): Promise<boolean> {
    const safeRequesterFullName = this.escapeHtml(requesterFullName);
    const safeTargetFullName = this.escapeHtml(targetFullName);
    const safeRequesterShiftLabel = this.escapeHtml(requesterShiftLabel);
    const safeTargetShiftLabel = this.escapeHtml(targetShiftLabel);
    const safeReason = reason ? this.escapeHtmlWithBreaks(reason) : '';
    const body = [
      `<p>A shift swap between <strong>${safeRequesterFullName}</strong> and <strong>${safeTargetFullName}</strong> is awaiting your approval.</p>`,
      `<table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeRequesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeTargetShiftLabel}</td>
        </tr>
      </table>`,
      safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : '',
      '<p>Please review the request in the scheduling section.</p>',
    ].join('');

    return this.sendShiftSwapEmail(
      to,
      `Shift swap awaiting your approval — ${requesterFullName} and ${targetFullName}`,
      'Shift Swap Awaiting Approval',
      firstName,
      body,
      reviewLink ? 'Review Swap Request' : undefined,
      reviewLink,
    );
  }

  async sendShiftSwapDeclinedNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    const safeCounterpartFullName = this.escapeHtml(counterpartFullName);

    return this.sendShiftSwapEmail(
      to,
      `Shift swap update with ${counterpartFullName}`,
      'Shift Swap Declined',
      firstName,
      `<p>Your shift swap request with <strong>${safeCounterpartFullName}</strong> was declined. Your original shifts remain unchanged.</p>`,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapApprovedNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    const safeCounterpartFullName = this.escapeHtml(counterpartFullName);
    const safeRequesterShiftLabel = this.escapeHtml(requesterShiftLabel);
    const safeTargetShiftLabel = this.escapeHtml(targetShiftLabel);

    return this.sendShiftSwapEmail(
      to,
      `Your shift swap with ${counterpartFullName} was approved`,
      'Shift Swap Approved',
      firstName,
      `<p>Your shift swap with <strong>${safeCounterpartFullName}</strong> was approved.</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Original requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeRequesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Original colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeTargetShiftLabel}</td>
        </tr>
      </table>
      <p>Your schedule has been updated to reflect the approved swap.</p>`,
      scheduleLink ? 'View Updated Schedule' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapRejectedNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    rejectionReason: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    const safeCounterpartFullName = this.escapeHtml(counterpartFullName);
    const safeRejectionReason = this.escapeHtmlWithBreaks(rejectionReason);
    const safeRequesterShiftLabel = this.escapeHtml(requesterShiftLabel);
    const safeTargetShiftLabel = this.escapeHtml(targetShiftLabel);

    return this.sendShiftSwapEmail(
      to,
      `Your shift swap with ${counterpartFullName} was rejected`,
      'Shift Swap Rejected',
      firstName,
      `<p>Your shift swap with <strong>${safeCounterpartFullName}</strong> was rejected by the manager.</p>
      <p><strong>Reason:</strong> ${safeRejectionReason}</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeRequesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeTargetShiftLabel}</td>
        </tr>
      </table>
      <p>Your original shifts remain unchanged.</p>`,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendShiftSwapExpiredNotification(
    to: string,
    firstName: string,
    counterpartFullName: string,
    requesterShiftLabel: string,
    targetShiftLabel: string,
    scheduleLink?: string,
  ): Promise<boolean> {
    const safeCounterpartFullName = this.escapeHtml(counterpartFullName);
    const safeRequesterShiftLabel = this.escapeHtml(requesterShiftLabel);
    const safeTargetShiftLabel = this.escapeHtml(targetShiftLabel);

    return this.sendShiftSwapEmail(
      to,
      `Your shift swap with ${counterpartFullName} expired`,
      'Shift Swap Expired',
      firstName,
      `<p>Your shift swap with <strong>${safeCounterpartFullName}</strong> expired without a response within 48 hours.</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Requester shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeRequesterShiftLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Colleague shift</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${safeTargetShiftLabel}</td>
        </tr>
      </table>
      <p>Your original shifts remain unchanged.</p>`,
      scheduleLink ? 'Open Scheduling' : undefined,
      scheduleLink,
    );
  }

  async sendAppraisalManagerReviewedNotification(
    to: string,
    employeeFirstName: string,
    cycleTitle: string,
    finalScore: number,
    finalRating: string,
    platformLink?: string,
  ): Promise<boolean> {
    return this.send(
      to,
      `Your appraisal review is complete — ${cycleTitle}`,
      renderAppraisalManagerReviewedTemplate({
        employeeFirstName: this.escapeHtml(employeeFirstName),
        cycleTitle: this.escapeHtml(cycleTitle),
        finalScore,
        finalRating: this.escapeHtml(finalRating),
        platformLink: this.sanitizeUrl(platformLink),
      }),
    );
  }
}
