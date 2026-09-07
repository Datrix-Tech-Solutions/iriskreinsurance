import {
  renderAltButton,
  renderCardEmail,
  renderPrimaryButton,
  renderStandardEmail,
} from './shared';

export function renderEmailVerificationOtpTemplate(input: {
  appName: string;
  firstName: string;
  otp: string;
}): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #f97316;">${input.appName}</h2>
  <p>Hi ${input.firstName},</p>
  <p>Your verification code is:</p>
  <div style="background: #f97316; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 24px 0;">
    ${input.otp}
  </div>
  <p style="color: #666;">This code expires in 10 minutes. Do not share it with anyone.</p>
</div>`;
}

export function renderEmployeeInviteEmailTemplate(input: {
  firstName: string;
  tenantName: string;
  acceptInviteUrl?: string;
}): string {
  return renderStandardEmail({
    title: 'Invitation',
    heading: "You've been invited",
    bodyHtml: `
      <p>Hi ${input.firstName},</p>
      <p>
        Welcome to <strong>${input.tenantName}</strong>. Your HR administrator has set up your account on WorkPhelo.
      </p>
      <p>To get started, click the button below to set your password and log in for the first time.</p>
      ${
        input.acceptInviteUrl
          ? `<p style="margin:30px 0;">${renderPrimaryButton('Set My Password →', input.acceptInviteUrl)}</p>`
          : ''
      }
      <p style="color:#777;">
        This invitation link will expire in 48 hours. If it expires before you use it, contact your HR administrator and they will send you a new one. Contact 'Workphelo' for assistance.
      </p>
      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
      <p style="color:#555;">Once you're in, you'll be able to:</p>
      <ul style="color:#555; padding-left:20px; line-height:1.8;">
        <li>View your leave balance and request time off</li>
        <li>Clock in and out</li>
        <li>Access your payslips</li>
        <li>Update your personal information</li>
      </ul>
      <p style="margin-top:24px;">Welcome aboard.</p>
    `,
  });
}
export function renderTenantAdminWelcomeEmailTemplate(input: {
  firstName: string;
  tenantName: string;
  acceptInviteUrl?: string;
}): string {
  return renderStandardEmail({
    title: 'Welcome to WorkPhelo',
    heading: 'Welcome to your company workspace',
    bodyHtml: `
      <p>Hi ${input.firstName},</p>
      <p>
        Welcome to <strong>${input.tenantName}</strong> on WorkPhelo. Your company workspace is ready and your Company Admin account has been created.
      </p>
      <p>
        To activate your account, set your password using the button below. Once signed in, you will be able to complete your company setup and manage your team.
      </p>
      ${
        input.acceptInviteUrl
          ? `<p style="margin:30px 0;">${renderPrimaryButton('Activate Company Admin Account →', input.acceptInviteUrl)}</p>`
          : ''
      }
      <p style="color:#777;">
        This invitation link will expire in 1 week. If it expires before you use it, contact Workphelo team for a new invite.
      </p>
      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
      <p style="color:#555;">As Company Admin, you will be able to:</p>
      <ul style="color:#555; padding-left:20px; line-height:1.8;">
        <li>Finish setting up your company workspace</li>
        <li>Invite employees and assign access</li>
        <li>Configure HR settings, departments, and roles</li>
        <li>Manage your company operations in WorkPhelo</li>
      </ul>
      <p style="margin-top:24px;">We’re excited to have you on board.</p>
    `,
  });
}

export function renderPasswordResetLinkTemplate(input: {
  appName: string;
  firstName: string;
  resetLink?: string;
}): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #f97316;">${input.appName}</h2>
  <p>Hi ${input.firstName},</p>
  <p>We received a request to reset your password</p>
  <p style="font-weight: 600; margin-top: 24px;">Click the button to reset your password</p>
  ${
    input.resetLink
      ? `<div style="text-align: center; margin: 16px 0 24px;">${renderAltButton('Reset Password', input.resetLink)}</div>`
      : ''
  }
  <p style="color: #6b7280; font-size: 13px; margin-top: 8px;">This code and link expire in <strong>15 minutes</strong>.</p>
  <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">If you did not request a password reset, you can safely ignore this email.</p>
</div>`;
}

export function renderTerminationNoticeTemplate(input: {
  firstName: string;
  lastName: string;
  reasonLabel: string;
  formattedDate: string;
  platformLink?: string;
}): string {
  return renderCardEmail({
    title: 'Employment Notice',
    bodyHtml: `
      <p style="color: #374151;">Dear ${input.firstName} ${input.lastName},</p>
      <p style="color: #374151;">
        We are writing to formally notify you that your employment has ended
        due to: <strong>${input.reasonLabel}</strong>.
      </p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 24px 0; border-radius: 0 4px 4px 0;">
        <p style="color: #991b1b; margin: 0; font-size: 14px;">
          Your last working date is <strong>${input.formattedDate}</strong>.
        </p>
      </div>
      <p style="color: #374151;">
        Please ensure all company assets are returned and any outstanding
        clearance items are completed before your last working day.
      </p>
      <p style="color: #374151;">
        Your access to WorkPhelo and all associated systems will be revoked
        effective from your last working date.
      </p>
      ${
        input.platformLink
          ? `<p style="margin: 24px 0;">${renderPrimaryButton('Access your workspace', input.platformLink)}</p>`
          : ''
      }
      <p style="color: #6b7280; font-size: 13px; margin-top: 32px;">
        If you have any questions, please contact your HR department directly.
      </p>
    `,
  });
}
