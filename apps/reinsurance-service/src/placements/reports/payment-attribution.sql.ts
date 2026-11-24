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
    -- Keep the ownership proof as data until matching. Filtering the redundant
    -- participant/placement FK equality here drastically underestimates sources
    -- and selects repeated nested-loop scans of otherwise large CTEs.
    attribution_sources AS MATERIALIZED (
      SELECT pc."id", pc."placementId", pc."participantId" AS "snapshotKey",
        pp."counterpartyId" AS "reinsurerId", pc."currency", 0 AS "sourceRank",
        (pp."placementId" = pc."placementId") AS "validSource"
      FROM "reinsurance"."PlacementClosing" pc
      JOIN base_placements bp ON bp."id" = pc."placementId"
      JOIN "reinsurance"."PlacementParticipant" pp
        ON pp."id" = pc."participantId" AND pp."tenantId" = pc."tenantId"
      WHERE pc."tenantId" = ${tenantId} AND pc."status" = 'CONFIRMED'
      UNION ALL
      SELECT ec."id", ec."placementId",
        COALESCE(ep."originalParticipantId", ec."endorsementParticipantId"),
        ep."counterpartyId", ec."currency", 1,
        (ep."placementId" = ec."placementId" AND e."placementId" = ec."placementId")
      FROM "reinsurance"."PlacementEndorsementClosing" ec
      JOIN base_placements bp ON bp."id" = ec."placementId"
      JOIN "reinsurance"."PlacementEndorsementParticipant" ep
        ON ep."id" = ec."endorsementParticipantId" AND ep."tenantId" = ec."tenantId"
      JOIN "reinsurance"."PlacementEndorsement" e
        ON e."id" = ec."endorsementId" AND e."tenantId" = ec."tenantId"
      -- Payment creation accepts every confirmed closing, independently of its
      -- endorsement's lifecycle/effective date. This proves source ownership;
      -- attribution_current alone determines whether an obligation is current.
      WHERE ec."tenantId" = ${tenantId} AND ec."status" = 'CONFIRMED'
    ),
    attribution_payments AS (
      SELECT pay."id", pay."tenantId", pay."placementId", pay."counterpartyId",
        pay."status", pay."direction", pay."currency", pay."settlementCurrency",
        pay."amount", pay."closingId", pay."endorsementClosingId", pay."participantId"
      FROM "reinsurance"."PlacementPayment" pay
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
    -- Hashable placement/payee joins evaluate all source candidates as a set.
    -- The identity predicates remain exactly the three original exclusive shapes.
    attribution_source_candidates AS (
      SELECT p."paymentId", p."pieceId", s.*
      FROM attribution_payment_parts p
      JOIN attribution_sources s ON s."placementId" = p."placementId"
        AND s."reinsurerId" = p."counterpartyId" AND s."validSource"
        AND CASE
          WHEN p."closingId" IS NOT NULL AND p."endorsementClosingId" IS NULL THEN
            s."sourceRank" = 0 AND s."id" = p."closingId"
              AND (p."participantId" IS NULL OR p."participantId" = s."snapshotKey")
          WHEN p."endorsementClosingId" IS NOT NULL AND p."closingId" IS NULL THEN
            s."sourceRank" = 1 AND s."id" = p."endorsementClosingId"
              AND p."participantId" IS NULL
          WHEN p."closingId" IS NULL AND p."endorsementClosingId" IS NULL THEN
            p."participantId" IS NOT NULL AND s."sourceRank" = 0
              AND s."snapshotKey" = p."participantId"
          ELSE FALSE
        END
    ),
    attribution_source_matches AS (
      SELECT "paymentId", "pieceId", MIN("id") AS "id",
        MIN("sourceRank") AS "sourceRank", MIN("snapshotKey") AS "snapshotKey",
        MIN("currency") AS "currency", COUNT(*) AS "matches",
        MIN("placementId") AS "placementId", MIN("reinsurerId") AS "reinsurerId"
      FROM attribution_source_candidates GROUP BY "paymentId", "pieceId"
    ),
    attribution_current_matches AS (
      SELECT s."paymentId", s."pieceId", MIN(c."id") AS "id",
        MIN(c."sourceRank") AS "sourceRank", COUNT(*) AS "matches"
      FROM attribution_source_matches s
      JOIN attribution_current c ON c."placementId" = s."placementId"
        AND c."snapshotKey" = s."snapshotKey" AND c."reinsurerId" = s."reinsurerId"
      GROUP BY s."paymentId", s."pieceId"
    ),
    attribution_resolved AS (
      -- MIN only projects a candidate identity; matches=1 is still mandatory.
      -- Missing matches must retain COUNT's former zero (not NULL) semantics.
      SELECT p.*, source."id" AS "sourceClosingId", source."sourceRank",
        source."snapshotKey", source."currency" AS "sourceCurrency",
        COALESCE(source."matches", 0) AS "matches", current_snapshot."id" AS "currentClosingId",
        COALESCE(current_snapshot."matches", 0) AS "currentMatches", current_snapshot."sourceRank" AS "currentSourceRank"
      FROM attribution_payment_parts p
      LEFT JOIN attribution_source_matches source
        ON source."paymentId" = p."paymentId" AND source."pieceId" = p."pieceId"
      LEFT JOIN attribution_current_matches current_snapshot
        ON current_snapshot."paymentId" = p."paymentId" AND current_snapshot."pieceId" = p."pieceId"
    ),
    attribution_current_currencies AS (
      -- Existence projection, not selection of an arbitrary matching closing.
      SELECT DISTINCT c."placementId", c."id", c."sourceRank", s."currency"
      FROM attribution_current c
      JOIN attribution_sources s ON s."placementId" = c."placementId"
        AND s."id" = c."id" AND s."sourceRank" = c."sourceRank"
      WHERE s."validSource"
    ),
    attribution_errors AS MATERIALIZED (
      SELECT p."paymentId", 'Unresolved source, ambiguous attribution or FX' AS "reason"
      FROM attribution_resolved p
      JOIN base_placements bp ON bp."id" = p."placementId"
      LEFT JOIN attribution_current_currencies valid_current
        ON valid_current."placementId" = p."placementId"
        AND valid_current."id" = p."currentClosingId"
        AND valid_current."sourceRank" = p."currentSourceRank"
        AND valid_current."currency" = p."currency"
      WHERE p."matches" <> 1 OR p."currentMatches" > 1
        OR p."validNote" IS DISTINCT FROM TRUE OR p."direction" IS DISTINCT FROM 'OUTBOUND'
        OR p."amount" <= 0 OR p."obligationAmount" <= 0
        OR (p."settlementCurrency" IS NOT NULL AND p."settlementCurrency" <> p."currency")
        OR p."currency" IS DISTINCT FROM p."allocatedCurrency"
        OR p."currency" IS DISTINCT FROM p."obligationCurrency"
        OR p."currency" IS DISTINCT FROM p."sourceCurrency"
        OR p."currency" IS DISTINCT FROM bp."currency"
        OR p."amount" IS DISTINCT FROM p."obligationAmount"
        OR (p."currentClosingId" IS NOT NULL AND valid_current."id" IS NULL)
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
      WHERE s."validSource" AND s."currency" IS DISTINCT FROM bp."currency"
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
