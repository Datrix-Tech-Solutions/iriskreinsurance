import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArchiveDatasetDto } from './dto/historical-statements-response.dto';
import {
  ArchiveFiltersDto,
  ArchiveExportQueryDto,
  StatementKind,
} from './dto/historical-statements-query.dto';
import { CE_FIELDS, RE_FIELDS, DATE_FIELDS } from './loader/source-contract';

export type ArchiveTx = Prisma.TransactionClient;
export type ArchiveRecord = Record<string, unknown>;
export interface ArchiveSelection {
  tenantId: string;
  dataset: ArchiveDatasetDto;
}
const table = (kind: StatementKind) =>
  Prisma.raw(
    kind === StatementKind.INSURER
      ? 'reinsurance.historical_insurer_statement'
      : 'reinsurance.historical_reinsurer_statement',
  );
export const sourceFields = (kind: StatementKind) =>
  kind === StatementKind.INSURER ? CE_FIELDS : RE_FIELDS;
const column = (name: string, alias = 's') => Prisma.raw(`${alias}."${name}"`);
const contains = (value: string) =>
  '%' +
  value
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[!%_]/g, (c) => '!' + c) +
  '%';
const datasetSelect = Prisma.sql`id,"datasetKey","datasetVersion",status,"contractVersion",to_char("publishedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "publishedAt","validationSummary"`;
export function pagination(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
interface DatasetRecord {
  id: string;
  datasetKey: string;
  datasetVersion: string;
  contractVersion: string;
  publishedAt: string | null;
  validationSummary: Record<string, number>;
}
function dataset(row: DatasetRecord): ArchiveDatasetDto {
  const summary = row.validationSummary;
  return {
    id: row.id,
    datasetKey: row.datasetKey,
    datasetVersion: row.datasetVersion,
    status: 'PUBLISHED',
    contractVersion: row.contractVersion,
    publishedAt: row.publishedAt,
    fileCount: summary.fileCount,
    insurerRowCount: summary.insurerRowCount,
    reinsurerRowCount: summary.reinsurerRowCount,
    linkCount: summary.linkCount,
  };
}
@Injectable()
export class HistoricalStatementsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async read<T>(
    tenantId: string,
    fn: (tx: ArchiveTx) => Promise<T>,
  ): Promise<T> {
    if (!tenantId)
      throw new UnauthorizedException(
        'Tenant-scoped authentication is required',
      );
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return fn(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5000,
        timeout: 60000,
      },
    );
  }
  async published(
    tx: ArchiveTx,
    tenantId: string,
    id: string,
  ): Promise<ArchiveSelection> {
    const rows = await tx.$queryRaw<DatasetRecord[]>(
      Prisma.sql`SELECT ${datasetSelect} FROM reinsurance.historical_statement_load WHERE "tenantId"=${tenantId} AND id=${id} AND status='PUBLISHED'`,
    );
    if (rows.length !== 1)
      throw new NotFoundException('Published archive dataset not found');
    return { tenantId, dataset: dataset(rows[0]) };
  }
  async datasets(tx: ArchiveTx, tenantId: string, page: number, limit: number) {
    const [count] = await tx.$queryRaw<
      { total: string }[]
    >`SELECT count(*)::text AS total FROM reinsurance.historical_statement_load WHERE "tenantId"=${tenantId} AND status='PUBLISHED'`;
    const rows = await tx.$queryRaw<DatasetRecord[]>(
      Prisma.sql`SELECT ${datasetSelect} FROM reinsurance.historical_statement_load WHERE "tenantId"=${tenantId} AND status='PUBLISHED' ORDER BY "publishedAt" DESC,id ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    );
    return {
      items: rows.map(dataset),
      meta: pagination(page, limit, Number(count.total)),
    };
  }
  filter(
    kind: StatementKind,
    scope: ArchiveSelection,
    q: ArchiveFiltersDto,
  ): Prisma.Sql {
    if (q.offerDateFrom && q.offerDateTo && q.offerDateFrom > q.offerDateTo)
      throw new BadRequestException(
        'offerDateFrom must not exceed offerDateTo',
      );
    if (q.closedDateFrom && q.closedDateTo && q.closedDateFrom > q.closedDateTo)
      throw new BadRequestException(
        'closedDateFrom must not exceed closedDateTo',
      );
    const terms: Prisma.Sql[] = [
      Prisma.sql`s."tenantId"=${scope.tenantId}`,
      Prisma.sql`s."loadId"=${scope.dataset.id}`,
    ];
    if (q.year !== undefined) terms.push(Prisma.sql`s.year=${q.year}`);
    for (const [query, key] of [
      [q.policyNumber, 'policySearch'],
      [q.search, 'searchText'],
      [q.insured, 'insuredSearch'],
      [q.businessName, 'businessSearch'],
    ] as const)
      if (query?.trim())
        terms.push(
          Prisma.sql`${column(key)} LIKE ${contains(query)} ESCAPE '!'`,
        );
    if (q.insurer?.trim())
      terms.push(
        Prisma.sql`${column(kind === StatementKind.INSURER ? 'counterpartySearch' : 'reinsuredSearch')} LIKE ${contains(q.insurer)} ESCAPE '!'`,
      );
    if (q.reinsurer?.trim()) {
      if (kind === StatementKind.REINSURER)
        terms.push(
          Prisma.sql`s."counterpartySearch" LIKE ${contains(q.reinsurer)} ESCAPE '!'`,
        );
      else
        terms.push(
          Prisma.sql`EXISTS(SELECT 1 FROM reinsurance.historical_statement_link l JOIN reinsurance.historical_reinsurer_statement r ON r."tenantId"=l."tenantId" AND r."loadId"=l."loadId" AND r.id=l."reinsurerRowId" WHERE l."tenantId"=${scope.tenantId} AND l."loadId"=${scope.dataset.id} AND l."insurerRowId"=s.id AND r."counterpartySearch" LIKE ${contains(q.reinsurer)} ESCAPE '!')`,
        );
    }
    for (const [value, key] of [
      [q.currency, 'currency'],
      [q.offerStatus, 'offerStatus'],
      [q.paymentStatus, 'paymentStatus'],
    ] as const)
      if (value?.trim())
        terms.push(Prisma.sql`lower(${column(key)})=lower(${value.trim()})`);
    for (const [value, key, op] of [
      [q.offerDateFrom, 'offerDate', '>='],
      [q.offerDateTo, 'offerDate', '<='],
      [q.closedDateFrom, 'closedDate', '>='],
      [q.closedDateTo, 'closedDate', '<='],
    ] as const)
      if (value)
        terms.push(Prisma.sql`${column(key)} ${Prisma.raw(op)} ${value}::date`);
    return Prisma.join(terms, ' AND ');
  }
  order(
    kind: StatementKind,
    q: Pick<ArchiveExportQueryDto, 'sortBy' | 'sortOrder'>,
  ): Prisma.Sql {
    if (
      !['year', 'sourceRow', ...sourceFields(kind)].includes(q.sortBy) ||
      !['asc', 'desc'].includes(q.sortOrder)
    )
      throw new BadRequestException(
        'Unsupported statement sort field/direction for this kind',
      );
    return Prisma.sql`${column(q.sortBy)} ${Prisma.raw(q.sortOrder.toUpperCase())} NULLS LAST,s."fileId" ASC,s."sourceRow" ASC,s.id ASC`;
  }
  async count(
    tx: ArchiveTx,
    kind: StatementKind,
    scope: ArchiveSelection,
    where: Prisma.Sql,
  ): Promise<number> {
    const [row] = await tx.$queryRaw<{ total: string }[]>(
      Prisma.sql`SELECT count(*)::text AS total FROM ${table(kind)} s WHERE ${where} AND s."tenantId"=${scope.tenantId} AND s."loadId"=${scope.dataset.id}`,
    );
    return Number(row.total);
  }
  private select(kind: StatementKind, details: boolean) {
    const fields = sourceFields(kind).map((name) =>
      DATE_FIELDS.has(name)
        ? Prisma.sql`(to_char(${column(name)},'YYYY-MM-DD') || CASE WHEN ${column(name)} < DATE '0001-01-01' THEN ' BC' ELSE '' END) AS ${Prisma.raw('"' + name + '"')}`
        : Prisma.sql`${column(name)}::text AS ${Prisma.raw('"' + name + '"')}`,
    );
    return Prisma.sql`s.id,s."loadId" AS "datasetId",s.year,s."sourceRow",s."rowSha256",s."qualityFlags" AS "qualityWarnings",f."originalFileName" AS "sourceFileName",f."sheetName" AS "sourceSheetName",${Prisma.join(fields)},${details ? Prisma.sql`s."rawCells",f."headerCells"` : Prisma.sql`NULL::jsonb AS "rawCells",NULL::jsonb AS "headerCells"`}`;
  }
  async rows(
    tx: ArchiveTx,
    kind: StatementKind,
    scope: ArchiveSelection,
    where: Prisma.Sql,
    order: Prisma.Sql,
    limit: number,
    offset: number,
    details = false,
  ): Promise<ArchiveRecord[]> {
    return tx.$queryRaw<ArchiveRecord[]>(
      Prisma.sql`SELECT ${this.select(kind, details)} FROM ${table(kind)} s JOIN reinsurance.historical_statement_file f ON f."tenantId"=s."tenantId" AND f."loadId"=s."loadId" AND f.id=s."fileId" AND f.year=s.year WHERE ${where} AND f."tenantId"=${scope.tenantId} AND f."loadId"=${scope.dataset.id} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
    );
  }
  async row(
    tx: ArchiveTx,
    kind: StatementKind,
    scope: ArchiveSelection,
    id: string,
    details = true,
  ) {
    const where = Prisma.sql`s."tenantId"=${scope.tenantId} AND s."loadId"=${scope.dataset.id} AND s.id=${id}`;
    const rows = await this.rows(
      tx,
      kind,
      scope,
      where,
      Prisma.sql`s.id ASC`,
      1,
      0,
      details,
    );
    if (rows.length !== 1)
      throw new NotFoundException('Archive statement not found');
    return rows[0];
  }
  async links(
    tx: ArchiveTx,
    scope: ArchiveSelection,
    kind: StatementKind,
    id: string,
    limit = 200,
    offset = 0,
  ) {
    const key =
      kind === StatementKind.INSURER ? 'insurerRowId' : 'reinsurerRowId';
    return tx.$queryRaw<
      {
        matchId: string;
        basis: string;
        insurerRowId: string;
        reinsurerRowId: string;
      }[]
    >(
      Prisma.sql`SELECT l."matchId",l.basis::text,l."insurerRowId",l."reinsurerRowId" FROM reinsurance.historical_statement_link l WHERE l."tenantId"=${scope.tenantId} AND l."loadId"=${scope.dataset.id} AND ${column(key, 'l')}=${id} ORDER BY l.id ASC LIMIT ${limit} OFFSET ${offset}`,
    );
  }
  async linkCount(
    tx: ArchiveTx,
    scope: ArchiveSelection,
    kind: StatementKind,
    id: string,
  ) {
    const key =
      kind === StatementKind.INSURER ? 'insurerRowId' : 'reinsurerRowId';
    const [r] = await tx.$queryRaw<{ total: string }[]>(
      Prisma.sql`SELECT count(*)::text AS total FROM reinsurance.historical_statement_link l WHERE l."tenantId"=${scope.tenantId} AND l."loadId"=${scope.dataset.id} AND ${column(key, 'l')}=${id}`,
    );
    return Number(r.total);
  }
  async facets(
    tx: ArchiveTx,
    kind: StatementKind,
    scope: ArchiveSelection,
    where: Prisma.Sql,
  ) {
    const columns = {
      years: 'year',
      insurers:
        kind === StatementKind.INSURER ? 'insurerName' : 'reinsuredName',
      insureds: 'insuredName',
      businessNames: 'businessName',
      currencies: 'currency',
      offerStatuses: 'offerStatus',
      paymentStatuses: 'paymentStatus',
    };
    const out: Record<string, (string | number)[]> = {};
    for (const [key, field] of Object.entries(columns)) {
      const rows = await tx.$queryRaw<{ value: string | number }[]>(
        Prisma.sql`SELECT DISTINCT ${column(field)} AS value FROM ${table(kind)} s WHERE ${where} AND ${column(field)} IS NOT NULL ORDER BY value ASC`,
      );
      out[key] = rows.map((r) => r.value);
    }
    if (kind === StatementKind.REINSURER) {
      const rows = await tx.$queryRaw<{ value: string }[]>(
        Prisma.sql`SELECT DISTINCT s."reinsurerName" AS value FROM ${table(kind)} s WHERE ${where} AND s."reinsurerName" IS NOT NULL ORDER BY value ASC`,
      );
      out.reinsurers = rows.map((r) => r.value);
    } else {
      const rows = await tx.$queryRaw<{ value: string }[]>(
        Prisma.sql`SELECT DISTINCT r."reinsurerName" AS value FROM reinsurance.historical_statement_link l JOIN reinsurance.historical_reinsurer_statement r ON r."tenantId"=l."tenantId" AND r."loadId"=l."loadId" AND r.id=l."reinsurerRowId" JOIN reinsurance.historical_insurer_statement s ON s."tenantId"=l."tenantId" AND s."loadId"=l."loadId" AND s.id=l."insurerRowId" WHERE ${where} AND l."tenantId"=${scope.tenantId} AND l."loadId"=${scope.dataset.id} AND r."reinsurerName" IS NOT NULL ORDER BY value ASC`,
      );
      out.reinsurers = rows.map((r) => r.value);
    }
    return out;
  }
}
