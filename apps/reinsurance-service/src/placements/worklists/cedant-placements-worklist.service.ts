import { Injectable } from '@nestjs/common';
import {
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CedantPlacementFilter,
  QueryCedantPlacementsWorklistDto,
} from '../dto/query-cedant-placements-worklist.dto';
import {
  CedantPlacementParticipantDto,
  CedantPlacementsWorklistResponseDto,
  CedantPlacementsWorklistRowDto,
  CedantPlacementsWorklistSummaryDto,
} from '../dto/cedant-placements-worklist-response.dto';
import { PaymentWorklistPaymentStatus } from '../dto/payment-worklist-response.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type SqlNumber = Prisma.Decimal | string | number | null;

type CedantPlacementRawRow = {
  id: string;
  reference: string;
  policyNumber: string | null;
  title: string;
  classOfBusiness: string | null;
  riskTypeId: string | null;
  cedantId: string;
  cedantName: string;
  businessDetails: Prisma.JsonValue | null;
  offerDetails: Prisma.JsonValue | null;
  description: string | null;
  sumInsured: SqlNumber;
  rate: SqlNumber;
  commission: SqlNumber;
  facultativeOffer: SqlNumber;
  premium: SqlNumber;
  currency: string | null;
  inceptionDate: Date | string | null;
  expiryDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  archivedByUserId: string | null;
  archiveReason: string | null;
  archivedAt: Date | string | null;
  closeMode: string | null;
  forceClosedAt: Date | string | null;
  forceClosedByUserId: string | null;
  status: PlacementStatus;
  participants: unknown;
  totalOfferedPercent: SqlNumber;
  totalAcceptedPercent: SqlNumber;
  remainingPercent: SqlNumber;
  closingStatus: 'CONFIRMED' | null;
  paymentStatus: PaymentWorklistPaymentStatus;
  hasRecordedPayment: boolean;
  hasNonVoidEndorsement: boolean;
  acceptedParticipantCount: bigint | number | string;
  participantCount: bigint | number | string;
  currentObligation: SqlNumber;
  bankConfirmedCash: SqlNumber;
  pendingCash: SqlNumber;
  mandatoryDeductions: SqlNumber;
  effectiveSettlementCredit: SqlNumber;
  outstandingAmount: SqlNumber;
  totalCount: bigint | number | string;
  summary: unknown;
};

