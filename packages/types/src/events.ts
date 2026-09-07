// ── Event Infrastructure ───────────────────────────────────────────────────

/**
 * Metadata injected into every event envelope by the publisher.
 * Consumers can use messageId for idempotency and correlationId for tracing.
 */
export interface EventMeta {
  /** Unique ID for this specific message — use for idempotency checks */
  messageId: string;
  /** Traces a chain of events back to the originating request */
  correlationId: string;
  /** ISO timestamp of when the event was published */
  timestamp: string;
}

/** Utility: the full envelope shape a consumer receives */
export type WithMeta<T> = T & { _meta: EventMeta };

// ── Event Pattern Constants ────────────────────────────────────────────────

export const EventPatterns = {
  // Auth → HR
  HR_TENANT_APPROVED: 'hr.tenant_approved',
  HR_EMPLOYEE_ACTIVATED: 'hr.employee_activated',
  HR_PROVISION_TENANT_WORKSPACE: 'hr.provision_tenant_workspace',
  HR_LINK_EMPLOYEE_IDENTITY: 'hr.link_employee_identity',

  // HR → Auth
  AUTH_INVITE_EMPLOYEE: 'auth.invite_employee',
  AUTH_EMPLOYEE_OFFBOARDED: 'hr.employee_offboarded',
  AUTH_RESEND_EMPLOYEE_INVITE: 'auth.resend_employee_invite',
  AUTH_PROVISION_EMPLOYEE_INVITE: 'auth.provision_employee_invite',
  AUTH_DELETE_PENDING_EMPLOYEE_INVITE: 'auth.delete_pending_employee_invite',
  AUTH_DEACTIVATE_EMPLOYEE_ACCESS: 'auth.deactivate_employee_access',
  AUTH_RESOLVE_PERMISSION_RECIPIENTS: 'auth.resolve_permission_recipients',
  AUTH_GET_USER_STATUSES: 'auth.get_user_statuses',

  // Auth → Notification
  NOTIFICATION_EMAIL_VERIFICATION: 'notification.email_verification',
  NOTIFICATION_INVITE_USER: 'notification.invite_user',
  NOTIFICATION_PASSWORD_RESET_LINK: 'notification.password_reset_link',
  NOTIFICATION_PASSWORD_RESET_OTP: 'notification.password_reset_otp',
  NOTIFICATION_SMS_OTP: 'notification.sms_otp',
  NOTIFICATION_IN_APP_CREATE: 'notification.in_app.create',

  // Reinsurance Operations domain events
  REINSURANCE_COUNTERPARTY_CREATED: 'reinsurance.counterparty.created',
  REINSURANCE_COUNTERPARTY_UPDATED: 'reinsurance.counterparty.updated',
  REINSURANCE_COUNTERPARTY_DELETED: 'reinsurance.counterparty.deleted',
  REINSURANCE_PLACEMENT_CREATED: 'reinsurance.placement.created',
  REINSURANCE_PLACEMENT_UPDATED: 'reinsurance.placement.updated',
  REINSURANCE_PLACEMENT_DELETED: 'reinsurance.placement.deleted',
  REINSURANCE_PLACEMENT_STATUS_CHANGED: 'reinsurance.placement.status_changed',
  REINSURANCE_MAILBOX_CONNECTED: 'reinsurance.mailbox.connected',
  REINSURANCE_MAILBOX_SYNCED: 'reinsurance.mailbox.synced',
  REINSURANCE_MAILBOX_ARCHIVED: 'reinsurance.mailbox.archived',
  REINSURANCE_EMAIL_RECEIVED: 'reinsurance.email.received',
  REINSURANCE_EMAIL_SENT: 'reinsurance.email.sent',
  REINSURANCE_EMAIL_LINKED: 'reinsurance.email.linked',
  REINSURANCE_CLAIM_CREATED: 'reinsurance.claim.created',
  REINSURANCE_ACCOUNTING_OPERATION_EXECUTED:
    'reinsurance.accounting-operation.executed',

  // HR → Notification
  NOTIFY_EMPLOYEE_TERMINATION: 'notify.employee_termination',
  NOTIFY_RESIGNATION_SUBMITTED: 'notify.resignation_submitted',
  NOTIFY_LEAVE_REQUESTED: 'notify.leave_requested',
  NOTIFY_LEAVE_REVIEWED: 'notify.leave_reviewed',
  NOTIFY_LEAVE_CANCELLED: 'notify.leave_cancelled',
  NOTIFY_TIME_CORRECTION_SUBMITTED: 'notify.time_correction_submitted',
  NOTIFY_APPRAISAL_CYCLE_STARTED: 'notify.appraisal_cycle_started',
  NOTIFY_APPRAISAL_SELF_SUBMITTED: 'notify.appraisal_self_submitted',
  NOTIFY_APPRAISAL_MANAGER_REVIEWED: 'notify.appraisal_manager_reviewed',
  NOTIFY_APPRAISAL_SELF_REMINDER: 'notify.appraisal_self_reminder',
  NOTIFY_APPRAISAL_MANAGER_REMINDER: 'notify.appraisal_manager_reminder',
  NOTIFY_SCHEDULE_PUBLISHED: 'notify.schedule_published',
  NOTIFY_SHIFT_SWAP_REQUESTED: 'notify.shift_swap_requested',
  NOTIFY_SHIFT_SWAP_PENDING_MANAGER: 'notify.shift_swap_pending_manager',
  NOTIFY_SHIFT_SWAP_DECLINED: 'notify.shift_swap_declined',
  NOTIFY_SHIFT_SWAP_APPROVED: 'notify.shift_swap_approved',
  NOTIFY_SHIFT_SWAP_REJECTED: 'notify.shift_swap_rejected',
  NOTIFY_SHIFT_SWAP_EXPIRED: 'notify.shift_swap_expired',
  NOTIFY_ANNOUNCEMENT_PUBLISHED: 'notify.announcement_published',
  NOTIFY_PAYROLL_APPROVAL_REQUESTED: 'notify.payroll_approval_requested',
  NOTIFY_PAYROLL_DECISION: 'notify.payroll_decision',
} as const;

