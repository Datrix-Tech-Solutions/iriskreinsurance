import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ExcelJS from 'exceljs';
import { Prisma } from '../../prisma/generated/client';
import { RawCell, CE_HEADERS, RE_HEADERS } from './loader/source-contract';
import {
  ArchiveDatasetQueryDto,
  ArchiveExportQueryDto,
  ArchiveFacetsQueryDto,
  ArchiveListQueryDto,
  ArchivePageQueryDto,
  StatementKind,
} from './dto/historical-statements-query.dto';
import {
  HistoricalStatementsRepository,
  ArchiveRecord,
  sourceFields,
  pagination,
} from './historical-statements.repository';

function cells(value: unknown): RawCell[] {
  if (
    !Array.isArray(value) ||
    value.length !== 29 ||
    !value.every(
      (v: unknown, i: number) =>
        typeof v === 'object' &&
        v !== null &&
        'columnIndex' in v &&
        'resolvedText' in v &&
        v.columnIndex === i + 1 &&
        (v.resolvedText === null || typeof v.resolvedText === 'string'),
    )
  )
    throw new ConflictException('Archive source-cell contract is invalid');
  return value as RawCell[];
}
export function statementJson(
  kind: StatementKind,
  row: ArchiveRecord,
  details = false,
) {
  const result: ArchiveRecord = { kind };
  for (const field of [
    'id',
    'datasetId',
    'year',
    'sourceFileName',
    'sourceSheetName',
    'sourceRow',
    'rowSha256',
    'qualityWarnings',
    ...sourceFields(kind),
  ])
    result[field] = row[field];
  if (details) {
    const header = cells(row.headerCells);
    result.originalColumns = cells(row.rawCells).map((cell, i) => ({
      columnIndex: cell.columnIndex,
      columnLetter: cell.columnLetter,
      header: header[i].resolvedText,
      sourceAddress: cell.sourceAddress,
      state: cell.state,
      cellType: cell.type,
      value: cell.resolvedText,
      xmlValue: cell.xmlValue,
      styleIndex: cell.styleIndex,
      formula: cell.formula,
      cachedValue: cell.cachedValue,
      formulaAttributes: cell.formulaAttributes,
    }));
  }
  return result;
}
@Injectable()
export class HistoricalStatementsService {
  constructor(private readonly repository: HistoricalStatementsRepository) {}
  datasets(tenantId: string, q: ArchivePageQueryDto) {
    return this.repository.read(tenantId, (tx) =>
      this.repository.datasets(tx, tenantId, q.page, q.limit),
    );
  }
  list(tenantId: string, kind: StatementKind, q: ArchiveListQueryDto) {
    return this.repository.read(tenantId, async (tx) => {
      const scope = await this.repository.published(tx, tenantId, q.datasetId),
        where = this.repository.filter(kind, scope, q),
        order = this.repository.order(kind, q);
      const total = await this.repository.count(tx, kind, scope, where);
      const rows = await this.repository.rows(
        tx,
        kind,
        scope,
        where,
        order,
        q.limit,
        (q.page - 1) * q.limit,
      );
      return {
        dataset: scope.dataset,
        items: rows.map((r) => statementJson(kind, r)),
        meta: pagination(q.page, q.limit, total),
      };
    });
  }
  detail(
    tenantId: string,
    kind: StatementKind,
    id: string,
    q: ArchiveDatasetQueryDto,
  ) {
    return this.repository.read(tenantId, async (tx) => {
      const scope = await this.repository.published(tx, tenantId, q.datasetId);
      return {
        ...statementJson(
          kind,
          await this.repository.row(tx, kind, scope, id),
          true,
        ),
        dataset: scope.dataset,
      };
    });
  }
  linkedReinsurers(
    tenantId: string,
    id: string,
    q: ArchiveDatasetQueryDto,
    page: ArchivePageQueryDto,
  ) {
    return this.repository.read(tenantId, async (tx) => {
      const scope = await this.repository.published(tx, tenantId, q.datasetId);
      await this.repository.row(tx, StatementKind.INSURER, scope, id, false);
      const total = await this.repository.linkCount(
          tx,
          scope,
          StatementKind.INSURER,
          id,
        ),
        links = await this.repository.links(
          tx,
          scope,
          StatementKind.INSURER,
          id,
          page.limit,
          (page.page - 1) * page.limit,
        );
      const rows = links.length
        ? await this.repository.rows(
            tx,
            StatementKind.REINSURER,
            scope,
            Prisma.sql`s."tenantId"=${tenantId} AND s."loadId"=${scope.dataset.id} AND s.id IN (${Prisma.join(links.map((l) => l.reinsurerRowId))})`,
            Prisma.sql`s.id ASC`,
            page.limit,
            0,
          )
        : [];
      const byId = new Map(rows.map((r) => [String(r.id), r]));
      if (byId.size !== links.length)
        throw new InternalServerErrorException('Archive link integrity error');
      return {
        state: total ? 'LINKED' : 'UNLINKED',
        dataset: scope.dataset,
        insurerId: id,
        items: links.map((l) => ({
          link: { matchId: l.matchId, basis: l.basis },
          statement: statementJson(
            StatementKind.REINSURER,
            byId.get(l.reinsurerRowId)!,
          ),
        })),
        meta: pagination(page.page, page.limit, total),
      };
    });
  }
  linkedInsurer(tenantId: string, id: string, q: ArchiveDatasetQueryDto) {
    return this.repository.read(tenantId, async (tx) => {
      const scope = await this.repository.published(tx, tenantId, q.datasetId);
      await this.repository.row(tx, StatementKind.REINSURER, scope, id, false);
      const links = await this.repository.links(
        tx,
        scope,
        StatementKind.REINSURER,
        id,
        2,
      );
      if (links.length > 1)
        throw new InternalServerErrorException('Archive link integrity error');
      const link = links[0];
      return {
        state: link ? 'LINKED' : 'UNLINKED',
        dataset: scope.dataset,
        reinsurerId: id,
        item: link
          ? {
              link: { matchId: link.matchId, basis: link.basis },
              statement: statementJson(
                StatementKind.INSURER,
                await this.repository.row(
                  tx,
                  StatementKind.INSURER,
                  scope,
                  link.insurerRowId,
                  false,
                ),
              ),
            }
          : null,
      };
    });
  }
  facets(tenantId: string, q: ArchiveFacetsQueryDto) {
    return this.repository.read(tenantId, async (tx) => {
      const scope = await this.repository.published(tx, tenantId, q.datasetId);
      return {
        dataset: scope.dataset,
        kind: q.kind,
        ...(await this.repository.facets(
          tx,
          q.kind,
          scope,
          this.repository.filter(q.kind, scope, q),
        )),
      };
    });
  }
  async export(
    tenantId: string,
    kind: StatementKind,
    q: ArchiveExportQueryDto,
  ): Promise<StreamableFile> {
    const directory = await mkdtemp(join(tmpdir(), 'irisk-statement-export-')),
      path = join(directory, 'statements.xlsx');
    try {
      await this.repository.read(tenantId, async (tx) => {
        const scope = await this.repository.published(
            tx,
            tenantId,
            q.datasetId,
          ),
          where = this.repository.filter(kind, scope, q),
          order = this.repository.order(kind, q);
        const output = createWriteStream(path, { flags: 'wx', mode: 0o600 });
        let outputError: Error | undefined;
        const outputFailure = new Promise<never>((_resolve, reject) => {
          output.once('error', (error) => {
            outputError = error;
            reject(error);
          });
        });
        void outputFailure.catch(() => undefined);
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
          stream: output,
          useSharedStrings: false,
          useStyles: false,
        });
        const sheet = workbook.addWorksheet('Brokerage Statement');
        let header: string[] | undefined;
        try {
          for (let offset = 0; ; offset += 250) {
            if (outputError) throw outputError;
            const rows = await this.repository.rows(
              tx,
              kind,
              scope,
              where,
              order,
              250,
              offset,
              true,
            );
            for (const row of rows) {
              const sourceHeader = cells(row.headerCells).map(
                (c) => c.resolvedText ?? '',
              );
              if (!header) {
                header = sourceHeader;
                sheet.addRow(header).commit();
              } else if (header.some((v, i) => v !== sourceHeader[i]))
                throw new ConflictException(
                  'Filtered source files have incompatible physical headers',
                );
              // Explicit XLSX string cells preserve every decimal lexeme and cannot be formulas/hyperlinks.
              sheet
                .addRow(cells(row.rawCells).map((c) => c.resolvedText ?? ''))
                .commit();
            }
            if (rows.length < 250) break;
          }
          if (!header)
            sheet
              .addRow(kind === StatementKind.INSURER ? CE_HEADERS : RE_HEADERS)
              .commit();
          sheet.commit();
          await Promise.race([workbook.commit(), outputFailure]);
        } catch (error) {
          output.destroy();
          throw error;
        }
      });
      const fileSize = (await stat(path)).size;
      const stream = createReadStream(path);
      stream.once('close', () => {
        void rm(directory, { recursive: true, force: true }).catch(
          () => undefined,
        );
      });
      return new StreamableFile(stream, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: `attachment; filename="historical-${kind.toLowerCase()}-statements.xlsx"`,
        length: fileSize,
      });
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
}
