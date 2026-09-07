-- Claim state (Pending / Finalized) is orthogonal to the claim lifecycle status.
-- FINALIZED is the transition that generates reinsurer liability allocations and
-- locks the claim's financial inputs.
--
-- No data backfill: existing claims that already carry allocations keep their
-- financial lock (it keys off allocation rows, not this column). The UI derives
-- an effective FINALIZED state for legacy rows from finalLossAmount until a
-- backfill runs.
CREATE TYPE "reinsurance"."PlacementClaimState" AS ENUM ('PENDING', 'FINALIZED');

ALTER TABLE "reinsurance"."PlacementClaim"
  ADD COLUMN "claimState" "reinsurance"."PlacementClaimState" NOT NULL DEFAULT 'PENDING';
