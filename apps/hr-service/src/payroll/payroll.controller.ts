import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
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
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { UpdatePayrollItemDto } from './dto/update-payroll-item.dto';
import { PayrollDecisionDto } from './dto/payroll-decision.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';

@ApiTags('Payroll')
@Controller('payroll')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'payroll')
@ApiBearerAuth('access-token')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({
    summary:
      'Run payroll for a given period — Ghana GRA tax calculations applied',
  })
  @ApiBody({
    schema: {
      example: {
        month: 4,
        year: 2026,
        notes: 'April 2026 monthly payroll draft',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Payroll draft created successfully',
  })
  @ApiResponse({ status: 400, description: 'No active employees found' })
  runPayroll(
    @Body() dto: RunPayrollDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payrollService.runPayroll(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({
    summary: 'Edit payroll values for a specific employee within a draft run',
  })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiParam({ name: 'itemId', description: 'Payroll item UUID' })
  @ApiBody({ type: UpdatePayrollItemDto })
  @ApiResponse({ status: 200, description: 'Payroll item updated' })
  updatePayrollItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePayrollItemDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payrollService.updatePayrollItem(
      req.user.tenantId,
      id,
      itemId,
      dto,
    );
  }

  @Patch(':id/submit')
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({ summary: 'Submit a draft payroll run for approval' })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiResponse({ status: 200, description: 'Payroll submitted for approval' })
  submitPayroll(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payrollService.submitPayrollForApproval(
      req.user.tenantId,
      id,
      req.user,
    );
  }

  @Get()
  @RequirePermissions(Permission.READ_PAYROLL)
  @ApiOperation({ summary: 'List all payroll runs for the tenant' })
  @ApiResponse({ status: 200, description: 'Payroll runs retrieved' })
  getPayrollRuns(@Req() req: Request & { user: RequestUser }) {
    return this.payrollService.getPayrollRuns(req.user.tenantId, req.user);
  }

  @Get('my-payslips')
  @RequirePermissions(Permission.READ_OWN_PAYSLIP)
  @ApiOperation({ summary: 'Get payslips for the logged-in employee' })
  @ApiResponse({ status: 200, description: 'Payslips retrieved' })
  getMyPayslips(@Req() req: Request & { user: RequestUser }) {
    return this.payrollService.getMyPayslips(req.user.tenantId, req.user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_PAYROLL)
  @ApiOperation({ summary: 'Get a specific payroll run with all payslips' })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiResponse({ status: 200, description: 'Payroll run retrieved' })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  getPayrollRun(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payrollService.getPayrollRunById(
      req.user.tenantId,
      id,
      req.user,
    );
  }

  @Patch(':id/approve')
  @RequirePermissions(Permission.APPROVE_PAYROLL)
  @ApiOperation({ summary: 'Approve a payroll run' })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiBody({ type: PayrollDecisionDto })
  @ApiResponse({ status: 200, description: 'Payroll approved' })
  approvePayroll(
    @Param('id') id: string,
    @Body() dto: PayrollDecisionDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payrollService.approvePayroll(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch(':id/return-to-draft')
  @RequirePermissions(Permission.APPROVE_PAYROLL)
  @ApiOperation({
    summary: 'Return a pending payroll run to draft for further edits',
  })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiBody({ type: PayrollDecisionDto })
  @ApiResponse({ status: 200, description: 'Payroll returned to draft' })
  returnPayrollToDraft(
    @Param('id') id: string,
    @Body() dto: PayrollDecisionDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payrollService.returnPayrollToDraft(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch(':id/mark-paid')
  @RequirePermissions(Permission.APPROVE_PAYROLL)
  @ApiOperation({ summary: 'Mark a payroll run as paid' })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiResponse({ status: 200, description: 'Payroll marked as paid' })
  markAsPaid(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payrollService.markAsPaid(req.user.tenantId, id);
  }
}