export type EventPattern = (typeof EventPatterns)[keyof typeof EventPatterns];

// ── Auth → HR Events ───────────────────────────────────────────────────────

export interface TenantApprovedEvent {
  tenantId: string;
  adminEmail: string;
  adminUserId?: string;
  country?: string;
  currency?: string;
}

export interface EmployeeActivatedEvent {
  tenantId: string;
  email: string;
  userId: string;
}

export interface ProvisionTenantWorkspaceCommand {
  tenantId: string;
  adminEmail: string;
  adminUserId?: string;
  country?: string;
  currency?: string;
}

export interface ProvisionTenantWorkspaceResult {
  provisioned: boolean;
}

export interface LinkEmployeeIdentityCommand {
  tenantId: string;
  email: string;
  userId: string;
}

export interface LinkEmployeeIdentityResult {
  linked: boolean;
  employeeId: string;
}

// ── HR → Auth Events ───────────────────────────────────────────────────────

export interface InviteEmployeeEvent {
  tenantId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface EmployeeOffboardedEvent {
  tenantId: string;
  userId: string;
  email: string;
  reason: string;
}

export interface ResendEmployeeInviteEvent {
  tenantId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName?: string;
}

export interface ProvisionEmployeeInviteCommand {
  tenantId: string;
  employeeId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ProvisionEmployeeInviteResult {
  userId: string;
  email: string;
  inviteSent: boolean;
}

export interface DeletePendingEmployeeInviteCommand {
  tenantId: string;
  userId?: string;
  email: string;
}

export interface DeletePendingEmployeeInviteResult {
  deleted: boolean;
}

export interface DeactivateEmployeeAccessCommand {
  tenantId: string;
  userId: string;
  email: string;
  reason: string;
}

export interface DeactivateEmployeeAccessResult {
  deactivated: boolean;
}

export interface ResolvePermissionRecipientsCommand {
  tenantId: string;
  resource: string;
  action: string;
  includeTenantAdmins?: boolean;
  activeOnly?: boolean;
}

export interface GetUserStatusesCommand {
  tenantId: string;
  userIds: string[];
}

export interface UserStatusSnapshot {
  userId: string;
  status: string;
}

export interface PermissionRecipient {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

// ── Auth/HR → Notification Events ─────────────────────────────────────────

export interface EmailVerificationEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  otp: string;
  tenantName: string;
}

export type InviteUserKind = 'EMPLOYEE' | 'TENANT_ADMIN';

export interface InviteUserEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  inviteToken?: string;
  acceptInviteUrl: string;
  tenantName: string;
  inviteKind?: InviteUserKind;
  isResend?: boolean;
}

export interface PasswordResetLinkEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  resetLink: string;
  otpCode?: string;
  tenantName: string;
}

