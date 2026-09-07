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
import { CreateRiskClassDto } from './dto/create-risk-class.dto';
import { QueryRiskClassesDto } from './dto/query-risk-classes.dto';
import {
  ApiErrorResponseDto,
  PaginatedRiskClassesResponseDto,
  RiskClassResponseDto,
} from './dto/risk-class-response.dto';
import { UpdateRiskClassDto } from './dto/update-risk-class.dto';
import { RiskClassSettingsPermission } from './risk-class-settings.permissions';
import { RiskClassSettingsService } from './risk-class-settings.service';

@Controller('settings/risk-classes')
@ApiTags('Reinsurance - Risk Classes')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class RiskClassSettingsController {
  constructor(private readonly riskClassService: RiskClassSettingsService) {}

  @Get()
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({
    summary: 'List risk classes',
    description:
      'Returns non-archived risk classes in the authenticated tenant, including nested active risk types and their fields.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiOkResponse({ type: PaginatedRiskClassesResponseDto })
  findAll(
    @Query() query: QueryRiskClassesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(RiskClassSettingsPermission.CREATE)
  @ApiOperation({ summary: 'Create a risk class' })
  @ApiCreatedResponse({ type: RiskClassResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateRiskClassDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.create(request.user, dto);
  }

  @Get(':id')
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({ summary: 'Get a risk class by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RiskClassResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(RiskClassSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Update a risk class' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RiskClassResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskClassDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(RiskClassSettingsPermission.DELETE)
  @ApiOperation({ summary: 'Archive a risk class' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RiskClassResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.archive(request.user, id);
  }
}
