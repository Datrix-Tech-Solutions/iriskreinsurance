import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  BusinessExchangeCurrencyTotalsDto,
  BusinessExchangeReportResponseDto,
  BusinessExchangeReportRowDto,
} from './dto/business-exchange-report-response.dto';
import {
  BusinessExchangeSortField,
  QueryBusinessExchangeReportDto,
} from './dto/query-business-exchange-report.dto';
import { csvToExcelHtml } from './report-excel-export';
import {
  assertReportExportLimit,
  reportPopulationTotal,
} from './report-population';

type SqlNumber = Prisma.Decimal | string | number | null;

type RawRow = {
  insuranceCompany: string;
  currency: string | null;
  period: string;
  volumeGiven: bigint | number | string;
  volumeReceived: bigint | number | string;
  businessReceived: SqlNumber;
  netBalance: SqlNumber;
  netBrokerage: SqlNumber;
  totalCount: bigint | number | string;
};

type RawSummaryRow = {
  currency: string | null;
  companyCount: bigint | number | string;
  volumeGiven: bigint | number | string;
  volumeReceived: bigint | number | string;
  businessReceived: SqlNumber;
  netBalance: SqlNumber;
  netBrokerage: SqlNumber;
};

type PeriodWindow = { from?: Date; to?: Date };

/**
 * Business exchange between the broker and each insurance company.
 *
 * A company can exist as both a CEDANT and a REINSURER counterparty, so rows are
 * merged by the counterparty's normalized name. Placements are dated by their
 * entry date (`createdAt`, UTC), the report-wide default date basis.
 *
 * - volumeReceived: placements where the company is the cedant.
 * - businessReceived: gross premium (current confirmed closings) on those placements.
 * - volumeGiven: placements where the company is an ACCEPTED/CLOSED reinsurer.
 * - netBalance: businessReceived minus the gross premium ceded to the company.
 * - netBrokerage: effective brokerage (credit-note override applied) on placements
 *   where the company is the cedant, plus its own line where it is a reinsurer.
 *
 * Amounts stay in their native currency; currencies are never added together.
 */