export interface PasswordResetOtpEvent {
  userId?: string;
  tenantId?: string;
  phone: string;
  otp: string;
  firstName: string;
}

export interface SmsOtpEvent {
  userId?: string;
  tenantId?: string;
  phone: string;
  otp: string;
  context: string;
}

export type InAppNotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface InAppNotificationCreateEvent {
  eventId?: string;
  tenantId: string;
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  sourceService?: string;
  priority?: InAppNotificationPriority;
}

// ── Reinsurance → Core Audit Events ───────────────────────────────────────

export type ReinsuranceCounterpartyType = 'CEDANT' | 'REINSURER' | 'BROKER';

export interface ReinsuranceCounterpartyAuditEvent {
  tenantId: string;
  counterpartyId: string;
  counterpartyType: ReinsuranceCounterpartyType;
  counterpartyName: string;
  actorUserId: string;
  actorEmail?: string;
  actorRole?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

export type ReinsurancePlacementStatus =
  | 'DRAFT'
  | 'MARKETING'
  | 'PARTIALLY_PLACED'
  | 'PLACED'
  | 'CLOSING'
  | 'CLOSED'
  | 'DECLINED'
  | 'CANCELLED';

export interface ReinsurancePlacementAuditEvent {
  tenantId: string;
  placementId: string;
  reference: string;
  title: string;
  status: ReinsurancePlacementStatus;
  actorUserId: string;
  actorEmail?: string;
  actorRole?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

export interface ReinsurancePlacementStatusAuditEvent extends ReinsurancePlacementAuditEvent {
  previousStatus: ReinsurancePlacementStatus;
  nextStatus: ReinsurancePlacementStatus;
  note?: string;
}

export type ReinsuranceMailboxProvider = 'MICROSOFT_GRAPH' | 'GOOGLE_GMAIL';

export interface ReinsuranceMailboxAuditEvent {
  tenantId: string;
  mailboxConnectionId: string;
  provider: ReinsuranceMailboxProvider;
  emailAddress: string;
  actorUserId: string;
  actorEmail?: string;
  actorRole?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

export interface ReinsuranceMailboxSyncAuditEvent extends ReinsuranceMailboxAuditEvent {
  threadsSynced: number;
  messagesSynced: number;
  lastSyncedAt: string;
}

export interface ReinsuranceEmailLinkAuditEvent {
  tenantId: string;
  linkId: string;
  placementId: string;
  threadId: string;
  messageId?: string;
  actorUserId: string;
  actorEmail?: string;
  actorRole?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

export interface ReinsuranceAccountingOperationAuditEvent {
  tenantId: string;
  actorUserId: string;
  actorEmail?: string;
  actorRole?: string;
  operation: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
}

// ── HR → Notification Events ───────────────────────────────────────────────

export interface EmployeeTerminationEvent {
  tenantId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  reason: string;
  lastWorkingDate: string;
  platformLink?: string;
}

export interface ResignationSubmittedEvent {
  tenantId: string;
  /** Recipient email for a resignation approver notification */
  adminEmail: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  lastWorkingDate: string;
  reason?: string;
  additionalNotes?: string;
  detailLink?: string;
}

export interface LeaveRequestedEvent {
  tenantId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  /** Manager's email — null if the employee has no assigned manager */
  managerEmail: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  detailLink?: string;
  platformLink?: string;
  autoApproved?: boolean;
}

export interface LeaveReviewedEvent {
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
}

export interface LeaveCancelledEvent {
  tenantId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  /** Manager's email — null if no manager found */
  managerEmail: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  platformLink?: string;
}

export interface AppraisalSelfSubmittedEvent {
  tenantId: string;
  appraisalId: string;
  cycleId?: string;
  cycleTitle: string;
  employeeFirstName: string;
  employeeLastName: string;
  /** Manager's email — null if employee has no manager */
  managerEmail: string | null;
  managerFirstName: string | null;
  managerReviewLink?: string;
}

export interface AppraisalManagerReviewedEvent {
  tenantId: string;
  appraisalId: string;
  cycleId?: string;
  cycleTitle: string;
  employeeEmail: string;
  employeeFirstName: string;
  finalScore: number;
  finalRating: string;
  platformLink?: string;
}

export interface AppraisalCycleStartedEvent {
  tenantId: string;
  appraisalId: string;
  cycleId: string;
  cycleTitle: string;
  employeeEmail: string;
  employeeFirstName: string;
  selfAssessmentLink: string;
}

export interface AppraisalSelfReminderEvent {
  tenantId: string;
  appraisalId: string;
  cycleId: string;
  cycleTitle: string;
  employeeEmail: string;
  employeeFirstName: string;
  deadline: string;
  daysRemaining: number;
  selfAssessmentLink?: string;
}

export interface AppraisalManagerReminderEvent {
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
}

export interface TimeCorrectionSubmittedEvent {
  tenantId: string;
  correctionId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  attendanceDate: string;
  requestedIn: string | null;
  requestedOut: string | null;
  reason: string;
  /** Recipient email for a non-manager approver notification */
  adminEmail: string | null;
  /** Recipient email for a manager approver notification */
  managerEmail: string | null;
  detailLink?: string;
}

export interface SchedulePublishedEvent {
  tenantId: string;
  employeeId: string;
  employeeEmail: string;
  employeeFirstName: string;
  employeeLastName: string;
  /** ISO date — the effectiveFrom date of the new schedule */
  effectiveFrom: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  /** Link to the employee's schedule screen */
  scheduleLink: string;
}

export interface ShiftSwapRequestedEvent {
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
}

export interface ShiftSwapPendingManagerEvent {
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
}

export interface ShiftSwapDeclinedEvent {
  tenantId: string;
  shiftSwapId: string;
  employeeEmail: string;
  employeeFirstName: string;
  counterpartFullName: string;
  scheduleLink?: string;
}

export interface ShiftSwapApprovedEvent {
  tenantId: string;
  shiftSwapId: string;
  employeeEmail: string;
  employeeFirstName: string;
  counterpartFullName: string;
  requesterShiftLabel: string;
  targetShiftLabel: string;
  scheduleLink?: string;
}

export interface ShiftSwapRejectedEvent {
  tenantId: string;
  shiftSwapId: string;
  employeeEmail: string;
  employeeFirstName: string;
  counterpartFullName: string;
  rejectionReason: string;
  requesterShiftLabel: string;
  targetShiftLabel: string;
  scheduleLink?: string;
}

export interface ShiftSwapExpiredEvent {
  tenantId: string;
  shiftSwapId: string;
  employeeEmail: string;
  employeeFirstName: string;
  counterpartFullName: string;
  requesterShiftLabel: string;
  targetShiftLabel: string;
  scheduleLink?: string;
}

export interface AnnouncementRecipientEvent {
  employeeId: string;
  userId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
}

export type AnnouncementDeliveryChannel = 'IN_APP' | 'EMAIL' | 'SMS';

export interface PayrollApprovalRequestedRecipientEvent {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  source: 'APPROVER' | 'TENANT_ADMIN_ESCALATION';
}

export interface PayrollApprovalRequestedEvent {
  tenantId: string;
  payrollRunId: string;
  month: number;
  year: number;
  submittedByName: string;
  totalGross: string;
  totalNet: string;
  notes?: string;
  reviewLink?: string;
  recipients: PayrollApprovalRequestedRecipientEvent[];
}

export interface PayrollDecisionRecipientEvent {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PayrollDecisionEvent {
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
  recipients: PayrollDecisionRecipientEvent[];
}

export interface AnnouncementPublishedEvent {
  tenantId: string;
  announcementId: string;
  tenantName?: string;
  title: string;
  body: string;
  publishedAt: string;
  deliveryChannels?: AnnouncementDeliveryChannel[];
  platformLink?: string;
  recipients: AnnouncementRecipientEvent[];
}
