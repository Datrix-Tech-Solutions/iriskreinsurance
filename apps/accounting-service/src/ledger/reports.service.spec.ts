import {
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const tenantId = 'tenant-1';
  const assetAccount = {
    id: 'asset-account',
    tenantId,
    code: '1100',
    name: 'Cash',
    category: GLAccountCategory.ASSET,
    normalBalance: NormalBalance.DEBIT,
  };
  const liabilityAccount = {
    id: 'liability-account',
    tenantId,
    code: '2100',
    name: 'Premium Clearing',
    category: GLAccountCategory.LIABILITY,
    normalBalance: NormalBalance.CREDIT,
  };
  const equityAccount = {
    id: 'equity-account',
    tenantId,
    code: '3100',
    name: 'Owner Equity',
    category: GLAccountCategory.EQUITY,
    normalBalance: NormalBalance.CREDIT,
  };
  const revenueAccount = {
    id: 'revenue-account',
    tenantId,
    code: '4100',
    name: 'Premium Income',
    category: GLAccountCategory.REVENUE,
    normalBalance: NormalBalance.CREDIT,
  };
  const expenseAccount = {
    id: 'expense-account',
    tenantId,
    code: '5100',
    name: 'Claims Expense',
    category: GLAccountCategory.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
  };

  type TestAccount = {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    category: GLAccountCategory;
    normalBalance: NormalBalance;
  };

  function reportLine(
    account: TestAccount,
    debit: number,
    credit: number,
    options: Partial<{
      id: string;
      date: string;
      status: JournalStatus;
      fiscalPeriodId: string;
      costCentreId: string | null;
      subledgerAccountId: string | null;
    }> = {},
  ) {
    const date = new Date(options.date ?? '2026-07-10T00:00:00.000Z');
    return {
      id: options.id ?? `${account.id}-${debit}-${credit}`,
      tenantId,
      journalEntryId: 'journal-1',
      lineNumber: 1,
      glAccountId: account.id,
      subledgerAccountId: options.subledgerAccountId ?? null,
      costCentreId: options.costCentreId ?? null,
      description: `${account.name} line`,
      transactionDebit: new Prisma.Decimal(debit),
      transactionCredit: new Prisma.Decimal(credit),
      baseDebit: new Prisma.Decimal(debit),
      baseCredit: new Prisma.Decimal(credit),
      createdAt: new Date(),
      updatedAt: new Date(),
      glAccount: account,
      subledgerAccount: null,
      costCentre: null,
      journalEntry: {
        id: 'journal-1',
        journalNumber: 'JE-001',
        status: options.status ?? JournalStatus.POSTED,
        transactionDate: date,
        postingDate: date,
        description: 'Posted journal',
        reference: 'REF-001',
        transactionCurrency: 'GHS',
        sourceModule: 'REINSURANCE',
        sourceRecordId: 'note-1',
      },
    };
  }

  type FindManyCall = {
    where: {
      tenantId: string;
      glAccountId?: string;
      costCentreId?: string;
      subledgerAccountId?: string;
      journalEntry: {
        tenantId: string;
        transactionCurrency?: string;
      };
    };
  };

  function setup(lines: unknown[] = [], accounts: unknown[] = []) {
    const prisma = {
      journalLine: {
        findMany: jest.fn().mockResolvedValue(lines),
      },
      gLAccount: {
        findMany: jest.fn().mockResolvedValue(accounts),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          tenantId,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: new Date('2026-07-31T23:59:59.999Z'),
        }),
      },
    };
    return {
      prisma,
      service: new ReportsService(prisma as unknown as PrismaService),
    };
  }

  it('calculates general ledger opening and closing balances', async () => {
    const openingLine = reportLine(assetAccount, 100, 0, {
      date: '2026-06-30T00:00:00.000Z',
    });
    const periodLine = reportLine(assetAccount, 50, 20);
    const { prisma, service } = setup();
    prisma.journalLine.findMany
      .mockResolvedValueOnce([periodLine])
      .mockResolvedValueOnce([openingLine]);

    const result = await service.generalLedger(tenantId, {
      accountId: assetAccount.id,
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });

    expect(result.openingBalance).toBe('100.00');
    expect(result.totalDebit).toBe('50.00');
    expect(result.totalCredit).toBe('20.00');
    expect(result.closingBalance).toBe('130.00');
    expect(result.lines[0]).toMatchObject({
      journalNumber: 'JE-001',
      runningBalance: '130.00',
      sourceModule: 'REINSURANCE',
    });
  });

  it('produces a balanced trial balance grouped by account category', async () => {
    const lines = [
      reportLine(assetAccount, 100, 0),
      reportLine(revenueAccount, 0, 100),
    ];
    const { service } = setup(lines, [assetAccount, revenueAccount]);

    const result = await service.trialBalance(tenantId, {
      asOfDate: '2026-07-31',
    });

    expect(result.accounts.ASSET[0]).toMatchObject({
      debitBalance: '100.00',
      creditBalance: '0.00',
    });
    expect(result.accounts.REVENUE[0]).toMatchObject({
      debitBalance: '0.00',
      creditBalance: '100.00',
    });
    expect(result.totalDebit).toBe('100.00');
    expect(result.totalCredit).toBe('100.00');
    expect(result.imbalanceAmount).toBe('0.00');
  });

  it('calculates income statement revenue less expenses', async () => {
    const { service } = setup([
      reportLine(revenueAccount, 0, 300),
      reportLine(expenseAccount, 125, 0),
    ]);

    const result = await service.incomeStatement(tenantId, {
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });

    expect(result.totalRevenue).toBe('300.00');
    expect(result.totalExpenses).toBe('125.00');
    expect(result.netProfitOrLoss).toBe('175.00');
  });

  it('calculates balance sheet assets against liabilities and equity', async () => {
    const { service } = setup([
      reportLine(assetAccount, 500, 0),
      reportLine(liabilityAccount, 0, 200),
      reportLine(equityAccount, 0, 300),
    ]);

    const result = await service.balanceSheet(tenantId, {
      asOfDate: '2026-07-31',
    });

    expect(result.totalAssets).toBe('500.00');
    expect(result.totalLiabilities).toBe('200.00');
    expect(result.totalEquity).toBe('300.00');
    expect(result.imbalanceAmount).toBe('0.00');
  });

  it('lets reversal journals offset reversed originals naturally', async () => {
    const { service } = setup([
      reportLine(assetAccount, 100, 0, { status: JournalStatus.REVERSED }),
      reportLine(assetAccount, 0, 100, { status: JournalStatus.POSTED }),
    ]);

    const result = await service.generalLedger(tenantId, {
      accountId: assetAccount.id,
    });

    expect(result.totalDebit).toBe('100.00');
    expect(result.totalCredit).toBe('100.00');
    expect(result.closingBalance).toBe('0.00');
  });

  it('scopes report line queries by tenant and date filters', async () => {
    const { prisma, service } = setup([]);

    await service.generalLedger(tenantId, {
      accountId: assetAccount.id,
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      costCentreId: '90efba6b-e238-4703-8ce8-3b4d27c347ba',
      subledgerId: '9c16ad19-5cf0-42cc-8a61-8ec7b6de2842',
      currency: 'GHS',
    });

    expect(prisma.journalLine.findMany).toHaveBeenCalled();
    const findManyMock = prisma.journalLine.findMany as jest.Mock<
      Promise<unknown[]>,
      [FindManyCall]
    >;
    const firstCall = findManyMock.mock.calls[0]?.[0];
    expect(firstCall?.where).toMatchObject({
      tenantId,
      glAccountId: assetAccount.id,
      costCentreId: '90efba6b-e238-4703-8ce8-3b4d27c347ba',
      subledgerAccountId: '9c16ad19-5cf0-42cc-8a61-8ec7b6de2842',
      journalEntry: {
        tenantId,
        transactionCurrency: 'GHS',
      },
    });
  });
});
