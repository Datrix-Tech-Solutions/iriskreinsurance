import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  NormalBalance,
  Prisma,
  RecordStatus,
  SubledgerType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';

describe('AccountingMasterDataService', () => {
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

  function setup() {
    const prisma = {
      accountingTenantConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      accountingCurrency: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      journalEntry: {
        count: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      gLAccount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountClassification: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountGroup: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountingAuditLog: {
        create: jest.fn(),
      },
      subledgerAccount: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      accountingCustomer: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      accountingVendor: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (input: ((tx: typeof prisma) => unknown) | Array<Promise<unknown>>) => {
        if (Array.isArray(input)) return Promise.all(input);
        return input(prisma);
      },
    );
    const service = new AccountingMasterDataService(
      prisma as unknown as PrismaService,
    );
    return { prisma, service };
  }

  it('rejects locking an open fiscal period', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      tenantId: actor.tenantId,
      status: FiscalPeriodStatus.OPEN,
    });

    await expect(
      service.changeFiscalPeriodStatus(
        actor,
        'period-1',
        FiscalPeriodStatus.LOCKED,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.fiscalPeriod.updateMany).not.toHaveBeenCalled();
  });

  it('locks only a closed tenant period with an atomic scoped mutation', async () => {
    const { prisma, service } = setup();
    const closedPeriod = {
      id: 'period-1',
      tenantId: actor.tenantId,
      status: FiscalPeriodStatus.CLOSED,
    };
    prisma.fiscalPeriod.findFirst.mockResolvedValue(closedPeriod);
    prisma.fiscalPeriod.updateMany.mockResolvedValue({ count: 1 });
    prisma.fiscalPeriod.findUniqueOrThrow.mockResolvedValue({
      ...closedPeriod,
      status: FiscalPeriodStatus.LOCKED,
    });

    await service.changeFiscalPeriodStatus(
      actor,
      closedPeriod.id,
      FiscalPeriodStatus.LOCKED,
    );

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.fiscalPeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: closedPeriod.id,
          tenantId: actor.tenantId,
          status: FiscalPeriodStatus.CLOSED,
        },
      }),
    );
  });

  it('blocks base currency changes after journals exist', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'USD',
      isActive: true,
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
    });
    prisma.journalEntry.count.mockResolvedValue(1);

    await expect(
      service.updateConfig(actor, { baseCurrency: 'USD' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.accountingTenantConfig.upsert).not.toHaveBeenCalled();
  });

  it('does not allow a summary account to be re-enabled for posting', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      tenantId: actor.tenantId,
      code: '1000',
      name: 'Assets',
      category: GLAccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      parentAccountId: null,
      allowPosting: false,
      status: RecordStatus.ACTIVE,
    });
    prisma.gLAccount.count.mockResolvedValue(1);

    await expect(
      service.updateGLAccount(actor, 'account-1', { allowPosting: true }),
    ).rejects.toThrow('Summary accounts with child accounts');
    expect(prisma.gLAccount.update).not.toHaveBeenCalled();
  });

  it('lists fixed account categories with normal reporting metadata', () => {
    const { service } = setup();

    const categories = service.listAccountCategories();

    expect(categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: GLAccountCategory.ASSET,
          normalBalance: NormalBalance.DEBIT,
          financialStatement: 'BALANCE_SHEET',
        }),
        expect.objectContaining({
          code: GLAccountCategory.REVENUE,
          normalBalance: NormalBalance.CREDIT,
          financialStatement: 'INCOME_STATEMENT',
        }),
      ]),
    );
  });

  it('ensures a Cedant subledger from an internal service using the AR control account', async () => {
    const { prisma, service } = setup();
    prisma.subledgerAccount.findFirst.mockResolvedValue(null);
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      accountsReceivableControlAccountId: 'ar-control',
      accountsPayableControlAccountId: 'ap-control',
    });
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'ar-control',
      tenantId: actor.tenantId,
      category: GLAccountCategory.ASSET,
      allowPosting: true,
      status: RecordStatus.ACTIVE,
    });
    prisma.gLAccount.count.mockResolvedValue(0);
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      isActive: true,
    });
    prisma.subledgerAccount.create.mockResolvedValue({
      id: 'subledger-1',
      tenantId: actor.tenantId,
      code: 'CED-123',
      name: 'Acme Cedant',
      type: SubledgerType.CEDANT,
      externalRef: 'counterparty-1',
    });

    await service.ensureInternalInsuranceSubledger('reinsurance-service', {
      tenantId: actor.tenantId,
      type: SubledgerType.CEDANT,
      externalRef: 'counterparty-1',
      name: 'Acme Cedant',
      currency: 'GHS',
    });

    const [createArgs] = prisma.subledgerAccount.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(createArgs.data).toMatchObject({
      tenantId: actor.tenantId,
      type: SubledgerType.CEDANT,
      externalRef: 'counterparty-1',
      controlAccountId: 'ar-control',
      createdByUserId: 'service:reinsurance-service',
    });
    expect(createArgs.data.code).toEqual(
      expect.stringMatching(/^CED-[A-F0-9]{12}$/),
    );
  });

  it('updates an existing active Reinsurer subledger by type and external reference', async () => {
    const { prisma, service } = setup();
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      accountsReceivableControlAccountId: 'ar-control',
      accountsPayableControlAccountId: 'ap-control',
    });
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'subledger-1',
      tenantId: actor.tenantId,
      code: 'REI-OLD',
      name: 'Old Reinsurer',
      type: SubledgerType.REINSURER,
      externalRef: 'counterparty-1',
      currency: null,
      status: RecordStatus.ACTIVE,
    });
    prisma.subledgerAccount.update.mockResolvedValue({
      id: 'subledger-1',
      name: 'New Reinsurer',
    });

    await service.ensureInternalInsuranceSubledger('reinsurance-service', {
      tenantId: actor.tenantId,
      type: SubledgerType.REINSURER,
      externalRef: 'counterparty-1',
      name: 'New Reinsurer',
      currency: 'GHS',
    });

    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'counterparty-1',
        controlAccountId: 'ap-control',
      },
      include: {
        controlAccount: {
          select: { id: true, code: true, name: true },
        },
      },
    });
    const [updateArgs] = prisma.subledgerAccount.update.mock.calls[0] as [
      {
        where: { id_tenantId: { id: string; tenantId: string } };
        data: Record<string, unknown>;
      },
    ];
    expect(updateArgs.where).toEqual({
      id_tenantId: { id: 'subledger-1', tenantId: actor.tenantId },
    });
    expect(updateArgs.data).toMatchObject({
      name: 'New Reinsurer',
      currency: 'GHS',
      updatedByUserId: 'service:reinsurance-service',
    });
  });

  it('does not silently reactivate an inactive integrated subledger', async () => {
    const { prisma, service } = setup();
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      accountsReceivableControlAccountId: 'ar-control',
      accountsPayableControlAccountId: 'ap-control',
    });
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'subledger-1',
      tenantId: actor.tenantId,
      type: SubledgerType.CEDANT,
      externalRef: 'counterparty-1',
      status: RecordStatus.INACTIVE,
    });

    await expect(
      service.ensureInternalInsuranceSubledger('reinsurance-service', {
        tenantId: actor.tenantId,
        type: SubledgerType.CEDANT,
        externalRef: 'counterparty-1',
        name: 'Acme Cedant',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.subledgerAccount.update).not.toHaveBeenCalled();
  });

  it('keeps the same reinsurer premium payable and claims receivable balances separate by control account', async () => {
    const { prisma, service } = setup();
    prisma.subledgerAccount.findMany.mockResolvedValue([
      {
        id: 'reinsurer-premium-ap-subledger',
        tenantId: actor.tenantId,
        code: 'REI-PREMIUM',
        name: 'Reinsurer A',
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'premium-payable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'premium-payable-control',
          code: '2100',
          name: 'Premium Payables',
          category: GLAccountCategory.LIABILITY,
          normalBalance: NormalBalance.CREDIT,
        },
      },
      {
        id: 'reinsurer-claims-ar-subledger',
        tenantId: actor.tenantId,
        code: 'REI-CLAIMS',
        name: 'Reinsurer A',
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'claims-receivable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'claims-receivable-control',
          code: '1200',
          name: 'Claims Recovery Receivables',
          category: GLAccountCategory.ASSET,
          normalBalance: NormalBalance.DEBIT,
        },
      },
    ]);
    prisma.journalLine.findMany.mockResolvedValue([
      {
        glAccountId: 'premium-payable-control',
        subledgerAccountId: 'reinsurer-premium-ap-subledger',
        transactionDebit: new Prisma.Decimal(0),
        transactionCredit: new Prisma.Decimal(100),
        baseDebit: new Prisma.Decimal(0),
        baseCredit: new Prisma.Decimal(100),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
      {
        glAccountId: 'claims-receivable-control',
        subledgerAccountId: 'reinsurer-claims-ar-subledger',
        transactionDebit: new Prisma.Decimal(100),
        transactionCredit: new Prisma.Decimal(0),
        baseDebit: new Prisma.Decimal(100),
        baseCredit: new Prisma.Decimal(0),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
    ]);

    const result = await service.listSubledgerAccounts(actor.tenantId, {
      type: SubledgerType.REINSURER,
      externalRef: 'reinsurer-1',
    });

    expect(prisma.subledgerAccount.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
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
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'reinsurer-premium-ap-subledger',
      controlAccountId: 'premium-payable-control',
    });
    expect(result[0].balance).toMatchObject({
      baseBalance: 100,
      transactionBalance: 100,
    });
    expect(result[1]).toMatchObject({
      id: 'reinsurer-claims-ar-subledger',
      controlAccountId: 'claims-receivable-control',
    });
    expect(result[1].balance).toMatchObject({
      baseBalance: 100,
      transactionBalance: 100,
    });
  });

  it('keeps the same cedant premium receivable and claims payable balances separate by control account', async () => {
    const { prisma, service } = setup();
    prisma.subledgerAccount.findMany.mockResolvedValue([
      {
        id: 'cedant-premium-ar-subledger',
        tenantId: actor.tenantId,
        code: 'CED-PREMIUM',
        name: 'Cedant A',
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        controlAccountId: 'premium-receivable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'premium-receivable-control',
          code: '1100',
          name: 'Premium Receivables',
          category: GLAccountCategory.ASSET,
          normalBalance: NormalBalance.DEBIT,
        },
      },
      {
        id: 'cedant-claims-ap-subledger',
        tenantId: actor.tenantId,
        code: 'CED-CLAIMS',
        name: 'Cedant A',
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        controlAccountId: 'claims-payable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'claims-payable-control',
          code: '2200',
          name: 'Claims Payables',
          category: GLAccountCategory.LIABILITY,
          normalBalance: NormalBalance.CREDIT,
        },
      },
    ]);
    prisma.journalLine.findMany.mockResolvedValue([
      {
        glAccountId: 'premium-receivable-control',
        subledgerAccountId: 'cedant-premium-ar-subledger',
        transactionDebit: new Prisma.Decimal(250),
        transactionCredit: new Prisma.Decimal(0),
        baseDebit: new Prisma.Decimal(250),
        baseCredit: new Prisma.Decimal(0),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
      {
        glAccountId: 'claims-payable-control',
        subledgerAccountId: 'cedant-claims-ap-subledger',
        transactionDebit: new Prisma.Decimal(0),
        transactionCredit: new Prisma.Decimal(90),
        baseDebit: new Prisma.Decimal(0),
        baseCredit: new Prisma.Decimal(90),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
    ]);

    const result = await service.listSubledgerAccounts(actor.tenantId, {
      type: SubledgerType.CEDANT,
      externalRef: 'cedant-1',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'cedant-premium-ar-subledger',
      controlAccountId: 'premium-receivable-control',
    });
    expect(result[0].balance).toMatchObject({
      baseBalance: 250,
      transactionBalance: 250,
    });
    expect(result[1]).toMatchObject({
      id: 'cedant-claims-ap-subledger',
      controlAccountId: 'claims-payable-control',
    });
    expect(result[1].balance).toMatchObject({
      baseBalance: 90,
      transactionBalance: 90,
    });
  });

  it('derives GL account category and normal balance from account group', async () => {
    const { prisma, service } = setup();
    prisma.accountGroup.findFirst.mockResolvedValue({
      id: 'group-1',
      tenantId: actor.tenantId,
      code: 'BANK',
      name: 'Bank Accounts',
      isActive: true,
      classification: {
        id: 'classification-1',
        code: 'CURRENT_ASSET',
        name: 'Current Assets',
        category: GLAccountCategory.ASSET,
        isActive: true,
      },
    });
    prisma.gLAccount.create.mockResolvedValue({
      id: 'account-1',
      tenantId: actor.tenantId,
      code: '1100',
      name: 'Cash at Bank',
      category: GLAccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      accountGroupId: 'group-1',
      parentAccountId: null,
      accountGroup: {
        id: 'group-1',
        code: 'BANK',
        name: 'Bank Accounts',
        classification: {
          id: 'classification-1',
          code: 'CURRENT_ASSET',
          name: 'Current Assets',
          category: GLAccountCategory.ASSET,
        },
      },
      parentAccount: null,
    });

    const result = await service.createGLAccount(actor, {
      code: '1100',
      name: 'Cash at Bank',
      accountGroupId: 'group-1',
    });

    const createCall = (
      prisma.gLAccount.create as jest.MockedFunction<
        (args: {
          data: {
            category: GLAccountCategory;
            normalBalance: NormalBalance;
            accountGroupId: string;
          };
        }) => Promise<unknown>
      >
    ).mock.calls[0][0];
    expect(createCall.data.category).toBe(GLAccountCategory.ASSET);
    expect(createCall.data.normalBalance).toBe(NormalBalance.DEBIT);
    expect(createCall.data.accountGroupId).toBe('group-1');

    expect(result.category).toBe(GLAccountCategory.ASSET);
    expect(result.normalBalance).toBe(NormalBalance.DEBIT);
    expect(result.classification.code).toBe('CURRENT_ASSET');
    expect(result.accountGroup?.code).toBe('BANK');
    expect(result.isLegacyUnclassified).toBe(false);

    const auditCall = (
      prisma.accountingAuditLog.create as jest.MockedFunction<
        (args: {
          data: {
            action: string;
            entityType: string;
            entityId: string;
          };
        }) => Promise<unknown>
      >
    ).mock.calls[0][0];
    expect(auditCall.data.action).toBe('GL_ACCOUNT_CREATE');
    expect(auditCall.data.entityType).toBe('GLAccount');
    expect(auditCall.data.entityId).toBe('account-1');
  });

  it('keeps legacy GL accounts readable as unclassified', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        tenantId: actor.tenantId,
        code: '9999',
        name: 'Legacy Suspense',
        category: GLAccountCategory.ASSET,
        normalBalance: NormalBalance.DEBIT,
        accountGroupId: null,
        accountGroup: null,
        parentAccount: null,
      },
    ]);

    const result = await service.listGLAccounts(actor.tenantId, {});

    expect(result[0].isLegacyUnclassified).toBe(true);
    expect(result[0].classification.code).toBe('UNCLASSIFIED');
    expect(result[0].classification.name).toBe('Unclassified');
    expect(result[0].accountGroup).toBeNull();
  });

  it('seeds the standard hierarchy without overwriting existing templates', async () => {
    const { prisma, service } = setup();
    prisma.accountClassification.findUnique.mockResolvedValueOnce(null);
    prisma.accountClassification.findUnique.mockResolvedValue({
      id: 'existing-classification',
      tenantId: actor.tenantId,
      code: 'EXISTING',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountClassification.create.mockResolvedValue({
      id: 'classification-1',
      tenantId: actor.tenantId,
      code: 'CURRENT_ASSETS',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountGroup.findUnique.mockResolvedValue(null);
    prisma.accountGroup.create.mockImplementation(
      (args: { data: { code: string; classificationId: string } }) =>
        Promise.resolve({
          id: `group-${args.data.code}`,
          code: args.data.code,
          classificationId: args.data.classificationId,
        }),
    );

    const result = await service.seedStandardAccountHierarchy(actor);

    expect(result.classificationsCreated).toBe(1);
    expect(result.classificationsSkipped).toBeGreaterThan(0);
    expect(result.groupsCreated).toBeGreaterThan(0);
    const classificationCreateCall = (
      prisma.accountClassification.create as jest.MockedFunction<
        (args: {
          data: { tenantId: string; code: string; isSystemTemplate: boolean };
        }) => Promise<unknown>
      >
    ).mock.calls[0][0];
    expect(classificationCreateCall.data.tenantId).toBe(actor.tenantId);
    expect(classificationCreateCall.data.code).toBe('CURRENT_ASSETS');
    expect(classificationCreateCall.data.isSystemTemplate).toBe(true);
  });

  it('reuses seeded records created by a concurrent request', async () => {
    const { prisma, service } = setup();
    prisma.accountClassification.findUnique.mockResolvedValueOnce(null);
    prisma.accountClassification.findUnique.mockResolvedValue({
      id: 'existing-classification',
      tenantId: actor.tenantId,
      code: 'EXISTING',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountClassification.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.accountClassification.findUniqueOrThrow.mockResolvedValue({
      id: 'classification-1',
      tenantId: actor.tenantId,
      code: 'CURRENT_ASSETS',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountGroup.findUnique.mockResolvedValue({
      id: 'existing-group',
      tenantId: actor.tenantId,
      code: 'EXISTING_GROUP',
      classificationId: 'classification-1',
    });

    const result = await service.seedStandardAccountHierarchy(actor);

    expect(result.classificationsCreated).toBe(0);
    expect(result.classificationsSkipped).toBeGreaterThan(0);
    expect(result.groupsSkipped).toBeGreaterThan(0);
    expect(prisma.accountClassification.findUniqueOrThrow).toHaveBeenCalled();
  });

  it('rejects category changes on grouped accounts unless the group is cleared', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      tenantId: actor.tenantId,
      code: '1100',
      name: 'Cash at Bank',
      category: GLAccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      accountGroupId: 'group-1',
      parentAccountId: null,
      allowPosting: true,
      status: RecordStatus.ACTIVE,
    });

    await expect(
      service.updateGLAccount(actor, 'account-1', {
        category: GLAccountCategory.EXPENSE,
      }),
    ).rejects.toThrow('Clear accountGroupId');
    expect(prisma.gLAccount.update).not.toHaveBeenCalled();
  });

  it('rejects GL subaccounts whose parent is in a different account group', async () => {
    const { prisma, service } = setup();
    prisma.accountGroup.findFirst.mockResolvedValue({
      id: 'group-1',
      tenantId: actor.tenantId,
      code: 'BANK',
      isActive: true,
      classification: {
        id: 'classification-1',
        code: 'CURRENT_ASSET',
        name: 'Current Assets',
        category: GLAccountCategory.ASSET,
        isActive: true,
      },
    });
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'parent-1',
      tenantId: actor.tenantId,
      category: GLAccountCategory.ASSET,
      accountGroupId: 'group-2',
      parentAccountId: null,
      status: RecordStatus.ACTIVE,
    });

    await expect(
      service.createGLAccount(actor, {
        code: '1101',
        name: 'Ecobank Current Account',
        accountGroupId: 'group-1',
        parentAccountId: 'parent-1',
      }),
    ).rejects.toThrow('same account group');
    expect(prisma.gLAccount.create).not.toHaveBeenCalled();
  });

  it('uses the tenant composite key for currency mutations', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findFirst.mockResolvedValue({
      id: 'currency-1',
      tenantId: actor.tenantId,
      code: 'USD',
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue(null);
    prisma.accountingCurrency.update.mockResolvedValue({
      id: 'currency-1',
      code: 'USD',
    });

    await service.updateCurrency(actor, 'currency-1', {
      name: 'US Dollar',
    });

    expect(prisma.accountingCurrency.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_tenantId: {
            id: 'currency-1',
            tenantId: actor.tenantId,
          },
        },
      }),
    );
  });

  it('creates a customer with a linked customer subledger account', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      isActive: true,
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      accountsReceivableControlAccountId: 'ar-control',
      accountsPayableControlAccountId: 'ap-control',
    });
    prisma.subledgerAccount.create.mockResolvedValue({
      id: 'subledger-1',
      code: 'CUS-0001',
      type: SubledgerType.CUSTOMER,
    });
    prisma.subledgerAccount.findMany.mockResolvedValue([
      {
        id: 'subledger-1',
        controlAccountId: 'ar-control',
      },
    ]);
    prisma.accountingCustomer.create.mockResolvedValue({
      id: 'customer-1',
      tenantId: actor.tenantId,
      code: 'CUS-0001',
      legalName: 'Acme Insurance',
      currency: 'GHS',
      subledgerAccountId: 'subledger-1',
      subledgerAccount: {
        id: 'subledger-1',
        code: 'CUS-0001',
        name: 'Acme Insurance',
        status: RecordStatus.ACTIVE,
      },
    });

    const result = (await service.createCustomer(actor, {
      code: 'CUS-0001',
      legalName: 'Acme Insurance',
      currency: 'GHS',
    })) as {
      id: string;
      balance: { baseBalance: number };
    };

    const subledgerCreateMock = prisma.subledgerAccount
      .create as jest.MockedFunction<
      (args: {
        data: {
          tenantId: string;
          code: string;
          name: string;
          type: SubledgerType;
          controlAccountId: string;
        };
      }) => Promise<unknown>
    >;
    const subledgerCreateCall = subledgerCreateMock.mock.calls[0][0];
    expect(subledgerCreateCall.data).toEqual(
      expect.objectContaining({
        tenantId: actor.tenantId,
        code: 'CUS-0001',
        name: 'Acme Insurance',
        type: SubledgerType.CUSTOMER,
        controlAccountId: 'ar-control',
      }),
    );

    const customerCreateMock = prisma.accountingCustomer
      .create as jest.MockedFunction<
      (args: { data: { subledgerAccountId: string } }) => Promise<unknown>
    >;
    const customerCreateCall = customerCreateMock.mock.calls[0][0];
    expect(customerCreateCall.data.subledgerAccountId).toBe('subledger-1');
    expect(result.id).toBe('customer-1');
    expect(result.balance.baseBalance).toBe(0);
  });

  it('requires an AR control account before creating customers', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      isActive: true,
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      accountsReceivableControlAccountId: null,
    });

    await expect(
      service.createCustomer(actor, {
        code: 'CUS-0001',
        legalName: 'Acme Insurance',
        currency: 'GHS',
      }),
    ).rejects.toThrow('accounts receivable control account');
    expect(prisma.subledgerAccount.create).not.toHaveBeenCalled();
  });

  it('rejects AP control accounts that are not liability accounts', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      isActive: true,
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
    });
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'asset-control',
      tenantId: actor.tenantId,
      category: GLAccountCategory.ASSET,
      status: RecordStatus.ACTIVE,
      allowPosting: true,
    });
    prisma.gLAccount.count.mockResolvedValue(0);

    await expect(
      service.updateConfig(actor, {
        baseCurrency: 'GHS',
        accountsPayableControlAccountId: 'asset-control',
      }),
    ).rejects.toThrow('Accounts payable control account must be a LIABILITY');
    expect(prisma.accountingTenantConfig.upsert).not.toHaveBeenCalled();
  });

  it('rejects a vendor default expense account outside EXPENSE category', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      isActive: true,
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
      accountsPayableControlAccountId: 'ap-control',
    });
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'asset-account',
      tenantId: actor.tenantId,
      category: GLAccountCategory.ASSET,
      status: RecordStatus.ACTIVE,
      allowPosting: true,
    });

    await expect(
      service.createVendor(actor, {
        code: 'VEN-0001',
        legalName: 'Office Supplies Ltd',
        currency: 'GHS',
        defaultExpenseAccountId: 'asset-account',
      }),
    ).rejects.toThrow('Default expense account must be a EXPENSE account');
    expect(prisma.subledgerAccount.create).not.toHaveBeenCalled();
  });

  it('deactivates a customer and its linked subledger without deleting history', async () => {
    const { prisma, service } = setup();
    prisma.accountingCustomer.findFirst.mockResolvedValue({
      id: 'customer-1',
      tenantId: actor.tenantId,
      code: 'CUS-0001',
      legalName: 'Acme Insurance',
      currency: 'GHS',
      subledgerAccountId: 'subledger-1',
      subledgerAccount: {
        id: 'subledger-1',
        code: 'CUS-0001',
        name: 'Acme Insurance',
        status: RecordStatus.ACTIVE,
      },
    });
    prisma.accountingCustomer.update.mockResolvedValue({
      id: 'customer-1',
      tenantId: actor.tenantId,
      code: 'CUS-0001',
      legalName: 'Acme Insurance',
      currency: 'GHS',
      isActive: false,
      subledgerAccountId: 'subledger-1',
      subledgerAccount: {
        id: 'subledger-1',
        code: 'CUS-0001',
        name: 'Acme Insurance',
        status: RecordStatus.INACTIVE,
      },
    });
    prisma.subledgerAccount.findMany.mockResolvedValue([
      {
        id: 'subledger-1',
        controlAccountId: 'ar-control',
      },
    ]);

    await service.deactivateCustomer(actor, 'customer-1');

    const subledgerUpdateMock = prisma.subledgerAccount
      .update as jest.MockedFunction<
      (args: {
        where: { id_tenantId: { id: string; tenantId: string } };
        data: { status: RecordStatus; updatedByUserId: string };
      }) => Promise<unknown>
    >;
    const subledgerUpdateCall = subledgerUpdateMock.mock.calls[0][0];
    expect(subledgerUpdateCall.where.id_tenantId).toEqual({
      id: 'subledger-1',
      tenantId: actor.tenantId,
    });
    expect(subledgerUpdateCall.data.status).toBe(RecordStatus.INACTIVE);
    expect(subledgerUpdateCall.data.updatedByUserId).toBe(actor.id);

    const customerUpdateMock = prisma.accountingCustomer
      .update as jest.MockedFunction<
      (args: { data: { isActive: boolean } }) => Promise<unknown>
    >;
    const customerUpdateCall = customerUpdateMock.mock.calls[0][0];
    expect(customerUpdateCall.data.isActive).toBe(false);
  });

  it('lists customers with one bulk posted-line balance query', async () => {
    const { prisma, service } = setup();
    prisma.accountingCustomer.findMany.mockResolvedValue([
      {
        id: 'customer-1',
        tenantId: actor.tenantId,
        code: 'CUS-0001',
        legalName: 'Acme Insurance',
        currency: 'GHS',
        subledgerAccountId: 'subledger-1',
        subledgerAccount: {
          id: 'subledger-1',
          code: 'CUS-0001',
          name: 'Acme Insurance',
          status: RecordStatus.ACTIVE,
        },
      },
      {
        id: 'customer-2',
        tenantId: actor.tenantId,
        code: 'CUS-0002',
        legalName: 'Best Insurance',
        currency: 'GHS',
        subledgerAccountId: 'subledger-2',
        subledgerAccount: {
          id: 'subledger-2',
          code: 'CUS-0002',
          name: 'Best Insurance',
          status: RecordStatus.ACTIVE,
        },
      },
    ]);
    prisma.accountingCustomer.count.mockResolvedValue(2);
    prisma.subledgerAccount.findMany.mockResolvedValue([
      {
        id: 'subledger-1',
        controlAccountId: 'ar-control',
      },
      {
        id: 'subledger-2',
        controlAccountId: 'ar-control',
      },
    ]);
    prisma.journalLine.findMany.mockResolvedValue([
      {
        glAccountId: 'ar-control',
        subledgerAccountId: 'subledger-1',
        baseDebit: 100,
        baseCredit: 25,
        transactionDebit: 100,
        transactionCredit: 25,
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
    ]);

    const result = await service.listCustomers(actor.tenantId, {});

    expect(prisma.journalLine.findMany).toHaveBeenCalledTimes(1);
    const journalLineFindManyMock = prisma.journalLine
      .findMany as jest.MockedFunction<
      (args: {
        where: {
          tenantId: string;
          subledgerAccountId: { in: string[] };
          journalEntry: { status: { in: string[] } };
        };
      }) => Promise<unknown>
    >;
    const journalLineFindManyCall = journalLineFindManyMock.mock.calls[0][0];
    expect(journalLineFindManyCall.where).toEqual({
      tenantId: actor.tenantId,
      subledgerAccountId: { in: ['subledger-1', 'subledger-2'] },
      journalEntry: {
        status: { in: ['POSTED', 'REVERSED'] },
      },
    });
    expect(result.items[0].balance.baseBalance).toBe(75);
    expect(result.items[1].balance.baseBalance).toBe(0);
  });
});
