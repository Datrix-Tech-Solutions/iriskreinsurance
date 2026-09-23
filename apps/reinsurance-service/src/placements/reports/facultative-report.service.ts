import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  FacultativeReportCurrencyTotalsDto,
  FacultativeReportResponseDto,
  FacultativeReportRowDto,
  FacultativeReinsurerBreakdownDto,
} from './dto/facultative-report-response.dto';
import {
  FacultativeReportSortField,
  FacultativeReportScope,
  QueryFacultativeReportDto,
} from './dto/query-facultative-report.dto';
import { csvToExcelHtml, formatExportDate } from './report-excel-export';

type SqlNumber = Prisma.Decimal | string | number | null;

type DateRange = {
  from?: Date;
  to?: Date;
};

type FacultativeReportRawReinsurer = {
  reinsurerId: string;
  reinsurerName: string;
  sharePercent: SqlNumber;
  closedAt: Date | string | null;
  facSumInsured: SqlNumber;
  facPremium: SqlNumber;
  paidFacPremium: SqlNumber;
  brokerage: SqlNumber;
  brokeragePaid: SqlNumber;
  withholdingTax: SqlNumber;
  withholdingTaxPaid: SqlNumber;
  nicLevy: SqlNumber;
  nicLevyPaid: SqlNumber;
  netPremiumDueReinsurer: SqlNumber;
  netPremiumPaid: SqlNumber;
};

type FacultativeReportRawRow = {
  id: string;
  reference: string;
  policyNumber: string | null;
  title: string;
  cedantId: string;
  cedantName: string;
  classOfBusiness: string | null;
  riskClassId: string | null;
  riskClassName: string | null;
  offerDate: Date | string | null;
  closedAt: Date | string | null;
  sumInsured: SqlNumber;
  premium: SqlNumber;
  currency: string | null;
  commission: SqlNumber;
  facultativeOfferPercent: SqlNumber;
  totalOfferedPercent: SqlNumber;
  totalAcceptedPercent: SqlNumber;
  reinsurerCount: bigint | number | string;
  status: FacultativeReportRowDto['status'];
  inceptionDate: Date | string | null;
  expiryDate: Date | string | null;
  paymentStatus: FacultativeReportRowDto['paymentStatus'];
  facSumInsured: SqlNumber;
  facPremium: SqlNumber;
  paidFacPremium: SqlNumber;
  cedantCommissionPercent: SqlNumber;
  cedantCommissionAmount: SqlNumber;
  netPremiumDueIrisk: SqlNumber;
  netPremiumDueIriskPaid: SqlNumber;
  brokerage: SqlNumber;
  brokeragePaid: SqlNumber;
  netPremiumDueReinsurer: SqlNumber;
  netPremiumDueReinsurerPaid: SqlNumber;
  reinsurers: unknown;
  totalCount: bigint | number | string;
};

type FacultativeReportRawSummaryRow = {
  currency: string | null;
  placementCount: bigint | number | string;
  participantCount: bigint | number | string;
  sumInsured: SqlNumber;
  premium: SqlNumber;
  brokerage: SqlNumber;
  commission: SqlNumber;
  openOffers: bigint | number | string;
  acceptedOffers: bigint | number | string;
};

