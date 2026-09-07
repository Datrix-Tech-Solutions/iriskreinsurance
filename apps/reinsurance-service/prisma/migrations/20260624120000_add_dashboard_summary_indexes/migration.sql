-- Dashboard summary endpoints scan tenant-wide status/currency slices.
CREATE INDEX "PlacementClosing_tenantId_status_placementId_idx"
  ON reinsurance."PlacementClosing" ("tenantId", "status", "placementId");

CREATE INDEX "PlacementEndorsementClosing_tenantId_status_placementId_idx"
  ON reinsurance."PlacementEndorsementClosing" ("tenantId", "status", "placementId");

CREATE INDEX "PlacementPayment_tenantId_status_currency_placementId_idx"
  ON reinsurance."PlacementPayment" ("tenantId", "status", "currency", "placementId");

CREATE INDEX "PlacementNote_tenantId_status_placementId_idx"
  ON reinsurance."PlacementNote" ("tenantId", "status", "placementId");

CREATE INDEX "PlacementClaimAllocation_tenantId_status_placementId_idx"
  ON reinsurance."PlacementClaimAllocation" ("tenantId", "status", "placementId");

CREATE INDEX "PlacementClaimCashCall_tenantId_status_placementId_idx"
  ON reinsurance."PlacementClaimCashCall" ("tenantId", "status", "placementId");
