import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get 50 most recent notifications for the current user',
  })
  @ApiResponse({ status: 200, description: 'Notifications retrieved' })
  getRecent(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getRecent(req.user.id, req.user.tenantId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count returned' })
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all notifications paginated — supports read/unread filter',
  })
  @ApiQuery({ name: 'filter', required: false, enum: ['read', 'unread'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'All notifications retrieved' })
  getAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getAll(
      req.user.id,
      req.user.tenantId,
      query.filter,
      query.page,
      query.limit,
    );
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(
      req.user.id,
      req.user.tenantId,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.markRead(
      req.user.id,
      req.user.tenantId,
      id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.delete(req.user.id, req.user.tenantId, id);
  }
}
