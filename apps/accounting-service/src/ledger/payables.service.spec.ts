import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingPayableAllocationSource,
  AccountingPayableDocumentType,
  AccountingPayableStatus,
  AccountingSettlementMethod,
  Prisma,
} from '../../prisma/generated/client';
import { CashbookService } from './cashbook.service';
import { JournalsService } from './journals.service';
import { PayablesService } from './payables.service';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
} as unknown as RequestUser;
const apControlAccountId = 'ap-control';
const offsetAccountId = 'expense-account';
const subledgerAccountId = 'vendor-subledger';

const vendor = {
  id: 'vendor-1',
  tenantId: actor.tenantId,
  code: 'VEND-001',
  legalName: 'Supply Co',
  currency: 'GHS',
  paymentTermsDays: 30,
  isActive: true,
  subledgerAccountId,
  subledgerAccount: { id: subledgerAccountId, status: 'ACTIVE' },
};

const bill = (overrides: Record<string, unknown> = {}) => ({
  id: 'bill-1',
  tenantId: actor.tenantId,
  vendorId: vendor.id,
  documentType: AccountingPayableDocumentType.BILL,
  documentNumber: 'APB-2026-000001',
  documentDate: new Date('2026-08-10'),
  dueDate: new Date('2026-09-09'),
  currency: 'GHS',
  exchangeRate: null,
  subtotalAmount: new Prisma.Decimal(1000),
  taxAmount: new Prisma.Decimal(0),
  totalAmount: new Prisma.Decimal(1000),
  description: 'Bill',
  externalReference: null,
  sourceModule: null,
  sourceRecordId: null,
  offsetGlAccountId: offsetAccountId,
  originalBillId: null,
  status: AccountingPayableStatus.DRAFT,
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
  vendor,
  offsetGlAccount: { id: offsetAccountId, code: '5000', name: 'Expense' },
  postedJournalEntry: null,
  reversalJournalEntry: null,
  originalBill: null,
  ...overrides,
});

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  tenantId: actor.tenantId,
  vendorId: vendor.id,
  cashbookTransactionId: 'cashbook-1',
  paymentNumber: 'APP-2026-000001',
  paymentDate: new Date('2026-08-10'),
  currency: 'GHS',
  amount: new Prisma.Decimal(600),
  exchangeRate: null,
  reference: 'BANK-1',
  description: 'Payment',
  externalReference: null,
  sourceModule: null,
  sourceRecordId: null,
  status: AccountingPayableStatus.POSTED,
  createdByUserId: actor.id,
  updatedByUserId: actor.id,
  postedByUserId: actor.id,
  reversedByUserId: null,
  createdAt: new Date('2026-08-10'),
  updatedAt: new Date('2026-08-10'),
  postedAt: new Date('2026-08-10'),
  reversedAt: null,
  reversalOfPaymentId: null,
  vendor,
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
        accountsPayableControlAccountId: apControlAccountId,
      }),
    },
    accountingCurrency: {
      findUnique: jest.fn().mockResolvedValue({ code: 'GHS', isActive: true }),
    },
    accountingVendor: {
      findFirst: jest.fn().mockResolvedValue(vendor),
    },
    gLAccount: {
      findFirst: jest.fn().mockResolvedValue({
        id: offsetAccountId,
        status: 'ACTIVE',
        allowPosting: true,
        category: 'EXPENSE',
        _count: { childAccounts: 0 },
      }),
    },
    accountingPayableDocument: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(bill({ ...data, id: 'bill-1' })),
        ),
      findFirst: jest
        .fn()
        .mockResolvedValue(bill({ status: AccountingPayableStatus.POSTED })),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest
        .fn()
        .mockResolvedValue(bill({ status: AccountingPayableStatus.POSTED })),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue(bill({ status: AccountingPayableStatus.POSTED })),
    },
    accountingPayablePayment: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(
            payment({ ...data, status: AccountingPayableStatus.DRAFT }),
          ),
        ),
      findFirst: jest.fn().mockResolvedValue(payment()),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(payment()),
    },
    cashbookTransaction: {
      update: jest.fn().mockResolvedValue({ id: 'cashbook-1' }),
    },
    accountingPayableAllocation: {
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
    createPayment: jest.fn().mockResolvedValue({ id: 'cashbook-1' }),
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
  const service = new PayablesService(prisma as never, cashbook, journals);
  return { prisma, cashbook, journals, service };
};

