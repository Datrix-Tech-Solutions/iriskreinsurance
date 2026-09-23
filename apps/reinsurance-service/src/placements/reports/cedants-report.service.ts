import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  CedantReportCurrencyAmountDto,
  CedantReportCurrencyTotalsDto,
  CedantReportRowDto,
  CedantsReportResponseDto,
} from './dto/cedants-report-response.dto';
import {
  CedantsReportSortField,
  QueryCedantsReportDto,
} from './dto/query-cedants-report.dto';

type SqlNumber = Prisma.Decimal | string | number | null;

type CedantReportRawCurrencyAmount = {
  currency: string;
  amount: SqlNumber;
};

type CedantReportRawRow = {
  cedantId: string;
  name: string;
  placementCount: bigint | number | string;
  totalPremiumByCurrency: unknown;
  outstandingByCurrency: unknown;
  pendingByCurrency: unknown;
  totalPremium: SqlNumber;
  outstanding: SqlNumber;
  pending: SqlNumber;
  totalCount: bigint | number | string;
};

type CedantReportRawSummaryRow = {
  currency: string | null;
  activeCedants: bigint | number | string;
  cedantsWithOutstanding: bigint | number | string;
  placementCount: bigint | number | string;
  sumInsured: SqlNumber;
  premium: SqlNumber;
  brokerage: SqlNumber;
  commission: SqlNumber;
  totalPremium: SqlNumber;
  received: SqlNumber;
  mandatoryDeductions: SqlNumber;
  effectiveSettlementCredit: SqlNumber;
  outstanding: SqlNumber;
  pending: SqlNumber;
};

type DateRange = {
  from?: Date;
  to?: Date;
};

