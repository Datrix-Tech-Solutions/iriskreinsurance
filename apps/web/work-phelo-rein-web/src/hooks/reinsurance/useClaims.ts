import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ApprovePlacementClaimPayablePayload,
  ApprovePlacementClaimRecoveryPayload,
  ClaimState,
  ClaimRowState,
  ClaimRowStateResponse,
  ClaimsWorklistPlacement,
  ClaimsWorklistSummary,
  ConfirmPlacementClaimCedantSettlementBankPayload,
  ConfirmPlacementClaimRecoveryReceiptBankPayload,
  CreatePlacementClaimCedantSettlementPayload,
  CreatePlacementClaimPayload,
  CreatePlacementClaimRecoveryReceiptPayload,
  Facultative,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementClaimCashCall,
  PlacementClaimCashCallStatus,
  PlacementClaimCedantSettlement,
  PlacementClaimFinancialCloseReadiness,
  PlacementClaimRecoveryApproval,
  PlacementClaimRecoveryPosition,
  PlacementClaimRecoveryReceipt,
  PlacementClaimStatus,
  PaginatedClaimsWorklist,
  UpdatePlacementClaimPayload,
} from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

const BASE = '/operations/reinsurance/placements';
const WORKLIST_BASE = '/operations/reinsurance/worklists';
const CLAIM_ROW_STATE_BATCH_SIZE = 100;

export const claimsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'claims'] as const;

export const claimKey = (placementId: string, claimId: string) =>
  [...claimsKey(placementId), claimId] as const;

export const allocationsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'allocations'] as const;

export const cashCallsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'cash-calls'] as const;

export const recoveryPositionKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'recovery-position'] as const;

export const cedantSettlementsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'cedant-settlements'] as const;

export const recoveryReceiptsKey = (placementId: string, claimId: string, cashCallId: string) =>
  [...claimKey(placementId, claimId), 'cash-calls', cashCallId, 'recovery-receipts'] as const;

export const recoveryApprovalsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'recovery-approvals'] as const;

export const financialCloseReadinessKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'financial-close-readiness'] as const;

export const claimRowStateKey = (claimIds: string[]) =>
  ['reinsurance', 'worklists', 'claim-row-state', [...new Set(claimIds)].sort()] as const;

const claimsWorklistsKey = ['reinsurance', 'worklists', 'claims'] as const;

export interface ClaimsWorklistParams {
  tab?: ClaimTabBucket;
  page?: number;
  limit?: number;
  search?: string;
  cedantId?: string;
  /** Open-tab only: filter by persisted claim state. */
  claimState?: ClaimState;
}

function normalizeClaimsWorklistParams(params: ClaimsWorklistParams = {}) {
  return {
    tab: params.tab ?? 'notification',
    page: params.page ?? 1,
    limit: params.limit ?? 10,
    ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    ...(params.cedantId ? { cedantId: params.cedantId } : {}),
    ...(params.claimState ? { claimState: params.claimState } : {}),
  };
}

export const claimsWorklistKey = (params: ClaimsWorklistParams = {}) =>
  ['reinsurance', 'worklists', 'claims', normalizeClaimsWorklistParams(params)] as const;

export const claimsWorklistSummaryKey = () =>
  ['reinsurance', 'worklists', 'claims-summary'] as const;

function invalidateClaimWorkflow(
  queryClient: ReturnType<typeof useQueryClient>,
  placementId: string,
  claimId?: string,
) {
  queryClient.invalidateQueries({ queryKey: claimsKey(placementId) });
  if (claimId) {
    queryClient.invalidateQueries({ queryKey: claimKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: allocationsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: cashCallsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: recoveryPositionKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: cedantSettlementsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: recoveryApprovalsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: financialCloseReadinessKey(placementId, claimId) });
  }
  queryClient.invalidateQueries({ queryKey: claimsWorklistsKey });
  queryClient.invalidateQueries({ queryKey: claimsWorklistSummaryKey() });
  queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
}

export function usePlacementClaims(placementId: string) {
  return useQuery({
    queryKey: claimsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
    },
    enabled: !!placementId,
  });
}

export function usePlacementClaim(placementId: string, claimId: string) {
  return useQuery({
    queryKey: claimKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}`);
      return res.data as PlacementClaim;
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useCreatePlacementClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      ...payload
    }: CreatePlacementClaimPayload & { placementId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/claims`, payload);
      return res.data as PlacementClaim;
    },
    onSuccess: (claim) => {
      queryClient.setQueryData<PlacementClaim[]>(claimsKey(claim.placementId), (current = []) => [
        claim,
        ...current.filter((item) => item.id !== claim.id),
      ]);
      invalidateClaimWorkflow(queryClient, claim.placementId, claim.id);
    },
  });
}

