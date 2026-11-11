import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';

/**
 * Requires base_placements(id, currency) and attribution_current
 * (id, placementId, snapshotKey, reinsurerId, sourceRank). Append after effective snapshots.
 * All amounts are same-currency cash: FX is deliberately rejected until reports
 * have an explicit contract for cash versus obligation-currency settlement.
 */
export function paymentAttributionCtes(
  tenantId: string,
  { guardPremiumReceipts = false }: { guardPremiumReceipts?: boolean } = {},
): Prisma.Sql {
  return Prisma.sql`
    attribution_sources AS (
      SELECT pc."id", pc."placementId", pc."participantId" AS "snapshotKey",
        pp."counterpartyId" AS "reinsurerId", pc."currency", 0 AS "sourceRank"
      FROM "reinsurance"."PlacementClosing" pc
      JOIN base_placements bp ON bp."id" = pc."placementId"
      JOIN "reinsurance"."PlacementParticipant" pp
        ON pp."id" = pc."participantId" AND pp."tenantId" = pc."tenantId"
        AND pp."placementId" = pc."placementId"
      WHERE pc."tenantId" = ${tenantId} AND pc."status" = 'CONFIRMED'
      UNION ALL
      SELECT ec."id", ec."placementId",
        COALESCE(ep."originalParticipantId", ec."endorsementParticipantId"),
        ep."counterpartyId", ec."currency", 1
      FROM "reinsurance"."PlacementEndorsementClosing" ec
      JOIN base_placements bp ON bp."id" = ec."placementId"
      JOIN "reinsurance"."PlacementEndorsementParticipant" ep
        ON ep."id" = ec."endorsementParticipantId" AND ep."tenantId" = ec."tenantId"
        AND ep."placementId" = ec."placementId"
      JOIN "reinsurance"."PlacementEndorsement" e
        ON e."id" = ec."endorsementId" AND e."tenantId" = ec."tenantId"
        AND e."placementId" = ec."placementId"
      -- Payment creation accepts every confirmed closing, independently of its
      -- endorsement's lifecycle/effective date. This proves source ownership;
      -- attribution_current alone determines whether an obligation is current.
      WHERE ec."tenantId" = ${tenantId} AND ec."status" = 'CONFIRMED'
    ),
    attribution_payments AS (
      SELECT pay.* FROM "reinsurance"."PlacementPayment" pay
      JOIN base_placements bp ON bp."id" = pay."placementId"
      WHERE pay."tenantId" = ${tenantId}
        AND pay."type" = 'REINSURER_DISBURSEMENT'
        AND pay."status" IN ('BANK_CONFIRMED', 'RECORDED')
        AND pay."reversalOfPaymentId" IS NULL
    ),
    attribution_allocations AS (
      SELECT a.*, n."closingId", n."endorsementClosingId",
        n."counterpartyId" AS "noteCounterpartyId", n."currency" AS "noteCurrency",
        n."direction" AS "noteDirection", n."type" AS "noteType"
      FROM "reinsurance"."PlacementPaymentAllocation" a
      JOIN attribution_payments pay ON pay."id" = a."paymentId"
      LEFT JOIN "reinsurance"."PlacementNote" n
        ON n."id" = a."noteId" AND n."tenantId" = pay."tenantId"
        AND n."placementId" = pay."placementId"
    ),
    attribution_payment_parts AS (
      SELECT pay."id" AS "paymentId", a."id" AS "pieceId", pay."placementId",
        pay."counterpartyId", pay."status", pay."direction", pay."currency", pay."settlementCurrency",
        a."allocatedAmount" AS "amount", a."allocatedCurrency", a."obligationAmount",
        a."obligationCurrency", a."closingId", a."endorsementClosingId",
        NULL::text AS "participantId",
        (a."tenantId" = pay."tenantId" AND a."placementId" = pay."placementId"
          AND a."noteCounterpartyId" = pay."counterpartyId"
          AND a."noteCurrency" = a."obligationCurrency"
          AND a."noteDirection" = 'BROKER_TO_REINSURER'
          AND a."noteType" IN ('CREDIT_NOTE', 'ENDORSEMENT_CREDIT_NOTE')) AS "validNote"
      FROM attribution_payments pay
      JOIN attribution_allocations a ON a."paymentId" = pay."id"
      UNION ALL
      SELECT pay."id", pay."id", pay."placementId", pay."counterpartyId",
        pay."status", pay."direction", pay."currency", pay."settlementCurrency", pay."amount", pay."currency",
        pay."amount", pay."currency", pay."closingId", pay."endorsementClosingId",
        pay."participantId", TRUE
      FROM attribution_payments pay
      WHERE NOT EXISTS (SELECT 1 FROM attribution_allocations a WHERE a."paymentId" = pay."id")
    ),
    attribution_resolved AS (
      SELECT p.*, source."id" AS "sourceClosingId", source."sourceRank",
        source."snapshotKey", source."currency" AS "sourceCurrency",
        source."matches", current_snapshot."id" AS "currentClosingId",
        current_snapshot."matches" AS "currentMatches", current_snapshot."sourceRank" AS "currentSourceRank"
      FROM attribution_payment_parts p
      LEFT JOIN LATERAL (
        -- MIN only projects a singleton; matches must equal 1 in the guard.
        -- It never chooses a winner among ambiguous historical sources.
        SELECT MIN(s."id") AS "id", MIN(s."sourceRank") AS "sourceRank",
          MIN(s."snapshotKey") AS "snapshotKey", MIN(s."currency") AS "currency",
          COUNT(*) AS "matches"
        FROM attribution_sources s
        WHERE s."placementId" = p."placementId" AND s."reinsurerId" = p."counterpartyId"
          AND (
            (p."closingId" IS NOT NULL AND p."endorsementClosingId" IS NULL
              AND s."sourceRank" = 0 AND s."id" = p."closingId"
              AND (p."participantId" IS NULL OR p."participantId" = s."snapshotKey"))
            OR (p."endorsementClosingId" IS NOT NULL AND p."closingId" IS NULL
              AND s."sourceRank" = 1 AND s."id" = p."endorsementClosingId"
              AND p."participantId" IS NULL)
            OR (p."closingId" IS NULL AND p."endorsementClosingId" IS NULL
              AND p."participantId" IS NOT NULL AND s."sourceRank" = 0
              AND s."snapshotKey" = p."participantId")
          )
      ) source ON TRUE
      LEFT JOIN LATERAL (
        -- As above, these projections are usable only after uniqueness validation.
        SELECT MIN(c."id") AS "id", MIN(c."sourceRank") AS "sourceRank", COUNT(*) AS "matches"
        FROM attribution_current c
        WHERE c."placementId" = p."placementId" AND c."snapshotKey" = source."snapshotKey"
          AND c."reinsurerId" = p."counterpartyId"
      ) current_snapshot ON TRUE
    ),
    attribution_errors AS (
      SELECT p."paymentId", 'Unresolved source, ambiguous attribution or FX' AS "reason"
      FROM attribution_resolved p
      JOIN base_placements bp ON bp."id" = p."placementId"
      WHERE p."matches" <> 1 OR p."currentMatches" > 1
        OR p."validNote" IS DISTINCT FROM TRUE OR p."direction" IS DISTINCT FROM 'OUTBOUND'
        OR p."amount" <= 0 OR p."obligationAmount" <= 0
        OR (p."settlementCurrency" IS NOT NULL AND p."settlementCurrency" <> p."currency")
        OR p."currency" IS DISTINCT FROM p."allocatedCurrency"
        OR p."currency" IS DISTINCT FROM p."obligationCurrency"
        OR p."currency" IS DISTINCT FROM p."sourceCurrency"
        OR p."currency" IS DISTINCT FROM bp."currency"
        OR p."amount" IS DISTINCT FROM p."obligationAmount"
        OR (p."currentClosingId" IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM attribution_sources s
          WHERE s."placementId" = p."placementId" AND s."id" = p."currentClosingId"
            AND s."sourceRank" = p."currentSourceRank" AND s."currency" = p."currency"
        ))
      UNION ALL
      SELECT pay."id", 'Allocations do not reconcile to payment header'
      FROM attribution_payments pay
      JOIN attribution_allocations a ON a."paymentId" = pay."id"
      GROUP BY pay."id", pay."amount"
      HAVING SUM(a."allocatedAmount") <> pay."amount"
      UNION ALL
      SELECT NULL::text, 'Current obligation currency differs from placement currency; report conversion is undefined'
      FROM attribution_current c
      JOIN attribution_sources s
        ON s."placementId" = c."placementId" AND s."id" = c."id"
        AND s."sourceRank" = c."sourceRank"
      JOIN base_placements bp ON bp."id" = c."placementId"
      WHERE s."currency" IS DISTINCT FROM bp."currency"
      ${
        guardPremiumReceipts
          ? Prisma.sql`
        UNION ALL
        SELECT pay."id", 'Premium receipt currency differs from placement currency; report conversion is undefined'
        FROM "reinsurance"."PlacementPayment" pay
        JOIN base_placements bp ON bp."id" = pay."placementId"
        WHERE pay."tenantId" = ${tenantId}
          AND pay."type" = 'PREMIUM_RECEIVED'
          AND pay."status" IN ('BANK_CONFIRMED', 'RECORDED')
          AND pay."reversalOfPaymentId" IS NULL
          AND pay."currency" IS DISTINCT FROM bp."currency"
      `
          : Prisma.empty
      }
    ),
    attribution_snapshot_payments AS (
      SELECT "placementId", "currentClosingId" AS "id", "currentSourceRank" AS "sourceRank",
        COALESCE(SUM("amount") FILTER (WHERE "status" = 'BANK_CONFIRMED'), 0) AS "disbursed",
        COALESCE(SUM("amount") FILTER (WHERE "status" = 'RECORDED'), 0) AS "pending"
      FROM attribution_resolved WHERE "currentClosingId" IS NOT NULL
      GROUP BY "placementId", "currentClosingId", "currentSourceRank"
    ),
    attribution_credit_rows AS (
      SELECT "placementId", "sourceClosingId" AS "id", "sourceRank", "snapshotKey",
        "counterpartyId" AS "reinsurerId",
        COALESCE(SUM("amount") FILTER (WHERE "status" = 'BANK_CONFIRMED'), 0) AS "disbursed",
        COALESCE(SUM("amount") FILTER (WHERE "status" = 'RECORDED'), 0) AS "pending"
      FROM attribution_resolved WHERE "currentClosingId" IS NULL
      GROUP BY "placementId", "sourceClosingId", "sourceRank", "snapshotKey", "counterpartyId"
    )
  `;
}

/** Must run before emitting rows or exports, including empty/paginated results. */
export async function assertPaymentAttribution(
  prisma: { $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> },
  ctes: Prisma.Sql,
): Promise<void> {
  const errors = await prisma.$queryRaw<
    Array<{ paymentId: string | null; reason: string }>
  >(
    Prisma.sql`${ctes} SELECT "paymentId", "reason" FROM attribution_errors LIMIT 1`,
  );
  if (errors.length) {
    throw new ConflictException(
      `Payment attribution cannot be determined safely: ${errors[0].reason}`,
    );
  }
}
