import { Injectable } from '@nestjs/common';
import { PlacementClaimState, Prisma } from '../../../prisma/generated/client';
import { ClaimRowBucket } from '../dto/claim-row-state-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  ClaimsReportCurrencyTotalsDto,
  ClaimsReportResponseDto,
  ClaimsReportRowDto,
} from './dto/claims-report-response.dto';
import {
  ClaimsReportScope,
  ClaimsReportSortField,
  QueryClaimsReportDto,
} from './dto/query-claims-report.dto';

type SqlNumber = Prisma.Decimal | string | number | null;

type ClaimsReportRawRow = {
  id: string;
  claimId: string;
  placementId: string;
  bucket: ClaimRowBucket;
  policyNumber: string | null;
  businessName: string;
  cedantId: string;
  cedantName: string;
  riskTypeId: string | null;
  policyType: string | null;
  claimType: string | null;
  periodStart: Date | string | null;
  periodEnd: Date | string | null;
  claimNumber: string;
  currency: string;
  occurrenceDate: Date | string;
  premiumPaidAt: Date | string | null;
  estimatedLossAmount: SqlNumber;
  finalLossAmount: SqlNumber;
  claimAmount: SqlNumber;
  claimState: PlacementClaimState;
  finalizedAt: Date | string | null;
  recoveredAmount: SqlNumber;
  recoveredAt: Date | string | null;
  iriskSharePercent: SqlNumber;
  iriskShareAmount: SqlNumber;
  iriskSharePaid: SqlNumber;
  iriskShareOutstanding: SqlNumber;
  reinsurerId: string | null;
  reinsurerName: string | null;
  reinsurerSharePercent: SqlNumber;
  reinsurerShareAmount: SqlNumber;
  reinsurerPaidAmount: SqlNumber;
  reinsurerOutstandingAmount: SqlNumber;
  agingDays: bigint | number | string | null;
  dolDop: bigint | number | string | null;
  totalCount: bigint | number | string;
};

type ClaimsReportRawSummaryRow = {
  currency: string | null;
  claimCount: bigint | number | string;
  claimAmount: SqlNumber;
  iriskShareAmount: SqlNumber;
  bankConfirmedRecovery: SqlNumber;
  outstandingRecovery: SqlNumber;
  openClaims: bigint | number | string;
  closedClaims: bigint | number | string;
};

type DateRange = {
  from?: Date;
  to?: Date;
};

