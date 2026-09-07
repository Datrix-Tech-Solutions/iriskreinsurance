import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useFacultatives } from './useFacultatives';
import { useClaimsByTab, allocationsKey, recoveryPositionKey } from './useClaims';
import { CLOSING_STATUSES, paymentsKey, fetchPlacementPayments } from './usePayments';
import { useRiskTypes } from './useRiskTypes';
import { firstPremiumPaymentDate } from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import type { PlacementClaimAllocation, PlacementClaimRecoveryPosition } from '@/types/reinsurance';

const PLACEMENT_BASE = '/operations/reinsurance/placements';
const MS_PER_DAY = 86_400_000;

export type ClaimsReportBucket = 'notification' | 'open' | 'closed';

export interface ClaimsReportParams {
  /** Restricts to claims whose occurrenceDate falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  cedantIds?: string[];
  currency?: string;
  bucket?: ClaimsReportBucket;
}

/**
 * One reinsurer's participation in a claim. The report explodes a claim into one
 * display row per entry of this list for the General and Reinsurer scopes.
 */
export interface ClaimReinsurerBreakdown {
  reinsurerId: string;
  reinsurerName: string;
  /** Signed line % on the claim allocation. */
  sharePercent: number | null;
  /** Allocated claim share (final loss where set, else estimated). */
  shareAmount: number | null;
  /** Bank-confirmed recovery received from this reinsurer. */
  paidAmount: number;
  /** Position outstanding for this reinsurer, else shareAmount − paidAmount (≥ 0). */
  outstandingAmount: number;
  /** Days from claim finalization to this reinsurer's last confirmed recovery
   *  (or to now while still outstanding). Null until the claim is finalized. */
  agingDays: number | null;
}

export interface ClaimReportRow {
  id: string;
  placementId: string;
  policyNumber: string;
  /** Insured / business name. */
  businessName: string;
  cedantName: string;
  /** Risk type / class of business. */
  policyType: string | null;
  /** Cause of claim. */
  claimType: string | null;
  /** Offer inception / expiry — the period of insurance. */
  periodStart: string | null;
  periodEnd: string | null;
  claimNumber: string;
  currency: string;
  /** Date of loss. */
  occurrenceDate: string;
  /** Earliest premium payment date on the offer. */
  premiumPaidAt: string | null;
  estimatedLossAmount: number;
  finalLossAmount: number | null;
  /** finalLossAmount ?? estimatedLossAmount. */
  claimAmount: number;
  finalizedAt: string | null;
  recoveredAmount: number | null;
  recoveredAt: string | null;
  bucket: ClaimsReportBucket;
  /** iRisk's ceded-then-recovered share of the claim. */
  iriskSharePercent: number | null;
  iriskShareAmount: number | null;
  iriskSharePaid: number | null;
  iriskShareOutstanding: number | null;
  /** Per-reinsurer participation; empty for notification claims. */
  reinsurers: ClaimReinsurerBreakdown[];
}

export interface ClaimsReportSummary {
  openClaims: number;
  closedClaims: number;
  /** Share of finalized claims (open + closed) that have been fully recovered from reinsurers. */
  recoveryRate: number;
}

const num = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : parseFloat(v) || 0;

function fetchAllocations(
  placementId: string,
  claimId: string,
): Promise<PlacementClaimAllocation[]> {
  return api
    .get(`${PLACEMENT_BASE}/${placementId}/claims/${claimId}/allocations`)
    .then((res) => (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[]);
}

function fetchRecoveryPosition(
  placementId: string,
  claimId: string,
): Promise<PlacementClaimRecoveryPosition> {
  return api
    .get(`${PLACEMENT_BASE}/${placementId}/claims/${claimId}/recovery-position`)
    .then((res) => res.data as PlacementClaimRecoveryPosition);
}

/** Whole days between `fromIso` and `toIso` (or now), floored at 0. */
function daysBetween(fromIso: string | null, toIso: string | null): number | null {
  if (!fromIso) return null;
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  return Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / MS_PER_DAY));
}

