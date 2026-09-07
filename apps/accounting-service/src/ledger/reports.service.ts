import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BalanceSheetReportQueryDto,
  GeneralLedgerReportQueryDto,
  IncomeStatementReportQueryDto,
  TrialBalanceReportQueryDto,
} from './dto/accounting-reports.dto';

const reportLineInclude = {
  journalEntry: {
    select: {
      id: true,
      journalNumber: true,
      status: true,
      transactionDate: true,
      postingDate: true,
      description: true,
      reference: true,
      transactionCurrency: true,
      sourceModule: true,
      sourceRecordId: true,
    },
  },
  glAccount: {
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      normalBalance: true,
      accountGroup: {
        select: {
          id: true,
          code: true,
          name: true,
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      },
    },
  },
  subledgerAccount: { select: { id: true, code: true, name: true } },
  costCentre: { select: { id: true, code: true, name: true } },
} satisfies Prisma.JournalLineInclude;

const reportJournalStatuses = [JournalStatus.POSTED, JournalStatus.REVERSED];
const zero = new Prisma.Decimal(0);

type ReportLine = Prisma.JournalLineGetPayload<{
  include: typeof reportLineInclude;
}>;

type AccountSummary = {
  id: string;
  code: string;
  name: string;
  category: GLAccountCategory;
  normalBalance?: NormalBalance;
  classification: {
    id: string | null;
    code: string;
    name: string;
    category: GLAccountCategory;
  };
  accountGroup: {
    id: string | null;
    code: string;
    name: string;
  };
  hierarchyPath: string[];
  isLegacyUnclassified: boolean;
};

