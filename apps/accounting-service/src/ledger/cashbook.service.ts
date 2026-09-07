import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingSettlementMethod,
  CashbookDirection,
  CashbookTransactionStatus,
  CashbookTransactionType,
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCashAccountDto,
  CreateCashbookAdjustmentDto,
  CreateCashbookChargeDto,
  CreateCashbookPaymentDto,
  CreateCashbookReceiptDto,
  CreateCashbookTransferDto,
  QueryCashAccountsDto,
  QueryCashbookDto,
  ReverseCashbookTransactionDto,
  UpdateCashAccountDto,
  CashbookEntryDto,
} from './dto/cashbook.dto';
import { CreateJournalDto, JournalLineDto } from './dto/accounting.dto';
import { JournalsService } from './journals.service';

const cashAccountInclude = {
  glAccount: { select: { id: true, code: true, name: true, category: true } },
} satisfies Prisma.AccountingCashAccountInclude;

const cashbookInclude = {
  cashAccount: {
    select: {
      id: true,
      name: true,
      accountKind: true,
      currency: true,
      glAccountId: true,
      glAccount: { select: { id: true, code: true, name: true } },
    },
  },
  destinationCashAccount: {
    select: {
      id: true,
      name: true,
      accountKind: true,
      currency: true,
      glAccountId: true,
      glAccount: { select: { id: true, code: true, name: true } },
    },
  },
  offsetGlAccount: { select: { id: true, code: true, name: true } },
  offsetSubledgerAccount: {
    select: { id: true, code: true, name: true, type: true },
  },
  postedJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  reversalJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  reversalOfTransaction: {
    select: { id: true, reference: true, status: true },
  },
  reversalTransaction: { select: { id: true, reference: true, status: true } },
} satisfies Prisma.CashbookTransactionInclude;

type TransactionClient = Prisma.TransactionClient;
type CashbookRecord = Prisma.CashbookTransactionGetPayload<{
  include: typeof cashbookInclude;
}>;
type SourceCashbookDirection = Extract<CashbookDirection, 'INFLOW' | 'OUTFLOW'>;

export type CreateSourceCashbookTransactionInput = {
  sourceEventInboxId: string;
  sourceModule: string;
  sourceEventType: string;
  sourceRecordId: string;
  sourceReference?: string | null;
  cashAccountId: string;
  direction: SourceCashbookDirection;
  amount: number;
  currency: string;
  transactionDate: Date;
  settlementMethod: AccountingSettlementMethod;
  reference?: string | null;
  counterpartyType?: string | null;
  counterpartyId?: string | null;
  description: string;
  exchangeRate?: number;
  counterLines: JournalLineDto[];
};