@Injectable()
export class CedantsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findCedants(
    tenantId: string,
    query: QueryCedantsReportDto,
  ): Promise<CedantsReportResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<CedantReportRawRow[]>(
      this.rowsQuery(tenantId, query, limit, offset),
    );
    const summaryRows = await this.prisma.$queryRaw<
      CedantReportRawSummaryRow[]
    >(this.summaryQuery(tenantId, query));
    const total = rows[0] ? this.toInteger(rows[0].totalCount) : 0;

    return {
      items: rows.map((row) => this.toRowDto(row)),
      summary: this.toSummaryDto(summaryRows),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportCedantsCsv(
    tenantId: string,
    query: QueryCedantsReportDto,
  ): Promise<string> {
    const rows = await this.prisma.$queryRaw<CedantReportRawRow[]>(
      this.rowsQuery(tenantId, query, 50_000, 0),
    );
    const header = [
      'Cedant',
      'Currency',
      'Offers',
      'Total Premium',
      'Outstanding',
      'Pending',
    ];
    const lines = [header, ...rows.flatMap((row) => this.toCsvRows(row))].map(
      (cells) => cells.map((cell) => this.csvEscape(cell)).join(','),
    );
    return `${lines.join('\n')}\n`;
  }

  private rowsQuery(
    tenantId: string,
    query: QueryCedantsReportDto,
    limit: number,
    offset: number,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        filtered.*,
        COUNT(*) OVER() AS "totalCount"
      FROM filtered_cedants filtered
      ORDER BY ${this.sortExpression(query.sortBy)} ${this.sortDirection(query.sortOrder)}
        NULLS LAST,
        filtered."name" ASC,
        filtered."cedantId" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  private summaryQuery(
    tenantId: string,
    query: QueryCedantsReportDto,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        COALESCE("currency", 'UNKNOWN') AS "currency",
        (SELECT COUNT(*) FROM filtered_cedants) AS "activeCedants",
        (
          SELECT COUNT(*)
          FROM filtered_cedants
          WHERE "outstanding" > 0.0001
        ) AS "cedantsWithOutstanding",
        SUM("placementCount") AS "placementCount",
        SUM("sumInsured") AS "sumInsured",
        SUM("premium") AS "premium",
        SUM("brokerage") AS "brokerage",
        SUM("commission") AS "commission",
        SUM("totalPremium") AS "totalPremium",
        SUM("received") AS "received",
        SUM("mandatoryDeductions") AS "mandatoryDeductions",
        SUM("effectiveSettlementCredit") AS "effectiveSettlementCredit",
        SUM("outstanding") AS "outstanding",
        SUM("pending") AS "pending"
      FROM filtered_cedant_currency
      GROUP BY COALESCE("currency", 'UNKNOWN')
      ORDER BY COALESCE("currency", 'UNKNOWN') ASC
    `;
  }

  private reportCtes(
    tenantId: string,
    query: QueryCedantsReportDto,
  ): Prisma.Sql {
    const dateRange = this.dateRange(query);
    const datePredicate = this.inceptionDatePredicate(dateRange);
    const currencyPredicate = query.currency?.length
      ? Prisma.sql`AND p."currency" IN (${Prisma.join(query.currency)})`
      : Prisma.empty;
    const cedantPredicate = query.cedantId?.length
      ? Prisma.sql`AND p."cedantId" IN (${Prisma.join(query.cedantId)})`
      : Prisma.empty;
    const riskTypePredicate = query.riskTypeId?.length
      ? Prisma.sql`AND p."riskTypeId" IN (${Prisma.join(query.riskTypeId)})`
      : Prisma.empty;
    const statusPredicate = query.placementStatus?.length
      ? Prisma.sql`AND p."status" IN (${Prisma.join(query.placementStatus)})`
      : Prisma.empty;
    const searchPredicate = this.searchPredicate(query.search);
    const paymentStatusPredicate = query.paymentStatus?.length
      ? Prisma.sql`WHERE cc."paymentStatus" IN (${Prisma.join(query.paymentStatus)})`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_placements AS (
        SELECT
          p."id",
          p."cedantId",
          c."name" AS "cedantName",
          p."currency",
          p."sumInsured",
          p."premium",
          p."status"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = p."cedantId"
         AND c."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_type" rt
          ON rt."id" = p."riskTypeId"
         AND rt."tenantId" = p."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          ${datePredicate}
          ${currencyPredicate}
          ${cedantPredicate}
          ${riskTypePredicate}
          ${statusPredicate}
          ${searchPredicate}
      ),
      snapshot_candidates AS (
        SELECT
          pc."placementId",
          pc."participantId" AS "snapshotKey",
          COALESCE(pc."grossPremium", 0) AS "grossPremium",
          COALESCE(pc."commissionAmount", 0) AS "commission",
          COALESCE(pc."brokerageAmount", 0) AS "brokerage",
          COALESCE(pc."netPremium", 0) AS "netPremium",
          COALESCE(pc."grossPremium" - COALESCE(pc."commissionAmount", 0), pc."netPremium", 0) AS "cedantObligation",
          GREATEST(
            COALESCE(pc."grossPremium" - COALESCE(pc."commissionAmount", 0), pc."netPremium", 0)
              - COALESCE(pc."netPremium", 0),
            0
          ) AS "mandatoryDeductions",
          0 AS "sourceRank",
          NULL::timestamp AS "effectiveDate",
          NULL::timestamp AS "endorsementCreatedAt",
          NULL::text AS "endorsementId",
          pc."createdAt",
          pc."id"
        FROM "reinsurance"."PlacementClosing" pc
        JOIN base_placements bp ON bp."id" = pc."placementId"
        WHERE pc."tenantId" = ${tenantId}
          AND pc."status" = 'CONFIRMED'

        UNION ALL

        SELECT
          ec."placementId",
          COALESCE(
            ep."originalParticipantId",
            ec."endorsementParticipantId"
          ) AS "snapshotKey",
          COALESCE(ec."premiumSnapshot", 0) AS "grossPremium",
          COALESCE(ec."commissionAmount", 0) AS "commission",
          COALESCE(ec."brokerageAmount", 0) AS "brokerage",
          COALESCE(ec."netPremium", 0) AS "netPremium",
          COALESCE(ec."premiumSnapshot" - COALESCE(ec."commissionAmount", 0), ec."netPremium", 0) AS "cedantObligation",
          GREATEST(
            COALESCE(ec."premiumSnapshot" - COALESCE(ec."commissionAmount", 0), ec."netPremium", 0)
              - COALESCE(ec."netPremium", 0),
            0
          ) AS "mandatoryDeductions",
          1 AS "sourceRank",
          e."effectiveDate",
          e."createdAt" AS "endorsementCreatedAt",
          e."id" AS "endorsementId",
          ec."createdAt",
          ec."id"
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
          AND e."status" = 'CLOSED'
          AND e."effectiveDate" <= NOW()
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
                sc."endorsementId" DESC NULLS LAST,
                sc."createdAt" DESC,
                sc."id" DESC
            ) AS rn
          FROM snapshot_candidates sc
        ) ranked
        WHERE ranked.rn = 1
      ),
      closing_rollup AS (
        SELECT
          es."placementId",
          SUM(es."grossPremium") AS "grossPremium",
          SUM(es."commission") AS "commission",
          SUM(es."brokerage") AS "brokerage",
          SUM(es."netPremium") AS "netPremium",
          SUM(es."cedantObligation") AS "cedantObligation",
          SUM(es."mandatoryDeductions") AS "mandatoryDeductions"
        FROM effective_snapshots es
        GROUP BY es."placementId"
      ),
      payment_rollup AS (
        SELECT
          pay."placementId",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'BANK_CONFIRMED'
          ) AS "received",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'RECORDED'
          ) AS "pending"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."reversalOfPaymentId" IS NULL
        GROUP BY pay."placementId"
      ),
      placement_financials AS (
        SELECT
          bp."id",
          bp."cedantId",
          bp."cedantName",
          COALESCE(bp."currency", 'UNKNOWN') AS "currency",
          COALESCE(bp."sumInsured", 0) AS "sumInsured",
          COALESCE(bp."premium", 0) AS "premium",
          COALESCE(cr."brokerage", 0) AS "brokerage",
          COALESCE(cr."commission", 0) AS "commission",
          COALESCE(cr."cedantObligation", 0) AS "totalPremium",
          COALESCE(pr."received", 0) AS "received",
          COALESCE(cr."mandatoryDeductions", 0) AS "mandatoryDeductions",
          COALESCE(pr."received", 0) + COALESCE(cr."mandatoryDeductions", 0) AS "effectiveSettlementCredit",
          GREATEST(
            COALESCE(cr."cedantObligation", 0)
              - (COALESCE(pr."received", 0) + COALESCE(cr."mandatoryDeductions", 0)),
            0
          ) AS "outstanding",
          COALESCE(pr."pending", 0) AS "pending",
          CASE
            WHEN COALESCE(cr."cedantObligation", 0) > 0
             AND COALESCE(cr."cedantObligation", 0)
                   - (COALESCE(pr."received", 0) + COALESCE(cr."mandatoryDeductions", 0)) <= 0.0001
              THEN 'Paid'
            WHEN COALESCE(pr."received", 0) + COALESCE(cr."mandatoryDeductions", 0) > 0.0001
              THEN 'Part Payment'
            WHEN COALESCE(pr."pending", 0) > 0.0001
              THEN 'Pending'
            ELSE 'Outstanding'
          END AS "paymentStatus"
        FROM base_placements bp
        LEFT JOIN closing_rollup cr ON cr."placementId" = bp."id"
        LEFT JOIN payment_rollup pr ON pr."placementId" = bp."id"
      ),
      filtered_placements AS (
        SELECT *
        FROM placement_financials cc
        ${paymentStatusPredicate}
      ),
      filtered_cedant_currency AS (
        SELECT
          "cedantId",
          "cedantName",
          "currency",
          COUNT(*) AS "placementCount",
          SUM("sumInsured") AS "sumInsured",
          SUM("premium") AS "premium",
          SUM("brokerage") AS "brokerage",
          SUM("commission") AS "commission",
          SUM("totalPremium") AS "totalPremium",
          SUM("received") AS "received",
          SUM("mandatoryDeductions") AS "mandatoryDeductions",
          SUM("effectiveSettlementCredit") AS "effectiveSettlementCredit",
          SUM("outstanding") AS "outstanding",
          SUM("pending") AS "pending"
        FROM filtered_placements
        GROUP BY "cedantId", "cedantName", "currency"
      ),
      filtered_cedants AS (
        SELECT
          "cedantId",
          "cedantName" AS "name",
          SUM("placementCount") AS "placementCount",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "totalPremium")
            ORDER BY "currency"
          ) AS "totalPremiumByCurrency",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "outstanding")
            ORDER BY "currency"
          ) AS "outstandingByCurrency",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "pending")
            ORDER BY "currency"
          ) AS "pendingByCurrency",
          SUM("totalPremium") AS "totalPremium",
          SUM("outstanding") AS "outstanding",
          SUM("pending") AS "pending"
        FROM filtered_cedant_currency
        GROUP BY "cedantId", "cedantName"
      )
    `;
  }

  private inceptionDatePredicate(dateRange: DateRange): Prisma.Sql {
    const from = dateRange.from
      ? Prisma.sql`AND p."inceptionDate" >= ${dateRange.from}`
      : Prisma.empty;
    const to = dateRange.to
      ? Prisma.sql`AND p."inceptionDate" <= ${dateRange.to}`
      : Prisma.empty;
    return Prisma.sql`${from} ${to}`;
  }

  private searchPredicate(search?: string): Prisma.Sql {
    const trimmed = search?.trim();
    if (!trimmed) return Prisma.empty;
    const pattern = `%${trimmed}%`;
    return Prisma.sql`
      AND (
        p."reference" ILIKE ${pattern}
        OR p."policyNumber" ILIKE ${pattern}
        OR p."title" ILIKE ${pattern}
        OR c."name" ILIKE ${pattern}
        OR rt."name" ILIKE ${pattern}
      )
    `;
  }

  private sortExpression(sortBy?: CedantsReportSortField): Prisma.Sql {
    const sorts: Record<CedantsReportSortField, Prisma.Sql> = {
      name: Prisma.sql`filtered."name"`,
      placementCount: Prisma.sql`filtered."placementCount"`,
      totalPremium: Prisma.sql`filtered."totalPremium"`,
      outstanding: Prisma.sql`filtered."outstanding"`,
      pending: Prisma.sql`filtered."pending"`,
    };
    return sorts[sortBy ?? 'totalPremium'];
  }

  private sortDirection(sortOrder?: string): Prisma.Sql {
    return sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private dateRange(query: QueryCedantsReportDto): DateRange {
    return {
      from: this.parseStartDate(query.dateFrom),
      to: this.parseEndDate(query.dateTo),
    };
  }

  private parseStartDate(value?: string): Date | undefined {
    if (!value) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }
    return new Date(value);
  }

  private parseEndDate(value?: string): Date | undefined {
    if (!value) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T23:59:59.999Z`);
    }
    return new Date(value);
  }

  private toRowDto(row: CedantReportRawRow): CedantReportRowDto {
    return {
      cedantId: row.cedantId,
      name: row.name,
      placementCount: this.toInteger(row.placementCount),
      totalPremiumByCurrency: this.parseCurrencyAmounts(
        row.totalPremiumByCurrency,
      ),
      outstandingByCurrency: this.parseCurrencyAmounts(
        row.outstandingByCurrency,
      ),
      pendingByCurrency: this.parseCurrencyAmounts(row.pendingByCurrency),
      totalPremium: this.toMoneyNumber(row.totalPremium),
      outstanding: this.toMoneyNumber(row.outstanding),
      pending: this.toMoneyNumber(row.pending),
    };
  }

  private toSummaryDto(
    rows: CedantReportRawSummaryRow[],
  ): CedantsReportResponseDto['summary'] {
    const totalsByCurrency = rows.map((row) => this.toCurrencyTotalsDto(row));
    return {
      activeCedants: rows[0] ? this.toInteger(rows[0].activeCedants) : 0,
      totalPlacements: totalsByCurrency.reduce(
        (sum, row) => sum + row.placementCount,
        0,
      ),
      cedantsWithOutstanding: rows[0]
        ? this.toInteger(rows[0].cedantsWithOutstanding)
        : 0,
      totalsByCurrency,
    };
  }

  private toCurrencyTotalsDto(
    row: CedantReportRawSummaryRow,
  ): CedantReportCurrencyTotalsDto {
    return {
      currency: row.currency ?? 'UNKNOWN',
      placementCount: this.toInteger(row.placementCount),
      sumInsured: this.toMoneyNumber(row.sumInsured),
      premium: this.toMoneyNumber(row.premium),
      brokerage: this.toMoneyNumber(row.brokerage),
      commission: this.toMoneyNumber(row.commission),
      nicLevy: 0,
      wht: 0,
      totalPremium: this.toMoneyNumber(row.totalPremium),
      received: this.toMoneyNumber(row.received),
      mandatoryDeductions: this.toMoneyNumber(row.mandatoryDeductions),
      effectiveSettlementCredit: this.toMoneyNumber(
        row.effectiveSettlementCredit,
      ),
      outstanding: this.toMoneyNumber(row.outstanding),
      pending: this.toMoneyNumber(row.pending),
    };
  }

  private parseCurrencyAmounts(
    value: unknown,
  ): CedantReportCurrencyAmountDto[] {
    const rows = Array.isArray(value) ? value : [];
    return rows
      .map((item) => {
        const row = item as CedantReportRawCurrencyAmount;
        return {
          currency: row.currency ?? 'UNKNOWN',
          amount: this.toMoneyNumber(row.amount),
        };
      })
      .filter((row) => Math.abs(row.amount) > 0.0001);
  }

  private toCsvRows(row: CedantReportRawRow): string[][] {
    const dto = this.toRowDto(row);
    const currencies = new Set([
      ...dto.totalPremiumByCurrency.map((item) => item.currency),
      ...dto.outstandingByCurrency.map((item) => item.currency),
      ...dto.pendingByCurrency.map((item) => item.currency),
    ]);
    if (currencies.size === 0) currencies.add('UNKNOWN');
    return [...currencies]
      .sort()
      .map((currency) => [
        dto.name,
        currency,
        String(dto.placementCount),
        this.csvNumber(this.amountFor(dto.totalPremiumByCurrency, currency)),
        this.csvNumber(this.amountFor(dto.outstandingByCurrency, currency)),
        this.csvNumber(this.amountFor(dto.pendingByCurrency, currency)),
      ]);
  }

  private amountFor(
    rows: CedantReportCurrencyAmountDto[],
    currency: string,
  ): number {
    return rows.find((row) => row.currency === currency)?.amount ?? 0;
  }

  private csvNumber(value: number): string {
    return String(value);
  }

  private csvEscape(value: string): string {
    if (!/[",\n\r]/.test(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
  }

  private toMoneyNumber(value: SqlNumber): number {
    return this.money.roundMoney(this.money.toNumber(value ?? 0));
  }

  private toInteger(value: bigint | number | string): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }
}
