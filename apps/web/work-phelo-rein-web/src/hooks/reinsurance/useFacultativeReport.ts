import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  useFacultatives,
  useFacultativeRowState,
  fetchPlacementClosings,
  placementClosingsKey,
  fetchPlacementNotes,
  facultativePlacementNotesKey,
} from './useFacultatives';
import { useRiskTypes } from './useRiskTypes';
import { useRiskClasses } from './useRiskClasses';
import {
  fetchPlacementFinancialPosition,
  fetchPlacementPayments,
  paymentsKey,
  placementFinancialPositionKey,
} from './usePayments';
import { useReportCurrencyTotals, ReportCurrencyTotals } from './useReportCurrencyTotals';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  PlacementParticipantClosing,
  PlacementNote,
} from '@/types/reinsurance';
import {
  cedantPaymentStatusFromPosition,
  CedantPaymentStatus,
  pendingPremiumReceived,
} from '@/lib/reinsurance/placementStatus';

const ACCEPTED_STATUSES = new Set(['PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED']);
const OPEN_STATUSES = new Set(['DRAFT', 'MARKETING']);
const QUALIFYING_PARTICIPANT_STATUSES = new Set(['ACCEPTED', 'CLOSED']);
const REINSURER_ROLES = new Set(['REINSURER', 'LEAD_REINSURER', 'CO_REINSURER']);
const RECEIVED_PAYMENT_STATUSES = new Set(['RECORDED', 'BANK_CONFIRMED']);

const num = (v: string | number | null | undefined): number | null =>
  v == null ? null : typeof v === 'number' ? v : parseFloat(v);

export type FacultativeReportDateField = 'createdAt' | 'premiumPaid' | 'closingDate';

function latestPremiumPaidDate(payments: PlacementPayment[]): string | null {
  let latest: string | null = null;
  for (const pmt of payments) {
    if (pmt.type !== 'PREMIUM_RECEIVED') continue;
    if (!RECEIVED_PAYMENT_STATUSES.has(pmt.status)) continue;
    if (pmt.reversalOfPaymentId) continue;
    if (!latest || new Date(pmt.paymentDate) > new Date(latest)) latest = pmt.paymentDate;
  }
  return latest;
}

function closingDateFor(
  placement: Facultative,
  closings: PlacementParticipantClosing[],
): string | null {
  if (placement.forceClosedAt) return placement.forceClosedAt;
  let latest: string | null = null;
  for (const c of closings) {
    if (!c.issuedAt) continue;
    if (!latest || new Date(c.issuedAt) > new Date(latest)) latest = c.issuedAt;
  }
  return latest;
}

function acceptedPercentFor(p: Facultative): number {
  const sum = p.participants
    .filter((pt) => QUALIFYING_PARTICIPANT_STATUSES.has(pt.status))
    .reduce((total, pt) => total + (pt.sharePercent ? parseFloat(pt.sharePercent) : 0), 0);
  return Math.round(sum * 100) / 100;
}

function reinsurerCountFor(p: Facultative): number {
  return p.participants.filter(
    (pt) => REINSURER_ROLES.has(pt.role) && QUALIFYING_PARTICIPANT_STATUSES.has(pt.status),
  ).length;
}

/** One accepted reinsurer on the placement — the report explodes a row per entry
 *  of this list under the Reinsurer scope, with that reinsurer's own financials. */
export interface FacultativeReinsurerBreakdown {
  reinsurerId: string;
  reinsurerName: string;
  /** Signed line % where set, else the negotiated share %. */
  sharePercent: number | null;
  /** This reinsurer's own confirmed-closing date. */
  closedAt: string | null;
  /** effective 100% SI / premium × this reinsurer's share %. */
  facSumInsured: number | null;
  facPremium: number | null;
  /** Fac premium realised by how much cedant premium has been collected. */
  paidFacPremium: number | null;
  brokerage: number | null;
  brokeragePaid: number | null;
  withholdingTax: number | null;
  withholdingTaxPaid: number | null;
  nicLevy: number | null;
  nicLevyPaid: number | null;
  /** From the financial position — what iRisk owes this reinsurer / has settled. */
  netPremiumDueReinsurer: number | null;
  netPremiumPaid: number | null;
}

