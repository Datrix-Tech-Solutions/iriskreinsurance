import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  BankReconciliationStatus,
  BankStatementLineStatus,
  CashbookDirection,
  CashbookTransactionStatus,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBankReconciliationDto,
  MatchBankStatementLineDto,
  QueryBankReconciliationsDto,
  QueryBankStatementLinesDto,
} from './dto/bank-reconciliations.dto';

const reconciliationInclude = {
  cashAccount: {
    select: {
      id: true,
      name: true,
      accountKind: true,
      currency: true,
      bankName: true,
      accountNumber: true,
    },
  },
  _count: { select: { statementLines: true } },
} satisfies Prisma.BankReconciliationInclude;

type ImportFile = Pick<
  Express.Multer.File,
  'buffer' | 'mimetype' | 'originalname' | 'size'
>;

type StatementLineInput = {
  rowNumber: number;
  transactionDate: Date;
  valueDate: Date | null;
  amount: number;
  currency: string;
  description: string | null;
  bankReference: string | null;
  counterpartyName: string | null;
  runningBalance: number | null;
  sourceFingerprint: string;
};

const MAX_CSV_BYTES = 1024 * 1024;
const MAX_CSV_ROWS = 5000;
const REQUIRED_STATEMENT_COLUMNS = ['transactionDate', 'amount', 'currency'];

const matchedCashbookSelect = {
  id: true,
  transactionDate: true,
  amount: true,
  currency: true,
  direction: true,
  reference: true,
  externalReference: true,
  description: true,
} satisfies Prisma.CashbookTransactionSelect;

