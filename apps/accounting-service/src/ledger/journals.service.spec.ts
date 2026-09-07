import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { JournalPolicy } from './journal.policy';
import { JournalsService } from './journals.service';

describe('JournalsService', () => {
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

  const period = {
    id: 'period-1',
    tenantId: actor.tenantId,
    name: 'July 2026',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-07-31T23:59:59.999Z'),
    status: FiscalPeriodStatus.OPEN,
  };

  const account = (id: string) => ({
    id,
    tenantId: actor.tenantId,
    code: id,
    name: id,
    category: GLAccountCategory.ASSET,
    normalBalance: NormalBalance.DEBIT,
    parentAccountId: null,
    allowPosting: true,
    description: null,
    status: RecordStatus.ACTIVE,
    _count: { childAccounts: 0 },
  });

  const journalLine = (
    id: string,
    glAccountId: string,
    debit: number,
    credit: number,
  ) => ({
    id,
    tenantId: actor.tenantId,
    journalEntryId: 'journal-1',
    lineNumber: id === 'line-1' ? 1 : 2,
    glAccountId,
    subledgerAccountId: null,
    costCentreId: null,
    description: null,
    transactionDebit: new Prisma.Decimal(debit),
    transactionCredit: new Prisma.Decimal(credit),
    baseDebit: new Prisma.Decimal(debit),
    baseCredit: new Prisma.Decimal(credit),
    glAccount: { id: glAccountId, code: glAccountId, name: glAccountId },
    subledgerAccount: null,
    costCentre: null,
  });

  const draftJournal = {
    id: 'journal-1',
    tenantId: actor.tenantId,
    journalNumber: 'JE-001',
    status: JournalStatus.DRAFT,
    transactionDate: new Date('2026-07-10T00:00:00.000Z'),
    postingDate: null,
    fiscalPeriodId: period.id,
    transactionCurrency: 'GHS',
    baseCurrency: 'GHS',
    exchangeRate: new Prisma.Decimal(1),
    reference: null,
    description: 'Test journal',
    idempotencyKey: null,
    sourceModule: null,
    sourceRecordType: null,
    sourceRecordId: null,
    reversalOfJournalId: null,
    createdByUserId: actor.id,
    updatedByUserId: actor.id,
    postedByUserId: null,
    reversedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    postedAt: null,
    reversedAt: null,
    fiscalPeriod: period,
    lines: [
      journalLine('line-1', 'cash', 100, 0),
      journalLine('line-2', 'income', 0, 100),
    ],
  };

  function setup() {
    const prisma = {
      accountingTenantConfig: {
        findUnique: jest.fn(),
      },
      accountingCurrency: {
        findUnique: jest.fn(),
      },
      exchangeRate: {
        findFirst: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      gLAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      subledgerAccount: {
        findMany: jest.fn(),
      },
      costCentre: {
        findMany: jest.fn(),
      },
      journalEntry: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    const service = new JournalsService(
      prisma as unknown as PrismaService,
      new JournalPolicy(),
    );
    return { prisma, service };
  }

  it('scopes journal detail lookup to the requesting tenant', async () => {
    const { prisma, service } = setup();
    prisma.journalEntry.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('tenant-other', 'journal-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'journal-1', tenantId: 'tenant-other' },
      }),
    );
  });

  it.each([FiscalPeriodStatus.CLOSED, FiscalPeriodStatus.LOCKED])(
    'rejects posting into a %s fiscal period',
    async (status) => {
      const { prisma, service } = setup();
      prisma.journalEntry.findFirst.mockResolvedValue(draftJournal);
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        ...period,
        status,
      });

      await expect(service.post(actor, draftJournal.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.journalEntry.updateMany).not.toHaveBeenCalled();
    },
  );

  it('keeps posted journal drafts immutable', async () => {
    const { prisma, service } = setup();
    prisma.journalEntry.findFirst.mockResolvedValue({
      ...draftJournal,
      status: JournalStatus.POSTED,
    });

    await expect(
      service.updateDraft(actor, draftJournal.id, {
        description: 'Changed',
      }),
    ).rejects.toThrow('Posted or reversed journals are immutable');
  });

  it('rejects journals that use inactive or non-posting GL accounts', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      decimalPlaces: 2,
      isActive: true,
    });
    prisma.gLAccount.findMany.mockResolvedValue([
      { ...account('cash'), allowPosting: false },
      account('income'),
    ]);
    prisma.subledgerAccount.findMany.mockResolvedValue([]);
    prisma.costCentre.findMany.mockResolvedValue([]);

    await expect(
      service.create(actor, {
        transactionDate: '2026-07-10',
        fiscalPeriodId: period.id,
        transactionCurrency: 'GHS',
        description: 'Blocked account',
        lines: [
          { glAccountId: 'cash', debit: 100 },
          { glAccountId: 'income', credit: 100 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects postings to summary accounts with child accounts', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      decimalPlaces: 2,
      isActive: true,
    });
    prisma.gLAccount.findMany.mockResolvedValue([
      { ...account('cash'), _count: { childAccounts: 1 } },
      account('income'),
    ]);
    prisma.subledgerAccount.findMany.mockResolvedValue([]);
    prisma.costCentre.findMany.mockResolvedValue([]);

    await expect(
      service.create(actor, {
        transactionDate: '2026-07-10',
        fiscalPeriodId: period.id,
        transactionCurrency: 'GHS',
        description: 'Summary account posting',
        lines: [
          { glAccountId: 'cash', debit: 100 },
          { glAccountId: 'income', credit: 100 },
        ],
      }),
    ).rejects.toThrow('active leaf posting-enabled GL accounts');
  });

  it('requires a subledger when posting to an active control account', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      decimalPlaces: 2,
      isActive: true,
    });
    prisma.gLAccount.findMany.mockResolvedValue([
      account('cash'),
      account('income'),
    ]);
    prisma.subledgerAccount.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ controlAccountId: 'cash' }]);
    prisma.costCentre.findMany.mockResolvedValue([]);

    await expect(
      service.create(actor, {
        transactionDate: '2026-07-10',
        fiscalPeriodId: period.id,
        transactionCurrency: 'GHS',
        description: 'Direct control posting',
        lines: [
          { glAccountId: 'cash', debit: 100 },
          { glAccountId: 'income', credit: 100 },
        ],
      }),
    ).rejects.toThrow('require a matching subledger account');
  });

  it('stores base-currency amounts at exchange rate one', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      decimalPlaces: 2,
      isActive: true,
    });
    prisma.gLAccount.findMany.mockResolvedValue([
      account('cash'),
      account('income'),
    ]);
    prisma.subledgerAccount.findMany.mockResolvedValue([]);
    prisma.costCentre.findMany.mockResolvedValue([]);
    prisma.journalEntry.create.mockImplementation(
      (args: { data: unknown }) => args.data,
    );

    const result = (await service.create(actor, {
      transactionDate: '2026-07-10',
      fiscalPeriodId: period.id,
      transactionCurrency: 'GHS',
      description: 'Base journal',
      lines: [
        { glAccountId: 'cash', debit: 100 },
        { glAccountId: 'income', credit: 100 },
      ],
    })) as unknown as {
      exchangeRate: Prisma.Decimal;
      lines: { create: Array<{ baseDebit: Prisma.Decimal }> };
    };

    expect(result.exchangeRate.toString()).toBe('1');
    expect(result.lines.create[0].baseDebit.toFixed(2)).toBe('100.00');
  });

  it('atomically creates a posted journal for a source event', async () => {
    const { prisma, service } = setup();
    prisma.journalEntry.findUnique.mockResolvedValue(null);
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      decimalPlaces: 2,
      isActive: true,
    });
    prisma.gLAccount.findMany.mockResolvedValue([
      account('cash'),
      account('income'),
    ]);
    prisma.subledgerAccount.findMany.mockResolvedValue([]);
    prisma.costCentre.findMany.mockResolvedValue([]);
    prisma.journalEntry.create.mockImplementation(
      (args: { data: unknown }) => args.data,
    );

    const result = (await service.createPostedInTransaction(
      prisma as unknown as Prisma.TransactionClient,
      actor,
      {
        transactionDate: '2026-07-10',
        fiscalPeriodId: period.id,
        transactionCurrency: 'GHS',
        description: 'Automated source event journal',
        idempotencyKey: 'source-event:event-1',
        sourceModule: 'OPERATIONS',
        sourceRecordType: 'RECEIPT_ISSUED',
        sourceRecordId: 'receipt-1',
        lines: [
          { glAccountId: 'cash', debit: 100 },
          { glAccountId: 'income', credit: 100 },
        ],
      },
    )) as unknown as { status: JournalStatus; postedAt: Date };

    expect(result.status).toBe(JournalStatus.POSTED);
    expect(result.postedAt).toBeInstanceOf(Date);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('never creates an automated journal when rule amounts are unbalanced', async () => {
    const { prisma, service } = setup();
    prisma.journalEntry.findUnique.mockResolvedValue(null);

    await expect(
      service.createPostedInTransaction(
        prisma as unknown as Prisma.TransactionClient,
        actor,
        {
          transactionDate: '2026-07-10',
          fiscalPeriodId: period.id,
          transactionCurrency: 'GHS',
          description: 'Unbalanced automated journal',
          lines: [
            { glAccountId: 'cash', debit: 100 },
            { glAccountId: 'income', credit: 90 },
          ],
        },
      ),
    ).rejects.toThrow('Journal is unbalanced');
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a journal when base-currency line rounding is unbalanced', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      decimalPlaces: 2,
      isActive: true,
    });

    await expect(
      service.create(actor, {
        transactionDate: '2026-07-10',
        fiscalPeriodId: period.id,
        transactionCurrency: 'USD',
        exchangeRate: 0.5,
        description: 'Rounding imbalance',
        lines: [
          { glAccountId: 'cash', debit: 0.04 },
          { glAccountId: 'income', credit: 0.01 },
          { glAccountId: 'income', credit: 0.03 },
        ],
      }),
    ).rejects.toThrow('Journal is unbalanced');
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('resolves a fresh FX rate when draft currency changes', async () => {
    const { prisma, service } = setup();
    prisma.journalEntry.findFirst.mockResolvedValue(draftJournal);
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'USD',
      decimalPlaces: 2,
      isActive: true,
    });
    prisma.exchangeRate.findFirst.mockResolvedValue({
      rate: new Prisma.Decimal(15.5),
    });
    prisma.gLAccount.findMany.mockResolvedValue([
      account('cash'),
      account('income'),
    ]);
    prisma.subledgerAccount.findMany.mockResolvedValue([]);
    prisma.costCentre.findMany.mockResolvedValue([]);
    prisma.journalEntry.update.mockImplementation(
      (args: { data: unknown }) => args.data,
    );

    const result = (await service.updateDraft(actor, draftJournal.id, {
      transactionCurrency: 'USD',
    })) as unknown as { exchangeRate: Prisma.Decimal };

    expect(prisma.exchangeRate.findFirst).toHaveBeenCalled();
    expect(result.exchangeRate.toString()).toBe('15.5');
    expect(prisma.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_tenantId: {
            id: draftJournal.id,
            tenantId: actor.tenantId,
          },
        },
      }),
    );
  });

  it('creates an exact linked reversal journal', async () => {
    const { prisma, service } = setup();
    const posted = {
      ...draftJournal,
      status: JournalStatus.POSTED,
      reversalJournal: null,
    };
    prisma.journalEntry.findFirst.mockResolvedValue(posted);
    prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
    prisma.journalEntry.updateMany.mockResolvedValue({ count: 1 });
    prisma.journalEntry.create.mockImplementation(
      (args: { data: unknown }) => args.data,
    );

    const reversal = (await service.reverse(actor, posted.id, {
      reversalDate: '2026-07-20',
      reason: 'Correction',
    })) as unknown as {
      reversalOfJournal: {
        connect: { id_tenantId: { id: string; tenantId: string } };
      };
      lines: {
        create: Array<{
          transactionDebit: Prisma.Decimal;
          transactionCredit: Prisma.Decimal;
        }>;
      };
    };

    expect(reversal.reversalOfJournal.connect.id_tenantId).toEqual({
      id: posted.id,
      tenantId: actor.tenantId,
    });
    expect(reversal.lines.create[0].transactionDebit.toString()).toBe('0');
    expect(reversal.lines.create[0].transactionCredit.toString()).toBe('100');
    expect(prisma.journalEntry.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects reversal-of-reversal chains', async () => {
    const { prisma, service } = setup();
    prisma.journalEntry.findFirst.mockResolvedValue({
      ...draftJournal,
      status: JournalStatus.POSTED,
      reversalOfJournalId: 'original-journal',
      reversalJournal: null,
    });

    await expect(
      service.reverse(actor, draftJournal.id, {
        reversalDate: '2026-07-20',
        reason: 'Reinstate',
      }),
    ).rejects.toThrow('Reversal journals cannot be reversed');
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('reuses the existing reversal on retry', async () => {
    const { prisma, service } = setup();
    const existingReversal = {
      ...draftJournal,
      id: 'reversal-1',
      status: JournalStatus.POSTED,
      reversalOfJournalId: draftJournal.id,
    };
    prisma.journalEntry.findFirst.mockResolvedValue({
      ...draftJournal,
      status: JournalStatus.REVERSED,
      reversalJournal: existingReversal,
    });

    await expect(
      service.reverse(actor, draftJournal.id, {
        reversalDate: '2026-07-20',
        reason: 'Retry',
      }),
    ).resolves.toEqual(existingReversal);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });
});
