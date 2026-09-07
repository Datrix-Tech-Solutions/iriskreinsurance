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
  CreatePayableBillDto,
  CreatePayableCreditNoteDto,
  CreatePayablePaymentDto,
  CreatePaymentAllocationDto,
  CreateVendorCreditAllocationDto,
  QueryPayableDocumentsDto,
  QueryPayableAgingDto,
  QueryPayablePaymentsDto,
  ReversePayableAllocationDto,
  ReversePayableDto,
} from './dto/payables.dto';
import { PayablesService } from './payables.service';

@Controller('payables')
@ApiTags('Accounting - Payables')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class PayablesController {
  constructor(private readonly service: PayablesService) {}

  @Post('bills')
  @ApiOperation({
    summary: 'Create a draft standalone vendor bill',
    description:
      'Creates an Accounting-owned AP bill. Financial effect begins only when the bill is posted.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_CREATE)
  createBill(
    @Body() dto: CreatePayableBillDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createBill(request.user, dto);
  }

  @Get('bills')
  @ApiOperation({ summary: 'List standalone vendor bills' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  listBills(
    @Query() query: QueryPayableDocumentsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listBills(request.user.tenantId, query);
  }

  @Get('aging')
  @ApiOperation({
    summary: 'Get Accounts Payable aging by vendor and currency',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  aging(
    @Query() query: QueryPayableAgingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.aging(request.user.tenantId, query);
  }

  @Get('vendors/:vendorId/statement')
  @ApiOperation({ summary: 'Get a vendor open-items statement as of a date' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  statement(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Query() query: QueryPayableAgingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.statement(
      request.user.tenantId,
      vendorId,
      query.asOfDate,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get tenant Accounts Payable dashboard summary' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  summary(@Req() request: Request & { user: RequestUser }) {
    return this.service.summary(request.user.tenantId);
  }

  @Get('bills/:billId')
  @ApiOperation({ summary: 'Get a standalone vendor bill' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  getBill(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getBill(request.user, billId);
  }

  @Post('bills/:billId/post')
  @ApiOperation({
    summary: 'Post a draft vendor bill',
    description:
      'Posts Dr selected offset account and Cr Accounts Payable control with the vendor subledger.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_POST)
  postBill(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postBill(request.user, billId);
  }

  @Post('bills/:billId/reverse')
  @ApiOperation({
    summary: 'Reverse a posted vendor bill',
    description:
      'Posted bills are immutable. Reversal creates a reversing journal and requires dependent allocations to be reversed first.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_REVERSE)
  reverseBill(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Body() dto: ReversePayableDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseBill(request.user, billId, dto);
  }

  @Get('bills/:billId/balance')
  @ApiOperation({
    summary: 'Get backend-calculated bill balance',
    description:
      'Formula: original bill amount minus active payment allocations minus active vendor-credit allocations.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  billBalance(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.billBalance(request.user.tenantId, billId);
  }

  @Post('credit-notes')
  @ApiOperation({
    summary: 'Create a draft standalone vendor credit note',
    description:
      'Vendor credits may reference a posted bill or remain as unapplied vendor credit. Bill-specific credits cannot exceed bill outstanding.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_CREATE)
  createCreditNote(
    @Body() dto: CreatePayableCreditNoteDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCreditNote(request.user, dto);
  }

  @Get('credit-notes')
  @ApiOperation({ summary: 'List standalone vendor credit notes' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  listCreditNotes(
    @Query() query: QueryPayableDocumentsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listCreditNotes(request.user.tenantId, query);
  }

  @Get('credit-notes/:creditNoteId')
  @ApiOperation({ summary: 'Get a standalone vendor credit note' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  getCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getCreditNote(request.user, creditNoteId);
  }

  @Post('credit-notes/:creditNoteId/post')
  @ApiOperation({
    summary: 'Post a draft vendor credit note',
    description:
      'Posts Dr Accounts Payable control with the vendor subledger and Cr the selected offset account.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_POST)
  postCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postCreditNote(request.user, creditNoteId);
  }

  @Post('credit-notes/:creditNoteId/reverse')
  @ApiOperation({ summary: 'Reverse a posted vendor credit note' })
  @RequirePermissions(AccountingPermission.PAYABLES_REVERSE)
  reverseCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Body() dto: ReversePayableDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseCreditNote(request.user, creditNoteId, dto);
  }

  @Post('credit-notes/:creditNoteId/allocations')
  @ApiOperation({
    summary: 'Apply posted vendor credit balance to a posted bill',
    description:
      'Allocation updates AP application state only. It does not create another GL journal.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_ALLOCATE)
  allocateCreditNote(
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Body() dto: CreateVendorCreditAllocationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.allocateCreditNote(request.user, creditNoteId, dto);
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Create a draft standalone vendor payment',
    description:
      'Creates an AP payment linked to a draft Cashbook payment. Cashbook owns cash movement and creates the only payment journal when posted.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_CREATE)
  createPayment(
    @Body() dto: CreatePayablePaymentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createPayment(request.user, dto);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List standalone vendor payments' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  listPayments(
    @Query() query: QueryPayablePaymentsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listPayments(request.user.tenantId, query);
  }

  @Get('payments/:paymentId')
  @ApiOperation({ summary: 'Get a standalone vendor payment' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  getPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getPayment(request.user, paymentId);
  }

  @Post('payments/:paymentId/post')
  @ApiOperation({
    summary: 'Post a draft vendor payment through Cashbook',
    description:
      'Posts exactly one journal through Cashbook: Dr Accounts Payable control with the vendor subledger and Cr Cash/Bank.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_POST)
  postPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postPayment(request.user, paymentId);
  }

  @Post('payments/:paymentId/reverse')
  @ApiOperation({
    summary: 'Reverse a posted vendor payment through Cashbook',
    description:
      'Active allocations must be reversed first. Cashbook creates the reversing cash journal.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_REVERSE)
  reversePayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ReversePayableDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reversePayment(request.user, paymentId, dto);
  }

  @Post('payments/:paymentId/allocations')
  @ApiOperation({
    summary: 'Allocate posted vendor payment balance to a posted bill',
    description:
      'Supports partial allocation and later allocation of unapplied payment balance. Allocation does not create another cash journal.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_ALLOCATE)
  allocatePayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: CreatePaymentAllocationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.allocatePayment(request.user, paymentId, dto);
  }

  @Get('payments/:paymentId/allocations')
  @ApiOperation({ summary: 'List allocations for a vendor payment' })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  listPaymentAllocations(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listPaymentAllocations(
      request.user.tenantId,
      paymentId,
    );
  }

  @Post('allocations/:allocationId/reverse')
  @ApiOperation({
    summary: 'Reverse a payable allocation',
    description:
      'Reverses application state only; no GL journal is created because allocation never posted cash or AP twice.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_ALLOCATE)
  reverseAllocation(
    @Param('allocationId', ParseUUIDPipe) allocationId: string,
    @Body() dto: ReversePayableAllocationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseAllocation(request.user, allocationId, dto);
  }

  @Get('vendors/:vendorId/balance')
  @ApiOperation({
    summary: 'Get backend-calculated vendor AP balance',
    description:
      'Formula by currency: posted bills minus posted vendor credits minus posted payments. Unapplied payments reduce AP because payment posting debits AP control.',
  })
  @RequirePermissions(AccountingPermission.PAYABLES_VIEW)
  vendorBalance(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.vendorBalance(request.user.tenantId, vendorId);
  }
}
