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
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { FiscalPeriodStatus } from '../../prisma/generated/client';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingPermission } from './accounting.permissions';
import {
  CreateAccountingCurrencyDto,
  CreateExchangeRateDto,
  CreateFiscalPeriodDto,
  QueryFiscalPeriodsDto,
  UpdateAccountingCurrencyDto,
  UpdateAccountingTenantConfigDto,
  UpdateExchangeRateDto,
} from './dto/accounting.dto';

@Controller()
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class AccountingSettingsController {
  constructor(private readonly service: AccountingMasterDataService) {}

  @Get('config')
  @ApiTags('Accounting - Configuration')
  @ApiOperation({ summary: 'Get tenant Accounting configuration' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  getConfig(@Req() request: Request & { user: RequestUser }) {
    return this.service.getConfig(request.user.tenantId);
  }

  @Patch('config')
  @ApiTags('Accounting - Configuration')
  @ApiOperation({ summary: 'Create or update tenant Accounting configuration' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateConfig(
    @Body() dto: UpdateAccountingTenantConfigDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateConfig(request.user, dto);
  }

  @Get('currencies')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'List tenant Accounting currencies' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listCurrencies(@Req() request: Request & { user: RequestUser }) {
    return this.service.listCurrencies(request.user.tenantId);
  }

  @Post('currencies')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Create an Accounting currency' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createCurrency(
    @Body() dto: CreateAccountingCurrencyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCurrency(request.user, dto);
  }

  @Patch('currencies/:currencyId')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Update or deactivate an Accounting currency' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateCurrency(
    @Param('currencyId', ParseUUIDPipe) currencyId: string,
    @Body() dto: UpdateAccountingCurrencyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateCurrency(request.user, currencyId, dto);
  }

  @Get('exchange-rates')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'List tenant exchange rates' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listExchangeRates(@Req() request: Request & { user: RequestUser }) {
    return this.service.listExchangeRates(request.user.tenantId);
  }

  @Post('exchange-rates')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Create an effective-dated exchange rate' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createExchangeRate(
    @Body() dto: CreateExchangeRateDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createExchangeRate(request.user, dto);
  }

  @Patch('exchange-rates/:rateId')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Update or deactivate an exchange rate' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateExchangeRate(
    @Param('rateId', ParseUUIDPipe) rateId: string,
    @Body() dto: UpdateExchangeRateDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateExchangeRate(request.user, rateId, dto);
  }

  @Get('fiscal-periods')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'List tenant fiscal periods' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listFiscalPeriods(
    @Query() query: QueryFiscalPeriodsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listFiscalPeriods(request.user.tenantId, query);
  }

  @Post('fiscal-periods')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'Create a non-overlapping fiscal period' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createFiscalPeriod(
    @Body() dto: CreateFiscalPeriodDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createFiscalPeriod(request.user, dto);
  }

  @Post('fiscal-periods/:periodId/open')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'Reopen a closed fiscal period' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  openFiscalPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.changeFiscalPeriodStatus(
      request.user,
      periodId,
      FiscalPeriodStatus.OPEN,
    );
  }

  @Post('fiscal-periods/:periodId/close')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'Close an open fiscal period' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  closeFiscalPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.changeFiscalPeriodStatus(
      request.user,
      periodId,
      FiscalPeriodStatus.CLOSED,
    );
  }

  @Post('fiscal-periods/:periodId/lock')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'Permanently lock a fiscal period' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  lockFiscalPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.changeFiscalPeriodStatus(
      request.user,
      periodId,
      FiscalPeriodStatus.LOCKED,
    );
  }
}
