import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
  RecordStatus,
  SubledgerType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAccountClassificationDto,
  CreateAccountGroupDto,
  CreateAccountingCustomerDto,
  CreateAccountingCurrencyDto,
  CreateAccountingVendorDto,
  CreateCostCentreDto,
  CreateExchangeRateDto,
  CreateFiscalPeriodDto,
  CreateGLAccountDto,
  CreateSubledgerAccountDto,
  EnsureInternalSubledgerDto,
  QueryAccountingPartiesDto,
  QueryAccountGroupsDto,
  QueryAccountHierarchyDto,
  QueryFiscalPeriodsDto,
  QueryGLAccountsDto,
  QuerySubledgerAccountsDto,
  UpdateAccountClassificationDto,
  UpdateAccountGroupDto,
  UpdateAccountingCustomerDto,
  UpdateAccountingCurrencyDto,
  UpdateAccountingTenantConfigDto,
  UpdateAccountingVendorDto,
  UpdateCostCentreDto,
  UpdateExchangeRateDto,
  UpdateGLAccountDto,
  UpdateSubledgerAccountDto,
} from './dto/accounting.dto';

export enum FinancialStatement {
  BALANCE_SHEET = 'BALANCE_SHEET',
  INCOME_STATEMENT = 'INCOME_STATEMENT',
}

const ACCOUNT_CATEGORIES = [
  {
    code: GLAccountCategory.ASSET,
    name: 'Assets',
    normalBalance: NormalBalance.DEBIT,
    financialStatement: FinancialStatement.BALANCE_SHEET,
    displayOrder: 10,
  },
  {
    code: GLAccountCategory.LIABILITY,
    name: 'Liabilities',
    normalBalance: NormalBalance.CREDIT,
    financialStatement: FinancialStatement.BALANCE_SHEET,
    displayOrder: 20,
  },
  {
    code: GLAccountCategory.EQUITY,
    name: 'Equity',
    normalBalance: NormalBalance.CREDIT,
    financialStatement: FinancialStatement.BALANCE_SHEET,
    displayOrder: 30,
  },
  {
    code: GLAccountCategory.REVENUE,
    name: 'Revenue',
    normalBalance: NormalBalance.CREDIT,
    financialStatement: FinancialStatement.INCOME_STATEMENT,
    displayOrder: 40,
  },
  {
    code: GLAccountCategory.EXPENSE,
    name: 'Expenses',
    normalBalance: NormalBalance.DEBIT,
    financialStatement: FinancialStatement.INCOME_STATEMENT,
    displayOrder: 50,
  },
] as const;

const NORMAL_BALANCE_BY_CATEGORY: Record<GLAccountCategory, NormalBalance> = {
  [GLAccountCategory.ASSET]: NormalBalance.DEBIT,
  [GLAccountCategory.LIABILITY]: NormalBalance.CREDIT,
  [GLAccountCategory.EQUITY]: NormalBalance.CREDIT,
  [GLAccountCategory.REVENUE]: NormalBalance.CREDIT,
  [GLAccountCategory.EXPENSE]: NormalBalance.DEBIT,
};

const STANDARD_ACCOUNT_HIERARCHY = [
  {
    code: 'CURRENT_ASSETS',
    name: 'Current Assets',
    category: GLAccountCategory.ASSET,
    displayOrder: 10,
    groups: [
      { code: 'CASH_AND_BANK', name: 'Cash and Bank', displayOrder: 10 },
      { code: 'RECEIVABLES', name: 'Receivables', displayOrder: 20 },
      {
        code: 'ACCOUNTS_RECEIVABLE',
        name: 'Accounts Receivable',
        displayOrder: 25,
      },
      {
        code: 'OTHER_CURRENT_ASSETS',
        name: 'Other Current Assets',
        displayOrder: 30,
      },
    ],
  },
  {
    code: 'NON_CURRENT_ASSETS',
    name: 'Non-current Assets',
    category: GLAccountCategory.ASSET,
    displayOrder: 20,
    groups: [
      {
        code: 'PROPERTY_AND_EQUIPMENT',
        name: 'Property and Equipment',
        displayOrder: 10,
      },
      {
        code: 'OTHER_NON_CURRENT_ASSETS',
        name: 'Other Non-current Assets',
        displayOrder: 20,
      },
    ],
  },
  {
    code: 'CURRENT_LIABILITIES',
    name: 'Current Liabilities',
    category: GLAccountCategory.LIABILITY,
    displayOrder: 30,
    groups: [
      { code: 'PAYABLES', name: 'Payables', displayOrder: 10 },
      {
        code: 'ACCOUNTS_PAYABLE',
        name: 'Accounts Payable',
        displayOrder: 15,
      },
      {
        code: 'TAX_AND_STATUTORY',
        name: 'Tax and Statutory Liabilities',
        displayOrder: 20,
      },
      {
        code: 'OTHER_CURRENT_LIABILITIES',
        name: 'Other Current Liabilities',
        displayOrder: 30,
      },
    ],
  },
  {
    code: 'NON_CURRENT_LIABILITIES',
    name: 'Non-current Liabilities',
    category: GLAccountCategory.LIABILITY,
    displayOrder: 35,
    groups: [
      {
        code: 'LONG_TERM_BORROWINGS',
        name: 'Long-term Borrowings',
        displayOrder: 10,
      },
      {
        code: 'OTHER_NON_CURRENT_LIABILITIES',
        name: 'Other Non-current Liabilities',
        displayOrder: 20,
      },
    ],
  },
  {
    code: 'EQUITY_CAPITAL',
    name: 'Equity and Capital',
    category: GLAccountCategory.EQUITY,
    displayOrder: 40,
    groups: [
      { code: 'CAPITAL_ACCOUNTS', name: 'Capital Accounts', displayOrder: 10 },
      {
        code: 'RETAINED_EARNINGS',
        name: 'Retained Earnings',
        displayOrder: 20,
      },
    ],
  },
  {
    code: 'OPERATING_REVENUE',
    name: 'Operating Revenue',
    category: GLAccountCategory.REVENUE,
    displayOrder: 50,
    groups: [
      { code: 'SERVICE_REVENUE', name: 'Service Revenue', displayOrder: 10 },
      { code: 'OTHER_INCOME', name: 'Other Income', displayOrder: 20 },
    ],
  },
  {
    code: 'NON_OPERATING_REVENUE',
    name: 'Non-operating Revenue',
    category: GLAccountCategory.REVENUE,
    displayOrder: 55,
    groups: [
      {
        code: 'INVESTMENT_INCOME',
        name: 'Investment Income',
        displayOrder: 10,
      },
      {
        code: 'OTHER_NON_OPERATING_INCOME',
        name: 'Other Non-operating Income',
        displayOrder: 20,
      },
    ],
  },
  {
    code: 'OPERATING_EXPENSES',
    name: 'Operating Expenses',
    category: GLAccountCategory.EXPENSE,
    displayOrder: 60,
    groups: [
      { code: 'COST_OF_SALES', name: 'Cost of Sales', displayOrder: 5 },
      { code: 'PAYROLL_EXPENSES', name: 'Payroll Expenses', displayOrder: 10 },
      {
        code: 'ADMIN_EXPENSES',
        name: 'Administrative Expenses',
        displayOrder: 20,
      },
      { code: 'FINANCE_COSTS', name: 'Finance Costs', displayOrder: 30 },
      { code: 'TAX_EXPENSE', name: 'Tax Expense', displayOrder: 40 },
      {
        code: 'NON_OPERATING_EXPENSES',
        name: 'Non-operating Expenses',
        displayOrder: 50,
      },
    ],
  },
] as const;

