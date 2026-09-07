import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, RecordStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { BankReconciliationsService } from './bank-reconciliations.service';

describe('BankReconciliationsService', () => {
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

  const dto = {
    cashAccountId: 'cash-account-1',
    statementReference: 'ECOBANK-2026-08',
    statementStartDate: '2026-08-01',
    statementEndDate: '2026-08-31',
    openingBalance: 1000,
    closingBalance: 1250,
    currency: 'GHS',
  };

  function reconciliation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'reconciliation-1',
      tenantId: actor.tenantId,
      cashAccountId: dto.cashAccountId,
      statementReference: dto.statementReference,
      statementStartDate: new Date('2026-08-01T00:00:00.000Z'),
      statementEndDate: new Date('2026-08-31T23:59:59.999Z'),
      openingBalance: { toString: () => '1000.0000' },
      closingBalance: { toString: () => '1250.0000' },
      currency: dto.currency,
      status: 'DRAFT',
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
      completedByUserId: null,
      voidedByUserId: null,
      completedAt: null,
      voidedAt: null,
      voidReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      cashAccount: {
        id: dto.cashAccountId,
        name: 'Main Bank',
        accountKind: 'BANK',
        currency: dto.currency,
        bankName: 'Ecobank',
        accountNumber: '****1234',
      },
      _count: { statementLines: 0 },
      ...overrides,
    };
  }

  function setup() {
    const prisma = {
      accountingCashAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: dto.cashAccountId,
          currency: dto.currency,
          glAccount: { status: RecordStatus.ACTIVE },
        }),
      },
      bankReconciliation: {
        create: jest.fn().mockResolvedValue(reconciliation()),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(reconciliation()),
      },
      bankStatementLine: { findMany: jest.fn().mockResolvedValue([]) },
      accountingAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const transaction = {
      bankStatementLine: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'statement-line-1',
          status: 'MATCHED',
          matchedCashbookTransactionId: 'cashbook-1',
        }),
      },
      cashbookTransaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cashbook-1',
          transactionDate: new Date('2026-08-05T00:00:00.000Z'),
          amount: new Prisma.Decimal('250.50'),
          currency: 'GHS',
          direction: 'INFLOW',
          reference: 'REC-001',
          externalReference: null,
          description: 'Premium receipt',
        }),
      },
      bankReconciliation: {
        update: jest.fn().mockResolvedValue(reconciliation()),
      },
      accountingAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-2' }),
      },
    };
    const transactionPrisma = {
      ...prisma,
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
        ),
    };
    return {
      prisma: transactionPrisma,
      transaction,
      service: new BankReconciliationsService(
        transactionPrisma as unknown as PrismaService,
      ),
    };
  }

  it('creates a draft session and records an audit entry', async () => {
    const { prisma, service } = setup();

    await expect(service.create(actor, dto)).resolves.toMatchObject({
      id: 'reconciliation-1',
    });

    expect(prisma.bankReconciliation.create).toHaveBeenCalledTimes(1);
    expect(prisma.accountingAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a statement range whose start is after its end', async () => {
    const { service } = setup();

    await expect(
      service.create(actor, { ...dto, statementStartDate: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reconciliation currency that differs from its cash account', async () => {
    const { service } = setup();

    await expect(
      service.create(actor, { ...dto, currency: 'USD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate statement references to a conflict', async () => {
    const { prisma, service } = setup();
    prisma.bankReconciliation.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    await expect(service.create(actor, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not return a reconciliation outside the caller tenant', async () => {
    const { prisma, service } = setup();
    prisma.bankReconciliation.findFirst.mockResolvedValue(null);

    await expect(
      service.get(actor.tenantId, 'other-tenant-record'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.bankReconciliation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-tenant-record', tenantId: actor.tenantId },
      }),
    );
  });

  it('imports validated CSV lines into a draft reconciliation without matching cashbook rows', async () => {
    const { service, transaction } = setup();
    const file = {
      originalname: 'ecobank-august.csv',
      mimetype: 'text/csv',
      size: 134,
      buffer: Buffer.from(
        'transactionDate,valueDate,amount,currency,description,bankReference,counterpartyName,runningBalance\n2026-08-05,2026-08-05,250.50,GHS,"Premium receipt, August",ECO-001,Acme Client,1250.50\n',
      ),
    };

    await expect(
      service.importStatementLines(actor, 'reconciliation-1', file),
    ).resolves.toEqual({
      reconciliationId: 'reconciliation-1',
      importedLineCount: 1,
    });

    expect(transaction.bankStatementLine.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.bankReconciliation.update).toHaveBeenCalledTimes(1);
    expect(transaction.accountingAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate statement lines in one CSV before persisting them', async () => {
    const { service } = setup();
    const file = {
      originalname: 'duplicate.csv',
      mimetype: 'text/csv',
      size: 120,
      buffer: Buffer.from(
        'transactionDate,amount,currency,bankReference\n2026-08-05,250.50,GHS,ECO-001\n2026-08-05,250.50,GHS,ECO-001\n',
      ),
    };

    await expect(
      service.importStatementLines(actor, 'reconciliation-1', file),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('matches an unmatched bank line only to an exact posted Cashbook candidate', async () => {
    const { service, transaction } = setup();
    transaction.bankStatementLine.findFirst.mockResolvedValue({
      id: 'statement-line-1',
      tenantId: actor.tenantId,
      reconciliationId: 'reconciliation-1',
      amount: new Prisma.Decimal('250.50'),
      currency: 'GHS',
      transactionDate: new Date('2026-08-05T00:00:00.000Z'),
      status: 'UNMATCHED',
      matchedCashbookTransactionId: null,
      reconciliation: { cashAccountId: dto.cashAccountId, status: 'DRAFT' },
    });

    await expect(
      service.matchStatementLine(
        actor,
        'reconciliation-1',
        'statement-line-1',
        {
          cashbookTransactionId: 'cashbook-1',
        },
      ),
    ).resolves.toMatchObject({
      id: 'statement-line-1',
      status: 'MATCHED',
    });

    expect(transaction.cashbookTransaction.findFirst).toHaveBeenCalledTimes(1);
    expect(transaction.bankStatementLine.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects a requested Cashbook row that is not an exact candidate', async () => {
    const { service, transaction } = setup();
    transaction.bankStatementLine.findFirst.mockResolvedValue({
      id: 'statement-line-1',
      tenantId: actor.tenantId,
      reconciliationId: 'reconciliation-1',
      amount: new Prisma.Decimal('-250.50'),
      currency: 'GHS',
      transactionDate: new Date('2026-08-05T00:00:00.000Z'),
      status: 'UNMATCHED',
      matchedCashbookTransactionId: null,
      reconciliation: { cashAccountId: dto.cashAccountId, status: 'DRAFT' },
    });
    transaction.cashbookTransaction.findFirst.mockResolvedValue(null);

    await expect(
      service.matchStatementLine(
        actor,
        'reconciliation-1',
        'statement-line-1',
        {
          cashbookTransactionId: 'cashbook-not-eligible',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.bankStatementLine.updateMany).not.toHaveBeenCalled();
  });
});
