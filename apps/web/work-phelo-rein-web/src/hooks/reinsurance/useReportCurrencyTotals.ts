import { useMemo } from 'react';
import { useReinsurers } from './useReinsurers';
import { useReinsuranceCharges } from './useReinsuranceCharges';
import { Facultative, PlacementParticipant } from '@/types/reinsurance';
import { isForeignCedant, selectChargeRate } from '@/lib/reinsuranceTax';

export type CurrencyTotalsScope = 'placement' | 'participant';

export interface CurrencyTotalsEntry {
  placement: Facultative;
  /** Participants counted toward brokerage/commission/WHT/NIC levy — caller pre-filters by role/status. */
  participants: PlacementParticipant[];
  /**
   * 'placement': sum insured/premium totals add the full placement value once.
   * 'participant': sum insured/premium totals add each participant's ceded share instead
   * (used by reports scoped to a subset of reinsurers, where the placement's full value isn't theirs).
   */
  scope: CurrencyTotalsScope;
}

export interface ReportCurrencyTotals {
  sumInsured: Map<string, number>;
  premium: Map<string, number>;
  brokerage: Map<string, number>;
  commission: Map<string, number>;
  nicLevy: Map<string, number>;
  wht: Map<string, number>;
  isLoading: boolean;
}

function addTo(map: Map<string, number>, currency: string, amount: number) {
  if (!amount) return;
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

/**
 * Aggregates by-currency financial totals (sum insured, premium, brokerage, commission,
 * NIC levy, WHT) across a set of placement/participant entries, for the report summary cards.
 * WHT/NIC levy only apply to participants whose counterparty is a foreign reinsurer, matching
 * the per-document calculation in OfferSlipContent.
 */
export function useReportCurrencyTotals(entries: CurrencyTotalsEntry[]): ReportCurrencyTotals {
  const { data: reinsurers = [], isLoading: loadingReinsurers } = useReinsurers();
  const { data: charges, isLoading: loadingCharges } = useReinsuranceCharges();

  const reinsurerById = useMemo(() => new Map(reinsurers.map((r) => [r.id, r])), [reinsurers]);

  const totals = useMemo(() => {
    const sumInsured = new Map<string, number>();
    const premium = new Map<string, number>();
    const brokerage = new Map<string, number>();
    const commission = new Map<string, number>();
    const nicLevy = new Map<string, number>();
    const wht = new Map<string, number>();

    for (const { placement, participants, scope } of entries) {
      const currency = placement.currency;
      if (!currency) continue;

      if (scope === 'placement') {
        if (placement.sumInsured != null) addTo(sumInsured, currency, placement.sumInsured);
        if (placement.premium != null) addTo(premium, currency, placement.premium);
      }

      const nicRate = selectChargeRate(charges, 'NIC_LEVY', currency);
      const whtRate = selectChargeRate(charges, 'WITHHOLDING_TAX', currency);

      for (const pt of participants) {
        if (pt.sharePercent == null) continue;
        const share = parseFloat(pt.sharePercent) / 100;
        const cededPremium = placement.premium != null ? placement.premium * share : 0;

        if (scope === 'participant') {
          addTo(premium, currency, cededPremium);
          if (placement.sumInsured != null) {
            addTo(sumInsured, currency, placement.sumInsured * share);
          }
        }

        const brokerageFee = pt.brokerageFee != null ? parseFloat(pt.brokerageFee) : 0;
        addTo(brokerage, currency, cededPremium * (brokerageFee / 100));

        const commissionRate = placement.commission ?? 0;
        addTo(commission, currency, cededPremium * (commissionRate / 100));

        if (isForeignCedant(reinsurerById.get(pt.counterpartyId))) {
          addTo(nicLevy, currency, cededPremium * (nicRate / 100));
          addTo(wht, currency, cededPremium * (whtRate / 100));
        }
      }
    }

    return { sumInsured, premium, brokerage, commission, nicLevy, wht };
  }, [entries, charges, reinsurerById]);

  return { ...totals, isLoading: loadingReinsurers || loadingCharges };
}
