import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  CreatePlacementPaymentPayload,
  ConfirmPlacementPaymentBankPayload,
  PlacementFinancialPosition,
  PlacementParticipantClosing,
  PaginatedPaymentWorklist,
  PaymentWorklistStatusFilter,
} from '@/types/reinsurance';
import { useFacultatives } from './useFacultatives';
import {
  cedantPaymentStatusFromPosition,
  pendingPremiumReceived,
  latestConfirmedPremiumPaymentDate,
  PREMIUM_PAYMENT_STATUS_TEXT,
} from '@/lib/reinsurance/placementStatus';

const BASE = '/operations/reinsurance/placements';
const WORKLIST_BASE = '/operations/reinsurance/worklists/payments';

export const paymentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'payments'] as const;
export const placementFinancialPositionKey = (placementId: string, asOfDate?: string) =>
  ['reinsurance', 'placements', placementId, 'financial-position', asOfDate ?? 'current'] as const;
export const paymentsWorklistKey = (params: PaymentWorklistParams) =>
  ['reinsurance', 'worklists', 'payments', normalizePaymentWorklistParams(params)] as const;
const paymentsWorklistsKey = ['reinsurance', 'worklists', 'payments'] as const;

export interface PaymentWorklistParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PaymentWorklistStatusFilter | '';
  cedantId?: string;
  placementIds?: string[];
}

function normalizePaymentWorklistParams(params: PaymentWorklistParams = {}) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
    ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.cedantId ? { cedantId: params.cedantId } : {}),
    ...(params.placementIds?.length ? { placementIds: params.placementIds.join(',') } : {}),
  };
}

export function usePaymentsWorklist(
  params: PaymentWorklistParams = {},
  options: { enabled?: boolean } = {},
) {
  const normalizedParams = normalizePaymentWorklistParams(params);
  return useQuery({
    queryKey: paymentsWorklistKey(params),
    queryFn: async () => {
      const res = await api.get<PaginatedPaymentWorklist>(WORKLIST_BASE, {
        params: normalizedParams,
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });
}

export async function fetchPlacementPayments(placementId: string): Promise<PlacementPayment[]> {
  const res = await api.get(`${BASE}/${placementId}/payments`);
  return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
}

export async function fetchPlacementFinancialPosition(
  placementId: string,
  asOfDate?: string,
): Promise<PlacementFinancialPosition> {
  const res = await api.get(`${BASE}/${placementId}/financial-position`, {
    params: asOfDate ? { asOfDate } : undefined,
  });
  return res.data as PlacementFinancialPosition;
}

export function usePlacementPayments(placementId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: paymentsKey(placementId),
    queryFn: () => fetchPlacementPayments(placementId),
    enabled: !!placementId && (options.enabled ?? true),
  });
}

export function usePlacementFinancialPosition(placementId: string, asOfDate?: string) {
  return useQuery({
    queryKey: placementFinancialPositionKey(placementId, asOfDate),
    queryFn: () => fetchPlacementFinancialPosition(placementId, asOfDate),
    enabled: !!placementId,
  });
}

export function usePremiumPaymentContext(placementId: string) {
  const { data: financialPosition } = usePlacementFinancialPosition(placementId);
  const { data: payments = [] } = usePlacementPayments(placementId);

  const status = cedantPaymentStatusFromPosition(
    financialPosition?.cedant.currentObligation ?? 0,
    financialPosition?.cedant.netSettled ?? 0,
    financialPosition?.cedant.outstanding ?? 0,
    pendingPremiumReceived(payments),
  );

  return {
    statusText: PREMIUM_PAYMENT_STATUS_TEXT[status],
    latestPaymentDate: latestConfirmedPremiumPaymentDate(payments),
  };
}

export function useCreatePlacementPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      ...payload
    }: CreatePlacementPaymentPayload & { placementId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/payments`, payload);
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementFinancialPositionKey(placementId) });
      queryClient.invalidateQueries({ queryKey: paymentsWorklistsKey });
    },
  });
}

export function useConfirmPlacementPaymentBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      paymentId,
      ...payload
    }: ConfirmPlacementPaymentBankPayload & { placementId: string; paymentId: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/payments/${paymentId}/bank-confirmation`,
        payload,
      );
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementFinancialPositionKey(placementId) });
      queryClient.invalidateQueries({ queryKey: paymentsWorklistsKey });
    },
  });
}

