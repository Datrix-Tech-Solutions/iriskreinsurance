import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PermissionRecipient } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { NotificationsService } from '../notifications/notifications.service';

export const RESIGNATION_QUEUE = 'resignation';
export const RESIGNATION_NOTIFY_JOB = 'notify-admin';

export interface ResignationNotifyPayload {
  tenantId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  lastWorkingDate: string;
  reason?: string;
  additionalNotes?: string;
  detailLink: string;
}

type ResignationNotificationRecipient = {
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: 'MANAGER' | 'APPROVER';
};

@Processor(RESIGNATION_QUEUE)
export class ResignationNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ResignationNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  private toNotificationRecipient(
    recipient: PermissionRecipient,
    source: ResignationNotificationRecipient['source'],
  ): ResignationNotificationRecipient {
    return {
      userId: recipient.userId,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      source,
    };
  }

  private dedupeRecipients(
    recipients: ResignationNotificationRecipient[],
  ): ResignationNotificationRecipient[] {
    const unique = new Map<string, ResignationNotificationRecipient>();

    for (const recipient of recipients) {
      const key = recipient.userId || recipient.email.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, recipient);
      }
    }

    return [...unique.values()];
  }

  private async resolveManagerRecipient(
    tenantId: string,
    employee: {
      managerId: string | null;
      departmentId: string | null;
    },
  ): Promise<ResignationNotificationRecipient | null> {
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

  private async resolveNotificationRecipients(
    tenantId: string,
    employeeId: string,
  ): Promise<ResignationNotificationRecipient[]> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: {
        id: true,
        userId: true,
        managerId: true,
        departmentId: true,
      },
    });

    if (!employee) {
      this.logger.warn(
        `Skipping resignation notification recipient resolution because employee ${employeeId} was not found in tenant ${tenantId}`,
      );
      return [];
    }

    const [manager, permissionRecipients] = await Promise.all([
      this.resolveManagerRecipient(tenantId, employee),
      this.rabbitmq.authResolvePermissionRecipients({
        tenantId,
        resource: 'employees',
        action: 'DELETE',
        activeOnly: true,
      }),
    ]);

    const approvers = this.dedupeRecipients(
      permissionRecipients
        .filter((recipient) => recipient.email)
        .filter((recipient) => recipient.userId !== employee.userId)
        .map((recipient) =>
          this.toNotificationRecipient(recipient, 'APPROVER'),
        ),
    ).filter(
      (recipient) =>
        !manager ||
        (recipient.userId && manager.userId
          ? recipient.userId !== manager.userId
          : recipient.email.toLowerCase() !== manager.email.toLowerCase()),
    );

    return this.dedupeRecipients(
      [manager, ...approvers].filter(
        (recipient): recipient is ResignationNotificationRecipient =>
          recipient !== null,
      ),
    );
  }

  async process(job: Job<ResignationNotifyPayload>): Promise<void> {
    const { tenantId, employeeId, ...rest } = job.data;

    const resignation = await this.prisma.resignationRecord.findUnique({
      where: { employeeId },
    });

    // Employee may have withdrawn within the 30-minute window — skip silently
    if (!resignation || resignation.status !== 'PENDING') {
      this.logger.log(
        `Skipping resignation notification for employee ${employeeId} — status is ${resignation?.status ?? 'not found'}`,
      );
      return;
    }

    const recipients = await this.resolveNotificationRecipients(
      tenantId,
      employeeId,
    );

    if (recipients.length === 0) {
      this.logger.warn(
        `No manager or offboarding approver recipients found for resignation notification for employee ${employeeId} in tenant ${tenantId}`,
      );
      return;
    }

    const message = `${rest.employeeFirstName} ${rest.employeeLastName} submitted a resignation effective ${new Date(rest.lastWorkingDate).toLocaleDateString('en-GB')}${rest.reason ? ` (${rest.reason})` : ''}.`;
    const inAppRecipients = recipients
      .map((recipient) => recipient.userId)
      .filter((userId): userId is string => Boolean(userId));

    if (inAppRecipients.length > 0) {
      await this.notificationsService.createMany(
        inAppRecipients.map((userId) => ({
          tenantId,
          userId,
          type: 'RESIGNATION_SUBMITTED',
          message,
          link: rest.detailLink,
        })),
      );
    }

    const publishResults = await Promise.allSettled(
      recipients.map((recipient) =>
        this.rabbitmq.notificationResignationSubmitted({
          tenantId,
          adminEmail: recipient.email,
          employeeId,
          employeeFirstName: rest.employeeFirstName,
          employeeLastName: rest.employeeLastName,
          lastWorkingDate: rest.lastWorkingDate,
          reason: rest.reason,
          additionalNotes: rest.additionalNotes,
          detailLink: rest.detailLink,
        }),
      ),
    );

    publishResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to emit resignation notification for employee ${employeeId} to ${recipients[index]?.email}`,
          result.reason,
        );
      }
    });
  }
}
