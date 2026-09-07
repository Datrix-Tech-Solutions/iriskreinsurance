import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { InviteUserDto, UserSystemRole } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from '../auth/dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { Request, Response } from 'express';
import { RequestUser } from '@work-phelo/types';
import { setAuthCookies } from '../common/cookie.helper';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.INVITE_USER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite a user to a tenant and send invite token by email',
  })
  @ApiBody({
    description: 'Invite payload',
    schema: {
      example: {
        email: 'new.hire@acmeghana.com',
        firstName: 'New',
        lastName: 'Hire',
        phone: '+233244555100',
        role: 'EMPLOYEE',
        permissionSetIds: ['9f45a607-5d5d-4d8d-bd8d-0caaf6bb13d2'],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User invited successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'User already exists in tenant' })
  invite(
    @Body() dto: InviteUserDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.usersService.invite(req.user.tenantId, dto, req.user.id);
  }

  @Post('assign-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'SuperAdmin assigns a Company Admin to a tenant' })
  @ApiBody({
    schema: {
      example: {
        tenantId: 'uuid-of-target-tenant',
        email: 'admin@companyname.com',
        firstName: 'Abena',
        lastName: 'Mensah',
        role: 'TENANT_ADMIN',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Company Admin invited successfully',
  })
  @ApiResponse({ status: 409, description: 'Company already has an admin' })
  @ApiResponse({
    status: 403,
    description: 'SuperAdmin email cannot be assigned',
  })
  assignAdmin(
    @Body() dto: InviteUserDto & { tenantId: string },
    @Req() req: Request & { user: RequestUser },
  ) {
    const tenantId = dto.tenantId;
    const { tenantId: _tenantId, ...inviteDto } = dto;
    return this.usersService.invite(
      tenantId,
      {
        email: inviteDto.email,
        firstName: inviteDto.firstName,
        lastName: inviteDto.lastName,
        phone: inviteDto.phone,
        permissionSetIds: inviteDto.permissionSetIds,
        role: UserSystemRole.TENANT_ADMIN,
      },
      req.user.id,
    );
  }

  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Alias for accept-invite — set password via invite token',
  })
  @ApiBody({
    schema: {
      example: { inviteToken: 'invite-token-here', password: 'NewPass123!' },
    },
  })
  @ApiResponse({ status: 200, description: 'Password set, auto-logged in' })
  setPassword(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept invitation and set initial password' })
  @ApiBody({
    description: 'Accept invite payload',
    schema: {
      example: {
        inviteToken: 'demo-invite-token-acme-ghana-2026',
        password: 'Welcome123!',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Invite accepted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invite token' })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.usersService.acceptInvite(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const {
      accessToken: _accessToken,
      refreshToken: _refreshToken,
      ...safeResult
    } = result;
    return res.json(safeResult);
  }

  @Post(':id/resend-invite')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.INVITE_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invite email for a user in current tenant' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Invitation resent successfully. Only PENDING_VERIFICATION users can be resent; previous invite links are invalidated.',
    schema: { example: { message: 'Invitation resent successfully' } },
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 404,
    description: 'User not found in the current tenant',
  })
  async resendInvite(
    @Req() req: Request & { user: RequestUser },
    @Param('id') userId: string,
  ) {
    return this.usersService.resendInvite(req.user.tenantId, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.READ_USERS)
  @ApiOperation({ summary: 'List users for the current tenant' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(@Req() req: Request & { user: RequestUser }) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.READ_USERS)
  @ApiOperation({ summary: 'Get user by ID in the current tenant' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.usersService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.UPDATE_USER)
  @ApiOperation({ summary: 'Update user profile fields and status' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiBody({
    description: 'Partial update payload',
    schema: {
      example: {
        firstName: 'Kofi',
        lastName: 'Boateng',
        phone: '+233244111003',
        status: 'ACTIVE',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.usersService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DEACTIVATE_USER)
  @ApiOperation({ summary: 'Deactivate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deactivate(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.usersService.deactivate(req.user.tenantId, id);
  }

  @Patch(':id/force-password-reset')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FORCE_RESET_USER)
  @ApiOperation({ summary: 'Require user to reset password at next login' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'Force password reset enabled successfully',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  forcePasswordReset(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.usersService.forcePasswordReset(req.user.tenantId, id);
  }
}