@Injectable()
export class ClaimsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findClaims(
    tenantId: string,
    query: QueryClaimsReportDto,
  ): Promise<ClaimsReportResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;
    const scope = query.scope ?? 'general';

    const rows = await this.prisma.$queryRaw<ClaimsReportRawRow[]>(
      this.rowsQuery(tenantId, query, limit, offset),
    );
    const summaryRows = await this.prisma.$queryRaw<
      ClaimsReportRawSummaryRow[]
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

  async exportClaimsCsv(
    tenantId: string,
    query: QueryClaimsReportDto,
  ): Promise<string> {
    const rows = await this.prisma.$queryRaw<ClaimsReportRawRow[]>(
      this.rowsQuery(tenantId, query, 50_000, 0),
    );
    const header = [
      'Business Name',
      'Cedant',
      'Policy Type',
      'Policy Number',
      'Claim Type',
      'Claim Number',
      'Period of Insurance',
      'Date of Loss',
      'Currency',
      'Claim Amount',
      'iRisk Share %',
      'iRisk Share Amount',
      'iRisk Share Recovered',
      'iRisk Share Outstanding',
      'Reinsurer Name',
      'Reinsurer % Share',
      'Reinsurer Share Amount',
      'Reinsurer Bank-Confirmed Recovery',
      'Reinsurer Outstanding Recovery',
      'Aging (days)',
      'DoL:DoP',
    ];
    const lines = [header, ...rows.map((row) => this.toCsvRow(row))].map(
      (cells) => cells.map((cell) => this.csvEscape(cell)).join(','),
    );
    return `${lines.join('\n')}\n`;
  }

  private rowsQuery(
    tenantId: string,
    query: QueryClaimsReportDto,
    limit: number,
    offset: number,
  ): Prisma.Sql {
    const scope = query.scope ?? 'general';
    const table =
      scope === 'cedant'
        ? Prisma.sql`filtered_claims`
        : Prisma.sql`filtered_reinsurers`;

    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      SELECT
        filtered.*,
        COUNT(*) OVER() AS "totalCount"
      FROM ${table} filtered
      ORDER BY ${this.sortExpression(query.sortBy)} ${this.sortDirection(query.sortOrder)}
        NULLS LAST,
        filtered."claimNumber" ASC,
        filtered."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  private summaryQuery(
    tenantId: string,
    query: QueryClaimsReportDto,
  ): Prisma.Sql {
    const scope = query.scope ?? 'general';
    const table =
      scope === 'cedant'
        ? Prisma.sql`filtered_claims`
        : Prisma.sql`filtered_reinsurers`;

    return Prisma.sql`
      ${this.reportCtes(tenantId, query)}
      ,
      summary_source AS (
        SELECT DISTINCT
          "claimId",
          "currency",
          "claimAmount",
          "iriskShareAmount",
          "iriskSharePaid",
          "iriskShareOutstanding",
          "bucket"
        FROM ${table}
      )
      SELECT
        COALESCE("currency", 'UNKNOWN') AS "currency",
        COUNT(*) AS "claimCount",
        SUM("claimAmount") AS "claimAmount",
        SUM(COALESCE("iriskShareAmount", 0)) AS "iriskShareAmount",
        SUM(COALESCE("iriskSharePaid", 0)) AS "bankConfirmedRecovery",
        SUM(COALESCE("iriskShareOutstanding", 0)) AS "outstandingRecovery",
        COUNT(*) FILTER (WHERE "bucket" = 'open') AS "openClaims",
        COUNT(*) FILTER (WHERE "bucket" = 'closed') AS "closedClaims"
      FROM summary_source
      GROUP BY COALESCE("currency", 'UNKNOWN')
      ORDER BY COALESCE("currency", 'UNKNOWN') ASC
    `;
  }

  private reportCtes(
    tenantId: string,
    query: QueryClaimsReportDto,
  ): Prisma.Sql {
    const dateRange = this.dateRange(query);
    const datePredicate = this.datePredicate(dateRange);
    const currencyPredicate = query.currency?.length
      ? Prisma.sql`AND pc."currency" IN (${Prisma.join(query.currency)})`
      : Prisma.empty;
    const cedantPredicate = query.cedantId?.length
      ? Prisma.sql`AND p."cedantId" IN (${Prisma.join(query.cedantId)})`
      : Prisma.empty;
    const searchPredicate = this.searchPredicate(query.search);
    const bucketPredicate = query.bucket?.length
      ? Prisma.sql`AND "bucket" IN (${Prisma.join(query.bucket)})`
      : Prisma.empty;
    const claimStatePredicate = query.claimState?.length
      ? Prisma.sql`AND "claimState"::text IN (${Prisma.join(query.claimState)})`
      : Prisma.empty;
    const recoveryStatusPredicate = query.recoveryStatus?.length
      ? Prisma.sql`AND "recoveryStatus" IN (${Prisma.join(query.recoveryStatus)})`
      : Prisma.empty;
    const reinsurerPredicate = query.reinsurerId?.length
      ? Prisma.sql`AND "reinsurerId" IN (${Prisma.join(query.reinsurerId)})`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_claims AS (
        SELECT
          pc."id" AS "claimId",
          pc."placementId",
          pc."claimNumber",
          pc."status" AS "claimStatus",
          pc."claimState",
          pc."occurrenceDate",
          pc."reportedDate",
          pc."claimCause",
          pc."currency",
          pc."estimatedLossAmount",
          pc."finalLossAmount",
          pc."finalizedAt",
          p."policyNumber",
          p."title" AS "businessName",
          p."cedantId",
          cedant."name" AS "cedantName",
          p."riskTypeId",
          COALESCE(rt."name", p."classOfBusiness") AS "policyType",
          p."inceptionDate" AS "periodStart",
          p."expiryDate" AS "periodEnd",
          p."facultativeOffer" AS "iriskSharePercent"
        FROM "reinsurance"."PlacementClaim" pc
        JOIN "reinsurance"."Placement" p
          ON p."id" = pc."placementId"
         AND p."tenantId" = pc."tenantId"
        JOIN "reinsurance"."Counterparty" cedant
          ON cedant."id" = p."cedantId"
         AND cedant."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_type" rt
          ON rt."id" = p."riskTypeId"
         AND rt."tenantId" = p."tenantId"
        WHERE pc."tenantId" = ${tenantId}
          AND pc."status"::text <> 'VOID'
          AND p."archivedAt" IS NULL
          AND p."status"::text IN (
            'PARTIALLY_PLACED',
            'PLACED',
            'CLOSING',
            'CLOSED',
            'DECLINED',
            'CANCELLED'
          )
          ${datePredicate}
          ${currencyPredicate}
          ${cedantPredicate}
          ${searchPredicate}
      ),
      premium_receipts AS (
        SELECT
          pay."placementId",
          MIN(pay."paymentDate") FILTER (
            WHERE pay."type"::text = 'PREMIUM_RECEIVED'
              AND pay."status"::text = 'BANK_CONFIRMED'
              AND pay."reversalOfPaymentId" IS NULL
          ) AS "premiumPaidAt"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN (
          SELECT DISTINCT "placementId"
          FROM base_claims
        ) bc ON bc."placementId" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
        GROUP BY pay."placementId"
      ),
      allocation_base AS (
        SELECT
          a."claimId",
          a."counterpartyId",
          cp."name" AS "reinsurerName",
          SUM(a."signedLinePercent") AS "reinsurerSharePercent",
          SUM(COALESCE(a."allocatedFinalLossAmount", a."allocatedEstimatedLossAmount")) AS "reinsurerShareAmount"
        FROM "reinsurance"."PlacementClaimAllocation" a
        JOIN base_claims bc ON bc."claimId" = a."claimId"
        JOIN "reinsurance"."Counterparty" cp
          ON cp."id" = a."counterpartyId"
         AND cp."tenantId" = a."tenantId"
        WHERE a."tenantId" = ${tenantId}
          AND a."status"::text <> 'VOID'
        GROUP BY a."claimId", a."counterpartyId", cp."name"
      ),
      recovery_receipts AS (
        SELECT
          r."claimId",
          r."counterpartyId",
          SUM(r."amount") FILTER (
            WHERE r."status"::text = 'BANK_CONFIRMED'
              AND r."reversalOfReceiptId" IS NULL
          ) AS "bankConfirmedRecovery",
          SUM(ABS(r."amount")) FILTER (
            WHERE r."reversalOfReceiptId" IS NOT NULL
          ) AS "reversedRecovery",
          MAX(r."bankConfirmedAt") FILTER (
            WHERE r."status"::text = 'BANK_CONFIRMED'
              AND r."bankConfirmedAt" IS NOT NULL
          ) AS "lastRecoveredAt"
        FROM "reinsurance"."PlacementClaimRecoveryReceipt" r
        JOIN base_claims bc ON bc."claimId" = r."claimId"
        WHERE r."tenantId" = ${tenantId}
        GROUP BY r."claimId", r."counterpartyId"
      ),
      reinsurer_positions AS (
        SELECT
          ab."claimId",
          ab."counterpartyId",
          ab."reinsurerName",
          ab."reinsurerSharePercent",
          ab."reinsurerShareAmount",
          COALESCE(rr."bankConfirmedRecovery", 0) - COALESCE(rr."reversedRecovery", 0)
            AS "reinsurerPaidAmount",
          GREATEST(
            0,
            ab."reinsurerShareAmount" -
              (COALESCE(rr."bankConfirmedRecovery", 0) - COALESCE(rr."reversedRecovery", 0))
          ) AS "reinsurerOutstandingAmount",
          rr."lastRecoveredAt"
        FROM allocation_base ab
        LEFT JOIN recovery_receipts rr
          ON rr."claimId" = ab."claimId"
         AND rr."counterpartyId" = ab."counterpartyId"
      ),
      claim_positions AS (
        SELECT
          bc.*,
          pr."premiumPaidAt",
          CASE
            WHEN bc."finalLossAmount" IS NULL THEN bc."estimatedLossAmount"
            ELSE bc."finalLossAmount"
          END AS "claimAmount",
          CASE
            WHEN bc."finalLossAmount" IS NULL THEN
              CASE
                WHEN bc."iriskSharePercent" IS NULL THEN 0
                ELSE bc."estimatedLossAmount" * (bc."iriskSharePercent" / 100)
              END
            ELSE COALESCE(SUM(rp."reinsurerShareAmount"), 0)
          END AS "iriskShareAmount",
          COALESCE(SUM(rp."reinsurerPaidAmount"), 0) AS "iriskSharePaid",
          MAX(rp."lastRecoveredAt") AS "recoveredAt",
          CASE
            WHEN bc."finalLossAmount" IS NULL THEN 'notification'
            WHEN COALESCE(SUM(rp."reinsurerShareAmount"), 0) > 0
             AND GREATEST(
               0,
               COALESCE(SUM(rp."reinsurerShareAmount"), 0) -
                 COALESCE(SUM(rp."reinsurerPaidAmount"), 0)
             ) <= 0.01
              THEN 'closed'
            ELSE 'open'
          END AS "bucket"
        FROM base_claims bc
        LEFT JOIN premium_receipts pr ON pr."placementId" = bc."placementId"
        LEFT JOIN reinsurer_positions rp ON rp."claimId" = bc."claimId"
        GROUP BY
          bc."claimId",
          bc."placementId",
          bc."claimNumber",
          bc."claimStatus",
          bc."claimState",
          bc."occurrenceDate",
          bc."reportedDate",
          bc."claimCause",
          bc."currency",
          bc."estimatedLossAmount",
          bc."finalLossAmount",
          bc."finalizedAt",
          bc."policyNumber",
          bc."businessName",
          bc."cedantId",
          bc."cedantName",
          bc."riskTypeId",
          bc."policyType",
          bc."periodStart",
          bc."periodEnd",
          bc."iriskSharePercent",
          pr."premiumPaidAt"
      ),
      claim_rows AS (
        SELECT
          cp."claimId" AS "id",
          cp."claimId",
          cp."placementId",
          cp."bucket"::text AS "bucket",
          cp."policyNumber",
          cp."businessName",
          cp."cedantId",
          cp."cedantName",
          cp."riskTypeId",
          cp."policyType",
          cp."claimCause" AS "claimType",
          cp."periodStart",
          cp."periodEnd",
          cp."claimNumber",
          cp."currency",
          cp."occurrenceDate",
          cp."premiumPaidAt",
          cp."estimatedLossAmount",
          cp."finalLossAmount",
          cp."claimAmount",
          cp."claimState",
          cp."finalizedAt",
          cp."iriskSharePaid" AS "recoveredAmount",
          cp."recoveredAt",
          cp."iriskSharePercent",
          cp."iriskShareAmount",
          cp."iriskSharePaid",
          GREATEST(0, cp."iriskShareAmount" - cp."iriskSharePaid") AS "iriskShareOutstanding",
          NULL::text AS "reinsurerId",
          NULL::text AS "reinsurerName",
          NULL::numeric AS "reinsurerSharePercent",
          NULL::numeric AS "reinsurerShareAmount",
          NULL::numeric AS "reinsurerPaidAmount",
          NULL::numeric AS "reinsurerOutstandingAmount",
          CASE
            WHEN cp."finalizedAt" IS NULL THEN NULL
            WHEN cp."bucket" = 'closed' AND cp."recoveredAt" IS NOT NULL THEN
              GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (cp."recoveredAt" - cp."finalizedAt")) / 86400))::int
            ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - cp."finalizedAt")) / 86400))::int
          END AS "agingDays",
          CASE
            WHEN cp."premiumPaidAt" IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (cp."occurrenceDate" - cp."premiumPaidAt")) / 86400)::int
          END AS "dolDop",
          CASE
            WHEN cp."iriskSharePaid" <= 0.01 THEN 'outstanding'
            WHEN GREATEST(0, cp."iriskShareAmount" - cp."iriskSharePaid") <= 0.01 THEN 'full'
            ELSE 'part'
          END AS "recoveryStatus"
        FROM claim_positions cp
      ),
      reinsurer_rows AS (
        SELECT
          cp."claimId" || ':' || COALESCE(rp."counterpartyId", 'unallocated') AS "id",
          cp."claimId",
          cp."placementId",
          cp."bucket"::text AS "bucket",
          cp."policyNumber",
          cp."businessName",
          cp."cedantId",
          cp."cedantName",
          cp."riskTypeId",
          cp."policyType",
          cp."claimCause" AS "claimType",
          cp."periodStart",
          cp."periodEnd",
          cp."claimNumber",
          cp."currency",
          cp."occurrenceDate",
          cp."premiumPaidAt",
          cp."estimatedLossAmount",
          cp."finalLossAmount",
          cp."claimAmount",
          cp."claimState",
          cp."finalizedAt",
          cp."iriskSharePaid" AS "recoveredAmount",
          cp."recoveredAt",
          cp."iriskSharePercent",
          cp."iriskShareAmount",
          cp."iriskSharePaid",
          GREATEST(0, cp."iriskShareAmount" - cp."iriskSharePaid") AS "iriskShareOutstanding",
          rp."counterpartyId" AS "reinsurerId",
          rp."reinsurerName",
          rp."reinsurerSharePercent",
          rp."reinsurerShareAmount",
          rp."reinsurerPaidAmount",
          rp."reinsurerOutstandingAmount",
          CASE
            WHEN cp."finalizedAt" IS NULL THEN NULL
            WHEN rp."reinsurerOutstandingAmount" <= 0.01 AND rp."lastRecoveredAt" IS NOT NULL THEN
              GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (rp."lastRecoveredAt" - cp."finalizedAt")) / 86400))::int
            ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - cp."finalizedAt")) / 86400))::int
          END AS "agingDays",
          CASE
            WHEN cp."premiumPaidAt" IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (cp."occurrenceDate" - cp."premiumPaidAt")) / 86400)::int
          END AS "dolDop",
          CASE
            WHEN cp."iriskSharePaid" <= 0.01 THEN 'outstanding'
            WHEN GREATEST(0, cp."iriskShareAmount" - cp."iriskSharePaid") <= 0.01 THEN 'full'
            ELSE 'part'
          END AS "recoveryStatus"
        FROM claim_positions cp
        LEFT JOIN reinsurer_positions rp ON rp."claimId" = cp."claimId"
      ),
      filtered_claims AS (
        SELECT *
        FROM claim_rows
        WHERE TRUE
          ${bucketPredicate}
          ${claimStatePredicate}
          ${recoveryStatusPredicate}
      ),
      filtered_reinsurers AS (
        SELECT *
        FROM reinsurer_rows
        WHERE TRUE
          ${bucketPredicate}
          ${claimStatePredicate}
          ${recoveryStatusPredicate}
          ${reinsurerPredicate}
      )
    `;
  }

  private datePredicate(range: DateRange): Prisma.Sql {
    const fromPredicate = range.from
      ? Prisma.sql`AND pc."occurrenceDate" >= ${range.from}`
      : Prisma.empty;
    const toPredicate = range.to
      ? Prisma.sql`AND pc."occurrenceDate" <= ${range.to}`
      : Prisma.empty;
    return Prisma.sql`${fromPredicate} ${toPredicate}`;
  }

  private searchPredicate(search?: string): Prisma.Sql {
    const trimmed = search?.trim();
    if (!trimmed) return Prisma.empty;
    const pattern = `%${trimmed}%`;
    return Prisma.sql`
      AND (
        p."policyNumber" ILIKE ${pattern}
        OR p."title" ILIKE ${pattern}
        OR p."classOfBusiness" ILIKE ${pattern}
        OR pc."claimNumber" ILIKE ${pattern}
      )
    `;
  }

  private sortExpression(sortBy?: ClaimsReportSortField): Prisma.Sql {
    const sorts: Record<ClaimsReportSortField, Prisma.Sql> = {
      occurrenceDate: Prisma.sql`filtered."occurrenceDate"`,
      claimNumber: Prisma.sql`filtered."claimNumber"`,
      policyNumber: Prisma.sql`filtered."policyNumber"`,
      cedantName: Prisma.sql`filtered."cedantName"`,
      claimAmount: Prisma.sql`filtered."claimAmount"`,
      iriskShareAmount: Prisma.sql`filtered."iriskShareAmount"`,
      iriskShareOutstanding: Prisma.sql`filtered."iriskShareOutstanding"`,
      reinsurerName: Prisma.sql`filtered."reinsurerName"`,
      reinsurerShareAmount: Prisma.sql`filtered."reinsurerShareAmount"`,
      reinsurerOutstandingAmount: Prisma.sql`filtered."reinsurerOutstandingAmount"`,
      agingDays: Prisma.sql`filtered."agingDays"`,
    };
    return sorts[sortBy ?? 'occurrenceDate'];
  }

  private sortDirection(sortOrder?: string): Prisma.Sql {
    return sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private dateRange(query: QueryClaimsReportDto): DateRange {
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

  private toRowDto(row: ClaimsReportRawRow): ClaimsReportRowDto {
    return {
      id: row.id,
      claimId: row.claimId,
      placementId: row.placementId,
      bucket: row.bucket,
      policyNumber: row.policyNumber ?? '',
      businessName: row.businessName,
      cedantId: row.cedantId,
      cedantName: row.cedantName,
      riskTypeId: row.riskTypeId,
      policyType: row.policyType,
      claimType: row.claimType,
      periodStart: this.toIsoOrNull(row.periodStart),
      periodEnd: this.toIsoOrNull(row.periodEnd),
      claimNumber: row.claimNumber,
      currency: row.currency,
      occurrenceDate: this.toIso(row.occurrenceDate),
      premiumPaidAt: this.toIsoOrNull(row.premiumPaidAt),
      estimatedLossAmount: this.toMoneyNumber(row.estimatedLossAmount),
      finalLossAmount: this.toOptionalMoneyNumber(row.finalLossAmount),
      claimAmount: this.toMoneyNumber(row.claimAmount),
      claimState: row.claimState,
      finalizedAt: this.toIsoOrNull(row.finalizedAt),
      recoveredAmount: this.toOptionalMoneyNumber(row.recoveredAmount),
      recoveredAt: this.toIsoOrNull(row.recoveredAt),
      iriskSharePercent: this.toOptionalMoneyNumber(row.iriskSharePercent),
      iriskShareAmount: this.toOptionalMoneyNumber(row.iriskShareAmount),
      iriskSharePaid: this.toOptionalMoneyNumber(row.iriskSharePaid),
      iriskShareOutstanding: this.toOptionalMoneyNumber(
        row.iriskShareOutstanding,
      ),
      reinsurerId: row.reinsurerId,
      reinsurerName: row.reinsurerName,
      reinsurerSharePercent: this.toOptionalMoneyNumber(
        row.reinsurerSharePercent,
      ),
      reinsurerShareAmount: this.toOptionalMoneyNumber(
        row.reinsurerShareAmount,
      ),
      reinsurerPaidAmount: this.toOptionalMoneyNumber(row.reinsurerPaidAmount),
      reinsurerOutstandingAmount: this.toOptionalMoneyNumber(
        row.reinsurerOutstandingAmount,
      ),
      agingDays: this.toOptionalInteger(row.agingDays),
      dolDop: this.toOptionalInteger(row.dolDop),
    };
  }

  private toSummaryDto(
    scope: ClaimsReportScope,
    rows: ClaimsReportRawSummaryRow[],
  ): ClaimsReportResponseDto['summary'] {
    const totalsByCurrency = rows.map((row) => this.toCurrencyTotalsDto(row));
    const openClaims = totalsByCurrency.reduce(
      (sum, row, index) => sum + this.toInteger(rows[index]?.openClaims ?? 0),
      0,
    );
    const closedClaims = totalsByCurrency.reduce(
      (sum, row, index) => sum + this.toInteger(rows[index]?.closedClaims ?? 0),
      0,
    );
    const finalizedTotal = openClaims + closedClaims;
    return {
      scope,
      openClaims,
      closedClaims,
      recoveryRate:
        finalizedTotal > 0
          ? this.money.roundMoney((closedClaims / finalizedTotal) * 100)
          : 0,
      totalsByCurrency,
    };
  }

  private toCurrencyTotalsDto(
    row: ClaimsReportRawSummaryRow,
  ): ClaimsReportCurrencyTotalsDto {
    return {
      currency: row.currency ?? 'UNKNOWN',
      claimCount: this.toInteger(row.claimCount),
      claimAmount: this.toMoneyNumber(row.claimAmount),
      iriskShareAmount: this.toMoneyNumber(row.iriskShareAmount),
      bankConfirmedRecovery: this.toMoneyNumber(row.bankConfirmedRecovery),
      outstandingRecovery: this.toMoneyNumber(row.outstandingRecovery),
    };
  }

  private toCsvRow(row: ClaimsReportRawRow): string[] {
    const dto = this.toRowDto(row);
    return [
      dto.businessName,
      dto.cedantName,
      dto.policyType ?? '',
      dto.policyNumber,
      dto.claimType ?? '',
      dto.claimNumber,
      this.formatPeriod(dto.periodStart, dto.periodEnd),
      dto.occurrenceDate,
      dto.currency,
      this.csvNumber(dto.claimAmount),
      this.csvNumber(dto.iriskSharePercent),
      this.csvNumber(dto.iriskShareAmount),
      this.csvNumber(dto.iriskSharePaid),
      this.csvNumber(dto.iriskShareOutstanding),
      dto.reinsurerName ?? '',
      this.csvNumber(dto.reinsurerSharePercent),
      this.csvNumber(dto.reinsurerShareAmount),
      this.csvNumber(dto.reinsurerPaidAmount),
      this.csvNumber(dto.reinsurerOutstandingAmount),
      this.csvNumber(dto.agingDays),
      this.csvNumber(dto.dolDop),
    ];
  }

  private formatPeriod(start: string | null, end: string | null): string {
    if (!start && !end) return '';
    return `${start ?? ''} - ${end ?? ''}`;
  }

  private toIsoOrNull(value: Date | string | null): string | null {
    if (!value) return null;
    return this.toIso(value);
  }

  private toIso(value: Date | string): string {
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

  private toOptionalInteger(
    value: bigint | number | string | null,
  ): number | null {
    return value == null ? null : this.toInteger(value);
  }

  private toInteger(value: bigint | number | string): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }
}
