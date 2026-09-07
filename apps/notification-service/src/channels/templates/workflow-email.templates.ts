import {
  renderCardEmail,
  renderPrimaryButton,
  renderStandardEmail,
} from './shared';

export function renderResignationSubmittedTemplate(input: {
  employeeFirstName: string;
  employeeLastName: string;
  formattedDate: string;
  reason?: string;
  additionalNotes?: string;
  detailLink?: string;
}): string {
  return renderCardEmail({
    title: 'New Resignation Submitted',
    bodyHtml: `
      <p style="color: #374151;">
        <strong>${input.employeeFirstName} ${input.employeeLastName}</strong> has submitted a resignation.
      </p>
      <p style="color: #374151;">
        Proposed last working date: <strong>${input.formattedDate}</strong>
      </p>
      ${input.reason ? `<p style="color: #374151;">Reason: <strong>${input.reason}</strong></p>` : ''}
      ${input.additionalNotes ? `<p style="color: #374151;">Additional notes:<br />${input.additionalNotes}</p>` : ''}
      ${
        input.detailLink
          ? `<p style="margin-top: 24px;">${renderPrimaryButton('View resignation details', input.detailLink)}</p>`
          : ''
      }
    `,
  });
}
export function renderLeaveRequestedTemplate(input: {
  employeeFirstName: string;
  employeeLastName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  detailLink?: string;
  platformLink?: string;
  autoApproved?: boolean;
}): string {
  const autoApproved = input.autoApproved === true;
  return renderStandardEmail({
    title: autoApproved ? 'Leave Request Auto-Approved' : 'Leave Request',
    heading: autoApproved ? 'Leave Request Auto-Approved' : 'New Leave Request',
    bodyHtml: `
      <p><strong>${input.employeeFirstName} ${input.employeeLastName}</strong> has submitted a leave request.</p>
      <p>${
        autoApproved
          ? 'This leave type does not require manual review, so the request has already been approved automatically.'
          : 'Company Admin review is required before this request can be approved or rejected.'
      }</p>
      <p><strong>Request details:</strong></p>
      <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
        <tr>
          <td style="padding:8px 0; width:160px; font-weight:500;">Employee:</td>
          <td style="padding:8px 0;">${input.employeeFirstName} ${input.employeeLastName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Leave type:</td>
          <td style="padding:8px 0;">${input.leaveTypeName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Start date:</td>
          <td style="padding:8px 0;">${input.startDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">End date:</td>
          <td style="padding:8px 0;">${input.endDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Working days:</td>
          <td style="padding:8px 0;">${input.totalDays} day${input.totalDays !== 1 ? 's' : ''}</td>
        </tr>
      </table>
      ${
        input.reason
          ? `<p><strong>Notes from ${input.employeeFirstName}:</strong></p>
      <p style="background:#f9f9f9; padding:16px; border-left:4px solid #ff6a00; margin:15px 0; color:#444; line-height:1.5;">
        ${input.reason}
      </p>`
          : ''
      }
      ${
        input.detailLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton(autoApproved ? 'View leave details' : 'Open leave request', input.detailLink)}</p>`
          : input.platformLink
            ? `<p style="margin:24px 0;">${renderPrimaryButton('Open company workspace', input.platformLink)}</p>`
            : ''
      }
      <p style="color:#777; font-size:14px;">
        ${
          input.detailLink
            ? autoApproved
              ? 'Open WorkPhelo to view the approved request and updated leave records.'
              : 'Open WorkPhelo to view the request details and follow up as needed.'
            : input.platformLink
              ? autoApproved
                ? 'Open WorkPhelo to sign in to your company workspace and review the approved leave request.'
                : 'Open WorkPhelo to sign in to your company workspace and follow up as needed.'
              : autoApproved
                ? 'Open WorkPhelo to review the approved leave request and updated leave records.'
                : 'Open WorkPhelo to view the request details and follow up as needed.'
        }
      </p>
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderLeaveReviewedTemplate(input: {
  firstName: string;
  isApproved: boolean;
  heroLabel: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  note?: string;
  platformLink?: string;
}): string {
  const accentColor = input.isApproved ? '#16a34a' : '#dc2626';
  const bgColor = input.isApproved ? '#f0fdf4' : '#fef2f2';
  const borderColor = input.isApproved ? '#86efac' : '#fca5a5';

  return renderStandardEmail({
    title: `Leave Request ${input.isApproved ? 'APPROVED' : 'REJECTED'}`,
    heading: input.heroLabel,
    bodyHtml: `
      <p>Hi ${input.firstName},</p>
      <p style="background:${bgColor}; border:1px solid ${borderColor}; border-radius:6px; padding:16px; color:${accentColor}; font-weight:600; font-size:16px; margin:20px 0;">
        Your leave request has been <strong>${input.isApproved ? 'Approved' : 'Rejected'}</strong>.
      </p>
      <p><strong>Request details:</strong></p>
      <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
        <tr>
          <td style="padding:8px 0; width:160px; font-weight:500;">Leave type:</td>
          <td style="padding:8px 0;">${input.leaveTypeName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Start date:</td>
          <td style="padding:8px 0;">${input.startDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">End date:</td>
          <td style="padding:8px 0;">${input.endDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Working days:</td>
          <td style="padding:8px 0;">${input.totalDays} day${input.totalDays !== 1 ? 's' : ''}</td>
        </tr>
      </table>
      ${
        input.note
          ? `<p><strong>Note from your reviewer:</strong></p>
      <p style="background:#f9f9f9; padding:16px; border-left:4px solid #ff6a00; margin:15px 0; color:#444; line-height:1.5;">
        ${input.note}
      </p>`
          : ''
      }
      ${
        input.platformLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Open company workspace', input.platformLink)}</p>`
          : ''
      }
      <p style="color:#777; font-size:14px;">
        ${
          input.isApproved
            ? 'You can view your full leave history and remaining balances at any time by logging in.'
            : input.platformLink
              ? 'Your leave balance has not been affected by this decision. Sign in to your company workspace if you want to review the request or speak with your manager or HR administrator.'
              : 'Your leave balance has not been affected by this decision. If you have questions, please speak with your manager or HR administrator.'
        }
      </p>
      <p style="margin-top:30px;">${input.isApproved ? 'Enjoy your time off!' : 'Thank you,'}</p>
    `,
  });
}

export function renderLeaveCancelledTemplate(input: {
  employeeFirstName: string;
  employeeLastName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  platformLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Leave Request Cancelled',
    heading: 'Leave Request Cancelled',
    bodyHtml: `
      <p><strong>${input.employeeFirstName} ${input.employeeLastName}</strong> has cancelled their leave request. No action is required.</p>
      <p><strong>Cancelled request details:</strong></p>
      <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
        <tr>
          <td style="padding:8px 0; width:160px; font-weight:500;">Employee:</td>
          <td style="padding:8px 0;">${input.employeeFirstName} ${input.employeeLastName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Leave type:</td>
          <td style="padding:8px 0;">${input.leaveTypeName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Start date:</td>
          <td style="padding:8px 0;">${input.startDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">End date:</td>
          <td style="padding:8px 0;">${input.endDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Working days:</td>
          <td style="padding:8px 0;">${input.totalDays} day${input.totalDays !== 1 ? 's' : ''}</td>
        </tr>
      </table>
      ${
        input.platformLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Open company workspace', input.platformLink)}</p>`
          : ''
      }
      <p style="color:#777; font-size:14px;">
        ${
          input.platformLink
            ? "The employee's leave balance has been restored. You can sign in to your company workspace if you want to review the updated leave records."
            : "The employee's leave balance has been restored and no further action is needed on your part."
        }
      </p>
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderTimeCorrectionTemplate(input: {
  recipientFirstName: string;
  employeeFullName: string;
  attendanceDate: string;
  requestedIn: string;
  requestedOut: string;
  reason: string;
  detailLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Time Correction Request',
    heading: 'Time Correction Request',
    bodyHtml: `
      <p>Hi ${input.recipientFirstName},</p>
      <p><strong>${input.employeeFullName}</strong> has submitted a time correction request that requires your approval.</p>
      <p><strong>Correction details:</strong></p>
      <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600; width:40%;">Date</td>
          <td style="padding:10px 12px; border:1px solid #e5e7eb;">${input.attendanceDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600;">Requested Clock-In</td>
          <td style="padding:10px 12px; border:1px solid #e5e7eb;">${input.requestedIn}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600;">Requested Clock-Out</td>
          <td style="padding:10px 12px; border:1px solid #e5e7eb;">${input.requestedOut}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600;">Reason</td>
          <td style="padding:10px 12px; border:1px solid #e5e7eb;">${input.reason}</td>
        </tr>
      </table>
      ${
        input.detailLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Review Correction →', input.detailLink)}</p>`
          : ''
      }
      <p style="color:#777; font-size:13px;">Please log in to WorkPhelo to approve or reject this request.</p>
    `,
  });
}

export function renderPayrollApprovalRequestedTemplate(input: {
  recipientFirstName: string;
  month: number;
  year: number;
  submittedByName: string;
  totalGross: string;
  totalNet: string;
  notes?: string;
  reviewLink?: string;
  escalated?: boolean;
}): string {
  const period = new Date(input.year, input.month - 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  return renderStandardEmail({
    title: 'Payroll Approval Required',
    heading: input.escalated
      ? 'Payroll Approval Escalated'
      : 'Payroll Approval Required',
    bodyHtml: `
      <p>Hi ${input.recipientFirstName},</p>
      <p>
        Payroll for <strong>${period}</strong> has been submitted by
        <strong> ${input.submittedByName}</strong> and is awaiting approval.
      </p>
      ${
        input.escalated
          ? '<p>No explicit payroll approver is currently configured, so this approval has been escalated to you.</p>'
          : '<p>Please review the payroll summary and take the necessary approval action.</p>'
      }
      <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
        <tr>
          <td style="padding:8px 0; width:160px; font-weight:500;">Payroll period:</td>
          <td style="padding:8px 0;">${period}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Total gross:</td>
          <td style="padding:8px 0;">${input.totalGross}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Total net:</td>
          <td style="padding:8px 0;">${input.totalNet}</td>
        </tr>
      </table>
      ${
        input.notes
          ? `<p><strong>Payroll notes:</strong></p>
      <p style="background:#f9f9f9; padding:16px; border-left:4px solid #ff6a00; margin:15px 0; color:#444; line-height:1.5;">
        ${input.notes}
      </p>`
          : ''
      }
      ${
        input.reviewLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Review payroll', input.reviewLink)}</p>`
          : ''
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderPayrollDecisionTemplate(input: {
  recipientFirstName: string;
  month: number;
  year: number;
  decision: 'APPROVED' | 'RETURNED_TO_DRAFT';
  reviewerName: string;
  decisionNote: string;
  totalGross: string;
  totalNet: string;
  detailLink?: string;
}): string {
  const returnedToDraft = input.decision === 'RETURNED_TO_DRAFT';
  const period = new Date(input.year, input.month - 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  return renderStandardEmail({
    title: returnedToDraft ? 'Payroll Rejected' : 'Payroll Approved',
    heading: returnedToDraft ? 'Payroll Rejected' : 'Payroll Approved',
    bodyHtml: `
      <p>Hi ${input.recipientFirstName},</p>
      <p>
        Payroll for <strong>${period}</strong> was
        <strong>${returnedToDraft ? ' rejected' : ' approved'}</strong>
        by <strong>${input.reviewerName}</strong>.
      </p>
      <table style="width:100%; border-collapse:collapse; margin:15px 0; color:#555; font-size:15px;">
        <tr>
          <td style="padding:8px 0; width:160px; font-weight:500;">Payroll period:</td>
          <td style="padding:8px 0;">${period}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Total gross:</td>
          <td style="padding:8px 0;">${input.totalGross}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:500;">Total net:</td>
          <td style="padding:8px 0;">${input.totalNet}</td>
        </tr>
      </table>
      <p><strong>Reviewer note:</strong></p>
      <p style="background:#f9f9f9; padding:16px; border-left:4px solid #ff6a00; margin:15px 0; color:#444; line-height:1.5;">
        ${input.decisionNote}
      </p>
      ${
        input.detailLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('View payroll run', input.detailLink)}</p>`
          : ''
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderAppraisalSelfSubmittedTemplate(input: {
  managerFirstName: string;
  employeeFullName: string;
  cycleTitle: string;
  managerReviewLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Self-Assessment Submitted',
    heading: 'Self-Assessment Ready for Review',
    bodyHtml: `
      <p>Hi ${input.managerFirstName},</p>
      <p><strong>${input.employeeFullName}</strong> has submitted their self-assessment for the <strong>${input.cycleTitle}</strong> appraisal cycle and it is now ready for your manager review.</p>
      ${
        input.managerReviewLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Open manager review', input.managerReviewLink)}</p>`
          : '<p>Please log in to WorkPhelo to complete your review.</p>'
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderAppraisalCycleStartedTemplate(input: {
  employeeFirstName: string;
  cycleTitle: string;
  selfAssessmentLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Appraisal Cycle Started',
    heading: 'Your Appraisal Cycle Is Now Active',
    bodyHtml: `
      <p>Hi ${input.employeeFirstName},</p>
      <p>The <strong>${input.cycleTitle}</strong> appraisal cycle has started. Please complete your self-assessment before the deadline.</p>
      ${
        input.selfAssessmentLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Start self-assessment', input.selfAssessmentLink)}</p>`
          : '<p>Please log in to WorkPhelo to start your self-assessment.</p>'
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderAnnouncementPublishedTemplate(input: {
  firstName: string;
  title: string;
  body: string;
  publishedAt: string;
  platformLink?: string;
}): string {
  return renderStandardEmail({
    title: input.title,
    heading: 'New Company Announcement',
    bodyHtml: `
      <p>Hi ${input.firstName},</p>
      <p>A new company announcement has been published for your workspace.</p>
      <p><strong>${input.title}</strong></p>
      <p style="background:#f9f9f9; padding:16px; border-left:4px solid #ff6a00; margin:15px 0; color:#444; line-height:1.6;">
        ${input.body}
      </p>
      <p style="color:#555;"><strong>Published:</strong> ${input.publishedAt}</p>
      ${
        input.platformLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Open company workspace', input.platformLink)}</p>`
          : ''
      }
      <p style="color:#777; font-size:14px;">
        ${
          input.platformLink
            ? 'Sign in to WorkPhelo if you want to review the announcement in your company workspace.'
            : 'Sign in to WorkPhelo if you want to review the announcement in your company workspace.'
        }
      </p>
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderAppraisalSelfReminderTemplate(input: {
  subject: string;
  heading: string;
  employeeFirstName: string;
  bodyCopy: string;
  deadlineLabel: string;
  selfAssessmentLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Self-Assessment Reminder',
    heading: input.heading,
    bodyHtml: `
      <p>Hi ${input.employeeFirstName},</p>
      <p>${input.bodyCopy}</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Deadline</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${input.deadlineLabel}</td>
        </tr>
      </table>
      ${
        input.selfAssessmentLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Open self-assessment', input.selfAssessmentLink)}</p>`
          : '<p>Please log in to WorkPhelo to complete your appraisal submission.</p>'
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderAppraisalManagerReminderTemplate(input: {
  heading: string;
  managerFirstName: string;
  bodyCopy: string;
  deadlineLabel: string;
  managerReviewLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Manager Review Reminder',
    heading: input.heading,
    bodyHtml: `
      <p>Hi ${input.managerFirstName},</p>
      <p>${input.bodyCopy}</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Deadline</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${input.deadlineLabel}</td>
        </tr>
      </table>
      ${
        input.managerReviewLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('Open manager review', input.managerReviewLink)}</p>`
          : '<p>Please log in to WorkPhelo to complete the manager review.</p>'
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderSchedulePublishedTemplate(input: {
  employeeFirstName: string;
  formattedDate: string;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  scheduleLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Schedule Published',
    heading: 'Your Schedule Has Been Published',
    bodyHtml: `
      <p>Hi ${input.employeeFirstName},</p>
      <p>A new shift schedule has been published for you. Here are the details:</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin:16px 0;">
        <tr><td style="font-weight:600;color:#333;width:140px;">Effective From</td><td style="color:#555;">${input.formattedDate}</td></tr>
        <tr style="background:#f9f9f9;"><td style="font-weight:600;color:#333;">Shift Type</td><td style="color:#555;">${input.shiftLabel}</td></tr>
        <tr><td style="font-weight:600;color:#333;">Hours</td><td style="color:#555;">${input.startTime} – ${input.endTime}</td></tr>
      </table>
      ${
        input.scheduleLink
          ? `<p>${renderPrimaryButton('View My Schedule', input.scheduleLink)}</p>`
          : ''
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderShiftSwapTemplate(input: {
  heading: string;
  firstName: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaLink?: string;
}): string {
  return renderStandardEmail({
    title: input.heading,
    heading: input.heading,
    bodyHtml: `
      <p>Hi ${input.firstName},</p>
      ${input.bodyHtml}
      ${
        input.ctaLabel && input.ctaLink
          ? `<p>${renderPrimaryButton(input.ctaLabel, input.ctaLink)}</p>`
          : ''
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}

export function renderAppraisalManagerReviewedTemplate(input: {
  employeeFirstName: string;
  cycleTitle: string;
  finalScore: number;
  finalRating: string;
  platformLink?: string;
}): string {
  return renderStandardEmail({
    title: 'Appraisal Complete',
    heading: 'Appraisal Review Complete',
    bodyHtml: `
      <p>Hi ${input.employeeFirstName},</p>
      <p>Your manager has completed the review for the <strong>${input.cycleTitle}</strong> appraisal cycle.</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Final Score</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${input.finalScore}%</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">Rating</td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;">${input.finalRating}</td>
        </tr>
      </table>
      ${
        input.platformLink
          ? `<p style="margin:24px 0;">${renderPrimaryButton('View appraisal result', input.platformLink)}</p>`
          : '<p>Log in to WorkPhelo to view your full appraisal details.</p>'
      }
      <p style="margin-top:30px;">Thank you,</p>
    `,
  });
}