/** Unbound (vs. useUpdatePlacementClaim) so a single instance can delete any row of a table
 *  spanning multiple placements — pass the ids per call instead of binding them up front. */
export function useDeletePlacementClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ placementId, claimId }: { placementId: string; claimId: string }) => {
      await api.delete(`${BASE}/${placementId}/claims/${claimId}`);
    },
    onSuccess: (_data, { placementId, claimId }) => {
      queryClient.setQueryData<PlacementClaim[]>(claimsKey(placementId), (current = []) =>
        (current ?? []).filter((item) => item.id !== claimId),
      );
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useUpdatePlacementClaim(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePlacementClaimPayload) => {
      const res = await api.patch(`${BASE}/${placementId}/claims/${claimId}`, payload);
      return res.data as PlacementClaim;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

/** Unbound (vs. useUpdatePlacementClaim) so a single instance can update any row of a table
 *  spanning multiple placements — pass the ids per call instead of binding them up front.
 *  Used by the Notification tab's "Finalize Claim" row action, which patches a claim in the
 *  claims list without opening the full edit panel. */
export function useUpdatePlacementClaimUnbound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      ...payload
    }: UpdatePlacementClaimPayload & { placementId: string; claimId: string }) => {
      const res = await api.patch(`${BASE}/${placementId}/claims/${claimId}`, payload);
      return res.data as PlacementClaim;
    },
    onSuccess: (_claim, { placementId, claimId }) => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useUpdateClaimStatus(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: PlacementClaimStatus) => {
      const res = await api.patch(`${BASE}/${placementId}/claims/${claimId}/status`, { status });
      return res.data as PlacementClaim;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

/**
 * Backend-derived readiness for moving a claim to SETTLED or CLOSED — RECORDED
 * settlements/receipts are operational and don't count until Reinsurance financially confirms them.
 */
export function useClaimFinancialCloseReadiness(placementId: string, claimId: string) {
  return useQuery({
    queryKey: financialCloseReadinessKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(
        `${BASE}/${placementId}/claims/${claimId}/financial-close-readiness`,
      );
      return res.data as PlacementClaimFinancialCloseReadiness;
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useClaimAllocations(placementId: string, claimId: string) {
  return useQuery({
    queryKey: allocationsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/allocations`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useGenerateClaimAllocations(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`${BASE}/${placementId}/claims/${claimId}/allocations/generate`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[];
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useGenerateClaimAllocationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ placementId, claimId }: { placementId: string; claimId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/claims/${claimId}/allocations/generate`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[];
    },
    onSuccess: (_allocations, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
    },
  });
}

export function useClaimCashCalls(placementId: string, claimId: string) {
  return useQuery({
    queryKey: cashCallsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/cash-calls`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimCashCall[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useCreateClaimCashCall(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allocationId: string) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/allocations/${allocationId}/cash-calls`,
      );
      return res.data as PlacementClaimCashCall;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useUpdateClaimCashCallStatus(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cashCallId,
      status,
    }: {
      cashCallId: string;
      status: Exclude<PlacementClaimCashCallStatus, 'PAID'>;
    }) => {
      const res = await api.patch(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/status`,
        { status },
      );
      return res.data as PlacementClaimCashCall;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useVoidClaimCashCall(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cashCallId, voidReason }: { cashCallId: string; voidReason: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/void`,
        { voidReason },
      );
      return res.data as PlacementClaimCashCall;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useClaimRecoveryPosition(placementId: string, claimId: string) {
  return useQuery({
    queryKey: recoveryPositionKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/recovery-position`);
      return res.data as PlacementClaimRecoveryPosition;
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useApproveClaimPayable(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApprovePlacementClaimPayablePayload) => {
      const res = await api.patch(
        `${BASE}/${placementId}/claims/${claimId}/approve-payable`,
        payload,
      );
      return res.data as PlacementClaim;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useClaimCedantSettlements(placementId: string, claimId: string) {
  return useQuery({
    queryKey: cedantSettlementsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/cedant-settlements`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimCedantSettlement[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useCreateClaimCedantSettlement(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePlacementClaimCedantSettlementPayload) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cedant-settlements`,
        payload,
      );
      return res.data as PlacementClaimCedantSettlement;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useReverseClaimCedantSettlement(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ settlementId, notes }: { settlementId: string; notes?: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cedant-settlements/${settlementId}/reverse`,
        { notes },
      );
      return res.data as PlacementClaimCedantSettlement;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useConfirmClaimCedantSettlementBank(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settlementId,
      ...payload
    }: ConfirmPlacementClaimCedantSettlementBankPayload & { settlementId: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cedant-settlements/${settlementId}/bank-confirm`,
        payload,
      );
      return res.data as PlacementClaimCedantSettlement;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

/** Immutable per-allocation reinsurer recovery approval history — precedes recovery receipts. */
export function useClaimRecoveryApprovals(placementId: string, claimId: string) {
  return useQuery({
    queryKey: recoveryApprovalsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/recovery-approvals`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimRecoveryApproval[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useApproveClaimRecovery(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      allocationId,
      ...payload
    }: ApprovePlacementClaimRecoveryPayload & { allocationId: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/allocations/${allocationId}/recovery-approvals`,
        payload,
      );
      return res.data as PlacementClaimRecoveryApproval;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useClaimRecoveryReceipts(placementId: string, claimId: string, cashCallId: string) {
  return useQuery({
    queryKey: recoveryReceiptsKey(placementId, claimId, cashCallId),
    queryFn: async () => {
      const res = await api.get(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/recovery-receipts`,
      );
      return (res.data?.items ?? res.data ?? []) as PlacementClaimRecoveryReceipt[];
    },
    enabled: !!placementId && !!claimId && !!cashCallId,
  });
}

export function useCreateClaimRecoveryReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      cashCallId,
      payload,
    }: {
      placementId: string;
      claimId: string;
      cashCallId: string;
      payload: CreatePlacementClaimRecoveryReceiptPayload;
    }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/recovery-receipts`,
        payload,
      );
      return res.data as PlacementClaimRecoveryReceipt;
    },
    onSuccess: (_receipt, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
      queryClient.invalidateQueries({
        queryKey: recoveryReceiptsKey(
          variables.placementId,
          variables.claimId,
          variables.cashCallId,
        ),
      });
    },
  });
}

export function useReverseClaimRecoveryReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      receiptId,
      notes,
    }: {
      placementId: string;
      claimId: string;
      receiptId: string;
      notes?: string;
    }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/recovery-receipts/${receiptId}/reverse`,
        { notes },
      );
      return res.data as PlacementClaimRecoveryReceipt;
    },
    onSuccess: (_receipt, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
    },
  });
}

export function useConfirmClaimRecoveryReceiptBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      receiptId,
      ...payload
    }: ConfirmPlacementClaimRecoveryReceiptBankPayload & {
      placementId: string;
      claimId: string;
      receiptId: string;
    }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/recovery-receipts/${receiptId}/bank-confirm`,
        payload,
      );
      return res.data as PlacementClaimRecoveryReceipt;
    },
    onSuccess: (_receipt, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
    },
  });
}

export interface RecoveryRow {
  id: string;
  placementId: string;
  claimId: string;
  cashCallId: string;
  allocationId: string;
  policyNumber: string;
  insuredTitle: string;
  riskType: string | null;
  reinsurerId: string;
  reinsurerName: string;
  claimNumber: string;
  cashCallNumber: string;
  cashCallStatus: PlacementClaimCashCallStatus;
  currency: string;
  calledAmount: number;
  recoveredAmount: number;
  /** Operational receipts recorded but not yet financially confirmed by Accounting. */
  recordedAmount: number;
  /** Bank-confirmed recovery receipts that reduce financial outstanding. */
  confirmedAmount: number;
  reversedAmount: number;
  outstandingAmount: number;
  recoveryStatus: PlacementClaimRecoveryPosition['perCashCall'][number]['recoveryStatus'];
  receipts: PlacementClaimRecoveryReceipt[];
  occurrenceDate: string;
}

/**
 * Claim recoveries owed by every reinsurer across all placements. Rows are derived
 * from backend recovery-position truth: ClaimAllocation -> issued CashCall ->
 * RecoveryReceipt. No participant percentages are used as authoritative recovery
 * amounts here.
 */
export function useAllReinsurerClaims(placements: Facultative[]): {
  rows: RecoveryRow[];
  isLoading: boolean;
} {
  const claimQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: claimsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const isLoading = claimQueries.some((q) => q.isLoading);

  const claimRefs = useMemo(
    () =>
      placements.flatMap((placement, placementIndex) =>
        (claimQueries[placementIndex]?.data ?? []).map((claim) => ({
          placement,
          claim,
        })),
      ),
    [placements, claimQueries],
  );

  const positionQueries = useQueries({
    queries: claimRefs.map(({ placement, claim }) => ({
      queryKey: recoveryPositionKey(placement.id, claim.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${placement.id}/claims/${claim.id}/recovery-position`);
        return res.data as PlacementClaimRecoveryPosition;
      },
      enabled: !!placement.id && !!claim.id,
    })),
  });

  const rows = useMemo(() => {
    const list: RecoveryRow[] = [];
    claimRefs.forEach(({ placement, claim }, index) => {
      const position = positionQueries[index]?.data;
      position?.perCashCall.forEach((cashCall) => {
        list.push({
          id: `${claim.id}-${cashCall.cashCallId}`,
          placementId: placement.id,
          claimId: claim.id,
          cashCallId: cashCall.cashCallId,
          allocationId: cashCall.allocationId,
          policyNumber: displayPolicyNumber(placement.policyNumber),
          insuredTitle: placement.title,
          riskType: placement.classOfBusiness,
          reinsurerId: cashCall.counterpartyId,
          reinsurerName: cashCall.counterparty.name,
          claimNumber: claim.claimNumber,
          cashCallNumber: cashCall.cashCallNumber,
          cashCallStatus: cashCall.cashCallStatus,
          currency: cashCall.currency,
          calledAmount: parseFloat(cashCall.calledAmount),
          recoveredAmount: parseFloat(cashCall.recoveredAmount),
          recordedAmount: parseFloat(cashCall.recordedAmount),
          confirmedAmount: parseFloat(cashCall.confirmedAmount),
          reversedAmount: parseFloat(cashCall.reversedAmount),
          outstandingAmount: parseFloat(cashCall.outstandingAmount),
          recoveryStatus: cashCall.recoveryStatus,
          receipts: cashCall.receipts,
          occurrenceDate: claim.occurrenceDate,
        });
      });
    });
    return list;
  }, [claimRefs, positionQueries]);

  return { rows, isLoading: isLoading || positionQueries.some((q) => q.isLoading) };
}

