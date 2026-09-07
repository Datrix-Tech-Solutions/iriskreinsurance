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
  ApiBearerAuth,
  ApiCookieAuth,
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
import {
  ApiErrorResponseDto,
  EmailThreadResponseDto,
  PaginatedEmailMessagesResponseDto,
  PaginatedEmailThreadsResponseDto,
  PlacementEmailLinkResponseDto,
  PlacementEmailLinkWithThreadResponseDto,
} from './dto/email-response.dto';
import { LinkPlacementEmailDto } from './dto/link-placement-email.dto';
import { QueryEmailMessagesDto } from './dto/query-email-messages.dto';
import { QueryEmailThreadsDto } from './dto/query-email-threads.dto';
import { EmailPermission } from './email.permissions';
import { EmailThreadsService } from './email-threads.service';

@Controller('email')
@ApiTags('Reinsurance - Email Threads')
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
export class EmailThreadsController {
  constructor(private readonly emailThreadsService: EmailThreadsService) {}

  @Get('threads')
  @RequirePermissions(EmailPermission.VIEW)
  @ApiOperation({ summary: 'List email threads' })
  @ApiOkResponse({ type: PaginatedEmailThreadsResponseDto })
  findThreads(
    @Query() query: QueryEmailThreadsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.emailThreadsService.findThreads(request.user.tenantId, query);
  }

  @Get('threads/:id')
  @RequirePermissions(EmailPermission.VIEW)
  @ApiOperation({ summary: 'Get an email thread with recent messages' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EmailThreadResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findThread(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.emailThreadsService.findThread(request.user.tenantId, id);
  }

  @Get('messages')
  @RequirePermissions(EmailPermission.VIEW)
  @ApiOperation({ summary: 'List email messages' })
  @ApiOkResponse({ type: PaginatedEmailMessagesResponseDto })
  findMessages(
    @Query() query: QueryEmailMessagesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.emailThreadsService.findMessages(request.user.tenantId, query);
  }

  @Post('threads/:threadId/placements/:placementId/link')
  @RequirePermissions(EmailPermission.EDIT)
  @ApiOperation({
    summary: 'Manually link a thread or message to a placement',
    description:
      'This stores a manual workflow link only. It does not update placement fields or parse email contents.',
  })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  @ApiParam({ name: 'placementId', format: 'uuid' })
  @ApiOkResponse({ type: PlacementEmailLinkWithThreadResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  linkPlacement(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Body() dto: LinkPlacementEmailDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.emailThreadsService.linkPlacementWithThread(
      request.user,
      threadId,
      placementId,
      dto,
    );
  }

  @Delete('links/:id')
  @RequirePermissions(EmailPermission.EDIT)
  @ApiOperation({ summary: 'Archive a placement email link' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlacementEmailLinkResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archiveLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.emailThreadsService.archiveLink(request.user, id);
  }
}
