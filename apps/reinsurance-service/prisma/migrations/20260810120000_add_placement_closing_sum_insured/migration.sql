-- Add the participant's sum insured share to the original placement closing.
--
-- PlacementEndorsementClosing already snapshots sumInsuredSnapshot (the
-- participant's signedLinePercent share of the risk's sum insured) at closing
-- creation. PlacementClosing never had the equivalent column, so the "Your
-- Sum Insured" line on the original (pre-endorsement) closing document had no
-- backend value to read and always rendered blank.

ALTER TABLE "reinsurance"."PlacementClosing"
  ADD COLUMN "sumInsuredSnapshot" DECIMAL(18, 2);
