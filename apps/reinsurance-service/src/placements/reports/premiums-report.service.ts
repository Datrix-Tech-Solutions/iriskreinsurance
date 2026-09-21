import { Injectable } from '@nestjs/common';
import { PlacementStatus, Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  PremiumReportCurrencyTotalsDto,
  PremiumReportReinsurerDto,
  PremiumReportRowDto,
  PremiumsReportResponseDto,
} from './dto/premiums-report-response.dto';
import {
  PremiumReportDateBasis,
  PremiumReportPaymentStatus,
  PremiumReportSortField,
  QueryPremiumsReportDto,
} from './dto/query-premiums-report.dto';

type SqlNumber = Prisma.Decimal | string | number | null;

type PremiumReportRawReinsurer = {
  reinsurerId: string;
  reinsurerName: string;
  closingId: string;
  sharePercent: SqlNumber;
  grossPremium: SqlNumber;
  commissionPercent: SqlNumber;
  commissionAmount: SqlNumber;
  brokerageAmount: SqlNumber;
  netPremium: SqlNumber;
  paidAmount: SqlNumber;
  outstandingAmount: SqlNumber;
  closedAt: Date | string | null;
};

type PremiumReportRawRow = {
  id: string;
  placementId: string;
  reference: string | null;
  policyNumber: string | null;
  title: string;
  cedantId: string;
  cedantName: string;
  riskClassId: string | null;
  riskClassName: string | null;
  riskTypeId: string | null;
  policyType: string | null;
  status: PlacementStatus;
  offerDate: Date | string | null;
  closedAt: Date | string | null;
  inceptionDate: Date | string | null;
  expiryDate: Date | string | null;
  currency: string | null;
  sumInsured: SqlNumber;
  premium: SqlNumber;
  facultativeOfferPercent: SqlNumber;
  due: SqlNumber;
  paid: SqlNumber;
  mandatoryDeductions: SqlNumber;
  effectiveSettlementCredit: SqlNumber;
  outstanding: SqlNumber;
  pending: SqlNumber;
  paymentStatus: PremiumReportPaymentStatus;
  reinsurers: unknown;
  totalCount: bigint | number | string;
};

type PremiumReportRawSummaryRow = {
  currency: string | null;
  placementCount: bigint | number | string;
  participantCount: bigint | number | string;
  sumInsured: SqlNumber;
  grossPremium: SqlNumber;
  commission: SqlNumber;
  brokerage: SqlNumber;
  cedantCurrentObligation: SqlNumber;
  premiumReceived: SqlNumber;
  mandatoryDeductions: SqlNumber;
  effectiveSettlementCredit: SqlNumber;
  cedantOutstanding: SqlNumber;
  cedantPending: SqlNumber;
  reinsurerPayable: SqlNumber;
  reinsurerDisbursed: SqlNumber;
  reinsurerOutstanding: SqlNumber;
};

type DateRange = {
  from?: Date;
  to?: Date;
};

