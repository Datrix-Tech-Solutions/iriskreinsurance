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
import { CounterpartiesService } from './counterparties.service';
import { CounterpartyPermission } from './counterparty.permissions';
import {
  ApiErrorResponseDto,
  CounterpartyResponseDto,
  PaginatedCounterpartiesResponseDto,
} from './dto/counterparty-response.dto';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { QueryCounterpartiesDto } from './dto/query-counterparties.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@Controller('counterparties')
@ApiTags('Reinsurance - Counterparties')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Module, feature or required permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class CounterpartiesController {
  constructor(private readonly counterpartiesService: CounterpartiesService) {}

  @Get()
  @RequirePermissions(CounterpartyPermission.VIEW)
  @ApiOperation({
    summary: 'List active counterparties',
    description:
      'Returns only non-archived records in the authenticated tenant.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'Ghana Re' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['CEDANT', 'REINSURER', 'BROKER'],
  })
  @ApiQuery({
    name: 'origin',
    required: false,
    enum: ['LOCAL', 'FOREIGN'],
    description: 'Filter local or foreign counterparties.',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    example: 'GH',
    description: 'ISO 3166-1 alpha-2 country filter.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ type: PaginatedCounterpartiesResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid query filter or pagination value.',
  })
  findAll(
    @Query() query: QueryCounterpartiesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(CounterpartyPermission.CREATE)
  @ApiOperation({
    summary: 'Create a counterparty with contacts and addresses',
  })
  @ApiCreatedResponse({ type: CounterpartyResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid payload, multiple primary children or missing contact channel.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active counterparty with this name and type already exists.',
  })
  create(
    @Body() dto: CreateCounterpartyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.create(request.user, dto);
  }

  @Get(':id')
  @RequirePermissions(CounterpartyPermission.VIEW)
  @ApiOperation({ summary: 'Get an active counterparty by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Counterparty ID.' })
  @ApiOkResponse({ type: CounterpartyResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The counterparty is archived, missing or belongs to another tenant.',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(CounterpartyPermission.EDIT)
  @ApiOperation({
    summary: 'Update an active counterparty',
    description:
      'If contacts or addresses are supplied, each supplied array replaces the complete stored collection.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Counterparty ID.' })
  @ApiOkResponse({ type: CounterpartyResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid or empty update payload.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The counterparty is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active counterparty with this name and type already exists.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCounterpartyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(CounterpartyPermission.DELETE)
  @ApiOperation({
    summary: 'Archive a counterparty',
    description:
      'Soft-archives the active record. Archived records are excluded from standard list and detail requests.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Counterparty ID.' })
  @ApiOkResponse({ type: CounterpartyResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The counterparty is archived, missing or belongs to another tenant.',
  })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.archive(request.user, id);
  }
}
