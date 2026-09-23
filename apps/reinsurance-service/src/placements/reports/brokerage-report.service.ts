import { Injectable } from '@nestjs/common';
import { PlacementStatus, Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  BrokerageReportCurrencyTotalsDto,
  BrokerageReportResponseDto,
  BrokerageReportRowDto,
} from './dto/brokerage-report-response.dto';
import {
  BrokerageReportScope,
  BrokerageReportSortField,
  QueryBrokerageReportDto,
} from './dto/query-brokerage-report.dto';
import { PremiumReportDateBasis } from './dto/query-premiums-report.dto';
import { csvToExcelHtml, formatExportPeriod } from './report-excel-export';

type SqlNumber = Prisma.Decimal | string | number | null;

type BrokerageReportRawRow = {
  id: string;
  placementId: string;
  policyNumber: string | null;
  title: string;
  cedantId: string;
  cedantName: string;
  reinsurerId: string | null;
  reinsurerName: string | null;
  riskTypeId: string | null;
  policyType: string | null;
  status: PlacementStatus;
  inceptionDate: Date | string | null;
  expiryDate: Date | string | null;
  currency: string | null;
  sumInsured: SqlNumber;
  premium: SqlNumber;
  exchangeRate: SqlNumber;
  grossPremium: SqlNumber;
  brokerageAmount: SqlNumber;
  brokeragePaid: SqlNumber;
  withholdingTax: SqlNumber;
  withholdingTaxPaid: SqlNumber;
  nicLevy: SqlNumber;
  nicLevyPaid: SqlNumber;
  paymentStatus: 'Outstanding' | 'Pending' | 'Part Payment' | 'Paid';
  totalCount: bigint | number | string;
};

type BrokerageReportRawSummaryRow = {
  currency: string | null;
  placementCount: bigint | number | string;
  participantCount: bigint | number | string;
  premium: SqlNumber;
  grossPremium: SqlNumber;
  brokerageAmount: SqlNumber;
  brokeragePaid: SqlNumber;
  withholdingTax: SqlNumber;
  withholdingTaxPaid: SqlNumber;
  nicLevy: SqlNumber;
  nicLevyPaid: SqlNumber;
};

type DateRange = {
  from?: Date;
  to?: Date;
};

