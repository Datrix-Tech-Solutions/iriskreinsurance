import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PermissionRecipient, RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import { ClockInDto } from './dto/clock-in.dto';
import { TimeCorrectionDto } from './dto/time-correction.dto';
import { ReviewCorrectionDto } from './dto/review-correction.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateShiftSwapDto } from './dto/create-shift-swap.dto';
import { RespondShiftSwapDto } from './dto/respond-shift-swap.dto';
import { ReviewShiftSwapDto } from './dto/review-shift-swap.dto';
import {
  assertHrAccess,
  getActorEmployee,
  hasPermissionRule,
  isCompanyAdminUser,
  isEmployeeSelfServiceUser,
} from '../auth/access-scope';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { NotificationsService } from '../notifications/notifications.service';
import {
  EmploymentStatus,
  Prisma,
  ShiftSchedule,
  ShiftSwapStatus,
  TimeCorrectionStatus,
} from '../../prisma/generated/client';

type TimeApprovalRecipient = {
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: 'MANAGER' | 'APPROVER';
};

type TimeCorrectionRecipients = {
  manager: TimeApprovalRecipient | null;
  approvers: TimeApprovalRecipient[];
  all: TimeApprovalRecipient[];
};

type ShiftSwapApprovalRecipients = {
  approvers: PermissionRecipient[];
  primaryApproverEmployeeId: string | null;
};

