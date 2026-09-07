import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Dashboard')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  @RequirePermissions(Permission.READ_OWN_PROFILE)
  @ApiOperation({ summary: 'Get personal employee dashboard' })
  @ApiResponse({ status: 200, description: 'Employee dashboard data returned' })
  getMyDashboard(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getEmployeeDashboard(
      req.user.tenantId,
      req.user,
    );
  }

  @Get('summary')
  @RequirePermissions(Permission.READ_EMPLOYEES)
  @ApiOperation({ summary: 'Get Company Admin dashboard summary' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary returned successfully',
    schema: {
      example: {
        adminFirstName: 'Abena',
        companyName: 'Acme Ghana Ltd',
        totalEmployees: 12,
        activeEmployees: 10,
        pendingLeaveRequests: 2,
        assignedAssetsCount: 0,
        hasEmployees: true,
        modules: {
          hr: { enabled: true, locked: false },
          payroll: { enabled: true, locked: false },
          assets: { enabled: false, locked: true },
          recruitment: { enabled: false, locked: true },
        },
      },
    },
  })
  getSummary(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getSummary(
      req.user.tenantId,
      req.user.tenantSlug,
      req.user.firstName,
      req.user.tenantName,
    );
  }

  @Get('department-distribution')
  @RequirePermissions(Permission.READ_DEPARTMENTS)
  @ApiOperation({ summary: 'Get employee count per department' })
  @ApiResponse({ status: 200, description: 'Department distribution returned' })
  getDepartmentDistribution(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getDepartmentDistribution(req.user.tenantId);
  }

  @Get('recent-activity')
  @RequirePermissions(Permission.READ_EMPLOYEES)
  @ApiOperation({ summary: 'Get last 5 employee record changes' })
  @ApiResponse({ status: 200, description: 'Recent activity returned' })
  getRecentActivity(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getRecentActivity(req.user.tenantId);
  }

  @Get('upcoming-birthdays')
  @RequirePermissions(Permission.READ_EMPLOYEES)
  @ApiOperation({ summary: 'Get employees with birthdays in next 30 days' })
  @ApiResponse({ status: 200, description: 'Upcoming birthdays returned' })
  getUpcomingBirthdays(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getUpcomingBirthdays(req.user.tenantId);
  }

  @Get('recently-added')
  @RequirePermissions(Permission.READ_EMPLOYEES)
  @ApiOperation({ summary: 'Get last 5 employees added to the company' })
  @ApiResponse({
    status: 200,
    description: 'Recently added employees returned',
  })
  getRecentlyAdded(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getRecentlyAdded(req.user.tenantId);
  }
}
