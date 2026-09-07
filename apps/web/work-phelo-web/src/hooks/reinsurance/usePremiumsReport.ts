import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useFacultatives, fetchPlacementClosings, placementClosingsKey } from './useFacultatives';
import { useCurrencies } from './useCurrencies';
import { useRiskTypes } from './useRiskTypes';
import {
  CLOSING_STATUSES,
  fetchPlacementFinancialPosition,
  fetchPlacementPayments,
  paymentsKey,
  placementFinancialPositionKey,
  totalEffectiveReinsurerDisbursement,
} from './usePayments';
import { Currency } from '@/types/reinsurance';
import {
  cedantPaymentStatusFromPosition,
  CedantPaymentStatus,
  pendingPremiumReceived,
} from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

function getRate(currencies: Currency[], isoCode: string | null): number {
  if (!isoCode) return 1;
  const c = currencies.find((x) => x.isoCode === isoCode);
  return c?.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : 1;
}

function convertToTarget(
  value: number,
  sourceIso: string | null,
  currencies: Currency[],
  targetRate: number,
): number {
  const sourceRate = getRate(currencies, sourceIso);
  return (value * sourceRate) / targetRate;
}

const num = (v: string | number | null | undefined): number | null =>
  v == null ? null : typeof v === 'number' ? v : parseFloat(v);