@Injectable()
export class BankReconciliationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: QueryBankReconciliationsDto) {
    return this.prisma.bankReconciliation.findMany({
      where: {
        tenantId,
        ...(query.cashAccountId ? { cashAccountId: query.cashAccountId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.fromDate || query.toDate
          ? {
              statementEndDate: {
                ...(query.fromDate
                  ? { gte: this.startOfDay(query.fromDate) }
                  : {}),
                ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
              },
            }
          : {}),
      },
      include: reconciliationInclude,
      orderBy: [{ statementEndDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(tenantId: string, reconciliationId: string) {
    const reconciliation = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId },
      include: reconciliationInclude,
    });
    if (!reconciliation)
      throw new NotFoundException('Bank reconciliation not found');
    return reconciliation;
  }

  async create(user: RequestUser, dto: CreateBankReconciliationDto) {
    const startDate = this.startOfDay(dto.statementStartDate);
    const endDate = this.endOfDay(dto.statementEndDate);
    if (startDate > endDate) {
      throw new BadRequestException(
        'Statement start date must not be after statement end date',
      );
    }

    const cashAccount = await this.prisma.accountingCashAccount.findFirst({
      where: { id: dto.cashAccountId, tenantId: user.tenantId, isActive: true },
      select: {
        id: true,
        currency: true,
        glAccount: { select: { status: true } },
      },
    });
    if (!cashAccount || cashAccount.glAccount.status !== RecordStatus.ACTIVE) {
      throw new NotFoundException('Active tenant cash account not found');
    }
    if (cashAccount.currency !== dto.currency) {
      throw new BadRequestException(
        'Reconciliation currency must match the selected cash account',
      );
    }

    try {
      const reconciliation = await this.prisma.bankReconciliation.create({
        data: {
          tenantId: user.tenantId,
          cashAccountId: cashAccount.id,
          statementReference: dto.statementReference,
          statementStartDate: startDate,
          statementEndDate: endDate,
          openingBalance: dto.openingBalance,
          closingBalance: dto.closingBalance,
          currency: dto.currency,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: reconciliationInclude,
      });
      await this.recordAudit(
        user,
        'BANK_RECONCILIATION_CREATE',
        reconciliation.id,
        {
          cashAccountId: reconciliation.cashAccountId,
          statementReference: reconciliation.statementReference,
          statementStartDate: reconciliation.statementStartDate.toISOString(),
          statementEndDate: reconciliation.statementEndDate.toISOString(),
          currency: reconciliation.currency,
        },
      );
      return reconciliation;
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'A bank reconciliation already exists for this cash account and statement reference',
        );
      }
      throw error;
    }
  }

  async listStatementLines(
    tenantId: string,
    reconciliationId: string,
    query: QueryBankStatementLinesDto,
  ) {
    await this.get(tenantId, reconciliationId);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.BankStatementLineWhereInput = {
      tenantId,
      reconciliationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.bankStatementLine.findMany({
        where,
        include: {
          matchedCashbookTransaction: { select: matchedCashbookSelect },
        },
        orderBy: { lineNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bankStatementLine.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listMatchCandidates(
    tenantId: string,
    reconciliationId: string,
    statementLineId: string,
  ) {
    const line = await this.findUnmatchedStatementLine(
      this.prisma,
      tenantId,
      reconciliationId,
      statementLineId,
    );
    return this.prisma.cashbookTransaction.findMany({
      where: this.exactCashbookMatchWhere(line),
      select: matchedCashbookSelect,
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      take: 25,
    });
  }

  async matchStatementLine(
    user: RequestUser,
    reconciliationId: string,
    statementLineId: string,
    dto: MatchBankStatementLineDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const line = await this.findUnmatchedStatementLine(
            tx,
            user.tenantId,
            reconciliationId,
            statementLineId,
          );
          const cashbookTransaction = await tx.cashbookTransaction.findFirst({
            where: {
              ...this.exactCashbookMatchWhere(line),
              id: dto.cashbookTransactionId,
            },
            select: matchedCashbookSelect,
          });
          if (!cashbookTransaction) {
            throw new BadRequestException(
              'Cashbook transaction is not an exact eligible match for this statement line',
            );
          }
          const claimed = await tx.bankStatementLine.updateMany({
            where: {
              id: statementLineId,
              tenantId: user.tenantId,
              reconciliationId,
              status: BankStatementLineStatus.UNMATCHED,
              matchedCashbookTransactionId: null,
            },
            data: {
              status: BankStatementLineStatus.MATCHED,
              matchedCashbookTransactionId: cashbookTransaction.id,
              matchedByUserId: user.id,
              matchedAt: new Date(),
            },
          });
          if (claimed.count !== 1) {
            throw new ConflictException(
              'Statement line was changed by another request',
            );
          }
          await tx.accountingAuditLog.create({
            data: {
              tenantId: user.tenantId,
              actorUserId: user.id,
              action: 'BANK_STATEMENT_LINE_MATCH',
              entityType: 'BankStatementLine',
              entityId: statementLineId,
              changedFields: {
                reconciliationId,
                cashbookTransactionId: cashbookTransaction.id,
              } as Prisma.InputJsonValue,
            },
          });
          return tx.bankStatementLine.findUniqueOrThrow({
            where: {
              id_tenantId: { id: statementLineId, tenantId: user.tenantId },
            },
            include: {
              matchedCashbookTransaction: { select: matchedCashbookSelect },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'Cashbook transaction is already matched in this reconciliation',
        );
      }
      throw error;
    }
  }

  async importStatementLines(
    user: RequestUser,
    reconciliationId: string,
    file: ImportFile | undefined,
  ) {
    this.assertCsvFile(file);
    const reconciliation = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId: user.tenantId },
      select: {
        id: true,
        tenantId: true,
        currency: true,
        status: true,
        statementStartDate: true,
        statementEndDate: true,
      },
    });
    if (!reconciliation)
      throw new NotFoundException('Bank reconciliation not found');
    if (reconciliation.status !== BankReconciliationStatus.DRAFT) {
      throw new ConflictException(
        'Statement lines can only be imported into a draft reconciliation',
      );
    }

    const lines = this.parseStatementCsv(
      file.buffer.toString('utf8'),
      reconciliation,
    );
    const fingerprints = lines.map((line) => line.sourceFingerprint);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.bankStatementLine.findMany({
            where: {
              tenantId: user.tenantId,
              reconciliationId,
              sourceFingerprint: { in: fingerprints },
            },
            select: { sourceFingerprint: true },
          });
          if (existing.length > 0) {
            throw new ConflictException(
              'This file contains statement lines that have already been imported into this reconciliation',
            );
          }
          const lastLine = await tx.bankStatementLine.findFirst({
            where: { tenantId: user.tenantId, reconciliationId },
            orderBy: { lineNumber: 'desc' },
            select: { lineNumber: true },
          });
          const firstLineNumber = (lastLine?.lineNumber ?? 0) + 1;

          await tx.bankStatementLine.createMany({
            data: lines.map((line, index) => ({
              tenantId: user.tenantId,
              reconciliationId,
              lineNumber: firstLineNumber + index,
              transactionDate: line.transactionDate,
              valueDate: line.valueDate,
              amount: line.amount,
              currency: line.currency,
              description: line.description,
              bankReference: line.bankReference,
              counterpartyName: line.counterpartyName,
              runningBalance: line.runningBalance,
              sourceFingerprint: line.sourceFingerprint,
            })),
          });
          await tx.bankReconciliation.update({
            where: {
              id_tenantId: { id: reconciliationId, tenantId: user.tenantId },
            },
            data: { updatedByUserId: user.id },
          });
          await tx.accountingAuditLog.create({
            data: {
              tenantId: user.tenantId,
              actorUserId: user.id,
              action: 'BANK_STATEMENT_LINES_IMPORT',
              entityType: 'BankReconciliation',
              entityId: reconciliationId,
              changedFields: {
                fileName: file.originalname,
                lineCount: lines.length,
              } as Prisma.InputJsonValue,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'A matching statement line already exists; refresh and retry the import',
        );
      }
      throw error;
    }

    return { reconciliationId, importedLineCount: lines.length };
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityId: string,
    changedFields: Record<string, unknown>,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType: 'BankReconciliation',
        entityId,
        changedFields: changedFields as Prisma.InputJsonValue,
      },
    });
  }

