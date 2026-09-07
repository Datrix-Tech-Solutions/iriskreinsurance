import {
  Counterparty,
  ReinsuranceChargeCode,
  ReinsuranceChargeConfiguration,
} from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

/**
 * Neutral fallback for legacy preview-only documents.
 * Official note and financial document calculations use backend tenant
 * ReinsuranceChargeConfiguration snapshots, not frontend statutory constants.
 */
export const NIC_LEVY_RATE = 0;
export const WITHHOLDING_TAX_RATE = 0;
export const FOREIGN_CEDANT_DEDUCTION_RATE = NIC_LEVY_RATE + WITHHOLDING_TAX_RATE;

/** True when the cedant's primary address country is anything other than Ghana. */
export function isForeignCedant(cedant: Counterparty | null | undefined): boolean {
  const primary = cedant?.addresses.find((a) => a.isPrimary) ?? cedant?.addresses[0];
  if (!primary) return false;
  return codeToCountry(primary.country) !== 'Ghana';
}

/**
 * Picks the tenant-configured rate (as a percentage, e.g. 5 for 5%) for a charge
 * code from live ReinsuranceChargeConfiguration data — preferring a currency-specific
 * configuration over the currency-agnostic default, and only considering
 * configurations that are enabled and currently effective.
 */
export function selectChargeRate(
  charges: ReinsuranceChargeConfiguration[] | undefined,
  code: ReinsuranceChargeCode,
  currency?: string | null,
): number {
  if (!charges?.length) return 0;
  const now = new Date();
  const active = charges.filter((charge) => {
    if (charge.code !== code || !charge.isEnabled) return false;
    if (new Date(charge.effectiveFrom) > now) return false;
    if (charge.effectiveTo && new Date(charge.effectiveTo) < now) return false;
    return true;
  });
  const match =
    active.find((charge) => currency && charge.currency === currency) ??
    active.find((charge) => !charge.currency);
  return match ? Number(match.rate) : 0;
}
