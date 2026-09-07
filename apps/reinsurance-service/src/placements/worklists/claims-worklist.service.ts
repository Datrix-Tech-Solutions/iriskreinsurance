import { Injectable } from '@nestjs/common';
import {
  PlacementClaimState,
  PlacementClaimStatus,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import {
  ClaimsCurrencyAmountDto,
  ClaimsSummaryResponseDto,
  ClaimsWorklistClaimDto,
  ClaimsWorklistPlacementDto,
  ClaimsWorklistResponseDto,
  ClaimsWorklistRowDto,
} from '../dto/claims-worklist-response.dto';
import { QueryClaimsSummaryDto } from '../dto/query-claims-summary.dto';
import { QueryClaimsWorklistDto } from '../dto/query-claims-worklist.dto';
import { ClaimRowBucket } from '../dto/claim-row-state-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type JsonObject = Record<string, unknown>;

type ClaimsWorklistRawRow = {
  claimId: string;
  tenantId: string;
  placementId: string;
  bucket: ClaimRowBucket;
  claimNumber: string;
  claimStatus: PlacementClaimStatus;
  claimState: PlacementClaimState;
  occurrenceDate: Date | string;
  reportedDate: Date | string;
  claimCause: string;
  occurrenceDetails: string | null;
  claimCurrency: string;
  estimatedLossAmount: Prisma.Decimal | string | number;
  finalLossAmount: Prisma.Decimal | string | number | null;
  finalizedAt: Date | string | null;
  finalizedByUserId: string | null;
  approvedPayableAmount: Prisma.Decimal | string | number | null;
  approvedAt: Date | string | null;
  approvedByUserId: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  closedAt: Date | string | null;
  voidedAt: Date | string | null;
  claimCreatedAt: Date | string;
  claimUpdatedAt: Date | string;
  placementReference: string | null;
  policyNumber: string | null;
  title: string;
  classOfBusiness: string | null;
  riskTypeId: string | null;
  cedantId: string;
  cedantName: string;
  businessDetails: Prisma.JsonValue | null;
  offerDetails: Prisma.JsonValue | null;
  description: string | null;
  sumInsured: Prisma.Decimal | string | number | null;
  rate: Prisma.Decimal | string | number | null;
  commission: Prisma.Decimal | string | number | null;
  facultativeOffer: Prisma.Decimal | string | number | null;
  premium: Prisma.Decimal | string | number | null;
  placementCurrency: string | null;
  inceptionDate: Date | string | null;
  expiryDate: Date | string | null;
  placementStatus: PlacementStatus;
  placementCreatedAt: Date | string;
  placementUpdatedAt: Date | string;
  archivedByUserId: string | null;
  archiveReason: string | null;
  archivedAt: Date | string | null;
  closeMode: string | null;
  forceClosedAt: Date | string | null;
  forceClosedByUserId: string | null;
  recoveredAmount: Prisma.Decimal | string | number | null;
  recoveredAt: Date | string | null;
  totalAllocated: Prisma.Decimal | string | number | null;
  claimShare: Prisma.Decimal | string | number | null;
  nonVoidEndorsementCount: bigint | number | string;
  totalCount: bigint | number | string;
};

type ClaimsSummaryRawRow = {
  totalClaims: bigint | number | string;
  settledClaims: bigint | number | string;
  notificationClaims: bigint | number | string;
  openClaims: bigint | number | string;
  openPendingClaims: bigint | number | string;
  openFinalizedClaims: bigint | number | string;
  closedClaims: bigint | number | string;
  claimsByCurrency: unknown;
  recoveredByCurrency: unknown;
  outstandingRecoveredByCurrency: unknown;
};

@Injectable()
export class ReinsuranceClaimsWorklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findClaims(
    tenantId: string,
    query: QueryClaimsWorklistDto,
  ): Promise<ClaimsWorklistResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const tab = query.tab ?? 'notification';
    const claimStatePredicate = query.claimState
      ? Prisma.sql`AND "claimState"::text = ${query.claimState}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ClaimsWorklistRawRow[]>`
      ${this.classifiedClaimsCte(tenantId, query)}
      , filtered AS (
        SELECT *
        FROM classified_claims
        WHERE "bucket" = ${tab}
        ${claimStatePredicate}
      ),
      counted AS (
        SELECT
          filtered.*,
          COUNT(*) OVER() AS "totalCount"
        FROM filtered
      )
      SELECT *
      FROM counted
      ORDER BY "claimCreatedAt" DESC, "claimId" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const total = rows[0] ? this.toInteger(rows[0].totalCount) : 0;
    return {
      items: rows.map((row) => this.toDto(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async summarizeClaims(
    tenantId: string,
    query: QueryClaimsSummaryDto = {},
  ): Promise<ClaimsSummaryResponseDto> {
    const rows = await this.prisma.$queryRaw<ClaimsSummaryRawRow[]>`
      ${this.classifiedClaimsCte(tenantId, query)}
      SELECT
        COUNT(*) FILTER (WHERE "claimStatus"::text <> 'VOID') AS "totalClaims",
        COUNT(*) FILTER (
          WHERE "claimStatus"::text <> 'VOID'
            AND "claimStatus"::text IN ('SETTLED', 'CLOSED')
        ) AS "settledClaims",
        COUNT(*) FILTER (WHERE "bucket" = 'notification') AS "notificationClaims",
        COUNT(*) FILTER (WHERE "bucket" = 'open') AS "openClaims",
        COUNT(*) FILTER (
          WHERE "bucket" = 'open' AND "claimState"::text = 'PENDING'
        ) AS "openPendingClaims",
        COUNT(*) FILTER (
          WHERE "bucket" = 'open' AND "claimState"::text = 'FINALIZED'
        ) AS "openFinalizedClaims",
        COUNT(*) FILTER (WHERE "bucket" = 'closed') AS "closedClaims",
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('code', totals."code", 'amount', totals."amount")
              ORDER BY totals."amount" DESC
            )
            FROM (
              SELECT
                "claimCurrency" AS "code",
                SUM(COALESCE("claimShare", 0)) AS "amount"
              FROM classified_claims
              WHERE "claimState"::text = 'FINALIZED'
              GROUP BY "claimCurrency"
            ) totals
          ),
          '[]'::jsonb
        ) AS "claimsByCurrency",
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('code', totals."code", 'amount', totals."amount")
              ORDER BY totals."amount" DESC
            )
            FROM (
              SELECT
                "claimCurrency" AS "code",
                SUM(COALESCE("recoveredAmount", 0)) AS "amount"
              FROM classified_claims
              WHERE "bucket" = 'open'
              GROUP BY "claimCurrency"
            ) totals
          ),
          '[]'::jsonb
        ) AS "recoveredByCurrency",
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('code', totals."code", 'amount', totals."amount")
              ORDER BY totals."amount" DESC
            )
            FROM (
              SELECT
                "claimCurrency" AS "code",
                SUM(COALESCE("claimShare", 0)) - SUM(COALESCE("recoveredAmount", 0))
                  AS "amount"
              FROM classified_claims
              WHERE "claimState"::text = 'FINALIZED'
              GROUP BY "claimCurrency"
            ) totals
          ),
          '[]'::jsonb
        ) AS "outstandingRecoveredByCurrency"
      FROM classified_claims
    `;

    const row = rows[0];
    return {
      totalClaims: this.toInteger(row?.totalClaims ?? 0),
      settledClaims: this.toInteger(row?.settledClaims ?? 0),
      notificationClaims: this.toInteger(row?.notificationClaims ?? 0),
      openClaims: this.toInteger(row?.openClaims ?? 0),
      openPendingClaims: this.toInteger(row?.openPendingClaims ?? 0),
      openFinalizedClaims: this.toInteger(row?.openFinalizedClaims ?? 0),
      closedClaims: this.toInteger(row?.closedClaims ?? 0),
      claimsByCurrency: this.toCurrencyAmounts(row?.claimsByCurrency),
      recoveredByCurrency: this.toCurrencyAmounts(row?.recoveredByCurrency),
      outstandingRecoveredByCurrency: this.toCurrencyAmounts(
        row?.outstandingRecoveredByCurrency,
      ),
    };
  }

  private classifiedClaimsCte(
    tenantId: string,
    query: Pick<QueryClaimsWorklistDto, 'search' | 'cedantId'> &
      Partial<QueryClaimsSummaryDto>,
  ) {
    const searchPredicate = this.searchPredicate(query.search);
    const cedantPredicate = query.cedantId
      ? Prisma.sql`AND p."cedantId" = ${query.cedantId}`
      : Prisma.empty;
    // Windows every summary figure by claim entry date (createdAt). `since`
    // inclusive, `until` exclusive — matching premiumsPeriodStart / premiumsPeriodEnd.
    const sincePredicate = query.since
      ? Prisma.sql`AND pc."createdAt" >= ${new Date(query.since)}`
      : Prisma.empty;
    const untilPredicate = query.until
      ? Prisma.sql`AND pc."createdAt" < ${new Date(query.until)}`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_claims AS (
        SELECT
          pc."id" AS "claimId",
          pc."tenantId",
          pc."placementId",
          pc."claimNumber",
          pc."status" AS "claimStatus",
          pc."claimState",
          pc."occurrenceDate",
          pc."reportedDate",
          pc."claimCause",
          pc."occurrenceDetails",
          pc."currency" AS "claimCurrency",
          pc."estimatedLossAmount",
          pc."finalLossAmount",
          pc."finalizedAt",
          pc."finalizedByUserId",
          pc."approvedPayableAmount",
          pc."approvedAt",
          pc."approvedByUserId",
          pc."createdByUserId",
          pc."updatedByUserId",
          pc."closedAt",
          pc."voidedAt",
          pc."createdAt" AS "claimCreatedAt",
          pc."updatedAt" AS "claimUpdatedAt",
          p."reference" AS "placementReference",
          p."policyNumber",
          p."title",
          p."classOfBusiness",
          p."riskTypeId",
          p."cedantId",
          c."name" AS "cedantName",
          p."businessDetails",
          p."offerDetails",
          p."description",
          p."sumInsured",
          p."rate",
          p."commission",
          p."facultativeOffer",
          p."premium",
          p."currency" AS "placementCurrency",
          p."inceptionDate",
          p."expiryDate",
          p."status" AS "placementStatus",
          p."createdAt" AS "placementCreatedAt",
          p."updatedAt" AS "placementUpdatedAt",
          p."archivedByUserId",
          p."archiveReason",
          p."archivedAt",
          p."closeMode",
          p."forceClosedAt",
          p."forceClosedByUserId"
        FROM "reinsurance"."PlacementClaim" pc
        JOIN "reinsurance"."Placement" p
          ON p."id" = pc."placementId"
         AND p."tenantId" = pc."tenantId"
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = p."cedantId"
         AND c."tenantId" = p."tenantId"
        WHERE pc."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          AND p."status"::text IN (
            'PARTIALLY_PLACED',
            'PLACED',
            'CLOSING',
            'CLOSED',
            'DECLINED',
            'CANCELLED'
          )
          ${cedantPredicate}
          ${searchPredicate}
          ${sincePredicate}
          ${untilPredicate}
      ),
      allocation_totals AS (
        SELECT
          a."claimId",
          SUM(COALESCE(a."allocatedFinalLossAmount", a."allocatedEstimatedLossAmount")) AS "totalAllocated"
        FROM "reinsurance"."PlacementClaimAllocation" a
        JOIN base_claims bc ON bc."claimId" = a."claimId"
        WHERE a."tenantId" = ${tenantId}
          AND a."status"::text <> 'VOID'
        GROUP BY a."claimId"
      ),
      receipt_totals AS (
        SELECT
          r."cashCallId",
          SUM(r."amount") FILTER (
            WHERE r."status"::text = 'BANK_CONFIRMED'
              AND r."reversalOfReceiptId" IS NULL
          ) AS "confirmedAmount",
          SUM(ABS(r."amount")) FILTER (
            WHERE r."reversalOfReceiptId" IS NOT NULL
          ) AS "reversedAmount",
          MAX(r."bankConfirmedAt") FILTER (
            WHERE r."status"::text = 'BANK_CONFIRMED'
              AND r."bankConfirmedAt" IS NOT NULL
          ) AS "latestConfirmedAt"
        FROM "reinsurance"."PlacementClaimRecoveryReceipt" r
        JOIN base_claims bc ON bc."claimId" = r."claimId"
        WHERE r."tenantId" = ${tenantId}
        GROUP BY r."cashCallId"
      ),
      approval_totals AS (
        SELECT
          cc."id" AS "cashCallId",
          SUM(ra."approvedAmount") AS "approvedAmount"
        FROM "reinsurance"."PlacementClaimCashCall" cc
        JOIN base_claims bc ON bc."claimId" = cc."claimId"
        JOIN "reinsurance"."PlacementClaimRecoveryApproval" ra
          ON ra."allocationId" = cc."allocationId"
         AND ra."tenantId" = cc."tenantId"
         AND ra."currency" = cc."currency"
         AND ra."counterpartyId" = cc."counterpartyId"
         AND (ra."cashCallId" IS NULL OR ra."cashCallId" = cc."id")
        WHERE cc."tenantId" = ${tenantId}
        GROUP BY cc."id"
      ),
      cash_call_positions AS (
        SELECT
          cc."claimId",
          SUM(
            CASE
              WHEN cc."status"::text IN ('ISSUED', 'PAID') THEN cc."amount"
              ELSE 0
            END
          ) AS "totalCashCalled",
          SUM(COALESCE(rt."confirmedAmount", 0)) AS "totalConfirmed",
          SUM(COALESCE(rt."reversedAmount", 0)) AS "totalReversed",
          SUM(
            CASE
              WHEN cc."status"::text IN ('ISSUED', 'PAID') THEN
                GREATEST(
                  0,
                  COALESCE(NULLIF(at."approvedAmount", 0), cc."amount") -
                    COALESCE(rt."confirmedAmount", 0)
                )
              ELSE 0
            END
          ) AS "totalOutstanding",
          MAX(rt."latestConfirmedAt") AS "recoveredAt"
        FROM "reinsurance"."PlacementClaimCashCall" cc
        JOIN base_claims bc ON bc."claimId" = cc."claimId"
        LEFT JOIN receipt_totals rt ON rt."cashCallId" = cc."id"
        LEFT JOIN approval_totals at ON at."cashCallId" = cc."id"
        WHERE cc."tenantId" = ${tenantId}
        GROUP BY cc."claimId"
      ),
      endorsement_counts AS (
        SELECT
          e."placementId",
          COUNT(*) AS "nonVoidEndorsementCount"
        FROM "reinsurance"."PlacementEndorsement" e
        JOIN (
          SELECT DISTINCT "placementId"
          FROM base_claims
        ) bp ON bp."placementId" = e."placementId"
        WHERE e."tenantId" = ${tenantId}
          AND e."status"::text <> 'VOID'
        GROUP BY e."placementId"
      ),
      classified_claims AS (
        SELECT
          bc.*,
          COALESCE(ccp."totalConfirmed", 0) - COALESCE(ccp."totalReversed", 0) AS "recoveredAmount",
          ccp."recoveredAt",
          COALESCE(at."totalAllocated", 0) AS "totalAllocated",
          COALESCE(ccp."totalCashCalled", 0) AS "totalCashCalled",
          COALESCE(ccp."totalOutstanding", 0) AS "totalOutstanding",
          COALESCE(ec."nonVoidEndorsementCount", 0) AS "nonVoidEndorsementCount",
          CASE
            WHEN bc."finalLossAmount" IS NULL THEN
              CASE
                WHEN bc."facultativeOffer" IS NULL THEN 0
                ELSE bc."estimatedLossAmount" * (bc."facultativeOffer" / 100)
              END
            ELSE COALESCE(at."totalAllocated", 0)
          END AS "claimShare",
          CASE
            WHEN bc."finalLossAmount" IS NULL THEN 'notification'
            WHEN COALESCE(at."totalAllocated", 0) > 0
             AND COALESCE(ccp."totalCashCalled", 0) >= COALESCE(at."totalAllocated", 0) - 0.01
             AND COALESCE(ccp."totalOutstanding", 0) <= 0.01
              THEN 'closed'
            ELSE 'open'
          END AS "bucket"
        FROM base_claims bc
        LEFT JOIN allocation_totals at ON at."claimId" = bc."claimId"
        LEFT JOIN cash_call_positions ccp ON ccp."claimId" = bc."claimId"
        LEFT JOIN endorsement_counts ec ON ec."placementId" = bc."placementId"
      )
    `;
  }

  private searchPredicate(search?: string) {
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

  private toDto(row: ClaimsWorklistRawRow): ClaimsWorklistRowDto {
    const nonVoidEndorsementCount = this.toInteger(row.nonVoidEndorsementCount);
    return {
      id: row.claimId,
      claimId: row.claimId,
      placementId: row.placementId,
      bucket: row.bucket,
      placement: this.toPlacementDto(row),
      claim: this.toClaimDto(row),
      recoveredAmount: this.toMoneyNumber(row.recoveredAmount),
      recoveredAt: this.toIsoOrNull(row.recoveredAt),
      isFullyRecovered: row.bucket === 'closed',
      claimShare: this.toMoneyNumber(row.claimShare),
      nonVoidEndorsementCount,
      hasNonVoidEndorsement: nonVoidEndorsementCount > 0,
    };
  }

  private toPlacementDto(
    row: ClaimsWorklistRawRow,
  ): ClaimsWorklistPlacementDto {
    return {
      id: row.placementId,
      reference: row.placementReference,
      policyNumber: row.policyNumber,
      title: row.title,
      classOfBusiness: row.classOfBusiness,
      riskTypeId: row.riskTypeId,
      cedant: { id: row.cedantId, name: row.cedantName },
      cedantId: row.cedantId,
      cedantName: row.cedantName,
      businessDetails: this.toJsonObject(row.businessDetails),
      offerDetails: this.toJsonObject(row.offerDetails),
      description: row.description,
      sumInsured: this.toOptionalMoneyNumber(row.sumInsured),
      rate: this.toOptionalMoneyNumber(row.rate),
      commission: this.toOptionalMoneyNumber(row.commission),
      facultativeOffer: this.toOptionalMoneyNumber(row.facultativeOffer),
      premium: this.toOptionalMoneyNumber(row.premium),
      currency: row.placementCurrency,
      inceptionDate: this.toIsoOrNull(row.inceptionDate),
      expiryDate: this.toIsoOrNull(row.expiryDate),
      status: row.placementStatus,
      createdAt: this.toIso(row.placementCreatedAt),
      updatedAt: this.toIso(row.placementUpdatedAt),
      archivedByUserId: row.archivedByUserId,
      archiveReason: row.archiveReason,
      archivedAt: this.toIsoOrNull(row.archivedAt),
      closeMode: row.closeMode,
      forceClosedAt: this.toIsoOrNull(row.forceClosedAt),
      forceClosedByUserId: row.forceClosedByUserId,
    };
  }

  private toClaimDto(row: ClaimsWorklistRawRow): ClaimsWorklistClaimDto {
    return {
      id: row.claimId,
      tenantId: row.tenantId,
      placementId: row.placementId,
      claimNumber: row.claimNumber,
      status: row.claimStatus,
      claimState: row.claimState,
      occurrenceDate: this.toIso(row.occurrenceDate),
      reportedDate: this.toIso(row.reportedDate),
      claimCause: row.claimCause,
      occurrenceDetails: row.occurrenceDetails,
      currency: row.claimCurrency,
      estimatedLossAmount: this.formatMoney(row.estimatedLossAmount),
      finalLossAmount: this.formatMoneyOrNull(row.finalLossAmount),
      finalizedAt: this.toIsoOrNull(row.finalizedAt),
      finalizedByUserId: row.finalizedByUserId,
      approvedPayableAmount: this.formatMoneyOrNull(row.approvedPayableAmount),
      approvedAt: this.toIsoOrNull(row.approvedAt),
      approvedByUserId: row.approvedByUserId,
      createdByUserId: row.createdByUserId,
      updatedByUserId: row.updatedByUserId,
      closedAt: this.toIsoOrNull(row.closedAt),
      voidedAt: this.toIsoOrNull(row.voidedAt),
      createdAt: this.toIso(row.claimCreatedAt),
      updatedAt: this.toIso(row.claimUpdatedAt),
    };
  }

  private toCurrencyAmounts(value: unknown): ClaimsCurrencyAmountDto[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const item = row as { code?: unknown; amount?: unknown };
        if (typeof item.code !== 'string') return null;
        const amount =
          typeof item.amount === 'string' || typeof item.amount === 'number'
            ? item.amount
            : 0;
        return {
          code: item.code,
          amount: this.money.roundMoney(this.toMoneyNumber(amount)),
        };
      })
      .filter((row): row is ClaimsCurrencyAmountDto => !!row);
  }

  private toJsonObject(value: Prisma.JsonValue | null): JsonObject | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    return value as JsonObject;
  }

  private toMoneyNumber(
    value: Prisma.Decimal | string | number | null,
  ): number {
    return this.money.roundMoney(this.money.toNumber(value ?? 0));
  }

  private toOptionalMoneyNumber(
    value: Prisma.Decimal | string | number | null,
  ): number | null {
    if (value === null || value === undefined) return null;
    return this.money.toNumber(value);
  }

  private formatMoney(value: Prisma.Decimal | string | number): string {
    return this.toMoneyNumber(value).toFixed(2);
  }

  private formatMoneyOrNull(
    value: Prisma.Decimal | string | number | null,
  ): string | null {
    return value === null || value === undefined
      ? null
      : this.formatMoney(value);
  }

  private toInteger(value: bigint | number | string): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }

  private toIsoOrNull(value: Date | string | null): string | null {
    return value ? this.toIso(value) : null;
  }

  private toIso(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