@Injectable()
export class FacultativeReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findFacultative(
    tenantId: string,
    query: QueryFacultativeReportDto,
  ): Promise<FacultativeReportResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<FacultativeReportRawRow[]>(
      this.rowsQuery(tenantId, query, limit, offset),
    );
    const summaryRows = await this.prisma.$queryRaw<
      FacultativeReportRawSummaryRow[]
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

  async exportFacultativeCsv(
    tenantId: string,
    query: QueryFacultativeReportDto,
  ): Promise<string> {
    const rows = await this.prisma.$queryRaw<FacultativeReportRawRow[]>(
      this.rowsQuery(tenantId, query, 50_000, 0),
    );
    const scope = query.scope ?? 'cedant';
    const header = [
      'Policy Number',
      'Insurer',
      ...(scope === 'reinsurer' ? ['Reinsurer'] : []),
      'Insured',
      'Risk Class',
      'Offer Date',
      'Date Closed',
      'Start Date',
      'End Date',
      'Currency',
      '100% Sum Insured',
      '100% Premium',
      'Fac Share',
      'Fac Sum Insured',
      'Fac Premium',
      'Paid Fac Premium',
      'Cedant Commission %',
      'Cedant Commission',
      'Brokerage',
      'Brokerage Paid',
      'WHT',
      'Paid WHT',
      'NIC Levy',
      'Paid NIC',
      'Net Premium Due Reinsurer',
      'Net Premium Due Reinsurer Paid',
      'Net Premium Due iRisk',
      'Net Premium Due iRisk Paid',
      'Offer Status',
      'Payment Status',
    ];
    const lines = [header, ...this.toCsvRows(rows, scope)].map((cells) =>
      cells.map((cell) => this.csvEscape(cell)).join(','),
    );
    return `${lines.join('\n')}\n`;
  }

  async exportFacultativeExcel(
    tenantId: string,
    query: QueryFacultativeReportDto,
  ): Promise<string> {
    const csv = await this.exportFacultativeCsv(tenantId, query);
    return csvToExcelHtml(csv, 'Facultative Report');
  }

  private rowsQuery(
    tenantId: string,
    query: QueryFacultativeReportDto,
    limit: number,
    offset: number,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        filtered.*,
        COUNT(*) OVER() AS "totalCount"
      FROM filtered_rows filtered
      ORDER BY ${this.sortExpression(query.sortBy)} ${this.sortDirection(query.sortOrder)}
        NULLS LAST,
        filtered."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  private summaryQuery(
    tenantId: string,
    query: QueryFacultativeReportDto,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        COALESCE(filtered."currency", 'UNKNOWN') AS "currency",
        COUNT(*) AS "placementCount",
        SUM(filtered."reinsurerCount") AS "participantCount",
        SUM(filtered."sumInsured") AS "sumInsured",
        SUM(filtered."premium") AS "premium",
        SUM(filtered."brokerage") AS "brokerage",
        SUM(filtered."cedantCommissionAmount") AS "commission",
        SUM(CASE WHEN filtered."status" IN ('DRAFT', 'MARKETING') THEN 1 ELSE 0 END) AS "openOffers",
        SUM(CASE WHEN filtered."status" IN ('PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED') THEN 1 ELSE 0 END) AS "acceptedOffers"
      FROM filtered_rows filtered
      GROUP BY COALESCE(filtered."currency", 'UNKNOWN')
      ORDER BY COALESCE(filtered."currency", 'UNKNOWN') ASC
    `;
  }

  private reportCtes(
    tenantId: string,
    query: QueryFacultativeReportDto,
  ): Prisma.Sql {
    const dateRange = this.dateRange(query);
    const datePredicate = this.datePredicate(
      query.dateField ?? 'createdAt',
      dateRange,
      tenantId,
    );
    const statusPredicate = query.placementStatus?.length
      ? Prisma.sql`AND p."status" IN (${Prisma.join(query.placementStatus)})`
      : Prisma.empty;
    const currencyPredicate = query.currency?.length
      ? Prisma.sql`AND p."currency" IN (${Prisma.join(query.currency)})`
      : Prisma.empty;
    const cedantPredicate = query.cedantId?.length
      ? Prisma.sql`AND p."cedantId" IN (${Prisma.join(query.cedantId)})`
      : Prisma.empty;
    const riskClassPredicate = query.riskClassId?.length
      ? Prisma.sql`AND rc."id" IN (${Prisma.join(query.riskClassId)})`
      : Prisma.empty;
    const searchPredicate = this.searchPredicate(query.search);
    const lifecyclePredicate = this.lifecyclePredicate(query.lifecycle);
    const reinsurerPredicate = query.reinsurerId?.length
      ? Prisma.sql`AND EXISTS (
          SELECT 1
          FROM effective_snapshots es_re
          WHERE es_re."placementId" = rr."id"
            AND es_re."reinsurerId" IN (${Prisma.join(query.reinsurerId)})
        )`
      : Prisma.empty;
    return Prisma.sql`
      WITH base_placements AS (
        SELECT
          p."id",
          p."reference",
          p."policyNumber",
          p."title",
          p."cedantId",
          p."classOfBusiness",
          p."riskTypeId",
          p."status",
          p."createdAt",
          p."forceClosedAt",
          p."inceptionDate",
          p."expiryDate",
          p."currency",
          p."sumInsured",
          p."premium",
          p."commission",
          p."facultativeOffer",
          c."name" AS "cedantName",
          rt."name" AS "riskTypeName",
          rc."id" AS "riskClassId",
          rc."name" AS "riskClassName"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = p."cedantId"
         AND c."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_type" rt
          ON rt."id" = p."riskTypeId"
         AND rt."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_class" rc
          ON rc."id" = rt."riskClassId"
         AND rc."tenantId" = p."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          ${statusPredicate}
          ${currencyPredicate}
          ${cedantPredicate}
          ${riskClassPredicate}
          ${searchPredicate}
          ${lifecyclePredicate}
          ${datePredicate}
      ),
      participant_rollup AS (
        SELECT
          pp."placementId",
          SUM(COALESCE(pp."sharePercent", 0)) AS "totalAcceptedPercent",
          COUNT(*) FILTER (
            WHERE pp."role" IN ('REINSURER', 'LEAD_REINSURER', 'CO_REINSURER')
              AND pp."status" IN ('ACCEPTED', 'CLOSED')
          ) AS "reinsurerCount"
        FROM "reinsurance"."PlacementParticipant" pp
        JOIN base_placements bp ON bp."id" = pp."placementId"
        WHERE pp."tenantId" = ${tenantId}
          AND pp."status" IN ('ACCEPTED', 'CLOSED')
        GROUP BY pp."placementId"
      ),
      snapshot_candidates AS (
        SELECT
          pc."id",
          pc."placementId",
          pc."participantId",
          pc."participantId" AS "snapshotKey",
          pp."counterpartyId" AS "reinsurerId",
          cp."name" AS "reinsurerName",
          pc."signedLinePercent",
          pc."sharePercent",
          pc."sumInsuredSnapshot",
          pc."grossPremium",
          pc."commissionPercent",
          pc."commissionAmount",
          pc."brokerageAmount",
          pc."netPremium",
          pc."confirmedAt",
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
          ) AS "participantId",
          COALESCE(
            ep."originalParticipantId",
            ec."endorsementParticipantId"
          ) AS "snapshotKey",
          ep."counterpartyId" AS "reinsurerId",
          cp."name" AS "reinsurerName",
          ec."signedLinePercent",
          ec."sharePercent",
          ec."sumInsuredSnapshot",
          ec."premiumSnapshot" AS "grossPremium",
          ec."commissionPercent",
          ec."commissionAmount",
          ec."brokerageAmount",
          ec."netPremium",
          ec."confirmedAt",
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
          note."withholdingTaxAmount",
          note."nicLevyAmount"
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
              WHEN n."closingId" = es."id"
                OR n."endorsementClosingId" = es."id"
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
      closing_rollup AS (
        SELECT
          es."placementId",
          MAX(es."confirmedAt") AS "latestConfirmedAt",
          SUM(COALESCE(es."sumInsuredSnapshot", 0)) AS "facSumInsured",
          SUM(COALESCE(es."grossPremium", 0)) AS "facPremium",
          SUM(COALESCE(es."commissionAmount", 0)) AS "cedantCommissionAmount",
          SUM(COALESCE(es."effectiveBrokerageAmount", 0)) AS "brokerage",
          SUM(COALESCE(es."netPremium", 0)) AS "netPremium",
          SUM(COALESCE(es."grossPremium" - COALESCE(es."commissionAmount", 0), es."netPremium", 0)) AS "cedantObligation",
          SUM(
            GREATEST(
              COALESCE(es."grossPremium" - COALESCE(es."commissionAmount", 0), es."netPremium", 0)
                - COALESCE(es."netPremium", 0),
              0
            )
          ) AS "mandatoryDeductions"
        FROM effective_snapshots_with_notes es
        GROUP BY es."placementId"
      ),
      payment_rollup AS (
        SELECT
          pay."placementId",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'BANK_CONFIRMED'
          ) AS "premiumReceived",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'RECORDED'
          ) AS "premiumPending",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'REINSURER_DISBURSEMENT'
              AND pay."status" = 'BANK_CONFIRMED'
          ) AS "reinsurerDisbursed"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."reversalOfPaymentId" IS NULL
        GROUP BY pay."placementId"
      ),
      reinsurer_payment_rollup AS (
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
      report_rows AS (
        SELECT
          bp."id",
          bp."reference",
          bp."policyNumber",
          bp."title",
          bp."cedantId",
          bp."cedantName",
          bp."classOfBusiness",
          bp."riskClassId",
          bp."riskClassName",
          bp."createdAt" AS "offerDate",
          COALESCE(bp."forceClosedAt", cr."latestConfirmedAt") AS "closedAt",
          bp."sumInsured",
          bp."premium",
          bp."currency",
          bp."commission",
          bp."facultativeOffer" AS "facultativeOfferPercent",
          COALESCE(bp."facultativeOffer", 0) AS "totalOfferedPercent",
          COALESCE(pru."totalAcceptedPercent", 0) AS "totalAcceptedPercent",
          COALESCE(pru."reinsurerCount", 0) AS "reinsurerCount",
          bp."status",
          bp."inceptionDate",
          bp."expiryDate",
          COALESCE(cr."facSumInsured", 0) AS "facSumInsured",
          COALESCE(cr."facPremium", 0) AS "facPremium",
          COALESCE(pp."premiumReceived", 0) + COALESCE(cr."cedantCommissionAmount", 0) AS "paidFacPremium",
          bp."commission" AS "cedantCommissionPercent",
          COALESCE(cr."cedantCommissionAmount", 0) AS "cedantCommissionAmount",
          COALESCE(cr."cedantObligation", 0) AS "netPremiumDueIrisk",
          COALESCE(pp."premiumReceived", 0) AS "netPremiumDueIriskPaid",
          COALESCE(cr."brokerage", 0) AS "brokerage",
          CASE
            WHEN COALESCE(cr."cedantObligation", 0) > 0.0001
              THEN COALESCE(cr."brokerage", 0) * LEAST(
                1,
                GREATEST(
                  0,
                  COALESCE(pp."premiumReceived", 0) / COALESCE(cr."cedantObligation", 0)
                )
              )
            ELSE 0
          END AS "brokeragePaid",
          COALESCE(cr."netPremium", 0) AS "netPremiumDueReinsurer",
          COALESCE(pp."reinsurerDisbursed", 0) AS "netPremiumDueReinsurerPaid",
          CASE
            WHEN COALESCE(cr."cedantObligation", 0) > 0
             AND COALESCE(cr."cedantObligation", 0)
                   - (COALESCE(pp."premiumReceived", 0) + COALESCE(cr."mandatoryDeductions", 0)) <= 0.0001
              THEN 'Paid'
            WHEN COALESCE(pp."premiumReceived", 0) + COALESCE(cr."mandatoryDeductions", 0) > 0.0001
              THEN 'Part Payment'
            WHEN COALESCE(pp."premiumPending", 0) > 0.0001
              THEN 'Pending'
            ELSE 'Outstanding'
          END AS "paymentStatus",
          COALESCE(
            (
              SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT(
                  'reinsurerId', es."reinsurerId",
                  'reinsurerName', es."reinsurerName",
                  'sharePercent', COALESCE(es."signedLinePercent", es."sharePercent"),
                  'closedAt', es."confirmedAt",
                  'facSumInsured', es."sumInsuredSnapshot",
                  'facPremium', es."grossPremium",
                  'paidFacPremium',
                    CASE
                      WHEN COALESCE(cr."cedantObligation", 0) > 0.0001
                        THEN COALESCE(es."grossPremium", 0) * LEAST(
                          1,
                          GREATEST(
                            0,
                            COALESCE(pp."premiumReceived", 0) / COALESCE(cr."cedantObligation", 0)
                          )
                        )
                      ELSE 0
                    END,
                  'brokerage', es."effectiveBrokerageAmount",
                  'brokeragePaid',
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
                    END,
                  'withholdingTax', COALESCE(es."withholdingTaxAmount", 0),
                  'withholdingTaxPaid',
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
                    END,
                  'nicLevy', COALESCE(es."nicLevyAmount", 0),
                  'nicLevyPaid',
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
                    END,
                  'netPremiumDueReinsurer', es."netPremium",
                  'netPremiumPaid', COALESCE(rp."disbursed", 0)
                )
                ORDER BY es."reinsurerName" ASC, es."id" ASC
              )
              FROM effective_snapshots_with_notes es
              LEFT JOIN reinsurer_payment_rollup rp
                ON rp."placementId" = es."placementId"
               AND (
                 rp."participantId" = es."snapshotKey"
                 OR (
                   rp."participantId" IS NULL
                   AND rp."counterpartyId" = es."reinsurerId"
                 )
               )
              WHERE es."placementId" = bp."id"
            ),
            '[]'::jsonb
          ) AS "reinsurers"
        FROM base_placements bp
        LEFT JOIN participant_rollup pru ON pru."placementId" = bp."id"
        LEFT JOIN closing_rollup cr ON cr."placementId" = bp."id"
        LEFT JOIN payment_rollup pp ON pp."placementId" = bp."id"
      ),
      filtered_rows AS (
        SELECT *
        FROM report_rows rr
        WHERE 1 = 1
          ${
            query.paymentStatus?.length
              ? Prisma.sql`AND rr."paymentStatus" IN (${Prisma.join(query.paymentStatus)})`
              : Prisma.empty
          }
          ${reinsurerPredicate}
      )
    `;
  }

  private datePredicate(
    dateField: QueryFacultativeReportDto['dateField'],
    dateRange: DateRange,
    tenantId: string,
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
    if (dateField === 'premiumPaid') {
      return Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "reinsurance"."PlacementPayment" pay_date
          WHERE pay_date."tenantId" = ${tenantId}
            AND pay_date."placementId" = p."id"
            AND pay_date."type" = 'PREMIUM_RECEIVED'
            AND pay_date."status" IN ('RECORDED', 'BANK_CONFIRMED')
            AND pay_date."reversalOfPaymentId" IS NULL
            ${rangePredicate(Prisma.sql`pay_date."paymentDate"`)}
        )
      `;
    }
    if (dateField === 'closingDate') {
      return Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "reinsurance"."PlacementClosing" pc_date
          WHERE pc_date."tenantId" = ${tenantId}
            AND pc_date."placementId" = p."id"
            AND pc_date."status" = 'CONFIRMED'
            ${rangePredicate(Prisma.sql`COALESCE(pc_date."confirmedAt", pc_date."issuedAt", pc_date."createdAt")`)}
          UNION ALL
          SELECT 1
          FROM "reinsurance"."PlacementEndorsementClosing" ec_date
          JOIN "reinsurance"."PlacementEndorsement" e_date
            ON e_date."id" = ec_date."endorsementId"
           AND e_date."tenantId" = ec_date."tenantId"
          WHERE ec_date."tenantId" = ${tenantId}
            AND ec_date."placementId" = p."id"
            AND ec_date."status" = 'CONFIRMED'
            AND e_date."status" = 'CLOSED'
            AND e_date."effectiveDate" <= NOW()
            ${rangePredicate(Prisma.sql`COALESCE(ec_date."confirmedAt", ec_date."createdAt")`)}
        )
      `;
    }
    return rangePredicate(Prisma.sql`p."createdAt"`);
  }

  private lifecyclePredicate(
    lifecycle?: QueryFacultativeReportDto['lifecycle'],
  ): Prisma.Sql {
    if (lifecycle === 'ACTIVE') {
      return Prisma.sql`
        AND p."inceptionDate" IS NOT NULL
        AND p."expiryDate" IS NOT NULL
        AND p."inceptionDate" <= NOW()
        AND p."expiryDate" >= NOW()
      `;
    }
    if (lifecycle === 'EXPIRED') {
      return Prisma.sql`
        AND p."expiryDate" IS NOT NULL
        AND p."expiryDate" < NOW()
      `;
    }
    return Prisma.empty;
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

  private sortExpression(sortBy?: FacultativeReportSortField): Prisma.Sql {
    const sorts: Record<FacultativeReportSortField, Prisma.Sql> = {
      policyNumber: Prisma.sql`filtered."policyNumber"`,
      cedantName: Prisma.sql`filtered."cedantName"`,
      offerDate: Prisma.sql`filtered."offerDate"`,
      closedAt: Prisma.sql`filtered."closedAt"`,
      inceptionDate: Prisma.sql`filtered."inceptionDate"`,
      expiryDate: Prisma.sql`filtered."expiryDate"`,
      premium: Prisma.sql`filtered."premium"`,
      facPremium: Prisma.sql`filtered."facPremium"`,
      paymentStatus: Prisma.sql`filtered."paymentStatus"`,
    };
    return sorts[sortBy ?? 'offerDate'];
  }

  private sortDirection(sortOrder?: string): Prisma.Sql {
    return sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private dateRange(query: QueryFacultativeReportDto): DateRange {
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

  private toRowDto(row: FacultativeReportRawRow): FacultativeReportRowDto {
    const due = this.toOptionalMoneyNumber(row.netPremiumDueIrisk);
    const paid = this.toOptionalMoneyNumber(row.netPremiumDueIriskPaid);
    const brokerage = this.toOptionalMoneyNumber(row.brokerage);
    const cedantFinancials = {
      facSumInsured: this.toOptionalMoneyNumber(row.facSumInsured),
      facPremium: this.toOptionalMoneyNumber(row.facPremium),
      paidFacPremium: this.toOptionalMoneyNumber(row.paidFacPremium),
      cedantCommissionPercent: this.toOptionalMoneyNumber(
        row.cedantCommissionPercent,
      ),
      cedantCommissionAmount: this.toOptionalMoneyNumber(
        row.cedantCommissionAmount,
      ),
      netPremiumDueIrisk: due,
      netPremiumDueIriskPaid: paid,
      brokerage,
      brokeragePaid: this.toOptionalMoneyNumber(row.brokeragePaid),
      netPremiumDueReinsurer: this.toOptionalMoneyNumber(
        row.netPremiumDueReinsurer,
      ),
      netPremiumDueReinsurerPaid: this.toOptionalMoneyNumber(
        row.netPremiumDueReinsurerPaid,
      ),
    };

    return {
      id: row.id,
      reference: row.reference,
      policyNumber: row.policyNumber,
      title: row.title,
      cedantId: row.cedantId,
      cedantName: row.cedantName,
      classOfBusiness: row.classOfBusiness,
      riskClassId: row.riskClassId,
      riskClassName: row.riskClassName,
      offerDate: this.toIsoOrNull(row.offerDate),
      closedAt: this.toIsoOrNull(row.closedAt),
      sumInsured: this.toOptionalMoneyNumber(row.sumInsured),
      premium: this.toOptionalMoneyNumber(row.premium),
      currency: row.currency,
      commission: this.toOptionalMoneyNumber(row.commission),
      facultativeOfferPercent: this.toOptionalMoneyNumber(
        row.facultativeOfferPercent,
      ),
      totalOfferedPercent: this.toMoneyNumber(row.totalOfferedPercent),
      totalAcceptedPercent: this.toMoneyNumber(row.totalAcceptedPercent),
      reinsurerCount: this.toInteger(row.reinsurerCount),
      status: row.status,
      inceptionDate: this.toIsoOrNull(row.inceptionDate),
      expiryDate: this.toIsoOrNull(row.expiryDate),
      paymentStatus: row.paymentStatus,
      cedantFinancials,
      reinsurers: this.parseReinsurers(row.reinsurers),
    };
  }

  private toSummaryDto(
    rows: FacultativeReportRawSummaryRow[],
  ): FacultativeReportResponseDto['summary'] {
    const totalsByCurrency = rows.map((row) => this.toCurrencyTotalsDto(row));
    const totalOffers = totalsByCurrency.reduce(
      (sum, row) => sum + row.placementCount,
      0,
    );
    const openOffers = rows.reduce(
      (sum, row) => sum + this.toInteger(row.openOffers),
      0,
    );
    const acceptedOffers = rows.reduce(
      (sum, row) => sum + this.toInteger(row.acceptedOffers),
      0,
    );
    return {
      totalOffers,
      openOffers,
      acceptanceRate:
        totalOffers > 0
          ? this.money.roundMoney((acceptedOffers / totalOffers) * 100)
          : 0,
      totalsByCurrency,
    };
  }

  private toCurrencyTotalsDto(
    row: FacultativeReportRawSummaryRow,
  ): FacultativeReportCurrencyTotalsDto {
    return {
      currency: row.currency ?? 'UNKNOWN',
      placementCount: this.toInteger(row.placementCount),
      participantCount: this.toInteger(row.participantCount),
      sumInsured: this.toMoneyNumber(row.sumInsured),
      premium: this.toMoneyNumber(row.premium),
      brokerage: this.toMoneyNumber(row.brokerage),
      commission: this.toMoneyNumber(row.commission),
    };
  }

  private parseReinsurers(value: unknown): FacultativeReinsurerBreakdownDto[] {
    const rows = Array.isArray(value) ? value : [];
    return rows.map((row) => {
      const item = row as FacultativeReportRawReinsurer;
      return {
        reinsurerId: item.reinsurerId,
        reinsurerName: item.reinsurerName,
        sharePercent: this.toOptionalMoneyNumber(item.sharePercent),
        closedAt: this.toIsoOrNull(item.closedAt),
        facSumInsured: this.toOptionalMoneyNumber(item.facSumInsured),
        facPremium: this.toOptionalMoneyNumber(item.facPremium),
        paidFacPremium: this.toOptionalMoneyNumber(item.paidFacPremium),
        brokerage: this.toOptionalMoneyNumber(item.brokerage),
        brokeragePaid: this.toOptionalMoneyNumber(item.brokeragePaid),
        withholdingTax: this.toOptionalMoneyNumber(item.withholdingTax),
        withholdingTaxPaid: this.toOptionalMoneyNumber(item.withholdingTaxPaid),
        nicLevy: this.toOptionalMoneyNumber(item.nicLevy),
        nicLevyPaid: this.toOptionalMoneyNumber(item.nicLevyPaid),
        netPremiumDueReinsurer: this.toOptionalMoneyNumber(
          item.netPremiumDueReinsurer,
        ),
        netPremiumPaid: this.toOptionalMoneyNumber(item.netPremiumPaid),
      };
    });
  }

  private toCsvRows(
    rows: FacultativeReportRawRow[],
    scope: FacultativeReportScope,
  ): string[][] {
    return rows.flatMap((row) => {
      const dto = this.toRowDto(row);
      if (scope === 'reinsurer' && dto.reinsurers.length === 0) {
        return [];
      }
      const reinsurers =
        scope === 'reinsurer' && dto.reinsurers.length > 0
          ? dto.reinsurers
          : [null];
      return reinsurers.map((reinsurer) => [
        dto.policyNumber ?? dto.reference,
        dto.cedantName,
        ...(scope === 'reinsurer' ? [reinsurer?.reinsurerName ?? ''] : []),
        dto.title,
        dto.riskClassName ?? '',
        formatExportDate(dto.offerDate),
        formatExportDate(reinsurer?.closedAt ?? dto.closedAt),
        formatExportDate(dto.inceptionDate),
        formatExportDate(dto.expiryDate),
        dto.currency ?? '',
        this.csvNumber(dto.sumInsured),
        this.csvNumber(dto.premium),
        this.csvNumber(reinsurer?.sharePercent ?? dto.facultativeOfferPercent),
        this.csvNumber(
          reinsurer?.facSumInsured ?? dto.cedantFinancials.facSumInsured,
        ),
        this.csvNumber(
          reinsurer?.facPremium ?? dto.cedantFinancials.facPremium,
        ),
        this.csvNumber(
          reinsurer?.paidFacPremium ?? dto.cedantFinancials.paidFacPremium,
        ),
        this.csvNumber(dto.cedantFinancials.cedantCommissionPercent),
        this.csvNumber(dto.cedantFinancials.cedantCommissionAmount),
        this.csvNumber(reinsurer?.brokerage ?? dto.cedantFinancials.brokerage),
        this.csvNumber(
          reinsurer?.brokeragePaid ?? dto.cedantFinancials.brokeragePaid,
        ),
        this.csvNumber(reinsurer?.withholdingTax ?? null),
        this.csvNumber(reinsurer?.withholdingTaxPaid ?? null),
        this.csvNumber(reinsurer?.nicLevy ?? null),
        this.csvNumber(reinsurer?.nicLevyPaid ?? null),
        this.csvNumber(
          reinsurer?.netPremiumDueReinsurer ??
            dto.cedantFinancials.netPremiumDueReinsurer,
        ),
        this.csvNumber(
          reinsurer?.netPremiumPaid ??
            dto.cedantFinancials.netPremiumDueReinsurerPaid,
        ),
        this.csvNumber(dto.cedantFinancials.netPremiumDueIrisk),
        this.csvNumber(dto.cedantFinancials.netPremiumDueIriskPaid),
        dto.status,
        dto.paymentStatus,
      ]);
    });
  }

  private csvNumber(value: number | null): string {
    return value == null ? '' : String(value);
  }

  private csvEscape(value: string | number): string {
    const text = String(value);
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
  }

  private toMoneyNumber(value: SqlNumber): number {
    return this.money.roundMoney(this.money.toNumber(value ?? 0));
  }

  private toOptionalMoneyNumber(value: SqlNumber): number | null {
    if (value === null || value === undefined) return null;
    return this.money.roundMoney(this.money.toNumber(value));
  }

  private toInteger(value: bigint | number | string): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }

  private toIsoOrNull(value: Date | string | null): string | null {
    if (!value) return null;
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
