import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ApiErrorResponseDto,
  CreateReinsuranceChargeConfigurationDto,
  PreviewReinsuranceChargeCalculationDto,
  QueryReinsuranceChargeConfigurationsDto,
  ReinsuranceChargeConfigurationResponseDto,
  ReinsuranceChargeTemplateDto,
  UpdateReinsuranceChargeConfigurationDto,
} from './dto/reinsurance-charge-configuration.dto';
import { ReinsuranceChargeSettingsPermission } from './reinsurance-charge-settings.permissions';
import { ReinsuranceChargeSettingsService } from './reinsurance-charge-settings.service';

@Controller('settings/charges')
@ApiTags('Reinsurance - Taxes and Levies')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class ReinsuranceChargeSettingsController {
  constructor(private readonly service: ReinsuranceChargeSettingsService) {}

  @Get('templates')
  @RequirePermissions(ReinsuranceChargeSettingsPermission.VIEW)
  @ApiOperation({
    summary: 'List starter templates for reinsurance taxes and levies',
    description:
      'Returns template metadata only. It does not assume statutory rates.',
  })
  @ApiOkResponse({ type: [ReinsuranceChargeTemplateDto] })
  templates() {
    return this.service.templates();
  }

  @Get()
  @RequirePermissions(ReinsuranceChargeSettingsPermission.VIEW)
  @ApiOperation({
    summary: 'List tenant reinsurance charge configurations',
    description:
      'Lists tenant-scoped, effective-dated taxes, levies and charges. Currency-specific configurations are stored separately from all-currency configurations.',
  })
  @ApiOkResponse({ type: [ReinsuranceChargeConfigurationResponseDto] })
  findAll(
    @Query() query: QueryReinsuranceChargeConfigurationsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(ReinsuranceChargeSettingsPermission.CREATE)
  @ApiOperation({
    summary: 'Create a reinsurance charge configuration',
    description:
      'Creates a tenant-approved percentage or fixed-amount charge. Overlapping periods are rejected for the same tenant, charge code and currency scope.',
  })
  @ApiCreatedResponse({ type: ReinsuranceChargeConfigurationResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateReinsuranceChargeConfigurationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Post('preview')
  @RequirePermissions(ReinsuranceChargeSettingsPermission.VIEW)
  @ApiOperation({
    summary: 'Preview configured charge calculation',
    description:
      'Runs the same calculation engine used when debit and credit notes snapshot applied charges. Preview never persists notes or configuration.',
  })
  @ApiOkResponse({
    description:
      'Calculated charge lines and net amount using enabled configurations effective at the requested date.',
  })
  preview(
    @Body() dto: PreviewReinsuranceChargeCalculationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.preview(request.user.tenantId, dto);
  }

  @Get(':id')
  @RequirePermissions(ReinsuranceChargeSettingsPermission.VIEW)
  @ApiOperation({ summary: 'Get one charge configuration' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReinsuranceChargeConfigurationResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(ReinsuranceChargeSettingsPermission.EDIT)
  @ApiOperation({
    summary: 'Update one charge configuration',
    description:
      'Updates a tenant charge configuration while preserving non-overlap rules for the resulting effective period and currency scope.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReinsuranceChargeConfigurationResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReinsuranceChargeConfigurationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions(ReinsuranceChargeSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Activate one charge configuration' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReinsuranceChargeConfigurationResponseDto })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.activate(request.user, id);
  }

  @Post(':id/deactivate')
  @RequirePermissions(ReinsuranceChargeSettingsPermission.DELETE)
  @ApiOperation({ summary: 'Deactivate one charge configuration' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReinsuranceChargeConfigurationResponseDto })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deactivate(request.user, id);
  }
}