const SETTLED_CLAIM_STATUSES: PlacementClaimStatus[] = ['SETTLED', 'CLOSED'];

export interface ClaimsSummary {
  totalClaims: number;
  /** Claims with claim.status SETTLED or CLOSED — the cedant-payable workflow's own
   * progress marker, set manually via ClaimStatusActions. Independent of reinsurer
   * recovery, which is tracked separately by useClaimsByTab. */
  settledClaims: number;
  isLoading: boolean;
}

/**
 * Aggregate counts across every claim on the given placements — one query per placement,
 * sharing the cache with usePlacementClaims via claimsKey. Expects `placements` to already
 * be filtered to the set worth querying (e.g. placed/closing offers).
 *
 * Doesn't cover open/closed counts — those depend on reinsurer recovery, not claim.status,
 * so they come from useClaimsByTab instead (see its docstring).
 */
export function useClaimsSummary(placements: Facultative[]): ClaimsSummary {
  const claimQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: claimsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const isLoading = claimQueries.some((q) => q.isLoading);

  const summary = useMemo(() => {
    let totalClaims = 0;
    let settledClaims = 0;

    claimQueries.forEach((query) => {
      const claims = query.data ?? [];
      claims.forEach((claim) => {
        if (claim.status === 'VOID') return;
        totalClaims += 1;
        if (SETTLED_CLAIM_STATUSES.includes(claim.status)) settledClaims += 1;
      });
    });

    return { totalClaims, settledClaims };
  }, [claimQueries]);

  return { ...summary, isLoading };
}

export interface ClaimTabRow {
  id: string;
  placement: Facultative;
  claim: PlacementClaim;
  nonVoidEndorsementCount: number;
  /** Bank-confirmed amount recovered from reinsurers so far, net of reversals — only set
   * once the claim has left Notification (finalLossAmount present) and its recovery
   * data has loaded, i.e. on rows in `open`/`closed` below. */
  recoveredAmount?: number;
  /** When the last bank-confirmed recovery receipt landed across every cash call on the
   * claim — the moment outstanding recovery hit zero. Set alongside `recoveredAmount`;
   * only meaningful (non-null) once the claim is actually in `closed`. */
  recoveredAt?: string | null;
  /** Reinsurers' total share of the claim — the cedant-payable amount — summed across the
   * claim's allocations (final loss where set, else estimated). Same figure the Claim
   * Allocations table's "Total Allocated Claim" bar uses. Set alongside `recoveredAmount`
   * on `open`/`closed` rows. */
  claimShare?: number;
}

