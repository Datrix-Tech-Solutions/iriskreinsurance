import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingReceivableAllocationSource,
  AccountingReceivableDocumentType,
  AccountingReceivableStatus,
  AccountingSettlementMethod,
  Prisma,
} from '../../prisma/generated/client';
import { CashbookService } from './cashbook.service';
import { JournalsService } from './journals.service';
import { ReceivablesService } from './receivables.service';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
} as unknown as RequestUser;
const arControlAccountId = 'ar-control';
const offsetAccountId = 'revenue-account';
const subledgerAccountId = 'customer-subledger';

const customer = {
  id: 'customer-1',
  tenantId: actor.tenantId,
  code: 'CUST-001',
  legalName: 'Acme Ghana',
  currency: 'GHS',
  paymentTermsDays: 30,
  isActive: true,
  subledgerAccountId,
  subledgerAccount: { id: subledgerAccountId, status: 'ACTIVE' },
};

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'invoice-1',
  tenantId: actor.tenantId,
  customerId: customer.id,
  documentType: AccountingReceivableDocumentType.INVOICE,
  documentNumber: 'ARI-2026-000001',
  documentDate: new Date('2026-08-10'),
  dueDate: new Date('2026-09-09'),
  currency: 'GHS',
  exchangeRate: null,
  subtotalAmount: new Prisma.Decimal(1000),
  taxAmount: new Prisma.Decimal(0),
  totalAmount: new Prisma.Decimal(1000),
  description: 'Invoice',
  externalReference: null,
  sourceModule: null,
  sourceRecordId: null,
  offsetGlAccountId: offsetAccountId,
  originalInvoiceId: null,
  status: AccountingReceivableStatus.DRAFT,
  createdByUserId: actor.id,
  updatedByUserId: actor.id,
  postedByUserId: null,
  reversedByUserId: null,
  createdAt: new Date('2026-08-10'),
  updatedAt: new Date('2026-08-10'),
  postedAt: null,
  reversedAt: null,
  postedJournalEntryId: null,
  reversalJournalEntryId: null,
  reversalOfDocumentId: null,
  customer,
  offsetGlAccount: { id: offsetAccountId, code: '4000', name: 'Revenue' },
  postedJournalEntry: null,
  reversalJournalEntry: null,
  originalInvoice: null,
  ...overrides,
});

const receipt = (overrides: Record<string, unknown> = {}) => ({
  id: 'receipt-1',
  tenantId: actor.tenantId,
  customerId: customer.id,
  cashbookTransactionId: 'cashbook-1',
  receiptNumber: 'ARR-2026-000001',
  receiptDate: new Date('2026-08-10'),
  currency: 'GHS',
  amount: new Prisma.Decimal(600),
  exchangeRate: null,
  reference: 'BANK-1',
  description: 'Receipt',
  externalReference: null,
  sourceModule: null,
  sourceRecordId: null,
  status: AccountingReceivableStatus.POSTED,
  createdByUserId: actor.id,
  updatedByUserId: actor.id,
  postedByUserId: actor.id,
  reversedByUserId: null,
  createdAt: new Date('2026-08-10'),
  updatedAt: new Date('2026-08-10'),
  postedAt: new Date('2026-08-10'),
  reversedAt: null,
  reversalOfReceiptId: null,
  customer,
  cashbookTransaction: {
    id: 'cashbook-1',
    status: 'POSTED',
    reference: 'BANK-1',
    postedJournalEntryId: 'journal-1',
    reversalJournalEntryId: null,
  },
  ...overrides,
});

