import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  ReinsurerReportCurrencyAmountDto,
  ReinsurerReportCurrencyTotalsDto,
  ReinsurerReportRowDto,
  ReinsurersReportResponseDto,
} from './dto/reinsurers-report-response.dto';
import {
  QueryReinsurersReportDto,
  ReinsurersReportSortField,
} from './dto/query-reinsurers-report.dto';

type SqlNumber = Prisma.Decimal | string | number | null;

type ReinsurerReportRawCurrencyAmount = {
  currency: string;
  amount: SqlNumber;
};

type ReinsurerReportRawRow = {
  reinsurerId: string;
  name: string;
  placementCount: bigint | number | string;
  participantCount: bigint | number | string;
  cededPremiumByCurrency: unknown;
  payableByCurrency: unknown;
  disbursedByCurrency: unknown;
  outstandingByCurrency: unknown;
  pendingByCurrency: unknown;
  cededPremium: SqlNumber;
  payable: SqlNumber;
  disbursed: SqlNumber;
  outstanding: SqlNumber;
  pending: SqlNumber;
  totalCount: bigint | number | string;
};

type ReinsurerReportRawSummaryRow = {
  currency: string | null;
  activeReinsurers: bigint | number | string;
  reinsurersWithOutstanding: bigint | number | string;
  placementCount: bigint | number | string;
  participantCount: bigint | number | string;
  sumInsured: SqlNumber;
  cededPremium: SqlNumber;
  brokerage: SqlNumber;
  commission: SqlNumber;
  payable: SqlNumber;
  disbursed: SqlNumber;
  outstanding: SqlNumber;
  pending: SqlNumber;
};

type DateRange = {
  from?: Date;
  to?: Date;
};

