import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingReceivableAllocationSource,
  AccountingReceivableDocumentType,
  AccountingReceivableStatus,
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CashbookService } from './cashbook.service';
import { CreateJournalDto } from './dto/accounting.dto';
import { CreateCashbookReceiptDto } from './dto/cashbook.dto';
import {
  CreateCreditNoteAllocationDto,
  CreateReceivableCreditNoteDto,
  CreateReceivableInvoiceDto,
  CreateReceivableReceiptDto,
  CreateReceiptAllocationDto,
  QueryReceiptsDto,
  QueryReceivableAgingDto,
  QueryReceivableDocumentsDto,
  ReverseAllocationDto,
  ReverseReceivableDto,
} from './dto/receivables.dto';
import { JournalsService } from './journals.service';

const zero = new Prisma.Decimal(0);

const receivableDocumentInclude = {
  customer: {
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
  originalInvoice: {
    select: {
      id: true,
      documentNumber: true,
      totalAmount: true,
      status: true,
    },
  },
} satisfies Prisma.AccountingReceivableDocumentInclude;

const receivableReceiptInclude = {
  customer: {
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
} satisfies Prisma.AccountingReceivableReceiptInclude;

type TransactionClient = Prisma.TransactionClient;
type ReceivableDocument = Prisma.AccountingReceivableDocumentGetPayload<{
  include: typeof receivableDocumentInclude;
}>;

@Injectable()
export class ReceivablesService {
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
    const [invoices, allocations, receipts] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: {
          tenantId,
          documentType: AccountingReceivableDocumentType.INVOICE,
          status: AccountingReceivableStatus.POSTED,
        },
        select: { id: true, totalAmount: true, currency: true, dueDate: true },
      }),
      this.prisma.accountingReceivableAllocation.findMany({
        where: { tenantId, reversedAt: null },
        select: { invoiceId: true, amount: true },
      }),
      this.prisma.accountingReceivableReceipt.findMany({
        where: {
          tenantId,
          status: AccountingReceivableStatus.POSTED,
          receiptDate: { gte: monthStart },
        },
        select: { currency: true, amount: true },
      }),
    ]);
    const applied = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations)
      applied.set(
        allocation.invoiceId,
        (applied.get(allocation.invoiceId) ?? zero).plus(allocation.amount),
      );
    const outstanding = new Map<string, Prisma.Decimal>();
    let overdueInvoices = 0;
    let dueThisWeek = 0;
    for (const invoice of invoices) {
      const balance = invoice.totalAmount.minus(
        applied.get(invoice.id) ?? zero,
      );
      if (balance.lessThanOrEqualTo(0)) continue;
      outstanding.set(
        invoice.currency,
        (outstanding.get(invoice.currency) ?? zero).plus(balance),
      );
      if (invoice.dueDate && invoice.dueDate < today) overdueInvoices += 1;
      if (
        invoice.dueDate &&
        invoice.dueDate >= today &&
        invoice.dueDate <= weekEnd
      )
        dueThisWeek += 1;
    }
    const collected = new Map<string, Prisma.Decimal>();
    for (const receipt of receipts)
      collected.set(
        receipt.currency,
        (collected.get(receipt.currency) ?? zero).plus(receipt.amount),
      );
    return {
      outstandingByCurrency: this.summaryTotals(outstanding),
      overdueInvoices,
      dueThisWeek,
      collectedMtdByCurrency: this.summaryTotals(collected),
    };
  }

  private summaryTotals(totals: Map<string, Prisma.Decimal>) {
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => ({ currency, amount: this.money(amount) }));
  }

  async aging(tenantId: string, query: QueryReceivableAgingDto) {
    const asOfDate = this.asOfDate(query.asOfDate);
    const rows = await this.openItems(tenantId, asOfDate, query.customerId);
    return this.agingResult(asOfDate, rows);
  }

  async statement(tenantId: string, customerId: string, asOf?: string) {
    const asOfDate = this.asOfDate(asOf);
    const customer = await this.resolveCustomer(tenantId, customerId);
    const rows = await this.openItems(tenantId, asOfDate, customerId);
    return {
      asOfDate,
      customer: {
        id: customer.id,
        code: customer.code,
        legalName: customer.legalName,
      },
      ...this.agingResult(asOfDate, rows),
      documents: rows,
    };
  }

  private async openItems(
    tenantId: string,
    asOfDate: Date,
    customerId?: string,
  ) {
    const [invoices, allocations] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: {
          tenantId,
          customerId,
          documentType: AccountingReceivableDocumentType.INVOICE,
          status: AccountingReceivableStatus.POSTED,
          documentDate: { lte: asOfDate },
        },
        select: {
          id: true,
          documentNumber: true,
          documentDate: true,
          dueDate: true,
          currency: true,
          totalAmount: true,
          customer: { select: { id: true, code: true, legalName: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { documentDate: 'asc' }],
      }),
      this.prisma.accountingReceivableAllocation.findMany({
        where: { tenantId, reversedAt: null, allocatedAt: { lte: asOfDate } },
        select: { invoiceId: true, amount: true },
      }),
    ]);
    const applied = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations)
      applied.set(
        allocation.invoiceId,
        (applied.get(allocation.invoiceId) ?? zero).plus(allocation.amount),
      );
    return invoices
      .map((invoice) => ({
        ...invoice,
        outstandingAmount: this.money(
          invoice.totalAmount.minus(applied.get(invoice.id) ?? zero),
        ),
      }))
      .filter((invoice) =>
        new Prisma.Decimal(invoice.outstandingAmount).greaterThan(0),
      );
  }

  private agingResult(
    asOfDate: Date,
    rows: Awaited<ReturnType<ReceivablesService['openItems']>>,
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

  async createInvoice(user: RequestUser, dto: CreateReceivableInvoiceDto) {
    const [customer, config] = await Promise.all([
      this.resolveCustomer(user.tenantId, dto.customerId),
      this.resolveConfig(user.tenantId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
      this.assertPostingOffsetAccount(user.tenantId, dto.offsetGlAccountId),
    ]);
    this.assertCustomerCurrency(customer.currency, dto.currency);
    const { subtotalAmount, taxAmount, totalAmount } =
      this.documentAmounts(dto);
    if (!config.accountsReceivableControlAccountId) {
      throw new ConflictException(
        'Configure an accounts receivable control account before creating AR invoices',
      );
    }

    const document = await this.prisma.accountingReceivableDocument.create({
      data: {
        tenantId: user.tenantId,
        customerId: customer.id,
        documentType: AccountingReceivableDocumentType.INVOICE,
        documentNumber: await this.nextDocumentNumber(user.tenantId, 'ARI'),
        documentDate: new Date(dto.documentDate),
        dueDate: new Date(
          dto.dueDate ??
            this.addDays(dto.documentDate, customer.paymentTermsDays),
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
      include: receivableDocumentInclude,
    });
    await this.recordAudit(
      user,
      'RECEIVABLE_INVOICE_CREATED',
      'AccountingReceivableDocument',
      document.id,
      { documentNumber: document.documentNumber, totalAmount },
    );
    return document;
  }

  async createCreditNote(
    user: RequestUser,
    dto: CreateReceivableCreditNoteDto,
  ) {
    const [customer, config] = await Promise.all([
      this.resolveCustomer(user.tenantId, dto.customerId),
      this.resolveConfig(user.tenantId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
      this.assertPostingOffsetAccount(user.tenantId, dto.offsetGlAccountId),
    ]);
    this.assertCustomerCurrency(customer.currency, dto.currency);
    if (!config.accountsReceivableControlAccountId) {
      throw new ConflictException(
        'Configure an accounts receivable control account before creating AR credit notes',
      );
    }
    if (dto.originalInvoiceId) {
      const invoice = await this.getDocumentForTenant(
        user.tenantId,
        dto.originalInvoiceId,
      );
      if (
        invoice.documentType !== AccountingReceivableDocumentType.INVOICE ||
        invoice.customerId !== customer.id ||
        invoice.status !== AccountingReceivableStatus.POSTED
      ) {
        throw new BadRequestException(
          'Credit notes can only reference a posted invoice for the same customer',
        );
      }
      if (invoice.currency !== dto.currency) {
        throw new BadRequestException(
          'Cross-currency invoice credit allocation is not supported in Phase 1',
        );
      }
      const outstanding = await this.invoiceOutstandingAmount(
        user.tenantId,
        invoice.id,
      );
      if (new Prisma.Decimal(dto.amount).greaterThan(outstanding)) {
        throw new ConflictException(
          'Invoice-specific credit note cannot exceed invoice outstanding balance',
        );
      }
    }

    const { subtotalAmount, taxAmount, totalAmount } =
      this.documentAmounts(dto);
    const document = await this.prisma.accountingReceivableDocument.create({
      data: {
        tenantId: user.tenantId,
        customerId: customer.id,
        documentType: AccountingReceivableDocumentType.CREDIT_NOTE,
        documentNumber: await this.nextDocumentNumber(user.tenantId, 'ARC'),
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
        originalInvoiceId: this.optional(dto.originalInvoiceId),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: receivableDocumentInclude,
    });
    await this.recordAudit(
      user,
      'RECEIVABLE_CREDIT_NOTE_CREATED',
      'AccountingReceivableDocument',
      document.id,
      { documentNumber: document.documentNumber, totalAmount },
    );
    return document;
  }

  listInvoices(tenantId: string, query: QueryReceivableDocumentsDto) {
    return this.listDocuments(
      tenantId,
      AccountingReceivableDocumentType.INVOICE,
      query,
    );
  }

  listCreditNotes(tenantId: string, query: QueryReceivableDocumentsDto) {
    return this.listDocuments(
      tenantId,
      AccountingReceivableDocumentType.CREDIT_NOTE,
      query,
    );
  }

  async getInvoice(user: RequestUser, invoiceId: string) {
    const document = await this.getDocumentForTenant(user.tenantId, invoiceId);
    if (document.documentType !== AccountingReceivableDocumentType.INVOICE) {
      throw new NotFoundException('Invoice not found');
    }
    return document;
  }

  async getCreditNote(user: RequestUser, creditNoteId: string) {
    const document = await this.getDocumentForTenant(
      user.tenantId,
      creditNoteId,
    );
    if (
      document.documentType !== AccountingReceivableDocumentType.CREDIT_NOTE
    ) {
      throw new NotFoundException('Credit note not found');
    }
    return document;
  }

  async postInvoice(user: RequestUser, invoiceId: string) {
    return this.postDocument(
      user,
      invoiceId,
      AccountingReceivableDocumentType.INVOICE,
    );
  }

  async postCreditNote(user: RequestUser, creditNoteId: string) {
    return this.postDocument(
      user,
      creditNoteId,
      AccountingReceivableDocumentType.CREDIT_NOTE,
    );
  }

  async reverseInvoice(
    user: RequestUser,
    invoiceId: string,
    dto: ReverseReceivableDto,
  ) {
    return this.reverseDocument(
      user,
      invoiceId,
      AccountingReceivableDocumentType.INVOICE,
      dto,
    );
  }

  async reverseCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: ReverseReceivableDto,
  ) {
    return this.reverseDocument(
      user,
      creditNoteId,
      AccountingReceivableDocumentType.CREDIT_NOTE,
      dto,
    );
  }

  async createReceipt(user: RequestUser, dto: CreateReceivableReceiptDto) {
    const [customer, config] = await Promise.all([
      this.resolveCustomer(user.tenantId, dto.customerId),
      this.resolveConfig(user.tenantId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
    ]);
    this.assertCustomerCurrency(customer.currency, dto.currency);
    if (!config.accountsReceivableControlAccountId) {
      throw new ConflictException(
        'Configure an accounts receivable control account before creating AR receipts',
      );
    }

    const cashbookDto: CreateCashbookReceiptDto = {
      cashAccountId: dto.cashAccountId,
      amount: dto.amount,
      currency: dto.currency,
      transactionDate: dto.receiptDate,
      settlementMethod: dto.settlementMethod,
      reference: dto.reference,
      counterpartyType: 'CUSTOMER',
      counterpartyId: customer.id,
      externalReference: dto.externalReference,
      description: dto.description ?? `Receipt from ${customer.legalName}`,
      offsetGlAccountId: config.accountsReceivableControlAccountId,
      offsetSubledgerAccountId: customer.subledgerAccountId,
      sourceModule: dto.sourceModule ?? 'ACCOUNTING',
      sourceRecordId: dto.sourceRecordId ?? 'AR_RECEIPT_PENDING',
      exchangeRate: dto.exchangeRate,
    };
    const cashbookTransaction = await this.cashbook.createReceipt(
      user,
      cashbookDto,
    );
    const receipt = await this.prisma.accountingReceivableReceipt.create({
      data: {
        tenantId: user.tenantId,
        customerId: customer.id,
        cashbookTransactionId: cashbookTransaction.id,
        receiptNumber: await this.nextReceiptNumber(user.tenantId),
        receiptDate: new Date(dto.receiptDate),
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
      include: receivableReceiptInclude,
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
        sourceRecordId: dto.sourceRecordId ?? receipt.id,
      },
    });
    await this.recordAudit(
      user,
      'RECEIVABLE_RECEIPT_CREATED',
      'AccountingReceivableReceipt',
      receipt.id,
      {
        receiptNumber: receipt.receiptNumber,
        cashbookTransactionId: cashbookTransaction.id,
      },
    );
    return receipt;
  }

  listReceipts(tenantId: string, query: QueryReceiptsDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.AccountingReceivableReceiptWhereInput = {
      tenantId,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.cashAccountId
        ? { cashbookTransaction: { cashAccountId: query.cashAccountId } }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            receiptDate: {
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
                receiptNumber: { contains: query.search, mode: 'insensitive' },
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
    return this.paginateReceipts(where, page, limit);
  }

  async getReceipt(user: RequestUser, receiptId: string) {
    const receipt = await this.prisma.accountingReceivableReceipt.findFirst({
      where: { id: receiptId, tenantId: user.tenantId },
      include: receivableReceiptInclude,
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  async postReceipt(user: RequestUser, receiptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.accountingReceivableReceipt.findFirst({
        where: { id: receiptId, tenantId: user.tenantId },
        include: receivableReceiptInclude,
      });
      if (!receipt) throw new NotFoundException('Receipt not found');
      if (receipt.status !== AccountingReceivableStatus.DRAFT) {
        throw new ConflictException('Only draft receipts can be posted');
      }
      const postedCashbook = await this.cashbook.postTransactionInTransaction(
        tx,
        user,
        receipt.cashbookTransactionId,
      );
      const updated = await tx.accountingReceivableReceipt.update({
        where: { id_tenantId: { id: receipt.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: receivableReceiptInclude,
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_RECEIPT_POSTED',
          entityType: 'AccountingReceivableReceipt',
          entityId: receipt.id,
          changedFields: {
            cashbookJournalEntryId: postedCashbook.postedJournalEntryId,
          },
        },
      });
      return updated;
    });
  }

  async reverseReceipt(
    user: RequestUser,
    receiptId: string,
    dto: ReverseReceivableDto,
  ) {
    const receipt = await this.getReceipt(user, receiptId);
    if (receipt.status !== AccountingReceivableStatus.POSTED) {
      throw new ConflictException('Only posted receipts can be reversed');
    }
    const activeAllocations =
      await this.prisma.accountingReceivableAllocation.count({
        where: {
          tenantId: user.tenantId,
          receiptId: receipt.id,
          reversedAt: null,
        },
      });
    if (activeAllocations > 0) {
      throw new ConflictException(
        'Reverse active receipt allocations before reversing the receipt',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const reversal = await this.cashbook.reverseTransactionInTransaction(
        tx,
        user,
        receipt.cashbookTransactionId,
        dto,
      );
      const updated = await tx.accountingReceivableReceipt.update({
        where: { id_tenantId: { id: receipt.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: receivableReceiptInclude,
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_RECEIPT_REVERSED',
          entityType: 'AccountingReceivableReceipt',
          entityId: receipt.id,
          changedFields: {
            reversalCashbookTransactionId: reversal.id,
            reason: dto.reason,
          },
        },
      });
      return updated;
    });
  }

  async allocateReceipt(
    user: RequestUser,
    receiptId: string,
    dto: CreateReceiptAllocationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.accountingReceivableReceipt.findFirst({
        where: { id: receiptId, tenantId: user.tenantId },
      });
      if (!receipt) throw new NotFoundException('Receipt not found');
      if (receipt.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException('Only posted receipts can be allocated');
      }
      return this.createAllocation(tx, user, {
        customerId: receipt.customerId,
        invoiceId: dto.invoiceId,
        receiptId: receipt.id,
        sourceType: AccountingReceivableAllocationSource.RECEIPT,
        amount: new Prisma.Decimal(dto.amount),
        currency: receipt.currency,
      });
    });
  }

  async allocateCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: CreateCreditNoteAllocationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const creditNote = await tx.accountingReceivableDocument.findFirst({
        where: { id: creditNoteId, tenantId: user.tenantId },
      });
      if (!creditNote) throw new NotFoundException('Credit note not found');
      if (
        creditNote.documentType !==
          AccountingReceivableDocumentType.CREDIT_NOTE ||
        creditNote.status !== AccountingReceivableStatus.POSTED
      ) {
        throw new ConflictException(
          'Only posted credit notes can be allocated',
        );
      }
      return this.createAllocation(tx, user, {
        customerId: creditNote.customerId,
        invoiceId: dto.invoiceId,
        creditNoteId: creditNote.id,
        sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
        amount: new Prisma.Decimal(dto.amount),
        currency: creditNote.currency,
      });
    });
  }

  listReceiptAllocations(tenantId: string, receiptId: string) {
    return this.prisma.accountingReceivableAllocation.findMany({
      where: { tenantId, receiptId },
      include: {
        invoice: {
          select: { id: true, documentNumber: true, totalAmount: true },
        },
      },
      orderBy: { allocatedAt: 'asc' },
    });
  }

  async reverseAllocation(
    user: RequestUser,
    allocationId: string,
    dto: ReverseAllocationDto,
  ) {
    const allocation =
      await this.prisma.accountingReceivableAllocation.findFirst({
        where: { id: allocationId, tenantId: user.tenantId },
      });
    if (!allocation) throw new NotFoundException('Allocation not found');
    if (allocation.reversedAt) return allocation;
    const updated = await this.prisma.accountingReceivableAllocation.update({
      where: { id_tenantId: { id: allocation.id, tenantId: user.tenantId } },
      data: {
        reversedAt: new Date(),
        reversedByUserId: user.id,
        reversalReason: dto.reason,
      },
    });
    await this.recordAudit(
      user,
      'RECEIVABLE_ALLOCATION_REVERSED',
      'AccountingReceivableAllocation',
      allocation.id,
      { reason: dto.reason },
    );
    return updated;
  }

  async invoiceBalance(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.accountingReceivableDocument.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
      },
      include: receivableDocumentInclude,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.invoiceBalanceFromDocument(invoice);
  }

  async customerBalance(tenantId: string, customerId: string) {
    const customer = await this.prisma.accountingCustomer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const [documents, receipts] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: {
          tenantId,
          customerId,
          status: AccountingReceivableStatus.POSTED,
        },
      }),
      this.prisma.accountingReceivableReceipt.findMany({
        where: {
          tenantId,
          customerId,
          status: AccountingReceivableStatus.POSTED,
        },
      }),
    ]);
    const buckets = new Map<
      string,
      {
        postedInvoices: Prisma.Decimal;
        postedCreditNotes: Prisma.Decimal;
        postedReceipts: Prisma.Decimal;
      }
    >();
    const bucket = (currency: string) => {
      const existing = buckets.get(currency);
      if (existing) return existing;
      const created = {
        postedInvoices: new Prisma.Decimal(0),
        postedCreditNotes: new Prisma.Decimal(0),
        postedReceipts: new Prisma.Decimal(0),
      };
      buckets.set(currency, created);
      return created;
    };
    for (const document of documents) {
      const row = bucket(document.currency);
      if (document.documentType === AccountingReceivableDocumentType.INVOICE) {
        row.postedInvoices = row.postedInvoices.plus(document.totalAmount);
      } else {
        row.postedCreditNotes = row.postedCreditNotes.plus(
          document.totalAmount,
        );
      }
    }
    for (const receipt of receipts) {
      bucket(receipt.currency).postedReceipts = bucket(
        receipt.currency,
      ).postedReceipts.plus(receipt.amount);
    }
    return {
      customer,
      balances: [...buckets.entries()].map(([currency, row]) => ({
        currency,
        postedInvoices: this.money(row.postedInvoices),
        postedCreditNotes: this.money(row.postedCreditNotes),
        postedReceipts: this.money(row.postedReceipts),
        balance: this.money(
          row.postedInvoices
            .minus(row.postedCreditNotes)
            .minus(row.postedReceipts),
        ),
      })),
    };
  }

  private async postDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.accountingReceivableDocument.findFirst({
        where: { id: documentId, tenantId: user.tenantId, documentType },
        include: receivableDocumentInclude,
      });
      if (!document)
        throw new NotFoundException('Receivable document not found');
      if (document.status !== AccountingReceivableStatus.DRAFT) {
        throw new ConflictException(
          'Only draft receivable documents can be posted',
        );
      }
      const config = await this.resolveConfig(user.tenantId, tx);
      if (!config.accountsReceivableControlAccountId) {
        throw new ConflictException(
          'Configure an accounts receivable control account before posting receivables',
        );
      }
      if (
        document.documentType ===
          AccountingReceivableDocumentType.CREDIT_NOTE &&
        document.originalInvoiceId
      ) {
        const outstanding = await this.invoiceOutstandingAmount(
          user.tenantId,
          document.originalInvoiceId,
          tx,
        );
        if (document.totalAmount.greaterThan(outstanding)) {
          throw new ConflictException(
            'Invoice-specific credit note cannot exceed invoice outstanding balance',
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
          config.accountsReceivableControlAccountId,
          period.id,
        ),
      );
      const claimed = await tx.accountingReceivableDocument.updateMany({
        where: {
          id: document.id,
          tenantId: user.tenantId,
          status: AccountingReceivableStatus.DRAFT,
        },
        data: {
          status: AccountingReceivableStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: user.id,
          postedJournalEntryId: journal.id,
          updatedByUserId: user.id,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Receivable document was changed by another request',
        );
      }
      if (
        document.documentType ===
          AccountingReceivableDocumentType.CREDIT_NOTE &&
        document.originalInvoiceId
      ) {
        await this.createAllocation(tx, user, {
          customerId: document.customerId,
          invoiceId: document.originalInvoiceId,
          creditNoteId: document.id,
          sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
          amount: document.totalAmount,
          currency: document.currency,
        });
      }
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action:
            document.documentType === AccountingReceivableDocumentType.INVOICE
              ? 'RECEIVABLE_INVOICE_POSTED'
              : 'RECEIVABLE_CREDIT_NOTE_POSTED',
          entityType: 'AccountingReceivableDocument',
          entityId: document.id,
          changedFields: { journalEntryId: journal.id },
        },
      });
      return tx.accountingReceivableDocument.findUniqueOrThrow({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        include: receivableDocumentInclude,
      });
    });
  }

  private async reverseDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
    dto: ReverseReceivableDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.accountingReceivableDocument.findFirst({
        where: { id: documentId, tenantId: user.tenantId, documentType },
        include: receivableDocumentInclude,
      });
      if (!document)
        throw new NotFoundException('Receivable document not found');
      if (document.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException(
          'Only posted receivable documents can be reversed',
        );
      }
      const activeAllocations = await tx.accountingReceivableAllocation.count({
        where: {
          tenantId: user.tenantId,
          reversedAt: null,
          OR:
            document.documentType === AccountingReceivableDocumentType.INVOICE
              ? [{ invoiceId: document.id }]
              : [{ creditNoteId: document.id }],
        },
      });
      if (activeAllocations > 0) {
        throw new ConflictException(
          'Reverse active allocations before reversing this receivable document',
        );
      }
      if (!document.postedJournalEntryId) {
        throw new ConflictException(
          'Posted receivable document is missing its journal',
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
          'Original posted receivable journal is not available for reversal',
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
          description: `Receivable reversal of ${document.documentNumber}: ${dto.reason}`,
          idempotencyKey: `receivable:${document.id}:reversal:v1`,
          sourceModule: 'ACCOUNTING',
          sourceRecordType: 'RECEIVABLE_DOCUMENT_REVERSAL',
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
      await tx.accountingReceivableDocument.update({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.REVERSED,
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
            document.documentType === AccountingReceivableDocumentType.INVOICE
              ? 'RECEIVABLE_INVOICE_REVERSED'
              : 'RECEIVABLE_CREDIT_NOTE_REVERSED',
          entityType: 'AccountingReceivableDocument',
          entityId: document.id,
          changedFields: { reversalJournalEntryId: reversalJournal.id },
        },
      });
      return tx.accountingReceivableDocument.findUniqueOrThrow({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        include: receivableDocumentInclude,
      });
    });
  }

  private async createAllocation(
    tx: TransactionClient,
    user: RequestUser,
    input: {
      customerId: string;
      invoiceId: string;
      receiptId?: string;
      creditNoteId?: string;
      sourceType: AccountingReceivableAllocationSource;
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
    const invoice = await tx.accountingReceivableDocument.findFirst({
      where: {
        id: input.invoiceId,
        tenantId: user.tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!invoice) throw new NotFoundException('Posted invoice not found');
    if (invoice.customerId !== input.customerId) {
      throw new BadRequestException(
        'Allocation customer does not match invoice',
      );
    }
    if (invoice.currency !== input.currency) {
      throw new BadRequestException(
        'Cross-currency receivable allocations are not supported in Phase 1',
      );
    }
    const invoiceOutstanding = await this.invoiceOutstandingAmount(
      user.tenantId,
      invoice.id,
      tx,
    );
    if (input.amount.greaterThan(invoiceOutstanding)) {
      throw new ConflictException(
        'Allocation exceeds invoice outstanding balance',
      );
    }
    if (input.receiptId) {
      const available = await this.receiptAvailableAmount(
        user.tenantId,
        input.receiptId,
        tx,
      );
      if (input.amount.greaterThan(available)) {
        throw new ConflictException(
          'Allocation exceeds receipt unapplied balance',
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
          'Allocation exceeds credit note unapplied balance',
        );
      }
    }
    const allocation = await tx.accountingReceivableAllocation.create({
      data: {
        tenantId: user.tenantId,
        customerId: input.customerId,
        invoiceId: invoice.id,
        receiptId: input.receiptId,
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
        action: 'RECEIVABLE_ALLOCATION_CREATED',
        entityType: 'AccountingReceivableAllocation',
        entityId: allocation.id,
        changedFields: {
          invoiceId: input.invoiceId,
          receiptId: input.receiptId,
          creditNoteId: input.creditNoteId,
          amount: input.amount.toString(),
        },
      },
    });
    return allocation;
  }

  private documentJournalDto(
    document: ReceivableDocument,
    arControlAccountId: string,
    fiscalPeriodId: string,
  ): CreateJournalDto {
    const amount = Number(document.totalAmount.toString());
    const arLine = {
      glAccountId: arControlAccountId,
      subledgerAccountId: document.customer.subledgerAccountId,
      description: document.description ?? document.documentNumber,
    };
    const offsetLine = {
      glAccountId: document.offsetGlAccountId,
      description: document.description ?? document.documentNumber,
    };
    const lines =
      document.documentType === AccountingReceivableDocumentType.INVOICE
        ? [
            { ...arLine, debit: amount, credit: 0 },
            { ...offsetLine, debit: 0, credit: amount },
          ]
        : [
            { ...offsetLine, debit: amount, credit: 0 },
            { ...arLine, debit: 0, credit: amount },
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
      idempotencyKey: `receivable:${document.id}:posted:v1`,
      sourceModule: document.sourceModule ?? 'ACCOUNTING',
      sourceRecordType: 'RECEIVABLE_DOCUMENT',
      sourceRecordId: document.sourceRecordId ?? document.id,
      lines,
    };
  }

  private async listDocuments(
    tenantId: string,
    documentType: AccountingReceivableDocumentType,
    query: QueryReceivableDocumentsDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.AccountingReceivableDocumentWhereInput = {
      tenantId,
      documentType,
      ...(query.customerId ? { customerId: query.customerId } : {}),
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
      this.prisma.accountingReceivableDocument.findMany({
        where,
        include: receivableDocumentInclude,
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingReceivableDocument.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async paginateReceipts(
    where: Prisma.AccountingReceivableReceiptWhereInput,
    page: number,
    limit: number,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.accountingReceivableReceipt.findMany({
        where,
        include: receivableReceiptInclude,
        orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingReceivableReceipt.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async invoiceBalanceFromDocument(document: ReceivableDocument) {
    const [receiptApplied, creditApplied] = await Promise.all([
      this.sumAllocations(document.tenantId, {
        invoiceId: document.id,
        sourceType: AccountingReceivableAllocationSource.RECEIPT,
      }),
      this.sumAllocations(document.tenantId, {
        invoiceId: document.id,
        sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
      }),
    ]);
    const outstanding =
      document.status === AccountingReceivableStatus.POSTED
        ? document.totalAmount.minus(receiptApplied).minus(creditApplied)
        : new Prisma.Decimal(0);
    return {
      invoice: document,
      currency: document.currency,
      originalAmount: this.money(document.totalAmount),
      appliedReceipts: this.money(receiptApplied),
      appliedCreditNotes: this.money(creditApplied),
      outstandingAmount: this.money(outstanding),
      paymentState: this.paymentState(document, outstanding),
    };
  }

  private async invoiceOutstandingAmount(
    tenantId: string,
    invoiceId: string,
    tx?: TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const invoice = await client.accountingReceivableDocument.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!invoice) throw new NotFoundException('Posted invoice not found');
    const applied = await this.sumAllocations(tenantId, { invoiceId }, client);
    return invoice.totalAmount.minus(applied);
  }

  private async receiptAvailableAmount(
    tenantId: string,
    receiptId: string,
    tx: TransactionClient,
  ) {
    const receipt = await tx.accountingReceivableReceipt.findFirst({
      where: {
        id: receiptId,
        tenantId,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!receipt) throw new NotFoundException('Posted receipt not found');
    const allocated = await this.sumAllocations(tenantId, { receiptId }, tx);
    return receipt.amount.minus(allocated);
  }

  private async creditNoteAvailableAmount(
    tenantId: string,
    creditNoteId: string,
    tx: TransactionClient,
  ) {
    const creditNote = await tx.accountingReceivableDocument.findFirst({
      where: {
        id: creditNoteId,
        tenantId,
        documentType: AccountingReceivableDocumentType.CREDIT_NOTE,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!creditNote)
      throw new NotFoundException('Posted credit note not found');
    const allocated = await this.sumAllocations(tenantId, { creditNoteId }, tx);
    return creditNote.totalAmount.minus(allocated);
  }

  private async sumAllocations(
    tenantId: string,
    where: Omit<Prisma.AccountingReceivableAllocationWhereInput, 'tenantId'>,
    client: PrismaService | TransactionClient = this.prisma,
  ) {
    const aggregate = await client.accountingReceivableAllocation.aggregate({
      where: { tenantId, reversedAt: null, ...where },
      _sum: { amount: true },
    });
    return aggregate._sum.amount ?? new Prisma.Decimal(0);
  }

  private async getDocumentForTenant(tenantId: string, documentId: string) {
    const document = await this.prisma.accountingReceivableDocument.findFirst({
      where: { id: documentId, tenantId },
      include: receivableDocumentInclude,
    });
    if (!document) throw new NotFoundException('Receivable document not found');
    return document;
  }

  private async resolveCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.accountingCustomer.findFirst({
      where: { id: customerId, tenantId },
      include: { subledgerAccount: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (!customer.isActive) {
      throw new ConflictException(
        'Inactive customers cannot receive AR activity',
      );
    }
    if (customer.subledgerAccount.status !== RecordStatus.ACTIVE) {
      throw new ConflictException('Customer subledger account is inactive');
    }
    return customer;
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
      account._count.childAccounts > 0 ||
      account.category === GLAccountCategory.ASSET
    ) {
      throw new BadRequestException(
        'Receivable offset account must be active, leaf, posting-enabled and non-asset',
      );
    }
  }

  private assertCustomerCurrency(customerCurrency: string, currency: string) {
    if (customerCurrency !== currency) {
      throw new BadRequestException(
        'Standalone AR Phase 1 requires customer currency to match the document or receipt currency',
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
        'No fiscal period contains the receivable transaction date',
      );
    }
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post receivable transaction into a ${period.status.toLowerCase()} fiscal period`,
      );
    }
    return period;
  }

  private async lockAllocationSources(
    tx: TransactionClient,
    tenantId: string,
    input: {
      invoiceId: string;
      receiptId?: string;
      creditNoteId?: string;
    },
  ) {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "accounting"."AccountingReceivableDocument"
      WHERE "tenantId" = ${tenantId}
        AND "id" IN (${input.invoiceId}, ${input.creditNoteId ?? input.invoiceId})
      FOR UPDATE
    `;
    if (input.receiptId) {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "accounting"."AccountingReceivableReceipt"
        WHERE "tenantId" = ${tenantId}
          AND "id" = ${input.receiptId}
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

  private paymentState(
    document: ReceivableDocument,
    outstanding: Prisma.Decimal,
  ) {
    if (document.status === AccountingReceivableStatus.REVERSED)
      return 'REVERSED';
    if (document.status === AccountingReceivableStatus.DRAFT) return 'DRAFT';
    if (outstanding.lte(0)) return 'PAID';
    if (outstanding.lessThan(document.totalAmount)) return 'PARTIALLY_PAID';
    return 'OPEN';
  }

  private async nextDocumentNumber(tenantId: string, prefix: string) {
    const count = await this.prisma.accountingReceivableDocument.count({
      where: { tenantId },
    });
    return `${prefix}-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private async nextReceiptNumber(tenantId: string) {
    const count = await this.prisma.accountingReceivableReceipt.count({
      where: { tenantId },
    });
    return `ARR-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, '0')}`;
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
