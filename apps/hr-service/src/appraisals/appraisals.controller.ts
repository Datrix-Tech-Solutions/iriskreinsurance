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
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppraisalsService } from './appraisals.service';
import { CreateAppraisalCycleDto } from './dto/create-cycle.dto';
import { UpdateAppraisalCycleDto } from './dto/update-cycle.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { CreateAppraisalTemplateDto } from './dto/create-template.dto';
import { CreateAppraisalKpiDto } from './dto/create-kpi.dto';
import { CancelAppraisalCycleDto } from './dto/cancel-cycle.dto';
import { FinalizeAppraisalDto } from './dto/finalize-appraisal.dto';
import { ReopenAppraisalDto } from './dto/reopen-appraisal.dto';
import { QueryAppraisalTemplatesDto } from './dto/query-appraisal-templates.dto';
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

@ApiTags('Appraisals')
@Controller('appraisals')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'appraisals')
@ApiBearerAuth('access-token')
export class AppraisalsController {
  constructor(private readonly appraisalsService: AppraisalsService) {}

  // ── Cycles ──────────────────────────────────────────────────────────────────

  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Create a new appraisal cycle' })
  @ApiBody({ type: CreateAppraisalCycleDto })
  @ApiResponse({ status: 201, description: 'Appraisal cycle created' })
  createCycle(
    @Body() dto: CreateAppraisalCycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.createCycle(
      req.user.tenantId,
      req.user.id,
      dto,
    );
  }

  @Get('cycles')
  @ApiOperation({ summary: 'List all appraisal cycles for the tenant' })
  @ApiResponse({ status: 200, description: 'Appraisal cycles retrieved' })
  getCycles(@Req() req: AuthenticatedRequest) {
    return this.appraisalsService.getCycles(req.user.tenantId);
  }

  @Get('cycles/:cycleId')
  @ApiOperation({ summary: 'Get a single appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle retrieved' })
  getCycle(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.getCycle(req.user.tenantId, cycleId);
  }

  @Patch('cycles/:cycleId')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Update an appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiBody({ type: UpdateAppraisalCycleDto })
  @ApiResponse({ status: 200, description: 'Appraisal cycle updated' })
  updateCycle(
    @Param('cycleId') cycleId: string,
    @Body() dto: UpdateAppraisalCycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.updateCycle(req.user.tenantId, cycleId, dto);
  }