describe('PayablesService', () => {
  it('creates a draft standalone bill using tenant AP configuration', async () => {
    const { prisma, service } = setup();

    const result = await service.createBill(actor, {
      vendorId: vendor.id,
      documentDate: '2026-08-10',
      currency: 'GHS',
      amount: 1000,
      offsetGlAccountId: offsetAccountId,
      description: 'Bill',
    });

    expect(result.documentType).toBe(AccountingPayableDocumentType.BILL);
    expect(prisma.accountingTenantConfig.findUnique).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId },
    });
    expect(prisma.accountingPayableDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: vendor.id,
          totalAmount: new Prisma.Decimal(1000),
          offsetGlAccountId: offsetAccountId,
        }) as unknown,
      }),
    );
  });

  it('posts a bill as Dr offset account and Cr AP control', async () => {
    const { journals, prisma, service } = setup();
    prisma.accountingPayableDocument.findFirst.mockResolvedValueOnce(bill());

    await service.postBill(actor, 'bill-1');

    expect(journals.createPostedInTransaction.mock.calls[0]).toEqual([
      expect.anything(),
      actor,
      expect.objectContaining({
        idempotencyKey: 'payable:bill-1:posted:v1',
        lines: [
          expect.objectContaining({
            glAccountId: offsetAccountId,
            debit: 1000,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: apControlAccountId,
            subledgerAccountId,
            debit: 0,
            credit: 1000,
          }),
        ],
      }),
    ]);
  });

  it('creates AP payments through Cashbook with AP subledger offset', async () => {
    const { cashbook, service } = setup();

    await service.createPayment(actor, {
      vendorId: vendor.id,
      cashAccountId: 'cash-account-1',
      amount: 600,
      currency: 'GHS',
      paymentDate: '2026-08-10',
      settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
      reference: 'BANK-1',
    });

    expect(cashbook.createPayment.mock.calls[0]).toEqual([
      actor,
      expect.objectContaining({
        offsetGlAccountId: apControlAccountId,
        offsetSubledgerAccountId: subledgerAccountId,
        counterpartyType: 'VENDOR',
        counterpartyId: vendor.id,
      }),
    ]);
  });

  it('posts AP payments through the transactional Cashbook path', async () => {
    const { cashbook, prisma, service } = setup();
    prisma.accountingPayablePayment.findFirst.mockResolvedValueOnce(
      payment({ status: AccountingPayableStatus.DRAFT }),
    );

    await service.postPayment(actor, 'payment-1');

    expect(cashbook.postTransactionInTransaction.mock.calls[0]).toEqual([
      expect.anything(),
      actor,
      'cashbook-1',
    ]);
  });

  it('allocates a posted payment without creating another journal', async () => {
    const { journals, prisma, service } = setup();

    const allocation = await service.allocatePayment(actor, 'payment-1', {
      billId: 'bill-1',
      amount: 400,
    });

    expect(allocation).toMatchObject({
      sourceType: AccountingPayableAllocationSource.PAYMENT,
      amount: new Prisma.Decimal(400),
    });
    expect(prisma.accountingPayableAllocation.create).toHaveBeenCalled();
    expect(journals.createPostedInTransaction.mock.calls).toHaveLength(0);
  });

  it('rejects payment allocation above the unapplied payment balance', async () => {
    const { prisma, service } = setup();
    prisma.accountingPayableAllocation.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(0) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(550) } });

    await expect(
      service.allocatePayment(actor, 'payment-1', {
        billId: 'bill-1',
        amount: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks reversing a payment with active allocations', async () => {
    const { prisma, service } = setup();
    prisma.accountingPayableAllocation.count.mockResolvedValueOnce(1);

    await expect(
      service.reversePayment(actor, 'payment-1', {
        reversalDate: '2026-08-11',
        reason: 'Wrong payment',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('calculates vendor AP balance by currency', async () => {
    const { prisma, service } = setup();
    prisma.accountingPayableDocument.findMany.mockResolvedValueOnce([
      bill({
        status: AccountingPayableStatus.POSTED,
        totalAmount: new Prisma.Decimal(1000),
      }),
      bill({
        id: 'credit-1',
        documentType: AccountingPayableDocumentType.CREDIT_NOTE,
        status: AccountingPayableStatus.POSTED,
        totalAmount: new Prisma.Decimal(250),
      }),
    ]);
    prisma.accountingPayablePayment.findMany.mockResolvedValueOnce([
      payment({ amount: new Prisma.Decimal(400) }),
    ]);

    const result = await service.vendorBalance(actor.tenantId, vendor.id);

    expect(result.balances).toEqual([
      {
        currency: 'GHS',
        postedBills: '1000.0000',
        postedCredits: '250.0000',
        postedPayments: '400.0000',
        balance: '350.0000',
      },
    ]);
  });

  it('ages only open posted bills using allocations recorded by the as-of date', async () => {
    const { prisma, service } = setup();
    prisma.accountingPayableDocument.findMany.mockResolvedValueOnce([
      bill({
        id: 'current',
        dueDate: new Date('2026-08-10'),
        totalAmount: new Prisma.Decimal(100),
      }),
      bill({
        id: 'overdue',
        dueDate: new Date('2026-06-01'),
        totalAmount: new Prisma.Decimal(250),
      }),
    ]);
    prisma.accountingPayableAllocation.findMany.mockResolvedValueOnce([
      { billId: 'overdue', amount: new Prisma.Decimal(50) },
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