@Injectable()
export class TimeService {
  private readonly logger = new Logger(TimeService.name);
  private readonly swapSearchWindowDays = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMQPublisher,
    private readonly notificationsService: NotificationsService,
  ) {}

  private transformRecord(record: {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    hoursWorked: any;
    isLate: boolean;
    isOutsideSchedule: boolean;
    workMode: 'ONSITE' | 'REMOTE' | 'HYBRID' | null;
  }) {
    const status = record.clockOut ? 'CLOCKED_OUT' : 'CLOCKED_IN';
    const totalMinutes = record.clockOut
      ? Math.round(Number(record.hoursWorked) * 60)
      : 0;
    return {
      entryId: record.id,
      status,
      clockIn: record.clockIn.toISOString(),
      clockOut: record.clockOut?.toISOString() ?? null,
      breakStart: null,
      totalMinutes,
      breakMinutes: 0,
      isLate: record.isLate,
      isOutsideSchedule: record.isOutsideSchedule,
      workMode: record.workMode,
    };
  }

  private getDayBounds(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private parseDateOnly(value: string): Date {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid shift date');
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private formatWorkModeLabel(workMode?: string | null): string {
    if (!workMode) return 'Onsite';

    const normalized = workMode.toUpperCase();
    switch (normalized) {
      case 'REMOTE':
        return 'Remote';
      case 'HYBRID':
        return 'Hybrid';
      case 'ONSITE':
      default:
        return 'Onsite';
    }
  }

  private buildTimeCorrectionAppLink(tenantSlug: string, correctionId: string) {
    const base = process.env.FRONTEND_BASE_URL as string;
    return `${base}/${tenantSlug}/hr/time-clock?tab=corrections&correctionId=${encodeURIComponent(correctionId)}`;
  }

  private toTimeApprovalRecipient(
    recipient: PermissionRecipient,
    source: TimeApprovalRecipient['source'],
  ): TimeApprovalRecipient {
    return {
      userId: recipient.userId,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      source,
    };
  }

  private dedupeTimeApprovalRecipients(
    recipients: TimeApprovalRecipient[],
  ): TimeApprovalRecipient[] {
    const unique = new Map<string, TimeApprovalRecipient>();

    for (const recipient of recipients) {
      const key = recipient.userId || recipient.email.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, recipient);
      }
    }

    return [...unique.values()];
  }

  private dedupePermissionRecipients(
    recipients: PermissionRecipient[],
  ): PermissionRecipient[] {
    const unique = new Map<string, PermissionRecipient>();

    for (const recipient of recipients) {
      const key = recipient.userId || recipient.email.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, recipient);
      }
    }

    return [...unique.values()];
  }

  private canReviewShiftSwaps(actor: RequestUser): boolean {
    return (
      isCompanyAdminUser(actor) ||
      hasPermissionRule(actor, 'schedules:APPROVE') ||
      hasPermissionRule(actor, 'schedules:EDIT')
    );
  }

  private async resolveShiftSwapApprovalRecipients(
    tenantId: string,
    options?: { excludeUserIds?: Array<string | null | undefined> },
  ): Promise<ShiftSwapApprovalRecipients> {
    const excludedUserIds = new Set(
      (options?.excludeUserIds ?? []).filter((userId): userId is string =>
        Boolean(userId),
      ),
    );

    const resolve = async (action: 'APPROVE' | 'EDIT') =>
      this.dedupePermissionRecipients(
        (
          await this.publisher.authResolvePermissionRecipients({
            tenantId,
            resource: 'schedules',
            action,
            activeOnly: true,
          })
        ).filter((recipient) => !excludedUserIds.has(recipient.userId)),
      );

    let approvers = await resolve('APPROVE');

    if (approvers.length === 0) {
      approvers = await resolve('EDIT');
      if (approvers.length > 0) {
        this.logger.warn(
          `[shift-swap] No explicit schedules:APPROVE recipients configured for tenant ${tenantId}; falling back to schedules:EDIT approvers`,
        );
      }
    }

    if (approvers.length === 0) {
      return { approvers: [], primaryApproverEmployeeId: null };
    }

    const employeeLinks = await this.prisma.employee.findMany({
      where: {
        tenantId,
        userId: { in: approvers.map((recipient) => recipient.userId) },
        employmentStatus: {
          in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
        },
      },
      select: { id: true, userId: true },
    });

    const employeeByUserId = new Map(
      employeeLinks.map((employee) => [employee.userId, employee.id]),
    );
    const primaryApproverEmployeeId =
      approvers
        .map((recipient) => employeeByUserId.get(recipient.userId) ?? null)
        .find((employeeId): employeeId is string => Boolean(employeeId)) ??
      null;

    return { approvers, primaryApproverEmployeeId };
  }

  private async resolveTimeCorrectionManagerRecipient(
    tenantId: string,
    employee: {
      managerId: string | null;
      departmentId: string | null;
    },
  ): Promise<TimeApprovalRecipient | null> {
    let manager: {
      userId: string | null;
      email: string;
      firstName: string;
      lastName: string;
    } | null = null;

    if (employee.managerId) {
      manager = await this.prisma.employee.findFirst({
        where: { id: employee.managerId, tenantId },
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    if (!manager && employee.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: employee.departmentId, tenantId },
        select: { managerId: true },
      });

      if (department?.managerId) {
        manager = await this.prisma.employee.findFirst({
          where: { id: department.managerId, tenantId },
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });
      }
    }

    if (!manager?.email) {
      return null;
    }

    return {
      userId: manager.userId,
      email: manager.email,
      firstName: manager.firstName,
      lastName: manager.lastName,
      source: 'MANAGER',
    };
  }

  private async resolveTimeCorrectionRecipients(
    tenantId: string,
    employee: {
      id: string;
      userId?: string | null;
      firstName: string;
      lastName: string;
      managerId: string | null;
      departmentId: string | null;
    },
  ): Promise<TimeCorrectionRecipients> {
    const [manager, permissionRecipients] = await Promise.all([
      this.resolveTimeCorrectionManagerRecipient(tenantId, employee),
      this.publisher.authResolvePermissionRecipients({
        tenantId,
        resource: 'time-corrections',
        action: 'APPROVE',
        activeOnly: true,
      }),
    ]);

    const approvers = this.dedupeTimeApprovalRecipients(
      permissionRecipients
        .filter((recipient) => recipient.email)
        .filter((recipient) => recipient.userId !== employee.userId)
        .map((recipient) =>
          this.toTimeApprovalRecipient(recipient, 'APPROVER'),
        ),
    ).filter(
      (recipient) =>
        !manager ||
        (recipient.userId && manager.userId
          ? recipient.userId !== manager.userId
          : recipient.email.toLowerCase() !== manager.email.toLowerCase()),
    );

    const all = this.dedupeTimeApprovalRecipients(
      [manager, ...approvers].filter(
        (recipient): recipient is TimeApprovalRecipient => recipient !== null,
      ),
    );

    return { manager, approvers, all };
  }

  private async notifyStakeholdersOfTimeCorrectionSubmission(
    tenantId: string,
    tenantSlug: string,
    correction: {
      id: string;
      employeeId: string;
      date: Date;
      requestedIn: Date | null;
      requestedOut: Date | null;
      reason: string;
    },
    employee: {
      id: string;
      userId?: string | null;
      firstName: string;
      lastName: string;
      managerId: string | null;
      departmentId: string | null;
    },
    recipientsInput?: TimeCorrectionRecipients,
  ) {
    const recipients =
      recipientsInput ??
      (await this.resolveTimeCorrectionRecipients(tenantId, employee));

    if (recipients.all.length === 0) {
      this.logger.warn(
        `[time-correction] No manager or time correction approver recipients found for employee ${employee.id} in tenant ${tenantId}`,
      );
      return;
    }

    const attendanceDate = correction.date.toISOString().split('T')[0];
    const detailLink = this.buildTimeCorrectionAppLink(
      tenantSlug,
      correction.id,
    );
    const employeeFullName = `${employee.firstName} ${employee.lastName}`;
    const inAppMessage = `${employeeFullName} submitted a time correction request for ${attendanceDate}`;

    const publishResults = await Promise.allSettled(
      recipients.all.map((recipient) =>
        this.publisher.notificationTimeCorrectionSubmitted({
          tenantId,
          correctionId: correction.id,
          employeeId: correction.employeeId,
          employeeFirstName: employee.firstName,
          employeeLastName: employee.lastName,
          attendanceDate,
          requestedIn: correction.requestedIn?.toISOString() ?? null,
          requestedOut: correction.requestedOut?.toISOString() ?? null,
          reason: correction.reason,
          adminEmail: recipient.source === 'APPROVER' ? recipient.email : null,
          managerEmail: recipient.source === 'MANAGER' ? recipient.email : null,
          detailLink,
        }),
      ),
    );

    publishResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `[time-correction] Failed to publish notification event for correction ${correction.id} to ${recipients.all[index]?.email}`,
          result.reason,
        );
      }
    });

    const inAppRecipients = recipients.all
      .map((recipient) => recipient.userId)
      .filter((userId): userId is string => Boolean(userId));

    if (inAppRecipients.length > 0) {
      await this.notificationsService.createMany(
        inAppRecipients.map((userId) => ({
          tenantId,
          userId,
          type: 'TIME_CORRECTION_SUBMITTED',
          message: inAppMessage,
          link: detailLink,
        })),
      );
    }
  }

  private isFutureShiftDate(date: Date): boolean {
    const { start: today } = this.getDayBounds(new Date());
    return date.getTime() > today.getTime();
  }

  private formatShiftForMessage(
    date: Date,
    startTime: string,
    endTime: string,
    workMode?: string | null,
  ) {
    const workModeSuffix = workMode
      ? ` (${this.formatWorkModeLabel(workMode)})`
      : '';

    return `${date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })} ${startTime}-${endTime}${workModeSuffix}`;
  }

  private scheduleAppliesOnDate(schedule: ShiftSchedule, date: Date): boolean {
    const { start } = this.getDayBounds(date);
    const effectiveFrom = new Date(schedule.effectiveFrom);
    effectiveFrom.setHours(0, 0, 0, 0);
    const effectiveTo = schedule.effectiveTo
      ? new Date(schedule.effectiveTo)
      : null;
    effectiveTo?.setHours(0, 0, 0, 0);

    return (
      schedule.dayOfWeek.includes(start.getDay()) &&
      effectiveFrom.getTime() <= start.getTime() &&
      (!effectiveTo || effectiveTo.getTime() >= start.getTime())
    );
  }

  private listScheduleOccurrences(
    schedule: ShiftSchedule,
    from: Date,
    to: Date,
  ): Date[] {
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    while (cursor.getTime() <= end.getTime()) {
      if (this.scheduleAppliesOnDate(schedule, cursor)) {
        dates.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private async hasApprovedLeaveOnDate(
    tenantId: string,
    employeeId: string,
    date: Date,
  ): Promise<boolean> {
    const { start, end } = this.getDayBounds(date);
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });

    return Boolean(leave);
  }

  private async assertNoApprovedLeaveOnDate(
    tenantId: string,
    employeeId: string,
    date: Date,
    message: string,
  ) {
    const hasLeave = await this.hasApprovedLeaveOnDate(
      tenantId,
      employeeId,
      date,
    );
    if (hasLeave) {
      throw new BadRequestException(message);
    }
  }

  private async getScheduleForSwap(
    tenantId: string,
    scheduleId: string,
  ): Promise<
    ShiftSchedule & {
      employee: {
        id: string;
        userId: string | null;
        email: string;
        firstName: string;
        lastName: string;
        managerId: string | null;
        departmentId: string | null;
      };
    }
  > {
    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
            managerId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Shift schedule not found');
    }

    return schedule;
  }

  private areSameTeam(
    requester: { managerId: string | null; departmentId: string | null },
    colleague: { managerId: string | null; departmentId: string | null },
  ): boolean {
    if (requester.managerId && requester.managerId === colleague.managerId) {
      return true;
    }

    return Boolean(
      requester.departmentId &&
      colleague.departmentId &&
      requester.departmentId === colleague.departmentId,
    );
  }

  private async ensureNoActiveSwapConflict(
    tenantId: string,
    scheduleId: string,
    shiftDate: Date,
  ) {
    const existing = await this.prisma.shiftSwapRequest.findFirst({
      where: {
        tenantId,
        status: { in: ['PENDING_COLLEAGUE', 'PENDING_MANAGER'] },
        OR: [
          { requesterScheduleId: scheduleId, requesterShiftDate: shiftDate },
          { targetScheduleId: scheduleId, targetShiftDate: shiftDate },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'There is already an active swap request for one of these shifts',
      );
    }
  }

  private ensureValidTimeFormat(value: string, fieldLabel: string) {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      throw new BadRequestException(`${fieldLabel} must be in HH:MM format`);
    }

    const [hours, minutes] = value.split(':').map(Number);
    if (hours > 23 || minutes > 59) {
      throw new BadRequestException(`${fieldLabel} must be a valid time`);
    }
  }

  private validateSchedulePayload(args: {
    startTime?: string;
    endTime?: string;
    dayOfWeek?: number[];
    effectiveFrom?: string;
    effectiveTo?: string | null;
  }) {
    if (args.startTime) {
      this.ensureValidTimeFormat(args.startTime, 'Shift start time');
    }

    if (args.endTime) {
      this.ensureValidTimeFormat(args.endTime, 'Shift end time');
    }

    if (args.dayOfWeek) {
      if (args.dayOfWeek.length === 0) {
        throw new BadRequestException(
          'At least one day of week must be selected',
        );
      }

      const uniqueDays = new Set(args.dayOfWeek);
      if (uniqueDays.size !== args.dayOfWeek.length) {
        throw new BadRequestException(
          'Schedule days of week cannot contain duplicates',
        );
      }
    }

    if (args.effectiveFrom && args.effectiveTo) {
      const effectiveFrom = new Date(`${args.effectiveFrom}T00:00:00`);
      const effectiveTo = new Date(`${args.effectiveTo}T00:00:00`);
      if (effectiveTo.getTime() < effectiveFrom.getTime()) {
        throw new BadRequestException(
          'Schedule effective end date cannot be before the start date',
        );
      }
    }
  }

  private async assertShiftStillApplies(
    schedule: ShiftSchedule,
    date: Date,
    message: string,
  ) {
    if (!this.scheduleAppliesOnDate(schedule, date)) {
      throw new BadRequestException(message);
    }
  }

  private async assertNoApprovedLeaveForIncomingSwapAssignments(
    tenantId: string,
    swap: {
      requesterEmployeeId: string;
      requesterShiftDate: Date;
      targetEmployeeId: string;
      targetShiftDate: Date;
    },
  ) {
    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      swap.requesterEmployeeId,
      swap.targetShiftDate,
      `You have approved leave on ${swap.targetShiftDate.toLocaleDateString('en-GB')} and cannot take this swapped shift.`,
    );
    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      swap.targetEmployeeId,
      swap.requesterShiftDate,
      `The selected colleague has approved leave on ${swap.requesterShiftDate.toLocaleDateString('en-GB')} and cannot take your shift.`,
    );
  }

  private async assertNoAssignmentOverrideConflict(
    tx: Prisma.TransactionClient,
    scheduleId: string,
    shiftDate: Date,
    message: string,
  ) {
    const existing = await tx.shiftAssignmentOverride.findUnique({
      where: {
        scheduleId_shiftDate: {
          scheduleId,
          shiftDate,
        },
      },
      select: { id: true, swapRequestId: true },
    });

    if (existing) {
      throw new BadRequestException(message);
    }
  }

  private async notifyShiftSwapUsers(
    notifications: {
      tenantId: string;
      userId: string | null | undefined;
      type: string;
      message: string;
      link?: string;
    }[],
  ) {
    const filtered = notifications.filter(
      (
        notification,
      ): notification is {
        tenantId: string;
        userId: string;
        type: string;
        message: string;
        link?: string;
      } => Boolean(notification.userId),
    );

    if (filtered.length) {
      await this.notificationsService.createMany(filtered);
    }
  }

  private async logShiftSwapAction(args: {
    tenantId: string;
    shiftSwapRequestId: string;
    action:
      | 'REQUESTED'
      | 'COLLEAGUE_ACCEPTED'
      | 'COLLEAGUE_DECLINED'
      | 'MANAGER_APPROVED'
      | 'MANAGER_REJECTED'
      | 'EXPIRED';
    actorEmployeeId?: string | null;
    actorUserId?: string | null;
    note?: string | null;
  }) {
    await this.prisma.shiftSwapActionLog.create({
      data: {
        tenantId: args.tenantId,
        shiftSwapRequestId: args.shiftSwapRequestId,
        action: args.action,
        actorEmployeeId: args.actorEmployeeId ?? undefined,
        actorUserId: args.actorUserId ?? undefined,
        note: args.note ?? undefined,
      },
    });
  }

  private emitNotificationEvent(promise: Promise<void>, context: string) {
    void promise.catch((err) =>
      this.logger.error(
        `[shift-swap] Failed to publish ${context} notification event`,
        err,
      ),
    );
  }

  private buildSchedulingLink(
    tenantSlug: string,
    tab: 'my-schedule' | 'swap-requests' = 'my-schedule',
  ): string {
    const base = process.env.FRONTEND_BASE_URL as string;
    return `${base}/${tenantSlug}/hr/scheduling?tab=${tab}`;
  }

  private async getShiftSwapContacts(
    tenantId: string,
    swap: {
      requesterEmployeeId: string;
      targetEmployeeId: string;
      managerEmployeeId?: string | null;
    },
  ) {
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        id: {
          in: [
            swap.requesterEmployeeId,
            swap.targetEmployeeId,
            ...(swap.managerEmployeeId ? [swap.managerEmployeeId] : []),
          ],
        },
      },
      select: {
        id: true,
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const byId = new Map(employees.map((employee) => [employee.id, employee]));

    return {
      requester: byId.get(swap.requesterEmployeeId) ?? null,
      target: byId.get(swap.targetEmployeeId) ?? null,
      manager: swap.managerEmployeeId
        ? (byId.get(swap.managerEmployeeId) ?? null)
        : null,
    };
  }

  private isClockInConflictError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    return error.code === 'P2002' || error.code === 'P2034';
  }

  private async getActiveSchedule(
    tenantId: string,
    employeeId: string,
    date: Date,
  ) {
    const dayOfWeek = date.getDay();
    const { start } = this.getDayBounds(date);

    return this.prisma.shiftSchedule.findFirst({
      where: {
        tenantId,
        employeeId,
        dayOfWeek: { has: dayOfWeek },
        effectiveFrom: { lte: start },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
    });
  }

  private async ensureNotOnApprovedLeave(
    tenantId: string,
    employeeId: string,
    date: Date,
  ) {
    const { start, end } = this.getDayBounds(date);

    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        leaveType: {
          select: { name: true },
        },
      },
    });

    if (leave) {
      throw new BadRequestException(
        `You are on approved ${leave.leaveType.name} today and cannot clock in`,
      );
    }
  }

  private async resolveIsLate(
    tenantId: string,
    employeeId: string,
    clockInTime: Date,
  ): Promise<boolean> {
    const today = new Date(clockInTime);
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = clockInTime.getDay();

    const [schedule, config] = await Promise.all([
      this.prisma.shiftSchedule.findFirst({
        where: {
          tenantId,
          employeeId,
          dayOfWeek: { has: dayOfWeek },
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
      }),
      this.prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { lateArrivalThresholdMinutes: true },
      }),
    ]);

    if (!schedule) return false;

    const [h, m] = schedule.startTime.split(':').map(Number);
    const shiftStart = new Date(today);
    shiftStart.setHours(h, m, 0, 0);
    const threshold = config?.lateArrivalThresholdMinutes ?? 0;
    const allowedUntil = new Date(shiftStart.getTime() + threshold * 60_000);
    return clockInTime > allowedUntil;
  }

  private async getEmployeeByUserId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee)
      throw new NotFoundException(
        'Employee profile not found. Please contact your administrator.',
      );
    return employee;
  }

  async clockIn(
    tenantId: string,
    userId: string,
    dto: ClockInDto,
    ipAddress?: string,
  ) {
    const employee = await this.getEmployeeByUserId(tenantId, userId);
    const clockInTime = new Date();
    const { start: today } = this.getDayBounds(clockInTime);

    await this.ensureNotOnApprovedLeave(tenantId, employee.id, clockInTime);

    const existing = await this.prisma.clockRecord.findFirst({
      where: { tenantId, employeeId: employee.id, date: today, clockOut: null },
    });

    if (existing) throw new BadRequestException('Already clocked in for today');

    const activeSchedule = await this.getActiveSchedule(
      tenantId,
      employee.id,
      clockInTime,
    );
    const isLate = await this.resolveIsLate(tenantId, employee.id, clockInTime);

    const record = await (async () => {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const activeRecord = await tx.clockRecord.findFirst({
              where: {
                tenantId,
                employeeId: employee.id,
                date: today,
                clockOut: null,
              },
            });

            if (activeRecord) {
              throw new BadRequestException('Already clocked in for today');
            }

            return tx.clockRecord.create({
              data: {
                tenantId,
                employeeId: employee.id,
                clockIn: clockInTime,
                date: today,
                isLate,
                isOutsideSchedule: !activeSchedule,
                workMode: activeSchedule?.workMode ?? null,
                ipAddress,
                location: dto.location,
                note: dto.note,
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }

        if (this.isClockInConflictError(error)) {
          const activeRecord = await this.prisma.clockRecord.findFirst({
            where: {
              tenantId,
              employeeId: employee.id,
              date: today,
              clockOut: null,
            },
          });

          if (activeRecord) {
            throw new BadRequestException('Already clocked in for today');
          }
        }

        throw error;
      }
    })();

    return this.transformRecord(record);
  }

  async clockOut(tenantId: string, userId: string) {
    const employee = await this.getEmployeeByUserId(tenantId, userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.prisma.clockRecord.findFirst({
      where: { tenantId, employeeId: employee.id, date: today, clockOut: null },
    });

    if (!record)
      throw new BadRequestException('No active clock-in found for today');

    const clockOut = new Date();
    const milliseconds = clockOut.getTime() - record.clockIn.getTime();
    const hoursWorked = new Decimal(milliseconds)
      .div(3600000)
      .toDecimalPlaces(2)
      .toString();

    const updated = await this.prisma.clockRecord.update({
      where: { id: record.id },
      data: { clockOut, hoursWorked },
    });
    return this.transformRecord(updated);
  }

  private static readonly AUTO_CLOCK_OUT_HOURS = 20;

  @Cron(CronExpression.EVERY_HOUR)
  async autoClockOutStaleSessions() {
    const cutoff = new Date(
      Date.now() - TimeService.AUTO_CLOCK_OUT_HOURS * 3600000,
    );

    const staleRecords = await this.prisma.clockRecord.findMany({
      where: { clockOut: null, clockIn: { lt: cutoff } },
      select: { id: true, clockIn: true },
    });

    for (const record of staleRecords) {
      const clockOut = new Date(
        record.clockIn.getTime() + TimeService.AUTO_CLOCK_OUT_HOURS * 3600000,
      );
      await this.prisma.clockRecord.update({
        where: { id: record.id },
        data: {
          clockOut,
          hoursWorked: TimeService.AUTO_CLOCK_OUT_HOURS.toFixed(2),
          note: 'Auto-closed after 20 hours of inactivity',
        },
      });
    }
  }

  async getTodayStatus(tenantId: string, userId: string) {
    const employee = await this.getEmployeeByUserId(tenantId, userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const record = await this.prisma.clockRecord.findFirst({
      where: { tenantId, employeeId: employee.id, date: today },
    });
    if (!record) return null;
    return this.transformRecord(record);
  }

  async getMyAttendance(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) return [];
    return this.prisma.clockRecord.findMany({
      where: { tenantId, employeeId: employee.id },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getAttendance(
    tenantId: string,
    actor: RequestUser,
    filters: {
      employeeId?: string;
      from?: string;
      to?: string;
      departmentId?: string;
      status?: string;
      search?: string;
      page?: number;
      mine?: boolean;
    },
  ) {
    const where: Prisma.ClockRecordWhereInput = { tenantId };

    if (filters.mine) {
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      where.employeeId = actorEmployee.id;
    } else if (isCompanyAdminUser(actor)) {
      if (filters.employeeId) where.employeeId = filters.employeeId;
    } else if (isEmployeeSelfServiceUser(actor)) {
      if (hasPermissionRule(actor, 'attendance:VIEW')) {
        if (filters.employeeId) where.employeeId = filters.employeeId;
      } else {
        const actorEmployee = await getActorEmployee(
          this.prisma,
          tenantId,
          actor.id,
        );
        where.employeeId = actorEmployee.id;
      }
    } else {
      assertHrAccess(hasPermissionRule(actor, 'attendance:VIEW'));
      if (filters.employeeId) where.employeeId = filters.employeeId;
    }

    if (filters.from || filters.to) {
      where.date = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const trimmedSearch = filters.search?.trim();
    const employeeWhere: Prisma.EmployeeWhereInput = {
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
              { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
              {
                employeeNumber: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    if (filters.departmentId || trimmedSearch) {
      where.employee = { is: employeeWhere };
    }

    if (filters.status === 'CLOCKED_IN') {
      where.clockOut = null;
    } else if (filters.status === 'CLOCKED_OUT') {
      where.clockOut = { not: null };
    }

    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.clockRecord.count({ where }),
      this.prisma.clockRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
              jobTitle: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      total,
      page,
    };
  }

  async submitTimeCorrection(
    tenantId: string,
    userId: string,
    tenantSlug: string,
    dto: TimeCorrectionDto,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        managerId: true,
        departmentId: true,
      },
    });
    if (!employee)
      throw new NotFoundException(
        'Employee profile not found. Please contact your administrator.',
      );

    const correction = await this.prisma.timeCorrection.create({
      data: {
        tenantId,
        employeeId: employee.id,
        date: new Date(dto.date),
        requestedIn: dto.requestedIn ? new Date(dto.requestedIn) : undefined,
        requestedOut: dto.requestedOut ? new Date(dto.requestedOut) : undefined,
        reason: dto.reason,
      },
    });

    void this.notifyStakeholdersOfTimeCorrectionSubmission(
      tenantId,
      tenantSlug,
      correction,
      employee,
    );

    return correction;
  }

  async getTimeCorrections(
    tenantId: string,
    actor: RequestUser,
    filters: {
      employeeId?: string;
      status?: string;
    },
  ) {
    const where: Prisma.TimeCorrectionWhereInput = { tenantId };

    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status as TimeCorrectionStatus;

    return this.prisma.timeCorrection.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewTimeCorrection(
    tenantId: string,
    id: string,
    reviewer: RequestUser,
    dto: ReviewCorrectionDto,
  ) {
    const correction = await this.prisma.timeCorrection.findFirst({
      where: { id, tenantId },
    });
    if (!correction) throw new NotFoundException('Time correction not found');
    if (correction.status !== 'PENDING') {
      throw new BadRequestException(
        'This correction has already been reviewed',
      );
    }

    assertHrAccess(
      isCompanyAdminUser(reviewer) ||
        hasPermissionRule(reviewer, 'time-corrections:APPROVE'),
    );

    if (dto.action === 'APPROVED') {
      await this.applyApprovedCorrection(tenantId, correction);
    }

    return this.prisma.timeCorrection.update({
      where: { id },
      data: {
        status: dto.action,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        reviewNote: dto.note,
      },
    });
  }

  private async applyApprovedCorrection(
    tenantId: string,
    correction: {
      employeeId: string;
      date: Date;
      requestedIn: Date | null;
      requestedOut: Date | null;
    },
  ) {
    const { start, end } = this.getDayBounds(correction.date);

    const existing = await this.prisma.clockRecord.findFirst({
      where: {
        tenantId,
        employeeId: correction.employeeId,
        date: { gte: start, lte: end },
      },
      orderBy: { clockIn: 'desc' },
    });

    const clockIn = correction.requestedIn ?? existing?.clockIn ?? null;
    const clockOut = correction.requestedOut ?? existing?.clockOut ?? null;

    if (!clockIn) {
      throw new BadRequestException(
        'Cannot approve: no existing clock-in for this date and the request did not include a clock-in time.',
      );
    }

    if (clockOut && clockOut <= clockIn) {
      throw new BadRequestException(
        'Cannot approve: requested clock-out must be after clock-in.',
      );
    }

    const hoursWorked = clockOut
      ? new Decimal(clockOut.getTime() - clockIn.getTime())
          .div(3600000)
          .toDecimalPlaces(2)
          .toString()
      : null;

    if (existing) {
      await this.prisma.clockRecord.update({
        where: { id: existing.id },
        data: { clockIn, clockOut, hoursWorked },
      });
      return;
    }

    const activeSchedule = await this.getActiveSchedule(
      tenantId,
      correction.employeeId,
      clockIn,
    );
    const isLate = await this.resolveIsLate(
      tenantId,
      correction.employeeId,
      clockIn,
    );

    await this.prisma.clockRecord.create({
      data: {
        tenantId,
        employeeId: correction.employeeId,
        clockIn,
        clockOut,
        date: start,
        hoursWorked,
        isLate,
        isOutsideSchedule: !activeSchedule,
        workMode: activeSchedule?.workMode ?? null,
        note: 'Created from an approved time correction request',
      },
    });
  }

  private buildScheduleLink(tenantSlug: string): string {
    return this.buildSchedulingLink(tenantSlug, 'my-schedule');
  }

  async createSchedule(
    tenantId: string,
    actor: RequestUser,
    dto: CreateScheduleDto,
  ) {
    const canManageSchedules =
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'schedules:CREATE');
    assertHrAccess(canManageSchedules);
    this.validateSchedulePayload(dto);

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
      select: {
        id: true,
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const schedule = await this.prisma.shiftSchedule.create({
      data: {
        tenantId,
        createdBy: actor.id,
        employeeId: dto.employeeId,
        shiftType: dto.shiftType,
        workMode: dto.workMode ?? 'ONSITE',
        startTime: dto.startTime,
        endTime: dto.endTime,
        dayOfWeek: dto.dayOfWeek,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      },
    });

    const scheduleLink = this.buildScheduleLink(actor.tenantSlug);
    const formattedDate = new Date(
      dto.effectiveFrom + 'T00:00:00',
    ).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // In-app notification to the employee
    if (employee.userId) {
      void this.publisher
        .notificationInAppCreate({
          tenantId,
          recipientUserId: employee.userId,
          type: 'SCHEDULE_PUBLISHED',
          title: 'Schedule Published',
          message: `A new shift schedule has been published for you, effective ${formattedDate}. Check your schedule.`,
          link: scheduleLink,
          entityType: 'shiftSchedule',
          entityId: schedule.id,
          sourceService: 'hr-service',
        })
        .catch((error) =>
          this.logger.error(
            `Failed to publish schedule notification for employee ${employee.id}`,
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }

    // Schedule activity emails are intentionally disabled to control
    // notification spend; the in-app notification above remains active.

    return schedule;
  }

  async updateSchedule(
    tenantId: string,
    scheduleId: string,
    actor: RequestUser,
    dto: UpdateScheduleDto,
  ) {
    const canManageSchedules =
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'schedules:CREATE');
    assertHrAccess(canManageSchedules);

    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        employee: {
          select: { id: true, userId: true, firstName: true, lastName: true },
        },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    this.validateSchedulePayload({
      ...dto,
      effectiveFrom: schedule.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo:
        dto.effectiveTo !== undefined
          ? dto.effectiveTo || null
          : (schedule.effectiveTo?.toISOString().slice(0, 10) ?? null),
    });

    const updated = await this.prisma.shiftSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.shiftType && { shiftType: dto.shiftType }),
        ...(dto.workMode && { workMode: dto.workMode }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime && { endTime: dto.endTime }),
        ...(dto.effectiveTo !== undefined && {
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        }),
      },
    });

    const formattedDate = schedule.effectiveFrom.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (schedule.employee.userId) {
      void this.publisher
        .notificationInAppCreate({
          tenantId,
          recipientUserId: schedule.employee.userId,
          type: 'SCHEDULE_UPDATED',
          title: 'Schedule Updated',
          message: `Your shift on ${formattedDate} has been updated. Please check your schedule.`,
          link: this.buildScheduleLink(actor.tenantSlug),
          entityType: 'shiftSchedule',
          entityId: schedule.id,
          sourceService: 'hr-service',
        })
        .catch((error) =>
          this.logger.error(
            `Failed to publish schedule update notification for schedule ${schedule.id}`,
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }

    return updated;
  }

  async deleteSchedule(
    tenantId: string,
    scheduleId: string,
    actor: RequestUser,
  ) {
    const canManageSchedules =
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'schedules:CREATE');
    assertHrAccess(canManageSchedules);

    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        employee: {
          select: { id: true, userId: true, firstName: true, lastName: true },
        },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    await this.prisma.shiftSchedule.delete({ where: { id: scheduleId } });

    const formattedDate = schedule.effectiveFrom.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (schedule.employee.userId) {
      void this.publisher
        .notificationInAppCreate({
          tenantId,
          recipientUserId: schedule.employee.userId,
          type: 'SCHEDULE_REMOVED',
          title: 'Schedule Removed',
          message: `Your shift on ${formattedDate} has been removed from the schedule.`,
          link: this.buildScheduleLink(actor.tenantSlug),
          entityType: 'shiftSchedule',
          entityId: schedule.id,
          sourceService: 'hr-service',
        })
        .catch((error) =>
          this.logger.error(
            `Failed to publish schedule removal notification for schedule ${schedule.id}`,
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }

    return { message: 'Schedule deleted successfully' };
  }

  async getEligibleShiftSwapColleagues(
    tenantId: string,
    actor: RequestUser,
    params: { scheduleId: string; shiftDate: string; search?: string },
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const requesterDate = this.parseDateOnly(params.shiftDate);

    if (!this.isFutureShiftDate(requesterDate)) {
      throw new BadRequestException(
        "Only future shifts can be swapped. Today's shift and past shifts are not eligible.",
      );
    }

    const requesterSchedule = await this.getScheduleForSwap(
      tenantId,
      params.scheduleId,
    );

    if (requesterSchedule.employee.id !== actorEmployee.id) {
      throw new ForbiddenException(
        'You can only request a swap for your own shift',
      );
    }

    if (!this.scheduleAppliesOnDate(requesterSchedule, requesterDate)) {
      throw new BadRequestException(
        'The selected shift does not exist on that date',
      );
    }

    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      actorEmployee.id,
      requesterDate,
      'You cannot request a swap for a shift that falls on approved leave.',
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + this.swapSearchWindowDays);

    const trimmedSearch = params.search?.trim();
    const colleagues = await this.prisma.employee.findMany({
      where: {
        tenantId,
        id: { not: actorEmployee.id },
        employmentStatus: {
          in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
        },
        ...(requesterSchedule.employee.managerId
          ? { managerId: requesterSchedule.employee.managerId }
          : requesterSchedule.employee.departmentId
            ? { departmentId: requesterSchedule.employee.departmentId }
            : { id: '__no-team__' }),
        ...(trimmedSearch
          ? {
              OR: [
                { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
                { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        schedules: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const options: Array<{
      colleagueEmployeeId: string;
      colleagueName: string;
      scheduleId: string;
      shiftDate: string;
      shiftType: string;
      startTime: string;
      endTime: string;
      workMode: string;
    }> = [];

    for (const colleague of colleagues) {
      for (const schedule of colleague.schedules) {
        const occurrences = this.listScheduleOccurrences(
          schedule,
          today,
          windowEnd,
        );

        const hasApprovedLeaveDates = new Set(
          (
            await this.prisma.leaveRequest.findMany({
              where: {
                tenantId,
                employeeId: colleague.id,
                status: 'APPROVED',
                startDate: { lte: windowEnd },
                endDate: { gte: today },
              },
              select: { startDate: true, endDate: true },
            })
          ).flatMap((leave) => {
            const dates: string[] = [];
            const cursor = new Date(leave.startDate);
            cursor.setHours(0, 0, 0, 0);
            const end = new Date(leave.endDate);
            end.setHours(0, 0, 0, 0);
            while (cursor.getTime() <= end.getTime()) {
              dates.push(this.formatDateOnly(cursor));
              cursor.setDate(cursor.getDate() + 1);
            }
            return dates;
          }),
        );

        for (const occurrence of occurrences) {
          const occurrenceDate = this.formatDateOnly(occurrence);
          if (occurrenceDate === this.formatDateOnly(requesterDate)) continue;
          if (hasApprovedLeaveDates.has(occurrenceDate)) continue;
          if (
            await this.hasApprovedLeaveOnDate(
              tenantId,
              actorEmployee.id,
              occurrence,
            )
          ) {
            continue;
          }

          options.push({
            colleagueEmployeeId: colleague.id,
            colleagueName: `${colleague.firstName} ${colleague.lastName}`,
            scheduleId: schedule.id,
            shiftDate: occurrenceDate,
            shiftType: schedule.shiftType,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            workMode: schedule.workMode,
          });
        }
      }
    }

    return options;
  }

  async createShiftSwapRequest(
    tenantId: string,
    actor: RequestUser,
    dto: CreateShiftSwapDto,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const requesterDate = this.parseDateOnly(dto.requesterShiftDate);
    const targetDate = this.parseDateOnly(dto.targetShiftDate);

    if (
      !this.isFutureShiftDate(requesterDate) ||
      !this.isFutureShiftDate(targetDate)
    ) {
      throw new BadRequestException(
        "Only future shifts can be swapped. Today's shift and past shifts are not eligible.",
      );
    }

    if (
      this.formatDateOnly(requesterDate) === this.formatDateOnly(targetDate)
    ) {
      throw new BadRequestException(
        'Swap requests must be made against a colleague shift on a different date',
      );
    }

    const [requesterSchedule, targetSchedule] = await Promise.all([
      this.getScheduleForSwap(tenantId, dto.requesterScheduleId),
      this.getScheduleForSwap(tenantId, dto.targetScheduleId),
    ]);

    if (requesterSchedule.employee.id !== actorEmployee.id) {
      throw new ForbiddenException(
        'You can only request a swap for your own shift',
      );
    }

    if (targetSchedule.employee.id === actorEmployee.id) {
      throw new BadRequestException(
        'You cannot create a shift swap with another one of your own shifts',
      );
    }

    if (!this.scheduleAppliesOnDate(requesterSchedule, requesterDate)) {
      throw new BadRequestException(
        'Your selected shift does not exist on that date',
      );
    }

    if (!this.scheduleAppliesOnDate(targetSchedule, targetDate)) {
      throw new BadRequestException(
        "The colleague's selected shift does not exist on that date",
      );
    }

    if (
      !this.areSameTeam(requesterSchedule.employee, targetSchedule.employee)
    ) {
      throw new BadRequestException(
        'You can only swap with colleagues in your own team',
      );
    }

    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      actorEmployee.id,
      requesterDate,
      'You cannot request a swap for a shift that falls on approved leave.',
    );
    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      actorEmployee.id,
      targetDate,
      `You have approved leave on ${targetDate.toLocaleDateString('en-GB')} and cannot take this shift.`,
    );
    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      targetSchedule.employee.id,
      targetDate,
      'The selected colleague is on approved leave for their shift and cannot swap at this time.',
    );
    await this.assertNoApprovedLeaveForIncomingSwapAssignments(tenantId, {
      requesterEmployeeId: actorEmployee.id,
      requesterShiftDate: requesterDate,
      targetEmployeeId: targetSchedule.employee.id,
      targetShiftDate: targetDate,
    });

    await Promise.all([
      this.ensureNoActiveSwapConflict(
        tenantId,
        requesterSchedule.id,
        requesterDate,
      ),
      this.ensureNoActiveSwapConflict(tenantId, targetSchedule.id, targetDate),
    ]);

    const approvalRecipients = await this.resolveShiftSwapApprovalRecipients(
      tenantId,
      {
        excludeUserIds: [
          requesterSchedule.employee.userId,
          targetSchedule.employee.userId,
        ],
      },
    );

    if (approvalRecipients.approvers.length === 0) {
      throw new BadRequestException(
        'No shift swap approvers are currently configured for this company',
      );
    }

    const swap = await this.prisma.shiftSwapRequest.create({
      data: {
        tenantId,
        requesterEmployeeId: requesterSchedule.employee.id,
        requesterScheduleId: requesterSchedule.id,
        requesterShiftDate: requesterDate,
        targetEmployeeId: targetSchedule.employee.id,
        targetScheduleId: targetSchedule.id,
        targetShiftDate: targetDate,
        managerEmployeeId: approvalRecipients.primaryApproverEmployeeId,
        reason: dto.reason?.trim() || null,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      include: {
        requesterEmployee: {
          select: {
            firstName: true,
            lastName: true,
            userId: true,
            email: true,
          },
        },
        targetEmployee: {
          select: {
            firstName: true,
            lastName: true,
            userId: true,
            email: true,
          },
        },
        requesterSchedule: {
          select: { startTime: true, endTime: true },
        },
        targetSchedule: {
          select: { startTime: true, endTime: true },
        },
      },
    });

    const requesterName = `${swap.requesterEmployee.firstName} ${swap.requesterEmployee.lastName}`;
    const targetName = `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`;
    const requesterShift = this.formatShiftForMessage(
      requesterDate,
      requesterSchedule.startTime,
      requesterSchedule.endTime,
      requesterSchedule.workMode,
    );
    const targetShift = this.formatShiftForMessage(
      targetDate,
      targetSchedule.startTime,
      targetSchedule.endTime,
      targetSchedule.workMode,
    );
    const link = `/hr/scheduling?tab=my-schedule`;
    const scheduleLink = this.buildSchedulingLink(
      actor.tenantSlug,
      'my-schedule',
    );

    await this.notifyShiftSwapUsers([
      {
        tenantId,
        userId: swap.requesterEmployee.userId,
        type: 'SHIFT_SWAP_REQUESTED',
        message: `Your shift swap request with ${targetName} has been submitted and is awaiting their response.`,
        link,
      },
      {
        tenantId,
        userId: swap.targetEmployee.userId,
        type: 'SHIFT_SWAP_REQUESTED',
        message: `${requesterName} requested a shift swap: ${requesterShift} for ${targetShift}.`,
        link,
      },
    ]);

    await this.logShiftSwapAction({
      tenantId,
      shiftSwapRequestId: swap.id,
      action: 'REQUESTED',
      actorEmployeeId: actorEmployee.id,
      actorUserId: actor.id,
      note: dto.reason?.trim() || null,
    });

    this.emitNotificationEvent(
      this.publisher.notificationShiftSwapRequested({
        tenantId,
        shiftSwapId: swap.id,
        recipientEmail: requesterSchedule.employee.email,
        recipientFirstName: requesterSchedule.employee.firstName,
        recipientRole: 'REQUESTER',
        counterpartFullName: targetName,
        requesterFullName: requesterName,
        requesterShiftLabel: requesterShift,
        targetShiftLabel: targetShift,
        reason: dto.reason?.trim() || null,
        scheduleLink,
      }),
      'shift_swap_requested(requester)',
    );

    this.emitNotificationEvent(
      this.publisher.notificationShiftSwapRequested({
        tenantId,
        shiftSwapId: swap.id,
        recipientEmail: targetSchedule.employee.email,
        recipientFirstName: targetSchedule.employee.firstName,
        recipientRole: 'COLLEAGUE',
        counterpartFullName: requesterName,
        requesterFullName: requesterName,
        requesterShiftLabel: requesterShift,
        targetShiftLabel: targetShift,
        reason: dto.reason?.trim() || null,
        scheduleLink,
      }),
      'shift_swap_requested(colleague)',
    );

    return swap;
  }

  async getMyShiftSwapRequests(tenantId: string, actor: RequestUser) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );

    return this.prisma.shiftSwapRequest.findMany({
      where: {
        tenantId,
        OR: [
          { requesterEmployeeId: actorEmployee.id },
          { targetEmployeeId: actorEmployee.id },
        ],
      },
      include: {
        requesterEmployee: {
          select: { firstName: true, lastName: true },
        },
        targetEmployee: {
          select: { firstName: true, lastName: true },
        },
        requesterSchedule: {
          select: {
            shiftType: true,
            startTime: true,
            endTime: true,
            workMode: true,
          },
        },
        targetSchedule: {
          select: {
            shiftType: true,
            startTime: true,
            endTime: true,
            workMode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingManagerShiftSwaps(
    tenantId: string,
    actor: RequestUser,
    status?: string,
  ) {
    assertHrAccess(this.canReviewShiftSwaps(actor));

    const requestedStatus =
      status && status !== 'PENDING' ? status : ShiftSwapStatus.PENDING_MANAGER;
    const allowedStatuses = new Set<ShiftSwapStatus>([
      ShiftSwapStatus.PENDING_MANAGER,
      ShiftSwapStatus.APPROVED,
      ShiftSwapStatus.REJECTED,
    ]);

    if (!allowedStatuses.has(requestedStatus as ShiftSwapStatus)) {
      throw new BadRequestException('Unsupported shift swap status filter');
    }

    return this.prisma.shiftSwapRequest.findMany({
      where: {
        tenantId,
        status: requestedStatus as ShiftSwapStatus,
      },
      include: {
        requesterEmployee: {
          select: { firstName: true, lastName: true },
        },
        targetEmployee: {
          select: { firstName: true, lastName: true },
        },
        managerEmployee: {
          select: { firstName: true, lastName: true },
        },
        requesterSchedule: true,
        targetSchedule: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getShiftSwapRequest(
    tenantId: string,
    actor: RequestUser,
    shiftSwapId: string,
  ) {
    const swap = await this.prisma.shiftSwapRequest.findFirst({
      where: { id: shiftSwapId, tenantId },
      include: {
        requesterEmployee: {
          select: { id: true, firstName: true, lastName: true, userId: true },
        },
        targetEmployee: {
          select: { id: true, firstName: true, lastName: true, userId: true },
        },
        managerEmployee: {
          select: { id: true, firstName: true, lastName: true, userId: true },
        },
        requesterSchedule: true,
        targetSchedule: true,
      },
    });

    if (!swap) {
      throw new NotFoundException('Shift swap request not found');
    }

    if (!isCompanyAdminUser(actor)) {
      const actorEmployee = await this.prisma.employee.findFirst({
        where: { tenantId, userId: actor.id },
        select: { id: true },
      });

      assertHrAccess(
        swap.requesterEmployeeId === actorEmployee?.id ||
          swap.targetEmployeeId === actorEmployee?.id ||
          this.canReviewShiftSwaps(actor),
      );
    }

    return swap;
  }

  async respondToShiftSwap(
    tenantId: string,
    actor: RequestUser,
    shiftSwapId: string,
    dto: RespondShiftSwapDto,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const swap = await this.getShiftSwapRequest(tenantId, actor, shiftSwapId);

    if (swap.targetEmployeeId !== actorEmployee.id) {
      throw new ForbiddenException(
        'Only the selected colleague can respond to this shift swap',
      );
    }

    if (swap.status !== ShiftSwapStatus.PENDING_COLLEAGUE) {
      throw new BadRequestException(
        'This shift swap is no longer awaiting colleague response',
      );
    }

    if (swap.expiresAt.getTime() < Date.now()) {
      await this.prisma.shiftSwapRequest.update({
        where: { id: swap.id },
        data: { status: ShiftSwapStatus.EXPIRED },
      });
      await this.logShiftSwapAction({
        tenantId,
        shiftSwapRequestId: swap.id,
        action: 'EXPIRED',
      });
      throw new BadRequestException('This shift swap request has expired');
    }

    const requesterName = `${swap.requesterEmployee.firstName} ${swap.requesterEmployee.lastName}`;
    const targetName = `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`;
    const link = `/hr/scheduling?tab=my-schedule`;
    const scheduleLink = this.buildSchedulingLink(
      actor.tenantSlug,
      'my-schedule',
    );
    const managerReviewLink = this.buildSchedulingLink(
      actor.tenantSlug,
      'swap-requests',
    );
    const requesterShift = this.formatShiftForMessage(
      swap.requesterShiftDate,
      swap.requesterSchedule.startTime,
      swap.requesterSchedule.endTime,
      swap.requesterSchedule.workMode,
    );
    const targetShift = this.formatShiftForMessage(
      swap.targetShiftDate,
      swap.targetSchedule.startTime,
      swap.targetSchedule.endTime,
      swap.targetSchedule.workMode,
    );
    const contacts = await this.getShiftSwapContacts(tenantId, swap);

    await this.assertShiftStillApplies(
      swap.requesterSchedule,
      swap.requesterShiftDate,
      'The requester shift is no longer valid for the selected date',
    );
    await this.assertShiftStillApplies(
      swap.targetSchedule,
      swap.targetShiftDate,
      "The colleague's shift is no longer valid for the selected date",
    );
    await this.assertNoApprovedLeaveForIncomingSwapAssignments(tenantId, swap);

    if (dto.action === 'DECLINE') {
      const declined = await this.prisma.shiftSwapRequest.update({
        where: { id: swap.id },
        data: {
          status: ShiftSwapStatus.DECLINED,
          colleagueRespondedAt: new Date(),
        },
      });

      await this.notifyShiftSwapUsers([
        {
          tenantId,
          userId: swap.requesterEmployee.userId,
          type: 'SHIFT_SWAP_DECLINED',
          message: `${targetName} declined your shift swap request.`,
          link,
        },
        {
          tenantId,
          userId: swap.targetEmployee.userId,
          type: 'SHIFT_SWAP_DECLINED',
          message: `You declined the shift swap request from ${requesterName}.`,
          link,
        },
      ]);

      await this.logShiftSwapAction({
        tenantId,
        shiftSwapRequestId: swap.id,
        action: 'COLLEAGUE_DECLINED',
        actorEmployeeId: actorEmployee.id,
        actorUserId: actor.id,
      });

      if (contacts.requester?.email) {
        this.emitNotificationEvent(
          this.publisher.notificationShiftSwapDeclined({
            tenantId,
            shiftSwapId: swap.id,
            employeeEmail: contacts.requester.email,
            employeeFirstName: contacts.requester.firstName,
            counterpartFullName: targetName,
            scheduleLink,
          }),
          'shift_swap_declined(requester)',
        );
      }

      if (contacts.target?.email) {
        this.emitNotificationEvent(
          this.publisher.notificationShiftSwapDeclined({
            tenantId,
            shiftSwapId: swap.id,
            employeeEmail: contacts.target.email,
            employeeFirstName: contacts.target.firstName,
            counterpartFullName: requesterName,
            scheduleLink,
          }),
          'shift_swap_declined(colleague)',
        );
      }

      return declined;
    }

    const approvalRecipients = await this.resolveShiftSwapApprovalRecipients(
      tenantId,
      {
        excludeUserIds: [
          swap.requesterEmployee.userId,
          swap.targetEmployee.userId,
        ],
      },
    );
    const accepted = await this.prisma.shiftSwapRequest.update({
      where: { id: swap.id },
      data: {
        status: ShiftSwapStatus.PENDING_MANAGER,
        colleagueRespondedAt: new Date(),
        managerEmployeeId:
          approvalRecipients.primaryApproverEmployeeId ??
          swap.managerEmployeeId,
      },
    });

    await this.notifyShiftSwapUsers([
      {
        tenantId,
        userId: swap.requesterEmployee.userId,
        type: 'SHIFT_SWAP_PENDING_MANAGER',
        message: `${targetName} accepted your shift swap request. It is now awaiting approver review.`,
        link,
      },
      {
        tenantId,
        userId: swap.targetEmployee.userId,
        type: 'SHIFT_SWAP_PENDING_MANAGER',
        message: `You accepted the shift swap request from ${requesterName}. It is now awaiting approver review.`,
        link,
      },
      ...approvalRecipients.approvers.map((recipient) => ({
        tenantId,
        userId: recipient.userId,
        type: 'SHIFT_SWAP_PENDING_MANAGER',
        message: `A shift swap between ${requesterName} and ${targetName} is awaiting your approval.`,
        link: '/hr/scheduling?tab=swap-requests',
      })),
    ]);

    await this.logShiftSwapAction({
      tenantId,
      shiftSwapRequestId: swap.id,
      action: 'COLLEAGUE_ACCEPTED',
      actorEmployeeId: actorEmployee.id,
      actorUserId: actor.id,
    });

    if (approvalRecipients.approvers.length === 0) {
      this.logger.warn(
        `[shift-swap] Shift swap ${swap.id} reached approver review, but no approver recipients are currently configured for tenant ${tenantId}`,
      );
    } else {
      for (const recipient of approvalRecipients.approvers) {
        this.emitNotificationEvent(
          this.publisher.notificationShiftSwapPendingManager({
            tenantId,
            shiftSwapId: swap.id,
            managerEmail: recipient.email,
            managerFirstName: recipient.firstName,
            requesterFullName: requesterName,
            targetFullName: targetName,
            requesterShiftLabel: requesterShift,
            targetShiftLabel: targetShift,
            reason: swap.reason,
            reviewLink: managerReviewLink,
          }),
          `shift_swap_pending_manager(${recipient.email})`,
        );
      }
    }

    return accepted;
  }

  async reviewShiftSwap(
    tenantId: string,
    actor: RequestUser,
    shiftSwapId: string,
    dto: ReviewShiftSwapDto,
  ) {
    const actorEmployee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: actor.id },
      select: { id: true },
    });
    const swap = await this.getShiftSwapRequest(tenantId, actor, shiftSwapId);

    assertHrAccess(this.canReviewShiftSwaps(actor));

    if (swap.status !== ShiftSwapStatus.PENDING_MANAGER) {
      throw new BadRequestException(
        'This shift swap is not awaiting approver review',
      );
    }

    const requesterName = `${swap.requesterEmployee.firstName} ${swap.requesterEmployee.lastName}`;
    const targetName = `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`;
    const link = `/hr/scheduling?tab=my-schedule`;
    const scheduleLink = this.buildSchedulingLink(
      actor.tenantSlug,
      'my-schedule',
    );
    const requesterShift = this.formatShiftForMessage(
      swap.requesterShiftDate,
      swap.requesterSchedule.startTime,
      swap.requesterSchedule.endTime,
      swap.requesterSchedule.workMode,
    );
    const targetShift = this.formatShiftForMessage(
      swap.targetShiftDate,
      swap.targetSchedule.startTime,
      swap.targetSchedule.endTime,
      swap.targetSchedule.workMode,
    );
    const contacts = await this.getShiftSwapContacts(tenantId, swap);

    await this.assertShiftStillApplies(
      swap.requesterSchedule,
      swap.requesterShiftDate,
      'The requester shift is no longer valid for the selected date',
    );
    await this.assertShiftStillApplies(
      swap.targetSchedule,
      swap.targetShiftDate,
      "The colleague's shift is no longer valid for the selected date",
    );
    await this.assertNoApprovedLeaveForIncomingSwapAssignments(tenantId, swap);

    if (dto.action === 'REJECT') {
      if (!dto.reason?.trim()) {
        throw new BadRequestException('A rejection reason is required');
      }

      const rejected = await this.prisma.shiftSwapRequest.update({
        where: { id: swap.id },
        data: {
          status: ShiftSwapStatus.REJECTED,
          managerDecisionAt: new Date(),
          managerEmployeeId: actorEmployee?.id ?? swap.managerEmployeeId,
          managerRejectionReason: dto.reason.trim(),
        },
      });

      await this.notifyShiftSwapUsers([
        {
          tenantId,
          userId: swap.requesterEmployee.userId,
          type: 'SHIFT_SWAP_REJECTED',
          message: `Your shift swap request with ${targetName} was rejected. Reason: ${dto.reason.trim()}`,
          link,
        },
        {
          tenantId,
          userId: swap.targetEmployee.userId,
          type: 'SHIFT_SWAP_REJECTED',
          message: `The shift swap request with ${requesterName} was rejected. Reason: ${dto.reason.trim()}`,
          link,
        },
      ]);

      await this.logShiftSwapAction({
        tenantId,
        shiftSwapRequestId: swap.id,
        action: 'MANAGER_REJECTED',
        actorEmployeeId: actorEmployee?.id,
        actorUserId: actor.id,
        note: dto.reason.trim(),
      });

      if (contacts.requester?.email) {
        this.emitNotificationEvent(
          this.publisher.notificationShiftSwapRejected({
            tenantId,
            shiftSwapId: swap.id,
            employeeEmail: contacts.requester.email,
            employeeFirstName: contacts.requester.firstName,
            counterpartFullName: targetName,
            rejectionReason: dto.reason.trim(),
            requesterShiftLabel: requesterShift,
            targetShiftLabel: targetShift,
            scheduleLink,
          }),
          'shift_swap_rejected(requester)',
        );
      }

      if (contacts.target?.email) {
        this.emitNotificationEvent(
          this.publisher.notificationShiftSwapRejected({
            tenantId,
            shiftSwapId: swap.id,
            employeeEmail: contacts.target.email,
            employeeFirstName: contacts.target.firstName,
            counterpartFullName: requesterName,
            rejectionReason: dto.reason.trim(),
            requesterShiftLabel: requesterShift,
            targetShiftLabel: targetShift,
            scheduleLink,
          }),
          'shift_swap_rejected(colleague)',
        );
      }

      return rejected;
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      await this.assertNoAssignmentOverrideConflict(
        tx,
        swap.requesterScheduleId,
        swap.requesterShiftDate,
        'The requester shift already has an override and cannot be swapped anymore',
      );
      await this.assertNoAssignmentOverrideConflict(
        tx,
        swap.targetScheduleId,
        swap.targetShiftDate,
        "The colleague's shift already has an override and cannot be swapped anymore",
      );

      await tx.shiftAssignmentOverride.create({
        data: {
          tenantId,
          scheduleId: swap.requesterScheduleId,
          shiftDate: swap.requesterShiftDate,
          assignedEmployeeId: swap.targetEmployeeId,
          swapRequestId: swap.id,
        },
      });

      await tx.shiftAssignmentOverride.create({
        data: {
          tenantId,
          scheduleId: swap.targetScheduleId,
          shiftDate: swap.targetShiftDate,
          assignedEmployeeId: swap.requesterEmployeeId,
          swapRequestId: swap.id,
        },
      });

      return tx.shiftSwapRequest.update({
        where: { id: swap.id },
        data: {
          status: ShiftSwapStatus.APPROVED,
          managerDecisionAt: new Date(),
          managerEmployeeId: actorEmployee?.id ?? swap.managerEmployeeId,
        },
      });
    });

    await this.notifyShiftSwapUsers([
      {
        tenantId,
        userId: swap.requesterEmployee.userId,
        type: 'SHIFT_SWAP_APPROVED',
        message: `Your shift swap request with ${targetName} was approved.`,
        link,
      },
      {
        tenantId,
        userId: swap.targetEmployee.userId,
        type: 'SHIFT_SWAP_APPROVED',
        message: `The shift swap request with ${requesterName} was approved.`,
        link,
      },
    ]);

    await this.logShiftSwapAction({
      tenantId,
      shiftSwapRequestId: swap.id,
      action: 'MANAGER_APPROVED',
      actorEmployeeId: actorEmployee?.id,
      actorUserId: actor.id,
    });

    if (contacts.requester?.email) {
      this.emitNotificationEvent(
        this.publisher.notificationShiftSwapApproved({
          tenantId,
          shiftSwapId: swap.id,
          employeeEmail: contacts.requester.email,
          employeeFirstName: contacts.requester.firstName,
          counterpartFullName: targetName,
          requesterShiftLabel: requesterShift,
          targetShiftLabel: targetShift,
          scheduleLink,
        }),
        'shift_swap_approved(requester)',
      );
    }

    if (contacts.target?.email) {
      this.emitNotificationEvent(
        this.publisher.notificationShiftSwapApproved({
          tenantId,
          shiftSwapId: swap.id,
          employeeEmail: contacts.target.email,
          employeeFirstName: contacts.target.firstName,
          counterpartFullName: requesterName,
          requesterShiftLabel: requesterShift,
          targetShiftLabel: targetShift,
          scheduleLink,
        }),
        'shift_swap_approved(colleague)',
      );
    }

    return approved;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingShiftSwapRequests() {
    const expiredRequests = await this.prisma.shiftSwapRequest.findMany({
      where: {
        status: ShiftSwapStatus.PENDING_COLLEAGUE,
        expiresAt: { lt: new Date() },
      },
      include: {
        requesterEmployee: {
          select: {
            firstName: true,
            lastName: true,
            userId: true,
            email: true,
          },
        },
        targetEmployee: {
          select: {
            firstName: true,
            lastName: true,
            userId: true,
            email: true,
          },
        },
        requesterSchedule: {
          select: { startTime: true, endTime: true, workMode: true },
        },
        targetSchedule: {
          select: { startTime: true, endTime: true, workMode: true },
        },
      },
    });

    if (!expiredRequests.length) return;

    await this.prisma.shiftSwapRequest.updateMany({
      where: {
        id: { in: expiredRequests.map((request) => request.id) },
      },
      data: { status: ShiftSwapStatus.EXPIRED },
    });

    for (const request of expiredRequests) {
      const requesterName = `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`;
      const targetName = `${request.targetEmployee.firstName} ${request.targetEmployee.lastName}`;
      const requesterShift = this.formatShiftForMessage(
        request.requesterShiftDate,
        request.requesterSchedule.startTime,
        request.requesterSchedule.endTime,
        request.requesterSchedule.workMode,
      );
      const targetShift = this.formatShiftForMessage(
        request.targetShiftDate,
        request.targetSchedule.startTime,
        request.targetSchedule.endTime,
        request.targetSchedule.workMode,
      );
      await this.notifyShiftSwapUsers([
        {
          tenantId: request.tenantId,
          userId: request.requesterEmployee.userId,
          type: 'SHIFT_SWAP_EXPIRED',
          message: `Your shift swap request with ${targetName} expired without a response.`,
          link: '/hr/scheduling?tab=my-schedule',
        },
        {
          tenantId: request.tenantId,
          userId: request.targetEmployee.userId,
          type: 'SHIFT_SWAP_EXPIRED',
          message: `The shift swap request from ${requesterName} expired without a response.`,
          link: '/hr/scheduling?tab=my-schedule',
        },
      ]);

      await this.logShiftSwapAction({
        tenantId: request.tenantId,
        shiftSwapRequestId: request.id,
        action: 'EXPIRED',
      });

      if (request.requesterEmployee.email) {
        this.emitNotificationEvent(
          this.publisher.notificationShiftSwapExpired({
            tenantId: request.tenantId,
            shiftSwapId: request.id,
            employeeEmail: request.requesterEmployee.email,
            employeeFirstName: request.requesterEmployee.firstName,
            counterpartFullName: targetName,
            requesterShiftLabel: requesterShift,
            targetShiftLabel: targetShift,
          }),
          'shift_swap_expired(requester)',
        );
      }

      if (request.targetEmployee.email) {
        this.emitNotificationEvent(
          this.publisher.notificationShiftSwapExpired({
            tenantId: request.tenantId,
            shiftSwapId: request.id,
            employeeEmail: request.targetEmployee.email,
            employeeFirstName: request.targetEmployee.firstName,
            counterpartFullName: requesterName,
            requesterShiftLabel: requesterShift,
            targetShiftLabel: targetShift,
          }),
          'shift_swap_expired(colleague)',
        );
      }
    }
  }

  async getMySchedule(
    tenantId: string,
    actor: RequestUser,
    filters: { from?: string; to?: string },
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );

    const fromDate = filters.from
      ? new Date(filters.from + 'T00:00:00')
      : undefined;
    const toDate = filters.to ? new Date(filters.to + 'T23:59:59') : undefined;

    const [
      schedules,
      leaveRequests,
      publicHolidays,
      assignmentOverrides,
      shiftSwaps,
    ] = await Promise.all([
      this.prisma.shiftSchedule.findMany({
        where: {
          tenantId,
          employeeId: actorEmployee.id,
          ...(fromDate && {
            effectiveFrom: { lte: toDate ?? new Date('2099-12-31') },
          }),
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: fromDate ?? new Date('2000-01-01') } },
          ],
        },
        orderBy: { effectiveFrom: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          employeeId: actorEmployee.id,
          status: 'APPROVED',
          ...(fromDate && { endDate: { gte: fromDate } }),
          ...(toDate && { startDate: { lte: toDate } }),
        },
        include: { leaveType: { select: { name: true } } },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.publicHoliday.findMany({
        where: {
          tenantId,
          OR: [
            {
              date: {
                ...(fromDate && { gte: fromDate }),
                ...(toDate && { lte: toDate }),
              },
            },
            {
              observedDate: {
                ...(fromDate && { gte: fromDate }),
                ...(toDate && { lte: toDate }),
              },
            },
          ],
        },
        orderBy: { observedDate: 'asc' },
      }),
      this.prisma.shiftAssignmentOverride.findMany({
        where: {
          tenantId,
          assignedEmployeeId: actorEmployee.id,
          ...(fromDate && { shiftDate: { gte: fromDate } }),
          ...(toDate && { shiftDate: { lte: toDate } }),
        },
        include: {
          schedule: {
            select: {
              id: true,
              shiftType: true,
              startTime: true,
              endTime: true,
              workMode: true,
            },
          },
        },
        orderBy: { shiftDate: 'asc' },
      }),
      this.prisma.shiftSwapRequest.findMany({
        where: {
          tenantId,
          AND: [
            {
              OR: [
                { requesterEmployeeId: actorEmployee.id },
                { targetEmployeeId: actorEmployee.id },
              ],
            },
            ...(fromDate
              ? [
                  {
                    OR: [
                      { requesterShiftDate: { gte: fromDate } },
                      { targetShiftDate: { gte: fromDate } },
                    ],
                  },
                ]
              : []),
            ...(toDate
              ? [
                  {
                    OR: [
                      { requesterShiftDate: { lte: toDate } },
                      { targetShiftDate: { lte: toDate } },
                    ],
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          requesterEmployeeId: true,
          targetEmployeeId: true,
          requesterScheduleId: true,
          requesterShiftDate: true,
          targetScheduleId: true,
          targetShiftDate: true,
          status: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      employeeId: actorEmployee.id,
      schedules,
      leaveBlocks: leaveRequests.map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        totalDays: r.totalDays,
        leaveType: r.leaveType.name,
      })),
      publicHolidays: publicHolidays.map((h) => ({
        id: h.id,
        name: h.name,
        date: h.observedDate.toISOString().slice(0, 10),
      })),
      assignmentOverrides: assignmentOverrides.map((override) => ({
        id: override.id,
        scheduleId: override.scheduleId,
        shiftDate: this.formatDateOnly(override.shiftDate),
        shiftType: override.schedule.shiftType,
        startTime: override.schedule.startTime,
        endTime: override.schedule.endTime,
        workMode: override.schedule.workMode,
      })),
      shiftSwaps: shiftSwaps.map((swap) => ({
        id: swap.id,
        role:
          swap.requesterEmployeeId === actorEmployee.id
            ? 'REQUESTER'
            : 'COLLEAGUE',
        requesterScheduleId: swap.requesterScheduleId,
        requesterShiftDate: this.formatDateOnly(swap.requesterShiftDate),
        targetScheduleId: swap.targetScheduleId,
        targetShiftDate: this.formatDateOnly(swap.targetShiftDate),
        status: swap.status,
        expiresAt: swap.expiresAt.toISOString(),
      })),
    };
  }

  async getSchedules(
    tenantId: string,
    actor: RequestUser,
    employeeId?: string,
  ) {
    const where: Prisma.ShiftScheduleWhereInput = {
      tenantId,
      ...(employeeId ? { employeeId } : {}),
    };

    const canViewSchedules =
      isCompanyAdminUser(actor) ||
      isEmployeeSelfServiceUser(actor) ||
      hasPermissionRule(actor, 'schedules:VIEW') ||
      hasPermissionRule(actor, 'schedules:CREATE') ||
      hasPermissionRule(actor, 'schedules:EDIT') ||
      hasPermissionRule(actor, 'schedules:APPROVE') ||
      hasPermissionRule(actor, 'attendance:CREATE');
    assertHrAccess(canViewSchedules);

    return this.prisma.shiftSchedule.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getLiveAttendance(tenantId: string, actor: RequestUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'attendance:VIEW'));
    }

    const records = await this.prisma.clockRecord.findMany({
      where: {
        tenantId,
        date: { gte: todayStart, lte: todayEnd },
        clockOut: null,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { clockIn: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      avatarUrl: r.employee.avatarUrl ?? undefined,
      department: r.employee.department?.name ?? undefined,
      jobTitle: r.employee.jobTitle ?? undefined,
      clockIn: r.clockIn.toISOString(),
      breakStart: undefined,
      status: 'CLOCKED_IN',
      isLate: r.isLate,
      isOutsideSchedule: r.isOutsideSchedule,
      workMode: r.workMode,
      location: r.location ?? undefined,
    }));
  }

  async getAttendanceStats(tenantId: string, actor: RequestUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'attendance:VIEW'));
    }

    const [total, todayRecords] = await Promise.all([
      this.prisma.employee.count({
        where: {
          tenantId,
          employmentStatus: { in: ['ACTIVE', 'PROBATION', 'SUSPENDED'] },
        },
      }),
      this.prisma.clockRecord.findMany({
        where: {
          tenantId,
          date: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);
    const clockedIn = todayRecords.filter((r) => !r.clockOut).length;
    const absent = Math.max(0, total - todayRecords.length);
    const late = todayRecords.filter((r) => r.isLate).length;
    const flagged = todayRecords.filter((r) => r.isOutsideSchedule).length;
    return { clockedIn, absent, late, flagged, onBreak: 0, total };
  }
}
