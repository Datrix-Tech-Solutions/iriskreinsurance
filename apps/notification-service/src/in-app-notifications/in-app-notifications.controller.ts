import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryInAppNotificationsDto } from './dto/query-in-app-notifications.dto';
import { InAppNotificationsService } from './in-app-notifications.service';

type AuthenticatedRequest = Request & { user: RequestUser };

@UseGuards(JwtAuthGuard)
@ApiTags('In-App Notifications')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@Controller('in-app')
export class InAppNotificationsController {
  constructor(private readonly notifications: InAppNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get recent in-app notifications' })
  getRecent(@Req() req: AuthenticatedRequest) {
    return this.notifications.getRecent(req.user.id, req.user.tenantId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread in-app notification count' })
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notifications.getUnreadCount(req.user.id, req.user.tenantId);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get paginated in-app notifications' })
  getAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryInAppNotificationsDto,
  ) {
    return this.notifications.getAll(
      req.user.id,
      req.user.tenantId,
      query.filter,
      query.page,
      query.limit,
    );
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all current user notifications as read' })
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notifications.markAllRead(req.user.id, req.user.tenantId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notifications.markRead(req.user.id, req.user.tenantId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive one notification' })
  archive(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notifications.archive(req.user.id, req.user.tenantId, id);
  }
}
