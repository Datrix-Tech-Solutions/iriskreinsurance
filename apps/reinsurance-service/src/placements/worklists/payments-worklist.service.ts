import { Injectable } from '@nestjs/common';
import { PlacementStatus, Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentWorklistPaymentStatus,
  PaymentWorklistResponseDto,
  PaymentWorklistRowDto,
} from '../dto/payment-worklist-response.dto';
import {
  PaymentWorklistStatusFilter,
  QueryPaymentWorklistDto,
} from '../dto/query-payment-worklist.dto';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type PaymentWorklistRawRow = {
  id: string;
  placementId: string;
  reference: string | null;
  policyNumber: string | null;
  title: string;
  classOfBusiness: string | null;
  cedantId: string;
  cedantName: string;
  sumInsured: Prisma.Decimal | string | number | null;
  premium: Prisma.Decimal | string | number | null;
  facultativeOffer: Prisma.Decimal | string | number | null;
  commission: Prisma.Decimal | string | number | null;
  acceptedParticipantCount: bigint | number | string;
  currency: string | null;
  paidAmount: Prisma.Decimal | string | number | null;
  outstandingAmount: Prisma.Decimal | string | number | null;
  currentObligation: Prisma.Decimal | string | number | null;
  latestConfirmedPaymentDate: Date | string | null;
  placementStatus: PlacementStatus;
  paymentStatus: PaymentWorklistPaymentStatus;
  hasNonVoidEndorsement: boolean;
  createdAt: Date | string;
  sortDate: Date | string;
  totalCount: bigint | number | string;
};

type EffectivePlacementTerms = {
  sumInsured: number | null;
  premium: number | null;
  facultativeOfferPercent: number | null;
};

