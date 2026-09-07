import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingCashAccountKind,
  AccountingSettlementMethod,
  CashbookDirection,
  CashbookTransactionStatus,
  CashbookTransactionType,
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { JournalsService } from './journals.service';
import { CashbookService } from './cashbook.service';

describe('CashbookService', () => {
  const actor = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'accountant@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Amina',
    moduleConfig: { accounting: true },
    featureConfig: {},
    permissions: [],
  } as RequestUser;

  const activeAssetAccount = {
    id: 'cash-gl',
    tenantId: actor.tenantId,
    code: '1001',
    name: 'Bank',
    category: GLAccountCategory.ASSET,
    normalBalance: NormalBalance.DEBIT,
    allowPosting: true,
    status: RecordStatus.ACTIVE,
  };

  const offsetAccount = {
    id: 'offset-gl',
    tenantId: actor.tenantId,
    code: '4001',
    name: 'Revenue',
    category: GLAccountCategory.REVENUE,
    normalBalance: NormalBalance.CREDIT,
    allowPosting: true,
    status: RecordStatus.ACTIVE,
  };

  function cashAccount(overrides: Record<string, unknown> = {}) {
    return {
      id: 'cash-account-1',
      tenantId: actor.tenantId,
      name: 'Main Bank',
      accountKind: AccountingCashAccountKind.BANK,
      currency: 'GHS',
      glAccountId: activeAssetAccount.id,
      bankName: 'Ecobank',
      accountNumber: '****1234',
      branch: null,
      description: null,
      isActive: true,
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
      updatedAt: new Date('2026-08-10T00:00:00.000Z'),
      glAccount: activeAssetAccount,
      ...overrides,
    };
  }

  function transaction(overrides: Record<string, unknown> = {}) {
    return {
      id: 'cashbook-1',
      tenantId: actor.tenantId,
      cashAccountId: 'cash-account-1',
      destinationCashAccountId: null,
      transactionType: CashbookTransactionType.RECEIPT,
      direction: CashbookDirection.INFLOW,
      amount: { toString: () => '100.00' },
      currency: 'GHS',
      transactionDate: new Date('2026-08-10T00:00:00.000Z'),
      settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
      reference: 'REC-001',
      counterpartyType: 'CUSTOMER',
      counterpartyId: 'customer-1',
      externalReference: null,
      description: 'Customer receipt',
      offsetGlAccountId: offsetAccount.id,
      offsetSubledgerAccountId: null,
      sourceEventInboxId: null,
      sourceModule: null,
      sourceEventType: null,
      sourceRecordId: null,
      sourceReference: null,
      exchangeRate: null,
      status: CashbookTransactionStatus.DRAFT,
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
      postedByUserId: null,
      reversedByUserId: null,
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
      updatedAt: new Date('2026-08-10T00:00:00.000Z'),
      postedAt: null,
      reversedAt: null,
      postedJournalEntryId: null,
      reversalJournalEntryId: null,
      reversalOfTransactionId: null,
      cashAccount: cashAccount(),
      destinationCashAccount: null,
      offsetGlAccount: offsetAccount,
      postedJournalEntry: null,
      reversalJournalEntry: null,
      reversalOfTransaction: null,
      reversalTransaction: null,
      sourceEventInbox: null,
      ...overrides,
    };
  }

  function setup() {
    const prisma = {
      accountingCurrency: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ code: 'GHS', isActive: true }),
      },
      gLAccount: {
        findFirst: jest.fn().mockResolvedValue(activeAssetAccount),
      },
      accountingCashAccount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cashbookTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          tenantId: actor.tenantId,
          status: FiscalPeriodStatus.OPEN,
        }),
      },
      journalEntry: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      accountingAuditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    const journals = {
      createPostedInTransaction: jest.fn().mockResolvedValue({
        id: 'journal-1',
        journalNumber: 'AUTO-001',
        status: JournalStatus.POSTED,
      }),
    };
    const service = new CashbookService(
      prisma as unknown as PrismaService,
      journals as unknown as JournalsService,
    );
    return { journals, prisma, service };
  }

  it('creates a tenant cash account linked to an active posting asset account', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.create.mockResolvedValue(cashAccount());

    const result = await service.createCashAccount(actor, {
      name: 'Main Bank',
      accountKind: AccountingCashAccountKind.BANK,
      currency: 'GHS',
      glAccountId: activeAssetAccount.id,
      bankName: 'Ecobank',
      accountNumber: '****1234',
    });

    expect(result.id).toBe('cash-account-1');
    expect(prisma.gLAccount.findFirst).toHaveBeenCalledWith({
      where: { id: activeAssetAccount.id, tenantId: actor.tenantId },
    });
    expect(prisma.accountingAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CASH_ACCOUNT_CREATED',
        }) as unknown,
      }),
    );
  });

  it('rejects a non-posting GL account for cash account setup', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findFirst.mockResolvedValue({
      ...activeAssetAccount,
      allowPosting: false,
    });

    await expect(
      service.createCashAccount(actor, {
        name: 'Main Bank',
        accountKind: AccountingCashAccountKind.BANK,
        currency: 'GHS',
        glAccountId: activeAssetAccount.id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.accountingCashAccount.create).not.toHaveBeenCalled();
  });

  it('does not reveal cash accounts across tenants', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.getCashAccount(actor, 'other-tenant-account'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.accountingCashAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-tenant-account', tenantId: actor.tenantId },
      }),
    );
  });

  it('creates a draft receipt and preserves generic source metadata', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(cashAccount());
    prisma.gLAccount.findFirst.mockResolvedValue(offsetAccount);
    prisma.cashbookTransaction.create.mockResolvedValue(
      transaction({ sourceModule: 'CRM', sourceRecordId: 'receipt-1' }),
    );

    await service.createReceipt(actor, {
      cashAccountId: 'cash-account-1',
      amount: 100,
      currency: 'GHS',
      transactionDate: '2026-08-10',
      settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
      reference: 'REC-001',
      counterpartyType: 'CUSTOMER',
      counterpartyId: 'customer-1',
      description: 'Customer receipt',
      offsetGlAccountId: offsetAccount.id,
      sourceModule: 'CRM',
      sourceRecordId: 'receipt-1',
    });

    expect(prisma.cashbookTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: CashbookTransactionType.RECEIPT,
          direction: CashbookDirection.INFLOW,
          sourceModule: 'CRM',
          sourceRecordId: 'receipt-1',
        }) as unknown,
      }),
    );
  });

  it('creates a posted Cashbook transaction for a source cash event and links one journal', async () => {
    const { journals, prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(cashAccount());
    prisma.cashbookTransaction.create.mockResolvedValue(
      transaction({
        status: CashbookTransactionStatus.POSTED,
        sourceEventInboxId: 'source-event-1',
        sourceModule: 'REINSURANCE',
        sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
        sourceRecordId: 'payment-1',
        postedJournalEntryId: 'journal-1',
      }),
    );

    const result =
      await service.createPostedSourceEventTransactionInTransaction(
        prisma as never,
        actor,
        {
          sourceEventInboxId: 'source-event-1',
          sourceModule: 'REINSURANCE',
          sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
          sourceRecordId: 'payment-1',
          sourceReference: 'PAY-001',
          cashAccountId: 'cash-account-1',
          direction: CashbookDirection.INFLOW,
          amount: 8500,
          currency: 'GHS',
          transactionDate: new Date('2026-08-10T00:00:00.000Z'),
          settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
          reference: 'PAY-001',
          counterpartyType: 'CEDANT',
          counterpartyId: 'cedant-1',
          description: 'PREMIUM_PAYMENT_RECEIVED - payment-1',
          counterLines: [
            {
              glAccountId: 'cedant-premium-receivable',
              subledgerAccountId: 'cedant-subledger-1',
              description: 'Clear cedant receivable',
              debit: 0,
              credit: 8500,
            },
          ],
        },
      );

    expect(result.transaction.postedJournalEntryId).toBe('journal-1');
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      prisma,
      actor,
      expect.objectContaining({
        idempotencyKey: 'source-event:source-event-1',
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'PREMIUM_PAYMENT_RECEIVED',
        lines: [
          expect.objectContaining({
            glAccountId: activeAssetAccount.id,
            debit: 8500,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 0,
            credit: 8500,
          }),
        ],
      }),
    );
    const createMock = prisma.cashbookTransaction.create as jest.Mock<
      unknown,
      [{ data: Record<string, unknown> }]
    >;
    const createCall = createMock.mock.calls[0]?.[0];
    expect(createCall?.data).toMatchObject({
      status: CashbookTransactionStatus.POSTED,
      sourceEventInboxId: 'source-event-1',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      postedJournalEntryId: 'journal-1',
    });
  });

  it('rejects source cash events when the Accounting cash account is unavailable for the tenant', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.createPostedSourceEventTransactionInTransaction(
        prisma as never,
        actor,
        {
          sourceEventInboxId: 'source-event-1',
          sourceModule: 'REINSURANCE',
          sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
          sourceRecordId: 'payment-1',
          cashAccountId: 'cash-account-other-tenant',
          direction: CashbookDirection.INFLOW,
          amount: 8500,
          currency: 'GHS',
          transactionDate: new Date('2026-08-10T00:00:00.000Z'),
          settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
          description: 'PREMIUM_PAYMENT_RECEIVED - payment-1',
          counterLines: [
            {
              glAccountId: 'cedant-premium-receivable',
              description: 'Clear cedant receivable',
              debit: 0,
              credit: 8500,
            },
          ],
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects source cash events when the cash account currency does not match the settlement currency', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(
      cashAccount({ currency: 'USD' }),
    );

    await expect(
      service.createPostedSourceEventTransactionInTransaction(
        prisma as never,
        actor,
        {
          sourceEventInboxId: 'source-event-1',
          sourceModule: 'REINSURANCE',
          sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
          sourceRecordId: 'payment-1',
          cashAccountId: 'cash-account-1',
          direction: CashbookDirection.INFLOW,
          amount: 8500,
          currency: 'GHS',
          transactionDate: new Date('2026-08-10T00:00:00.000Z'),
          settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
          description: 'PREMIUM_PAYMENT_RECEIVED - payment-1',
          counterLines: [
            {
              glAccountId: 'cedant-premium-receivable',
              description: 'Clear cedant receivable',
              debit: 0,
              credit: 8500,
            },
          ],
        },
      ),
    ).rejects.toThrow(
      'Source cash event currency must match the Accounting cash account currency',
    );
  });

  it('blocks new cashbook entries against inactive cash accounts', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(
      cashAccount({ isActive: false }),
    );

    await expect(
      service.createPayment(actor, {
        cashAccountId: 'cash-account-1',
        amount: 100,
        currency: 'GHS',
        transactionDate: '2026-08-10',
        settlementMethod: AccountingSettlementMethod.BANK_TRANSFER,
        description: 'Supplier payment',
        offsetGlAccountId: offsetAccount.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('posts a receipt by debiting cash and crediting the selected offset account', async () => {
    const { journals, prisma, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(transaction());
    prisma.cashbookTransaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashbookTransaction.findUniqueOrThrow.mockResolvedValue(
      transaction({
        status: CashbookTransactionStatus.POSTED,
        postedJournalEntryId: 'journal-1',
      }),
    );

    await service.postTransaction(actor, 'cashbook-1');

    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      prisma,
      actor,
      expect.objectContaining({
        idempotencyKey: 'cashbook:cashbook-1:posted:v1',
        sourceModule: 'ACCOUNTING',
        lines: [
          expect.objectContaining({
            glAccountId: activeAssetAccount.id,
            debit: 100,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: offsetAccount.id,
            debit: 0,
            credit: 100,
          }),
        ],
      }),
    );
  });

  it('blocks duplicate posting of a non-draft transaction', async () => {
    const { prisma, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(
      transaction({ status: CashbookTransactionStatus.POSTED }),
    );

    await expect(
      service.postTransaction(actor, 'cashbook-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('posts a bank charge by debiting the offset account and crediting cash', async () => {
    const { journals, prisma, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(
      transaction({
        transactionType: CashbookTransactionType.CHARGE,
        direction: CashbookDirection.OUTFLOW,
        description: 'Bank charge',
      }),
    );
    prisma.cashbookTransaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashbookTransaction.findUniqueOrThrow.mockResolvedValue(
      transaction({ status: CashbookTransactionStatus.POSTED }),
    );

    await service.postTransaction(actor, 'cashbook-1');

    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      prisma,
      actor,
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            glAccountId: offsetAccount.id,
            debit: 100,
          }),
          expect.objectContaining({
            glAccountId: activeAssetAccount.id,
            credit: 100,
          }),
        ],
      }),
    );
  });

  it('rejects transfers where source and destination are the same account', async () => {
    const { service } = setup();

    await expect(
      service.createTransfer(actor, {
        cashAccountId: 'cash-account-1',
        destinationCashAccountId: 'cash-account-1',
        amount: 100,
        currency: 'GHS',
        transactionDate: '2026-08-10',
        description: 'Same account transfer',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects cross-currency transfers without agreed FX', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst
      .mockResolvedValueOnce(cashAccount({ id: 'source', currency: 'GHS' }))
      .mockResolvedValueOnce(
        cashAccount({ id: 'destination', currency: 'USD' }),
      );

    await expect(
      service.createTransfer(actor, {
        cashAccountId: 'source',
        destinationCashAccountId: 'destination',
        amount: 100,
        currency: 'GHS',
        transactionDate: '2026-08-10',
        description: 'Cross currency transfer',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('posts a transfer as debit destination cash and credit source cash', async () => {
    const { journals, prisma, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(
      transaction({
        transactionType: CashbookTransactionType.TRANSFER,
        direction: CashbookDirection.TRANSFER,
        destinationCashAccountId: 'cash-account-2',
        destinationCashAccount: cashAccount({
          id: 'cash-account-2',
          glAccountId: 'destination-gl',
        }),
        offsetGlAccountId: null,
      }),
    );
    prisma.cashbookTransaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashbookTransaction.findUniqueOrThrow.mockResolvedValue(
      transaction({ status: CashbookTransactionStatus.POSTED }),
    );

    await service.postTransaction(actor, 'cashbook-1');

    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      prisma,
      actor,
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            glAccountId: 'destination-gl',
            debit: 100,
          }),
          expect.objectContaining({
            glAccountId: activeAssetAccount.id,
            credit: 100,
          }),
        ],
      }),
    );
  });

  it('reverses a posted transaction with a linked reversal cashbook row and journal', async () => {
    const { journals, prisma, service } = setup();
    const posted = transaction({
      status: CashbookTransactionStatus.POSTED,
      postedJournalEntryId: 'journal-original',
      postedJournalEntry: {
        id: 'journal-original',
        journalNumber: 'AUTO-001',
        status: JournalStatus.POSTED,
        postedAt: new Date('2026-08-10T00:00:00.000Z'),
      },
    });
    prisma.cashbookTransaction.findFirst.mockResolvedValue(posted);
    prisma.journalEntry.findFirst.mockResolvedValue({
      id: 'journal-original',
      status: JournalStatus.POSTED,
      transactionCurrency: 'GHS',
      exchangeRate: { toString: () => '1' },
      lines: [
        {
          glAccountId: activeAssetAccount.id,
          subledgerAccountId: null,
          costCentreId: null,
          description: 'Customer receipt',
          transactionDebit: { toString: () => '100' },
          transactionCredit: { toString: () => '0' },
        },
        {
          glAccountId: offsetAccount.id,
          subledgerAccountId: null,
          costCentreId: null,
          description: 'Customer receipt',
          transactionDebit: { toString: () => '0' },
          transactionCredit: { toString: () => '100' },
        },
      ],
    });
    prisma.journalEntry.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashbookTransaction.create.mockResolvedValue(
      transaction({
        id: 'cashbook-reversal-1',
        status: CashbookTransactionStatus.POSTED,
        reversalOfTransactionId: posted.id,
      }),
    );
    prisma.cashbookTransaction.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reverseTransaction(actor, posted.id, {
      reversalDate: '2026-08-11',
      reason: 'Duplicate',
    });

    expect(result.id).toBe('cashbook-reversal-1');
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      prisma,
      actor,
      expect.objectContaining({
        idempotencyKey: 'cashbook:cashbook-1:reversal:v1',
        lines: [
          expect.objectContaining({
            glAccountId: activeAssetAccount.id,
            debit: 0,
            credit: 100,
          }),
          expect.objectContaining({
            glAccountId: offsetAccount.id,
            debit: 100,
            credit: 0,
          }),
        ],
      }),
    );
    expect(prisma.cashbookTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: CashbookTransactionStatus.POSTED,
        }) as unknown,
        data: expect.objectContaining({
          status: CashbookTransactionStatus.REVERSED,
        }) as unknown,
      }),
    );
  });
});
