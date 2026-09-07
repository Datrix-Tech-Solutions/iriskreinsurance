import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingPayableAllocationSource,
  AccountingPayableDocumentType,
  AccountingPayableStatus,
  FiscalPeriodStatus,
  JournalStatus,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CashbookService } from './cashbook.service';
import { CreateJournalDto } from './dto/accounting.dto';
import { CreateCashbookPaymentDto } from './dto/cashbook.dto';
import {
  CreatePayableBillDto,
  CreatePayableCreditNoteDto,
  CreatePayablePaymentDto,
  CreatePaymentAllocationDto,
  CreateVendorCreditAllocationDto,
  QueryPayableDocumentsDto,
  QueryPayablePaymentsDto,
  QueryPayableAgingDto,
  ReversePayableAllocationDto,
  ReversePayableDto,
} from './dto/payables.dto';
import { JournalsService } from './journals.service';

const zero = new Prisma.Decimal(0);

const payableDocumentInclude = {
  vendor: {
    select: {
      id: true,
      code: true,
      legalName: true,
      currency: true,
      subledgerAccountId: true,
    },
  },
  offsetGlAccount: { select: { id: true, code: true, name: true } },
  postedJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  reversalJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  originalBill: {
    select: {
      id: true,
      documentNumber: true,
      totalAmount: true,
      status: true,
    },
  },
} satisfies Prisma.AccountingPayableDocumentInclude;

const payablePaymentInclude = {
  vendor: {
    select: {
      id: true,
      code: true,
      legalName: true,
      currency: true,
      subledgerAccountId: true,
    },
  },
  cashbookTransaction: {
    select: {
      id: true,
      status: true,
      reference: true,
      postedJournalEntryId: true,
      reversalJournalEntryId: true,
    },
  },
} satisfies Prisma.AccountingPayablePaymentInclude;

type TransactionClient = Prisma.TransactionClient;
type PayableDocument = Prisma.AccountingPayableDocumentGetPayload<{
  include: typeof payableDocumentInclude;
}>;

