import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingPermission } from './accounting.permissions';
import {
  BalanceSheetReportQueryDto,
  GeneralLedgerReportQueryDto,
  IncomeStatementReportQueryDto,
  TrialBalanceReportQueryDto,
} from './dto/accounting-reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@ApiTags('Accounting - Financial Reports')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('general-ledger')
  @ApiOperation({
    summary: 'Run the enhanced General Ledger report',
    description:
      'Returns base-currency opening balance, movements, closing balance and posted journal lines with optional account, date, period, cost centre, subledger and currency filters.',
  })
  @RequirePermissions(AccountingPermission.LEDGER_VIEW)
  generalLedger(
    @Query() query: GeneralLedgerReportQueryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.generalLedger(request.user.tenantId, query);
  }

  @Get('trial-balance')
  @ApiOperation({
    summary: 'Run the Trial Balance report',
    description:
      'Groups GL account debit and credit balances by account category as of a selected date or fiscal period.',
  })
  @RequirePermissions(AccountingPermission.LEDGER_VIEW)
  trialBalance(
    @Query() query: TrialBalanceReportQueryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.trialBalance(request.user.tenantId, query);
  }

  @Get('income-statement')
  @ApiOperation({
    summary: 'Run the Income Statement report',
    description:
      'Summarizes revenue, expenses and net profit/loss for a date range, fiscal period and optional cost centre.',
  })
  @RequirePermissions(AccountingPermission.LEDGER_VIEW)
  incomeStatement(
    @Query() query: IncomeStatementReportQueryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.incomeStatement(request.user.tenantId, query);
  }

  @Get('balance-sheet')
  @ApiOperation({
    summary: 'Run the Balance Sheet report',
    description:
      'Summarizes asset, liability and equity balances as of a selected date or fiscal period.',
  })
  @RequirePermissions(AccountingPermission.LEDGER_VIEW)
  balanceSheet(
    @Query() query: BalanceSheetReportQueryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.balanceSheet(request.user.tenantId, query);
  }
}