@Injectable()
export class BusinessExchangeReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findBusinessExchange(
    tenantId: string,
    query: QueryBusinessExchangeReportDto,
  ): Promise<BusinessExchangeReportResponseDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        const offset = (page - 1) * limit;

        const rows = await tx.$queryRaw<RawRow[]>(
          this.rowsQuery(tenantId, query, limit, offset),
        );
        const summaryRows = await tx.$queryRaw<RawSummaryRow[]>(
          this.summaryQuery(tenantId, query),
        );
        const total = await reportPopulationTotal(
          tx,
          rows,
          this.reportCtes(tenantId, query),
          Prisma.sql`exchange_rows`,
        );

        return {
          items: rows.map((row) => this.toRowDto(row)),
          summary: {
            companyCount: summaryRows[0]
              ? Number(summaryRows[0].companyCount)
              : 0,
            totalsByCurrency: summaryRows.map((row) => this.toTotalsDto(row)),
          },
          meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async exportBusinessExchangeCsv(
    tenantId: string,
    query: QueryBusinessExchangeReportDto,
  ): Promise<string> {
    const rows = await this.prisma.$queryRaw<RawRow[]>(
      this.rowsQuery(tenantId, query, 50_000, 0),
    );
    assertReportExportLimit(rows);
    const header = [
      'Insurance Company',
      'Currency',
      'Period',
      'Volume of Business Given',
      'Volume of Business Received',
      'Business Received (Premium)',
      'Net Balance',
      'Net Brokerage',
    ];
    const body = rows.map((row) => {
      const dto = this.toRowDto(row);
      return [
        dto.insuranceCompany,
        dto.currency,
        dto.period,
        String(dto.volumeGiven),
        String(dto.volumeReceived),
        String(dto.businessReceived),
        String(dto.netBalance),
        String(dto.netBrokerage),
      ];
    });
    return `${[header, ...body]
      .map((cells) => cells.map((cell) => this.csvEscape(cell)).join(','))
      .join('\n')}\n`;
  }

  async exportBusinessExchangeExcel(
    tenantId: string,
    query: QueryBusinessExchangeReportDto,
  ): Promise<string> {
    const csv = await this.exportBusinessExchangeCsv(tenantId, query);
    return csvToExcelHtml(csv, 'Management Report');
  }

  private rowsQuery(
    tenantId: string,
    query: QueryBusinessExchangeReportDto,
    limit: number,
    offset: number,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        filtered.*,
        COUNT(*) OVER() AS "totalCount"
      FROM exchange_rows filtered
      ORDER BY ${this.sortExpression(query.sortBy)} ${this.sortDirection(query.sortOrder)}
        NULLS LAST,
        filtered."insuranceCompany" ASC,
        filtered."currency" ASC,
        filtered."period" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  private summaryQuery(
    tenantId: string,
    query: QueryBusinessExchangeReportDto,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        COALESCE("currency", 'UNKNOWN') AS "currency",
        (SELECT COUNT(DISTINCT "companyKey") FROM exchange_rows) AS "companyCount",
        SUM("volumeGiven") AS "volumeGiven",
        SUM("volumeReceived") AS "volumeReceived",
        SUM("businessReceived") AS "businessReceived",
        SUM("netBalance") AS "netBalance",
        SUM("netBrokerage") AS "netBrokerage"
      FROM exchange_rows
      GROUP BY COALESCE("currency", 'UNKNOWN')
      ORDER BY COALESCE("currency", 'UNKNOWN') ASC
    `;
  }

  private reportCtes(
    tenantId: string,
    query: QueryBusinessExchangeReportDto,
  ): Prisma.Sql {
    const window = this.periodWindow(query);
    const fromPredicate = window.from
      ? Prisma.sql`AND p."createdAt" >= ${window.from}`
      : Prisma.empty;
    const toPredicate = window.to
      ? Prisma.sql`AND p."createdAt" < ${window.to}`
      : Prisma.empty;
    const currencyPredicate = query.currency?.length
      ? Prisma.sql`AND p."currency" IN (${Prisma.join(query.currency)})`
      : Prisma.empty;
    const periodFormat =
      query.mode === 'yearly' ? Prisma.sql`'YYYY'` : Prisma.sql`'YYYY-MM'`;
    const search = query.search?.trim();
    const searchPredicate = search
      ? Prisma.sql`WHERE agg."insuranceCompany" ILIKE ${`%${search}%`}`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_placements AS (
        SELECT
          p."id",
          p."currency",
          to_char(p."createdAt", ${periodFormat}) AS "period",
          c."normalizedName" AS "cedantKey",
          c."name" AS "cedantName"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = p."cedantId"
         AND c."tenantId" = p."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          ${fromPredicate}
          ${toPredicate}
          ${currencyPredicate}
      ),
      snapshot_candidates AS (
        SELECT
          pc."id",
          pc."placementId",
          pc."participantId" AS "snapshotKey",
          pp."counterpartyId" AS "reinsurerId",
          pc."grossPremium",
          pc."brokerageAmount",
          pc."createdAt",
          0 AS "sourceRank",
          NULL::timestamp AS "effectiveDate",
          NULL::timestamp AS "endorsementCreatedAt",
          NULL::text AS "endorsementNumber",
          NULL::text AS "endorsementId",
          TRUE AS "isCurrentEligible"
        FROM "reinsurance"."PlacementClosing" pc
        JOIN base_placements bp ON bp."id" = pc."placementId"
        JOIN "reinsurance"."PlacementParticipant" pp
          ON pp."id" = pc."participantId"
         AND pp."tenantId" = pc."tenantId"
        WHERE pc."tenantId" = ${tenantId}
          AND pc."status" = 'CONFIRMED'

        UNION ALL

        SELECT
          ec."id",
          ec."placementId",
          COALESCE(ep."originalParticipantId", ec."endorsementParticipantId"),
          ep."counterpartyId",
          ec."premiumSnapshot",
          ec."brokerageAmount",
          ec."createdAt",
          1,
          e."effectiveDate",
          e."createdAt",
          e."endorsementNumber",
          e."id",
          (e."status" = 'CLOSED' AND e."effectiveDate" <= NOW())
        FROM "reinsurance"."PlacementEndorsementClosing" ec
        JOIN base_placements bp ON bp."id" = ec."placementId"
        JOIN "reinsurance"."PlacementEndorsement" e
          ON e."id" = ec."endorsementId"
         AND e."tenantId" = ec."tenantId"
        JOIN "reinsurance"."PlacementEndorsementParticipant" ep
          ON ep."id" = ec."endorsementParticipantId"
         AND ep."tenantId" = ec."tenantId"
        WHERE ec."tenantId" = ${tenantId}
          AND ec."status" = 'CONFIRMED'
      ),
      effective_snapshots AS (
        SELECT *
        FROM (
          SELECT
            sc.*,
            ROW_NUMBER() OVER (
              PARTITION BY sc."placementId", sc."snapshotKey"
              ORDER BY
                sc."sourceRank" DESC,
                sc."effectiveDate" DESC NULLS LAST,
                sc."endorsementCreatedAt" DESC NULLS LAST,
                sc."endorsementNumber" DESC NULLS LAST,
                sc."endorsementId" DESC NULLS LAST,
                sc."createdAt" DESC,
                sc."id" DESC
            ) AS rn
          FROM snapshot_candidates sc
          WHERE sc."isCurrentEligible"
        ) ranked
        WHERE ranked.rn = 1
      ),
      effective_snapshots_with_notes AS (
        SELECT
          es.*,
          COALESCE(note."brokerageAmount", es."brokerageAmount") AS "effectiveBrokerageAmount"
        FROM effective_snapshots es
        LEFT JOIN LATERAL (
          SELECT n."brokerageAmount"
          FROM "reinsurance"."PlacementNote" n
          WHERE n."tenantId" = ${tenantId}
            AND n."placementId" = es."placementId"
            AND n."counterpartyId" = es."reinsurerId"
            AND n."type" = 'CREDIT_NOTE'
            AND n."status" <> 'VOID'
            AND n."voidedAt" IS NULL
            AND (
              n."closingId" = es."id"
              OR n."endorsementClosingId" = es."id"
              OR (n."closingId" IS NULL AND n."endorsementClosingId" IS NULL)
            )
          ORDER BY
            CASE
              WHEN n."closingId" = es."id" OR n."endorsementClosingId" = es."id"
                THEN 0
              ELSE 1
            END,
            n."effectiveAsOf" DESC NULLS LAST,
            n."issuedAt" DESC NULLS LAST,
            n."createdAt" DESC,
            n."id" DESC
          LIMIT 1
        ) note ON TRUE
      ),
      placement_totals AS (
        SELECT
          es."placementId",
          SUM(COALESCE(es."grossPremium", 0)) AS "grossPremium",
          SUM(COALESCE(es."effectiveBrokerageAmount", 0)) AS "brokerage"
        FROM effective_snapshots_with_notes es
        GROUP BY es."placementId"
      ),
      accepted_participation AS (
        SELECT DISTINCT
          bp."id" AS "placementId",
          bp."currency",
          bp."period",
          cp."normalizedName" AS "companyKey",
          cp."name" AS "companyName"
        FROM "reinsurance"."PlacementParticipant" pp
        JOIN base_placements bp ON bp."id" = pp."placementId"
        JOIN "reinsurance"."Counterparty" cp
          ON cp."id" = pp."counterpartyId"
         AND cp."tenantId" = pp."tenantId"
        WHERE pp."tenantId" = ${tenantId}
          AND pp."role" IN ('REINSURER', 'LEAD_REINSURER', 'CO_REINSURER')
          AND pp."status" IN ('ACCEPTED', 'CLOSED')
      ),
      facts AS (
        -- Business received: one row per placement, attributed to its cedant.
        SELECT
          bp."cedantKey" AS "companyKey",
          bp."cedantName" AS "companyName",
          bp."currency",
          bp."period",
          0 AS "volumeGiven",
          1 AS "volumeReceived",
          COALESCE(pt."grossPremium", 0) AS "businessReceived",
          0 AS "premiumGiven",
          COALESCE(pt."brokerage", 0) AS "brokerage"
        FROM base_placements bp
        LEFT JOIN placement_totals pt ON pt."placementId" = bp."id"

        UNION ALL

        -- Business given: one row per placement per accepted reinsurer company.
        SELECT
          ap."companyKey", ap."companyName", ap."currency", ap."period",
          1, 0, 0, 0, 0
        FROM accepted_participation ap

        UNION ALL

        -- Premium and brokerage ceded to the company's own reinsurer lines.
        SELECT
          cp."normalizedName", cp."name", bp."currency", bp."period",
          0, 0, 0,
          COALESCE(es."grossPremium", 0),
          COALESCE(es."effectiveBrokerageAmount", 0)
        FROM effective_snapshots_with_notes es
        JOIN base_placements bp ON bp."id" = es."placementId"
        JOIN "reinsurance"."Counterparty" cp
          ON cp."id" = es."reinsurerId"
         AND cp."tenantId" = ${tenantId}
      ),
      exchange_rows AS (
        SELECT * FROM (
          SELECT
            agg."companyKey",
            agg."companyName" AS "insuranceCompany",
            agg."currency",
            agg."period",
            agg."volumeGiven",
            agg."volumeReceived",
            agg."businessReceived",
            agg."businessReceived" - agg."premiumGiven" AS "netBalance",
            agg."brokerage" AS "netBrokerage"
          FROM (
            SELECT
              f."companyKey",
              MIN(f."companyName") AS "companyName",
              f."currency",
              f."period",
              SUM(f."volumeGiven") AS "volumeGiven",
              SUM(f."volumeReceived") AS "volumeReceived",
              SUM(f."businessReceived") AS "businessReceived",
              SUM(f."premiumGiven") AS "premiumGiven",
              SUM(f."brokerage") AS "brokerage"
            FROM facts f
            GROUP BY f."companyKey", f."currency", f."period"
          ) agg
          ${searchPredicate}
        ) searched
      )
    `;
  }

  /** Calendar window on the placement entry date; undefined bounds are open. */
  private periodWindow(query: QueryBusinessExchangeReportDto): PeriodWindow {
    if (query.mode === 'yearly') {
      if (query.year === undefined) return {};
      return {
        from: new Date(Date.UTC(query.year, 0, 1)),
        to: new Date(Date.UTC(query.year + 1, 0, 1)),
      };
    }
    const year = query.year ?? new Date().getUTCFullYear();
    if (query.month === undefined) {
      return {
        from: new Date(Date.UTC(year, 0, 1)),
        to: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }
    return {
      from: new Date(Date.UTC(year, query.month - 1, 1)),
      to: new Date(Date.UTC(year, query.month, 1)),
    };
  }

  private sortExpression(sortBy?: BusinessExchangeSortField): Prisma.Sql {
    const sorts: Record<BusinessExchangeSortField, Prisma.Sql> = {
      insuranceCompany: Prisma.sql`filtered."insuranceCompany"`,
      period: Prisma.sql`filtered."period"`,
      volumeGiven: Prisma.sql`filtered."volumeGiven"`,
      volumeReceived: Prisma.sql`filtered."volumeReceived"`,
      businessReceived: Prisma.sql`filtered."businessReceived"`,
      netBalance: Prisma.sql`filtered."netBalance"`,
      netBrokerage: Prisma.sql`filtered."netBrokerage"`,
    };
    return sorts[sortBy ?? 'insuranceCompany'];
  }

  private sortDirection(sortOrder?: string): Prisma.Sql {
    return sortOrder === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  }

  private toRowDto(row: RawRow): BusinessExchangeReportRowDto {
    return {
      insuranceCompany: row.insuranceCompany,
      currency: row.currency ?? 'UNKNOWN',
      period: row.period,
      volumeGiven: Number(row.volumeGiven),
      volumeReceived: Number(row.volumeReceived),
      businessReceived: this.toMoneyNumber(row.businessReceived),
      netBalance: this.toMoneyNumber(row.netBalance),
      netBrokerage: this.toMoneyNumber(row.netBrokerage),
    };
  }

  private toTotalsDto(row: RawSummaryRow): BusinessExchangeCurrencyTotalsDto {
    return {
      currency: row.currency ?? 'UNKNOWN',
      volumeGiven: Number(row.volumeGiven),
      volumeReceived: Number(row.volumeReceived),
      businessReceived: this.toMoneyNumber(row.businessReceived),
      netBalance: this.toMoneyNumber(row.netBalance),
      netBrokerage: this.toMoneyNumber(row.netBrokerage),
    };
  }

  private csvEscape(value: string): string {
    if (!/[",\n\r]/.test(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
  }

  private toMoneyNumber(value: SqlNumber): number {
    return this.money.roundMoney(this.money.toNumber(value ?? 0));
  }
}