@Injectable()
export class ReinsurersReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findReinsurers(
    tenantId: string,
    query: QueryReinsurersReportDto,
  ): Promise<ReinsurersReportResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<ReinsurerReportRawRow[]>(
      this.rowsQuery(tenantId, query, limit, offset),
    );
    const summaryRows = await this.prisma.$queryRaw<
      ReinsurerReportRawSummaryRow[]
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

  async exportReinsurersCsv(
    tenantId: string,
    query: QueryReinsurersReportDto,
  ): Promise<string> {
    const rows = await this.prisma.$queryRaw<ReinsurerReportRawRow[]>(
      this.rowsQuery(tenantId, query, 50_000, 0),
    );
    const header = [
      'Reinsurer',
      'Currency',
      'Placements',
      'Participants',
      'Ceded Premium',
      'Payable',
      'Disbursed',
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
    query: QueryReinsurersReportDto,
    limit: number,
    offset: number,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        filtered.*,
        COUNT(*) OVER() AS "totalCount"
      FROM filtered_reinsurers filtered
      ORDER BY ${this.sortExpression(query.sortBy)} ${this.sortDirection(query.sortOrder)}
        NULLS LAST,
        filtered."name" ASC,
        filtered."reinsurerId" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  private summaryQuery(
    tenantId: string,
    query: QueryReinsurersReportDto,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        COALESCE("currency", 'UNKNOWN') AS "currency",
        (SELECT COUNT(*) FROM filtered_reinsurers) AS "activeReinsurers",
        (
          SELECT COUNT(*)
          FROM filtered_reinsurers
          WHERE "outstanding" > 0.0001
        ) AS "reinsurersWithOutstanding",
        COUNT(DISTINCT "placementId") AS "placementCount",
        COUNT(*) AS "participantCount",
        SUM("sumInsured") AS "sumInsured",
        SUM("cededPremium") AS "cededPremium",
        SUM("brokerage") AS "brokerage",
        SUM("commission") AS "commission",
        SUM("payable") AS "payable",
        SUM("disbursed") AS "disbursed",
        SUM("outstanding") AS "outstanding",
        SUM("pending") AS "pending"
      FROM filtered_participants
      GROUP BY COALESCE("currency", 'UNKNOWN')
      ORDER BY COALESCE("currency", 'UNKNOWN') ASC
    `;
  }

  private reportCtes(
    tenantId: string,
    query: QueryReinsurersReportDto,
  ): Prisma.Sql {
    const dateRange = this.dateRange(query);
    const datePredicate = this.inceptionDatePredicate(dateRange);
    const currencyPredicate = query.currency?.length
      ? Prisma.sql`AND p."currency" IN (${Prisma.join(query.currency)})`
      : Prisma.empty;
    const reinsurerPredicate = query.reinsurerId?.length
      ? Prisma.sql`AND ps."reinsurerId" IN (${Prisma.join(query.reinsurerId)})`
      : Prisma.empty;
    const riskTypePredicate = query.riskTypeId?.length
      ? Prisma.sql`AND p."riskTypeId" IN (${Prisma.join(query.riskTypeId)})`
      : Prisma.empty;
    const statusPredicate = query.placementStatus?.length
      ? Prisma.sql`AND p."status" IN (${Prisma.join(query.placementStatus)})`
      : Prisma.empty;
    const searchPredicate = this.searchPredicate(query.search);
    const paymentStatusPredicate = query.paymentStatus?.length
      ? Prisma.sql`AND ps."paymentStatus" IN (${Prisma.join(query.paymentStatus)})`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_placements AS (
        SELECT
          p."id",
          p."riskTypeId",
          p."currency",
          p."status",
          rt."name" AS "riskTypeName",
          rc."name" AS "riskClassName"
        FROM "reinsurance"."Placement" p
        LEFT JOIN "reinsurance"."risk_type" rt
          ON rt."id" = p."riskTypeId"
         AND rt."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_class" rc
          ON rc."id" = rt."riskClassId"
         AND rc."tenantId" = p."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          ${datePredicate}
          ${currencyPredicate}
          ${riskTypePredicate}
          ${statusPredicate}
          ${searchPredicate}
      ),
      snapshot_candidates AS (
        SELECT
          pc."id",
          pc."placementId",
          pc."participantId" AS "snapshotKey",
          pp."counterpartyId" AS "reinsurerId",
          cp."name" AS "reinsurerName",
          bp."currency",
          COALESCE(pc."sumInsured", 0) AS "sumInsured",
          COALESCE(pc."grossPremium", 0) AS "cededPremium",
          COALESCE(pc."commissionAmount", 0) AS "commission",
          COALESCE(pc."brokerageAmount", 0) AS "brokerage",
          COALESCE(pc."netPremium", 0) AS "payable",
          0 AS "sourceRank",
          NULL::timestamp AS "effectiveDate",
          NULL::timestamp AS "endorsementCreatedAt",
          NULL::text AS "endorsementId",
          pc."createdAt"
        FROM "reinsurance"."PlacementClosing" pc
        JOIN base_placements bp ON bp."id" = pc."placementId"
        JOIN "reinsurance"."PlacementParticipant" pp
          ON pp."id" = pc."participantId"
         AND pp."tenantId" = pc."tenantId"
        JOIN "reinsurance"."Counterparty" cp
          ON cp."id" = pp."counterpartyId"
         AND cp."tenantId" = pp."tenantId"
        WHERE pc."tenantId" = ${tenantId}
          AND pc."status" = 'CONFIRMED'

        UNION ALL

        SELECT
          ec."id",
          ec."placementId",
          COALESCE(
            ep."originalParticipantId",
            ec."endorsementParticipantId"
          ) AS "snapshotKey",
          ep."counterpartyId" AS "reinsurerId",
          cp."name" AS "reinsurerName",
          bp."currency",
          COALESCE(ec."sumInsuredSnapshot", 0) AS "sumInsured",
          COALESCE(ec."premiumSnapshot", 0) AS "cededPremium",
          COALESCE(ec."commissionAmount", 0) AS "commission",
          COALESCE(ec."brokerageAmount", 0) AS "brokerage",
          COALESCE(ec."netPremium", 0) AS "payable",
          1 AS "sourceRank",
          e."effectiveDate",
          e."createdAt" AS "endorsementCreatedAt",
          e."id" AS "endorsementId",
          ec."createdAt"
        FROM "reinsurance"."PlacementEndorsementClosing" ec
        JOIN base_placements bp ON bp."id" = ec."placementId"
        JOIN "reinsurance"."PlacementEndorsement" e
          ON e."id" = ec."endorsementId"
         AND e."tenantId" = ec."tenantId"
        JOIN "reinsurance"."PlacementEndorsementParticipant" ep
          ON ep."id" = ec."endorsementParticipantId"
         AND ep."tenantId" = ec."tenantId"
        JOIN "reinsurance"."Counterparty" cp
          ON cp."id" = ep."counterpartyId"
         AND cp."tenantId" = ep."tenantId"
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
      payment_rollup AS (
        SELECT
          pay."placementId",
          pay."participantId",
          pay."counterpartyId",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'REINSURER_DISBURSEMENT'
              AND pay."status" = 'BANK_CONFIRMED'
          ) AS "disbursed",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'REINSURER_DISBURSEMENT'
              AND pay."status" = 'RECORDED'
          ) AS "pending"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."type" = 'REINSURER_DISBURSEMENT'
          AND pay."reversalOfPaymentId" IS NULL
        GROUP BY pay."placementId", pay."participantId", pay."counterpartyId"
      ),
      participant_financials AS (
        SELECT
          es."placementId",
          es."snapshotKey" AS "participantId",
          es."reinsurerId",
          es."reinsurerName",
          COALESCE(es."currency", 'UNKNOWN') AS "currency",
          es."sumInsured",
          es."cededPremium",
          es."brokerage",
          es."commission",
          es."payable",
          COALESCE(pr."disbursed", 0) AS "disbursed",
          COALESCE(pr."pending", 0) AS "pending",
          GREATEST(es."payable" - COALESCE(pr."disbursed", 0), 0) AS "outstanding",
          CASE
            WHEN es."payable" > 0
             AND es."payable" - COALESCE(pr."disbursed", 0) <= 0.0001
              THEN 'Paid'
            WHEN COALESCE(pr."disbursed", 0) > 0.0001
              THEN 'Part Payment'
            WHEN COALESCE(pr."pending", 0) > 0.0001
              THEN 'Pending'
            ELSE 'Outstanding'
          END AS "paymentStatus"
        FROM effective_snapshots es
        LEFT JOIN payment_rollup pr
          ON pr."placementId" = es."placementId"
         AND (
           pr."participantId" = es."snapshotKey"
           OR (
             pr."participantId" IS NULL
             AND pr."counterpartyId" = es."reinsurerId"
           )
         )
      ),
      filtered_participants AS (
        SELECT *
        FROM participant_financials ps
        WHERE 1 = 1
          ${reinsurerPredicate}
        ${paymentStatusPredicate}
      ),
      filtered_reinsurer_currency AS (
        SELECT
          "reinsurerId",
          "reinsurerName",
          "currency",
          SUM("placementCount") AS "placementCount",
          COUNT(*) AS "participantCount",
          SUM("sumInsured") AS "sumInsured",
          SUM("cededPremium") AS "cededPremium",
          SUM("brokerage") AS "brokerage",
          SUM("commission") AS "commission",
          SUM("payable") AS "payable",
          SUM("disbursed") AS "disbursed",
          SUM("outstanding") AS "outstanding",
          SUM("pending") AS "pending"
        FROM filtered_participants
        GROUP BY "reinsurerId", "reinsurerName", "currency"
      ),
      filtered_reinsurers AS (
        SELECT
          "reinsurerId",
          "reinsurerName" AS "name",
          SUM("placementCount") AS "placementCount",
          SUM("participantCount") AS "participantCount",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "cededPremium")
            ORDER BY "currency"
          ) AS "cededPremiumByCurrency",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "payable")
            ORDER BY "currency"
          ) AS "payableByCurrency",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "disbursed")
            ORDER BY "currency"
          ) AS "disbursedByCurrency",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "outstanding")
            ORDER BY "currency"
          ) AS "outstandingByCurrency",
          JSONB_AGG(
            JSONB_BUILD_OBJECT('currency', "currency", 'amount', "pending")
            ORDER BY "currency"
          ) AS "pendingByCurrency",
          SUM("cededPremium") AS "cededPremium",
          SUM("payable") AS "payable",
          SUM("disbursed") AS "disbursed",
          SUM("outstanding") AS "outstanding",
          SUM("pending") AS "pending"
        FROM filtered_reinsurer_currency
        GROUP BY "reinsurerId", "reinsurerName"
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
        OR rt."name" ILIKE ${pattern}
        OR rc."name" ILIKE ${pattern}
      )
    `;
  }

  private sortExpression(sortBy?: ReinsurersReportSortField): Prisma.Sql {
    const sorts: Record<ReinsurersReportSortField, Prisma.Sql> = {
      name: Prisma.sql`filtered."name"`,
      placementCount: Prisma.sql`filtered."placementCount"`,
      cededPremium: Prisma.sql`filtered."cededPremium"`,
      outstanding: Prisma.sql`filtered."outstanding"`,
      pending: Prisma.sql`filtered."pending"`,
    };
    return sorts[sortBy ?? 'cededPremium'];
  }

  private sortDirection(sortOrder?: string): Prisma.Sql {
    return sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private dateRange(query: QueryReinsurersReportDto): DateRange {
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

  private toRowDto(row: ReinsurerReportRawRow): ReinsurerReportRowDto {
    return {
      reinsurerId: row.reinsurerId,
      name: row.name,
      placementCount: this.toInteger(row.placementCount),
      participantCount: this.toInteger(row.participantCount),
      cededPremiumByCurrency: this.parseCurrencyAmounts(
        row.cededPremiumByCurrency,
      ),
      payableByCurrency: this.parseCurrencyAmounts(row.payableByCurrency),
      disbursedByCurrency: this.parseCurrencyAmounts(row.disbursedByCurrency),
      outstandingByCurrency: this.parseCurrencyAmounts(
        row.outstandingByCurrency,
      ),
      pendingByCurrency: this.parseCurrencyAmounts(row.pendingByCurrency),
      cededPremium: this.toMoneyNumber(row.cededPremium),
      payable: this.toMoneyNumber(row.payable),
      disbursed: this.toMoneyNumber(row.disbursed),
      outstanding: this.toMoneyNumber(row.outstanding),
      pending: this.toMoneyNumber(row.pending),
    };
  }

  private toSummaryDto(
    rows: ReinsurerReportRawSummaryRow[],
  ): ReinsurersReportResponseDto['summary'] {
    const totalsByCurrency = rows.map((row) => this.toCurrencyTotalsDto(row));
    return {
      activeReinsurers: rows[0] ? this.toInteger(rows[0].activeReinsurers) : 0,
      totalPlacements: totalsByCurrency.reduce(
        (sum, row) => sum + row.placementCount,
        0,
      ),
      totalParticipants: totalsByCurrency.reduce(
        (sum, row) => sum + row.participantCount,
        0,
      ),
      reinsurersWithOutstanding: rows[0]
        ? this.toInteger(rows[0].reinsurersWithOutstanding)
        : 0,
      totalsByCurrency,
    };
  }

  private toCurrencyTotalsDto(
    row: ReinsurerReportRawSummaryRow,
  ): ReinsurerReportCurrencyTotalsDto {
    return {
      currency: row.currency ?? 'UNKNOWN',
      placementCount: this.toInteger(row.placementCount),
      participantCount: this.toInteger(row.participantCount),
      sumInsured: this.toMoneyNumber(row.sumInsured),
      cededPremium: this.toMoneyNumber(row.cededPremium),
      brokerage: this.toMoneyNumber(row.brokerage),
      commission: this.toMoneyNumber(row.commission),
      payable: this.toMoneyNumber(row.payable),
      disbursed: this.toMoneyNumber(row.disbursed),
      outstanding: this.toMoneyNumber(row.outstanding),
      pending: this.toMoneyNumber(row.pending),
    };
  }

  private parseCurrencyAmounts(
    value: unknown,
  ): ReinsurerReportCurrencyAmountDto[] {
    const rows = Array.isArray(value) ? value : [];
    return rows
      .map((item) => {
        const row = item as ReinsurerReportRawCurrencyAmount;
        return {
          currency: row.currency ?? 'UNKNOWN',
          amount: this.toMoneyNumber(row.amount),
        };
      })
      .filter((row) => Math.abs(row.amount) > 0.0001);
  }

  private toCsvRows(row: ReinsurerReportRawRow): string[][] {
    const dto = this.toRowDto(row);
    const currencies = new Set([
      ...dto.cededPremiumByCurrency.map((item) => item.currency),
      ...dto.payableByCurrency.map((item) => item.currency),
      ...dto.disbursedByCurrency.map((item) => item.currency),
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
        String(dto.participantCount),
        this.csvNumber(this.amountFor(dto.cededPremiumByCurrency, currency)),
        this.csvNumber(this.amountFor(dto.payableByCurrency, currency)),
        this.csvNumber(this.amountFor(dto.disbursedByCurrency, currency)),
        this.csvNumber(this.amountFor(dto.outstandingByCurrency, currency)),
        this.csvNumber(this.amountFor(dto.pendingByCurrency, currency)),
      ]);
  }

  private amountFor(
    rows: ReinsurerReportCurrencyAmountDto[],
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