export function useClaimsWorklist(params: ClaimsWorklistParams = {}) {
  const normalizedParams = normalizeClaimsWorklistParams(params);
  return useQuery({
    queryKey: claimsWorklistKey(params),
    queryFn: async () => {
      const res = await api.get<PaginatedClaimsWorklist>(`${WORKLIST_BASE}/claims`, {
        params: normalizedParams,
      });
      return {
        ...res.data,
        items: res.data.items.map(
          (row): ClaimTabRow => ({
            id: row.id,
            placement: toFacultative(row.placement),
            claim: row.claim,
            recoveredAmount: row.recoveredAmount,
            recoveredAt: row.recoveredAt,
            claimShare: row.claimShare,
            nonVoidEndorsementCount: row.nonVoidEndorsementCount,
          }),
        ),
      };
    },
  });
}

export function useClaimsWorklistSummary(window: { since?: string; until?: string } = {}) {
  const { since, until } = window;
  return useQuery({
    queryKey: [...claimsWorklistSummaryKey(), { since: since ?? null, until: until ?? null }],
    queryFn: async () => {
      const res = await api.get<ClaimsWorklistSummary>(`${WORKLIST_BASE}/claims-summary`, {
        params: {
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
        },
      });
      return res.data;
    },
  });
}

function toFacultative(placement: ClaimsWorklistPlacement): Facultative {
  return {
    ...placement,
    cedantId: placement.cedant.id,
    cedantName: placement.cedant.name,
    insuranceCompany: null,
    reference: placement.reference ?? placement.policyNumber ?? placement.id,
    participants: [],
    totalOfferedPercent: 0,
    totalAcceptedPercent: 0,
    remainingPercent: 0,
    forceClosed: !!placement.forceClosedAt,
  };
}

export interface ClaimsByTab {
  /** Claims still awaiting an actual loss amount. */
  notification: ClaimTabRow[];
  /** Finalized claims not yet fully recovered from reinsurers. */
  open: ClaimTabRow[];
  /** Finalized claims fully recovered from reinsurers. */
  closed: ClaimTabRow[];
  /** Claims list only — enough to show the Notification tab. */
  isLoadingClaims: boolean;
  /** Batched row-state loading — needed for Open/Closed tabs and shared KPI counts. */
  isLoadingFinancials: boolean;
}

/**
 * Partitions every claim on the given placements into the Claims page's three tabs.
 * "Fully recovered" (Closed) vs. not (Open) is derived from the bounded row-state
 * endpoint, not claim.status — reinsurer recovery is tracked independently of the claim's
 * own settlement status with the cedant. Shared by ClaimsTable and ClaimsStatsRow so the
 * tab tables and the KPI counts never disagree, and so both draw on the same cached
 * queries instead of double-fetching.
 */
export function useClaimsByTab(placements: Facultative[]): ClaimsByTab {
  const claimQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: claimsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });
  const isLoadingPlacementClaims = claimQueries.some((q) => q.isLoading);

  const discoveredRows = useMemo<ClaimTabRow[]>(
    () =>
      placements.flatMap((placement, i) =>
        (claimQueries[i]?.data ?? []).map((claim) => ({
          id: claim.id,
          placement,
          claim,
          nonVoidEndorsementCount: 0,
        })),
      ),
    [placements, claimQueries],
  );

  const rowState = useClaimRowStates(discoveredRows.map((row) => row.claim.id));
  const rowStateByClaimId = useMemo(
    () => new Map(rowState.items.map((item) => [item.claimId, item])),
    [rowState.items],
  );
  const isLoadingClaims = isLoadingPlacementClaims || rowState.isLoading;
  const isLoadingFinancials = rowState.isLoading;

  const { notification, open, closed } = useMemo(() => {
    const notification: ClaimTabRow[] = [];
    const open: ClaimTabRow[] = [];
    const closed: ClaimTabRow[] = [];
    discoveredRows.forEach((row) => {
      const state = rowStateByClaimId.get(row.claim.id);
      if (!state) return;
      const enriched: ClaimTabRow = {
        ...row,
        recoveredAmount: parseFloat(state.recoveredAmount),
        recoveredAt: state.recoveredAt,
        nonVoidEndorsementCount: state.nonVoidEndorsementCount,
      };

      if (state.bucket === 'notification') notification.push(enriched);
      else if (state.bucket === 'closed') closed.push(enriched);
      else open.push(enriched);
    });
    return { notification, open, closed };
  }, [discoveredRows, rowStateByClaimId]);

  return { notification, open, closed, isLoadingClaims, isLoadingFinancials };
}