@Injectable()
export class CashbookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journals: JournalsService,
  ) {}

  listCashAccounts(tenantId: string, query: QueryCashAccountsDto) {
    return this.prisma.accountingCashAccount.findMany({
      where: {
        tenantId,
        ...(query.accountKind ? { accountKind: query.accountKind } : {}),
        ...(query.currency ? { currency: query.currency } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      include: cashAccountInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async getCashAccount(user: RequestUser, cashAccountId: string) {
    const account = await this.prisma.accountingCashAccount.findFirst({
      where: { id: cashAccountId, tenantId: user.tenantId },
      include: cashAccountInclude,
    });
    if (!account) throw new NotFoundException('Cash account not found');
    return account;
  }

  async createCashAccount(user: RequestUser, dto: CreateCashAccountDto) {
    await this.assertActiveCurrency(user.tenantId, dto.currency);
    await this.assertCashGlAccount(user.tenantId, dto.glAccountId);

    try {
      const account = await this.prisma.accountingCashAccount.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          accountKind: dto.accountKind,
          currency: dto.currency,
          glAccountId: dto.glAccountId,
          bankName: this.optional(dto.bankName),
          accountNumber: this.optional(dto.accountNumber),
          branch: this.optional(dto.branch),
          description: this.optional(dto.description),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: cashAccountInclude,
      });
      await this.recordAudit(
        user,
        'CASH_ACCOUNT_CREATED',
        'AccountingCashAccount',
        account.id,
        { name: account.name, accountKind: account.accountKind },
      );
      return account;
    } catch (error) {
      this.rethrowCashAccountUnique(error);
    }
  }

  async updateCashAccount(
    user: RequestUser,
    cashAccountId: string,
    dto: UpdateCashAccountDto,
  ) {
    const current = await this.getCashAccount(user, cashAccountId);
    if (dto.currency)
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    if (dto.glAccountId) {
      await this.assertCashGlAccount(user.tenantId, dto.glAccountId);
    }

    try {
      const account = await this.prisma.accountingCashAccount.update({
        where: {
          id_tenantId: { id: current.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.accountKind !== undefined
            ? { accountKind: dto.accountKind }
            : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.glAccountId !== undefined
            ? { glAccountId: dto.glAccountId }
            : {}),
          ...(dto.bankName !== undefined
            ? { bankName: this.optional(dto.bankName) }
            : {}),
          ...(dto.accountNumber !== undefined
            ? { accountNumber: this.optional(dto.accountNumber) }
            : {}),
          ...(dto.branch !== undefined
            ? { branch: this.optional(dto.branch) }
            : {}),
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
        include: cashAccountInclude,
      });
      await this.recordAudit(
        user,
        'CASH_ACCOUNT_UPDATED',
        'AccountingCashAccount',
        account.id,
        dto,
      );
      return account;
    } catch (error) {
      this.rethrowCashAccountUnique(error);
    }
  }

  createReceipt(user: RequestUser, dto: CreateCashbookReceiptDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.RECEIPT,
      direction: CashbookDirection.INFLOW,
    });
  }

  createPayment(user: RequestUser, dto: CreateCashbookPaymentDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.PAYMENT,
      direction: CashbookDirection.OUTFLOW,
    });
  }

  createCharge(user: RequestUser, dto: CreateCashbookChargeDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.CHARGE,
      direction: CashbookDirection.OUTFLOW,
    });
  }

  createAdjustment(user: RequestUser, dto: CreateCashbookAdjustmentDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.ADJUSTMENT,
    });
  }

  async createTransfer(user: RequestUser, dto: CreateCashbookTransferDto) {
    if (dto.cashAccountId === dto.destinationCashAccountId) {
      throw new BadRequestException(
        'Transfer source and destination cash accounts must be different',
      );
    }
    const [source, destination] = await Promise.all([
      this.resolveActiveCashAccount(user.tenantId, dto.cashAccountId),
      this.resolveActiveCashAccount(
        user.tenantId,
        dto.destinationCashAccountId,
      ),
    ]);
    if (source.currency !== dto.currency) {
      throw new BadRequestException(
        'Transfer currency must match the source cash account currency',
      );
    }
    if (source.currency !== destination.currency && !dto.exchangeRate) {
      throw new BadRequestException(
        'Cross-currency transfers require an agreed exchange rate',
      );
    }

    const transaction = await this.prisma.cashbookTransaction.create({
      data: {
        tenantId: user.tenantId,
        cashAccountId: source.id,
        destinationCashAccountId: destination.id,
        transactionType: CashbookTransactionType.TRANSFER,
        direction: CashbookDirection.TRANSFER,
        amount: dto.amount,
        currency: dto.currency,
        transactionDate: new Date(dto.transactionDate),
        settlementMethod: AccountingSettlementMethod.INTERNAL_TRANSFER,
        reference: this.optional(dto.reference),
        description: dto.description,
        sourceModule: this.optional(dto.sourceModule),
        sourceRecordId: this.optional(dto.sourceRecordId),
        exchangeRate: dto.exchangeRate,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: cashbookInclude,
    });
    await this.recordAudit(
      user,
      'CASHBOOK_TRANSFER_CREATED',
      'CashbookTransaction',
      transaction.id,
      { amount: dto.amount, currency: dto.currency },
    );
    return transaction;
  }

  async listCashbook(tenantId: string, query: QueryCashbookDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.CashbookTransactionWhereInput = {
      tenantId,
      ...(query.cashAccountId
        ? {
            OR: [
              { cashAccountId: query.cashAccountId },
              { destinationCashAccountId: query.cashAccountId },
            ],
          }
        : {}),
      ...(query.transactionType
        ? { transactionType: query.transactionType }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.fromDate || query.toDate
        ? {
            transactionDate: {
              ...(query.fromDate
                ? { gte: this.startOfDay(query.fromDate) }
                : {}),
              ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.cashbookTransaction.findMany({
        where,
        include: cashbookInclude,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cashbookTransaction.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getCashbookTransaction(user: RequestUser, transactionId: string) {
    const transaction = await this.prisma.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId: user.tenantId },
      include: cashbookInclude,
    });
    if (!transaction) {
      throw new NotFoundException('Cashbook transaction not found');
    }
    return transaction;
  }

  async postTransaction(user: RequestUser, transactionId: string) {
    return this.prisma.$transaction((tx) =>
      this.postTransactionInTransaction(tx, user, transactionId),
    );
  }

  async postTransactionInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
  ) {
    const transaction = await this.findTransactionForUpdate(
      tx,
      user.tenantId,
      transactionId,
    );
    if (transaction.status !== CashbookTransactionStatus.DRAFT) {
      throw new ConflictException(
        'Only draft cashbook transactions can be posted',
      );
    }

    const journal = await this.journals.createPostedInTransaction(
      tx,
      user,
      await this.buildJournalDto(tx, user.tenantId, transaction),
    );
    const claimed = await tx.cashbookTransaction.updateMany({
      where: {
        id: transaction.id,
        tenantId: user.tenantId,
        status: CashbookTransactionStatus.DRAFT,
      },
      data: {
        status: CashbookTransactionStatus.POSTED,
        postedAt: new Date(),
        postedByUserId: user.id,
        postedJournalEntryId: journal.id,
        updatedByUserId: user.id,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Cashbook transaction was changed by another request',
      );
    }
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'CASHBOOK_TRANSACTION_POSTED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          journalEntryId: journal.id,
          journalNumber: journal.journalNumber,
        },
      },
    });
    return tx.cashbookTransaction.findUniqueOrThrow({
      where: { id_tenantId: { id: transaction.id, tenantId: user.tenantId } },
      include: cashbookInclude,
    });
  }

  async createPostedSourceEventTransactionInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    input: CreateSourceCashbookTransactionInput,
  ) {
    const cashAccount = await this.resolveActiveCashAccountInTransaction(
      tx,
      user.tenantId,
      input.cashAccountId,
    );
    if (cashAccount.currency !== input.currency) {
      throw new BadRequestException(
        'Source cash event currency must match the Accounting cash account currency',
      );
    }
    if (input.counterLines.length < 1) {
      throw new BadRequestException(
        'Source cash events require at least one posting-rule counter line',
      );
    }

    const transactionType =
      input.direction === CashbookDirection.INFLOW
        ? CashbookTransactionType.RECEIPT
        : CashbookTransactionType.PAYMENT;
    const cashLine: JournalLineDto =
      input.direction === CashbookDirection.INFLOW
        ? {
            glAccountId: cashAccount.glAccountId,
            description: input.description,
            debit: input.amount,
            credit: 0,
          }
        : {
            glAccountId: cashAccount.glAccountId,
            description: input.description,
            debit: 0,
            credit: input.amount,
          };
    const lines =
      input.direction === CashbookDirection.INFLOW
        ? [cashLine, ...input.counterLines]
        : [...input.counterLines, cashLine];

    const period = await this.resolveOpenPeriod(
      tx,
      user.tenantId,
      input.transactionDate,
    );
    const journal = await this.journals.createPostedInTransaction(tx, user, {
      transactionDate: input.transactionDate.toISOString(),
      fiscalPeriodId: period.id,
      transactionCurrency: input.currency,
      exchangeRate: input.exchangeRate,
      reference:
        input.reference ?? input.sourceReference ?? input.sourceRecordId,
      description: input.description,
      idempotencyKey: `source-event:${input.sourceEventInboxId}`,
      sourceModule: input.sourceModule,
      sourceRecordType: input.sourceEventType,
      sourceRecordId: input.sourceRecordId,
      lines,
    });

    const firstCounterLine = input.counterLines[0];
    const transaction = await tx.cashbookTransaction.create({
      data: {
        tenantId: user.tenantId,
        cashAccountId: cashAccount.id,
        transactionType,
        direction: input.direction,
        amount: input.amount,
        currency: input.currency,
        transactionDate: input.transactionDate,
        settlementMethod: input.settlementMethod,
        reference: this.optional(input.reference ?? undefined),
        counterpartyType: this.optional(input.counterpartyType ?? undefined),
        counterpartyId: this.optional(input.counterpartyId ?? undefined),
        externalReference: this.optional(input.sourceReference ?? undefined),
        description: input.description,
        offsetGlAccountId: firstCounterLine.glAccountId,
        offsetSubledgerAccountId: firstCounterLine.subledgerAccountId,
        sourceEventInboxId: input.sourceEventInboxId,
        sourceModule: input.sourceModule,
        sourceEventType: input.sourceEventType,
        sourceRecordId: input.sourceRecordId,
        sourceReference: this.optional(input.sourceReference ?? undefined),
        exchangeRate: input.exchangeRate,
        status: CashbookTransactionStatus.POSTED,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        postedByUserId: user.id,
        postedAt: new Date(),
        postedJournalEntryId: journal.id,
      },
      include: cashbookInclude,
    });

    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'SOURCE_CASHBOOK_TRANSACTION_POSTED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          sourceEventInboxId: input.sourceEventInboxId,
          sourceModule: input.sourceModule,
          sourceEventType: input.sourceEventType,
          sourceRecordId: input.sourceRecordId,
          journalEntryId: journal.id,
        },
      },
    });

    return { transaction, journal };
  }

  async reverseTransaction(
    user: RequestUser,
    transactionId: string,
    dto: ReverseCashbookTransactionDto,
  ) {
    return this.prisma.$transaction((tx) =>
      this.reverseTransactionInTransaction(tx, user, transactionId, dto),
    );
  }

  async reverseTransactionInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
    dto: ReverseCashbookTransactionDto,
  ) {
    const transaction = await this.findTransactionForUpdate(
      tx,
      user.tenantId,
      transactionId,
    );
    if (transaction.status !== CashbookTransactionStatus.POSTED) {
      throw new ConflictException(
        'Only posted cashbook transactions can be reversed',
      );
    }
    if (!transaction.postedJournalEntryId || !transaction.postedJournalEntry) {
      throw new ConflictException(
        'Posted cashbook transaction is missing its posted journal',
      );
    }
    if (transaction.reversalTransaction) {
      return tx.cashbookTransaction.findUniqueOrThrow({
        where: {
          id_tenantId: {
            id: transaction.reversalTransaction.id,
            tenantId: user.tenantId,
          },
        },
        include: cashbookInclude,
      });
    }

    const reversalDate = new Date(dto.reversalDate);
    const period = await this.resolveOpenPeriod(
      tx,
      user.tenantId,
      reversalDate,
    );
    const originalJournal = await tx.journalEntry.findFirst({
      where: {
        id: transaction.postedJournalEntryId,
        tenantId: user.tenantId,
        status: JournalStatus.POSTED,
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!originalJournal) {
      throw new ConflictException(
        'Original posted journal is not available for reversal',
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
        reference: `REVERSAL-${transaction.reference ?? transaction.id}`,
        description: `Cashbook reversal of ${transaction.reference ?? transaction.id}: ${dto.reason}`,
        idempotencyKey: `cashbook:${transaction.id}:reversal:v1`,
        sourceModule: 'ACCOUNTING',
        sourceRecordType: 'CASHBOOK_REVERSAL',
        sourceRecordId: transaction.id,
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

    const journalClaimed = await tx.journalEntry.updateMany({
      where: {
        id: originalJournal.id,
        tenantId: user.tenantId,
        status: JournalStatus.POSTED,
      },
      data: {
        status: JournalStatus.REVERSED,
        reversedAt: new Date(),
        reversedByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    if (journalClaimed.count !== 1) {
      throw new ConflictException(
        'Original journal was changed by another request',
      );
    }

    const reversal = await tx.cashbookTransaction.create({
      data: {
        tenantId: user.tenantId,
        cashAccountId: this.reversalCashAccountId(transaction),
        destinationCashAccountId:
          this.reversalDestinationCashAccountId(transaction),
        transactionType: transaction.transactionType,
        direction: this.reversalDirection(transaction.direction),
        amount: transaction.amount,
        currency: transaction.currency,
        transactionDate: reversalDate,
        settlementMethod: transaction.settlementMethod,
        reference: `REVERSAL-${transaction.reference ?? transaction.id}`,
        counterpartyType: transaction.counterpartyType,
        counterpartyId: transaction.counterpartyId,
        externalReference: transaction.externalReference,
        description: `Reversal: ${dto.reason}`,
        offsetGlAccountId: transaction.offsetGlAccountId,
        offsetSubledgerAccountId: transaction.offsetSubledgerAccountId,
        sourceModule: transaction.sourceModule,
        sourceRecordId: transaction.sourceRecordId,
        exchangeRate: transaction.exchangeRate,
        status: CashbookTransactionStatus.POSTED,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        postedByUserId: user.id,
        postedAt: new Date(),
        postedJournalEntryId: reversalJournal.id,
        reversalOfTransactionId: transaction.id,
      },
      include: cashbookInclude,
    });

    const claimed = await tx.cashbookTransaction.updateMany({
      where: {
        id: transaction.id,
        tenantId: user.tenantId,
        status: CashbookTransactionStatus.POSTED,
      },
      data: {
        status: CashbookTransactionStatus.REVERSED,
        reversedAt: new Date(),
        reversedByUserId: user.id,
        reversalJournalEntryId: reversalJournal.id,
        updatedByUserId: user.id,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Cashbook transaction was changed by another request',
      );
    }
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'CASHBOOK_TRANSACTION_REVERSED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          reversalTransactionId: reversal.id,
          reversalJournalEntryId: reversalJournal.id,
          reason: dto.reason,
        },
      },
    });
    return reversal;
  }

  private async createCashbookEntry(
    user: RequestUser,
    dto: CashbookEntryDto & {
      transactionType: CashbookTransactionType;
      direction: CashbookDirection;
    },
  ) {
    const [cashAccount] = await Promise.all([
      this.resolveActiveCashAccount(user.tenantId, dto.cashAccountId),
      this.assertPostingOffsetAccount(user.tenantId, dto.offsetGlAccountId),
    ]);
    if (cashAccount.currency !== dto.currency) {
      throw new BadRequestException(
        'Cashbook transaction currency must match the cash account currency',
      );
    }
    const transaction = await this.prisma.cashbookTransaction.create({
      data: {
        tenantId: user.tenantId,
        cashAccountId: cashAccount.id,
        transactionType: dto.transactionType,
        direction: dto.direction,
        amount: dto.amount,
        currency: dto.currency,
        transactionDate: new Date(dto.transactionDate),
        settlementMethod: dto.settlementMethod,
        reference: this.optional(dto.reference),
        counterpartyType: this.optional(dto.counterpartyType),
        counterpartyId: this.optional(dto.counterpartyId),
        externalReference: this.optional(dto.externalReference),
        description: dto.description,
        offsetGlAccountId: dto.offsetGlAccountId,
        offsetSubledgerAccountId: dto.offsetSubledgerAccountId,
        sourceModule: this.optional(dto.sourceModule),
        sourceRecordId: this.optional(dto.sourceRecordId),
        exchangeRate: dto.exchangeRate,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: cashbookInclude,
    });
    await this.recordAudit(
      user,
      'CASHBOOK_TRANSACTION_CREATED',
      'CashbookTransaction',
      transaction.id,
      {
        transactionType: transaction.transactionType,
        amount: dto.amount,
        currency: dto.currency,
      },
    );
    return transaction;
  }

  private async buildJournalDto(
    tx: TransactionClient,
    tenantId: string,
    transaction: CashbookRecord,
  ): Promise<CreateJournalDto> {
    const period = await this.resolveOpenPeriod(
      tx,
      tenantId,
      transaction.transactionDate,
    );
    const lines = this.journalLines(transaction);
    return {
      transactionDate: transaction.transactionDate.toISOString(),
      fiscalPeriodId: period.id,
      transactionCurrency: transaction.currency,
      exchangeRate: transaction.exchangeRate
        ? Number(transaction.exchangeRate.toString())
        : undefined,
      reference: transaction.reference ?? transaction.id,
      description: transaction.description,
      idempotencyKey: `cashbook:${transaction.id}:posted:v1`,
      sourceModule: transaction.sourceModule ?? 'ACCOUNTING',
      sourceRecordType: 'CASHBOOK_TRANSACTION',
      sourceRecordId: transaction.sourceRecordId ?? transaction.id,
      lines,
    };
  }

  private journalLines(transaction: CashbookRecord): JournalLineDto[] {
    const amount = Number(transaction.amount.toString());
    const cashLine = {
      glAccountId: transaction.cashAccount.glAccountId,
      description: transaction.description,
    };
    const offsetLine = transaction.offsetGlAccountId
      ? {
          glAccountId: transaction.offsetGlAccountId,
          subledgerAccountId: transaction.offsetSubledgerAccountId ?? undefined,
          description: transaction.description,
        }
      : null;

    if (transaction.transactionType === CashbookTransactionType.TRANSFER) {
      if (!transaction.destinationCashAccount) {
        throw new ConflictException(
          'Transfer is missing destination cash account',
        );
      }
      return [
        {
          glAccountId: transaction.destinationCashAccount.glAccountId,
          description: transaction.description,
          debit: amount,
          credit: 0,
        },
        { ...cashLine, debit: 0, credit: amount },
      ];
    }

    if (!offsetLine) {
      throw new ConflictException(
        'Cashbook transaction is missing offset account',
      );
    }

    if (transaction.direction === CashbookDirection.INFLOW) {
      return [
        { ...cashLine, debit: amount, credit: 0 },
        { ...offsetLine, debit: 0, credit: amount },
      ];
    }
    return [
      { ...offsetLine, debit: amount, credit: 0 },
      { ...cashLine, debit: 0, credit: amount },
    ];
  }

  private async findTransactionForUpdate(
    tx: TransactionClient,
    tenantId: string,
    transactionId: string,
  ) {
    const transaction = await tx.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: cashbookInclude,
    });
    if (!transaction) {
      throw new NotFoundException('Cashbook transaction not found');
    }
    return transaction;
  }

  private async resolveActiveCashAccount(tenantId: string, id: string) {
    return this.resolveActiveCashAccountInTransaction(
      this.prisma,
      tenantId,
      id,
    );
  }

  private async resolveActiveCashAccountInTransaction(
    client: TransactionClient | PrismaService,
    tenantId: string,
    id: string,
  ) {
    const account = await client.accountingCashAccount.findFirst({
      where: { id, tenantId },
      include: cashAccountInclude,
    });
    if (!account) throw new NotFoundException('Cash account not found');
    if (!account.isActive) {
      throw new ConflictException(
        'Inactive cash accounts cannot receive new cashbook transactions',
      );
    }
    return account;
  }

  private async assertActiveCurrency(tenantId: string, code: string) {
    const currency = await this.prisma.accountingCurrency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!currency || !currency.isActive) {
      throw new BadRequestException('Accounting currency is not active');
    }
  }

  private async assertCashGlAccount(tenantId: string, glAccountId: string) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId },
    });
    if (!account) throw new BadRequestException('GL account not found');
    if (
      account.status !== RecordStatus.ACTIVE ||
      !account.allowPosting ||
      account.category !== GLAccountCategory.ASSET
    ) {
      throw new BadRequestException(
        'Cash accounts require an active, posting-enabled asset GL account',
      );
    }
  }

  private async assertPostingOffsetAccount(
    tenantId: string,
    glAccountId: string,
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId },
    });
    if (!account) throw new BadRequestException('Offset GL account not found');
    if (account.status !== RecordStatus.ACTIVE || !account.allowPosting) {
      throw new BadRequestException(
        'Offset GL account must be active and posting-enabled',
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
        'No fiscal period contains the cashbook transaction date',
      );
    }
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post cashbook transaction into a ${period.status.toLowerCase()} fiscal period`,
      );
    }
    return period;
  }

  private reversalDirection(direction: CashbookDirection) {
    if (direction === CashbookDirection.INFLOW)
      return CashbookDirection.OUTFLOW;
    if (direction === CashbookDirection.OUTFLOW)
      return CashbookDirection.INFLOW;
    return CashbookDirection.TRANSFER;
  }

  private reversalCashAccountId(transaction: CashbookRecord) {
    return transaction.transactionType === CashbookTransactionType.TRANSFER &&
      transaction.destinationCashAccountId
      ? transaction.destinationCashAccountId
      : transaction.cashAccountId;
  }

  private reversalDestinationCashAccountId(transaction: CashbookRecord) {
    return transaction.transactionType === CashbookTransactionType.TRANSFER
      ? transaction.cashAccountId
      : null;
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
        changedFields: this.jsonSafe(changedFields),
      },
    });
  }

  private jsonSafe(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private optional(value: string | undefined): string | null | undefined {
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

  private rethrowCashAccountUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A cash account with this name or account identifier already exists',
      );
    }
    throw error;
  }
}