  @Delete('cycles/:cycleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Delete an appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle deleted' })
  deleteCycle(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.deleteCycle(req.user.tenantId, cycleId);
  }

  @Post('cycles/:cycleId/start')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({
    summary:
      'Start an appraisal cycle — generates appraisal records for all employees',
  })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle started' })
  startCycle(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.startCycle(
      req.user.tenantId,
      cycleId,
      req.user,
    );
  }

  @Patch('cycles/:cycleId/cancel')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Cancel an in-progress appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiBody({ type: CancelAppraisalCycleDto })
  @ApiResponse({ status: 200, description: 'Appraisal cycle cancelled' })
  cancelCycle(
    @Param('cycleId') cycleId: string,
    @Body() dto: CancelAppraisalCycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.cancelCycle(
      req.user.tenantId,
      cycleId,
      dto.reason,
    );
  }

  @Get('cycles/:cycleId/appraisals')
  @ApiOperation({ summary: 'Get all appraisal records for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisals retrieved' })
  getAppraisals(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.getAppraisals(
      req.user.tenantId,
      req.user,
      cycleId,
    );
  }

  @Get('cycles/:cycleId/results')
  @ApiOperation({
    summary: 'Get cycle results summary with rating distribution',
  })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Cycle results retrieved' })
  getCycleResults(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.getCycleResults(req.user.tenantId, cycleId);
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────

  @Get('cycles/:cycleId/kpis')
  @ApiOperation({ summary: 'Get KPIs for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'KPIs retrieved' })
  getCycleKpis(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.getCycleKpis(req.user.tenantId, cycleId);
  }

  @Post('cycles/:cycleId/kpis')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a KPI for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiBody({ type: CreateAppraisalKpiDto })
  @ApiResponse({ status: 201, description: 'KPI created' })
  createCycleKpi(
    @Param('cycleId') cycleId: string,
    @Body() dto: CreateAppraisalKpiDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.createCycleKpi(
      req.user.tenantId,
      cycleId,
      req.user,
      dto,
    );
  }

  @Put('cycles/:cycleId/kpis/:kpiId')
  @ApiOperation({ summary: 'Update a KPI for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiParam({ name: 'kpiId', description: 'KPI UUID' })
  @ApiBody({ type: CreateAppraisalKpiDto })
  @ApiResponse({ status: 200, description: 'KPI updated' })
  updateCycleKpi(
    @Param('cycleId') cycleId: string,
    @Param('kpiId') kpiId: string,
    @Body() dto: Partial<CreateAppraisalKpiDto>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.updateCycleKpi(
      req.user.tenantId,
      cycleId,
      kpiId,
      req.user,
      dto,
    );
  }

  @Post('cycles/:cycleId/seed-from-template')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({
    summary:
      'Seed cycle KPIs from its linked template — copies template KPIs and weights into the cycle',
  })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'KPIs seeded from template' })
  @ApiResponse({
    status: 400,
    description: 'Cycle has no linked template, or template has no KPIs',
  })
  @ApiResponse({
    status: 409,
    description: 'Cycle already has KPIs — remove them first',
  })
  seedCycleFromTemplate(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.seedCycleFromTemplate(
      req.user.tenantId,
      cycleId,
    );
  }

  // ── Templates ───────────────────────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'List appraisal templates' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  getTemplates(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAppraisalTemplatesDto,
  ) {
    return this.appraisalsService.getTemplates(
      req.user.tenantId,
      query.page ?? 1,
      query.search,
    );
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Create an appraisal template' })
  @ApiBody({ type: CreateAppraisalTemplateDto })
  @ApiResponse({ status: 201, description: 'Template created' })
  createTemplate(
    @Body() dto: CreateAppraisalTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.createTemplate(req.user.tenantId, dto);
  }

  @Put('templates/:templateId')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Update an appraisal template' })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiBody({ type: CreateAppraisalTemplateDto })
  @ApiResponse({ status: 200, description: 'Template updated' })
  updateTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: Partial<CreateAppraisalTemplateDto>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.updateTemplate(
      req.user.tenantId,
      templateId,
      dto,
    );
  }

  @Delete('templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Delete an appraisal template' })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  deleteTemplate(
    @Param('templateId') templateId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.deleteTemplate(req.user.tenantId, templateId);
  }

  // ── Employee appraisals ─────────────────────────────────────────────────────

  @Get('my')
  @RequirePermissions(Permission.READ_OWN_REVIEW)
  @ApiOperation({ summary: "Get the logged-in employee's own appraisals" })
  @ApiResponse({ status: 200, description: 'My appraisals retrieved' })
  getMyAppraisals(@Req() req: AuthenticatedRequest) {
    return this.appraisalsService.getMyAppraisals(
      req.user.tenantId,
      req.user.id,
    );
  }

  @Get('team')
  @RequirePermissions(Permission.SUBMIT_MANAGER_REVIEW)
  @ApiOperation({ summary: "Get manager's team appraisals for review" })
  @ApiResponse({ status: 200, description: 'Team appraisals retrieved' })
  getTeamAppraisals(@Req() req: AuthenticatedRequest) {
    return this.appraisalsService.getTeamAppraisals(
      req.user.tenantId,
      req.user.id,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single appraisal record' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal retrieved' })
  getAppraisal(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.appraisalsService.getAppraisal(req.user.tenantId, id, req.user);
  }

  @Patch(':id/self-assessment')
  @RequirePermissions(Permission.SUBMIT_SELF_ASSESSMENT)
  @ApiOperation({ summary: 'Submit self-assessment for an appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: SubmitReviewDto })
  @ApiResponse({ status: 200, description: 'Self-assessment submitted' })
  submitSelf(
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.submitSelfAssessment(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch(':id/manager-review')
  @RequirePermissions(Permission.SUBMIT_MANAGER_REVIEW)
  @ApiOperation({ summary: 'Submit manager review for an appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: SubmitReviewDto })
  @ApiResponse({ status: 200, description: 'Manager review submitted' })
  submitManagerReview(
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.submitManagerReview(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch(':id/finalize')
  @RequirePermissions(Permission.FINALIZE_APPRAISAL)
  @ApiOperation({ summary: 'Finalize an employee appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: FinalizeAppraisalDto })
  @ApiResponse({ status: 200, description: 'Appraisal finalized' })
  finalizeAppraisal(
    @Param('id') id: string,
    @Body() dto: FinalizeAppraisalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.finalizeAppraisal(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }

  @Patch(':id/reopen')
  @ApiOperation({ summary: 'Reopen an appraisal for redo' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: ReopenAppraisalDto })
  @ApiResponse({ status: 200, description: 'Appraisal reopened' })
  reopenAppraisal(
    @Param('id') id: string,
    @Body() dto: ReopenAppraisalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.reopenAppraisal(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }
}