export interface PremiumsReportParams {
  /** Restricts to placements whose inceptionDate (period of insurance start) falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  riskTypeId?: string;
  currency?: string;
  paymentStatus?: CedantPaymentStatus;
  cedantIds?: string[];
}

/**
 * One reinsurer's confirmed closing on the placement. The report explodes a
 * placement into one row per entry of this list for both the Cedants and
 * Reinsurer scopes — everything past the shared placement fields (Fac Premium,
 * commission, net premium) is inherently per-reinsurer.
 */
export interface PremiumReinsurerBreakdown {
  reinsurerId: string;
  reinsurerName: string;
  /** The confirmed closing this row comes from. */
  closingId: string;
  /** Signed line % locked in at closing (falls back to the negotiated share %). */
  sharePercent: number | null;
  /** This reinsurer's gross premium share — "Fac Premium". */
  grossPremium: number | null;
  commissionPercent: number | null;
  commissionAmount: number | null;
  /** Brokerage on this reinsurer's share, snapshotted at closing. */
  brokerageAmount: number | null;
  /** Gross premium net of commission — what iRisk owes this reinsurer. */
  netPremium: number | null;
  /** Bank-confirmed REINSURER_DISBURSEMENT paid to this reinsurer so far. */
  paidAmount: number;
  /** When this reinsurer's line was confirmed/closed. */
  closedAt: string | null;
}

export interface PremiumReportRow {
  id: string;
  policyNumber: string;
  title: string;
  cedantName: string;
  /** Risk type / class of business. */
  policyType: string | null;
  /** When the facultative offer was created. */
  offerDate: string | null;
  /** Force-closed date, else the latest confirmed reinsurer closing. */
  closedAt: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  currency: string | null;
  /** 100% sum insured on the offer. */
  sumInsured: number | null;
  /** 100% premium on the offer. */
  premium: number | null;
  /** Offer % ceded to reinsurers — "Fac Share" at the placement level. */
  facultativeOfferPercent: number | null;
  due: number;
  paid: number;
  outstanding: number;
  pending: number;
  paymentStatus: CedantPaymentStatus;
  /** Per-reinsurer participation; empty until at least one line is confirmed. */
  reinsurers: PremiumReinsurerBreakdown[];
}

export interface PremiumsReportSummary {
  totalCollected: number;
  outstanding: number;
  currencySymbol: string;
}

export function usePremiumsReport(
  params: PremiumsReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: PremiumReportRow[];
  summary: PremiumsReportSummary;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading: loadingPlacements } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCurrencies } = useCurrencies();
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

  const filtered = useMemo(() => {
    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;

    return closingRows.filter((p) => {
      if (from || to) {
        if (!p.inceptionDate) return false;
        const inception = new Date(p.inceptionDate);
        if (from && inception < from) return false;
        if (to && inception > to) return false;
      }
      if (params.riskTypeId && p.riskTypeId !== params.riskTypeId) return false;
      if (params.currency && p.currency !== params.currency) return false;
      if (cedantIds && !cedantIds.has(p.cedant.id)) return false;
      return true;
    });
  }, [
    closingRows,
    params.startDate,
    params.endDate,
    params.riskTypeId,
    params.currency,
    params.cedantIds,
  ]);

  const positionQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
      enabled,
    })),
  });
  const paymentQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
      enabled,
    })),
  });
  const closingQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: placementClosingsKey(p.id),
      queryFn: () => fetchPlacementClosings(p.id),
      enabled,
    })),
  });

  const targetIso = useMemo(() => {
    if (params.currency) return params.currency;
    return currencies.find((c) => c.isBaseCurrency)?.isoCode ?? '';
  }, [params.currency, currencies]);
  const targetRate = getRate(currencies, targetIso);

  const allRows = useMemo<PremiumReportRow[]>(() => {
    return filtered.map((p, i) => {
      const position = positionQueries[i]?.data;
      const payments = paymentQueries[i]?.data ?? [];
      const closings = closingQueries[i]?.data ?? [];
      const due = position?.cedant.currentObligation ?? 0;
      const paid = position?.cedant.netSettled ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      const pending = pendingPremiumReceived(payments);

      const confirmedClosings = closings.filter((c) => c.status === 'CONFIRMED');
      const lastConfirmedAt = confirmedClosings.reduce<string | null>(
        (latest, c) =>
          c.confirmedAt && (!latest || c.confirmedAt > latest) ? c.confirmedAt : latest,
        null,
      );

      const reinsurers: PremiumReinsurerBreakdown[] = confirmedClosings.map((c) => ({
        reinsurerId: c.participant.counterpartyId,
        reinsurerName: c.participant.counterparty.name,
        closingId: c.id,
        sharePercent: num(c.signedLinePercent) ?? num(c.sharePercent),
        grossPremium: num(c.grossPremium),
        commissionPercent: num(c.commissionPercent),
        commissionAmount: num(c.commissionAmount),
        brokerageAmount: num(c.brokerageAmount),
        netPremium: num(c.netPremium),
        paidAmount: totalEffectiveReinsurerDisbursement(payments, c.participant.counterpartyId),
        closedAt: c.confirmedAt ?? null,
      }));

      return {
        id: p.id,
        policyNumber: displayPolicyNumber(p.policyNumber),
        title: p.title,
        cedantName: p.cedant.name,
        policyType: riskTypeName(p.riskTypeId, p.classOfBusiness),
        offerDate: p.createdAt,
        closedAt: p.forceClosedAt ?? lastConfirmedAt,
        inceptionDate: p.inceptionDate,
        expiryDate: p.expiryDate,
        currency: position?.currency ?? p.currency,
        sumInsured: p.sumInsured,
        premium: p.premium,
        facultativeOfferPercent: p.facultativeOffer,
        due,
        paid,
        outstanding,
        pending,
        paymentStatus: cedantPaymentStatusFromPosition(due, paid, outstanding, pending),
        reinsurers,
      };
    });
  }, [filtered, positionQueries, paymentQueries, closingQueries, riskTypeName]);

  const rows = useMemo(
    () =>
      params.paymentStatus
        ? allRows.filter((r) => r.paymentStatus === params.paymentStatus)
        : allRows,
    [allRows, params.paymentStatus],
  );

  const summary = useMemo<PremiumsReportSummary>(() => {
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    return {
      totalCollected: rows.reduce(
        (sum, r) => sum + convertToTarget(r.paid, r.currency, currencies, targetRate),
        0,
      ),
      outstanding: rows.reduce(
        (sum, r) => sum + convertToTarget(r.outstanding, r.currency, currencies, targetRate),
        0,
      ),
      currencySymbol: targetCurrency?.symbol ?? targetIso,
    };
  }, [rows, currencies, targetIso, targetRate]);

  const isLoading =
    loadingPlacements ||
    loadingCurrencies ||
    positionQueries.some((q) => q.isLoading) ||
    paymentQueries.some((q) => q.isLoading) ||
    closingQueries.some((q) => q.isLoading);

  return { rows, summary, isLoading };
}
