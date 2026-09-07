import { Controller, HttpException, Logger } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import {
  EventPatterns,
  PermissionRecipient,
  ResolvePermissionRecipientsCommand,
  WithMeta,
} from '@work-phelo/types';
import { PermissionAction } from './dto/grant-permission.dto';
import { PermissionsService } from './permissions.service';

@Controller()
export class PermissionsHandler {
  private readonly logger = new Logger(PermissionsHandler.name);

  constructor(private readonly permissionsService: PermissionsService) {}

  private ack(context: RmqContext) {
    const channel = context.getChannelRef() as { ack: (msg: unknown) => void };
    channel.ack(context.getMessage());
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
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

    return {
      statusCode: 500,
      message: this.formatError(error),
      error: 'Internal Server Error',
    };
  }

  @MessagePattern(EventPatterns.AUTH_RESOLVE_PERMISSION_RECIPIENTS)
  async handleResolvePermissionRecipients(
    @Payload() data: WithMeta<ResolvePermissionRecipientsCommand>,
    @Ctx() context: RmqContext,
  ): Promise<PermissionRecipient[]> {
    const {
      tenantId,
      resource,
      action,
      includeTenantAdmins,
      activeOnly,
      _meta,
    } = data;

    this.logger.log(
      `[auth.resolve_permission_recipients] Received | tenantId=${tenantId} | permission=${resource}:${action} | corrId=${_meta?.correlationId}`,
    );

    try {
      const recipients = await this.permissionsService.getPermissionRecipients(
        tenantId,
        resource,
        action as PermissionAction,
        {
          includeTenantAdmins,
          activeOnly,
        },
      );
      this.ack(context);
      return recipients;
    } catch (error) {
      this.logger.warn(
        `[auth.resolve_permission_recipients] RPC failed | tenantId=${tenantId} | permission=${resource}:${action} | corrId=${_meta?.correlationId} | error=${this.formatError(error)}`,
      );
      this.ack(context);
      throw new RpcException(this.toRpcErrorPayload(error));
    }
  }
}
