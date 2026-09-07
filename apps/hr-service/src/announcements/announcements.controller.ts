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
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Permission } from '@work-phelo/config';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { QueryAnnouncementsDto } from './dto/query-announcements.dto';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @RequirePermissions(Permission.MANAGE_ANNOUNCEMENTS)
  @ApiOperation({
    summary: 'Create a company announcement',
  })
  @ApiResponse({ status: 201, description: 'Announcement created' })
  create(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.announcementsService.create(req.user.tenantId, req.user, dto);
  }

  @Get()
  @RequirePermissions(Permission.READ_ANNOUNCEMENTS)
  @ApiOperation({ summary: 'List announcements visible to the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'audienceType', required: false, type: String })
  @ApiQuery({ name: 'sendEmail', required: false, type: Boolean })
  @ApiQuery({ name: 'includeExpired', required: false, type: Boolean })
  @ApiQuery({
    name: 'view',
    required: false,
    enum: ['visible', 'all'],
  })
  @ApiQuery({
    name: 'read',
    required: false,
    enum: ['read', 'unread'],
  })
  @ApiResponse({ status: 200, description: 'Announcements retrieved' })
  findAll(
    @Req() req: Request & { user: RequestUser },
    @Query() query: QueryAnnouncementsDto,
  ) {
    return this.announcementsService.findAll(
      req.user.tenantId,
      req.user,
      query,
    );
  }

  @Get('unread-count')
  @RequirePermissions(Permission.READ_ANNOUNCEMENTS)
  @ApiOperation({
    summary: 'Get unread announcement count for the current user',
  })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  getUnreadCount(@Req() req: Request & { user: RequestUser }) {
    return this.announcementsService.getUnreadCount(
      req.user.tenantId,
      req.user,
    );
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.READ_ANNOUNCEMENTS)
  @ApiOperation({
    summary: 'Mark all visible announcements as read for the current user',
  })
  @ApiResponse({ status: 200, description: 'Announcements marked as read' })
  markAllRead(@Req() req: Request & { user: RequestUser }) {
    return this.announcementsService.markAllRead(req.user.tenantId, req.user);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.READ_ANNOUNCEMENTS)
  @ApiOperation({ summary: 'Mark one announcement as read' })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement marked as read' })
  markRead(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.announcementsService.markRead(req.user.tenantId, req.user, id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_ANNOUNCEMENTS)
  @ApiOperation({ summary: 'Delete an announcement' })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement deleted' })
  remove(@Param('id') id: string, @Req() req: Request & { user: RequestUser }) {
    return this.announcementsService.remove(req.user.tenantId, id);
  }
}