interface ReinsurerParticipant {
  reinsurerId: string;
  reinsurerName: string;
  sharePercent: number | null;
}

function reinsurerParticipantsFor(p: Facultative): ReinsurerParticipant[] {
  return p.participants
    .filter((pt) => REINSURER_ROLES.has(pt.role) && QUALIFYING_PARTICIPANT_STATUSES.has(pt.status))
    .map((pt) => ({
      reinsurerId: pt.counterpartyId,
      reinsurerName: pt.counterparty.name,
      sharePercent:
        pt.signedLinePercent != null
          ? parseFloat(pt.signedLinePercent)
          : pt.sharePercent != null
            ? parseFloat(pt.sharePercent)
            : null,
    }));
}

export type FacultativeReportLifecycle = 'ACTIVE' | 'EXPIRED';

export interface FacultativeReportParams {
  dateField?: FacultativeReportDateField;
  startDate?: string;
  endDate?: string;
  riskClassIds?: string[];
  currencies?: string[];
  statuses?: FacultativeStatus[];
  cedantIds?: string[];

  lifecycle?: FacultativeReportLifecycle;

  paymentStatuses?: CedantPaymentStatus[];
}

/** Per-placement financial detail for the Cedants scope. All figures in the
 *  placement's own currency; nulls where the underlying data isn't available yet. */
export interface FacultativeCedantFinancials {
  /** 100% sum insured × accepted %. */
  facSumInsured: number | null;
  /** 100% premium × accepted %. */
  facPremium: number | null;
  /** Net premium due iRisk paid + cedant commission amount. */
  paidFacPremium: number | null;
  /** The placement's offer commission %. */
  cedantCommissionPercent: number | null;
  /** Fac premium × cedant commission %. */
  cedantCommissionAmount: number | null;
  /** What the cedant owes iRisk (premium net of cedant commission). */
  netPremiumDueIrisk: number | null;
  netPremiumDueIriskPaid: number | null;
  /** Brokerage across every reinsurer's closing (credit note where available, else
   *  the closing's snapshot); `*Paid` pro-rated by how much cedant premium has been
   *  collected. */
  brokerage: number | null;
  brokeragePaid: number | null;
  /** Sum of every reinsurer's net premium due / paid (from the financial position). */
  netPremiumDueReinsurer: number | null;
  netPremiumDueReinsurerPaid: number | null;
}

const EMPTY_CEDANT_FINANCIALS: FacultativeCedantFinancials = {
  facSumInsured: null,
  facPremium: null,
  paidFacPremium: null,
  cedantCommissionPercent: null,
  cedantCommissionAmount: null,
  netPremiumDueIrisk: null,
  netPremiumDueIriskPaid: null,
  brokerage: null,
  brokeragePaid: null,
  netPremiumDueReinsurer: null,
  netPremiumDueReinsurerPaid: null,
};

export interface FacultativeReportRow {
  id: string;
  reference: string;
  policyNumber: string | null;
  /** The insured party / risk name. */
  title: string;
  cedantName: string;
  classOfBusiness: string | null;
  riskClassName: string | null;
  /** Day the offer was entered into the system. */
  offerDate: string | null;
  /** Latest closing date (force-closed date, else latest issued closing). */
  closedAt: string | null;
  sumInsured: number | null;
  premium: number | null;
  currency: string | null;
  commission: number | null;
  /** The % of the risk ceded facultatively (the offer's `facultativeOffer`) — fixed
   *  across the lifecycle, drives Fac. Share / Fac Sum Insured / Fac Premium. */
  facultativeOfferPercent: number | null;
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  reinsurerCount: number;
  status: FacultativeStatus;
  inceptionDate: string | null;
  expiryDate: string | null;
  paymentStatus: CedantPaymentStatus;
  /** Cedants-scope financial detail; all-null under Reinsurer scope / before load. */
  cedantFinancials: FacultativeCedantFinancials;
  /** Accepted reinsurers on the placement; drives the Reinsurer-scope row explosion. */
  reinsurers: FacultativeReinsurerBreakdown[];
}