function buildReinsurerBreakdown(
  finalizedAt: string | null,
  allocations: PlacementClaimAllocation[] | undefined,
  position: PlacementClaimRecoveryPosition | undefined,
): ClaimReinsurerBreakdown[] {
  if (!allocations?.length) return [];

  // Per-reinsurer recovery figures + last confirmed receipt time, from the position's cash calls.
  const paidByReinsurer = new Map<string, number>();
  const outstandingByReinsurer = new Map<string, number>();
  const lastConfirmedByReinsurer = new Map<string, number>();
  position?.perCashCall.forEach((cc) => {
    paidByReinsurer.set(
      cc.counterpartyId,
      (paidByReinsurer.get(cc.counterpartyId) ?? 0) + num(cc.confirmedAmount),
    );
    outstandingByReinsurer.set(
      cc.counterpartyId,
      (outstandingByReinsurer.get(cc.counterpartyId) ?? 0) + num(cc.outstandingAmount),
    );
    cc.receipts
      .filter((r) => r.status === 'BANK_CONFIRMED' && r.bankConfirmedAt)
      .forEach((r) => {
        const t = new Date(r.bankConfirmedAt as string).getTime();
        lastConfirmedByReinsurer.set(
          cc.counterpartyId,
          Math.max(lastConfirmedByReinsurer.get(cc.counterpartyId) ?? 0, t),
        );
      });
  });

  // One entry per distinct reinsurer on the claim's allocations.
  const byReinsurer = new Map<string, ClaimReinsurerBreakdown>();
  allocations.forEach((a) => {
    const shareAmount = num(a.allocatedFinalLossAmount ?? a.allocatedEstimatedLossAmount);
    const existing = byReinsurer.get(a.counterpartyId);
    if (existing) {
      existing.shareAmount = (existing.shareAmount ?? 0) + shareAmount;
      return;
    }
    const paid = paidByReinsurer.get(a.counterpartyId) ?? 0;
    const positionOutstanding = outstandingByReinsurer.get(a.counterpartyId);
    const lastConfirmed = lastConfirmedByReinsurer.get(a.counterpartyId);
    const settled = (positionOutstanding ?? 0) <= 0.01 && paid > 0;
    byReinsurer.set(a.counterpartyId, {
      reinsurerId: a.counterpartyId,
      reinsurerName: a.counterparty.name,
      sharePercent: a.signedLinePercent != null ? num(a.signedLinePercent) : null,
      shareAmount,
      paidAmount: paid,
      outstandingAmount: positionOutstanding ?? Math.max(0, shareAmount - paid),
      agingDays: daysBetween(
        finalizedAt,
        settled && lastConfirmed ? new Date(lastConfirmed).toISOString() : null,
      ),
    });
  });

  // For reinsurers merged from multiple allocations (no single position row), recompute
  // outstanding off the summed share.
  byReinsurer.forEach((r) => {
    if (outstandingByReinsurer.get(r.reinsurerId) == null) {
      r.outstandingAmount = Math.max(0, (r.shareAmount ?? 0) - r.paidAmount);
    }
  });

  return [...byReinsurer.values()];
}

/**
 * Claims activity for the Reports → Claims table. Rows are derived client-side:
 * every claim on a closing/closed placement is classified into notification/open/closed
 * (via useClaimsByTab), then enriched with the offer, iRisk-share and per-reinsurer
 * figures the report columns need — allocations + recovery-position per finalized claim,
 * and one payments query per placement for the first premium payment date.
 */