type AccountGroupRow = {
  account: AccountSummary;
  debitBalance: string;
  creditBalance: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generalLedger(tenantId: string, query: GeneralLedgerReportQueryDto) {
    const period = query.fiscalPeriodId
      ? await this.findFiscalPeriod(tenantId, query.fiscalPeriodId)
      : undefined;
    const fromDate = query.fromDate
      ? this.startOfDay(query.fromDate)
      : period?.startDate;
    const toDate = query.toDate ? this.endOfDay(query.toDate) : period?.endDate;

    const lines = await this.findReportLines(tenantId, {
      accountId: query.accountId,
      costCentreId: query.costCentreId,
      subledgerId: query.subledgerId,
      currency: query.currency,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate,
      toDate,
    });
    const openingLines = fromDate
      ? await this.findReportLines(tenantId, {
          accountId: query.accountId,
          costCentreId: query.costCentreId,
          subledgerId: query.subledgerId,
          currency: query.currency,
          beforeDate: fromDate,
        })
      : [];

    const openingBalance = this.sumMovements(openingLines);
    const totalDebit = this.sum(lines, 'baseDebit');
    const totalCredit = this.sum(lines, 'baseCredit');
    const periodMovement = this.sumMovements(lines);
    let runningBalance = openingBalance;

    return {
      filters: query,
      openingBalance: this.money(openingBalance),
      totalDebit: this.money(totalDebit),
      totalCredit: this.money(totalCredit),
      closingBalance: this.money(openingBalance.plus(periodMovement)),
      lines: lines.map((line) => {
        runningBalance = runningBalance.plus(this.lineMovement(line));
        return {
          journalDate: line.journalEntry.transactionDate,
          postingDate: line.journalEntry.postingDate,
          journalNumber: line.journalEntry.journalNumber,
          journalStatus: line.journalEntry.status,
          description: line.description ?? line.journalEntry.description,
          account: this.accountSummary(line.glAccount),
          subledger: line.subledgerAccount,
          costCentre: line.costCentre,
          debit: this.money(line.baseDebit),
          credit: this.money(line.baseCredit),
          runningBalance: this.money(runningBalance),
          transactionCurrency: line.journalEntry.transactionCurrency,
          sourceModule: line.journalEntry.sourceModule,
          sourceRecordId: line.journalEntry.sourceRecordId,
        };
      }),
    };
  }

  async trialBalance(tenantId: string, query: TrialBalanceReportQueryDto) {
    const asOfDate = await this.resolveAsOfDate(tenantId, query);
    const [accounts, lines] = await Promise.all([
      this.prisma.gLAccount.findMany({
        where: { tenantId },
        include: {
          accountGroup: {
            select: {
              id: true,
              code: true,
              name: true,
              classification: {
                select: { id: true, code: true, name: true, category: true },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      }),
      this.findReportLines(tenantId, { toDate: asOfDate }),
    ]);
    const movementByAccount = this.movementByAccount(lines);
    const grouped = this.emptyAccountGroups();
    let totalDebit = zero;
    let totalCredit = zero;

    for (const account of accounts) {
      const movement = movementByAccount.get(account.id) ?? zero;
      if (!query.includeZeroBalances && movement.isZero()) continue;
      const balance = this.normalBalanceAmount(movement, account.normalBalance);
      totalDebit = totalDebit.plus(balance.debit);
      totalCredit = totalCredit.plus(balance.credit);
      grouped[account.category].push({
        account: this.accountSummary(account),
        debitBalance: this.money(balance.debit),
        creditBalance: this.money(balance.credit),
      });
    }

    return {
      asOfDate,
      accounts: grouped,
      hierarchy: this.groupRowsByHierarchy(Object.values(grouped).flat()),
      totalDebit: this.money(totalDebit),
      totalCredit: this.money(totalCredit),
      imbalanceAmount: this.money(totalDebit.minus(totalCredit)),
    };
  }

  async incomeStatement(
    tenantId: string,
    query: IncomeStatementReportQueryDto,
  ) {
    const period = query.fiscalPeriodId
      ? await this.findFiscalPeriod(tenantId, query.fiscalPeriodId)
      : undefined;
    const fromDate = this.startOfDay(query.fromDate ?? period?.startDate);
    const toDate = this.endOfDay(query.toDate ?? period?.endDate);
    if (!fromDate || !toDate) {
      throw new BadRequestException('fromDate and toDate are required');
    }

    const lines = await this.findReportLines(tenantId, {
      fromDate,
      toDate,
      fiscalPeriodId: query.fiscalPeriodId,
      costCentreId: query.costCentreId,
      categories: [GLAccountCategory.REVENUE, GLAccountCategory.EXPENSE],
    });
    const accounts = this.statementAccounts(lines);
    let totalRevenue = zero;
    let totalExpenses = zero;
    const revenueAccounts = [];
    const expenseAccounts = [];

    for (const account of accounts.values()) {
      const amount =
        account.category === GLAccountCategory.REVENUE
          ? account.credit.minus(account.debit)
          : account.debit.minus(account.credit);
      const row = {
        account: this.accountSummary(account),
        amount: this.money(amount),
      };
      if (account.category === GLAccountCategory.REVENUE) {
        totalRevenue = totalRevenue.plus(amount);
        revenueAccounts.push(row);
      } else {
        totalExpenses = totalExpenses.plus(amount);
        expenseAccounts.push(row);
      }
    }

    return {
      fromDate,
      toDate,
      revenueAccounts,
      expenseAccounts,
      hierarchy: this.groupRowsByHierarchy([
        ...revenueAccounts,
        ...expenseAccounts,
      ]),
      totalRevenue: this.money(totalRevenue),
      totalExpenses: this.money(totalExpenses),
      netProfitOrLoss: this.money(totalRevenue.minus(totalExpenses)),
    };
  }

  async balanceSheet(tenantId: string, query: BalanceSheetReportQueryDto) {
    const asOfDate = await this.resolveAsOfDate(tenantId, query);
    const lines = await this.findReportLines(tenantId, {
      toDate: asOfDate,
      categories: [
        GLAccountCategory.ASSET,
        GLAccountCategory.LIABILITY,
        GLAccountCategory.EQUITY,
      ],
    });
    const accounts = this.statementAccounts(lines);
    const assets = [];
    const liabilities = [];
    const equity = [];
    let totalAssets = zero;
    let totalLiabilities = zero;
    let totalEquity = zero;

    for (const account of accounts.values()) {
      const amount =
        account.category === GLAccountCategory.ASSET
          ? account.debit.minus(account.credit)
          : account.credit.minus(account.debit);
      if (amount.isZero()) continue;
      const row = {
        account: this.accountSummary(account),
        amount: this.money(amount),
      };
      if (account.category === GLAccountCategory.ASSET) {
        totalAssets = totalAssets.plus(amount);
        assets.push(row);
      } else if (account.category === GLAccountCategory.LIABILITY) {
        totalLiabilities = totalLiabilities.plus(amount);
        liabilities.push(row);
      } else {
        totalEquity = totalEquity.plus(amount);
        equity.push(row);
      }
    }

    return {
      asOfDate,
      assets,
      liabilities,
      equity,
      hierarchy: this.groupRowsByHierarchy([
        ...assets,
        ...liabilities,
        ...equity,
      ]),
      totalAssets: this.money(totalAssets),
      totalLiabilities: this.money(totalLiabilities),
      totalEquity: this.money(totalEquity),
      imbalanceAmount: this.money(
        totalAssets.minus(totalLiabilities.plus(totalEquity)),
      ),
    };
  }

  private async findReportLines(
    tenantId: string,
    filters: {
      accountId?: string;
      fromDate?: Date;
      toDate?: Date;
      beforeDate?: Date;
      fiscalPeriodId?: string;
      costCentreId?: string;
      subledgerId?: string;
      currency?: string;
      categories?: GLAccountCategory[];
    },
  ) {
    return this.prisma.journalLine.findMany({
      where: {
        tenantId,
        ...(filters.accountId ? { glAccountId: filters.accountId } : {}),
        ...(filters.costCentreId ? { costCentreId: filters.costCentreId } : {}),
        ...(filters.subledgerId
          ? { subledgerAccountId: filters.subledgerId }
          : {}),
        ...(filters.categories
          ? { glAccount: { category: { in: filters.categories } } }
          : {}),
        journalEntry: {
          tenantId,
          status: { in: reportJournalStatuses },
          ...(filters.fiscalPeriodId
            ? { fiscalPeriodId: filters.fiscalPeriodId }
            : {}),
          ...(filters.currency
            ? { transactionCurrency: filters.currency }
            : {}),
          transactionDate: {
            ...(filters.fromDate ? { gte: filters.fromDate } : {}),
            ...(filters.toDate ? { lte: filters.toDate } : {}),
            ...(filters.beforeDate ? { lt: filters.beforeDate } : {}),
          },
        },
      },
      include: reportLineInclude,
      orderBy: [
        { journalEntry: { transactionDate: 'asc' } },
        { journalEntry: { journalNumber: 'asc' } },
        { lineNumber: 'asc' },
      ],
    });
  }

  private async findFiscalPeriod(tenantId: string, fiscalPeriodId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: fiscalPeriodId, tenantId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    return period;
  }

  private async resolveAsOfDate(
    tenantId: string,
    query: { asOfDate?: string; fiscalPeriodId?: string },
  ) {
    if (query.asOfDate) return this.endOfDay(query.asOfDate);
    if (query.fiscalPeriodId) {
      const period = await this.findFiscalPeriod(
        tenantId,
        query.fiscalPeriodId,
      );
      return period.endDate;
    }
    return new Date();
  }

  private movementByAccount(lines: ReportLine[]) {
    const map = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      const current = map.get(line.glAccountId) ?? zero;
      map.set(
        line.glAccountId,
        current.plus(line.baseDebit).minus(line.baseCredit),
      );
    }
    return map;
  }

  private statementAccounts(lines: ReportLine[]) {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        category: GLAccountCategory;
        normalBalance: NormalBalance;
        accountGroup?: {
          id: string;
          code: string;
          name: string;
          classification: {
            id: string;
            code: string;
            name: string;
            category: GLAccountCategory;
          };
        } | null;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
      }
    >();
    for (const line of lines) {
      const current = map.get(line.glAccountId) ?? {
        ...line.glAccount,
        debit: zero,
        credit: zero,
      };
      current.debit = current.debit.plus(line.baseDebit);
      current.credit = current.credit.plus(line.baseCredit);
      map.set(line.glAccountId, current);
    }
    return map;
  }

  private emptyAccountGroups(): Record<GLAccountCategory, AccountGroupRow[]> {
    return {
      [GLAccountCategory.ASSET]: [],
      [GLAccountCategory.LIABILITY]: [],
      [GLAccountCategory.EQUITY]: [],
      [GLAccountCategory.REVENUE]: [],
      [GLAccountCategory.EXPENSE]: [],
    };
  }

  private normalBalanceAmount(
    movement: Prisma.Decimal,
    normalBalance: NormalBalance,
  ) {
    const normal =
      normalBalance === NormalBalance.DEBIT ? movement : movement.negated();
    if (normal.greaterThanOrEqualTo(0)) {
      return normalBalance === NormalBalance.DEBIT
        ? { debit: normal, credit: zero }
        : { debit: zero, credit: normal };
    }
    const opposite = normal.abs();
    return normalBalance === NormalBalance.DEBIT
      ? { debit: zero, credit: opposite }
      : { debit: opposite, credit: zero };
  }

  private sum(lines: ReportLine[], field: 'baseDebit' | 'baseCredit') {
    return lines.reduce(
      (total, line) => total.plus(line[field]),
      new Prisma.Decimal(0),
    );
  }

  private sumMovements(lines: ReportLine[]) {
    return lines.reduce(
      (total, line) => total.plus(this.lineMovement(line)),
      new Prisma.Decimal(0),
    );
  }

  private lineMovement(line: ReportLine) {
    return line.glAccount.normalBalance === NormalBalance.DEBIT
      ? line.baseDebit.minus(line.baseCredit)
      : line.baseCredit.minus(line.baseDebit);
  }

  private accountSummary(account: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
    normalBalance?: NormalBalance;
    accountGroup?: {
      id: string;
      code: string;
      name: string;
      classification: {
        id: string;
        code: string;
        name: string;
        category: GLAccountCategory;
      };
    } | null;
  }) {
    const classification = account.accountGroup?.classification ?? {
      id: null,
      code: 'UNCLASSIFIED',
      name: 'Unclassified',
      category: account.category,
    };
    const accountGroup = account.accountGroup
      ? {
          id: account.accountGroup.id,
          code: account.accountGroup.code,
          name: account.accountGroup.name,
        }
      : { id: null, code: 'UNCLASSIFIED', name: 'Unclassified' };
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      category: account.category,
      ...(account.normalBalance
        ? { normalBalance: account.normalBalance }
        : {}),
      classification,
      accountGroup,
      hierarchyPath: [
        account.category,
        classification.name,
        accountGroup.name,
        account.name,
      ],
      isLegacyUnclassified: !account.accountGroup,
    };
  }

  private groupRowsByHierarchy<T extends { account: AccountSummary }>(
    rows: T[],
  ) {
    const categories = new Map<
      GLAccountCategory,
      Map<
        string,
        {
          classification: AccountSummary['classification'];
          groups: Map<
            string,
            { accountGroup: AccountSummary['accountGroup']; accounts: T[] }
          >;
        }
      >
    >();

    for (const row of rows) {
      const categoryMap =
        categories.get(row.account.category) ??
        new Map<
          string,
          {
            classification: AccountSummary['classification'];
            groups: Map<
              string,
              { accountGroup: AccountSummary['accountGroup']; accounts: T[] }
            >;
          }
        >();
      const classificationKey =
        row.account.classification.id ?? row.account.classification.code;
      const classificationEntry = categoryMap.get(classificationKey) ?? {
        classification: row.account.classification,
        groups: new Map<
          string,
          { accountGroup: AccountSummary['accountGroup']; accounts: T[] }
        >(),
      };
      const groupKey =
        row.account.accountGroup.id ?? row.account.accountGroup.code;
      const groupEntry = classificationEntry.groups.get(groupKey) ?? {
        accountGroup: row.account.accountGroup,
        accounts: [],
      };
      groupEntry.accounts.push(row);
      classificationEntry.groups.set(groupKey, groupEntry);
      categoryMap.set(classificationKey, classificationEntry);
      categories.set(row.account.category, categoryMap);
    }

    return Object.values(GLAccountCategory).map((category) => ({
      category,
      classifications: Array.from(categories.get(category)?.values() ?? []).map(
        (classificationEntry) => ({
          ...classificationEntry.classification,
          groups: Array.from(classificationEntry.groups.values()).map(
            (groupEntry) => ({
              ...groupEntry.accountGroup,
              accounts: groupEntry.accounts,
            }),
          ),
        }),
      ),
    }));
  }

  private startOfDay(value: string | Date | undefined) {
    if (!value) return undefined;
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string | Date | undefined) {
    if (!value) return undefined;
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private money(value: Prisma.Decimal | number | string) {
    return new Prisma.Decimal(value).toFixed(2);
  }
}
