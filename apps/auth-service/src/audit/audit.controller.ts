import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { QueryAuditDto } from './dto/query-audit.dto';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Audit Logs')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_AUDIT_LOGS)
  @ApiOperation({
    summary: 'Query audit logs — TENANT_ADMIN and SUPER_ADMIN only',
  })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: [
      'CREATE',
      'UPDATE',
      'DELETE',
      'APPROVE',
      'REVOKE',
      'LOGIN',
      'LOGOUT',
      'EXPORT',
      'ASSIGN',
      'RUN',
    ],
  })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  query(@Req() req: AuthenticatedRequest, @Query() query: QueryAuditDto) {
    return this.auditService.query(req.user.tenantId, query);
  }
}
