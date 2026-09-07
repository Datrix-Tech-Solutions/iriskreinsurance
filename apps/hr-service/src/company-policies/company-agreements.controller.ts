import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@work-phelo/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { CompanyAgreementsService } from './company-agreements.service';
import { CreateCompanyAgreementDto } from './dto/create-company-agreement.dto';
import { DeclineCompanyAgreementDto } from './dto/decline-company-agreement.dto';
import { PublishCompanyAgreementDto } from './dto/publish-company-agreement.dto';
import { QueryCompanyAgreementSignaturesDto } from './dto/query-company-agreement-signatures.dto';
import { SignCompanyAgreementDto } from './dto/sign-company-agreement.dto';
import { UpdateCompanyAgreementDto } from './dto/update-company-agreement.dto';

@ApiTags('Company Agreements')
@Controller('company-agreements')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class CompanyAgreementsController {
  constructor(
    private readonly companyAgreementsService: CompanyAgreementsService,
  ) {}

  private requestMetadata(req: Request) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim() || req.ip || null;

    return {
      ipAddress,
      userAgent: req.get('user-agent') ?? null,
    };
  }

  @Get()
  @RequirePermissions(Permission.READ_HR_SETTINGS)
  @ApiOperation({
    summary: 'List company agreements for the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Company agreements retrieved successfully',
  })
  findAll(@Req() req: Request & { user: RequestUser }) {
    return this.companyAgreementsService.findAll(req.user.tenantId);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Create a company agreement for the current tenant',
  })
  @ApiBody({ type: CreateCompanyAgreementDto })
  @ApiResponse({
    status: 201,
    description: 'Company agreement created successfully',
  })
  create(
    @Body() dto: CreateCompanyAgreementDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.create(
      req.user.tenantId,
      dto,
      req.user.id,
    );
  }

  @Get('me')
  @RequirePermissions(Permission.READ_OWN_PROFILE)
  @ApiOperation({
    summary: 'List company agreements for the logged-in employee',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee company agreements retrieved successfully',
  })
  findMine(@Req() req: Request & { user: RequestUser }) {
    return this.companyAgreementsService.findMyAgreements(
      req.user.tenantId,
      req.user.id,
    );
  }

  @Get('me/:versionId')
  @RequirePermissions(Permission.READ_OWN_PROFILE)
  @ApiOperation({
    summary: 'Get an active agreement version for the logged-in employee',
  })
  @ApiParam({
    name: 'versionId',
    description: 'Company agreement version UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee company agreement version retrieved successfully',
  })
  findMineByVersion(
    @Param('versionId') versionId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.findMyAgreementVersion(
      req.user.tenantId,
      req.user.id,
      versionId,
    );
  }

  @Post('me/:versionId/sign')
  @RequirePermissions(Permission.READ_OWN_PROFILE)
  @ApiOperation({
    summary: 'Sign an active agreement version with typed legal name',
  })
  @ApiParam({
    name: 'versionId',
    description: 'Company agreement version UUID',
  })
  @ApiBody({ type: SignCompanyAgreementDto })
  @ApiResponse({ status: 201, description: 'Agreement signed successfully' })
  signMine(
    @Param('versionId') versionId: string,
    @Body() dto: SignCompanyAgreementDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.signMyAgreement(
      req.user.tenantId,
      req.user.id,
      versionId,
      dto,
      this.requestMetadata(req),
    );
  }

  @Post('me/:versionId/decline')
  @RequirePermissions(Permission.READ_OWN_PROFILE)
  @ApiOperation({
    summary: 'Decline an active agreement version',
  })
  @ApiParam({
    name: 'versionId',
    description: 'Company agreement version UUID',
  })
  @ApiBody({ type: DeclineCompanyAgreementDto })
  @ApiResponse({ status: 201, description: 'Agreement declined successfully' })
  declineMine(
    @Param('versionId') versionId: string,
    @Body() dto: DeclineCompanyAgreementDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.declineMyAgreement(
      req.user.tenantId,
      req.user.id,
      versionId,
      dto,
      this.requestMetadata(req),
    );
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary:
      'Update agreement working-copy fields without mutating published versions',
  })
  @ApiParam({ name: 'id', description: 'Company agreement UUID' })
  @ApiBody({ type: UpdateCompanyAgreementDto })
  @ApiResponse({
    status: 200,
    description: 'Company agreement updated successfully',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyAgreementDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.id,
    );
  }

  @Post(':id/publish')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Publish an immutable agreement version for employee signing',
  })
  @ApiParam({ name: 'id', description: 'Company agreement UUID' })
  @ApiBody({ type: PublishCompanyAgreementDto })
  @ApiResponse({
    status: 201,
    description: 'Company agreement version published successfully',
  })
  publish(
    @Param('id') id: string,
    @Body() dto: PublishCompanyAgreementDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.publish(
      req.user.tenantId,
      id,
      dto,
      req.user.id,
    );
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Archive a company agreement and stop new employee signing',
  })
  @ApiParam({ name: 'id', description: 'Company agreement UUID' })
  @ApiResponse({
    status: 200,
    description: 'Company agreement archived successfully',
  })
  archive(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.archive(
      req.user.tenantId,
      id,
      req.user.id,
    );
  }

  @Get(':id/signatures')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Track employee signing status for the active agreement version',
  })
  @ApiParam({ name: 'id', description: 'Company agreement UUID' })
  @ApiResponse({
    status: 200,
    description: 'Company agreement signatures retrieved successfully',
  })
  signatures(
    @Param('id') id: string,
    @Query() query: QueryCompanyAgreementSignaturesDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.companyAgreementsService.getSignatureTracking(
      req.user.tenantId,
      id,
      query,
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Delete a company agreement',
  })
  @ApiParam({ name: 'id', description: 'Company agreement UUID' })
  @ApiResponse({
    status: 200,
    description: 'Company agreement deleted successfully',
  })
  remove(@Param('id') id: string, @Req() req: Request & { user: RequestUser }) {
    return this.companyAgreementsService.remove(
      req.user.tenantId,
      id,
      req.user.id,
    );
  }
}
