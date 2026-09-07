import {
  Body,
  Controller,
  Delete,
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
  ApiQuery,
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
import { CreateRiskTypeFieldDto } from './dto/create-risk-type-field.dto';
import { CreateRiskTypeDto } from './dto/create-risk-type.dto';
import { QueryRiskClassesDto } from './dto/query-risk-classes.dto';
import {
  ApiErrorResponseDto,
  PaginatedRiskTypesResponseDto,
  RiskTypeFieldResponseDto,
  RiskTypeFormSchemaResponseDto,
  RiskTypeResponseDto,
} from './dto/risk-class-response.dto';
import { UpdateRiskTypeFieldDto } from './dto/update-risk-type-field.dto';
import { UpdateRiskTypeDto } from './dto/update-risk-type.dto';
import { RiskClassSettingsPermission } from './risk-class-settings.permissions';
import { RiskTypeSettingsService } from './risk-type-settings.service';

@Controller('settings/risk-types')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class RiskTypeSettingsController {
  constructor(private readonly riskTypeService: RiskTypeSettingsService) {}

  @Get()
  @ApiTags('Reinsurance - Risk Types')
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({ summary: 'List risk types' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiOkResponse({ type: PaginatedRiskTypesResponseDto })
  findAll(
    @Query() query: QueryRiskClassesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.findAll(request.user.tenantId, query);
  }

  @Post()
  @ApiTags('Reinsurance - Risk Types')
  @RequirePermissions(RiskClassSettingsPermission.CREATE)
  @ApiOperation({
    summary: 'Create a risk type',
    description:
      'Creates a risk type under an active tenant-owned risk class. Use the returned ID when adding fields or creating placements.',
  })
  @ApiCreatedResponse({ type: RiskTypeResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateRiskTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.create(request.user, dto);
  }

  @Get(':id')
  @ApiTags('Reinsurance - Risk Types')
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({ summary: 'Get a risk type by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiOkResponse({ type: RiskTypeResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @ApiTags('Reinsurance - Risk Types')
  @RequirePermissions(RiskClassSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Update a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiOkResponse({ type: RiskTypeResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.update(request.user, id, dto);
  }

  @Delete(':id')
  @ApiTags('Reinsurance - Risk Types')
  @RequirePermissions(RiskClassSettingsPermission.DELETE)
  @ApiOperation({ summary: 'Archive a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiOkResponse({ type: RiskTypeResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.archive(request.user, id);
  }

  @Post(':id/fields')
  @ApiTags('Reinsurance - Risk Type Fields')
  @RequirePermissions(RiskClassSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Add a field to a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiCreatedResponse({ type: RiskTypeFieldResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createField(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRiskTypeFieldDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.createField(request.user, id, dto);
  }

  @Patch(':id/fields/:fieldId')
  @ApiTags('Reinsurance - Risk Type Fields')
  @RequirePermissions(RiskClassSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Update a field on a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiParam({ name: 'fieldId', format: 'uuid' })
  @ApiOkResponse({ type: RiskTypeFieldResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateRiskTypeFieldDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.updateField(request.user, id, fieldId, dto);
  }

  @Delete(':id/fields/:fieldId')
  @ApiTags('Reinsurance - Risk Type Fields')
  @RequirePermissions(RiskClassSettingsPermission.DELETE)
  @ApiOperation({ summary: 'Delete a field from a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiParam({ name: 'fieldId', format: 'uuid' })
  @ApiOkResponse({ description: 'Field deleted.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deleteField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.deleteField(request.user, id, fieldId);
  }

  @Get(':id/form-schema')
  @ApiTags('Reinsurance - Risk Type Fields')
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({ summary: 'Get form schema for a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiOkResponse({ type: RiskTypeFormSchemaResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getFormSchema(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.getFormSchema(request.user.tenantId, id);
  }
}
