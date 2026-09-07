import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaveService } from '../leave/leave.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeeSyncRecoveryCronService {
  private readonly logger = new Logger(EmployeeSyncRecoveryCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveService: LeaveService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcileMissingLeaveBalances() {
    const year = new Date().getFullYear();
    const employees = await this.prisma.employee.findMany({
      where: {
        employmentStatus: { not: 'OFFBOARDED' },
        leaveBalances: { none: { year } },
      },
      select: {
        id: true,
        tenantId: true,
      },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    if (employees.length === 0) {
      return;
    }

    for (const employee of employees) {
      try {
        await this.leaveService.initializeLeaveBalances(
          employee.tenantId,
          employee.id,
          year,
        );
        this.logger.log(
          `[recovery] Initialised missing leave balances for employee ${employee.id} (${year})`,
        );
      } catch (error) {
        this.logger.error(
          `[recovery] Failed to initialise leave balances for employee ${employee.id}`,
          error,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcileOffboardedAuthAccess() {
    const employees = await this.prisma.employee.findMany({
      where: {
        employmentStatus: 'OFFBOARDED',
        userId: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        email: true,
        offboardReason: true,
      },
      take: 100,
      orderBy: { updatedAt: 'asc' },
    });

    if (employees.length === 0) {
      return;
    }

    const employeesByTenant = new Map<string, typeof employees>();

    for (const employee of employees) {
      const tenantEmployees = employeesByTenant.get(employee.tenantId) ?? [];
      tenantEmployees.push(employee);
      employeesByTenant.set(employee.tenantId, tenantEmployees);
    }

    for (const [tenantId, tenantEmployees] of employeesByTenant.entries()) {
      const userIds = tenantEmployees
        .map((employee) => employee.userId)
        .filter((userId): userId is string => Boolean(userId));

      if (userIds.length === 0) {
        continue;
      }

      try {
        const statuses = await this.rabbitmq.authGetUserStatuses({
          tenantId,
          userIds,
        });
        const activeUserIds = new Set(
          statuses
            .filter((status) => status.status !== 'INACTIVE')
            .map((status) => status.userId),
        );

        for (const employee of tenantEmployees) {
          if (!employee.userId || !activeUserIds.has(employee.userId)) {
            continue;
          }

          try {
            await this.rabbitmq.authDeactivateEmployeeAccess({
              tenantId,
              userId: employee.userId,
              email: employee.email,
              reason: employee.offboardReason ?? 'OFFBOARDED',
            });
            this.logger.log(
              `[recovery] Deactivated auth access for offboarded employee ${employee.id}`,
            );
          } catch (error) {
            this.logger.error(
              `[recovery] Failed to deactivate auth access for employee ${employee.id}`,
              error,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `[recovery] Failed to fetch auth statuses for offboarded users in tenant ${tenantId}`,
          error,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcilePendingEmployeeInviteRollbacks() {
    const rollbackTasks = await this.prisma.employeeInviteRollbackTask.findMany(
      {
        take: 100,
        orderBy: { createdAt: 'asc' },
      },
    );

    if (rollbackTasks.length === 0) {
      return;
    }

    for (const task of rollbackTasks) {
      try {
        await this.rabbitmq.authDeletePendingEmployeeInvite({
          tenantId: task.tenantId,
          userId: task.userId ?? undefined,
          email: task.email,
        });

        await this.prisma.employeeInviteRollbackTask.delete({
          where: { id: task.id },
        });

        this.logger.log(
          `[recovery] Deleted stranded auth invite for rollback task ${task.id}`,
        );
      } catch (error) {
        await this.prisma.employeeInviteRollbackTask.update({
          where: { id: task.id },
          data: {
            attemptCount: { increment: 1 },
            lastError: error instanceof Error ? error.message : String(error),
            lastAttemptAt: new Date(),
          },
        });

        this.logger.error(
          `[recovery] Failed to delete stranded auth invite for rollback task ${task.id}`,
          error,
        );
      }
    }
  }
}