export function useClaimsReport(
  params: ClaimsReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: ClaimReportRow[];
  summary: ClaimsReportSummary;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading: loadingPlacements } = useFacultatives();
  const { data: riskTypes = [] } = useRiskTypes();

  const riskTypeName = useMemo(() => {
    const map = new Map(riskTypes.map((rt) => [rt.id, rt.name]));
    return (id: string | null, fallback: string | null) =>
      (id ? map.get(id) : null) ?? fallback ?? null;
  }, [riskTypes]);

  const closingRows = useMemo(
    () => (enabled ? placements.filter((p) => CLOSING_STATUSES.includes(p.status)) : []),
    [placements, enabled],
  );

  const cedantFiltered = useMemo(() => {
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;
    return cedantIds ? closingRows.filter((p) => cedantIds.has(p.cedant.id)) : closingRows;
  }, [closingRows, params.cedantIds]);

  const { notification, open, closed, isLoadingClaims, isLoadingFinancials } =
    useClaimsByTab(cedantFiltered);

  // Flat list of every in-scope claim tagged with its bucket.
  const claimRefs = useMemo(() => {
    const tag = (list: typeof notification, bucket: ClaimsReportBucket) =>
      list.map((row) => ({ row, bucket }));
    return [...tag(notification, 'notification'), ...tag(open, 'open'), ...tag(closed, 'closed')];
  }, [notification, open, closed]);

  const finalizedRefs = useMemo(
    () => claimRefs.filter(({ row }) => row.claim.finalLossAmount != null),
    [claimRefs],
  );

  const allocationQueries = useQueries({
    queries: finalizedRefs.map(({ row }) => ({
      queryKey: allocationsKey(row.placement.id, row.claim.id),
      queryFn: () => fetchAllocations(row.placement.id, row.claim.id),
      enabled,
    })),
  });

  const positionQueries = useQueries({
    queries: finalizedRefs.map(({ row }) => ({
      queryKey: recoveryPositionKey(row.placement.id, row.claim.id),
      queryFn: () => fetchRecoveryPosition(row.placement.id, row.claim.id),
      enabled,
    })),
  });

  const allocationsByClaimId = useMemo(() => {
    const map = new Map<string, PlacementClaimAllocation[]>();
    finalizedRefs.forEach(({ row }, i) => {
      const data = allocationQueries[i]?.data;
      if (data) map.set(row.claim.id, data);
    });
    return map;
  }, [finalizedRefs, allocationQueries]);

  const positionByClaimId = useMemo(() => {
    const map = new Map<string, PlacementClaimRecoveryPosition>();
    finalizedRefs.forEach(({ row }, i) => {
      const data = positionQueries[i]?.data;
      if (data) map.set(row.claim.id, data);
    });
    return map;
  }, [finalizedRefs, positionQueries]);

  // First premium payment date — one payments query per distinct placement in scope.
  const scopedPlacements = useMemo(() => {
    const seen = new Set<string>();
    return claimRefs
      .map(({ row }) => row.placement)
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [claimRefs]);

  const paymentQueries = useQueries({
    queries: scopedPlacements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
      enabled,
    })),
  });

  const premiumPaidAtByPlacementId = useMemo(() => {
    const map = new Map<string, string | null>();
    scopedPlacements.forEach((p, i) => {
      const payments = paymentQueries[i]?.data;
      if (payments) map.set(p.id, firstPremiumPaymentDate(payments));
    });
    return map;
  }, [scopedPlacements, paymentQueries]);

  const allRows = useMemo<ClaimReportRow[]>(() => {
    return claimRefs.map(({ row: r, bucket }) => {
      const allocations = allocationsByClaimId.get(r.claim.id);
      const position = positionByClaimId.get(r.claim.id);
      const iriskShareAmount = allocations
        ? allocations.reduce(
            (sum, a) => sum + num(a.allocatedFinalLossAmount ?? a.allocatedEstimatedLossAmount),
            0,
          )
        : null;
      const iriskSharePaid = r.recoveredAmount ?? null;

      return {
        id: r.claim.id,
        placementId: r.placement.id,
        policyNumber: displayPolicyNumber(r.placement.policyNumber),
        businessName: r.placement.title,
        cedantName: r.placement.cedant.name,
        policyType: riskTypeName(r.placement.riskTypeId, r.placement.classOfBusiness),
        claimType: r.claim.claimCause || null,
        periodStart: r.placement.inceptionDate,
        periodEnd: r.placement.expiryDate,
        claimNumber: r.claim.claimNumber,
        currency: r.claim.currency,
        occurrenceDate: r.claim.occurrenceDate,
        premiumPaidAt: premiumPaidAtByPlacementId.get(r.placement.id) ?? null,
        estimatedLossAmount: num(r.claim.estimatedLossAmount),
        finalLossAmount: r.claim.finalLossAmount != null ? num(r.claim.finalLossAmount) : null,
        claimAmount: num(r.claim.finalLossAmount ?? r.claim.estimatedLossAmount),
        finalizedAt: r.claim.finalizedAt ?? null,
        recoveredAmount: r.recoveredAmount ?? null,
        recoveredAt: r.recoveredAt ?? null,
        bucket,
        iriskSharePercent: r.placement.facultativeOffer,
        iriskShareAmount,
        iriskSharePaid,
        iriskShareOutstanding:
          iriskShareAmount != null ? Math.max(0, iriskShareAmount - (iriskSharePaid ?? 0)) : null,
        reinsurers: buildReinsurerBreakdown(r.claim.finalizedAt, allocations, position),
      };
    });
  }, [
    claimRefs,
    allocationsByClaimId,
    positionByClaimId,
    premiumPaidAtByPlacementId,
    riskTypeName,
  ]);

  const dateFiltered = useMemo(() => {
    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);

    return allRows.filter((r) => {
      if (from || to) {
        const occurred = new Date(r.occurrenceDate);
        if (from && occurred < from) return false;
        if (to && occurred > to) return false;
      }
      if (params.currency && r.currency !== params.currency) return false;
      return true;
    });
  }, [allRows, params.startDate, params.endDate, params.currency]);

  const rows = useMemo(
    () => (params.bucket ? dateFiltered.filter((r) => r.bucket === params.bucket) : dateFiltered),
    [dateFiltered, params.bucket],
  );

  const summary = useMemo<ClaimsReportSummary>(() => {
    const openClaims = dateFiltered.filter((r) => r.bucket === 'open').length;
    const closedClaims = dateFiltered.filter((r) => r.bucket === 'closed').length;
    const finalizedTotal = openClaims + closedClaims;
    return {
      openClaims,
      closedClaims,
      recoveryRate: finalizedTotal > 0 ? (closedClaims / finalizedTotal) * 100 : 0,
    };
  }, [dateFiltered]);

  const isLoading =
    loadingPlacements ||
    isLoadingClaims ||
    isLoadingFinancials ||
    allocationQueries.some((q) => q.isLoading) ||
    positionQueries.some((q) => q.isLoading) ||
    paymentQueries.some((q) => q.isLoading);

  return { rows, summary, isLoading };
}