@Injectable()
export class PayablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashbook: CashbookService,
    private readonly journals: JournalsService,
  ) {}

  async summary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [bills, allocations, payments] = await Promise.all([
      this.prisma.accountingPayableDocument.findMany({
        where: {
          tenantId,
          documentType: AccountingPayableDocumentType.BILL,
          status: AccountingPayableStatus.POSTED,
        },
        select: { id: true, totalAmount: true, currency: true, dueDate: true },
      }),
      this.prisma.accountingPayableAllocation.findMany({
        where: { tenantId, reversedAt: null },
        select: { billId: true, amount: true },
      }),
      this.prisma.accountingPayablePayment.findMany({
        where: {
          tenantId,
          status: AccountingPayableStatus.POSTED,
          paymentDate: { gte: monthStart },
        },
        select: { currency: true, amount: true },
      }),
    ]);
    const applied = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations)
      applied.set(
        allocation.billId,
        (applied.get(allocation.billId) ?? zero).plus(allocation.amount),
      );
    const outstanding = new Map<string, Prisma.Decimal>();
    let overdueInvoices = 0;
    let dueThisWeek = 0;
    for (const bill of bills) {
      const balance = bill.totalAmount.minus(applied.get(bill.id) ?? zero);
      if (balance.lessThanOrEqualTo(0)) continue;
      outstanding.set(
        bill.currency,
        (outstanding.get(bill.currency) ?? zero).plus(balance),
      );
      if (bill.dueDate && bill.dueDate < today) overdueInvoices += 1;
      if (bill.dueDate && bill.dueDate >= today && bill.dueDate <= weekEnd)
        dueThisWeek += 1;
    }
    const paid = new Map<string, Prisma.Decimal>();
    for (const payment of payments)
      paid.set(
        payment.currency,
        (paid.get(payment.currency) ?? zero).plus(payment.amount),
      );
    const pendingApproval = await this.prisma.accountingPayableDocument.count({
      where: {
        tenantId,
        documentType: AccountingPayableDocumentType.BILL,
        status: AccountingPayableStatus.DRAFT,
      },
    });
    return {
      outstandingByCurrency: this.summaryTotals(outstanding),
      overdueInvoices,
      dueThisWeek,
      pendingApproval,
      paidMtdByCurrency: this.summaryTotals(paid),
    };
  }

  private summaryTotals(totals: Map<string, Prisma.Decimal>) {
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => ({ currency, amount: this.money(amount) }));
  }

  async aging(tenantId: string, query: QueryPayableAgingDto) {
    const asOfDate = this.asOfDate(query.asOfDate);
    const rows = await this.openItems(tenantId, asOfDate, query.vendorId);
    return this.agingResult(asOfDate, rows);
  }

  async statement(tenantId: string, vendorId: string, asOf?: string) {
    const asOfDate = this.asOfDate(asOf);
    const vendor = await this.resolveVendor(tenantId, vendorId);
    const rows = await this.openItems(tenantId, asOfDate, vendorId);
    return {
      asOfDate,
      vendor: { id: vendor.id, code: vendor.code, legalName: vendor.legalName },
      ...this.agingResult(asOfDate, rows),
      documents: rows,
    };
  }

  private async openItems(tenantId: string, asOfDate: Date, vendorId?: string) {
    const [bills, allocations] = await Promise.all([
      this.prisma.accountingPayableDocument.findMany({
        where: {
          tenantId,
          vendorId,
          documentType: AccountingPayableDocumentType.BILL,
          status: AccountingPayableStatus.POSTED,
          documentDate: { lte: asOfDate },
        },
        select: {
          id: true,
          documentNumber: true,
          documentDate: true,
          dueDate: true,
          currency: true,
          totalAmount: true,
          vendor: { select: { id: true, code: true, legalName: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { documentDate: 'asc' }],
      }),
      this.prisma.accountingPayableAllocation.findMany({
        where: { tenantId, reversedAt: null, allocatedAt: { lte: asOfDate } },
        select: { billId: true, amount: true },
      }),
    ]);
    const applied = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations)
      applied.set(
        allocation.billId,
        (applied.get(allocation.billId) ?? zero).plus(allocation.amount),
      );
    return bills
      .map((bill) => ({
        ...bill,
        outstandingAmount: this.money(
          bill.totalAmount.minus(applied.get(bill.id) ?? zero),
        ),
      }))
      .filter((bill) =>
        new Prisma.Decimal(bill.outstandingAmount).greaterThan(0),
      );
  }

  private agingResult(
    asOfDate: Date,
    rows: Awaited<ReturnType<PayablesService['openItems']>>,
  ) {
    const buckets = ['CURRENT', '1_30', '31_60', '61_90', 'OVER_90'] as const;
    const totals = new Map<
      string,
      Record<(typeof buckets)[number], Prisma.Decimal>
    >();
    for (const row of rows) {
      const total =
        totals.get(row.currency) ??
        (Object.fromEntries(buckets.map((bucket) => [bucket, zero])) as Record<
          (typeof buckets)[number],
          Prisma.Decimal
        >);
      const age = row.dueDate
        ? Math.max(
            0,
            Math.floor((asOfDate.getTime() - row.dueDate.getTime()) / 86400000),
          )
        : 0;
      const bucket =
        age === 0
          ? 'CURRENT'
          : age <= 30
            ? '1_30'
            : age <= 60
              ? '31_60'
              : age <= 90
                ? '61_90'
                : 'OVER_90';
      total[bucket] = total[bucket].plus(row.outstandingAmount);
      totals.set(row.currency, total);
    }
    return {
      agingByCurrency: Array.from(totals.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, amounts]) => ({
          currency,
          ...Object.fromEntries(
            buckets.map((bucket) => [bucket, this.money(amounts[bucket])]),
          ),
        })),
    };
  }

  private asOfDate(value?: string) {
    const date = value ? new Date(value) : new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }

  async createBill(user: RequestUser, dto: CreatePayableBillDto) {
    const [vendor, config] = await Promise.all([
      this.resolveVendor(user.tenantId, dto.vendorId),
      this.resolveConfig(user.tenantId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
      this.assertPostingOffsetAccount(user.tenantId, dto.offsetGlAccountId),
    ]);
    this.assertVendorCurrency(vendor.currency, dto.currency);
    if (!config.accountsPayableControlAccountId) {
      throw new ConflictException(
        'Configure an accounts payable control account before creating AP bills',
      );
    }

    const { subtotalAmount, taxAmount, totalAmount } =
      this.documentAmounts(dto);
    const document = await this.prisma.accountingPayableDocument.create({
      data: {
        tenantId: user.tenantId,
        vendorId: vendor.id,
        documentType: AccountingPayableDocumentType.BILL,
        documentNumber: await this.nextDocumentNumber(user.tenantId, 'APB'),
        documentDate: new Date(dto.documentDate),
        dueDate: new Date(
          dto.dueDate ??
            this.addDays(dto.documentDate, vendor.paymentTermsDays),
        ),
        currency: dto.currency,
        exchangeRate: dto.exchangeRate,
        subtotalAmount,
        taxAmount,
        totalAmount,
        description: this.optional(dto.description),
        externalReference: this.optional(dto.externalReference),
        sourceModule: this.optional(dto.sourceModule),
        sourceRecordId: this.optional(dto.sourceRecordId),
        offsetGlAccountId: dto.offsetGlAccountId,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: payableDocumentInclude,
    });
    await this.recordAudit(
      user,
      'PAYABLE_BILL_CREATED',
      'AccountingPayableDocument',
      document.id,
      { documentNumber: document.documentNumber, totalAmount },
    );
    return document;
  }

  async createCreditNote(user: RequestUser, dto: CreatePayableCreditNoteDto) {
    const [vendor, config] = await Promise.all([
      this.resolveVendor(user.tenantId, dto.vendorId),
      this.resolveConfig(user.tenantId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
      this.assertPostingOffsetAccount(user.tenantId, dto.offsetGlAccountId),
    ]);
    this.assertVendorCurrency(vendor.currency, dto.currency);
    if (!config.accountsPayableControlAccountId) {
      throw new ConflictException(
        'Configure an accounts payable control account before creating AP vendor credits',
      );
    }
    if (dto.originalBillId) {
      const bill = await this.getDocumentForTenant(
        user.tenantId,
        dto.originalBillId,
      );
      if (
        bill.documentType !== AccountingPayableDocumentType.BILL ||
        bill.vendorId !== vendor.id ||
        bill.status !== AccountingPayableStatus.POSTED
      ) {
        throw new BadRequestException(
          'Vendor credits can only reference a posted bill for the same vendor',
        );
      }
      if (bill.currency !== dto.currency) {
        throw new BadRequestException(
          'Cross-currency bill credit allocation is not supported in Phase 1',
        );
      }
      const outstanding = await this.billOutstandingAmount(
        user.tenantId,
        bill.id,
      );
      if (new Prisma.Decimal(dto.amount).greaterThan(outstanding)) {
        throw new ConflictException(
          'Bill-specific vendor credit cannot exceed bill outstanding balance',
        );
      }
    }

    const { subtotalAmount, taxAmount, totalAmount } =
      this.documentAmounts(dto);
    const document = await this.prisma.accountingPayableDocument.create({
      data: {
        tenantId: user.tenantId,
        vendorId: vendor.id,
        documentType: AccountingPayableDocumentType.CREDIT_NOTE,
        documentNumber: await this.nextDocumentNumber(user.tenantId, 'APC'),
        documentDate: new Date(dto.documentDate),
        currency: dto.currency,
        exchangeRate: dto.exchangeRate,
        subtotalAmount,
        taxAmount,
        totalAmount,
        description: this.optional(dto.description),
        externalReference: this.optional(dto.externalReference),
        sourceModule: this.optional(dto.sourceModule),
        sourceRecordId: this.optional(dto.sourceRecordId),
        offsetGlAccountId: dto.offsetGlAccountId,
        originalBillId: this.optional(dto.originalBillId),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: payableDocumentInclude,
    });
    await this.recordAudit(
      user,
      'PAYABLE_CREDIT_NOTE_CREATED',
      'AccountingPayableDocument',
      document.id,
      { documentNumber: document.documentNumber, totalAmount },
    );
    return document;
  }

  listBills(tenantId: string, query: QueryPayableDocumentsDto) {
    return this.listDocuments(
      tenantId,
      AccountingPayableDocumentType.BILL,
      query,
    );
  }

  listCreditNotes(tenantId: string, query: QueryPayableDocumentsDto) {
    return this.listDocuments(
      tenantId,
      AccountingPayableDocumentType.CREDIT_NOTE,
      query,
    );
  }

  async getBill(user: RequestUser, billId: string) {
    const document = await this.getDocumentForTenant(user.tenantId, billId);
    if (document.documentType !== AccountingPayableDocumentType.BILL) {
      throw new NotFoundException('Bill not found');
    }
    return document;
  }

  async getCreditNote(user: RequestUser, creditNoteId: string) {
    const document = await this.getDocumentForTenant(
      user.tenantId,
      creditNoteId,
    );
    if (document.documentType !== AccountingPayableDocumentType.CREDIT_NOTE) {
      throw new NotFoundException('Vendor credit note not found');
    }
    return document;
  }

  async postBill(user: RequestUser, billId: string) {
    return this.postDocument(user, billId, AccountingPayableDocumentType.BILL);
  }

  async postCreditNote(user: RequestUser, creditNoteId: string) {
    return this.postDocument(
      user,
      creditNoteId,
      AccountingPayableDocumentType.CREDIT_NOTE,
    );
  }

  async reverseBill(user: RequestUser, billId: string, dto: ReversePayableDto) {
    return this.reverseDocument(
      user,
      billId,
      AccountingPayableDocumentType.BILL,
      dto,
    );
  }

  async reverseCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: ReversePayableDto,
  ) {
    return this.reverseDocument(
      user,
      creditNoteId,
      AccountingPayableDocumentType.CREDIT_NOTE,
      dto,
    );
  }

  async createPayment(user: RequestUser, dto: CreatePayablePaymentDto) {
    const [vendor, config] = await Promise.all([
      this.resolveVendor(user.tenantId, dto.vendorId),
      this.resolveConfig(user.tenantId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
    ]);
    this.assertVendorCurrency(vendor.currency, dto.currency);
    if (!config.accountsPayableControlAccountId) {
      throw new ConflictException(
        'Configure an accounts payable control account before creating AP payments',
      );
    }

    const cashbookDto: CreateCashbookPaymentDto = {
      cashAccountId: dto.cashAccountId,
      amount: dto.amount,
      currency: dto.currency,
      transactionDate: dto.paymentDate,
      settlementMethod: dto.settlementMethod,
      reference: dto.reference,
      counterpartyType: 'VENDOR',
      counterpartyId: vendor.id,
      externalReference: dto.externalReference,
      description: dto.description ?? `Payment to ${vendor.legalName}`,
      offsetGlAccountId: config.accountsPayableControlAccountId,
      offsetSubledgerAccountId: vendor.subledgerAccountId,
      sourceModule: dto.sourceModule ?? 'ACCOUNTING',
      sourceRecordId: dto.sourceRecordId ?? 'AP_PAYMENT_PENDING',
      exchangeRate: dto.exchangeRate,
    };
    const cashbookTransaction = await this.cashbook.createPayment(
      user,
      cashbookDto,
    );
    const payment = await this.prisma.accountingPayablePayment.create({
      data: {
        tenantId: user.tenantId,
        vendorId: vendor.id,
        cashbookTransactionId: cashbookTransaction.id,
        paymentNumber: await this.nextPaymentNumber(user.tenantId),
        paymentDate: new Date(dto.paymentDate),
        currency: dto.currency,
        amount: dto.amount,
        exchangeRate: dto.exchangeRate,
        reference: this.optional(dto.reference),
        description: this.optional(dto.description),
        externalReference: this.optional(dto.externalReference),
        sourceModule: this.optional(dto.sourceModule),
        sourceRecordId: this.optional(dto.sourceRecordId),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: payablePaymentInclude,
    });
    await this.prisma.cashbookTransaction.update({
      where: {
        id_tenantId: {
          id: cashbookTransaction.id,
          tenantId: user.tenantId,
        },
      },
      data: {
        sourceModule: dto.sourceModule ?? 'ACCOUNTING',
        sourceRecordId: dto.sourceRecordId ?? payment.id,
      },
    });
    await this.recordAudit(
      user,
      'PAYABLE_PAYMENT_CREATED',
      'AccountingPayablePayment',
      payment.id,
      {
        paymentNumber: payment.paymentNumber,
        cashbookTransactionId: cashbookTransaction.id,
      },
    );
    return payment;
  }

  listPayments(tenantId: string, query: QueryPayablePaymentsDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.AccountingPayablePaymentWhereInput = {
      tenantId,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.cashAccountId
        ? { cashbookTransaction: { cashAccountId: query.cashAccountId } }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            paymentDate: {
              ...(query.fromDate
                ? { gte: this.startOfDay(query.fromDate) }
                : {}),
              ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                paymentNumber: { contains: query.search, mode: 'insensitive' },
              },
              { reference: { contains: query.search, mode: 'insensitive' } },
              {
                externalReference: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    return this.paginatePayments(where, page, limit);
  }

  async getPayment(user: RequestUser, paymentId: string) {
    const payment = await this.prisma.accountingPayablePayment.findFirst({
      where: { id: paymentId, tenantId: user.tenantId },
      include: payablePaymentInclude,
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async postPayment(user: RequestUser, paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.accountingPayablePayment.findFirst({
        where: { id: paymentId, tenantId: user.tenantId },
        include: payablePaymentInclude,
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== AccountingPayableStatus.DRAFT) {
        throw new ConflictException('Only draft payments can be posted');
      }
      const postedCashbook = await this.cashbook.postTransactionInTransaction(
        tx,
        user,
        payment.cashbookTransactionId,
      );
      const updated = await tx.accountingPayablePayment.update({
        where: { id_tenantId: { id: payment.id, tenantId: user.tenantId } },
        data: {
          status: AccountingPayableStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: payablePaymentInclude,
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'PAYABLE_PAYMENT_POSTED',
          entityType: 'AccountingPayablePayment',
          entityId: payment.id,
          changedFields: {
            cashbookJournalEntryId: postedCashbook.postedJournalEntryId,
          },
        },
      });
      return updated;
    });
  }

  async reversePayment(
    user: RequestUser,
    paymentId: string,
    dto: ReversePayableDto,
  ) {
    const payment = await this.getPayment(user, paymentId);
    if (payment.status !== AccountingPayableStatus.POSTED) {
      throw new ConflictException('Only posted payments can be reversed');
    }
    const activeAllocations =
      await this.prisma.accountingPayableAllocation.count({
        where: {
          tenantId: user.tenantId,
          paymentId: payment.id,
          reversedAt: null,
        },
      });
    if (activeAllocations > 0) {
      throw new ConflictException(
        'Reverse active payment allocations before reversing the payment',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const reversal = await this.cashbook.reverseTransactionInTransaction(
        tx,
        user,
        payment.cashbookTransactionId,
        dto,
      );
      const updated = await tx.accountingPayablePayment.update({
        where: { id_tenantId: { id: payment.id, tenantId: user.tenantId } },
        data: {
          status: AccountingPayableStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: payablePaymentInclude,
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'PAYABLE_PAYMENT_REVERSED',
          entityType: 'AccountingPayablePayment',
          entityId: payment.id,
          changedFields: {
            reversalCashbookTransactionId: reversal.id,
            reason: dto.reason,
          },
        },
      });
      return updated;
    });
  }

  async allocatePayment(
    user: RequestUser,
    paymentId: string,
    dto: CreatePaymentAllocationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.accountingPayablePayment.findFirst({
        where: { id: paymentId, tenantId: user.tenantId },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== AccountingPayableStatus.POSTED) {
        throw new ConflictException('Only posted payments can be allocated');
      }
      return this.createAllocation(tx, user, {
        vendorId: payment.vendorId,
        billId: dto.billId,
        paymentId: payment.id,
        sourceType: AccountingPayableAllocationSource.PAYMENT,
        amount: new Prisma.Decimal(dto.amount),
        currency: payment.currency,
      });
    });
  }

  async allocateCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: CreateVendorCreditAllocationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const creditNote = await tx.accountingPayableDocument.findFirst({
        where: { id: creditNoteId, tenantId: user.tenantId },
      });
      if (!creditNote) {
        throw new NotFoundException('Vendor credit note not found');
      }
      if (
        creditNote.documentType !== AccountingPayableDocumentType.CREDIT_NOTE ||
        creditNote.status !== AccountingPayableStatus.POSTED
      ) {
        throw new ConflictException(
          'Only posted vendor credit notes can be allocated',
        );
      }
      return this.createAllocation(tx, user, {
        vendorId: creditNote.vendorId,
        billId: dto.billId,
        creditNoteId: creditNote.id,
        sourceType: AccountingPayableAllocationSource.CREDIT_NOTE,
        amount: new Prisma.Decimal(dto.amount),
        currency: creditNote.currency,
      });
    });
  }

  listPaymentAllocations(tenantId: string, paymentId: string) {
    return this.prisma.accountingPayableAllocation.findMany({
      where: { tenantId, paymentId },
      include: {
        bill: { select: { id: true, documentNumber: true, totalAmount: true } },
      },
      orderBy: { allocatedAt: 'asc' },
    });
  }

  async reverseAllocation(
    user: RequestUser,
    allocationId: string,
    dto: ReversePayableAllocationDto,
  ) {
    const allocation = await this.prisma.accountingPayableAllocation.findFirst({
      where: { id: allocationId, tenantId: user.tenantId },
    });
    if (!allocation) throw new NotFoundException('Allocation not found');
    if (allocation.reversedAt) return allocation;
    const updated = await this.prisma.accountingPayableAllocation.update({
      where: { id_tenantId: { id: allocation.id, tenantId: user.tenantId } },
      data: {
        reversedAt: new Date(),
        reversedByUserId: user.id,
        reversalReason: dto.reason,
      },
    });
    await this.recordAudit(
      user,
      'PAYABLE_ALLOCATION_REVERSED',
      'AccountingPayableAllocation',
      allocation.id,
      { reason: dto.reason },
    );
    return updated;
  }

  async billBalance(tenantId: string, billId: string) {
    const bill = await this.prisma.accountingPayableDocument.findFirst({
      where: {
        id: billId,
        tenantId,
        documentType: AccountingPayableDocumentType.BILL,
      },
      include: payableDocumentInclude,
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return this.billBalanceFromDocument(bill);
  }

  async vendorBalance(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.accountingVendor.findFirst({
      where: { id: vendorId, tenantId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const [documents, payments] = await Promise.all([
      this.prisma.accountingPayableDocument.findMany({
        where: {
          tenantId,
          vendorId,
          status: AccountingPayableStatus.POSTED,
        },
      }),
      this.prisma.accountingPayablePayment.findMany({
        where: {
          tenantId,
          vendorId,
          status: AccountingPayableStatus.POSTED,
        },
      }),
    ]);
    const buckets = new Map<
      string,
      {
        postedBills: Prisma.Decimal;
        postedCredits: Prisma.Decimal;
        postedPayments: Prisma.Decimal;
      }
    >();
    const bucket = (currency: string) => {
      const existing = buckets.get(currency);
      if (existing) return existing;
      const created = {
        postedBills: new Prisma.Decimal(0),
        postedCredits: new Prisma.Decimal(0),
        postedPayments: new Prisma.Decimal(0),
      };
      buckets.set(currency, created);
      return created;
    };
    for (const document of documents) {
      const row = bucket(document.currency);
      if (document.documentType === AccountingPayableDocumentType.BILL) {
        row.postedBills = row.postedBills.plus(document.totalAmount);
      } else {
        row.postedCredits = row.postedCredits.plus(document.totalAmount);
      }
    }
    for (const payment of payments) {
      bucket(payment.currency).postedPayments = bucket(
        payment.currency,
      ).postedPayments.plus(payment.amount);
    }
    return {
      vendor,
      balances: [...buckets.entries()].map(([currency, row]) => ({
        currency,
        postedBills: this.money(row.postedBills),
        postedCredits: this.money(row.postedCredits),
        postedPayments: this.money(row.postedPayments),
        balance: this.money(
          row.postedBills.minus(row.postedCredits).minus(row.postedPayments),
        ),
      })),
    };
  }

  private async postDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingPayableDocumentType,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.accountingPayableDocument.findFirst({
        where: { id: documentId, tenantId: user.tenantId, documentType },
        include: payableDocumentInclude,
      });
      if (!document) throw new NotFoundException('Payable document not found');
      if (document.status !== AccountingPayableStatus.DRAFT) {
        throw new ConflictException(
          'Only draft payable documents can be posted',
        );
      }
      const config = await this.resolveConfig(user.tenantId, tx);
      if (!config.accountsPayableControlAccountId) {
        throw new ConflictException(
          'Configure an accounts payable control account before posting payables',
        );
      }
      if (
        document.documentType === AccountingPayableDocumentType.CREDIT_NOTE &&
        document.originalBillId
      ) {
        const outstanding = await this.billOutstandingAmount(
          user.tenantId,
          document.originalBillId,
          tx,
        );
        if (document.totalAmount.greaterThan(outstanding)) {
          throw new ConflictException(
            'Bill-specific vendor credit cannot exceed bill outstanding balance',
          );
        }
      }
      const period = await this.resolveOpenPeriod(
        tx,
        user.tenantId,
        document.documentDate,
      );
      const journal = await this.journals.createPostedInTransaction(
        tx,
        user,
        this.documentJournalDto(
          document,
          config.accountsPayableControlAccountId,
          period.id,
        ),
      );
      const claimed = await tx.accountingPayableDocument.updateMany({
        where: {
          id: document.id,
          tenantId: user.tenantId,
          status: AccountingPayableStatus.DRAFT,
        },
        data: {
          status: AccountingPayableStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: user.id,
          postedJournalEntryId: journal.id,
          updatedByUserId: user.id,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Payable document was changed by another request',
        );
      }
      if (
        document.documentType === AccountingPayableDocumentType.CREDIT_NOTE &&
        document.originalBillId
      ) {
        await this.createAllocation(tx, user, {
          vendorId: document.vendorId,
          billId: document.originalBillId,
          creditNoteId: document.id,
          sourceType: AccountingPayableAllocationSource.CREDIT_NOTE,
          amount: document.totalAmount,
          currency: document.currency,
        });
      }
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action:
            document.documentType === AccountingPayableDocumentType.BILL
              ? 'PAYABLE_BILL_POSTED'
              : 'PAYABLE_CREDIT_NOTE_POSTED',
          entityType: 'AccountingPayableDocument',
          entityId: document.id,
          changedFields: { journalEntryId: journal.id },
        },
      });
      return tx.accountingPayableDocument.findUniqueOrThrow({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        include: payableDocumentInclude,
      });
    });
  }

  private async reverseDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingPayableDocumentType,
    dto: ReversePayableDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.accountingPayableDocument.findFirst({
        where: { id: documentId, tenantId: user.tenantId, documentType },
        include: payableDocumentInclude,
      });
      if (!document) throw new NotFoundException('Payable document not found');
      if (document.status !== AccountingPayableStatus.POSTED) {
        throw new ConflictException(
          'Only posted payable documents can be reversed',
        );
      }
      const activeAllocations = await tx.accountingPayableAllocation.count({
        where: {
          tenantId: user.tenantId,
          reversedAt: null,
          OR:
            document.documentType === AccountingPayableDocumentType.BILL
              ? [{ billId: document.id }]
              : [{ creditNoteId: document.id }],
        },
      });
      if (activeAllocations > 0) {
        throw new ConflictException(
          'Reverse active allocations before reversing this payable document',
        );
      }
      if (!document.postedJournalEntryId) {
        throw new ConflictException(
          'Posted payable document is missing its journal',
        );
      }
      const reversalDate = new Date(dto.reversalDate);
      const period = await this.resolveOpenPeriod(
        tx,
        user.tenantId,
        reversalDate,
      );
      const originalJournal = await tx.journalEntry.findFirst({
        where: {
          id: document.postedJournalEntryId,
          tenantId: user.tenantId,
          status: JournalStatus.POSTED,
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      if (!originalJournal) {
        throw new ConflictException(
          'Original posted payable journal is not available for reversal',
        );
      }
      const reversalJournal = await this.journals.createPostedInTransaction(
        tx,
        user,
        {
          transactionDate: reversalDate.toISOString(),
          fiscalPeriodId: period.id,
          transactionCurrency: originalJournal.transactionCurrency,
          exchangeRate: Number(originalJournal.exchangeRate.toString()),
          reference: `REVERSAL-${document.documentNumber}`,
          description: `Payable reversal of ${document.documentNumber}: ${dto.reason}`,
          idempotencyKey: `payable:${document.id}:reversal:v1`,
          sourceModule: 'ACCOUNTING',
          sourceRecordType: 'PAYABLE_DOCUMENT_REVERSAL',
          sourceRecordId: document.id,
          lines: originalJournal.lines.map((line) => ({
            glAccountId: line.glAccountId,
            subledgerAccountId: line.subledgerAccountId ?? undefined,
            costCentreId: line.costCentreId ?? undefined,
            description: line.description ?? undefined,
            debit: Number(line.transactionCredit.toString()),
            credit: Number(line.transactionDebit.toString()),
          })),
        },
      );
      await tx.journalEntry.update({
        where: {
          id_tenantId: { id: originalJournal.id, tenantId: user.tenantId },
        },
        data: {
          status: JournalStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await tx.accountingPayableDocument.update({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        data: {
          status: AccountingPayableStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          reversalJournalEntryId: reversalJournal.id,
          updatedByUserId: user.id,
        },
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action:
            document.documentType === AccountingPayableDocumentType.BILL
              ? 'PAYABLE_BILL_REVERSED'
              : 'PAYABLE_CREDIT_NOTE_REVERSED',
          entityType: 'AccountingPayableDocument',
          entityId: document.id,
          changedFields: { reversalJournalEntryId: reversalJournal.id },
        },
      });
      return tx.accountingPayableDocument.findUniqueOrThrow({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        include: payableDocumentInclude,
      });
    });
  }

  private async createAllocation(
    tx: TransactionClient,
    user: RequestUser,
    input: {
      vendorId: string;
      billId: string;
      paymentId?: string;
      creditNoteId?: string;
      sourceType: AccountingPayableAllocationSource;
      amount: Prisma.Decimal;
      currency: string;
    },
  ) {
    if (input.amount.lte(0)) {
      throw new BadRequestException(
        'Allocation amount must be greater than zero',
      );
    }
    await this.lockAllocationSources(tx, user.tenantId, input);
    const bill = await tx.accountingPayableDocument.findFirst({
      where: {
        id: input.billId,
        tenantId: user.tenantId,
        documentType: AccountingPayableDocumentType.BILL,
        status: AccountingPayableStatus.POSTED,
      },
    });
    if (!bill) throw new NotFoundException('Posted bill not found');
    if (bill.vendorId !== input.vendorId) {
      throw new BadRequestException('Allocation vendor does not match bill');
    }
    if (bill.currency !== input.currency) {
      throw new BadRequestException(
        'Cross-currency payable allocations are not supported in Phase 1',
      );
    }
    const billOutstanding = await this.billOutstandingAmount(
      user.tenantId,
      bill.id,
      tx,
    );
    if (input.amount.greaterThan(billOutstanding)) {
      throw new ConflictException(
        'Allocation exceeds bill outstanding balance',
      );
    }
    if (input.paymentId) {
      const available = await this.paymentAvailableAmount(
        user.tenantId,
        input.paymentId,
        tx,
      );
      if (input.amount.greaterThan(available)) {
        throw new ConflictException(
          'Allocation exceeds payment unapplied balance',
        );
      }
    }
    if (input.creditNoteId) {
      const available = await this.creditNoteAvailableAmount(
        user.tenantId,
        input.creditNoteId,
        tx,
      );
      if (input.amount.greaterThan(available)) {
        throw new ConflictException(
          'Allocation exceeds vendor credit unapplied balance',
        );
      }
    }
    const allocation = await tx.accountingPayableAllocation.create({
      data: {
        tenantId: user.tenantId,
        vendorId: input.vendorId,
        billId: bill.id,
        paymentId: input.paymentId,
        creditNoteId: input.creditNoteId,
        sourceType: input.sourceType,
        amount: input.amount,
        currency: input.currency,
        createdByUserId: user.id,
      },
    });
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'PAYABLE_ALLOCATION_CREATED',
        entityType: 'AccountingPayableAllocation',
        entityId: allocation.id,
        changedFields: {
          billId: input.billId,
          paymentId: input.paymentId,
          creditNoteId: input.creditNoteId,
          amount: input.amount.toString(),
        },
      },
    });
    return allocation;
  }

  private documentJournalDto(
    document: PayableDocument,
    apControlAccountId: string,
    fiscalPeriodId: string,
  ): CreateJournalDto {
    const amount = Number(document.totalAmount.toString());
    const apLine = {
      glAccountId: apControlAccountId,
      subledgerAccountId: document.vendor.subledgerAccountId,
      description: document.description ?? document.documentNumber,
    };
    const offsetLine = {
      glAccountId: document.offsetGlAccountId,
      description: document.description ?? document.documentNumber,
    };
    const lines =
      document.documentType === AccountingPayableDocumentType.BILL
        ? [
            { ...offsetLine, debit: amount, credit: 0 },
            { ...apLine, debit: 0, credit: amount },
          ]
        : [
            { ...apLine, debit: amount, credit: 0 },
            { ...offsetLine, debit: 0, credit: amount },
          ];
    return {
      transactionDate: document.documentDate.toISOString(),
      fiscalPeriodId,
      transactionCurrency: document.currency,
      exchangeRate: document.exchangeRate
        ? Number(document.exchangeRate.toString())
        : undefined,
      reference: document.documentNumber,
      description: document.description ?? document.documentNumber,
      idempotencyKey: `payable:${document.id}:posted:v1`,
      sourceModule: document.sourceModule ?? 'ACCOUNTING',
      sourceRecordType: 'PAYABLE_DOCUMENT',
      sourceRecordId: document.sourceRecordId ?? document.id,
      lines,
    };
  }

  private async listDocuments(
    tenantId: string,
    documentType: AccountingPayableDocumentType,
    query: QueryPayableDocumentsDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.AccountingPayableDocumentWhereInput = {
      tenantId,
      documentType,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.fromDate || query.toDate
        ? {
            documentDate: {
              ...(query.fromDate
                ? { gte: this.startOfDay(query.fromDate) }
                : {}),
              ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: this.startOfDay(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: this.endOfDay(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                documentNumber: { contains: query.search, mode: 'insensitive' },
              },
              {
                externalReference: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.accountingPayableDocument.findMany({
        where,
        include: payableDocumentInclude,
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingPayableDocument.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async paginatePayments(
    where: Prisma.AccountingPayablePaymentWhereInput,
    page: number,
    limit: number,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.accountingPayablePayment.findMany({
        where,
        include: payablePaymentInclude,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingPayablePayment.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async billBalanceFromDocument(document: PayableDocument) {
    const [paymentApplied, creditApplied] = await Promise.all([
      this.sumAllocations(document.tenantId, {
        billId: document.id,
        sourceType: AccountingPayableAllocationSource.PAYMENT,
      }),
      this.sumAllocations(document.tenantId, {
        billId: document.id,
        sourceType: AccountingPayableAllocationSource.CREDIT_NOTE,
      }),
    ]);
    const outstanding =
      document.status === AccountingPayableStatus.POSTED
        ? document.totalAmount.minus(paymentApplied).minus(creditApplied)
        : new Prisma.Decimal(0);
    return {
      bill: document,
      currency: document.currency,
      originalAmount: this.money(document.totalAmount),
      appliedPayments: this.money(paymentApplied),
      appliedCreditNotes: this.money(creditApplied),
      outstandingAmount: this.money(outstanding),
      paymentState: this.paymentState(document, outstanding),
    };
  }

  private async billOutstandingAmount(
    tenantId: string,
    billId: string,
    tx?: TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const bill = await client.accountingPayableDocument.findFirst({
      where: {
        id: billId,
        tenantId,
        documentType: AccountingPayableDocumentType.BILL,
        status: AccountingPayableStatus.POSTED,
      },
    });
    if (!bill) throw new NotFoundException('Posted bill not found');
    const applied = await this.sumAllocations(tenantId, { billId }, client);
    return bill.totalAmount.minus(applied);
  }

  private async paymentAvailableAmount(
    tenantId: string,
    paymentId: string,
    tx: TransactionClient,
  ) {
    const payment = await tx.accountingPayablePayment.findFirst({
      where: {
        id: paymentId,
        tenantId,
        status: AccountingPayableStatus.POSTED,
      },
    });
    if (!payment) throw new NotFoundException('Posted payment not found');
    const allocated = await this.sumAllocations(tenantId, { paymentId }, tx);
    return payment.amount.minus(allocated);
  }

  private async creditNoteAvailableAmount(
    tenantId: string,
    creditNoteId: string,
    tx: TransactionClient,
  ) {
    const creditNote = await tx.accountingPayableDocument.findFirst({
      where: {
        id: creditNoteId,
        tenantId,
        documentType: AccountingPayableDocumentType.CREDIT_NOTE,
        status: AccountingPayableStatus.POSTED,
      },
    });
    if (!creditNote) {
      throw new NotFoundException('Posted vendor credit note not found');
    }
    const allocated = await this.sumAllocations(tenantId, { creditNoteId }, tx);
    return creditNote.totalAmount.minus(allocated);
  }

  private async sumAllocations(
    tenantId: string,
    where: Omit<Prisma.AccountingPayableAllocationWhereInput, 'tenantId'>,
    client: PrismaService | TransactionClient = this.prisma,
  ) {
    const aggregate = await client.accountingPayableAllocation.aggregate({
      where: { tenantId, reversedAt: null, ...where },
      _sum: { amount: true },
    });
    return aggregate._sum.amount ?? new Prisma.Decimal(0);
  }

  private async getDocumentForTenant(tenantId: string, documentId: string) {
    const document = await this.prisma.accountingPayableDocument.findFirst({
      where: { id: documentId, tenantId },
      include: payableDocumentInclude,
    });
    if (!document) throw new NotFoundException('Payable document not found');
    return document;
  }

  private async resolveVendor(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.accountingVendor.findFirst({
      where: { id: vendorId, tenantId },
      include: { subledgerAccount: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!vendor.isActive) {
      throw new ConflictException(
        'Inactive vendors cannot receive AP activity',
      );
    }
    if (vendor.subledgerAccount.status !== RecordStatus.ACTIVE) {
      throw new ConflictException('Vendor subledger account is inactive');
    }
    return vendor;
  }

  private async resolveConfig(
    tenantId: string,
    client: PrismaService | TransactionClient = this.prisma,
  ) {
    const config = await client.accountingTenantConfig.findUnique({
      where: { tenantId },
    });
    if (!config) throw new ConflictException('Accounting is not configured');
    return config;
  }

  private async assertActiveCurrency(tenantId: string, code: string) {
    const currency = await this.prisma.accountingCurrency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!currency || !currency.isActive) {
      throw new BadRequestException('Accounting currency is not active');
    }
  }

  private async assertPostingOffsetAccount(
    tenantId: string,
    glAccountId: string,
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId },
      include: { _count: { select: { childAccounts: true } } },
    });
    if (!account) throw new BadRequestException('Offset GL account not found');
    if (
      account.status !== RecordStatus.ACTIVE ||
      !account.allowPosting ||
      account._count.childAccounts > 0
    ) {
      throw new BadRequestException(
        'Payable offset account must be active, leaf and posting-enabled',
      );
    }
  }

  private assertVendorCurrency(vendorCurrency: string, currency: string) {
    if (vendorCurrency !== currency) {
      throw new BadRequestException(
        'Standalone AP Phase 1 requires vendor currency to match the document or payment currency',
      );
    }
  }

  private async resolveOpenPeriod(
    tx: TransactionClient,
    tenantId: string,
    transactionDate: Date,
  ) {
    const period = await tx.fiscalPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!period) {
      throw new BadRequestException(
        'No fiscal period contains the payable transaction date',
      );
    }
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post payable transaction into a ${period.status.toLowerCase()} fiscal period`,
      );
    }
    return period;
  }

  private async lockAllocationSources(
    tx: TransactionClient,
    tenantId: string,
    input: {
      billId: string;
      paymentId?: string;
      creditNoteId?: string;
    },
  ) {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "accounting"."AccountingPayableDocument"
      WHERE "tenantId" = ${tenantId}
        AND "id" IN (${input.billId}, ${input.creditNoteId ?? input.billId})
      FOR UPDATE
    `;
    if (input.paymentId) {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "accounting"."AccountingPayablePayment"
        WHERE "tenantId" = ${tenantId}
          AND "id" = ${input.paymentId}
        FOR UPDATE
      `;
    }
  }

  private documentAmounts(dto: { amount: number; taxAmount?: number }) {
    const subtotalAmount = new Prisma.Decimal(dto.amount);
    const taxAmount = new Prisma.Decimal(dto.taxAmount ?? 0);
    return {
      subtotalAmount,
      taxAmount,
      totalAmount: subtotalAmount.plus(taxAmount),
    };
  }

  private paymentState(document: PayableDocument, outstanding: Prisma.Decimal) {
    if (document.status === AccountingPayableStatus.REVERSED) return 'REVERSED';
    if (document.status === AccountingPayableStatus.DRAFT) return 'DRAFT';
    if (outstanding.lte(0)) return 'PAID';
    if (outstanding.lessThan(document.totalAmount)) return 'PARTIALLY_PAID';
    return 'OPEN';
  }

  private async nextDocumentNumber(tenantId: string, prefix: string) {
    const count = await this.prisma.accountingPayableDocument.count({
      where: { tenantId },
    });
    return `${prefix}-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private async nextPaymentNumber(tenantId: string) {
    const count = await this.prisma.accountingPayablePayment.count({
      where: { tenantId },
    });
    return `APP-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private addDays(date: string, days: number) {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    return value.toISOString();
  }

  private money(value: Prisma.Decimal) {
    return value.toFixed(4);
  }

  private optional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private startOfDay(value: string) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
    changedFields: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType,
        entityId,
        changedFields: JSON.parse(
          JSON.stringify(changedFields ?? {}),
        ) as Prisma.InputJsonValue,
      },
    });
  }
}