  private async findUnmatchedStatementLine(
    client: Pick<Prisma.TransactionClient, 'bankStatementLine'>,
    tenantId: string,
    reconciliationId: string,
    statementLineId: string,
  ) {
    const line = await client.bankStatementLine.findFirst({
      where: { id: statementLineId, tenantId, reconciliationId },
      select: {
        id: true,
        tenantId: true,
        reconciliationId: true,
        amount: true,
        currency: true,
        transactionDate: true,
        status: true,
        matchedCashbookTransactionId: true,
        reconciliation: {
          select: { cashAccountId: true, status: true },
        },
      },
    });
    if (!line) throw new NotFoundException('Bank statement line not found');
    if (line.reconciliation.status !== BankReconciliationStatus.DRAFT) {
      throw new ConflictException(
        'Statement lines can only be matched in a draft reconciliation',
      );
    }
    if (
      line.status !== BankStatementLineStatus.UNMATCHED ||
      line.matchedCashbookTransactionId
    ) {
      throw new ConflictException('Bank statement line is already matched');
    }
    return line;
  }

  private exactCashbookMatchWhere(line: {
    tenantId: string;
    amount: Prisma.Decimal;
    currency: string;
    transactionDate: Date;
    reconciliation: { cashAccountId: string };
  }): Prisma.CashbookTransactionWhereInput {
    const isInflow = line.amount.greaterThan(0);
    const cashAccountId = line.reconciliation.cashAccountId;
    return {
      tenantId: line.tenantId,
      status: CashbookTransactionStatus.POSTED,
      currency: line.currency,
      amount: line.amount.abs(),
      transactionDate: {
        gte: this.startOfDay(line.transactionDate.toISOString()),
        lte: this.endOfDay(line.transactionDate.toISOString()),
      },
      OR: isInflow
        ? [
            { cashAccountId, direction: CashbookDirection.INFLOW },
            {
              destinationCashAccountId: cashAccountId,
              direction: CashbookDirection.TRANSFER,
            },
          ]
        : [
            { cashAccountId, direction: CashbookDirection.OUTFLOW },
            { cashAccountId, direction: CashbookDirection.TRANSFER },
          ],
    };
  }

