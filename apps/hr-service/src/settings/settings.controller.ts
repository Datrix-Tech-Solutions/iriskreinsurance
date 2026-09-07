import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@work-phelo/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UpdateResignationSettingsDto } from './dto/update-resignation-settings.dto';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';
import { UpdateAppraisalSettingsDto } from './dto/update-appraisal-settings.dto';
import { UpdatePayrollSettingsDto } from './dto/update-payroll-settings.dto';
import { UpdateCompanyPoliciesDto } from './dto/update-company-policies.dto';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('resignation')
  @ApiOperation({
    summary: 'Get resignation settings for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Resignation settings retrieved' })
  getResignationSettings(@Req() req: Request & { user: RequestUser }) {
    return this.settingsService.getResignationSettings(
      req.user.tenantId,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }

  @Patch('resignation')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Update resignation settings for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Resignation settings updated' })
  updateResignationSettings(
    @Body() dto: UpdateResignationSettingsDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.settingsService.updateResignationSettings(
      req.user.tenantId,
      dto.resignationNoticePeriodDays,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }

  @Get('attendance')
  @RequirePermissions(Permission.READ_HR_SETTINGS)
  @ApiOperation({ summary: 'Get attendance settings for the current tenant' })
  @ApiResponse({ status: 200, description: 'Attendance settings retrieved' })
  getAttendanceSettings(@Req() req: Request & { user: RequestUser }) {
    return this.settingsService.getAttendanceSettings(req.user.tenantId);
  }

  @Get('company-policies')
  @ApiOperation({
    summary: 'Get company policy settings for the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Company policy settings retrieved',
  })
  getCompanyPoliciesSettings(@Req() req: Request & { user: RequestUser }) {
    return this.settingsService.getCompanyPoliciesSettings(req.user.tenantId);
  }

  @Get('payroll')
  @RequirePermissions(Permission.READ_PAYROLL)
  @ApiOperation({ summary: 'Get payroll settings for the current tenant' })
  @ApiResponse({ status: 200, description: 'Payroll settings retrieved' })
  getPayrollSettings(@Req() req: Request & { user: RequestUser }) {
    return this.settingsService.getPayrollSettings(req.user.tenantId);
  }

  @Patch('attendance')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Update attendance settings for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Attendance settings updated' })
  updateAttendanceSettings(
    @Body() dto: UpdateAttendanceSettingsDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.settingsService.updateAttendanceSettings(
      req.user.tenantId,
      dto.lateArrivalThresholdMinutes,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }

  @Patch('payroll')
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({
    summary: 'Update payroll settings for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Payroll settings updated' })
  updatePayrollSettings(
    @Body() dto: UpdatePayrollSettingsDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.settingsService.updatePayrollSettings(
      req.user.tenantId,
      dto,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }

  @Patch('company-policies')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Update company policy settings for the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Company policy settings updated',
  })
  updateCompanyPoliciesSettings(
    @Body() dto: UpdateCompanyPoliciesDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.settingsService.updateCompanyPoliciesSettings(
      req.user.tenantId,
      dto,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }

  @Get('appraisal')
  @RequirePermissions(Permission.READ_HR_SETTINGS)
  @ApiOperation({ summary: 'Get appraisal settings for the current tenant' })
  @ApiResponse({ status: 200, description: 'Appraisal settings retrieved' })
  getAppraisalSettings(@Req() req: Request & { user: RequestUser }) {
    return this.settingsService.getAppraisalSettings(req.user.tenantId);
  }

  @Patch('appraisal')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Update appraisal settings for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Appraisal settings updated' })
  updateAppraisalSettings(
    @Body() dto: UpdateAppraisalSettingsDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.settingsService.updateAppraisalSettings(
      req.user.tenantId,
      dto,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }
}
