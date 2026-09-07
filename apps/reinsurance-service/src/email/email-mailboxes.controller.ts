import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ConnectMailboxDto } from './dto/connect-mailbox.dto';
import {
  ApiErrorResponseDto,
  MailboxConnectionResponseDto,
  MailboxSyncResponseDto,
  PaginatedMailboxesResponseDto,
} from './dto/email-response.dto';
import { QueryMailboxesDto } from './dto/query-mailboxes.dto';
import { SyncMailboxDto } from './dto/sync-mailbox.dto';
import { EmailSettingsPermission } from './email.permissions';
import { EmailMailboxService } from './email-mailbox.service';

@Controller('email/mailboxes')
@ApiTags('Reinsurance - Email Mailboxes')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Module, feature or required permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class EmailMailboxesController {
  constructor(private readonly mailboxService: EmailMailboxService) {}

  @Get()
  @RequirePermissions(EmailSettingsPermission.VIEW)
  @ApiOperation({
    summary: 'List active mailbox connections',
    description:
      'Returns tenant-owned mailbox connection metadata. OAuth tokens are never returned.',
  })
  @ApiOkResponse({ type: PaginatedMailboxesResponseDto })
  findAll(
    @Query() query: QueryMailboxesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.mailboxService.findAll(request.user.tenantId, query);
  }

  @Post('connect')
  @RequirePermissions(EmailSettingsPermission.EDIT)
  @ApiOperation({
    summary: 'Connect a mailbox',
    description:
      'Stores mailbox metadata and encrypted OAuth tokens after provider verification. Microsoft Graph is the MVP provider.',
  })
  @ApiCreatedResponse({ type: MailboxConnectionResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid provider, token or encryption configuration.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active mailbox connection already exists.',
  })
  connect(
    @Body() dto: ConnectMailboxDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.mailboxService.connect(request.user, dto);
  }

  @Post(':id/verify')
  @RequirePermissions(EmailSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Verify an existing mailbox connection' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MailboxConnectionResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.mailboxService.verify(request.user, id);
  }

  @Post(':id/sync')
  @RequirePermissions(EmailSettingsPermission.EDIT)
  @ApiOperation({
    summary: 'Run a minimal mailbox sync proof-of-concept',
    description:
      'Fetches recent provider message metadata and persists threads, messages and attachment metadata. It does not download attachment files or send email.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MailboxSyncResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  sync(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncMailboxDto = new SyncMailboxDto(),
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.mailboxService.sync(request.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(EmailSettingsPermission.EDIT)
  @ApiOperation({
    summary: 'Archive a mailbox connection',
    description:
      'Soft-archives the connection and marks it disconnected. Stored historical message metadata remains tenant-scoped.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MailboxConnectionResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.mailboxService.archive(request.user, id);
  }
}
