import { Controller, HttpException, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import {
  EventPatterns,
  WithMeta,
  InviteEmployeeEvent,
  DeactivateEmployeeAccessCommand,
  DeactivateEmployeeAccessResult,
  EmployeeOffboardedEvent,
  ResendEmployeeInviteEvent,
  ProvisionEmployeeInviteCommand,
  DeletePendingEmployeeInviteCommand,
  GetUserStatusesCommand,
  UserStatusSnapshot,
} from '@work-phelo/types';

@Controller()
export class UsersHandler {
  private readonly logger = new Logger(UsersHandler.name);

  constructor(private readonly usersService: UsersService) {}

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

  @EventPattern('auth.invite_employee')
  async handleInviteEmployee(
    @Payload() data: WithMeta<InviteEmployeeEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, email, firstName, lastName, _meta } = data;
    this.logger.log(
      `[auth.invite_employee] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      await this.usersService.invite(tenantId, {
        email,
        firstName,
        lastName,
        role: 'EMPLOYEE' as InviteUserDto['role'],
      });
      this.logger.log(
        `[auth.invite_employee] Invite sent | email=${email} | corrId=${_meta?.correlationId}`,
      );
      this.ack(context);
    } catch (e: unknown) {
      this.settleEventFailure(
        context,
        'auth.invite_employee',
        e,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
    }
  }

  @MessagePattern(EventPatterns.AUTH_PROVISION_EMPLOYEE_INVITE)
  async handleProvisionEmployeeInvite(
    @Payload() data: WithMeta<ProvisionEmployeeInviteCommand>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, email, firstName, lastName, phone, _meta } = data;
    this.logger.log(
      `[auth.provision_employee_invite] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      const result = await this.usersService.provisionEmployeeInvite(tenantId, {
        email,
        firstName,
        lastName,
        phone,
      });
      this.ack(context);
      return result;
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.provision_employee_invite',
        error,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @MessagePattern(EventPatterns.AUTH_DELETE_PENDING_EMPLOYEE_INVITE)
  async handleDeletePendingEmployeeInvite(
    @Payload() data: WithMeta<DeletePendingEmployeeInviteCommand>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, userId, email, _meta } = data;
    this.logger.log(
      `[auth.delete_pending_employee_invite] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      const result = await this.usersService.deletePendingEmployeeInvite(
        tenantId,
        {
          userId,
          email,
        },
      );
      this.ack(context);
      return result;
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.delete_pending_employee_invite',
        error,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @MessagePattern(EventPatterns.AUTH_GET_USER_STATUSES)
  async handleGetUserStatuses(
    @Payload() data: WithMeta<GetUserStatusesCommand>,
    @Ctx() context: RmqContext,
  ): Promise<UserStatusSnapshot[]> {
    const { tenantId, userIds, _meta } = data;
    this.logger.log(
      `[auth.get_user_statuses] Received | count=${userIds.length} | corrId=${_meta?.correlationId}`,
    );
    try {
      const result = await this.usersService.getUserStatuses(tenantId, userIds);
      this.ack(context);
      return result;
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.get_user_statuses',
        error,
        `count=${userIds.length} | corrId=${_meta?.correlationId}`,
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @MessagePattern(EventPatterns.AUTH_DEACTIVATE_EMPLOYEE_ACCESS)
  async handleDeactivateEmployeeAccess(
    @Payload() data: WithMeta<DeactivateEmployeeAccessCommand>,
    @Ctx() context: RmqContext,
  ): Promise<DeactivateEmployeeAccessResult> {
    const { tenantId, userId, email, _meta } = data;
    this.logger.log(
      `[auth.deactivate_employee_access] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      await this.usersService.deactivate(tenantId, userId);
      this.ack(context);
      return { deactivated: true };
    } catch (error) {
      this.settleRpcFailure(
        context,
        'auth.deactivate_employee_access',
        error,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }

  @EventPattern('hr.employee_offboarded')
  async handleEmployeeOffboarded(
    @Payload() data: WithMeta<EmployeeOffboardedEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, userId, email, _meta } = data;
    this.logger.log(
      `[hr.employee_offboarded] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      await this.usersService.deactivate(tenantId, userId);
      this.logger.log(
        `[hr.employee_offboarded] Account deactivated and tokens revoked | email=${email} | corrId=${_meta?.correlationId}`,
      );
      this.ack(context);
    } catch (e: unknown) {
      this.settleEventFailure(
        context,
        'hr.employee_offboarded',
        e,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
    }
  }

  @EventPattern('auth.resend_employee_invite')
  async handleResendEmployeeInvite(
    @Payload() data: WithMeta<ResendEmployeeInviteEvent>,
    @Ctx() context: RmqContext,
  ) {
    const { tenantId, email, firstName, lastName, _meta } = data;
    this.logger.log(
      `[auth.resend_employee_invite] Received | email=${email} | corrId=${_meta?.correlationId}`,
    );
    try {
      const user = await this.usersService.findByEmail(tenantId, email);
      if (!user) {
        this.logger.warn(
          `[auth.resend_employee_invite] No user found — sending fresh invite | email=${email} | corrId=${_meta?.correlationId}`,
        );
        await this.usersService.invite(tenantId, {
          email,
          firstName,
          lastName: lastName ?? '',
          role: 'EMPLOYEE' as InviteUserDto['role'],
        });
        this.logger.log(
          `[auth.resend_employee_invite] Fresh invite sent | email=${email} | corrId=${_meta?.correlationId}`,
        );
        this.ack(context);
        return;
      }
      await this.usersService.resendInvite(tenantId, user.id);
      this.logger.log(
        `[auth.resend_employee_invite] Invite resent | email=${email} | corrId=${_meta?.correlationId}`,
      );
      this.ack(context);
    } catch (e: unknown) {
      this.settleEventFailure(
        context,
        'auth.resend_employee_invite',
        e,
        `email=${email} | corrId=${_meta?.correlationId}`,
      );
    }
  }
}
