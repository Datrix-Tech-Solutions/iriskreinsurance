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
  ApiConflictResponse,
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
import { CashbookService } from './cashbook.service';
import {
  CreateCashAccountDto,
  CreateCashbookAdjustmentDto,
  CreateCashbookChargeDto,
  CreateCashbookPaymentDto,
  CreateCashbookReceiptDto,
  CreateCashbookTransferDto,
  QueryCashAccountsDto,
  QueryCashbookDto,
  ReverseCashbookTransactionDto,
  UpdateCashAccountDto,
} from './dto/cashbook.dto';

@Controller()
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class CashbookController {
  constructor(private readonly service: CashbookService) {}

  @Get('cash-accounts')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({
    summary: 'List tenant cash, bank and wallet accounts',
    description:
      'Returns Accounting-owned cash account masters. These are linked to active, posting-enabled GL asset accounts and are independent of source modules.',
  })
  @RequirePermissions(AccountingPermission.CASH_ACCOUNTS_VIEW)
  listCashAccounts(
    @Query() query: QueryCashAccountsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listCashAccounts(request.user.tenantId, query);
  }

  @Post('cash-accounts')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({
    summary: 'Create a tenant cash, bank or wallet account',
    description:
      'Creates a non-secret cash account master. Account identifiers should be masked; credentials and raw secrets must not be stored.',
  })
  @ApiConflictResponse({
    description: 'A cash account with this name or identifier already exists.',
  })
  @RequirePermissions(AccountingPermission.CASH_ACCOUNTS_MANAGE)
  createCashAccount(
    @Body() dto: CreateCashAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCashAccount(request.user, dto);
  }

  @Get('cash-accounts/:cashAccountId')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({ summary: 'Get a tenant cash account' })
  @RequirePermissions(AccountingPermission.CASH_ACCOUNTS_VIEW)
  getCashAccount(
    @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getCashAccount(request.user, cashAccountId);
  }

  @Patch('cash-accounts/:cashAccountId')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({
    summary: 'Update or deactivate a tenant cash account',
    description:
      'Inactive cash accounts remain historical but cannot receive new cashbook transactions.',
  })
  @RequirePermissions(AccountingPermission.CASH_ACCOUNTS_MANAGE)
  updateCashAccount(
    @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string,
    @Body() dto: UpdateCashAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateCashAccount(request.user, cashAccountId, dto);
  }

  @Get('cashbook')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'List tenant cashbook transactions',
    description:
      'Paginated read model for standalone Accounting cashbook transactions with filters for account, date range, type, status and currency.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_VIEW)
  listCashbook(
    @Query() query: QueryCashbookDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listCashbook(request.user.tenantId, query);
  }

  @Get('cashbook/:transactionId')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({ summary: 'Get a cashbook transaction with journal linkage' })
  @RequirePermissions(AccountingPermission.CASHBOOK_VIEW)
  getCashbookTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getCashbookTransaction(request.user, transactionId);
  }

  @Post('cashbook/receipts')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft manual cashbook receipt',
    description:
      'Posting debits the selected cash account GL account and credits the selected offset account.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_CREATE)
  createReceipt(
    @Body() dto: CreateCashbookReceiptDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createReceipt(request.user, dto);
  }

  @Post('cashbook/payments')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft manual cashbook payment',
    description:
      'Posting debits the selected offset account and credits the selected cash account GL account.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_CREATE)
  createPayment(
    @Body() dto: CreateCashbookPaymentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createPayment(request.user, dto);
  }

  @Post('cashbook/transfers')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft transfer between tenant cash accounts',
    description:
      'Posting debits the destination cash account GL account and credits the source cash account GL account. Cross-currency transfers require an agreed exchange rate; no live FX lookup is performed.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_CREATE)
  createTransfer(
    @Body() dto: CreateCashbookTransferDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createTransfer(request.user, dto);
  }

  @Post('cashbook/charges')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft standalone bank charge',
    description:
      'Posting debits the selected expense/offset account and credits the affected cash account.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_CREATE)
  createCharge(
    @Body() dto: CreateCashbookChargeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCharge(request.user, dto);
  }

  @Post('cashbook/adjustments')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft cashbook adjustment',
    description:
      'Adjustments can increase or reduce the selected cash account. Corrections to posted entries should use reversal plus a new adjustment.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_CREATE)
  createAdjustment(
    @Body() dto: CreateCashbookAdjustmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createAdjustment(request.user, dto);
  }

  @Post('cashbook/:transactionId/post')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Post a draft cashbook transaction',
    description:
      'Atomically creates a balanced posted journal and marks the cashbook transaction POSTED. Duplicate posting is rejected.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_POST)
  postTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postTransaction(request.user, transactionId);
  }

  @Post('cashbook/:transactionId/reverse')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Reverse a posted cashbook transaction',
    description:
      'Creates an immutable linked reversal cashbook row and a reversing posted journal. Posted transaction facts are not edited.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_REVERSE)
  reverseTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: ReverseCashbookTransactionDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseTransaction(request.user, transactionId, dto);
  }
}
