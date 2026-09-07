import {
  Controller,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import { LeaveService } from '../leave/leave.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizePayrollCountry,
  normalizePayrollCurrency,
} from '../common/payroll-calculator.helper';
import {
  EventPatterns,
  WithMeta,
  TenantApprovedEvent,
  EmployeeActivatedEvent,
  ProvisionTenantWorkspaceCommand,
  LinkEmployeeIdentityCommand,
} from '@work-phelo/types';

@Controller()
export class EventsHandler {
  private readonly logger = new Logger(EventsHandler.name);

  constructor(
    private readonly leaveService: LeaveService,
    private readonly prisma: PrismaService,
  ) {}

  private ack(context: RmqContext) {
    const channel = context.getChannelRef() as { ack: (msg: unknown) => void };
    channel.ack(context.getMessage());
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

  private settleEventFailure(
    context: RmqContext,
    pattern: string,
    error: unknown,
    details: string,
  ) {
    const channel = context.getChannelRef() as {
      ack: (msg: unknown) => void;
      nack: (msg: unknown, allUpTo: boolean, requeue: boolean) => void;
    };
    const message = context.getMessage();

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

  private settleRpcFailure(
    context: RmqContext,
    pattern: string,
    error: unknown,
    details: string,
  ) {
    this.logger.warn(
      `[${pattern}] RPC failed | ${details} | error=${this.formatError(error)}`,
    );
    this.ack(context);
  }

  private toRpcErrorPayload(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return {
          statusCode: error.getStatus(),
          message: response,
          error: error.name,
        };
      }

      return {
        statusCode: error.getStatus(),
        ...(response as Record<string, unknown>),
      };
    }

    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;

    if (code === 'P2002') {
      return {
        statusCode: 409,
        message: 'A record with this field already exists',
        error: 'Conflict',
      };
    }

    return {
      statusCode: 500,
      message: this.formatError(error),
      error: 'Internal Server Error',
    };
  }

  private async provisionTenantWorkspace(
    tenantId: string,
    adminEmail: string,
    adminUserId?: string,
    country?: string,
    currency?: string,
  ) {
    const payrollCountry = normalizePayrollCountry(country);
    const payrollCurrency = normalizePayrollCurrency(currency, payrollCountry);

    await Promise.all([
      this.leaveService.seedDefaultLeaveTypes(tenantId),
      this.leaveService.seedPublicHolidaysForTenant(tenantId, country),
      this.prisma.tenantConfig.upsert({
        where: { tenantId },
        create: {
          tenantId,
          adminEmail,
          adminUserId,
          payrollCountry,
          payrollCurrency,
        },
        update: {
          adminEmail,
          adminUserId,
          payrollCountry,
          payrollCurrency,
        },
      }),
    ]);

    return { provisioned: true };
  }

  private async linkEmployeeIdentity(
    tenantId: string,
    email: string,
    userId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, email },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException(`No employee record found for ${email}`);
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { userId },
    });

    return { linked: true, employeeId: employee.id };
  }

  @EventPattern('hr.tenant_approved')
  async handleTenantApproved(
    @Payload() data: WithMeta<TenantApprovedEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, adminEmail, adminUserId, country, currency, _meta } =
      data;
    this.logger.log(
      `[hr.tenant_approved] Received | tenantId=${tenantId} | corrId=${_meta?.correlationId}`,
    );
    try {
      await this.provisionTenantWorkspace(
        tenantId,
        adminEmail,
        adminUserId,
        country,
        currency,
      );
      this.logger.log(
        `[hr.tenant_approved] Tenant workspace provisioned | tenantId=${tenantId} | corrId=${_meta?.correlationId}`,
      );
      this.ack(context);
    } catch (error) {
      this.settleEventFailure(
        context,
        'hr.tenant_approved',
        error,
        `tenantId=${tenantId} | corrId=${_meta?.correlationId}`,
      );
    }
  }

  @EventPattern('hr.employee_activated')
  async handleEmployeeActivated(
    @Payload() data: WithMeta<EmployeeActivatedEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, email, userId, _meta } = data;
    this.logger.log(
      `[hr.employee_activated] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      const result = await this.linkEmployeeIdentity(tenantId, email, userId);
      this.logger.log(
        `[hr.employee_activated] userId linked | email=${email} | corrId=${_meta?.correlationId}`,
      );

      await this.leaveService.initializeLeaveBalances(
        tenantId,
        result.employeeId,
      );
      this.logger.log(
        `[hr.employee_activated] Leave balances initialised | email=${email} | corrId=${_meta?.correlationId}`,
      );
      this.ack(context);
    } catch (e: unknown) {
      this.settleEventFailure(
        context,
        'hr.employee_activated',
        e,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
    }
  }

  @MessagePattern(EventPatterns.HR_PROVISION_TENANT_WORKSPACE)
  async handleProvisionTenantWorkspace(
    @Payload() data: WithMeta<ProvisionTenantWorkspaceCommand>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, adminEmail, adminUserId, country, currency, _meta } =
      data;
    this.logger.log(
      `[hr.provision_tenant_workspace] Received | tenantId=${tenantId} | corrId=${_meta?.correlationId}`,
    );
    try {
      const result = await this.provisionTenantWorkspace(
        tenantId,
        adminEmail,
        adminUserId,
        country,
        currency,
      );
      this.ack(context);
      return result;
    } catch (error) {
      this.settleRpcFailure(
        context,
        'hr.provision_tenant_workspace',
        error,
        `tenantId=${tenantId} | corrId=${_meta?.correlationId}`,
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @MessagePattern(EventPatterns.HR_LINK_EMPLOYEE_IDENTITY)
  async handleLinkEmployeeIdentity(
    @Payload() data: WithMeta<LinkEmployeeIdentityCommand>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, email, userId, _meta } = data;
    this.logger.log(
      `[hr.link_employee_identity] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      const result = await this.linkEmployeeIdentity(tenantId, email, userId);
      this.ack(context);
      return result;
    } catch (error) {
      this.settleRpcFailure(
        context,
        'hr.link_employee_identity',
        error,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }
}
