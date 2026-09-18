/**
 * Any-of permission rule lists that gate the reinsurance workflow UI.
 *
 * FACULTATIVE OFFER lists mirror the controllers exactly:
 *   @RequireAnyPermission(<granular>:RUN, placements:<ACTION>)
 * — holding either the granular RUN permission or the coarse placements action
 * passes, so the UI gates the same way.
 *
 * CLAIM and PREMIUM lists mirror the controllers, EXCEPT the pure "add" /
 * "reverse" entry points (addClaim, addNotification, addPayment, reversePayment)
 * which drop the coarse `placements:CREATE/EDIT` fallback the backend still
 * accepts: every offer role holds those, so mirroring would leak claim/premium
 * entry to any offer-creator. Those few lists are intentionally stricter than
 * the API. editClaim / claimStatusChange / recordRecovery DO keep the coarse
 * `placements:EDIT` so the UI matches the (now @RequireAnyPermission) backend.
 *
 * Keep in sync with:
 *  - apps/reinsurance-service/src/placements/placements.controller.ts
 *  - apps/reinsurance-service/src/placements/controllers/placement-claims.controller.ts
 *  - apps/reinsurance-service/src/placements/controllers/placement-endorsements.controller.ts
 *  - apps/reinsurance-service/src/placements/placement.permissions.ts
 */

const P = 'operations.reinsurance.placements';
const C = 'operations.reinsurance.claims';
const FO = 'operations.reinsurance.facultative-offers';
const PR = 'operations.reinsurance.premiums';

export const RiPerm = {
  // ── Facultative offer workflows (placements.controller.ts) ──────────────────
  /** POST /placements — also covers renewals (a renewal is a new offer). */
  createOffer: [`${FO}.create-offer:RUN`, `${P}:CREATE`],
  /** PATCH /placements/:id — material edit / Edit Slip. */
  editOffer: [`${FO}.edit-offer:RUN`, `${P}:EDIT`],
  /** PATCH /placements/:id — non-material edit (policy number etc.). */
  partialEdit: [`${FO}.partial-edit:RUN`, `${FO}.edit-offer:RUN`, `${P}:EDIT`],
  /** PATCH /placements/:id/status — reopen an unpaid closed offer. */
  reopenOffer: [`${FO}.reopen-offer:RUN`, `${P}:EDIT`],
  /** POST /placements/:id/force-close. */
  forceClose: [`${FO}.force-close:RUN`, `${P}:EDIT`],
  /** POST /placements/:id/endorsements — start a new endorsement. */
  endorseOffer: [`${FO}.endorse-offer:RUN`, `${P}:CREATE`],
  /**
   * Every endorsement mutation after creation — edit endorsement / status,
   * closings (create / validate-and-confirm / force-close / status),
   * participants (add / edit / status / reinvite / remove), and endorsement
   * notes (debit / credit / issue / void). All guarded with
   * @RequireAnyPermission(endorse-offer:RUN, placements:EDIT). The single
   * `endorse_offer` role pill grants endorse-offer:RUN, which satisfies this.
   */
  manageEndorsement: [`${FO}.endorse-offer:RUN`, `${P}:EDIT`],
  /** DELETE /placements/:id — archive. */
  archiveOffer: [`${FO}.archive-offer:RUN`, `${P}:DELETE`],
  /** Participant add/edit/accept-and-confirm/status/delete routes. */
  editParticipants: [`${FO}.edit-offer:RUN`, `${P}:EDIT`],

  // ── Premium workflows (placements.controller.ts payments routes) ────────────
  /**
   * POST /placements/:id/payments — record an inbound or outbound premium.
   * The backend also accepts placements:CREATE, but that leaks premium entry to
   * any offer-creator, so the UI requires a premium-specific permission here.
   */
  addPayment: [`${PR}.receive-from-cedant:RUN`, `${PR}.disburse-to-reinsurer:RUN`],
  /**
   * POST /placements/:id/payments/:paymentId/reverse. Backend also accepts
   * placements:EDIT; the UI requires the premium permission.
   */
  reversePayment: [`${PR}.reverse-payment:RUN`],

  // ── Claim workflows (placement-claims.controller.ts) ───────────────────────
  /**
   * GET routes — backend checks placements:VIEW (which every operations role
   * has), so the UI gates on the claims-domain view permission instead.
   */
  viewClaim: [`${C}:VIEW`],
  /**
   * POST /:id/claims (mode="actual") — register an actual claim loss event.
   * Backend: @RequireAnyPermission(add-claim:RUN, create-notification:RUN,
   * placements:CREATE). UI drops create-notification:RUN so a notification-only
   * role doesn't see the "Add Claim" (actual loss) button.
   */
  addClaim: [`${C}.add-claim:RUN`, `${C}:CREATE`],
  /**
   * POST /:id/claims (mode="notification") — log a first notification of loss.
   * Same endpoint as addClaim; also satisfied by the notification-workflow
   * permission so the "Create notifications" pill can log an FNOL.
   */
  addNotification: [`${C}.create-notification:RUN`, `${C}.add-claim:RUN`, `${C}:CREATE`],
  /**
   * PATCH /:id/claims/:claimId — edit claim details / finalize ("Move to Open").
   * @RequireAnyPermission(add-claim:RUN, create-notification:RUN, placements:EDIT)
   * — create a claim ⇒ amend it; run the notification workflow ⇒ finalize it.
   */
  editClaim: [`${C}.add-claim:RUN`, `${C}.create-notification:RUN`, `${P}:EDIT`],
  /**
   * PATCH /:id/claims/:claimId/status — notify / void a claim.
   * @RequireAnyPermission(create-notification:RUN, void-claim:RUN, placements:EDIT).
   */
  claimStatusChange: [`${C}.create-notification:RUN`, `${C}.void-claim:RUN`, `${P}:EDIT`],
  /**
   * POST /:id/claims/:claimId/cash-calls/:cashCallId/recovery-receipts.
   * @RequireAnyPermission(record-recovery:RUN, placements:EDIT).
   */
  recordRecovery: [`${C}.record-recovery:RUN`, `${P}:EDIT`],
} satisfies Record<string, string[]>;
