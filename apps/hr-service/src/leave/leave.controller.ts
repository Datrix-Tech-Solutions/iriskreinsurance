import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
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
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { UpdateLeaveRequestSupportingDocumentDto } from './dto/update-leave-request-supporting-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Leave')
@Controller('leave')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'leave')
@ApiBearerAuth('access-token')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Patch('types/:id')
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiParam({ name: 'id', description: 'Leave type UUID' })
  @ApiResponse({ status: 200, description: 'Leave type updated' })
  @ApiResponse({
    status: 200,
    description: 'Warning returned if existing requests found',
  })
  updateLeaveType(
    @Param('id') id: string,
    @Body() dto: Partial<CreateLeaveTypeDto>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.updateLeaveType(req.user.tenantId, id, dto);
  }

  @Delete('types/:id')
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({
    summary: 'Archive a leave type',
  })
  @ApiParam({ name: 'id', description: 'Leave type UUID' })
  @ApiResponse({ status: 200, description: 'Leave type archived' })
  @ApiResponse({
    status: 404,
    description: 'Leave type not found',
  })
  deleteLeaveType(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaveService.deleteLeaveType(req.user.tenantId, id);
  }

  @Post('public-holidays')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({ summary: 'Add a public holiday' })
  @ApiBody({ type: CreatePublicHolidayDto })
  @ApiResponse({ status: 201, description: 'Public holiday added' })
  createPublicHoliday(
    @Body() dto: CreatePublicHolidayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.createPublicHoliday(req.user.tenantId, dto);
  }

  @Get('public-holidays')
  @ApiOperation({ summary: 'List all public holidays for the company' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Public holidays retrieved' })
  getPublicHolidays(
    @Req() req: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    return this.leaveService.getPublicHolidays(req.user.tenantId, parsedYear);
  }

  @Patch('public-holidays/:id')
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({ summary: 'Update a public holiday' })
  @ApiParam({ name: 'id', description: 'Public holiday UUID' })
  @ApiResponse({ status: 200, description: 'Public holiday updated' })
  updatePublicHoliday(
    @Param('id') id: string,
    @Body() dto: UpdatePublicHolidayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.updatePublicHoliday(req.user.tenantId, id, dto);
  }

  @Delete('public-holidays/:id')
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({ summary: 'Delete a public holiday' })
  @ApiParam({ name: 'id', description: 'Public holiday UUID' })
  @ApiResponse({ status: 200, description: 'Public holiday deleted' })
  deletePublicHoliday(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.deletePublicHoliday(req.user.tenantId, id);
  }

  @Post('types')
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({
    summary: 'Create a leave type (e.g. Annual, Sick, Maternity)',
  })
  @ApiBody({ type: CreateLeaveTypeDto })
  @ApiResponse({ status: 201, description: 'Leave type created' })
  createLeaveType(
    @Body() dto: CreateLeaveTypeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.createLeaveType(req.user.tenantId, dto);
  }

  @Get('types')
  @RequirePermissions(Permission.READ_OWN_LEAVE)
  @ApiOperation({ summary: 'List all leave types for the tenant' })
  @ApiResponse({ status: 200, description: 'Leave types retrieved' })
  getLeaveTypes(@Req() req: AuthenticatedRequest) {
    return this.leaveService.getLeaveTypes(req.user.tenantId);
  }

  @Get('balances/me')
  @RequirePermissions(Permission.READ_OWN_LEAVE)
  @ApiOperation({ summary: 'Get leave balances for the logged-in employee' })
  @ApiResponse({ status: 200, description: 'My leave balances retrieved' })
  getMyBalances(@Req() req: AuthenticatedRequest) {
    return this.leaveService.getMyLeaveBalances(req.user.tenantId, req.user.id);
  }

  @Get('balances/:employeeId')
  @ApiOperation({ summary: 'Get leave balances for a specific employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Leave balances retrieved' })
  getBalances(
    @Param('employeeId') employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.getLeaveBalances(
      req.user.tenantId,
      employeeId,
      req.user,
    );
  }

  @Post('balances/backfill')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({
    summary:
      'Backfill leave balances for all employees in the tenant — Admin only',
  })
  @ApiResponse({ status: 200, description: 'Backfill complete' })
  backfillBalances(@Req() req: AuthenticatedRequest) {
    return this.leaveService.backfillLeaveBalances(req.user.tenantId);
  }

  @Post('balances/:employeeId/initialize')
  @RequirePermissions(Permission.MANAGE_LEAVE_TYPES)
  @ApiOperation({ summary: 'Initialize leave balances for an employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 201, description: 'Leave balances initialized' })
  initializeBalances(
    @Param('employeeId') employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.initializeLeaveBalances(
      req.user.tenantId,
      employeeId,
    );
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiBody({
    schema: {
      example: {
        leaveTypeId: 'leave-type-123',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        reason: 'Medical recovery leave',
        coverageEmployeeId: 'employee-456',
        coverageNote: 'Cover payroll inbox and urgent approvals.',
        supportingDocumentName: 'Medical Report - May 2026',
        supportingDocumentUrl:
          'https://storage.example.com/leave-docs/medical-report-123.pdf',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Leave request submitted' })
  @ApiResponse({ status: 400, description: 'Insufficient leave balance' })
  createRequest(
    @Body() dto: CreateLeaveRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.createRequest(req.user.tenantId, req.user, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get leave requests — scoped by role' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  })
  @ApiResponse({ status: 200, description: 'Leave requests retrieved' })
  getRequests(
    @Query() query: QueryLeaveRequestsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.getRequests(req.user.tenantId, req.user, query);
  }

  @Get('requests/all')
  @RequirePermissions(Permission.READ_ALL_LEAVES)
  @ApiOperation({ summary: 'Get all leave requests — Admin only' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'All leave requests retrieved' })
  getAllRequests(
    @Query() query: QueryLeaveRequestsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.getRequests(req.user.tenantId, req.user, {
      ...query,
      scope: 'all',
    });
  }

  @Get('requests/pending-count')
  @RequirePermissions(Permission.APPROVE_LEAVE)
  @ApiOperation({ summary: 'Get pending leave request count' })
  @ApiResponse({ status: 200, description: 'Count returned' })
  getPendingCount(@Req() req: AuthenticatedRequest) {
    return this.leaveService.getPendingCount(req.user.tenantId, req.user);
  }

  @Get('requests/on-leave-today')
  @ApiOperation({
    summary:
      'Get IDs of employees currently on approved leave — visible to all employees',
  })
  @ApiResponse({ status: 200, description: 'On-leave employee IDs returned' })
  getEmployeesOnLeaveToday(@Req() req: AuthenticatedRequest) {
    return this.leaveService.getEmployeesOnLeaveToday(req.user.tenantId);
  }

  @Get('requests/my')
  @RequirePermissions(Permission.READ_OWN_LEAVE)
  @ApiOperation({ summary: "Get the logged-in employee's own leave requests" })
  @ApiResponse({ status: 200, description: 'My leave requests retrieved' })
  async getMyRequests(@Req() req: AuthenticatedRequest) {
    const employee = await this.leaveService.getEmployeeByUserId(
      req.user.tenantId,
      req.user.id,
    );
    return this.leaveService.getRequests(req.user.tenantId, req.user, {
      employeeId: employee?.id,
    });
  }

  @Patch('requests/:id/review')
  @RequirePermissions(Permission.APPROVE_LEAVE)
  @ApiOperation({ summary: 'Approve or reject a leave request' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiBody({ type: ReviewLeaveRequestDto })
  @ApiResponse({ status: 200, description: 'Leave request reviewed' })
  reviewRequest(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.reviewRequest(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch('requests/:id/supporting-document')
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @ApiOperation({
    summary:
      'Attach or replace the supporting document for a pending leave request',
  })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiBody({ type: UpdateLeaveRequestSupportingDocumentDto })
  @ApiResponse({
    status: 200,
    description: 'Supporting document updated for the leave request',
  })
  updateSupportingDocument(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveRequestSupportingDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.updateRequestSupportingDocument(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch('requests/:id/cancel')
  @RequirePermissions(Permission.REQUEST_LEAVE)
  @ApiOperation({ summary: 'Cancel a leave request' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({ status: 200, description: 'Leave request cancelled' })
  cancelRequest(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaveService.cancelRequest(req.user.tenantId, id, req.user);
  }
}