const setup = () => {
  const prisma = {
    accountingTenantConfig: {
      findUnique: jest.fn().mockResolvedValue({
        tenantId: actor.tenantId,
        baseCurrency: 'GHS',
        accountsReceivableControlAccountId: arControlAccountId,
      }),
    },
    accountingCurrency: {
      findUnique: jest.fn().mockResolvedValue({ code: 'GHS', isActive: true }),
    },
    accountingCustomer: {
      findFirst: jest.fn().mockResolvedValue(customer),
    },
    gLAccount: {
      findFirst: jest.fn().mockResolvedValue({
        id: offsetAccountId,
        status: 'ACTIVE',
        allowPosting: true,
        category: 'REVENUE',
        _count: { childAccounts: 0 },
      }),
    },
    accountingReceivableDocument: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(invoice({ ...data, id: 'invoice-1' })),
        ),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          invoice({ status: AccountingReceivableStatus.POSTED }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest
        .fn()
        .mockResolvedValue(
          invoice({ status: AccountingReceivableStatus.POSTED }),
        ),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue(
          invoice({ status: AccountingReceivableStatus.POSTED }),
        ),
    },
    accountingReceivableReceipt: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(
            receipt({ ...data, status: AccountingReceivableStatus.DRAFT }),
          ),
        ),
      findFirst: jest.fn().mockResolvedValue(receipt()),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(receipt()),
    },
    cashbookTransaction: {
      update: jest.fn().mockResolvedValue({ id: 'cashbook-1' }),
    },
    accountingReceivableAllocation: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'allocation-1', ...data }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    fiscalPeriod: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'period-1', status: 'OPEN' }),
    },
    journalEntry: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    accountingAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const cashbook = {
    createReceipt: jest.fn().mockResolvedValue({ id: 'cashbook-1' }),
    postTransactionInTransaction: jest.fn().mockResolvedValue({
      id: 'cashbook-1',
      postedJournalEntryId: 'journal-1',
    }),
    reverseTransactionInTransaction: jest.fn().mockResolvedValue({
      id: 'cashbook-reversal-1',
    }),
  } as unknown as jest.Mocked<CashbookService>;
  const journals = {
    createPostedInTransaction: jest.fn().mockResolvedValue({ id: 'journal-1' }),
  } as unknown as jest.Mocked<JournalsService>;
  const service = new ReceivablesService(prisma as never, cashbook, journals);
  return { prisma, cashbook, journals, service };
};

