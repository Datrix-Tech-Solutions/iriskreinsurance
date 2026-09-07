import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingPermission } from './accounting.permissions';
import { BankReconciliationsService } from './bank-reconciliations.service';
import {
  CreateBankReconciliationDto,
  MatchBankStatementLineDto,
  QueryBankReconciliationsDto,
  QueryBankStatementLinesDto,
} from './dto/bank-reconciliations.dto';

@Controller('bank-reconciliations')
@ApiTags('Accounting - Bank Reconciliations')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class BankReconciliationsController {
  constructor(private readonly service: BankReconciliationsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant bank reconciliation sessions' })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_VIEW)
  list(
    @Query() query: QueryBankReconciliationsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a draft bank reconciliation session',
    description:
      'Creates only the reconciliation header. Statement import, matching and adjustment posting are separate controlled workflows.',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_MANAGE)
  create(
    @Body() dto: CreateBankReconciliationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Post(':reconciliationId/statement-lines/import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'CSV with transactionDate, amount and currency columns. Optional columns: valueDate, description, bankReference, counterpartyName, runningBalance.',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Import validated CSV statement lines into a draft reconciliation',
    description:
      'Imports immutable statement lines only. It does not match Cashbook transactions or create accounting entries.',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_MANAGE)
  importStatementLines(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.importStatementLines(
      request.user,
      reconciliationId,
      file,
    );
  }

  @Get(':reconciliationId/statement-lines')
  @ApiOperation({
    summary: 'List imported bank statement lines for a reconciliation',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_VIEW)
  listStatementLines(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Query() query: QueryBankStatementLinesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listStatementLines(
      request.user.tenantId,
      reconciliationId,
      query,
    );
  }

  @Get(':reconciliationId/statement-lines/:statementLineId/candidates')
  @ApiOperation({
    summary:
      'List exact posted Cashbook matches for an unmatched statement line',
    description:
      'Candidates must have the same tenant, cash account, date, currency, absolute amount and cash direction. No match is created by this endpoint.',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_VIEW)
  listMatchCandidates(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Param('statementLineId', ParseUUIDPipe) statementLineId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listMatchCandidates(
      request.user.tenantId,
      reconciliationId,
      statementLineId,
    );
  }

  @Post(':reconciliationId/statement-lines/:statementLineId/match')
  @ApiOperation({
    summary: 'Match a statement line to an exact posted Cashbook transaction',
    description:
      'Creates a controlled reconciliation link only. It does not post a journal, complete the reconciliation, or create an adjustment.',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_MANAGE)
  matchStatementLine(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Param('statementLineId', ParseUUIDPipe) statementLineId: string,
    @Body() dto: MatchBankStatementLineDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.matchStatementLine(
      request.user,
      reconciliationId,
      statementLineId,
      dto,
    );
  }

  @Get(':reconciliationId')
  @ApiOperation({ summary: 'Get a tenant bank reconciliation session' })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_VIEW)
  get(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.get(request.user.tenantId, reconciliationId);
  }
}
