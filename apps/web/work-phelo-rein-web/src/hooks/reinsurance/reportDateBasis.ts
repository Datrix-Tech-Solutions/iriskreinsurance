/**
 * Date bases shared by every reinsurance report (Premiums, Cedants, Reinsurers,
 * Facultative, Brokerage). They mean the same thing everywhere, so one date range
 * always selects the same placements.
 */
export type ReportDateBasis = 'PLACEMENT_CREATED' | 'CLOSING_DATE' | 'PREMIUM_PAYMENT_DATE';

export const DEFAULT_REPORT_DATE_BASIS: ReportDateBasis = 'PLACEMENT_CREATED';

export const REPORT_DATE_BASIS_OPTIONS: { value: ReportDateBasis; label: string }[] = [
  { value: 'PLACEMENT_CREATED', label: 'Date of entry' },
  { value: 'CLOSING_DATE', label: 'Closing date' },
  { value: 'PREMIUM_PAYMENT_DATE', label: 'Premium payment date' },
];