export interface FacultativeReportSummary {
  totalOffers: number;
  openOffers: number;
  acceptanceRate: number;
}

export function useFacultativeReport(
  params: FacultativeReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: FacultativeReportRow[];
  summary: FacultativeReportSummary;
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading } = useFacultatives();
  const { data: riskTypes = [] } = useRiskTypes();
  const { data: riskClasses = [] } = useRiskClasses();

  const riskTypeMap = useMemo(() => new Map(riskTypes.map((rt) => [rt.id, rt])), [riskTypes]);
  const riskClassMap = useMemo(
    () => new Map(riskClasses.map((rc) => [rc.id, rc.name])),
    [riskClasses],
  );

  const riskClassNameFor = useMemo(() => {
    return (riskTypeId: string | null): string | null =>
      riskTypeId
        ? (riskClassMap.get(riskTypeMap.get(riskTypeId)?.riskClassId ?? '') ?? null)
        : null;
  }, [riskTypeMap, riskClassMap]);

  const dateField = params.dateField ?? 'createdAt';

  const needsPremiumPaid = enabled && dateField === 'premiumPaid';
  const needsClosingDate = enabled && dateField === 'closingDate';

  const premiumPaymentQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
      enabled: needsPremiumPaid,
    })),
  });
  const closingQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: placementClosingsKey(p.id),
      queryFn: () => fetchPlacementClosings(p.id),
      enabled: needsClosingDate,
    })),
  });
  const premiumPaymentsLoading = needsPremiumPaid && premiumPaymentQueries.some((q) => q.isLoading);
  const closingsLoading = needsClosingDate && closingQueries.some((q) => q.isLoading);

  const resolvedDateFor = useMemo(() => {
    const premiumPaidById = new Map(
      placements.map((p, i) => [p.id, latestPremiumPaidDate(premiumPaymentQueries[i]?.data ?? [])]),
    );
    const closingDateById = new Map(
      placements.map((p, i) => [p.id, closingDateFor(p, closingQueries[i]?.data ?? [])]),
    );
    return (p: Facultative): string | null => {
      switch (dateField) {
        case 'premiumPaid':
          return premiumPaidById.get(p.id) ?? null;
        case 'closingDate':
          return closingDateById.get(p.id) ?? null;
        case 'createdAt':
        default:
          return p.createdAt;
      }
    };
  }, [placements, premiumPaymentQueries, closingQueries, dateField]);

  const filtered = useMemo(() => {
    if (!enabled) return [];

    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;
    const riskClassIds = params.riskClassIds?.length ? new Set(params.riskClassIds) : null;
    const statuses = params.statuses?.length ? new Set(params.statuses) : null;
    const currencies = params.currencies?.length ? new Set(params.currencies) : null;
    const now = new Date();

    return placements.filter((p) => {
      if (from || to) {
        const dateStr = resolvedDateFor(p);
        if (!dateStr) return false;
        const date = new Date(dateStr);
        if (from && date < from) return false;
        if (to && date > to) return false;
      }
      if (params.lifecycle) {
        if (!p.inceptionDate || !p.expiryDate) return false;
        const isExpired = new Date(p.expiryDate) < now;
        if (params.lifecycle === 'EXPIRED' && !isExpired) return false;
        if (params.lifecycle === 'ACTIVE' && (isExpired || new Date(p.inceptionDate) > now))
          return false;
      }
      if (riskClassIds) {
        const riskClassId = p.riskTypeId ? riskTypeMap.get(p.riskTypeId)?.riskClassId : undefined;
        if (!riskClassId || !riskClassIds.has(riskClassId)) return false;
      }
      if (currencies && (!p.currency || !currencies.has(p.currency))) return false;
      if (statuses && !statuses.has(p.status)) return false;
      if (cedantIds && !cedantIds.has(p.cedant.id)) return false;
      return true;
    });
  }, [
    placements,
    enabled,
    riskTypeMap,
    resolvedDateFor,
    params.startDate,
    params.endDate,
    params.lifecycle,
    params.riskClassIds,
    params.currencies,
    params.statuses,
    params.cedantIds,
  ]);

  const positionQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });
  const paymentStatusPaymentsQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
    })),
  });
  const paymentStatusLoading =
    positionQueries.some((q) => q.isLoading) ||
    paymentStatusPaymentsQueries.some((q) => q.isLoading);

  const paymentStatusByPlacementId = useMemo(() => {
    const map = new Map<string, CedantPaymentStatus>();
    filtered.forEach((p, i) => {
      const position = positionQueries[i]?.data;
      const payments = paymentStatusPaymentsQueries[i]?.data ?? [];
      const due = position?.cedant.currentObligation ?? 0;
      const paid = position?.cedant.netSettled ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      const pending = pendingPremiumReceived(payments);
      map.set(p.id, cedantPaymentStatusFromPosition(due, paid, outstanding, pending));
    });
    return map;
  }, [filtered, positionQueries, paymentStatusPaymentsQueries]);

  // Cedants-scope financial detail — closings give the closing date and brokerage;
  // the financial position gives the net-premium figures.
  const financialClosingQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: placementClosingsKey(p.id),
      queryFn: () => fetchPlacementClosings(p.id),
    })),
  });
  const creditNoteQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: facultativePlacementNotesKey(p.id),
      queryFn: () => fetchPlacementNotes(p.id),
    })),
  });
  const cedantFinancialsLoading =
    financialClosingQueries.some((q) => q.isLoading) || creditNoteQueries.some((q) => q.isLoading);

  // Endorsement effective terms — SI / premium / fac-offer % after every in-force
  // endorsement. The backend echoes the base value when no endorsement applies.
  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const { data: rowStateData, isLoading: rowStateLoading } = useFacultativeRowState(filteredIds, {
    enabled,
  });
  const effectiveTermsFor = useMemo(() => {
    const map = new Map(
      (rowStateData?.items ?? []).map((item) => [item.placementId, item] as const),
    );
    return (p: Facultative) => {
      const eff = map.get(p.id);
      return {
        sumInsured: eff?.effectiveSumInsured ?? p.sumInsured,
        premium: eff?.effectivePremium ?? p.premium,
        facOfferPct: eff?.effectiveFacultativeOfferPercent ?? p.facultativeOffer,
      };
    };
  }, [rowStateData?.items]);

  const closedAtByPlacementId = useMemo(() => {
    const map = new Map<string, string | null>();
    filtered.forEach((p, i) => {
      map.set(p.id, closingDateFor(p, financialClosingQueries[i]?.data ?? []));
    });
    return map;
  }, [filtered, financialClosingQueries]);

  const cedantFinancialsByPlacementId = useMemo(() => {
    const map = new Map<string, FacultativeCedantFinancials>();
    filtered.forEach((p, i) => {
      const position = positionQueries[i]?.data;
      const notes = creditNoteQueries[i]?.data ?? [];
      const closings = financialClosingQueries[i]?.data ?? [];

      // Fac. Share is the offered % (fixed across the lifecycle, endorsement-adjusted),
      // matching the debit note — not the accepted-so-far %.
      const terms = effectiveTermsFor(p);
      const facOfferPct = terms.facOfferPct;
      const facSumInsured =
        terms.sumInsured != null && facOfferPct != null
          ? (terms.sumInsured * facOfferPct) / 100
          : null;
      const facPremium =
        terms.premium != null && facOfferPct != null
          ? (terms.premium * facOfferPct) / 100
          : null;
      const cedantCommissionPercent = p.commission;
      const cedantCommissionAmount =
        facPremium != null && cedantCommissionPercent != null
          ? (facPremium * cedantCommissionPercent) / 100
          : null;

      const netPremiumDueIrisk = position ? position.cedant.currentObligation : null;
      const netPremiumDueIriskPaid = position ? position.cedant.netSettled : null;
      const paidFacPremium =
        netPremiumDueIriskPaid != null
          ? netPremiumDueIriskPaid + (cedantCommissionAmount ?? 0)
          : null;

      // Same collected ÷ due ratio the Brokerage report uses to realise its `*Paid` columns.
      const due = position?.cedant.currentObligation ?? 0;
      const paidToIrisk = position?.cedant.netSettled ?? 0;
      const collectionRatio = due > 0.01 ? Math.min(1, Math.max(0, paidToIrisk / due)) : 0;

      // Brokerage per confirmed reinsurer closing — the credit note is authoritative,
      // falling back to the amount snapshotted on the closing itself.
      const confirmedClosings = closings.filter((c) => c.status === 'CONFIRMED');
      const creditNoteForClosing = (closingId: string, counterpartyId: string) =>
        notes.find(
          (n: PlacementNote) =>
            n.type === 'CREDIT_NOTE' &&
            n.status !== 'VOID' &&
            !n.voidedAt &&
            (n.closingId === closingId ||
              (n.closingId == null && n.counterpartyId === counterpartyId)),
        );
      const brokerage = confirmedClosings.length
        ? confirmedClosings.reduce((total, c) => {
            const note = creditNoteForClosing(c.id, c.participant.counterpartyId);
            return total + (num(note?.brokerageAmount) ?? num(c.brokerageAmount) ?? 0);
          }, 0)
        : null;
      const realise = (v: number | null) => (v == null ? null : v * collectionRatio);

      const reinsurerPositions = position?.reinsurers ?? [];
      const netPremiumDueReinsurer = reinsurerPositions.length
        ? reinsurerPositions.reduce((total, r) => total + (r.currentEffectivePayable ?? 0), 0)
        : null;
      const netPremiumDueReinsurerPaid = reinsurerPositions.length
        ? reinsurerPositions.reduce((total, r) => total + (r.netSettled ?? 0), 0)
        : null;

      map.set(p.id, {
        facSumInsured,
        facPremium,
        paidFacPremium,
        cedantCommissionPercent,
        cedantCommissionAmount,
        netPremiumDueIrisk,
        netPremiumDueIriskPaid,
        brokerage,
        brokeragePaid: realise(brokerage),
        netPremiumDueReinsurer,
        netPremiumDueReinsurerPaid,
      });
    });
    return map;
  }, [filtered, positionQueries, creditNoteQueries, financialClosingQueries, effectiveTermsFor]);

  // Per-reinsurer financials — drives the Reinsurer scope's row-per-reinsurer explosion.
  const reinsurerBreakdownByPlacementId = useMemo(() => {
    const map = new Map<string, FacultativeReinsurerBreakdown[]>();
    filtered.forEach((p, i) => {
      const position = positionQueries[i]?.data;
      const notes = creditNoteQueries[i]?.data ?? [];
      const closings = financialClosingQueries[i]?.data ?? [];
      const terms = effectiveTermsFor(p);

      const due = position?.cedant.currentObligation ?? 0;
      const paidToIrisk = position?.cedant.netSettled ?? 0;
      const collectionRatio = due > 0.01 ? Math.min(1, Math.max(0, paidToIrisk / due)) : 0;
      const realise = (v: number | null) => (v == null ? null : v * collectionRatio);

      const confirmedClosings = closings.filter((c) => c.status === 'CONFIRMED');
      const creditNoteFor = (closingId: string | undefined, counterpartyId: string) =>
        notes.find(
          (n: PlacementNote) =>
            n.type === 'CREDIT_NOTE' &&
            n.status !== 'VOID' &&
            !n.voidedAt &&
            ((closingId != null && n.closingId === closingId) ||
              (n.closingId == null && n.counterpartyId === counterpartyId)),
        );

      const rows = reinsurerParticipantsFor(p).map((re): FacultativeReinsurerBreakdown => {
        const closing = confirmedClosings.find(
          (c) => c.participant.counterpartyId === re.reinsurerId,
        );
        const note = creditNoteFor(closing?.id, re.reinsurerId);
        const posRe = position?.reinsurers.find((r) => r.counterpartyId === re.reinsurerId);

        const share = re.sharePercent;
        const facSumInsured =
          terms.sumInsured != null && share != null ? (terms.sumInsured * share) / 100 : null;
        const facPremium =
          terms.premium != null && share != null ? (terms.premium * share) / 100 : null;
        const brokerage = num(note?.brokerageAmount) ?? num(closing?.brokerageAmount);
        const withholdingTax = num(note?.withholdingTaxAmount);
        const nicLevy = num(note?.nicLevyAmount);

        return {
          ...re,
          closedAt: closing?.confirmedAt ?? null,
          facSumInsured,
          facPremium,
          paidFacPremium: realise(facPremium),
          brokerage,
          brokeragePaid: realise(brokerage),
          withholdingTax,
          withholdingTaxPaid: realise(withholdingTax),
          nicLevy,
          nicLevyPaid: realise(nicLevy),
          netPremiumDueReinsurer: posRe ? posRe.currentEffectivePayable : null,
          netPremiumPaid: posRe ? posRe.netSettled : null,
        };
      });
      map.set(p.id, rows);
    });
    return map;
  }, [filtered, positionQueries, creditNoteQueries, financialClosingQueries, effectiveTermsFor]);

  const rows = useMemo<FacultativeReportRow[]>(() => {
    const paymentStatuses = params.paymentStatuses?.length ? new Set(params.paymentStatuses) : null;

    return [...filtered]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((p) => {
      const terms = effectiveTermsFor(p);
      return {
        id: p.id,
        reference: p.reference,
        policyNumber: p.policyNumber,
        title: p.title,
        cedantName: p.cedant.name,
        classOfBusiness: p.classOfBusiness,
        riskClassName: riskClassNameFor(p.riskTypeId),
        offerDate: p.createdAt,
        closedAt: closedAtByPlacementId.get(p.id) ?? null,
        sumInsured: terms.sumInsured,
        premium: terms.premium,
        currency: p.currency,
        commission: p.commission,
        facultativeOfferPercent: terms.facOfferPct,
        totalOfferedPercent: p.totalOfferedPercent,
        totalAcceptedPercent: acceptedPercentFor(p),
        reinsurerCount: reinsurerCountFor(p),
        status: p.status,
        inceptionDate: p.inceptionDate,
        expiryDate: p.expiryDate,
        paymentStatus: paymentStatusByPlacementId.get(p.id) ?? 'Outstanding',
        cedantFinancials: cedantFinancialsByPlacementId.get(p.id) ?? EMPTY_CEDANT_FINANCIALS,
        reinsurers: reinsurerBreakdownByPlacementId.get(p.id) ?? [],
      };
      })
      .filter((row) => !paymentStatuses || paymentStatuses.has(row.paymentStatus));
  }, [
    filtered,
    riskClassNameFor,
    effectiveTermsFor,
    paymentStatusByPlacementId,
    closedAtByPlacementId,
    cedantFinancialsByPlacementId,
    reinsurerBreakdownByPlacementId,
    params.paymentStatuses,
  ]);

  const summary = useMemo<FacultativeReportSummary>(() => {
    const total = filtered.length;
    const openOffers = filtered.filter((p) => OPEN_STATUSES.has(p.status)).length;
    const accepted = filtered.filter((p) => ACCEPTED_STATUSES.has(p.status)).length;
    return {
      totalOffers: total,
      openOffers,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
    };
  }, [filtered]);

  const currencyTotalsEntries = useMemo(
    () =>
      filtered.map((p) => ({
        placement: p,
        participants: p.participants.filter((pt) => QUALIFYING_PARTICIPANT_STATUSES.has(pt.status)),
        scope: 'placement' as const,
      })),
    [filtered],
  );
  const currencyTotals = useReportCurrencyTotals(currencyTotalsEntries);

  return {
    rows,
    summary,
    currencyTotals,
    isLoading:
      isLoading ||
      premiumPaymentsLoading ||
      closingsLoading ||
      paymentStatusLoading ||
      cedantFinancialsLoading ||
      rowStateLoading,
  };
}
