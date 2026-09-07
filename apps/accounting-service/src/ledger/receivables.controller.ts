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
} from '@nestjs/common';
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
  CreateCreditNoteAllocationDto,
  CreateReceivableCreditNoteDto,
  CreateReceivableInvoiceDto,
  CreateReceivableReceiptDto,
  CreateReceiptAllocationDto,
  QueryReceiptsDto,
  QueryReceivableDocumentsDto,
  QueryReceivableAgingDto,
  ReverseAllocationDto,
  ReverseReceivableDto,
} from './dto/receivables.dto';
import { ReceivablesService } from './receivables.service';

@Controller('receivables')
@ApiTags('Accounting - Receivables')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class ReceivablesController {
  constructor(private readonly service: ReceivablesService) {}

  @Post('invoices')
  @ApiOperation({
    summary: 'Create a draft standalone customer invoice',
    description:
      'Creates an Accounting-owned AR invoice. Financial effect begins only when the invoice is posted.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_CREATE)
  createInvoice(
    @Body() dto: CreateReceivableInvoiceDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createInvoice(request.user, dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List standalone customer invoices' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  listInvoices(
    @Query() query: QueryReceivableDocumentsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listInvoices(request.user.tenantId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get tenant Accounts Receivable dashboard summary' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  summary(@Req() request: Request & { user: RequestUser }) {
    return this.service.summary(request.user.tenantId);
  }

  @Get('aging')
  @ApiOperation({
    summary: 'Get Accounts Receivable aging by customer and currency',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  aging(
    @Query() query: QueryReceivableAgingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.aging(request.user.tenantId, query);
  }

  @Get('customers/:customerId/statement')
  @ApiOperation({ summary: 'Get a customer open-items statement as of a date' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  statement(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: QueryReceivableAgingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.statement(
      request.user.tenantId,
      customerId,
      query.asOfDate,
    );
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({ summary: 'Get a standalone customer invoice' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  getInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getInvoice(request.user, invoiceId);
  }

  @Post('invoices/:invoiceId/post')
  @ApiOperation({
    summary: 'Post a draft customer invoice',
    description:
      'Posts Dr Accounts Receivable control with the customer subledger and Cr the selected offset account.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_POST)
  postInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postInvoice(request.user, invoiceId);
  }

  @Post('invoices/:invoiceId/reverse')
  @ApiOperation({
    summary: 'Reverse a posted customer invoice',
    description:
      'Posted invoices are immutable. Reversal creates a reversing journal and requires dependent allocations to be reversed first.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_REVERSE)
  reverseInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: ReverseReceivableDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseInvoice(request.user, invoiceId, dto);
  }

  @Get('invoices/:invoiceId/balance')
  @ApiOperation({
    summary: 'Get backend-calculated invoice balance',
    description:
      'Formula: original invoice amount minus active receipt allocations minus active credit-note allocations.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  invoiceBalance(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.invoiceBalance(request.user.tenantId, invoiceId);
  }

  @Post('credit-notes')
  @ApiOperation({
    summary: 'Create a draft standalone customer credit note',
    description:
      'Credit notes may reference a posted invoice or remain as unapplied customer credit. Invoice-specific credits cannot exceed invoice outstanding.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_CREATE)
  createCreditNote(
    @Body() dto: CreateReceivableCreditNoteDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCreditNote(request.user, dto);
  }

  @Get('credit-notes')
  @ApiOperation({ summary: 'List standalone customer credit notes' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  listCreditNotes(
    @Query() query: QueryReceivableDocumentsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listCreditNotes(request.user.tenantId, query);
  }

  @Get('credit-notes/:creditNoteId')
  @ApiOperation({ summary: 'Get a standalone customer credit note' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  getCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getCreditNote(request.user, creditNoteId);
  }

  @Post('credit-notes/:creditNoteId/post')
  @ApiOperation({
    summary: 'Post a draft customer credit note',
    description:
      'Posts Dr selected offset account and Cr Accounts Receivable control with the customer subledger.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_POST)
  postCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postCreditNote(request.user, creditNoteId);
  }

  @Post('credit-notes/:creditNoteId/reverse')
  @ApiOperation({ summary: 'Reverse a posted customer credit note' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_REVERSE)
  reverseCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Body() dto: ReverseReceivableDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseCreditNote(request.user, creditNoteId, dto);
  }

  @Post('credit-notes/:creditNoteId/allocations')
  @ApiOperation({
    summary: 'Apply posted credit note balance to a posted invoice',
    description:
      'Allocation updates AR application state only. It does not create another GL journal.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_ALLOCATE)
  allocateCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Body() dto: CreateCreditNoteAllocationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.allocateCreditNote(request.user, creditNoteId, dto);
  }

  @Post('receipts')
  @ApiOperation({
    summary: 'Create a draft standalone customer receipt',
    description:
      'Creates an AR receipt linked to a draft Cashbook receipt. Cashbook owns cash movement and creates the only receipt journal when posted.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_CREATE)
  createReceipt(
    @Body() dto: CreateReceivableReceiptDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createReceipt(request.user, dto);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'List standalone customer receipts' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  listReceipts(
    @Query() query: QueryReceiptsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listReceipts(request.user.tenantId, query);
  }

  @Get('receipts/:receiptId')
  @ApiOperation({ summary: 'Get a standalone customer receipt' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  getReceipt(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getReceipt(request.user, receiptId);
  }

  @Post('receipts/:receiptId/post')
  @ApiOperation({
    summary: 'Post a draft customer receipt through Cashbook',
    description:
      'Posts exactly one journal through Cashbook: Dr Cash/Bank and Cr Accounts Receivable control with the customer subledger.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_POST)
  postReceipt(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postReceipt(request.user, receiptId);
  }

  @Post('receipts/:receiptId/reverse')
  @ApiOperation({
    summary: 'Reverse a posted customer receipt through Cashbook',
    description:
      'Active allocations must be reversed first. Cashbook creates the reversing cash journal.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_REVERSE)
  reverseReceipt(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body() dto: ReverseReceivableDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseReceipt(request.user, receiptId, dto);
  }

  @Post('receipts/:receiptId/allocations')
  @ApiOperation({
    summary: 'Allocate posted receipt balance to a posted invoice',
    description:
      'Supports partial allocation and later allocation of unapplied receipt balance. Allocation does not create another cash journal.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_ALLOCATE)
  allocateReceipt(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body() dto: CreateReceiptAllocationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.allocateReceipt(request.user, receiptId, dto);
  }

  @Get('receipts/:receiptId/allocations')
  @ApiOperation({ summary: 'List allocations for a receipt' })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  listReceiptAllocations(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listReceiptAllocations(
      request.user.tenantId,
      receiptId,
    );
  }

  @Post('allocations/:allocationId/reverse')
  @ApiOperation({
    summary: 'Reverse a receivable allocation',
    description:
      'Reverses application state only; no GL journal is created because allocation never posted cash or AR twice.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_ALLOCATE)
  reverseAllocation(
    @Param('allocationId', ParseUUIDPipe) allocationId: string,
    @Body() dto: ReverseAllocationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseAllocation(request.user, allocationId, dto);
  }

  @Get('customers/:customerId/balance')
  @ApiOperation({
    summary: 'Get backend-calculated customer AR balance',
    description:
      'Formula by currency: posted invoices minus posted credit notes minus posted receipts. Unapplied receipts reduce AR because receipt posting credits AR control.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  customerBalance(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.customerBalance(request.user.tenantId, customerId);
  }
}