@Injectable()
export class PremiumsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findPremiums(
    tenantId: string,
    query: QueryPremiumsReportDto,
  ): Promise<PremiumsReportResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<PremiumReportRawRow[]>(
      this.rowsQuery(tenantId, query, limit, offset),
    );
    const summaryRows = await this.prisma.$queryRaw<
      PremiumReportRawSummaryRow[]
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

  async exportPremiumsCsv(
    tenantId: string,
    query: QueryPremiumsReportDto,
  ): Promise<string> {
    const rows = await this.prisma.$queryRaw<PremiumReportRawRow[]>(
      this.rowsQuery(tenantId, query, 50_000, 0),
    );
    const header = [
      'Policy Number',
      'Reinsurer',
      'Insured',
      'Policy Type',
      'Cedant',
      'Offer Date',
      'Date Closed',
      'Inception Date',
      'Expiry Date',
      'Currency',
      '100% S.I',
      '100% Premium',
      'Fac Share',
      'Fac Premium',
      "Insurer's Commission %",
      "Insurer's Commission Amount",
      'Brokerage',
      'Net Premium Due Reinsurer',
      'Net Premium Due Reinsurer Paid',
      'Cedant Premium Due',
      'Cedant Premium Paid',
      'Mandatory Deductions',
      'Effective Settlement',
      'Cedant Outstanding',
      'Payment Status',
    ];

    const lines = [header, ...this.toCsvRows(rows)].map((cells) =>
      cells.map((cell) => this.csvEscape(cell)).join(','),
    );
    return `${lines.join('\n')}\n`;
  }

  private rowsQuery(
    tenantId: string,
    query: QueryPremiumsReportDto,
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
        filtered."placementId" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  private summaryQuery(
    tenantId: string,
    query: QueryPremiumsReportDto,
  ): Prisma.Sql {
    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        COALESCE(filtered."currency", 'UNKNOWN') AS "currency",
        COUNT(*) AS "placementCount",
        SUM(filtered."participantCount") AS "participantCount",
        SUM(filtered."sumInsured") AS "sumInsured",
        SUM(filtered."grossPremium") AS "grossPremium",
        SUM(filtered."commission") AS "commission",
        SUM(filtered."brokerage") AS "brokerage",
        SUM(filtered."due") AS "cedantCurrentObligation",
        SUM(filtered."paid") AS "premiumReceived",
        SUM(filtered."mandatoryDeductions") AS "mandatoryDeductions",
        SUM(filtered."effectiveSettlementCredit") AS "effectiveSettlementCredit",
        SUM(filtered."outstanding") AS "cedantOutstanding",
        SUM(filtered."pending") AS "cedantPending",
        SUM(filtered."reinsurerPayable") AS "reinsurerPayable",
        SUM(filtered."reinsurerDisbursed") AS "reinsurerDisbursed",
        SUM(filtered."reinsurerPayable" - filtered."reinsurerDisbursed") AS "reinsurerOutstanding"
      FROM filtered_rows filtered
      GROUP BY COALESCE(filtered."currency", 'UNKNOWN')
      ORDER BY COALESCE(filtered."currency", 'UNKNOWN') ASC
    `;
  }

  private reportCtes(
    tenantId: string,
    query: QueryPremiumsReportDto,
  ): Prisma.Sql {
    const dateRange = this.dateRange(query);
    const baseDatePredicate = this.baseDatePredicate(
      query.dateBasis ?? 'INCEPTION_DATE',
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
    const riskTypePredicate = query.riskTypeId?.length
      ? Prisma.sql`AND p."riskTypeId" IN (${Prisma.join(query.riskTypeId)})`
      : Prisma.empty;
    const riskClassPredicate = query.riskClassId?.length
      ? Prisma.sql`AND rc."id" IN (${Prisma.join(query.riskClassId)})`
      : Prisma.empty;
    const searchPredicate = this.searchPredicate(query.search);
    const paymentStatusPredicate = query.paymentStatus?.length
      ? Prisma.sql`WHERE rr."paymentStatus" IN (${Prisma.join(query.paymentStatus)})`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_placements AS (
        SELECT
          p."id",
          p."reference",
          p."policyNumber",
          p."title",
          p."cedantId",
          p."riskTypeId",
          p."status",
          p."createdAt",
          p."forceClosedAt",
          p."inceptionDate",
          p."expiryDate",
          p."currency",
          p."sumInsured",
          p."premium",
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
          ${riskTypePredicate}
          ${riskClassPredicate}
          ${searchPredicate}
          ${baseDatePredicate}
      ),
      confirmed_closings AS (
        SELECT
          pc."id",
          pc."placementId",
          pc."participantId",
          pc."tenantId",
          pc."signedLinePercent",
          pc."sharePercent",
          pc."grossPremium",
          pc."commissionPercent",
          pc."commissionAmount",
          pc."brokerageAmount",
          pc."netPremium",
          pc."confirmedAt",
          pp."counterpartyId" AS "reinsurerId",
          cp."name" AS "reinsurerName"
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
      ),
      closing_rollup AS (
        SELECT
          cc."placementId",
          COUNT(*) AS "participantCount",
          MAX(cc."confirmedAt") AS "latestConfirmedAt",
          SUM(COALESCE(cc."grossPremium", 0)) AS "grossPremium",
          SUM(COALESCE(cc."commissionAmount", 0)) AS "commission",
          SUM(COALESCE(cc."brokerageAmount", 0)) AS "brokerage",
          SUM(COALESCE(cc."netPremium", 0)) AS "reinsurerPayable",
          SUM(COALESCE(cc."grossPremium" - COALESCE(cc."commissionAmount", 0), cc."netPremium", 0)) AS "cedantObligation",
          SUM(
            GREATEST(
              COALESCE(cc."grossPremium" - COALESCE(cc."commissionAmount", 0), cc."netPremium", 0)
                - COALESCE(cc."netPremium", 0),
              0
            )
          ) AS "mandatoryDeductions"
        FROM confirmed_closings cc
        GROUP BY cc."placementId"
      ),
      premium_payments AS (
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
      reinsurer_payments AS (
        SELECT
          pay."placementId",
          pay."counterpartyId",
          SUM(pay."amount") AS "paidAmount"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."type" = 'REINSURER_DISBURSEMENT'
          AND pay."status" = 'BANK_CONFIRMED'
          AND pay."reversalOfPaymentId" IS NULL
          AND pay."counterpartyId" IS NOT NULL
        GROUP BY pay."placementId", pay."counterpartyId"
      ),
      reinsurer_rows AS (
        SELECT
          cc."placementId",
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'reinsurerId', cc."reinsurerId",
              'reinsurerName', cc."reinsurerName",
              'closingId', cc."id",
              'sharePercent', COALESCE(cc."signedLinePercent", cc."sharePercent"),
              'grossPremium', cc."grossPremium",
              'commissionPercent', cc."commissionPercent",
              'commissionAmount', cc."commissionAmount",
              'brokerageAmount', cc."brokerageAmount",
              'netPremium', cc."netPremium",
              'paidAmount', COALESCE(rp."paidAmount", 0),
              'outstandingAmount', COALESCE(cc."netPremium", 0) - COALESCE(rp."paidAmount", 0),
              'closedAt', cc."confirmedAt"
            )
            ORDER BY cc."reinsurerName" ASC, cc."id" ASC
          ) AS "reinsurers"
        FROM confirmed_closings cc
        LEFT JOIN reinsurer_payments rp
          ON rp."placementId" = cc."placementId"
         AND rp."counterpartyId" = cc."reinsurerId"
        GROUP BY cc."placementId"
      ),
      report_rows AS (
        SELECT
          bp."id",
          bp."id" AS "placementId",
          bp."reference",
          bp."policyNumber",
          bp."title",
          bp."cedantId",
          bp."cedantName",
          bp."riskClassId",
          bp."riskClassName",
          bp."riskTypeId",
          COALESCE(bp."riskTypeName", bp."riskClassName") AS "policyType",
          bp."status",
          bp."createdAt" AS "offerDate",
          COALESCE(bp."forceClosedAt", cr."latestConfirmedAt") AS "closedAt",
          bp."inceptionDate",
          bp."expiryDate",
          bp."currency",
          COALESCE(bp."sumInsured", 0) AS "sumInsured",
          COALESCE(bp."premium", 0) AS "premium",
          bp."facultativeOffer" AS "facultativeOfferPercent",
          COALESCE(cr."participantCount", 0) AS "participantCount",
          COALESCE(cr."grossPremium", 0) AS "grossPremium",
          COALESCE(cr."commission", 0) AS "commission",
          COALESCE(cr."brokerage", 0) AS "brokerage",
          COALESCE(cr."reinsurerPayable", 0) AS "reinsurerPayable",
          COALESCE(pp."reinsurerDisbursed", 0) AS "reinsurerDisbursed",
          COALESCE(cr."cedantObligation", 0) AS "due",
          COALESCE(pp."premiumReceived", 0) AS "paid",
          COALESCE(cr."mandatoryDeductions", 0) AS "mandatoryDeductions",
          COALESCE(pp."premiumReceived", 0) + COALESCE(cr."mandatoryDeductions", 0) AS "effectiveSettlementCredit",
          GREATEST(
            COALESCE(cr."cedantObligation", 0)
              - (COALESCE(pp."premiumReceived", 0) + COALESCE(cr."mandatoryDeductions", 0)),
            0
          ) AS "outstanding",
          COALESCE(pp."premiumPending", 0) AS "pending",
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
          COALESCE(rr."reinsurers", '[]'::jsonb) AS "reinsurers"
        FROM base_placements bp
        LEFT JOIN closing_rollup cr ON cr."placementId" = bp."id"
        LEFT JOIN premium_payments pp ON pp."placementId" = bp."id"
        LEFT JOIN reinsurer_rows rr ON rr."placementId" = bp."id"
      ),
      filtered_rows AS (
        SELECT *
        FROM report_rows rr
        ${paymentStatusPredicate}
      )
    `;
  }

  private baseDatePredicate(
    dateBasis: PremiumReportDateBasis,
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

    if (!dateRange.from && !dateRange.to) {
      return Prisma.empty;
    }

    if (dateBasis === 'PLACEMENT_CREATED') {
      return rangePredicate(Prisma.sql`p."createdAt"`);
    }
    if (dateBasis === 'EXPIRY_DATE') {
      return rangePredicate(Prisma.sql`p."expiryDate"`);
    }
    if (dateBasis === 'CLOSING_CONFIRMED_AT') {
      return Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "reinsurance"."PlacementClosing" pc_date
          WHERE pc_date."tenantId" = ${tenantId}
            AND pc_date."placementId" = p."id"
            AND pc_date."status" = 'CONFIRMED'
            ${rangePredicate(Prisma.sql`pc_date."confirmedAt"`)}
        )
      `;
    }
    if (dateBasis === 'PAYMENT_DATE') {
      return Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "reinsurance"."PlacementPayment" pay_date
          WHERE pay_date."tenantId" = ${tenantId}
            AND pay_date."placementId" = p."id"
            AND pay_date."reversalOfPaymentId" IS NULL
            ${rangePredicate(Prisma.sql`pay_date."paymentDate"`)}
        )
      `;
    }
    if (dateBasis === 'BANK_CONFIRMED_AT') {
      return Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "reinsurance"."PlacementPayment" bank_date
          WHERE bank_date."tenantId" = ${tenantId}
            AND bank_date."placementId" = p."id"
            AND bank_date."status" = 'BANK_CONFIRMED'
            AND bank_date."reversalOfPaymentId" IS NULL
            ${rangePredicate(Prisma.sql`bank_date."bankConfirmedAt"`)}
        )
      `;
    }

    return rangePredicate(Prisma.sql`p."inceptionDate"`);
  }

  private searchPredicate(search?: string): Prisma.Sql {
    const trimmed = search?.trim();
    if (!trimmed) {
      return Prisma.empty;
    }
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

  private sortExpression(sortBy?: PremiumReportSortField): Prisma.Sql {
    const sorts: Record<PremiumReportSortField, Prisma.Sql> = {
      policyNumber: Prisma.sql`filtered."policyNumber"`,
      cedantName: Prisma.sql`filtered."cedantName"`,
      offerDate: Prisma.sql`filtered."offerDate"`,
      dateClosed: Prisma.sql`filtered."closedAt"`,
      inceptionDate: Prisma.sql`filtered."inceptionDate"`,
      expiryDate: Prisma.sql`filtered."expiryDate"`,
      premium: Prisma.sql`filtered."premium"`,
      grossPremium: Prisma.sql`filtered."grossPremium"`,
      premiumReceived: Prisma.sql`filtered."paid"`,
      outstanding: Prisma.sql`filtered."outstanding"`,
      paymentStatus: Prisma.sql`filtered."paymentStatus"`,
    };

    return sorts[sortBy ?? 'inceptionDate'];
  }

  private sortDirection(sortOrder?: string): Prisma.Sql {
    return sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private dateRange(query: QueryPremiumsReportDto): DateRange {
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

  private toRowDto(row: PremiumReportRawRow): PremiumReportRowDto {
    const due = this.toMoneyNumber(row.due);
    const paid = this.toMoneyNumber(row.paid);
    const mandatoryDeductions = this.toMoneyNumber(row.mandatoryDeductions);
    const effectiveSettlementCredit = this.toMoneyNumber(
      row.effectiveSettlementCredit,
    );
    const outstanding = this.toMoneyNumber(row.outstanding);
    const pending = this.toMoneyNumber(row.pending);

    return {
      id: row.id,
      placementId: row.placementId,
      reference: row.reference,
      policyNumber: row.policyNumber ?? row.reference ?? row.id,
      title: row.title,
      cedantId: row.cedantId,
      cedantName: row.cedantName,
      riskClassId: row.riskClassId,
      riskClassName: row.riskClassName,
      riskTypeId: row.riskTypeId,
      policyType: row.policyType,
      status: row.status,
      offerDate: this.toIsoOrNull(row.offerDate),
      closedAt: this.toIsoOrNull(row.closedAt),
      inceptionDate: this.toIsoOrNull(row.inceptionDate),
      expiryDate: this.toIsoOrNull(row.expiryDate),
      currency: row.currency,
      sumInsured: this.toOptionalMoneyNumber(row.sumInsured),
      premium: this.toOptionalMoneyNumber(row.premium),
      facultativeOfferPercent: this.toOptionalMoneyNumber(
        row.facultativeOfferPercent,
      ),
      due,
      paid,
      mandatoryDeductions,
      effectiveSettlementCredit,
      outstanding,
      pending,
      paymentStatus: row.paymentStatus,
      reinsurers: this.parseReinsurers(row.reinsurers),
    };
  }

  private toSummaryDto(
    rows: PremiumReportRawSummaryRow[],
  ): PremiumsReportResponseDto['summary'] {
    const totalsByCurrency = rows.map((row) => this.toCurrencyTotalsDto(row));
    return {
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
    row: PremiumReportRawSummaryRow,
  ): PremiumReportCurrencyTotalsDto {
    return {
      currency: row.currency ?? 'UNKNOWN',
      placementCount: this.toInteger(row.placementCount),
      participantCount: this.toInteger(row.participantCount),
      sumInsured: this.toMoneyNumber(row.sumInsured),
      grossPremium: this.toMoneyNumber(row.grossPremium),
      commission: this.toMoneyNumber(row.commission),
      brokerage: this.toMoneyNumber(row.brokerage),
      cedantCurrentObligation: this.toMoneyNumber(row.cedantCurrentObligation),
      premiumReceived: this.toMoneyNumber(row.premiumReceived),
      mandatoryDeductions: this.toMoneyNumber(row.mandatoryDeductions),
      effectiveSettlementCredit: this.toMoneyNumber(
        row.effectiveSettlementCredit,
      ),
      cedantOutstanding: this.toMoneyNumber(row.cedantOutstanding),
      cedantPending: this.toMoneyNumber(row.cedantPending),
      reinsurerPayable: this.toMoneyNumber(row.reinsurerPayable),
      reinsurerDisbursed: this.toMoneyNumber(row.reinsurerDisbursed),
      reinsurerOutstanding: this.toMoneyNumber(row.reinsurerOutstanding),
    };
  }

  private parseReinsurers(value: unknown): PremiumReportReinsurerDto[] {
    const rows = Array.isArray(value) ? value : [];
    return rows.map((row) => {
      const item = row as PremiumReportRawReinsurer;
      return {
        reinsurerId: item.reinsurerId,
        reinsurerName: item.reinsurerName,
        closingId: item.closingId,
        sharePercent: this.toOptionalMoneyNumber(item.sharePercent),
        grossPremium: this.toOptionalMoneyNumber(item.grossPremium),
        commissionPercent: this.toOptionalMoneyNumber(item.commissionPercent),
        commissionAmount: this.toOptionalMoneyNumber(item.commissionAmount),
        brokerageAmount: this.toOptionalMoneyNumber(item.brokerageAmount),
        netPremium: this.toOptionalMoneyNumber(item.netPremium),
        paidAmount: this.toMoneyNumber(item.paidAmount),
        outstandingAmount: this.toOptionalMoneyNumber(item.outstandingAmount),
        closedAt: this.toIsoOrNull(item.closedAt),
      };
    });
  }

  private toCsvRows(rows: PremiumReportRawRow[]): string[][] {
    return rows.flatMap((row) => {
      const dto = this.toRowDto(row);
      const reinsurers = dto.reinsurers.length > 0 ? dto.reinsurers : [null];
      return reinsurers.map((reinsurer) => [
        dto.policyNumber,
        reinsurer?.reinsurerName ?? '',
        dto.title,
        dto.policyType ?? '',
        dto.cedantName,
        dto.offerDate ?? '',
        reinsurer?.closedAt ?? dto.closedAt ?? '',
        dto.inceptionDate ?? '',
        dto.expiryDate ?? '',
        dto.currency ?? '',
        this.csvNumber(dto.sumInsured),
        this.csvNumber(dto.premium),
        this.csvNumber(reinsurer?.sharePercent ?? dto.facultativeOfferPercent),
        this.csvNumber(reinsurer?.grossPremium ?? null),
        this.csvNumber(reinsurer?.commissionPercent ?? null),
        this.csvNumber(reinsurer?.commissionAmount ?? null),
        this.csvNumber(reinsurer?.brokerageAmount ?? null),
        this.csvNumber(reinsurer?.netPremium ?? null),
        this.csvNumber(reinsurer?.paidAmount ?? null),
        this.csvNumber(dto.due),
        this.csvNumber(dto.paid),
        this.csvNumber(dto.mandatoryDeductions),
        this.csvNumber(dto.effectiveSettlementCredit),
        this.csvNumber(dto.outstanding),
        dto.paymentStatus,
      ]);
    });
  }

  private csvNumber(value: number | null): string {
    return value == null ? '' : String(value);
  }

  private csvEscape(value: string | number): string {
    const text = String(value);
    if (!/[",\n\r]/.test(text)) {
      return text;
    }
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
