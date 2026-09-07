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
import { CurrencySettingsPermission } from './currency-settings.permissions';
import { CurrencySettingsService } from './currency-settings.service';
import {
  ApiErrorResponseDto,
  CurrencyResponseDto,
  PaginatedCurrenciesResponseDto,
} from './dto/currency-response.dto';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { QueryCurrenciesDto } from './dto/query-currencies.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Controller('settings/currencies')
@ApiTags('Reinsurance - Currencies')
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
export class CurrencySettingsController {
  constructor(private readonly service: CurrencySettingsService) {}

  @Get()
  @RequirePermissions(CurrencySettingsPermission.VIEW)
  @ApiOperation({
    summary: 'List currencies',
    description:
      'Returns non-archived currencies for the authenticated tenant. Base currency is always listed first.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status.',
  })
  @ApiOkResponse({ type: PaginatedCurrenciesResponseDto })
  findAll(
    @Query() query: QueryCurrenciesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(CurrencySettingsPermission.CREATE)
  @ApiOperation({
    summary: 'Create a currency',
    description:
      'Creates a currency for the tenant. Non-base currencies require exchangeRateToBase > 0. Only one base currency is allowed per tenant.',
  })
  @ApiCreatedResponse({ type: CurrencyResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid payload or non-base currency missing exchange rate.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'Currency ISO code already exists, or a base currency already exists for this tenant.',
  })
  create(
    @Body() dto: CreateCurrencyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Patch(':id')
  @RequirePermissions(CurrencySettingsPermission.EDIT)
  @ApiOperation({
    summary: 'Update a currency',
    description:
      'ISO code cannot be changed. Promoting a currency to base (isBaseCurrency: true) demotes the existing base currency.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Currency ID.' })
  @ApiOkResponse({ type: CurrencyResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid or empty update payload.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Currency not found.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurrencyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(CurrencySettingsPermission.DELETE)
  @ApiOperation({
    summary: 'Archive a currency',
    description:
      'Soft-archives the currency. Rejected if any active (non-archived) placements reference this currency ISO code.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Currency ID.' })
  @ApiOkResponse({ type: CurrencyResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Active placements reference this currency.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Currency not found.',
  })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.archive(request.user, id);
  }
}