export function useReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ placementId, paymentId }: { placementId: string; paymentId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/payments/${paymentId}/reverse`);
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementFinancialPositionKey(placementId) });
      queryClient.invalidateQueries({ queryKey: paymentsWorklistsKey });
    },
  });
}

/** Correction path for a RECORDED payment that has not been bank confirmed and so
 *  cannot be reversed. Marks it CANCELLED; re-record the corrected payment with
 *  {@link useCreatePlacementPayment}. */
export function useCancelPlacementPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      paymentId,
      reason,
    }: {
      placementId: string;
      paymentId: string;
      reason?: string;
    }) => {
      const res = await api.post(
        `${BASE}/${placementId}/payments/${paymentId}/cancel`,
        reason ? { reason } : {},
      );
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementFinancialPositionKey(placementId) });
      queryClient.invalidateQueries({ queryKey: paymentsWorklistsKey });
    },
  });
}

export const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

export function confirmedNetPremiumFor(closings: PlacementParticipantClosing[]): number {
  return closings
    .filter((closing) => closing.status === 'CONFIRMED')
    .reduce((sum, closing) => sum + parseFloat(closing.netPremium ?? '0'), 0);
}

export function totalEffectivePremiumReceived(payments: PlacementPayment[]): number {
  return payments
    .filter(
      (p) =>
        p.type === 'PREMIUM_RECEIVED' && p.status === 'BANK_CONFIRMED' && !p.reversalOfPaymentId,
    )
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

export function totalEffectiveReinsurerDisbursement(
  payments: PlacementPayment[],
  reinsurerId: string,
): number {
  return payments
    .filter(
      (p) =>
        p.type === 'REINSURER_DISBURSEMENT' &&
        p.counterpartyId === reinsurerId &&
        p.status === 'BANK_CONFIRMED' &&
        !p.reversalOfPaymentId,
    )
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

export type PlacementPaymentStatus = 'paid' | 'partial' | 'outstanding';

export function useCedantPlacementPaymentStatuses(
  placements: Facultative[],
): Map<string, PlacementPaymentStatus> {
  const relevantPlacements = useMemo(
    () =>
      placements.filter((p) =>
        p.participants.some((pt) => pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
      ),
    [placements],
  );

  const positionQueries = useQueries({
    queries: relevantPlacements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });

  return useMemo(() => {
    const map = new Map<string, PlacementPaymentStatus>();
    relevantPlacements.forEach((placement, i) => {
      const position = positionQueries[i]?.data;
      const due = position?.cedant.currentObligation ?? 0;
      const paid = position?.cedant.netSettled ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      if (due > 0 && outstanding <= 0.0001) {
        map.set(placement.id, 'paid');
      } else if (paid > 0) {
        map.set(placement.id, 'partial');
      } else {
        map.set(placement.id, 'outstanding');
      }
    });
    return map;
  }, [relevantPlacements, positionQueries]);
}

export interface CurrencyAmount {
  code: string;
  amount: number;
}

export interface PremiumsSummary {
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  /** Brokerage earned on premium actually collected — accrues only on the paid share of each
   *  placement's premium, never on the outstanding share. Cash-basis, not accrual-basis. */
  totalBrokerageEarned: number;

  dueByCurrency: CurrencyAmount[];
  paidByCurrency: CurrencyAmount[];
  outstandingByCurrency: CurrencyAmount[];
  brokerageEarnedByCurrency: CurrencyAmount[];
  isLoading: boolean;
}

function sortedCurrencyTotals(totals: Map<string, number>): CurrencyAmount[] {
  return Array.from(totals.entries())
    .map(([code, amount]) => ({ code, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function usePremiumsSummary(placements: Facultative[]): PremiumsSummary {
  const positionQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });

  const isLoading = positionQueries.some((q) => q.isLoading);

  const summary = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalBrokerageEarned = 0;
    const dueTotals = new Map<string, number>();
    const paidTotals = new Map<string, number>();
    const outstandingTotals = new Map<string, number>();
    const brokerageEarnedTotals = new Map<string, number>();
    placements.forEach((p, i) => {
      const position = positionQueries[i]?.data;
      const due = position?.cedant.currentObligation ?? 0;
      const paid = position?.cedant.netSettled ?? 0;
      // Credit balances (outstanding < 0) belong to a different bucket than money still owed —
      // this breakdown only totals what's still owed, matching dueByCurrency/paidByCurrency
      // only totaling positive amounts.
      const outstanding = Math.max(0, position?.cedant.outstanding ?? 0);
      const code = position?.currency ?? p.currency ?? 'UNKNOWN';
      totalDue += due;
      totalPaid += paid;
      totalOutstanding += outstanding;
      if (due > 0.0001) dueTotals.set(code, (dueTotals.get(code) ?? 0) + due);
      if (paid > 0.0001) paidTotals.set(code, (paidTotals.get(code) ?? 0) + paid);
      if (outstanding > 0.0001)
        outstandingTotals.set(code, (outstandingTotals.get(code) ?? 0) + outstanding);

      // Full accrual brokerage on this placement's premium (same formula the dashboard uses),
      // then scaled down to only the collected share — nothing accrues on what's still owed.
      const collectionRatio = due > 0.0001 ? Math.min(1, paid / due) : 0;
      if (collectionRatio > 0 && p.premium != null) {
        let placementBrokerage = 0;
        for (const participant of p.participants) {
          if (participant.status !== 'ACCEPTED' && participant.status !== 'CLOSED') continue;
          const share =
            participant.sharePercent != null ? parseFloat(participant.sharePercent) : null;
          const fee =
            participant.brokerageFee != null ? parseFloat(participant.brokerageFee) : null;
          if (share == null || fee == null) continue;
          placementBrokerage += p.premium * (share / 100) * (fee / 100);
        }
        const brokerageEarned = placementBrokerage * collectionRatio;
        totalBrokerageEarned += brokerageEarned;
        if (brokerageEarned > 0.0001)
          brokerageEarnedTotals.set(code, (brokerageEarnedTotals.get(code) ?? 0) + brokerageEarned);
      }
    });
    return {
      totalDue,
      totalPaid,
      totalOutstanding,
      totalBrokerageEarned,
      dueByCurrency: sortedCurrencyTotals(dueTotals),
      paidByCurrency: sortedCurrencyTotals(paidTotals),
      outstandingByCurrency: sortedCurrencyTotals(outstandingTotals),
      brokerageEarnedByCurrency: sortedCurrencyTotals(brokerageEarnedTotals),
    };
  }, [placements, positionQueries]);

  return { ...summary, isLoading };
}

export interface PremiumsPeriodSummary {
  /** Premium collected between `sinceIso` and `untilIso` (or now), by currency. */
  paidByCurrency: CurrencyAmount[];
  /** Brokerage earned on the premium collected in that window, by currency. */
  brokerageEarnedByCurrency: CurrencyAmount[];
  /** Premium collected in the window ÷ premium that was collectible during it
   *  (owed at the window's start + newly due since). 0–100. */
  collectionRate: number;
  isLoading: boolean;
}

/**
 * Premium collection *activity* over a time window, for the Premiums stats row's period
 * toggle. Diffs each placement's financial position as-of `sinceIso` against its position
 * as-of `untilIso` (or its current position when `untilIso` is omitted — i.e. the window runs
 * up to now) — so it needs two position queries per placement (both cached by their as-of
 * key). Balances (due / outstanding) aren't windowable and stay on `usePremiumsSummary`.
 */
export function usePremiumsPeriodSummary(
  placements: Facultative[],
  sinceIso: string,
  untilIso?: string,
): PremiumsPeriodSummary {
  // `untilIso` undefined → the live ("current") position; a value → the position as-of the end
  // of a past calendar year picked from the year dropdown.
  const endQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id, untilIso),
      queryFn: () => fetchPlacementFinancialPosition(p.id, untilIso),
    })),
  });
  const startQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id, sinceIso),
      queryFn: () => fetchPlacementFinancialPosition(p.id, sinceIso),
    })),
  });

  const isLoading = endQueries.some((q) => q.isLoading) || startQueries.some((q) => q.isLoading);

  const summary = useMemo(() => {
    const paidTotals = new Map<string, number>();
    const brokerageTotals = new Map<string, number>();
    let totalPaidInPeriod = 0;
    let totalCollectible = 0;

    placements.forEach((p, i) => {
      const end = endQueries[i]?.data;
      const start = startQueries[i]?.data;
      if (!end || !start) return;
      const code = end.currency ?? p.currency ?? 'UNKNOWN';

      const paidInPeriod = Math.max(
        0,
        (end.cedant.netSettled ?? 0) - (start.cedant.netSettled ?? 0),
      );
      const newlyDue = Math.max(
        0,
        (end.cedant.currentObligation ?? 0) - (start.cedant.currentObligation ?? 0),
      );
      totalPaidInPeriod += paidInPeriod;
      totalCollectible += Math.max(0, start.cedant.outstanding ?? 0) + newlyDue;
      if (paidInPeriod > 0.0001) paidTotals.set(code, (paidTotals.get(code) ?? 0) + paidInPeriod);

      // Brokerage accrues in proportion to premium collected, so the window earns the same
      // fraction of this placement's full-accrual brokerage as the premium share it collected.
      const totalDue = end.cedant.currentObligation ?? 0;
      if (paidInPeriod > 0.0001 && totalDue > 0.0001 && p.premium != null) {
        let placementBrokerage = 0;
        for (const participant of p.participants) {
          if (participant.status !== 'ACCEPTED' && participant.status !== 'CLOSED') continue;
          const share =
            participant.sharePercent != null ? parseFloat(participant.sharePercent) : null;
          const fee =
            participant.brokerageFee != null ? parseFloat(participant.brokerageFee) : null;
          if (share == null || fee == null) continue;
          placementBrokerage += p.premium * (share / 100) * (fee / 100);
        }
        const earned = placementBrokerage * (paidInPeriod / totalDue);
        if (earned > 0.0001) brokerageTotals.set(code, (brokerageTotals.get(code) ?? 0) + earned);
      }
    });

    const collectionRate =
      totalCollectible > 0.0001 ? Math.min(100, (totalPaidInPeriod / totalCollectible) * 100) : 0;

    return {
      paidByCurrency: sortedCurrencyTotals(paidTotals),
      brokerageEarnedByCurrency: sortedCurrencyTotals(brokerageTotals),
      collectionRate,
    };
  }, [placements, endQueries, startQueries]);

  return { ...summary, isLoading };
}

export function useReinsurerPaymentSummary(
  placements: Facultative[],
  reinsurerId: string,
): { paidByCode: Map<string, number>; isLoading: boolean } {
  const reinsuredPlacements = useMemo(
    () =>
      placements.filter((p) =>
        p.participants.some(
          (pt) =>
            pt.counterpartyId === reinsurerId &&
            (pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
        ),
      ),
    [placements, reinsurerId],
  );

  const paymentQueries = useQueries({
    queries: reinsuredPlacements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const isLoading = paymentQueries.some((q) => q.isLoading);

  const paidByCode = useMemo(() => {
    const map = new Map<string, number>();
    paymentQueries.forEach((q) => {
      const payments = q.data ?? [];
      payments
        .filter(
          (pmt) =>
            pmt.type === 'REINSURER_DISBURSEMENT' &&
            pmt.counterpartyId === reinsurerId &&
            pmt.status === 'BANK_CONFIRMED' &&
            !pmt.reversalOfPaymentId,
        )
        .forEach((pmt) => {
          map.set(pmt.currency, (map.get(pmt.currency) ?? 0) + parseFloat(pmt.amount));
        });
    });
    return map;
  }, [paymentQueries, reinsurerId]);

  return { paidByCode, isLoading };
}

export function useCedantPaymentSummary(placements: Facultative[]): {
  paidByCode: Map<string, number>;
  isLoading: boolean;
} {
  const paymentQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const isLoading = paymentQueries.some((q) => q.isLoading);

  const paidByCode = useMemo(() => {
    const map = new Map<string, number>();
    paymentQueries.forEach((q) => {
      const payments = q.data ?? [];
      payments
        .filter(
          (pmt) =>
            pmt.type === 'PREMIUM_RECEIVED' &&
            pmt.status === 'BANK_CONFIRMED' &&
            !pmt.reversalOfPaymentId,
        )
        .forEach((pmt) => {
          map.set(pmt.currency, (map.get(pmt.currency) ?? 0) + parseFloat(pmt.amount));
        });
    });
    return map;
  }, [paymentQueries]);

  return { paidByCode, isLoading };
}

export function useCedantOutstandingCounts(): Map<string, number> {
  const { data: placements = [] } = useFacultatives();

  const closingPlacements = useMemo(
    () => placements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [placements],
  );

  const positionQueries = useQueries({
    queries: closingPlacements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });

  return useMemo(() => {
    const counts = new Map<string, number>();
    closingPlacements.forEach((placement, i) => {
      const position = positionQueries[i]?.data;
      const due = position?.cedant.currentObligation ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      if (due > 0 && outstanding > 0.0001) {
        counts.set(placement.cedant.id, (counts.get(placement.cedant.id) ?? 0) + 1);
      }
    });
    return counts;
  }, [closingPlacements, positionQueries]);
}
