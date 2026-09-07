export const PlacementPermission = {
  VIEW: 'operations.reinsurance.placements:VIEW',
  CREATE: 'operations.reinsurance.placements:CREATE',
  EDIT: 'operations.reinsurance.placements:EDIT',
  DELETE: 'operations.reinsurance.placements:DELETE',
} as const;

export const FacultativeOfferPermission = {
  CREATE_OFFER: 'operations.reinsurance.facultative-offers.create-offer:RUN',
  EDIT_OFFER: 'operations.reinsurance.facultative-offers.edit-offer:RUN',
  PARTIAL_EDIT: 'operations.reinsurance.facultative-offers.partial-edit:RUN',
  REOPEN_OFFER: 'operations.reinsurance.facultative-offers.reopen-offer:RUN',
  FORCE_CLOSE: 'operations.reinsurance.facultative-offers.force-close:RUN',
  ENDORSE_OFFER: 'operations.reinsurance.facultative-offers.endorse-offer:RUN',
  ARCHIVE_OFFER: 'operations.reinsurance.facultative-offers.archive-offer:RUN',
} as const;

export const PremiumPermission = {
  RECEIVE_FROM_CEDANT:
    'operations.reinsurance.premiums.receive-from-cedant:RUN',
  DISBURSE_TO_REINSURER:
    'operations.reinsurance.premiums.disburse-to-reinsurer:RUN',
  REVERSE_PAYMENT: 'operations.reinsurance.premiums.reverse-payment:RUN',
} as const;

export const ClaimWorkflowPermission = {
  ADD_CLAIM: 'operations.reinsurance.claims.add-claim:RUN',
  CREATE_NOTIFICATION: 'operations.reinsurance.claims.create-notification:RUN',
  RECORD_RECOVERY: 'operations.reinsurance.claims.record-recovery:RUN',
  VOID_CLAIM: 'operations.reinsurance.claims.void-claim:RUN',
} as const;