@Injectable()
export class ReinsurancePaymentsWorklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
    private readonly effectiveViewService: PlacementEffectiveViewService,
  ) {}

  async findPayments(
    tenantId: string,
    query: QueryPaymentWorklistDto,
  ): Promise<PaymentWorklistResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const statusPredicate = this.statusPredicate(query.status);
    const searchPredicate = this.searchPredicate(query.search);
    const cedantPredicate = query.cedantId
      ? Prisma.sql`AND p."cedantId" = ${query.cedantId}`
      : Prisma.empty;
    const placementIdsPredicate = query.placementIds?.length
      ? Prisma.sql`AND p."id" IN (${Prisma.join(query.placementIds)})`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<PaymentWorklistRawRow[]>`
      WITH base_placements AS (
        SELECT
          p."id",
          p."reference",
          p."policyNumber",
          p."title",
          p."classOfBusiness",
          p."cedantId",
          p."sumInsured",
          p."premium",
          p."facultativeOffer",
          p."commission",
          p."currency",
          p."status",
          p."createdAt",
          c."name" AS "cedantName"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = p."cedantId"
         AND c."tenantId" = p."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          ${cedantPredicate}
          ${placementIdsPredicate}
          ${searchPredicate}
      ),
      accepted_counts AS (
        SELECT
          pp."placementId",
          COUNT(*) AS "acceptedParticipantCount"
        FROM "reinsurance"."PlacementParticipant" pp
        JOIN base_placements bp ON bp."id" = pp."placementId"
        WHERE pp."tenantId" = ${tenantId}
          AND pp."status" IN ('ACCEPTED', 'CLOSED')
        GROUP BY pp."placementId"
      ),
      original_snapshots AS (
        SELECT
          pc."placementId",
          pc."participantId" AS "snapshotKey",
          COALESCE(pc."grossPremium" - COALESCE(pc."commissionAmount", 0), pc."netPremium", 0) AS "cedantPremium",
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
      ),
      endorsement_snapshots AS (
        SELECT
          ec."placementId",
          COALESCE(ep."originalParticipantId", ec."endorsementParticipantId") AS "snapshotKey",
          COALESCE(ec."premiumSnapshot" - COALESCE(ec."commissionAmount", 0), ec."netPremium", 0) AS "cedantPremium",
          1 AS "sourceRank",
          e."effectiveDate" AS "effectiveDate",
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
            snapshots.*,
            ROW_NUMBER() OVER (
              PARTITION BY snapshots."placementId", snapshots."snapshotKey"
              ORDER BY
                snapshots."sourceRank" DESC,
                snapshots."effectiveDate" DESC NULLS LAST,
                snapshots."endorsementCreatedAt" DESC NULLS LAST,
                snapshots."endorsementId" DESC NULLS LAST,
                snapshots."createdAt" DESC,
                snapshots."id" DESC
            ) AS rn
          FROM (
            SELECT * FROM original_snapshots
            UNION ALL
            SELECT * FROM endorsement_snapshots
          ) snapshots
        ) ranked
        WHERE ranked.rn = 1
      ),
      obligations AS (
        SELECT
          "placementId",
          SUM("cedantPremium") AS "currentObligation"
        FROM effective_snapshots
        GROUP BY "placementId"
      ),
      payment_totals AS (
        SELECT
          pay."placementId",
          SUM(pay."amount") FILTER (WHERE pay."status" = 'BANK_CONFIRMED') AS "paidAmount",
          SUM(pay."amount") FILTER (WHERE pay."status" = 'RECORDED') AS "pendingAmount",
          MAX(pay."createdAt") AS "latestConfirmedPaymentDate"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."type" = 'PREMIUM_RECEIVED'
          AND pay."reversalOfPaymentId" IS NULL
        GROUP BY pay."placementId"
      ),
      rows AS (
        SELECT
          bp."id",
          bp."id" AS "placementId",
          bp."reference",
          bp."policyNumber",
          bp."title",
          bp."classOfBusiness",
          bp."cedantId",
          bp."cedantName",
          bp."sumInsured",
          bp."premium",
          bp."facultativeOffer",
          bp."commission",
          bp."createdAt",
          EXISTS (
            SELECT 1
            FROM "reinsurance"."PlacementEndorsement" e2
            WHERE e2."placementId" = bp."id"
              AND e2."tenantId" = ${tenantId}
              AND e2."status" <> 'VOID'
          ) AS "hasNonVoidEndorsement",
          COALESCE(ac."acceptedParticipantCount", 0) AS "acceptedParticipantCount",
          bp."currency",
          COALESCE(pt."paidAmount", 0) AS "paidAmount",
          COALESCE(ob."currentObligation", 0) - COALESCE(pt."paidAmount", 0) AS "outstandingAmount",
          COALESCE(ob."currentObligation", 0) AS "currentObligation",
          pt."latestConfirmedPaymentDate",
          bp."status" AS "placementStatus",
          CASE
            WHEN COALESCE(ob."currentObligation", 0) > 0
             AND COALESCE(ob."currentObligation", 0) - COALESCE(pt."paidAmount", 0) <= 0.0001
              THEN 'Paid'
            WHEN COALESCE(pt."paidAmount", 0) > 0
              THEN 'Part Payment'
            WHEN COALESCE(pt."pendingAmount", 0) > 0.0001
              THEN 'Pending'
            ELSE 'Outstanding'
          END AS "paymentStatus",
          COALESCE(pt."latestConfirmedPaymentDate", bp."createdAt") AS "sortDate"
        FROM base_placements bp
        LEFT JOIN accepted_counts ac ON ac."placementId" = bp."id"
        LEFT JOIN obligations ob ON ob."placementId" = bp."id"
        LEFT JOIN payment_totals pt ON pt."placementId" = bp."id"
      ),
      filtered AS (
        SELECT *
        FROM rows
        WHERE TRUE
          ${statusPredicate}
      ),
      counted AS (
        SELECT
          filtered.*,
          COUNT(*) OVER() AS "totalCount"
        FROM filtered
      )
      SELECT *
      FROM counted
      ORDER BY "sortDate" DESC, "placementId" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Endorsements amend the policy without touching the base Placement row, so raw
    // sumInsured / premium / facultativeOffer never move. Resolve the canonical effective
    // view for the endorsed placements on this page and overlay it below; everything else
    // keeps its base terms.
    const endorsedPlacementIds = rows
      .filter((row) => row.hasNonVoidEndorsement)
      .map((row) => row.placementId);
    const effectiveTermsByPlacement = new Map<
      string,
      EffectivePlacementTerms
    >();
    await Promise.all(
      [...new Set(endorsedPlacementIds)].map(async (placementId) => {
        try {
          const view = await this.effectiveViewService.getEffectiveView(
            tenantId,
            placementId,
          );
          effectiveTermsByPlacement.set(placementId, {
            sumInsured: view.effectiveTotals.sumInsured,
            premium: view.effectiveTotals.premium,
            facultativeOfferPercent:
              view.effectiveTotals.facultativeOfferPercent,
          });
        } catch {
          // Fall back to base terms for this row rather than failing the worklist.
        }
      }),
    );

    const total = rows[0] ? this.toInteger(rows[0].totalCount) : 0;
    return {
      items: rows.map((row) =>
        this.toDto(row, effectiveTermsByPlacement.get(row.placementId)),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private statusPredicate(status?: PaymentWorklistStatusFilter) {
    if (!status) return Prisma.empty;
    if (status === 'Placed') {
      return Prisma.sql`AND "placementStatus"::text IN ('PLACED', 'PARTIALLY_PLACED', 'CLOSING')`;
    }
    if (status === 'Closed') {
      return Prisma.sql`AND "placementStatus"::text IN ('CLOSED', 'DECLINED', 'CANCELLED')`;
    }
    return Prisma.sql`AND "paymentStatus" = ${status}`;
  }

  private searchPredicate(search?: string) {
    const trimmed = search?.trim();
    if (!trimmed) return Prisma.empty;
    const pattern = `%${trimmed}%`;
    return Prisma.sql`
      AND (
        p."reference" ILIKE ${pattern}
        OR p."policyNumber" ILIKE ${pattern}
        OR p."title" ILIKE ${pattern}
        OR p."classOfBusiness" ILIKE ${pattern}
        OR c."name" ILIKE ${pattern}
      )
    `;
  }

  private toDto(
    row: PaymentWorklistRawRow,
    effective?: EffectivePlacementTerms,
  ): PaymentWorklistRowDto {
    const sumInsured = this.toOptionalMoneyNumber(row.sumInsured);
    const facultativeOffer = this.toOptionalMoneyNumber(row.facultativeOffer);
    const premium = this.toOptionalMoneyNumber(row.premium);
    const outstandingAmount = this.money.roundMoney(
      this.toMoneyNumber(row.outstandingAmount),
    );

    const effectiveSumInsured = effective?.sumInsured ?? sumInsured;
    const effectivePremium = effective?.premium ?? premium;
    const effectiveFacultativeOfferPercent =
      effective?.facultativeOfferPercent ?? facultativeOffer;
    const facultativeSumInsuredOf = (
      si: number | null,
      offer: number | null,
    ): number | null =>
      si == null || offer == null
        ? null
        : this.money.roundMoney(si * (offer / 100));

    return {
      id: row.id,
      placementId: row.placementId,
      reference: row.reference,
      policyNumber: row.policyNumber,
      title: row.title,
      classOfBusiness: row.classOfBusiness,
      cedantId: row.cedantId,
      cedantName: row.cedantName,
      sumInsured,
      facultativeOffer,
      commission: this.toOptionalMoneyNumber(row.commission),
      facultativeSumInsured: facultativeSumInsuredOf(
        sumInsured,
        facultativeOffer,
      ),
      effectiveSumInsured,
      effectivePremium,
      effectiveFacultativeOfferPercent,
      effectiveFacultativeSumInsured: facultativeSumInsuredOf(
        effectiveSumInsured,
        effectiveFacultativeOfferPercent,
      ),
      acceptedParticipantCount: this.toInteger(row.acceptedParticipantCount),
      currency: row.currency,
      paidAmount: this.money.roundMoney(this.toMoneyNumber(row.paidAmount)),
      outstandingAmount,
      outstandingLabel: outstandingAmount < 0 ? 'credit' : 'outstanding',
      currentObligation: this.money.roundMoney(
        this.toMoneyNumber(row.currentObligation),
      ),
      latestConfirmedPaymentDate: this.toIsoOrNull(
        row.latestConfirmedPaymentDate,
      ),
      placementStatus: row.placementStatus,
      paymentStatus: row.paymentStatus,
      createdAt: this.toIso(row.createdAt),
      sortDate: this.toIso(row.sortDate),
    };
  }

  private toMoneyNumber(
    value: Prisma.Decimal | string | number | null,
  ): number {
    return this.money.toNumber(value ?? 0);
  }

  private toOptionalMoneyNumber(
    value: Prisma.Decimal | string | number | null,
  ): number | null {
    if (value === null || value === undefined) return null;
    return this.money.toNumber(value);
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