function useClaimRowStates(claimIds: string[]): {
  items: ClaimRowState[];
  isLoading: boolean;
} {
  const chunks = useMemo(() => {
    const uniqueSortedClaimIds = [...new Set(claimIds)].filter(Boolean).sort();
    const next: string[][] = [];
    for (let index = 0; index < uniqueSortedClaimIds.length; index += CLAIM_ROW_STATE_BATCH_SIZE) {
      next.push(uniqueSortedClaimIds.slice(index, index + CLAIM_ROW_STATE_BATCH_SIZE));
    }
    return next;
  }, [claimIds]);

  const queries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: claimRowStateKey(chunk),
      queryFn: async () => {
        const res = await api.get<ClaimRowStateResponse>(`${WORKLIST_BASE}/claim-row-state`, {
          params: { claimIds: chunk.join(',') },
        });
        return res.data.items;
      },
      enabled: chunk.length > 0,
    })),
  });

  return {
    items: queries.flatMap((query) => query.data ?? []),
    isLoading: queries.some((query) => query.isLoading),
  };
}

export type ClaimTabBucket = 'notification' | 'open' | 'closed';

/**
 * Same Notification/Open/Closed classification as useClaimsByTab, for a single claim whose
 * placement/claim you already have in hand (e.g. the claim detail page) — reuses the
 * single-claim recovery-position/allocations hooks and their cache instead of fetching this
 * placement's whole claims list just to classify the one claim you're already looking at.
 */
export function useClaimTabBucket(
  placementId: string,
  claim: PlacementClaim | undefined,
): { bucket: ClaimTabBucket; recoveredAt: string | null; isLoading: boolean } {
  const isFinalized = !!claim && claim.finalLossAmount != null;
  // Hooks must run unconditionally — pass an empty id when there's no claim (or it's still
  // an estimate) yet, which their own `enabled` guards already treat as "don't fetch".
  const { data: position, isLoading: isLoadingPosition } = useClaimRecoveryPosition(
    placementId,
    isFinalized ? claim!.id : '',
  );
  const { data: allocations, isLoading: isLoadingAllocations } = useClaimAllocations(
    placementId,
    isFinalized ? claim!.id : '',
  );

  if (!isFinalized) {
    return { bucket: 'notification', recoveredAt: null, isLoading: false };
  }

  const isLoading = isLoadingPosition || isLoadingAllocations;
  if (isLoading || !position || !allocations) {
    // Assume still-open while financial data loads — matches useClaimsByTab's behaviour of
    // not classifying a row as closed until the recovery figures actually confirm it.
    return { bucket: 'open', recoveredAt: null, isLoading: true };
  }

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + parseFloat(a.allocatedFinalLossAmount ?? a.allocatedEstimatedLossAmount),
    0,
  );
  const totalCashCalled = parseFloat(position.recoveries.totalCashCalled);
  const totalOutstanding = parseFloat(position.recoveries.totalOutstanding);
  const allAllocationsCalled = totalAllocated > 0 && totalCashCalled >= totalAllocated - 0.01;
  const isFullyRecovered = allAllocationsCalled && totalOutstanding <= 0.01;

  if (!isFullyRecovered) {
    return { bucket: 'open', recoveredAt: null, isLoading: false };
  }

  // Same as useClaimsByTab: the claim became fully recovered the moment its last
  // bank-confirmed receipt landed, across whichever reinsurer/cash call closed it out.
  const confirmedTimes = position.perCashCall
    .flatMap((cc) => cc.receipts)
    .filter((r) => r.status === 'BANK_CONFIRMED' && r.bankConfirmedAt)
    .map((r) => new Date(r.bankConfirmedAt as string).getTime());
  const recoveredAt =
    confirmedTimes.length > 0 ? new Date(Math.max(...confirmedTimes)).toISOString() : null;

  return { bucket: 'closed', recoveredAt, isLoading: false };
}