  private assertCsvFile(
    file: ImportFile | undefined,
  ): asserts file is ImportFile {
    if (!file) throw new BadRequestException('CSV file is required');
    if (file.size === 0) throw new BadRequestException('CSV file is empty');
    if (file.size > MAX_CSV_BYTES) {
      throw new BadRequestException(
        `CSV file must be ${MAX_CSV_BYTES} bytes or smaller`,
      );
    }
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are supported');
    }
  }

  private parseStatementCsv(
    csv: string,
    reconciliation: {
      currency: string;
      statementStartDate: Date;
      statementEndDate: Date;
    },
  ): StatementLineInput[] {
    const rows = this.parseCsvRows(csv.replace(/^\uFEFF/, ''));
    if (rows.length < 2)
      throw new BadRequestException(
        'CSV must contain a header and at least one line',
      );
    const headers = rows[0].map((header) => header.trim());
    const headerIndexes = new Map(
      headers.map((header, index) => [header.toLowerCase(), index]),
    );
    const missing = REQUIRED_STATEMENT_COLUMNS.filter(
      (column) => !headerIndexes.has(column.toLowerCase()),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `CSV is missing required columns: ${missing.join(', ')}`,
      );
    }
    const dataRows = rows
      .slice(1)
      .filter((cells) => cells.some((cell) => cell.trim() !== ''));
    if (dataRows.length === 0) {
      throw new BadRequestException(
        'CSV must contain at least one statement line',
      );
    }
    if (dataRows.length > MAX_CSV_ROWS) {
      throw new BadRequestException(
        `CSV can contain at most ${MAX_CSV_ROWS} statement lines`,
      );
    }
    const fingerprints = new Set<string>();
    return dataRows.map((cells, index) => {
      const rowNumber = index + 2;
      const value = (column: string) =>
        cells[headerIndexes.get(column.toLowerCase()) ?? -1]?.trim() ?? '';
      const transactionDate = this.parseDate(
        value('transactionDate'),
        'transactionDate',
        rowNumber,
      );
      const valueDate = value('valueDate')
        ? this.parseDate(value('valueDate'), 'valueDate', rowNumber)
        : null;
      if (
        transactionDate < reconciliation.statementStartDate ||
        transactionDate > reconciliation.statementEndDate
      ) {
        throw new BadRequestException(
          `Row ${rowNumber}: transactionDate is outside the reconciliation statement range`,
        );
      }
      const amount = this.parseAmount(value('amount'), 'amount', rowNumber);
      if (amount === 0)
        throw new BadRequestException(
          `Row ${rowNumber}: amount must not be zero`,
        );
      const currency = value('currency').toUpperCase();
      if (currency !== reconciliation.currency) {
        throw new BadRequestException(
          `Row ${rowNumber}: currency must match the reconciliation currency`,
        );
      }
      const runningBalance = value('runningBalance')
        ? this.parseAmount(value('runningBalance'), 'runningBalance', rowNumber)
        : null;
      const description = value('description') || null;
      const bankReference = value('bankReference') || null;
      const counterpartyName = value('counterpartyName') || null;
      const sourceFingerprint = this.fingerprint([
        transactionDate.toISOString(),
        valueDate?.toISOString() ?? '',
        amount.toFixed(4),
        currency,
        description ?? '',
        bankReference ?? '',
        counterpartyName ?? '',
        runningBalance?.toFixed(4) ?? '',
      ]);
      if (fingerprints.has(sourceFingerprint)) {
        throw new BadRequestException(
          `Row ${rowNumber}: duplicate statement line in CSV`,
        );
      }
      fingerprints.add(sourceFingerprint);
      return {
        rowNumber,
        transactionDate,
        valueDate,
        amount,
        currency,
        description,
        bankReference,
        counterpartyName,
        runningBalance,
        sourceFingerprint,
      };
    });
  }

  private parseCsvRows(csv: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let inQuotes = false;
    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      const next = csv[index + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          index += 1;
        } else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        if (char === '\r' && next === '\n') index += 1;
      } else value += char;
    }
    if (inQuotes)
      throw new BadRequestException(
        'CSV contains an unterminated quoted value',
      );
    if (value.length > 0 || row.length > 0) rows.push([...row, value]);
    return rows;
  }

  private parseDate(value: string, column: string, rowNumber: number) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `Row ${rowNumber}: ${column} must be a valid ISO date`,
      );
    }
    return date;
  }

  private parseAmount(value: string, column: string, rowNumber: number) {
    if (!/^-?\d+(\.\d{1,4})?$/.test(value)) {
      throw new BadRequestException(
        `Row ${rowNumber}: ${column} must be a number with at most 4 decimals`,
      );
    }
    return Number(value);
  }

  private fingerprint(values: string[]) {
    return createHash('sha256').update(values.join('\u001F')).digest('hex');
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

  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