@Injectable()
export class AccountingMasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  listAccountCategories() {
    return ACCOUNT_CATEGORIES;
  }

  async getConfig(tenantId: string) {
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId },
      include: {
        accountsReceivableControlAccount: {
          select: { id: true, code: true, name: true, category: true },
        },
        accountsPayableControlAccount: {
          select: { id: true, code: true, name: true, category: true },
        },
      },
    });
    return (
      config ?? {
        tenantId,
        baseCurrency: null,
        fiscalYearStartMonth: 1,
        decimalPlaces: 2,
        accountsReceivableControlAccountId: null,
        accountsPayableControlAccountId: null,
        accountsReceivableControlAccount: null,
        accountsPayableControlAccount: null,
        isConfigured: false,
        createdAt: null,
        updatedAt: null,
      }
    );
  }

  async updateConfig(user: RequestUser, dto: UpdateAccountingTenantConfigDto) {
    if (dto.baseCurrency) {
      await this.assertActiveCurrency(user.tenantId, dto.baseCurrency);
    }
    if (dto.accountsReceivableControlAccountId) {
      await this.assertControlAccount(
        user.tenantId,
        dto.accountsReceivableControlAccountId,
        GLAccountCategory.ASSET,
        'Accounts receivable control account',
      );
    }
    if (dto.accountsPayableControlAccountId) {
      await this.assertControlAccount(
        user.tenantId,
        dto.accountsPayableControlAccountId,
        GLAccountCategory.LIABILITY,
        'Accounts payable control account',
      );
    }

    const existing = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (
      existing &&
      dto.baseCurrency &&
      dto.baseCurrency !== existing.baseCurrency
    ) {
      const journalCount = await this.prisma.journalEntry.count({
        where: { tenantId: user.tenantId },
      });
      if (journalCount > 0) {
        throw new ConflictException(
          'Base currency cannot change after journals have been created',
        );
      }
    }
    const baseCurrency = dto.baseCurrency ?? existing?.baseCurrency;
    if (!baseCurrency) {
      throw new BadRequestException(
        'baseCurrency is required when configuring Accounting for the first time',
      );
    }

    return this.prisma.accountingTenantConfig.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        baseCurrency,
        fiscalYearStartMonth: dto.fiscalYearStartMonth ?? 1,
        decimalPlaces: dto.decimalPlaces ?? 2,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      update: {
        ...(dto.baseCurrency ? { baseCurrency: dto.baseCurrency } : {}),
        ...(dto.fiscalYearStartMonth
          ? { fiscalYearStartMonth: dto.fiscalYearStartMonth }
          : {}),
        ...(dto.decimalPlaces !== undefined
          ? { decimalPlaces: dto.decimalPlaces }
          : {}),
        ...(dto.accountsReceivableControlAccountId !== undefined
          ? {
              accountsReceivableControlAccountId:
                dto.accountsReceivableControlAccountId,
            }
          : {}),
        ...(dto.accountsPayableControlAccountId !== undefined
          ? {
              accountsPayableControlAccountId:
                dto.accountsPayableControlAccountId,
            }
          : {}),
        updatedByUserId: user.id,
      },
    });
  }

  listCurrencies(tenantId: string) {
    return this.prisma.accountingCurrency.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async createCurrency(user: RequestUser, dto: CreateAccountingCurrencyDto) {
    try {
      return await this.prisma.accountingCurrency.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          symbol: this.optional(dto.symbol),
          decimalPlaces: dto.decimalPlaces ?? 2,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Currency code already exists');
    }
  }

  async updateCurrency(
    user: RequestUser,
    currencyId: string,
    dto: UpdateAccountingCurrencyDto,
  ) {
    const currency = await this.findCurrency(user.tenantId, currencyId);
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    const isBase = config?.baseCurrency === currency.code;
    if (isBase && dto.isActive === false) {
      throw new ConflictException(
        'The configured base currency cannot be deactivated',
      );
    }
    if (isBase && dto.code && dto.code !== currency.code) {
      throw new ConflictException(
        'Change the tenant base currency before renaming this currency',
      );
    }

    try {
      return await this.prisma.accountingCurrency.update({
        where: {
          id_tenantId: { id: currency.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.symbol !== undefined
            ? { symbol: this.optional(dto.symbol) }
            : {}),
          ...(dto.decimalPlaces !== undefined
            ? { decimalPlaces: dto.decimalPlaces }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Currency code already exists');
    }
  }

  listExchangeRates(tenantId: string) {
    return this.prisma.exchangeRate.findMany({
      where: { tenantId },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  async createExchangeRate(user: RequestUser, dto: CreateExchangeRateDto) {
    if (dto.fromCurrency === dto.toCurrency) {
      throw new BadRequestException(
        'Exchange rate currencies must be different',
      );
    }
    await Promise.all([
      this.assertActiveCurrency(user.tenantId, dto.fromCurrency),
      this.assertActiveCurrency(user.tenantId, dto.toCurrency),
    ]);

    try {
      return await this.prisma.exchangeRate.create({
        data: {
          tenantId: user.tenantId,
          fromCurrency: dto.fromCurrency,
          toCurrency: dto.toCurrency,
          rate: dto.rate,
          effectiveAt: new Date(dto.effectiveAt),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(
        error,
        'An exchange rate already exists for this currency pair and effective date',
      );
    }
  }

  async updateExchangeRate(
    user: RequestUser,
    rateId: string,
    dto: UpdateExchangeRateDto,
  ) {
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { id: rateId, tenantId: user.tenantId },
    });
    if (!rate) throw new NotFoundException('Exchange rate not found');

    try {
      return await this.prisma.exchangeRate.update({
        where: {
          id_tenantId: { id: rate.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
          ...(dto.effectiveAt
            ? { effectiveAt: new Date(dto.effectiveAt) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(
        error,
        'An exchange rate already exists for this currency pair and effective date',
      );
    }
  }

  listFiscalPeriods(tenantId: string, query: QueryFiscalPeriodsDto) {
    return this.prisma.fiscalPeriod.findMany({
      where: { tenantId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { startDate: 'desc' },
    });
  }

  async createFiscalPeriod(user: RequestUser, dto: CreateFiscalPeriodDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException(
        'Fiscal period endDate must follow startDate',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${'accounting-period:' + user.tenantId})
        )
      `;
      const overlap = await tx.fiscalPeriod.findFirst({
        where: {
          tenantId: user.tenantId,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true, name: true },
      });
      if (overlap) {
        throw new ConflictException(
          `Fiscal period overlaps with ${overlap.name}`,
        );
      }

      try {
        return await tx.fiscalPeriod.create({
          data: {
            tenantId: user.tenantId,
            name: dto.name,
            startDate,
            endDate,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
      } catch (error) {
        this.rethrowUnique(error, 'Fiscal period name already exists');
      }
    });
  }

  async changeFiscalPeriodStatus(
    user: RequestUser,
    periodId: string,
    nextStatus: FiscalPeriodStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockFiscalPeriod(tx, user.tenantId, periodId);
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, tenantId: user.tenantId },
      });
      if (!period) throw new NotFoundException('Fiscal period not found');
      if (period.status === nextStatus) return period;
      if (period.status === FiscalPeriodStatus.LOCKED) {
        throw new ConflictException('Locked fiscal periods are immutable');
      }

      const requiredCurrentStatus =
        nextStatus === FiscalPeriodStatus.OPEN
          ? FiscalPeriodStatus.CLOSED
          : nextStatus === FiscalPeriodStatus.CLOSED
            ? FiscalPeriodStatus.OPEN
            : FiscalPeriodStatus.CLOSED;
      if (period.status !== requiredCurrentStatus) {
        const message =
          nextStatus === FiscalPeriodStatus.OPEN
            ? 'Only a closed fiscal period can be reopened'
            : nextStatus === FiscalPeriodStatus.CLOSED
              ? 'Only an open fiscal period can be closed'
              : 'Only a closed fiscal period can be locked';
        throw new BadRequestException(message);
      }

      const changed = await tx.fiscalPeriod.updateMany({
        where: {
          id: period.id,
          tenantId: user.tenantId,
          status: requiredCurrentStatus,
        },
        data: {
          status: nextStatus,
          ...(nextStatus === FiscalPeriodStatus.OPEN
            ? {
                closedAt: null,
                closedByUserId: null,
              }
            : {}),
          ...(nextStatus === FiscalPeriodStatus.CLOSED
            ? {
                closedAt: new Date(),
                closedByUserId: user.id,
              }
            : {}),
          ...(nextStatus === FiscalPeriodStatus.LOCKED
            ? {
                lockedAt: new Date(),
                lockedByUserId: user.id,
              }
            : {}),
          updatedByUserId: user.id,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Fiscal period was changed by another request',
        );
      }
      return tx.fiscalPeriod.findUniqueOrThrow({
        where: {
          id_tenantId: { id: period.id, tenantId: user.tenantId },
        },
      });
    });
  }

  listGLAccounts(tenantId: string, query: QueryGLAccountsDto) {
    return this.prisma.gLAccount
      .findMany({
        where: {
          tenantId,
          ...(query.category ? { category: query.category } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.accountGroupId
            ? { accountGroupId: query.accountGroupId }
            : {}),
          ...(query.classificationId
            ? { accountGroup: { classificationId: query.classificationId } }
            : {}),
        },
        include: {
          parentAccount: { select: { id: true, code: true, name: true } },
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
      })
      .then((accounts) =>
        accounts.map((account) => this.withAccountHierarchy(account)),
      );
  }

  async createGLAccount(user: RequestUser, dto: CreateGLAccountDto) {
    const hierarchy = await this.resolveAccountHierarchyForCreate(
      user.tenantId,
      dto,
    );
    await this.assertParentAccount(
      user.tenantId,
      undefined,
      dto.parentAccountId,
      hierarchy.category,
      dto.accountGroupId ?? null,
    );
    try {
      const account = await this.prisma.gLAccount.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          category: hierarchy.category,
          normalBalance: hierarchy.normalBalance,
          accountGroupId: dto.accountGroupId,
          parentAccountId: dto.parentAccountId,
          allowPosting: dto.allowPosting ?? true,
          description: this.optional(dto.description),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: this.glAccountHierarchyInclude(),
      });
      await this.recordAudit(
        user,
        'GL_ACCOUNT_CREATE',
        'GLAccount',
        account.id,
        {
          code: account.code,
          accountGroupId: account.accountGroupId,
        },
      );
      return this.withAccountHierarchy(account);
    } catch (error) {
      this.rethrowUnique(error, 'GL account code already exists');
    }
  }

  async updateGLAccount(
    user: RequestUser,
    accountId: string,
    dto: UpdateGLAccountDto,
  ) {
    const account = await this.findGLAccount(user.tenantId, accountId);
    const hierarchy = await this.resolveAccountHierarchyForUpdate(
      user.tenantId,
      account,
      dto,
    );
    const nextCategory = hierarchy.category;
    const nextAccountGroupId =
      dto.accountGroupId !== undefined
        ? dto.accountGroupId || null
        : account.accountGroupId;
    await this.assertParentAccount(
      user.tenantId,
      account.id,
      dto.parentAccountId ?? account.parentAccountId ?? undefined,
      nextCategory,
      nextAccountGroupId,
    );
    if (dto.allowPosting === true) {
      const childCount = await this.prisma.gLAccount.count({
        where: { tenantId: user.tenantId, parentAccountId: account.id },
      });
      if (childCount > 0) {
        throw new ConflictException(
          'Summary accounts with child accounts cannot accept postings',
        );
      }
    }

    const changesStructure =
      (dto.code !== undefined && dto.code !== account.code) ||
      (dto.category !== undefined && dto.category !== account.category) ||
      (dto.normalBalance !== undefined &&
        dto.normalBalance !== account.normalBalance) ||
      (dto.accountGroupId !== undefined &&
        dto.accountGroupId !== account.accountGroupId) ||
      (dto.parentAccountId !== undefined &&
        dto.parentAccountId !== account.parentAccountId);
    if (changesStructure) {
      const postedUse = await this.prisma.journalLine.count({
        where: {
          tenantId: user.tenantId,
          glAccountId: account.id,
          journalEntry: { status: { in: ['POSTED', 'REVERSED'] } },
        },
      });
      if (postedUse > 0) {
        throw new ConflictException(
          'Posted GL accounts cannot change code, category, normal balance, account group or parent',
        );
      }
    }

    try {
      const updated = await this.prisma.gLAccount.update({
        where: {
          id_tenantId: { id: account.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          category: hierarchy.category,
          normalBalance: hierarchy.normalBalance,
          ...(dto.accountGroupId !== undefined
            ? { accountGroupId: dto.accountGroupId || null }
            : {}),
          ...(dto.parentAccountId !== undefined
            ? { parentAccountId: dto.parentAccountId || null }
            : {}),
          ...(dto.allowPosting !== undefined
            ? { allowPosting: dto.allowPosting }
            : {}),
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          updatedByUserId: user.id,
        },
        include: this.glAccountHierarchyInclude(),
      });
      if (changesStructure) {
        await this.recordAudit(
          user,
          'GL_ACCOUNT_HIERARCHY_UPDATE',
          'GLAccount',
          updated.id,
          {
            accountGroupId: updated.accountGroupId,
            parentAccountId: updated.parentAccountId,
            category: updated.category,
            normalBalance: updated.normalBalance,
          },
        );
      }
      return this.withAccountHierarchy(updated);
    } catch (error) {
      this.rethrowUnique(error, 'GL account code already exists');
    }
  }

  async listAccountClassifications(
    tenantId: string,
    query: QueryAccountHierarchyDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.AccountClassificationWhereInput = {
      tenantId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = {
      [query.sortBy ?? 'displayOrder']: query.sortOrder ?? 'asc',
    } as Prisma.AccountClassificationOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountClassification.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountClassification.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createAccountClassification(
    user: RequestUser,
    dto: CreateAccountClassificationDto,
  ) {
    try {
      const classification = await this.prisma.accountClassification.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          category: dto.category,
          displayOrder: dto.displayOrder ?? 0,
          isSystemTemplate: dto.isSystemTemplate ?? false,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_CLASSIFICATION_CREATE',
        'AccountClassification',
        classification.id,
        { code: classification.code, category: classification.category },
      );
      return classification;
    } catch (error) {
      this.rethrowUnique(error, 'Account classification code already exists');
    }
  }

  async getAccountClassification(user: RequestUser, classificationId: string) {
    return this.findAccountClassification(user.tenantId, classificationId);
  }

  async updateAccountClassification(
    user: RequestUser,
    classificationId: string,
    dto: UpdateAccountClassificationDto,
  ) {
    const classification = await this.findAccountClassification(
      user.tenantId,
      classificationId,
    );
    if (dto.category && dto.category !== classification.category) {
      const dependentCount = await this.prisma.accountGroup.count({
        where: { tenantId: user.tenantId, classificationId },
      });
      if (dependentCount > 0) {
        throw new ConflictException(
          'Classification category cannot change after groups or accounts are linked',
        );
      }
    }
    try {
      const updated = await this.prisma.accountClassification.update({
        where: {
          id_tenantId: { id: classification.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.category ? { category: dto.category } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          ...(dto.isSystemTemplate !== undefined
            ? { isSystemTemplate: dto.isSystemTemplate }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_CLASSIFICATION_UPDATE',
        'AccountClassification',
        updated.id,
        dto,
      );
      return updated;
    } catch (error) {
      this.rethrowUnique(error, 'Account classification code already exists');
    }
  }

  async activateAccountClassification(
    user: RequestUser,
    classificationId: string,
  ) {
    return this.setAccountClassificationActive(
      user,
      classificationId,
      true,
      'ACCOUNT_CLASSIFICATION_ACTIVATE',
    );
  }

  async deactivateAccountClassification(
    user: RequestUser,
    classificationId: string,
  ) {
    return this.setAccountClassificationActive(
      user,
      classificationId,
      false,
      'ACCOUNT_CLASSIFICATION_DEACTIVATE',
    );
  }

  async listAccountGroups(tenantId: string, query: QueryAccountGroupsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.AccountGroupWhereInput = {
      tenantId,
      ...(query.classificationId
        ? { classificationId: query.classificationId }
        : {}),
      ...(query.category
        ? { classification: { category: query.category } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = {
      [query.sortBy ?? 'displayOrder']: query.sortOrder ?? 'asc',
    } as Prisma.AccountGroupOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountGroup.findMany({
        where,
        include: {
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountGroup.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createAccountGroup(user: RequestUser, dto: CreateAccountGroupDto) {
    await this.assertActiveClassification(user.tenantId, dto.classificationId);
    try {
      const group = await this.prisma.accountGroup.create({
        data: {
          tenantId: user.tenantId,
          classificationId: dto.classificationId,
          code: dto.code,
          name: dto.name,
          displayOrder: dto.displayOrder ?? 0,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: {
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_GROUP_CREATE',
        'AccountGroup',
        group.id,
        {
          code: group.code,
          classificationId: group.classificationId,
        },
      );
      return group;
    } catch (error) {
      this.rethrowUnique(error, 'Account group code already exists');
    }
  }

  async getAccountGroup(user: RequestUser, groupId: string) {
    return this.findAccountGroup(user.tenantId, groupId);
  }

  async updateAccountGroup(
    user: RequestUser,
    groupId: string,
    dto: UpdateAccountGroupDto,
  ) {
    const group = await this.findAccountGroup(user.tenantId, groupId);
    if (
      dto.classificationId &&
      dto.classificationId !== group.classificationId
    ) {
      await this.assertActiveClassification(
        user.tenantId,
        dto.classificationId,
      );
      const linkedAccounts = await this.prisma.gLAccount.count({
        where: { tenantId: user.tenantId, accountGroupId: group.id },
      });
      if (linkedAccounts > 0) {
        throw new ConflictException(
          'Account group classification cannot change after accounts are linked',
        );
      }
    }
    try {
      const updated = await this.prisma.accountGroup.update({
        where: { id_tenantId: { id: group.id, tenantId: user.tenantId } },
        data: {
          ...(dto.classificationId
            ? { classificationId: dto.classificationId }
            : {}),
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
        include: {
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_GROUP_UPDATE',
        'AccountGroup',
        updated.id,
        dto,
      );
      return updated;
    } catch (error) {
      this.rethrowUnique(error, 'Account group code already exists');
    }
  }

  async activateAccountGroup(user: RequestUser, groupId: string) {
    return this.setAccountGroupActive(
      user,
      groupId,
      true,
      'ACCOUNT_GROUP_ACTIVATE',
    );
  }

  async deactivateAccountGroup(user: RequestUser, groupId: string) {
    return this.setAccountGroupActive(
      user,
      groupId,
      false,
      'ACCOUNT_GROUP_DEACTIVATE',
    );
  }

  async seedStandardAccountHierarchy(user: RequestUser) {
    let classificationsCreated = 0;
    let classificationsSkipped = 0;
    let groupsCreated = 0;
    let groupsSkipped = 0;

    for (const template of STANDARD_ACCOUNT_HIERARCHY) {
      const classificationResult = await this.findOrCreateSeedClassification(
        user,
        template,
      );
      const classification = classificationResult.classification;
      if (classificationResult.created) {
        classificationsCreated += 1;
        await this.recordAudit(
          user,
          'ACCOUNT_CLASSIFICATION_SEED',
          'AccountClassification',
          classification.id,
          { code: classification.code, category: classification.category },
        );
      } else {
        classificationsSkipped += 1;
      }

      for (const groupTemplate of template.groups) {
        const groupResult = await this.findOrCreateSeedGroup(
          user,
          classification.id,
          groupTemplate,
        );
        if (groupResult.created) {
          groupsCreated += 1;
          await this.recordAudit(
            user,
            'ACCOUNT_GROUP_SEED',
            'AccountGroup',
            groupResult.group.id,
            {
              code: groupResult.group.code,
              classificationId: groupResult.group.classificationId,
            },
          );
        } else {
          groupsSkipped += 1;
        }
      }
    }

    return {
      classificationsCreated,
      classificationsSkipped,
      groupsCreated,
      groupsSkipped,
    };
  }

  private async setAccountClassificationActive(
    user: RequestUser,
    classificationId: string,
    isActive: boolean,
    action: string,
  ) {
    const classification = await this.findAccountClassification(
      user.tenantId,
      classificationId,
    );
    const updated = await this.prisma.accountClassification.update({
      where: {
        id_tenantId: { id: classification.id, tenantId: user.tenantId },
      },
      data: { isActive, updatedByUserId: user.id },
    });
    await this.recordAudit(user, action, 'AccountClassification', updated.id, {
      isActive,
    });
    return updated;
  }

  private async setAccountGroupActive(
    user: RequestUser,
    groupId: string,
    isActive: boolean,
    action: string,
  ) {
    const group = await this.findAccountGroup(user.tenantId, groupId);
    const updated = await this.prisma.accountGroup.update({
      where: { id_tenantId: { id: group.id, tenantId: user.tenantId } },
      data: { isActive, updatedByUserId: user.id },
      include: {
        classification: {
          select: { id: true, code: true, name: true, category: true },
        },
      },
    });
    await this.recordAudit(user, action, 'AccountGroup', updated.id, {
      isActive,
    });
    return updated;
  }

  private async findOrCreateSeedClassification(
    user: RequestUser,
    template: (typeof STANDARD_ACCOUNT_HIERARCHY)[number],
  ) {
    const existing = await this.prisma.accountClassification.findUnique({
      where: {
        tenantId_code: { tenantId: user.tenantId, code: template.code },
      },
    });
    if (existing) return { classification: existing, created: false };

    try {
      const classification = await this.prisma.accountClassification.create({
        data: {
          tenantId: user.tenantId,
          code: template.code,
          name: template.name,
          category: template.category,
          displayOrder: template.displayOrder,
          isSystemTemplate: true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      return { classification, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const classification =
          await this.prisma.accountClassification.findUniqueOrThrow({
            where: {
              tenantId_code: {
                tenantId: user.tenantId,
                code: template.code,
              },
            },
          });
        return { classification, created: false };
      }
      throw error;
    }
  }

  private async findOrCreateSeedGroup(
    user: RequestUser,
    classificationId: string,
    groupTemplate: (typeof STANDARD_ACCOUNT_HIERARCHY)[number]['groups'][number],
  ) {
    const existing = await this.prisma.accountGroup.findUnique({
      where: {
        tenantId_code: { tenantId: user.tenantId, code: groupTemplate.code },
      },
    });
    if (existing) return { group: existing, created: false };

    try {
      const group = await this.prisma.accountGroup.create({
        data: {
          tenantId: user.tenantId,
          classificationId,
          code: groupTemplate.code,
          name: groupTemplate.name,
          displayOrder: groupTemplate.displayOrder,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      return { group, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const group = await this.prisma.accountGroup.findUniqueOrThrow({
          where: {
            tenantId_code: {
              tenantId: user.tenantId,
              code: groupTemplate.code,
            },
          },
        });
        return { group, created: false };
      }
      throw error;
    }
  }

  async deactivateGLAccount(user: RequestUser, accountId: string) {
    const account = await this.findGLAccount(user.tenantId, accountId);
    const activeChildren = await this.prisma.gLAccount.count({
      where: {
        tenantId: user.tenantId,
        parentAccountId: account.id,
        status: RecordStatus.ACTIVE,
      },
    });
    if (activeChildren > 0) {
      throw new ConflictException(
        'Deactivate child accounts before deactivating this account',
      );
    }
    const updated = await this.prisma.gLAccount.update({
      where: {
        id_tenantId: { id: account.id, tenantId: user.tenantId },
      },
      data: {
        status: RecordStatus.INACTIVE,
        allowPosting: false,
        updatedByUserId: user.id,
      },
    });
    await this.recordAudit(
      user,
      'GL_ACCOUNT_DEACTIVATE',
      'GLAccount',
      updated.id,
      { status: updated.status, allowPosting: updated.allowPosting },
    );
    return updated;
  }

  listCostCentres(tenantId: string) {
    return this.prisma.costCentre.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async createCostCentre(user: RequestUser, dto: CreateCostCentreDto) {
    try {
      return await this.prisma.costCentre.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          description: this.optional(dto.description),
          externalRef: this.optional(dto.externalRef),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Cost centre code already exists');
    }
  }

  async updateCostCentre(
    user: RequestUser,
    costCentreId: string,
    dto: UpdateCostCentreDto,
  ) {
    const costCentre = await this.findCostCentre(user.tenantId, costCentreId);
    try {
      return await this.prisma.costCentre.update({
        where: {
          id_tenantId: { id: costCentre.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          ...(dto.externalRef !== undefined
            ? { externalRef: this.optional(dto.externalRef) }
            : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Cost centre code already exists');
    }
  }

  async deactivateCostCentre(user: RequestUser, costCentreId: string) {
    const costCentre = await this.findCostCentre(user.tenantId, costCentreId);
    return this.prisma.costCentre.update({
      where: {
        id_tenantId: { id: costCentre.id, tenantId: user.tenantId },
      },
      data: { status: RecordStatus.INACTIVE, updatedByUserId: user.id },
    });
  }

  async listSubledgerAccounts(
    tenantId: string,
    query: QuerySubledgerAccountsDto = {},
  ) {
    const items = await this.prisma.subledgerAccount.findMany({
      where: {
        tenantId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.externalRef ? { externalRef: query.externalRef } : {}),
        ...(query.controlAccountId
          ? { controlAccountId: query.controlAccountId }
          : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        controlAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            normalBalance: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });
    const balances = await this.calculateSubledgerDimensionBalances(
      tenantId,
      items.map((item) => ({
        subledgerAccountId: item.id,
        controlAccountId: item.controlAccountId,
        normalBalance: item.controlAccount.normalBalance,
      })),
    );
    return items.map((item) => ({
      ...item,
      balance: balances.get(item.id) ?? this.emptyBalance(),
    }));
  }

  async createSubledgerAccount(
    user: RequestUser,
    dto: CreateSubledgerAccountDto,
  ) {
    await this.assertControlAccount(user.tenantId, dto.controlAccountId);
    if (dto.currency) {
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    }
    try {
      return await this.prisma.subledgerAccount.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          externalRef: this.optional(dto.externalRef),
          controlAccountId: dto.controlAccountId,
          currency: dto.currency,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Subledger account already exists');
    }
  }

  async updateSubledgerAccount(
    user: RequestUser,
    subledgerId: string,
    dto: UpdateSubledgerAccountDto,
  ) {
    const subledger = await this.findSubledger(user.tenantId, subledgerId);
    if (dto.controlAccountId) {
      await this.assertControlAccount(user.tenantId, dto.controlAccountId);
    }
    if (dto.currency) {
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    }
    try {
      return await this.prisma.subledgerAccount.update({
        where: {
          id_tenantId: { id: subledger.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.type ? { type: dto.type } : {}),
          ...(dto.externalRef !== undefined
            ? { externalRef: this.optional(dto.externalRef) }
            : {}),
          ...(dto.controlAccountId
            ? { controlAccountId: dto.controlAccountId }
            : {}),
          ...(dto.currency !== undefined
            ? { currency: dto.currency || null }
            : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Subledger account already exists');
    }
  }

  async deactivateSubledgerAccount(user: RequestUser, subledgerId: string) {
    const subledger = await this.findSubledger(user.tenantId, subledgerId);
    return this.prisma.subledgerAccount.update({
      where: {
        id_tenantId: { id: subledger.id, tenantId: user.tenantId },
      },
      data: { status: RecordStatus.INACTIVE, updatedByUserId: user.id },
    });
  }

  async ensureInternalInsuranceSubledger(
    callingService: string,
    dto: EnsureInternalSubledgerDto,
  ) {
    const externalRef = this.requiredExternalRef(dto.externalRef);
    const name = this.requiredName(dto.name);
    const config = await this.getConfiguredControlAccounts(dto.tenantId);
    const controlAccountId =
      dto.type === SubledgerType.CEDANT
        ? config.accountsReceivableControlAccountId
        : config.accountsPayableControlAccountId;
    if (!controlAccountId) {
      throw new BadRequestException(
        dto.type === SubledgerType.CEDANT
          ? 'Configure an accounts receivable control account before syncing Cedant subledgers'
          : 'Configure an accounts payable control account before syncing Reinsurer subledgers',
      );
    }

    const existing = await this.prisma.subledgerAccount.findFirst({
      where: {
        tenantId: dto.tenantId,
        type: dto.type,
        externalRef,
        controlAccountId,
      },
      include: {
        controlAccount: { select: { id: true, code: true, name: true } },
      },
    });

    if (existing) {
      if (existing.status !== RecordStatus.ACTIVE) {
        throw new ConflictException(
          `${dto.type} subledger is inactive and must be reactivated in Accounting before source-module posting can use it`,
        );
      }
      if (
        dto.currency &&
        existing.currency &&
        existing.currency !== dto.currency
      ) {
        throw new ConflictException(
          `${dto.type} subledger currency does not match the source counterparty currency`,
        );
      }
      return this.prisma.subledgerAccount.update({
        where: {
          id_tenantId: { id: existing.id, tenantId: dto.tenantId },
        },
        data: {
          name,
          ...(dto.currency && !existing.currency
            ? { currency: dto.currency }
            : {}),
          updatedByUserId: this.internalActor(callingService),
        },
        include: {
          controlAccount: { select: { id: true, code: true, name: true } },
        },
      });
    }

    await this.assertControlAccount(
      dto.tenantId,
      controlAccountId,
      dto.type === SubledgerType.CEDANT
        ? GLAccountCategory.ASSET
        : GLAccountCategory.LIABILITY,
      dto.type === SubledgerType.CEDANT
        ? 'Cedant receivable control account'
        : 'Reinsurer payable control account',
    );
    if (dto.currency) {
      await this.assertActiveCurrency(dto.tenantId, dto.currency);
    }

    try {
      return await this.prisma.subledgerAccount.create({
        data: {
          tenantId: dto.tenantId,
          code: this.integrationSubledgerCode(dto.type, externalRef),
          name,
          type: dto.type,
          externalRef,
          controlAccountId,
          currency: dto.currency,
          createdByUserId: this.internalActor(callingService),
          updatedByUserId: this.internalActor(callingService),
        },
        include: {
          controlAccount: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Subledger account already exists');
    }
  }

  async listCustomers(tenantId: string, query: QueryAccountingPartiesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = this.buildCustomerWhere(query);
    const orderBy = {
      [query.sortBy ?? 'code']: query.sortOrder ?? 'asc',
    } as Prisma.AccountingCustomerOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountingCustomer.findMany({
        where: { tenantId, ...where },
        include: {
          subledgerAccount: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingCustomer.count({
        where: { tenantId, ...where },
      }),
    ]);
    const balances = await this.calculateSubledgerBalances(
      tenantId,
      items.map((customer) => customer.subledgerAccountId),
      NormalBalance.DEBIT,
    );
    return {
      items: items.map((customer) => ({
        ...customer,
        balance:
          balances.get(customer.subledgerAccountId) ?? this.emptyBalance(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createCustomer(user: RequestUser, dto: CreateAccountingCustomerDto) {
    await this.assertActiveCurrency(user.tenantId, dto.currency);
    const config = await this.getConfiguredControlAccounts(user.tenantId);
    if (!config.accountsReceivableControlAccountId) {
      throw new BadRequestException(
        'Configure an accounts receivable control account before creating customers',
      );
    }

    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const subledger = await tx.subledgerAccount.create({
          data: {
            tenantId: user.tenantId,
            code: dto.code,
            name: dto.legalName,
            type: SubledgerType.CUSTOMER,
            externalRef: this.optional(dto.externalRef),
            controlAccountId: config.accountsReceivableControlAccountId!,
            currency: dto.currency,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
        return tx.accountingCustomer.create({
          data: {
            tenantId: user.tenantId,
            code: dto.code,
            legalName: dto.legalName,
            tradingName: this.optional(dto.tradingName),
            primaryContactName: this.optional(dto.primaryContactName),
            email: this.optional(dto.email),
            phone: this.optional(dto.phone),
            billingAddress: this.optional(dto.billingAddress),
            countryCode: this.optional(dto.countryCode),
            currency: dto.currency,
            paymentTermsDays: dto.paymentTermsDays ?? 30,
            creditLimit:
              dto.creditLimit !== undefined
                ? new Prisma.Decimal(dto.creditLimit)
                : undefined,
            taxNumber: this.optional(dto.taxNumber),
            externalRef: this.optional(dto.externalRef),
            sourceModule: this.optional(dto.sourceModule),
            subledgerAccountId: subledger.id,
            notes: this.optional(dto.notes),
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          include: {
            subledgerAccount: {
              select: { id: true, code: true, name: true, status: true },
            },
          },
        });
      });
      return this.withCustomerBalance(customer);
    } catch (error) {
      this.rethrowUnique(
        error,
        'Customer code or external reference already exists',
      );
    }
  }

  async getCustomer(user: RequestUser, customerId: string) {
    const customer = await this.findCustomer(user.tenantId, customerId);
    return this.withCustomerBalance(customer);
  }

  async updateCustomer(
    user: RequestUser,
    customerId: string,
    dto: UpdateAccountingCustomerDto,
  ) {
    const customer = await this.findCustomer(user.tenantId, customerId);
    if (dto.currency) {
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (
          dto.code !== undefined ||
          dto.legalName !== undefined ||
          dto.externalRef !== undefined ||
          dto.currency !== undefined ||
          dto.isActive !== undefined
        ) {
          await tx.subledgerAccount.update({
            where: {
              id_tenantId: {
                id: customer.subledgerAccountId,
                tenantId: user.tenantId,
              },
            },
            data: {
              ...(dto.code ? { code: dto.code } : {}),
              ...(dto.legalName ? { name: dto.legalName } : {}),
              ...(dto.externalRef !== undefined
                ? { externalRef: this.optional(dto.externalRef) }
                : {}),
              ...(dto.currency ? { currency: dto.currency } : {}),
              ...(dto.isActive !== undefined
                ? {
                    status: dto.isActive
                      ? RecordStatus.ACTIVE
                      : RecordStatus.INACTIVE,
                  }
                : {}),
              updatedByUserId: user.id,
            },
          });
        }
        return tx.accountingCustomer.update({
          where: {
            id_tenantId: { id: customer.id, tenantId: user.tenantId },
          },
          data: this.customerUpdateData(dto, user.id),
          include: {
            subledgerAccount: {
              select: { id: true, code: true, name: true, status: true },
            },
          },
        });
      });
      return this.withCustomerBalance(updated);
    } catch (error) {
      this.rethrowUnique(
        error,
        'Customer code or external reference already exists',
      );
    }
  }

  async deactivateCustomer(user: RequestUser, customerId: string) {
    return this.updateCustomer(user, customerId, { isActive: false });
  }

  async activateCustomer(user: RequestUser, customerId: string) {
    return this.updateCustomer(user, customerId, { isActive: true });
  }

  async listVendors(tenantId: string, query: QueryAccountingPartiesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = this.buildVendorWhere(query);
    const orderBy = {
      [query.sortBy ?? 'code']: query.sortOrder ?? 'asc',
    } as Prisma.AccountingVendorOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountingVendor.findMany({
        where: { tenantId, ...where },
        include: {
          subledgerAccount: {
            select: { id: true, code: true, name: true, status: true },
          },
          defaultExpenseAccount: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingVendor.count({
        where: { tenantId, ...where },
      }),
    ]);
    const balances = await this.calculateSubledgerBalances(
      tenantId,
      items.map((vendor) => vendor.subledgerAccountId),
      NormalBalance.CREDIT,
    );
    return {
      items: items.map((vendor) => ({
        ...vendor,
        balance: balances.get(vendor.subledgerAccountId) ?? this.emptyBalance(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createVendor(user: RequestUser, dto: CreateAccountingVendorDto) {
    await this.assertActiveCurrency(user.tenantId, dto.currency);
    const config = await this.getConfiguredControlAccounts(user.tenantId);
    if (!config.accountsPayableControlAccountId) {
      throw new BadRequestException(
        'Configure an accounts payable control account before creating vendors',
      );
    }
    if (dto.defaultExpenseAccountId) {
      await this.assertPostingAccount(
        user.tenantId,
        dto.defaultExpenseAccountId,
        GLAccountCategory.EXPENSE,
        'Default expense account',
      );
    }

    try {
      const vendor = await this.prisma.$transaction(async (tx) => {
        const subledger = await tx.subledgerAccount.create({
          data: {
            tenantId: user.tenantId,
            code: dto.code,
            name: dto.legalName,
            type: SubledgerType.VENDOR,
            externalRef: this.optional(dto.externalRef),
            controlAccountId: config.accountsPayableControlAccountId!,
            currency: dto.currency,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
        return tx.accountingVendor.create({
          data: {
            tenantId: user.tenantId,
            code: dto.code,
            legalName: dto.legalName,
            tradingName: this.optional(dto.tradingName),
            primaryContactName: this.optional(dto.primaryContactName),
            email: this.optional(dto.email),
            phone: this.optional(dto.phone),
            billingAddress: this.optional(dto.billingAddress),
            countryCode: this.optional(dto.countryCode),
            currency: dto.currency,
            paymentTermsDays: dto.paymentTermsDays ?? 30,
            taxNumber: this.optional(dto.taxNumber),
            externalRef: this.optional(dto.externalRef),
            sourceModule: this.optional(dto.sourceModule),
            subledgerAccountId: subledger.id,
            defaultExpenseAccountId:
              dto.defaultExpenseAccountId === undefined
                ? undefined
                : dto.defaultExpenseAccountId || null,
            notes: this.optional(dto.notes),
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          include: {
            subledgerAccount: {
              select: { id: true, code: true, name: true, status: true },
            },
            defaultExpenseAccount: {
              select: { id: true, code: true, name: true },
            },
          },
        });
      });
      return this.withVendorBalance(vendor);
    } catch (error) {
      this.rethrowUnique(
        error,
        'Vendor code or external reference already exists',
      );
    }
  }

  async getVendor(user: RequestUser, vendorId: string) {
    const vendor = await this.findVendor(user.tenantId, vendorId);
    return this.withVendorBalance(vendor);
  }

  async updateVendor(
    user: RequestUser,
    vendorId: string,
    dto: UpdateAccountingVendorDto,
  ) {
    const vendor = await this.findVendor(user.tenantId, vendorId);
    if (dto.currency) {
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    }
    if (dto.defaultExpenseAccountId) {
      await this.assertPostingAccount(
        user.tenantId,
        dto.defaultExpenseAccountId,
        GLAccountCategory.EXPENSE,
        'Default expense account',
      );
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (
          dto.code !== undefined ||
          dto.legalName !== undefined ||
          dto.externalRef !== undefined ||
          dto.currency !== undefined ||
          dto.isActive !== undefined
        ) {
          await tx.subledgerAccount.update({
            where: {
              id_tenantId: {
                id: vendor.subledgerAccountId,
                tenantId: user.tenantId,
              },
            },
            data: {
              ...(dto.code ? { code: dto.code } : {}),
              ...(dto.legalName ? { name: dto.legalName } : {}),
              ...(dto.externalRef !== undefined
                ? { externalRef: this.optional(dto.externalRef) }
                : {}),
              ...(dto.currency ? { currency: dto.currency } : {}),
              ...(dto.isActive !== undefined
                ? {
                    status: dto.isActive
                      ? RecordStatus.ACTIVE
                      : RecordStatus.INACTIVE,
                  }
                : {}),
              updatedByUserId: user.id,
            },
          });
        }
        return tx.accountingVendor.update({
          where: {
            id_tenantId: { id: vendor.id, tenantId: user.tenantId },
          },
          data: this.vendorUpdateData(dto, user.id),
          include: {
            subledgerAccount: {
              select: { id: true, code: true, name: true, status: true },
            },
            defaultExpenseAccount: {
              select: { id: true, code: true, name: true },
            },
          },
        });
      });
      return this.withVendorBalance(updated);
    } catch (error) {
      this.rethrowUnique(
        error,
        'Vendor code or external reference already exists',
      );
    }
  }

  async deactivateVendor(user: RequestUser, vendorId: string) {
    return this.updateVendor(user, vendorId, { isActive: false });
  }

  async activateVendor(user: RequestUser, vendorId: string) {
    return this.updateVendor(user, vendorId, { isActive: true });
  }

  async findFiscalPeriod(tenantId: string, id: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    return period;
  }

  async findGLAccount(tenantId: string, id: string) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id, tenantId },
    });
    if (!account) throw new NotFoundException('GL account not found');
    return account;
  }

  private glAccountHierarchyInclude() {
    return {
      parentAccount: { select: { id: true, code: true, name: true } },
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
    } as const;
  }

  private withAccountHierarchy<
    T extends {
      category: GLAccountCategory;
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
    },
  >(account: T) {
    const classification = account.accountGroup?.classification ?? null;
    const accountGroup = account.accountGroup
      ? {
          id: account.accountGroup.id,
          code: account.accountGroup.code,
          name: account.accountGroup.name,
        }
      : null;
    const unclassified = {
      id: null,
      code: 'UNCLASSIFIED',
      name: 'Unclassified',
      category: account.category,
    };
    return {
      ...account,
      classification: classification ?? unclassified,
      accountGroup,
      hierarchyPath: [
        account.category,
        classification?.name ?? 'Unclassified',
        accountGroup?.name ?? 'Unclassified',
        'name' in account ? account.name : undefined,
      ].filter(Boolean),
      isLegacyUnclassified: !account.accountGroup,
    };
  }

  private async findAccountClassification(tenantId: string, id: string) {
    const classification = await this.prisma.accountClassification.findFirst({
      where: { id, tenantId },
    });
    if (!classification) {
      throw new NotFoundException('Account classification not found');
    }
    return classification;
  }

  private async findAccountGroup(tenantId: string, id: string) {
    const group = await this.prisma.accountGroup.findFirst({
      where: { id, tenantId },
      include: {
        classification: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            isActive: true,
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Account group not found');
    return group;
  }

  private async assertActiveClassification(
    tenantId: string,
    classificationId: string,
  ) {
    const classification = await this.findAccountClassification(
      tenantId,
      classificationId,
    );
    if (!classification.isActive) {
      throw new BadRequestException('Account classification must be active');
    }
    return classification;
  }

  private async assertActiveAccountGroup(tenantId: string, groupId: string) {
    const group = await this.findAccountGroup(tenantId, groupId);
    if (!group.isActive) {
      throw new BadRequestException('Account group must be active');
    }
    if (!group.classification.isActive) {
      throw new BadRequestException(
        'Account group classification must be active',
      );
    }
    return group;
  }

  private async resolveAccountHierarchyForCreate(
    tenantId: string,
    dto: CreateGLAccountDto,
  ) {
    if (dto.accountGroupId) {
      const group = await this.assertActiveAccountGroup(
        tenantId,
        dto.accountGroupId,
      );
      const category = group.classification.category;
      const normalBalance = NORMAL_BALANCE_BY_CATEGORY[category];
      if (dto.category && dto.category !== category) {
        throw new BadRequestException(
          'GL account category must match the selected account group classification',
        );
      }
      if (dto.normalBalance && dto.normalBalance !== normalBalance) {
        throw new BadRequestException(
          'GL account normal balance must match the selected account group category',
        );
      }
      return { category, normalBalance };
    }

    if (!dto.category) {
      throw new BadRequestException(
        'GL account category is required when accountGroupId is not provided',
      );
    }
    const normalBalance = NORMAL_BALANCE_BY_CATEGORY[dto.category];
    if (dto.normalBalance && dto.normalBalance !== normalBalance) {
      throw new BadRequestException(
        'GL account normal balance must match the account category',
      );
    }
    return { category: dto.category, normalBalance };
  }

  private async resolveAccountHierarchyForUpdate(
    tenantId: string,
    account: {
      category: GLAccountCategory;
      normalBalance: NormalBalance;
      accountGroupId: string | null;
    },
    dto: UpdateGLAccountDto,
  ) {
    if (dto.accountGroupId !== undefined && dto.accountGroupId) {
      const group = await this.assertActiveAccountGroup(
        tenantId,
        dto.accountGroupId,
      );
      const category = group.classification.category;
      const normalBalance = NORMAL_BALANCE_BY_CATEGORY[category];
      if (dto.category && dto.category !== category) {
        throw new BadRequestException(
          'GL account category must match the selected account group classification',
        );
      }
      if (dto.normalBalance && dto.normalBalance !== normalBalance) {
        throw new BadRequestException(
          'GL account normal balance must match the selected account group category',
        );
      }
      return { category, normalBalance };
    }

    if (account.accountGroupId && dto.accountGroupId === undefined) {
      if (dto.category && dto.category !== account.category) {
        throw new BadRequestException(
          'Clear accountGroupId before overriding a grouped GL account category',
        );
      }
      if (dto.normalBalance && dto.normalBalance !== account.normalBalance) {
        throw new BadRequestException(
          'Clear accountGroupId before overriding a grouped GL account normal balance',
        );
      }
      return {
        category: account.category,
        normalBalance: account.normalBalance,
      };
    }

    const category = dto.category ?? account.category;
    const normalBalance = NORMAL_BALANCE_BY_CATEGORY[category];
    if (dto.normalBalance && dto.normalBalance !== normalBalance) {
      throw new BadRequestException(
        'GL account normal balance must match the account category',
      );
    }
    return { category, normalBalance };
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
    changedFields?: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType,
        entityId,
        changedFields: this.jsonSafe(changedFields),
      },
    });
  }

  private jsonSafe(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private async findCurrency(tenantId: string, id: string) {
    const currency = await this.prisma.accountingCurrency.findFirst({
      where: { id, tenantId },
    });
    if (!currency) throw new NotFoundException('Accounting currency not found');
    return currency;
  }

  private async findCostCentre(tenantId: string, id: string) {
    const costCentre = await this.prisma.costCentre.findFirst({
      where: { id, tenantId },
    });
    if (!costCentre) throw new NotFoundException('Cost centre not found');
    return costCentre;
  }

  private async findSubledger(tenantId: string, id: string) {
    const subledger = await this.prisma.subledgerAccount.findFirst({
      where: { id, tenantId },
    });
    if (!subledger) throw new NotFoundException('Subledger account not found');
    return subledger;
  }

  private findCustomer(tenantId: string, id: string) {
    return this.prisma.accountingCustomer
      .findFirst({
        where: { id, tenantId },
        include: {
          subledgerAccount: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
      })
      .then((customer) => {
        if (!customer) throw new NotFoundException('Customer not found');
        return customer;
      });
  }

  private findVendor(tenantId: string, id: string) {
    return this.prisma.accountingVendor
      .findFirst({
        where: { id, tenantId },
        include: {
          subledgerAccount: {
            select: { id: true, code: true, name: true, status: true },
          },
          defaultExpenseAccount: {
            select: { id: true, code: true, name: true },
          },
        },
      })
      .then((vendor) => {
        if (!vendor) throw new NotFoundException('Vendor not found');
        return vendor;
      });
  }

  private async assertActiveCurrency(tenantId: string, code: string) {
    const currency = await this.prisma.accountingCurrency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!currency || !currency.isActive) {
      throw new BadRequestException(
        `Active accounting currency ${code} not found`,
      );
    }
    return currency;
  }

  private async assertParentAccount(
    tenantId: string,
    accountId: string | undefined,
    parentAccountId: string | undefined,
    category: GLAccountCategory,
    accountGroupId: string | null,
  ) {
    if (!parentAccountId) return;
    if (accountId === parentAccountId) {
      throw new BadRequestException('A GL account cannot be its own parent');
    }
    const parent = await this.prisma.gLAccount.findFirst({
      where: { id: parentAccountId, tenantId },
    });
    if (!parent) throw new NotFoundException('Parent GL account not found');
    if (parent.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException('Parent GL account must be active');
    }
    if (parent.category !== category) {
      throw new BadRequestException(
        'Parent and child GL accounts must use the same category',
      );
    }
    if ((parent.accountGroupId ?? null) !== accountGroupId) {
      throw new BadRequestException(
        'Parent and child GL accounts must use the same account group',
      );
    }
    let ancestorId = parent.parentAccountId;
    while (ancestorId) {
      if (ancestorId === accountId) {
        throw new BadRequestException(
          'GL account hierarchy cannot contain cycles',
        );
      }
      const ancestor = await this.prisma.gLAccount.findFirst({
        where: { id: ancestorId, tenantId },
        select: { parentAccountId: true },
      });
      ancestorId = ancestor?.parentAccountId ?? null;
    }
  }

  private async assertControlAccount(
    tenantId: string,
    accountId: string,
    category?: GLAccountCategory,
    label = 'Subledger control account',
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        status: RecordStatus.ACTIVE,
        allowPosting: true,
      },
    });
    if (!account) {
      throw new BadRequestException(
        `${label} must be active and posting-enabled`,
      );
    }
    if (category && account.category !== category) {
      throw new BadRequestException(`${label} must be a ${category} account`);
    }
    const childCount = await this.prisma.gLAccount.count({
      where: { tenantId, parentAccountId: account.id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Summary accounts cannot be used as ${label.toLowerCase()}`,
      );
    }
    return account;
  }

  private async assertPostingAccount(
    tenantId: string,
    accountId: string,
    category: GLAccountCategory,
    label: string,
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        status: RecordStatus.ACTIVE,
        allowPosting: true,
      },
    });
    if (!account) {
      throw new BadRequestException(
        `${label} must be active and posting-enabled`,
      );
    }
    if (account.category !== category) {
      throw new BadRequestException(`${label} must be a ${category} account`);
    }
    return account;
  }

  private async getConfiguredControlAccounts(tenantId: string) {
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId },
      select: {
        accountsReceivableControlAccountId: true,
        accountsPayableControlAccountId: true,
      },
    });
    if (!config) {
      throw new BadRequestException(
        'Configure Accounting before creating customer or vendor master records',
      );
    }
    return config;
  }

  private buildCustomerWhere(
    query: QueryAccountingPartiesDto,
  ): Prisma.AccountingCustomerWhereInput {
    return {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
      ...(query.externalRef ? { externalRef: query.externalRef } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { tradingName: { contains: query.search, mode: 'insensitive' } },
              {
                primaryContactName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildVendorWhere(
    query: QueryAccountingPartiesDto,
  ): Prisma.AccountingVendorWhereInput {
    return {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
      ...(query.externalRef ? { externalRef: query.externalRef } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { tradingName: { contains: query.search, mode: 'insensitive' } },
              {
                primaryContactName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private customerUpdateData(
    dto: UpdateAccountingCustomerDto,
    userId: string,
  ): Prisma.AccountingCustomerUpdateInput {
    return {
      ...(dto.code ? { code: dto.code } : {}),
      ...(dto.legalName ? { legalName: dto.legalName } : {}),
      ...(dto.tradingName !== undefined
        ? { tradingName: this.optional(dto.tradingName) }
        : {}),
      ...(dto.primaryContactName !== undefined
        ? { primaryContactName: this.optional(dto.primaryContactName) }
        : {}),
      ...(dto.email !== undefined ? { email: this.optional(dto.email) } : {}),
      ...(dto.phone !== undefined ? { phone: this.optional(dto.phone) } : {}),
      ...(dto.billingAddress !== undefined
        ? { billingAddress: this.optional(dto.billingAddress) }
        : {}),
      ...(dto.countryCode !== undefined
        ? { countryCode: this.optional(dto.countryCode) }
        : {}),
      ...(dto.currency ? { currency: dto.currency } : {}),
      ...(dto.paymentTermsDays !== undefined
        ? { paymentTermsDays: dto.paymentTermsDays }
        : {}),
      ...(dto.creditLimit !== undefined
        ? { creditLimit: new Prisma.Decimal(dto.creditLimit) }
        : {}),
      ...(dto.taxNumber !== undefined
        ? { taxNumber: this.optional(dto.taxNumber) }
        : {}),
      ...(dto.externalRef !== undefined
        ? { externalRef: this.optional(dto.externalRef) }
        : {}),
      ...(dto.sourceModule !== undefined
        ? { sourceModule: this.optional(dto.sourceModule) }
        : {}),
      ...(dto.notes !== undefined ? { notes: this.optional(dto.notes) } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      updatedByUserId: userId,
    };
  }

  private vendorUpdateData(
    dto: UpdateAccountingVendorDto,
    userId: string,
  ): Prisma.AccountingVendorUpdateInput {
    return {
      ...(dto.code ? { code: dto.code } : {}),
      ...(dto.legalName ? { legalName: dto.legalName } : {}),
      ...(dto.tradingName !== undefined
        ? { tradingName: this.optional(dto.tradingName) }
        : {}),
      ...(dto.primaryContactName !== undefined
        ? { primaryContactName: this.optional(dto.primaryContactName) }
        : {}),
      ...(dto.email !== undefined ? { email: this.optional(dto.email) } : {}),
      ...(dto.phone !== undefined ? { phone: this.optional(dto.phone) } : {}),
      ...(dto.billingAddress !== undefined
        ? { billingAddress: this.optional(dto.billingAddress) }
        : {}),
      ...(dto.countryCode !== undefined
        ? { countryCode: this.optional(dto.countryCode) }
        : {}),
      ...(dto.currency ? { currency: dto.currency } : {}),
      ...(dto.paymentTermsDays !== undefined
        ? { paymentTermsDays: dto.paymentTermsDays }
        : {}),
      ...(dto.taxNumber !== undefined
        ? { taxNumber: this.optional(dto.taxNumber) }
        : {}),
      ...(dto.externalRef !== undefined
        ? { externalRef: this.optional(dto.externalRef) }
        : {}),
      ...(dto.sourceModule !== undefined
        ? { sourceModule: this.optional(dto.sourceModule) }
        : {}),
      ...(dto.defaultExpenseAccountId !== undefined
        ? { defaultExpenseAccountId: dto.defaultExpenseAccountId || null }
        : {}),
      ...(dto.notes !== undefined ? { notes: this.optional(dto.notes) } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      updatedByUserId: userId,
    };
  }

  private async withCustomerBalance<
    T extends { tenantId: string; subledgerAccountId: string },
  >(customer: T) {
    const balance = await this.calculateSubledgerBalance(
      customer.tenantId,
      customer.subledgerAccountId,
      NormalBalance.DEBIT,
    );
    return { ...customer, balance };
  }

  private async withVendorBalance<
    T extends { tenantId: string; subledgerAccountId: string },
  >(vendor: T) {
    const balance = await this.calculateSubledgerBalance(
      vendor.tenantId,
      vendor.subledgerAccountId,
      NormalBalance.CREDIT,
    );
    return { ...vendor, balance };
  }

  private async calculateSubledgerBalance(
    tenantId: string,
    subledgerAccountId: string,
    normalBalance: NormalBalance,
  ) {
    return (
      (
        await this.calculateSubledgerBalances(
          tenantId,
          [subledgerAccountId],
          normalBalance,
        )
      ).get(subledgerAccountId) ?? this.emptyBalance()
    );
  }

  private async calculateSubledgerBalances(
    tenantId: string,
    subledgerAccountIds: string[],
    normalBalance: NormalBalance,
  ) {
    const uniqueSubledgerIds = Array.from(new Set(subledgerAccountIds));
    if (uniqueSubledgerIds.length === 0) {
      return new Map<string, ReturnType<typeof this.emptyBalance>>();
    }
    const subledgers = await this.prisma.subledgerAccount.findMany({
      where: { tenantId, id: { in: uniqueSubledgerIds } },
      select: { id: true, controlAccountId: true },
    });
    return this.calculateSubledgerDimensionBalances(
      tenantId,
      subledgers.map((subledger) => ({
        subledgerAccountId: subledger.id,
        controlAccountId: subledger.controlAccountId,
        normalBalance,
      })),
    );
  }

  private async calculateSubledgerDimensionBalances(
    tenantId: string,
    dimensions: Array<{
      subledgerAccountId: string;
      controlAccountId: string;
      normalBalance: NormalBalance;
    }>,
  ) {
    const uniqueDimensions = Array.from(
      new Map(
        dimensions.map((dimension) => [
          dimension.subledgerAccountId,
          dimension,
        ]),
      ).values(),
    );
    if (uniqueDimensions.length === 0) {
      return new Map<string, ReturnType<typeof this.emptyBalance>>();
    }
    const uniqueSubledgerIds = uniqueDimensions.map(
      (dimension) => dimension.subledgerAccountId,
    );
    const dimensionBySubledger = new Map(
      uniqueDimensions.map((dimension) => [
        dimension.subledgerAccountId,
        dimension,
      ]),
    );
    const lines = await this.prisma.journalLine.findMany({
      where: {
        tenantId,
        subledgerAccountId: { in: uniqueSubledgerIds },
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
        },
      },
      select: {
        glAccountId: true,
        subledgerAccountId: true,
        transactionDebit: true,
        transactionCredit: true,
        baseDebit: true,
        baseCredit: true,
        journalEntry: {
          select: { transactionCurrency: true, baseCurrency: true },
        },
      },
    });
    const totalsBySubledger = new Map<
      string,
      {
        baseDebit: number;
        baseCredit: number;
        transactionDebit: number;
        transactionCredit: number;
        currencies: Set<string>;
      }
    >();
    for (const id of uniqueSubledgerIds) {
      totalsBySubledger.set(id, {
        baseDebit: 0,
        baseCredit: 0,
        transactionDebit: 0,
        transactionCredit: 0,
        currencies: new Set<string>(),
      });
    }

    for (const line of lines) {
      if (!line.subledgerAccountId) continue;
      const dimension = dimensionBySubledger.get(line.subledgerAccountId);
      if (!dimension || dimension.controlAccountId !== line.glAccountId) {
        continue;
      }
      const totals =
        totalsBySubledger.get(line.subledgerAccountId) ?? this.emptyTotals();
      totals.baseDebit += Number(line.baseDebit);
      totals.baseCredit += Number(line.baseCredit);
      totals.transactionDebit += Number(line.transactionDebit);
      totals.transactionCredit += Number(line.transactionCredit);
      totals.currencies.add(line.journalEntry.transactionCurrency);
      totalsBySubledger.set(line.subledgerAccountId, totals);
    }

    const balances = new Map<string, ReturnType<typeof this.emptyBalance>>();
    for (const [subledgerId, totals] of totalsBySubledger) {
      const dimension = dimensionBySubledger.get(subledgerId);
      const isDebitNormal = dimension?.normalBalance === NormalBalance.DEBIT;
      balances.set(subledgerId, {
        baseDebit: totals.baseDebit,
        baseCredit: totals.baseCredit,
        baseBalance: isDebitNormal
          ? totals.baseDebit - totals.baseCredit
          : totals.baseCredit - totals.baseDebit,
        transactionDebit: totals.transactionDebit,
        transactionCredit: totals.transactionCredit,
        transactionBalance: isDebitNormal
          ? totals.transactionDebit - totals.transactionCredit
          : totals.transactionCredit - totals.transactionDebit,
        transactionCurrencies: Array.from(totals.currencies).sort(),
      });
    }
    return balances;
  }

  private emptyTotals() {
    return {
      baseDebit: 0,
      baseCredit: 0,
      transactionDebit: 0,
      transactionCredit: 0,
      currencies: new Set<string>(),
    };
  }

  private emptyBalance() {
    return {
      baseDebit: 0,
      baseCredit: 0,
      baseBalance: 0,
      transactionDebit: 0,
      transactionCredit: 0,
      transactionBalance: 0,
      transactionCurrencies: [] as string[],
    };
  }

  private async lockFiscalPeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    periodId: string,
  ) {
    await tx.$executeRaw`
      SELECT "id"
      FROM "accounting"."FiscalPeriod"
      WHERE "id" = ${periodId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
  }

  private optional(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value.trim() || null;
  }

  private integrationSubledgerCode(
    type: SubledgerType,
    externalRef: string,
  ): string {
    const prefix = type === SubledgerType.CEDANT ? 'CED' : 'REI';
    const digest = createHash('sha1').update(externalRef).digest('hex');
    return `${prefix}-${digest.slice(0, 12).toUpperCase()}`;
  }

  private internalActor(callingService: string): string {
    return `service:${callingService.slice(0, 80)}`;
  }

  private requiredExternalRef(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      throw new BadRequestException('externalRef is required');
    }
    return trimmedValue;
  }

  private requiredName(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      throw new BadRequestException('name is required');
    }
    return trimmedValue;
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