describe('ReceivablesService', () => {
  it('creates a draft standalone invoice using tenant AR configuration', async () => {
    const { prisma, service } = setup();

    const result = await service.createInvoice(actor, {
      customerId: customer.id,
      documentDate: '2026-08-10',
      currency: 'GHS',
      amount: 1000,
      offsetGlAccountId: offsetAccountId,
      description: 'Invoice',
    });

    expect(result.documentType).toBe(AccountingReceivableDocumentType.INVOICE);
    expect(prisma.accountingTenantConfig.findUnique).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId },
    });
    expect(prisma.accountingReceivableDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: customer.id,
          totalAmount: new Prisma.Decimal(1000),
          offsetGlAccountId: offsetAccountId,
        }) as unknown,
      }),
    );
  });

  it('posts an invoice as Dr AR control and Cr offset account', async () => {
    const { journals, prisma, service } = setup();
    prisma.accountingReceivableDocument.findFirst.mockResolvedValueOnce(
      invoice(),
    );

    await service.postInvoice(actor, 'invoice-1');

    expect(journals.createPostedInTransaction.mock.calls[0]).toEqual([
      expect.anything(),
      actor,
      expect.objectContaining({
        idempotencyKey: 'receivable:invoice-1:posted:v1',
        lines: [
          expect.objectContaining({
            glAccountId: arControlAccountId,
            subledgerAccountId,
            debit: 1000,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: offsetAccountId,
            debit: 0,
            credit: 1000,
          }),
        ],
      }),
    ]);
  });

  it('creates AR receipts through Cashbook with AR subledger offset', async () => {
    const { cashbook, service } = setup();

    await service.createReceipt(actor, {
      customerId: customer.id,
      cashAccountId: 'cash-account-1',
      amount: 600,
      currency: 'GHS',
      receiptDate: '2026-08-10',
      settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
      reference: 'BANK-1',
    });

    expect(cashbook.createReceipt.mock.calls[0]).toEqual([
      actor,
      expect.objectContaining({
        offsetGlAccountId: arControlAccountId,
        offsetSubledgerAccountId: subledgerAccountId,
        counterpartyType: 'CUSTOMER',
        counterpartyId: customer.id,
      }),
    ]);
  });

  it('posts AR receipts through the transactional Cashbook path', async () => {
    const { cashbook, prisma, service } = setup();
    prisma.accountingReceivableReceipt.findFirst.mockResolvedValueOnce(
      receipt({ status: AccountingReceivableStatus.DRAFT }),
    );

    await service.postReceipt(actor, 'receipt-1');

    expect(cashbook.postTransactionInTransaction.mock.calls[0]).toEqual([
      expect.anything(),
      actor,
      'cashbook-1',
    ]);
  });

  it('allocates a posted receipt without creating another journal', async () => {
    const { journals, prisma, service } = setup();

    const allocation = await service.allocateReceipt(actor, 'receipt-1', {
      invoiceId: 'invoice-1',
      amount: 400,
    });

    expect(allocation).toMatchObject({
      sourceType: AccountingReceivableAllocationSource.RECEIPT,
      amount: new Prisma.Decimal(400),
    });
    expect(prisma.accountingReceivableAllocation.create).toHaveBeenCalled();
    expect(journals.createPostedInTransaction.mock.calls).toHaveLength(0);
  });

  it('rejects receipt allocation above the unapplied receipt balance', async () => {
    const { prisma, service } = setup();
    prisma.accountingReceivableAllocation.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(0) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(550) } });

    await expect(
      service.allocateReceipt(actor, 'receipt-1', {
        invoiceId: 'invoice-1',
        amount: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks reversing a receipt with active allocations', async () => {
    const { prisma, service } = setup();
    prisma.accountingReceivableAllocation.count.mockResolvedValueOnce(1);

    await expect(
      service.reverseReceipt(actor, 'receipt-1', {
        reversalDate: '2026-08-11',
        reason: 'Wrong receipt',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('calculates customer AR balance by currency', async () => {
    const { prisma, service } = setup();
    prisma.accountingReceivableDocument.findMany.mockResolvedValueOnce([
      invoice({
        status: AccountingReceivableStatus.POSTED,
        totalAmount: new Prisma.Decimal(1000),
      }),
      invoice({
        id: 'credit-1',
        documentType: AccountingReceivableDocumentType.CREDIT_NOTE,
        status: AccountingReceivableStatus.POSTED,
        totalAmount: new Prisma.Decimal(250),
      }),
    ]);
    prisma.accountingReceivableReceipt.findMany.mockResolvedValueOnce([
      receipt({ amount: new Prisma.Decimal(400) }),
    ]);

    const result = await service.customerBalance(actor.tenantId, customer.id);

    expect(result.balances).toEqual([
      {
        currency: 'GHS',
        postedInvoices: '1000.0000',
        postedCreditNotes: '250.0000',
        postedReceipts: '400.0000',
        balance: '350.0000',
      },
    ]);
  });

  it('ages only open posted invoices using allocations recorded by the as-of date', async () => {
    const { prisma, service } = setup();
    prisma.accountingReceivableDocument.findMany.mockResolvedValueOnce([
      invoice({
        id: 'current',
        dueDate: new Date('2026-08-10'),
        totalAmount: new Prisma.Decimal(100),
      }),
      invoice({
        id: 'overdue',
        dueDate: new Date('2026-06-01'),
        totalAmount: new Prisma.Decimal(250),
      }),
    ]);
    prisma.accountingReceivableAllocation.findMany.mockResolvedValueOnce([
      { invoiceId: 'overdue', amount: new Prisma.Decimal(50) },
    ]);

    await expect(
      service.aging(actor.tenantId, { asOfDate: '2026-08-10' }),
    ).resolves.toEqual({
      agingByCurrency: [
        {
          currency: 'GHS',
          CURRENT: '100.0000',
          '1_30': '0.0000',
          '31_60': '0.0000',
          '61_90': '200.0000',
          OVER_90: '0.0000',
        },
      ],
    });
  });
});