@Injectable()
export class ReinsuranceCedantPlacementsWorklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findPlacements(
    tenantId: string,
    query: QueryCedantPlacementsWorklistDto,
  ): Promise<CedantPlacementsWorklistResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filterPredicate = this.filterPredicate(query.filter ?? 'all');

    const rows = await this.prisma.$queryRaw<CedantPlacementRawRow[]>`
      ${this.cedantPlacementsCte(tenantId, query)}
      , filtered AS (
        SELECT *
        FROM rows
        WHERE TRUE
          ${filterPredicate}
      ),
      summarized AS (
        SELECT jsonb_build_object(
          'all', COUNT(*),
          'pending', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('DRAFT', 'MARKETING')),
          'closed', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED')),
          'unpaid', COUNT(*) FILTER (WHERE "paymentStatus" <> 'Paid'),
          'paid', COUNT(*) FILTER (WHERE "paymentStatus" = 'Paid')
        ) AS "summary"
        FROM rows
      ),
      counted AS (
        SELECT filtered.*, COUNT(*) OVER() AS "totalCount"
        FROM filtered
      )
      SELECT counted.*, summarized."summary"
      FROM counted
      CROSS JOIN summarized
      ORDER BY counted."createdAt" DESC, counted."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    if (!rows.length) {
      const summaryRows = await this.prisma.$queryRaw<
        { totalCount: bigint | number | string; summary: unknown }[]
      >`
        ${this.cedantPlacementsCte(tenantId, query)}
        , filtered AS (
          SELECT *
          FROM rows
          WHERE TRUE
            ${filterPredicate}
        )
        SELECT
          COUNT(*) AS "totalCount",
          (
            SELECT jsonb_build_object(
              'all', COUNT(*),
              'pending', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('DRAFT', 'MARKETING')),
              'closed', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED')),
              'unpaid', COUNT(*) FILTER (WHERE "paymentStatus" <> 'Paid'),
              'paid', COUNT(*) FILTER (WHERE "paymentStatus" = 'Paid')
            )
            FROM rows
          ) AS "summary"
        FROM filtered
      `;
      const total = this.toInteger(summaryRows[0]?.totalCount ?? 0);
      return {
        items: [],
        summary: this.toSummary(summaryRows[0]?.summary),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    const total = this.toInteger(rows[0].totalCount);
    return {
      items: rows.map((row) => this.toDto(row)),
      summary: this.toSummary(rows[0].summary),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private cedantPlacementsCte(
    tenantId: string,
    query: Pick<QueryCedantPlacementsWorklistDto, 'cedantId' | 'search'>,
  ): Prisma.Sql {
    const searchPredicate = this.searchPredicate(query.search);

    return Prisma.sql`
      WITH base_placements AS (
        SELECT
          p."id",
          p."reference",
          p."policyNumber",
          p."title",
          p."classOfBusiness",
          p."riskTypeId",
          p."cedantId",
          cedant."name" AS "cedantName",
          p."businessDetails",
          p."offerDetails",
          p."description",
          p."sumInsured",
          p."rate",
          p."commission",
          p."facultativeOffer",
          p."premium",
          p."currency",
          p."inceptionDate",
          p."expiryDate",
          p."createdAt",
          p."updatedAt",
          p."archivedByUserId",
          p."archiveReason",
          p."archivedAt",
          p."closeMode",
          p."forceClosedAt",
          p."forceClosedByUserId",
          p."status",
          COALESCE(rt."name", p."classOfBusiness") AS "riskTypeName"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."Counterparty" cedant
          ON cedant."id" = p."cedantId"
         AND cedant."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."risk_type" rt
          ON rt."id" = p."riskTypeId"
         AND rt."tenantId" = p."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."cedantId" = ${query.cedantId}
          AND p."archivedAt" IS NULL
          ${searchPredicate}
      ),
      participant_rows AS (
        SELECT
          pp."placementId",
          pp."id",
          pp."counterpartyId",
          pp."role",
          pp."status",
          pp."sharePercent",
          pp."signedLinePercent",
          pp."brokerageFee",
          pp."notes",
          pp."createdAt",
          counterparty."name" AS "counterpartyName"
        FROM "reinsurance"."PlacementParticipant" pp
        JOIN base_placements bp ON bp."id" = pp."placementId"
        JOIN "reinsurance"."Counterparty" counterparty
          ON counterparty."id" = pp."counterpartyId"
         AND counterparty."tenantId" = pp."tenantId"
        WHERE pp."tenantId" = ${tenantId}
      ),
      participant_rollup AS (
        SELECT
          pr."placementId",
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', pr."id",
              'counterpartyId', pr."counterpartyId",
              'role', pr."role",
              'status', pr."status",
              'sharePercent', pr."sharePercent",
              'signedLinePercent', pr."signedLinePercent",
              'brokerageFee', pr."brokerageFee",
              'notes', pr."notes",
              'createdAt', pr."createdAt",
              'counterparty', JSONB_BUILD_OBJECT('id', pr."counterpartyId", 'name', pr."counterpartyName")
            )
            ORDER BY
              pr."role" ASC,
              pr."createdAt" ASC,
              pr."id" ASC
          ) AS "participants",
          COUNT(*) AS "participantCount",
          COUNT(*) FILTER (WHERE pr."status" IN ('ACCEPTED', 'CLOSED')) AS "acceptedParticipantCount",
          COALESCE(SUM(pr."sharePercent"), 0) AS "totalOfferedPercent",
          COALESCE(SUM(pr."signedLinePercent") FILTER (WHERE pr."status" IN ('ACCEPTED', 'CLOSED')), 0) AS "totalAcceptedPercent"
        FROM participant_rows pr
        GROUP BY pr."placementId"
      ),
      original_snapshots AS (
        SELECT
          pc."placementId",
          pc."participantId" AS "snapshotKey",
          COALESCE(pc."grossPremium" - COALESCE(pc."commissionAmount", 0), pc."netPremium", 0) AS "cedantPremium",
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
      ),
      endorsement_snapshots AS (
        SELECT
          ec."placementId",
          COALESCE(ep."originalParticipantId", ec."endorsementParticipantId") AS "snapshotKey",
          COALESCE(ec."premiumSnapshot" - COALESCE(ec."commissionAmount", 0), ec."netPremium", 0) AS "cedantPremium",
          GREATEST(
            COALESCE(ec."premiumSnapshot" - COALESCE(ec."commissionAmount", 0), ec."netPremium", 0)
              - COALESCE(ec."netPremium", 0),
            0
          ) AS "mandatoryDeductions",
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
          SUM("cedantPremium") AS "currentObligation",
          SUM("mandatoryDeductions") AS "mandatoryDeductions",
          'CONFIRMED'::text AS "closingStatus"
        FROM effective_snapshots
        GROUP BY "placementId"
      ),
      payment_totals AS (
        SELECT
          pay."placementId",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'BANK_CONFIRMED'
          ) AS "bankConfirmedCash",
          SUM(pay."amount") FILTER (
            WHERE pay."type" = 'PREMIUM_RECEIVED'
              AND pay."status" = 'RECORDED'
          ) AS "pendingCash"
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."reversalOfPaymentId" IS NULL
        GROUP BY pay."placementId"
      ),
      endorsement_counts AS (
        SELECT e."placementId", COUNT(*) AS "nonVoidEndorsementCount"
        FROM "reinsurance"."PlacementEndorsement" e
        JOIN base_placements bp ON bp."id" = e."placementId"
        WHERE e."tenantId" = ${tenantId}
          AND e."status" <> 'VOID'
        GROUP BY e."placementId"
      ),
      rows AS (
        SELECT
          bp.*,
          COALESCE(pr."participants", '[]'::jsonb) AS "participants",
          COALESCE(pr."participantCount", 0) AS "participantCount",
          COALESCE(pr."acceptedParticipantCount", 0) AS "acceptedParticipantCount",
          COALESCE(pr."totalOfferedPercent", 0) AS "totalOfferedPercent",
          COALESCE(pr."totalAcceptedPercent", 0) AS "totalAcceptedPercent",
          GREATEST(COALESCE(bp."facultativeOffer", 0) - COALESCE(pr."totalAcceptedPercent", 0), 0) AS "remainingPercent",
          ob."closingStatus",
          COALESCE(ob."currentObligation", 0) AS "currentObligation",
          COALESCE(pt."bankConfirmedCash", 0) AS "bankConfirmedCash",
          COALESCE(pt."pendingCash", 0) AS "pendingCash",
          COALESCE(ob."mandatoryDeductions", 0) AS "mandatoryDeductions",
          COALESCE(pt."bankConfirmedCash", 0) + COALESCE(ob."mandatoryDeductions", 0) AS "effectiveSettlementCredit",
          GREATEST(
            COALESCE(ob."currentObligation", 0)
              - (COALESCE(pt."bankConfirmedCash", 0) + COALESCE(ob."mandatoryDeductions", 0)),
            0
          ) AS "outstandingAmount",
          COALESCE(ec."nonVoidEndorsementCount", 0) > 0 AS "hasNonVoidEndorsement",
          COALESCE(pt."pendingCash", 0) > 0.0001 AS "hasRecordedPayment",
          bp."status" AS "placementStatus",
          CASE
            WHEN COALESCE(ob."currentObligation", 0) > 0
             AND COALESCE(ob."currentObligation", 0)
                   - (COALESCE(pt."bankConfirmedCash", 0) + COALESCE(ob."mandatoryDeductions", 0)) <= 0.0001
             AND (
               COALESCE(pt."bankConfirmedCash", 0) > 0.0001
               OR COALESCE(ob."currentObligation", 0) - COALESCE(ob."mandatoryDeductions", 0) <= 0.0001
             )
              THEN 'Paid'
            WHEN COALESCE(pt."bankConfirmedCash", 0) > 0.0001
              THEN 'Part Payment'
            WHEN COALESCE(pt."pendingCash", 0) > 0.0001
              THEN 'Pending'
            ELSE 'Outstanding'
          END AS "paymentStatus"
        FROM base_placements bp
        LEFT JOIN participant_rollup pr ON pr."placementId" = bp."id"
        LEFT JOIN obligations ob ON ob."placementId" = bp."id"
        LEFT JOIN payment_totals pt ON pt."placementId" = bp."id"
        LEFT JOIN endorsement_counts ec ON ec."placementId" = bp."id"
      )
    `;
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
        OR p."classOfBusiness" ILIKE ${pattern}
        OR rt."name" ILIKE ${pattern}
      )
    `;
  }

  private filterPredicate(filter: CedantPlacementFilter): Prisma.Sql {
    switch (filter) {
      case 'pending':
        return Prisma.sql`AND "placementStatus"::text IN ('DRAFT', 'MARKETING')`;
      case 'closed':
        return Prisma.sql`AND "placementStatus"::text IN ('PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED')`;
      case 'unpaid':
        return Prisma.sql`AND "paymentStatus" <> 'Paid'`;
      case 'paid':
        return Prisma.sql`AND "paymentStatus" = 'Paid'`;
      case 'all':
      default:
        return Prisma.empty;
    }
  }

  private toDto(row: CedantPlacementRawRow): CedantPlacementsWorklistRowDto {
    const totalAcceptedPercent = this.toPercentNumber(row.totalAcceptedPercent);
    const facultativeOffer = this.toOptionalNumber(row.facultativeOffer);

    return {
      id: row.id,
      reference: row.reference,
      policyNumber: row.policyNumber,
      title: row.title,
      classOfBusiness: row.classOfBusiness,
      riskTypeId: row.riskTypeId,
      cedant: { id: row.cedantId, name: row.cedantName },
      cedantId: row.cedantId,
      cedantName: row.cedantName,
      businessDetails: this.toJsonObjectOrNull(row.businessDetails),
      offerDetails: this.toJsonObjectOrNull(row.offerDetails),
      description: row.description,
      sumInsured: this.toOptionalMoneyNumber(row.sumInsured),
      rate: this.toOptionalNumber(row.rate),
      commission: this.toOptionalNumber(row.commission),
      facultativeOffer,
      premium: this.toOptionalMoneyNumber(row.premium),
      currency: row.currency,
      inceptionDate: this.toIsoOrNull(row.inceptionDate),
      expiryDate: this.toIsoOrNull(row.expiryDate),
      createdAt: this.toIso(row.createdAt),
      updatedAt: this.toIso(row.updatedAt),
      archivedByUserId: row.archivedByUserId,
      archiveReason: row.archiveReason,
      archivedAt: this.toIsoOrNull(row.archivedAt),
      closeMode: row.closeMode,
      forceClosedAt: this.toIsoOrNull(row.forceClosedAt),
      forceClosedByUserId: row.forceClosedByUserId,
      status: row.status,
      participants: this.toParticipants(row.participants),
      totalOfferedPercent: this.toPercentNumber(row.totalOfferedPercent),
      totalAcceptedPercent,
      remainingPercent: this.roundPercent(
        Math.max(0, (facultativeOffer ?? 0) - totalAcceptedPercent),
      ),
      closingStatus: row.closingStatus,
      paymentStatus: row.paymentStatus,
      hasRecordedPayment: row.hasRecordedPayment,
      hasNonVoidEndorsement: row.hasNonVoidEndorsement,
      acceptedParticipantCount: this.toInteger(row.acceptedParticipantCount),
      participantCount: this.toInteger(row.participantCount),
      currentObligation: this.toMoneyNumber(row.currentObligation),
      bankConfirmedCash: this.toMoneyNumber(row.bankConfirmedCash),
      pendingCash: this.toMoneyNumber(row.pendingCash),
      mandatoryDeductions: this.toMoneyNumber(row.mandatoryDeductions),
      effectiveSettlementCredit: this.toMoneyNumber(
        row.effectiveSettlementCredit,
      ),
      outstandingAmount: this.toMoneyNumber(row.outstandingAmount),
    };
  }

  private toParticipants(value: unknown): CedantPlacementParticipantDto[] {
    const rows = Array.isArray(value) ? value : [];
    return rows.map((item) => {
      const row = item as Record<string, unknown>;
      const counterparty = row.counterparty as
        | { id?: unknown; name?: unknown }
        | undefined;
      return {
        id: this.toSafeString(row.id),
        counterpartyId: this.toSafeString(row.counterpartyId),
        role: row.role as PlacementParticipantRole,
        status: row.status as PlacementParticipantStatus,
        sharePercent: this.toStringOrNull(row.sharePercent),
        signedLinePercent: this.toStringOrNull(row.signedLinePercent),
        brokerageFee: this.toStringOrNull(row.brokerageFee),
        notes: this.toStringOrNull(row.notes),
        createdAt: this.toIsoOrNull(this.toStringOrNull(row.createdAt)),
        counterparty: {
          id: this.toSafeString(counterparty?.id ?? row.counterpartyId),
          name: this.toSafeString(counterparty?.name),
        },
      };
    });
  }

  private toSummary(value: unknown): CedantPlacementsWorklistSummaryDto {
    if (!value || typeof value !== 'object') {
      return { all: 0, pending: 0, closed: 0, unpaid: 0, paid: 0 };
    }
    const item = value as Record<string, unknown>;
    return {
      all: this.toInteger(item.all ?? 0),
      pending: this.toInteger(item.pending ?? 0),
      closed: this.toInteger(item.closed ?? 0),
      unpaid: this.toInteger(item.unpaid ?? 0),
      paid: this.toInteger(item.paid ?? 0),
    };
  }

  private toJsonObjectOrNull(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private toStringOrNull(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return null;
  }

  private toSafeString(value: unknown): string {
    return this.toStringOrNull(value) ?? '';
  }

  private toMoneyNumber(value: SqlNumber): number {
    return this.money.roundMoney(this.money.toNumber(value ?? 0));
  }

  private toOptionalMoneyNumber(value: SqlNumber): number | null {
    if (value === null || value === undefined) return null;
    return this.toMoneyNumber(value);
  }

  private toOptionalNumber(value: SqlNumber): number | null {
    if (value === null || value === undefined) return null;
    return this.money.toNumber(value);
  }

  private toPercentNumber(value: SqlNumber): number {
    return this.roundPercent(this.money.toNumber(value ?? 0));
  }

  private roundPercent(value: number): number {
    return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
  }

  private toInteger(value: unknown): number {
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