@Injectable()
export class BrokerageReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findBrokerage(
    tenantId: string,
    query: QueryBrokerageReportDto,
  ): Promise<BrokerageReportResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;
    const scope = query.scope ?? 'reinsurer';

    const rows = await this.prisma.$queryRaw<BrokerageReportRawRow[]>(
      this.rowsQuery(tenantId, query, limit, offset),
    );
    const summaryRows = await this.prisma.$queryRaw<
      BrokerageReportRawSummaryRow[]
    >(this.summaryQuery(tenantId, query));
    const total = rows[0] ? this.toInteger(rows[0].totalCount) : 0;

    return {
      items: rows.map((row) => this.toRowDto(row)),
      summary: this.toSummaryDto(scope, summaryRows),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportBrokerageCsv(
    tenantId: string,
    query: QueryBrokerageReportDto,
  ): Promise<string> {
    const rows = await this.prisma.$queryRaw<BrokerageReportRawRow[]>(
      this.rowsQuery(tenantId, query, 50_000, 0),
    );
    const header = [
      'Policy Number',
      'Reinsurer',
      'Insured',
      'Policy Type',
      'Cedants',
      'Period of Insurance',
      'Currency',
      '100% S.I',
      '100% Premium',
      'Fac Premium',
      'Exchange Rate',
      'Full Brokerage Amount',
      'Brokerage Paid',
      'WHT',
      'WHT Paid',
      'NIC Levy',
      'NIC Levy Paid',
      'Payment Status',
    ];
    const lines = [header, ...rows.map((row) => this.toCsvRow(row))].map(
      (cells) => cells.map((cell) => this.csvEscape(cell)).join(','),
    );
    return `${lines.join('\n')}\n`;
  }

  async exportBrokerageExcel(
    tenantId: string,
    query: QueryBrokerageReportDto,
  ): Promise<string> {
    const csv = await this.exportBrokerageCsv(tenantId, query);
    return csvToExcelHtml(csv, 'Brokerage Report');
  }

  private rowsQuery(
    tenantId: string,
    query: QueryBrokerageReportDto,
    limit: number,
    offset: number,
  ): Prisma.Sql {
    const scope = query.scope ?? 'reinsurer';
    const table =
      scope === 'cedant'
        ? Prisma.sql`filtered_placements`
        : Prisma.sql`filtered_participants`;

    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        filtered.*,
        COUNT(*) OVER() AS "totalCount"
      FROM ${table} filtered
      ORDER BY ${this.sortExpression(query.sortBy)} ${this.sortDirection(query.sortOrder)}
        NULLS LAST,
        filtered."policyNumber" ASC,
        filtered."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  private summaryQuery(
    tenantId: string,
    query: QueryBrokerageReportDto,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      ,
      summary_source AS (
        SELECT *
        FROM filtered_participants
      ),
      placement_premiums AS (
        SELECT
          "currency",
          "placementId",
          MAX("premium") AS "premium"
        FROM summary_source
        GROUP BY "currency", "placementId"
      ),
      currency_premiums AS (
        SELECT
          "currency",
          SUM("premium") AS "premium"
        FROM placement_premiums
        GROUP BY "currency"
      )
      SELECT
        COALESCE(scoped."currency", 'UNKNOWN') AS "currency",
        COUNT(DISTINCT scoped."placementId") AS "placementCount",
        COUNT(scoped."reinsurerId") AS "participantCount",
        COALESCE(MAX(cp."premium"), 0) AS "premium",
        SUM(scoped."grossPremium") AS "grossPremium",
        SUM(scoped."brokerageAmount") AS "brokerageAmount",
        SUM(scoped."brokeragePaid") AS "brokeragePaid",
        SUM(scoped."withholdingTax") AS "withholdingTax",
        SUM(scoped."withholdingTaxPaid") AS "withholdingTaxPaid",
        SUM(scoped."nicLevy") AS "nicLevy",
        SUM(scoped."nicLevyPaid") AS "nicLevyPaid"
      FROM summary_source scoped
      LEFT JOIN currency_premiums cp
        ON cp."currency" IS NOT DISTINCT FROM scoped."currency"
      GROUP BY COALESCE(scoped."currency", 'UNKNOWN')
      ORDER BY COALESCE(scoped."currency", 'UNKNOWN') ASC
    `;
  }

  private reportCtes(
    tenantId: string,
    query: QueryBrokerageReportDto,
  ): Prisma.Sql {
    const dateRange = this.dateRange(query);
    const datePredicate = this.datePredicate(query.dateBasis, dateRange);
    const currencyPredicate = query.currency?.length
      ? Prisma.sql`AND p."currency" IN (${Prisma.join(query.currency)})`
      : Prisma.empty;
    const cedantPredicate = query.cedantId?.length
      ? Prisma.sql`AND p."cedantId" IN (${Prisma.join(query.cedantId)})`
      : Prisma.empty;
    const reinsurerPredicate = query.reinsurerId?.length
      ? Prisma.sql`AND br."reinsurerId" IN (${Prisma.join(query.reinsurerId)})`
      : Prisma.empty;
    const riskTypePredicate = query.riskTypeId?.length
      ? Prisma.sql`AND p."riskTypeId" IN (${Prisma.join(query.riskTypeId)})`
      : Prisma.empty;
    const statusPredicate = query.placementStatus?.length
      ? Prisma.sql`AND p."status" IN (${Prisma.join(query.placementStatus)})`
      : Prisma.empty;
    const searchPredicate = this.searchPredicate(query.search);
    const paymentStatusPredicate = query.paymentStatus?.length
      ? Prisma.sql`AND br."paymentStatus" IN (${Prisma.join(query.paymentStatus)})`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_placements AS (
        SELECT
          p."id",
          p."policyNumber",
          COALESCE(p."title", p."reference", p."policyNumber") AS "title",
          p."cedantId",
          c."name" AS "cedantName",
          p."riskTypeId",
          rt."name" AS "policyType",
          p."status",
          p."createdAt",
          p."inceptionDate",
          p."expiryDate",
          p."currency",
          p."sumInsured",
          p."premium",
          CASE
            WHEN cur."isBaseCurrency" THEN 1
            ELSE cur."exchangeRateToBase"
          END AS "exchangeRate"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = p."cedantId"
         AND c."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_type" rt
          ON rt."id" = p."riskTypeId"
         AND rt."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_class" rc
          ON rc."id" = rt."riskClassId"
         AND rc."tenantId" = rt."tenantId"
        LEFT JOIN "reinsurance"."Currency" cur
          ON cur."tenantId" = p."tenantId"
         AND cur."isoCode" = p."currency"
         AND cur."archivedAt" IS NULL
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
          pc."id",
          pc."placementId",
          pc."participantId" AS "snapshotKey",
          pp."counterpartyId" AS "reinsurerId",
          cp."name" AS "reinsurerName",
          COALESCE(pc."grossPremium", 0) AS "grossPremium",
          COALESCE(pc."commissionAmount", 0) AS "commission",
          COALESCE(pc."brokerageAmount", 0) AS "brokerageAmount",
          COALESCE(pc."netPremium", 0) AS "netPremium",
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
          COALESCE(ec."premiumSnapshot", 0) AS "grossPremium",
          COALESCE(ec."commissionAmount", 0) AS "commission",
          COALESCE(ec."brokerageAmount", 0) AS "brokerageAmount",
          COALESCE(ec."netPremium", 0) AS "netPremium",
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
      effective_snapshots_with_notes AS (
        SELECT
          es.*,
          COALESCE(note."brokerageAmount", es."brokerageAmount") AS "effectiveBrokerageAmount",
          COALESCE(note."withholdingTaxAmount", 0) AS "withholdingTaxAmount",
          COALESCE(note."nicLevyAmount", 0) AS "nicLevyAmount"
        FROM effective_snapshots es
        LEFT JOIN LATERAL (
          SELECT
            n."brokerageAmount",
            n."withholdingTaxAmount",
            n."nicLevyAmount"
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
              OR (
                n."closingId" IS NULL
                AND n."endorsementClosingId" IS NULL
              )
            )
          ORDER BY
            CASE
              WHEN n."closingId" = es."id" OR n."endorsementClosingId" = es."id"
                THEN 0
              ELSE 1
            END,
            n."issuedAt" DESC NULLS LAST,
            n."createdAt" DESC,
            n."id" DESC
          LIMIT 1
        ) note ON true
      ),
      closing_rollup AS (
        SELECT
          "placementId",
          SUM("grossPremium" - "commission") AS "cedantObligation"
        FROM effective_snapshots_with_notes
        GROUP BY "placementId"
      ),
      premium_payment_rollup AS (
        SELECT
          pay."placementId",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'BANK_CONFIRMED'
          ) AS "premiumReceived",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'RECORDED'
          ) AS "premiumPending"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."type" = 'PREMIUM_RECEIVED'
          AND pay."reversalOfPaymentId" IS NULL
        GROUP BY pay."placementId"
      ),
      brokerage_rows AS (
        SELECT
          CONCAT(bp."id", ':', es."snapshotKey") AS "id",
          bp."id" AS "placementId",
          bp."policyNumber",
          bp."title",
          bp."cedantId",
          bp."cedantName",
          es."reinsurerId",
          es."reinsurerName",
          bp."riskTypeId",
          bp."policyType",
          bp."status",
          bp."inceptionDate",
          bp."expiryDate",
          bp."currency",
          bp."sumInsured",
          bp."premium",
          bp."exchangeRate",
          es."grossPremium",
          COALESCE(es."effectiveBrokerageAmount", 0) AS "brokerageAmount",
          CASE
            WHEN COALESCE(cr."cedantObligation", 0) > 0.0001
              THEN COALESCE(es."effectiveBrokerageAmount", 0) * LEAST(
                1,
                GREATEST(
                  0,
                  COALESCE(pp."premiumReceived", 0) / COALESCE(cr."cedantObligation", 0)
                )
              )
            ELSE 0
          END AS "brokeragePaid",
          COALESCE(es."withholdingTaxAmount", 0) AS "withholdingTax",
          CASE
            WHEN COALESCE(cr."cedantObligation", 0) > 0.0001
              THEN COALESCE(es."withholdingTaxAmount", 0) * LEAST(
                1,
                GREATEST(
                  0,
                  COALESCE(pp."premiumReceived", 0) / COALESCE(cr."cedantObligation", 0)
                )
              )
            ELSE 0
          END AS "withholdingTaxPaid",
          COALESCE(es."nicLevyAmount", 0) AS "nicLevy",
          CASE
            WHEN COALESCE(cr."cedantObligation", 0) > 0.0001
              THEN COALESCE(es."nicLevyAmount", 0) * LEAST(
                1,
                GREATEST(
                  0,
                  COALESCE(pp."premiumReceived", 0) / COALESCE(cr."cedantObligation", 0)
                )
              )
            ELSE 0
          END AS "nicLevyPaid",
          CASE
            WHEN COALESCE(cr."cedantObligation", 0) > 0
             AND COALESCE(cr."cedantObligation", 0)
                   - COALESCE(pp."premiumReceived", 0) <= 0.0001
              THEN 'Paid'
            WHEN COALESCE(pp."premiumReceived", 0) > 0.0001
              THEN 'Part Payment'
            WHEN COALESCE(pp."premiumPending", 0) > 0.0001
              THEN 'Pending'
            ELSE 'Outstanding'
          END AS "paymentStatus"
        FROM base_placements bp
        JOIN effective_snapshots_with_notes es ON es."placementId" = bp."id"
        LEFT JOIN closing_rollup cr ON cr."placementId" = bp."id"
        LEFT JOIN premium_payment_rollup pp ON pp."placementId" = bp."id"
      ),
      filtered_participants AS (
        SELECT br.*
        FROM brokerage_rows br
        WHERE 1 = 1
          ${reinsurerPredicate}
          ${paymentStatusPredicate}
      ),
      filtered_placements AS (
        SELECT
          bp."id",
          bp."id" AS "placementId",
          bp."policyNumber",
          bp."title",
          bp."cedantId",
          bp."cedantName",
          NULL::text AS "reinsurerId",
          NULL::text AS "reinsurerName",
          bp."riskTypeId",
          bp."policyType",
          bp."status",
          bp."inceptionDate",
          bp."expiryDate",
          bp."currency",
          bp."sumInsured",
          bp."premium",
          bp."exchangeRate",
          SUM(br."grossPremium") AS "grossPremium",
          SUM(br."brokerageAmount") AS "brokerageAmount",
          SUM(br."brokeragePaid") AS "brokeragePaid",
          NULL::numeric AS "withholdingTax",
          NULL::numeric AS "withholdingTaxPaid",
          NULL::numeric AS "nicLevy",
          NULL::numeric AS "nicLevyPaid",
          MAX(br."paymentStatus") AS "paymentStatus"
        FROM base_placements bp
        JOIN brokerage_rows br ON br."placementId" = bp."id"
        WHERE 1 = 1
          ${paymentStatusPredicate}
        GROUP BY
          bp."id",
          bp."policyNumber",
          bp."title",
          bp."cedantId",
          bp."cedantName",
          bp."riskTypeId",
          bp."policyType",
          bp."status",
          bp."inceptionDate",
          bp."expiryDate",
          bp."currency",
          bp."sumInsured",
          bp."premium",
          bp."exchangeRate"
      )
    `;
  }

  private datePredicate(
    dateBasis: PremiumReportDateBasis | undefined,
    dateRange: DateRange,
  ): Prisma.Sql {
    const rangePredicate = (column: Prisma.Sql): Prisma.Sql => {
      const from = dateRange.from
        ? Prisma.sql`AND ${column} >= ${dateRange.from}`
        : Prisma.empty;
      const to = dateRange.to
        ? Prisma.sql`AND ${column} <= ${dateRange.to}`
        : Prisma.empty;
      return Prisma.sql`${from} ${to}`;
    };

    if (!dateRange.from && !dateRange.to) return Prisma.empty;
    switch (dateBasis ?? 'INCEPTION_DATE') {
      case 'PLACEMENT_CREATED':
        return rangePredicate(Prisma.sql`p."createdAt"`);
      case 'EXPIRY_DATE':
        return rangePredicate(Prisma.sql`p."expiryDate"`);
      case 'CLOSING_CONFIRMED_AT':
        return Prisma.sql`
          AND EXISTS (
            SELECT 1
            FROM "reinsurance"."PlacementClosing" pc_date
            WHERE pc_date."tenantId" = p."tenantId"
              AND pc_date."placementId" = p."id"
              AND pc_date."status" = 'CONFIRMED'
              ${rangePredicate(Prisma.sql`COALESCE(pc_date."confirmedAt", pc_date."issuedAt", pc_date."createdAt")`)}
            UNION ALL
            SELECT 1
            FROM "reinsurance"."PlacementEndorsementClosing" ec_date
            JOIN "reinsurance"."PlacementEndorsement" e_date
              ON e_date."id" = ec_date."endorsementId"
             AND e_date."tenantId" = ec_date."tenantId"
            WHERE ec_date."tenantId" = p."tenantId"
              AND ec_date."placementId" = p."id"
              AND ec_date."status" = 'CONFIRMED'
              AND e_date."status" = 'CLOSED'
              ${rangePredicate(Prisma.sql`COALESCE(ec_date."confirmedAt", ec_date."createdAt")`)}
          )
        `;
      case 'PAYMENT_DATE':
      case 'BANK_CONFIRMED_AT': {
        const column =
          dateBasis === 'BANK_CONFIRMED_AT'
            ? Prisma.sql`pay_date."bankConfirmedAt"`
            : Prisma.sql`pay_date."paymentDate"`;
        return Prisma.sql`
          AND EXISTS (
            SELECT 1
            FROM "reinsurance"."PlacementPayment" pay_date
            WHERE pay_date."tenantId" = p."tenantId"
              AND pay_date."placementId" = p."id"
              AND pay_date."type" = 'PREMIUM_RECEIVED'
              AND pay_date."reversalOfPaymentId" IS NULL
              ${rangePredicate(column)}
          )
        `;
      }
      case 'INCEPTION_DATE':
      default:
        return rangePredicate(Prisma.sql`p."inceptionDate"`);
    }
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
        OR rc."name" ILIKE ${pattern}
      )
    `;
  }

  private sortExpression(sortBy?: BrokerageReportSortField): Prisma.Sql {
    const sorts: Record<BrokerageReportSortField, Prisma.Sql> = {
      policyNumber: Prisma.sql`filtered."policyNumber"`,
      cedantName: Prisma.sql`filtered."cedantName"`,
      reinsurerName: Prisma.sql`filtered."reinsurerName"`,
      inceptionDate: Prisma.sql`filtered."inceptionDate"`,
      expiryDate: Prisma.sql`filtered."expiryDate"`,
      premium: Prisma.sql`filtered."premium"`,
      grossPremium: Prisma.sql`filtered."grossPremium"`,
      brokerageAmount: Prisma.sql`filtered."brokerageAmount"`,
      brokeragePaid: Prisma.sql`filtered."brokeragePaid"`,
      paymentStatus: Prisma.sql`filtered."paymentStatus"`,
    };
    return sorts[sortBy ?? 'inceptionDate'];
  }

  private sortDirection(sortOrder?: string): Prisma.Sql {
    return sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private dateRange(query: QueryBrokerageReportDto): DateRange {
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

  private toRowDto(row: BrokerageReportRawRow): BrokerageReportRowDto {
    return {
      id: row.id,
      placementId: row.placementId,
      policyNumber: row.policyNumber,
      title: row.title,
      cedantId: row.cedantId,
      cedantName: row.cedantName,
      reinsurerId: row.reinsurerId,
      reinsurerName: row.reinsurerName,
      riskTypeId: row.riskTypeId,
      policyType: row.policyType,
      status: row.status,
      inceptionDate: this.toIsoOrNull(row.inceptionDate),
      expiryDate: this.toIsoOrNull(row.expiryDate),
      currency: row.currency,
      sumInsured: this.toOptionalMoneyNumber(row.sumInsured),
      premium: this.toOptionalMoneyNumber(row.premium),
      exchangeRate: this.toOptionalMoneyNumber(row.exchangeRate),
      grossPremium: this.toOptionalMoneyNumber(row.grossPremium),
      brokerageAmount: this.toOptionalMoneyNumber(row.brokerageAmount),
      brokeragePaid: this.toOptionalMoneyNumber(row.brokeragePaid),
      withholdingTax: this.toOptionalMoneyNumber(row.withholdingTax),
      withholdingTaxPaid: this.toOptionalMoneyNumber(row.withholdingTaxPaid),
      nicLevy: this.toOptionalMoneyNumber(row.nicLevy),
      nicLevyPaid: this.toOptionalMoneyNumber(row.nicLevyPaid),
      paymentStatus: row.paymentStatus,
    };
  }

  private toSummaryDto(
    scope: BrokerageReportScope,
    rows: BrokerageReportRawSummaryRow[],
  ): BrokerageReportResponseDto['summary'] {
    const totalsByCurrency = rows.map((row) => this.toCurrencyTotalsDto(row));
    return {
      scope,
      placementCount: totalsByCurrency.reduce(
        (sum, row) => sum + row.placementCount,
        0,
      ),
      participantCount: totalsByCurrency.reduce(
        (sum, row) => sum + row.participantCount,
        0,
      ),
      totalsByCurrency,
    };
  }

  private toCurrencyTotalsDto(
    row: BrokerageReportRawSummaryRow,
  ): BrokerageReportCurrencyTotalsDto {
    return {
      currency: row.currency ?? 'UNKNOWN',
      placementCount: this.toInteger(row.placementCount),
      participantCount: this.toInteger(row.participantCount),
      premium: this.toMoneyNumber(row.premium),
      grossPremium: this.toMoneyNumber(row.grossPremium),
      brokerageAmount: this.toMoneyNumber(row.brokerageAmount),
      brokeragePaid: this.toMoneyNumber(row.brokeragePaid),
      withholdingTax: this.toMoneyNumber(row.withholdingTax),
      withholdingTaxPaid: this.toMoneyNumber(row.withholdingTaxPaid),
      nicLevy: this.toMoneyNumber(row.nicLevy),
      nicLevyPaid: this.toMoneyNumber(row.nicLevyPaid),
    };
  }

  private toCsvRow(row: BrokerageReportRawRow): string[] {
    const dto = this.toRowDto(row);
    return [
      dto.policyNumber ?? '',
      dto.reinsurerName ?? '',
      dto.title,
      dto.policyType ?? '',
      dto.cedantName,
      formatExportPeriod(dto.inceptionDate, dto.expiryDate),
      dto.currency ?? '',
      this.csvNumber(dto.sumInsured),
      this.csvNumber(dto.premium),
      this.csvNumber(dto.grossPremium),
      this.csvNumber(dto.exchangeRate),
      this.csvNumber(dto.brokerageAmount),
      this.csvNumber(dto.brokeragePaid),
      this.csvNumber(dto.withholdingTax),
      this.csvNumber(dto.withholdingTaxPaid),
      this.csvNumber(dto.nicLevy),
      this.csvNumber(dto.nicLevyPaid),
      dto.paymentStatus,
    ];
  }

  private toIsoOrNull(value: Date | string | null): string | null {
    if (!value) return null;
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }

  private csvNumber(value: number | null): string {
    return value == null ? '' : String(value);
  }

  private csvEscape(value: string): string {
    if (!/[",\n\r]/.test(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
  }

  private toOptionalMoneyNumber(value: SqlNumber): number | null {
    if (value == null) return null;
    return this.toMoneyNumber(value);
  }

  private toMoneyNumber(value: SqlNumber): number {
    return this.money.roundMoney(this.money.toNumber(value ?? 0));
  }

  private toInteger(value: bigint | number | string): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }
}
