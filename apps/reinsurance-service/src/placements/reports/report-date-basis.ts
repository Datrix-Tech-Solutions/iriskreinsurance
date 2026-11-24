import { Prisma } from '../../../prisma/generated/client';

/**
 * The only date bases a report may filter on. Every report (Premiums, Cedants,
 * Reinsurers, Facultative, Brokerage) uses the same options and meanings, so the
 * same date range always selects the same placements.
 *
 * - PLACEMENT_CREATED: the placement was entered (`Placement.createdAt`).
 * - CLOSING_DATE: a confirmed closing (original, or endorsement closing of a
 *   CLOSED, already-effective endorsement) falls in the range.
 * - PREMIUM_PAYMENT_DATE: a non-reversed premium receipt (RECORDED or
 *   BANK_CONFIRMED) has its `paymentDate` in the range.
 */
export const REPORT_DATE_BASIS = [
  'PLACEMENT_CREATED',
  'CLOSING_DATE',
  'PREMIUM_PAYMENT_DATE',
] as const;

export type ReportDateBasis = (typeof REPORT_DATE_BASIS)[number];

export const DEFAULT_REPORT_DATE_BASIS: ReportDateBasis = 'PLACEMENT_CREATED';

export type ReportDateRange = { from?: Date; to?: Date };

/** Legacy Facultative `dateField` values, accepted as aliases of `dateBasis`. */
export const LEGACY_DATE_FIELD_TO_BASIS = {
  createdAt: 'PLACEMENT_CREATED',
  closingDate: 'CLOSING_DATE',
  premiumPaid: 'PREMIUM_PAYMENT_DATE',
} as const satisfies Record<string, ReportDateBasis>;

export function parseReportStartDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(value);
}

export function parseReportEndDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }
  return new Date(value);
}

/**
 * Predicate over the placement aliased `p`. Returns an empty fragment when no
 * range is supplied.
 */
export function reportDatePredicate(
  basis: ReportDateBasis | undefined,
  range: ReportDateRange,
  tenantId: string,
): Prisma.Sql {
  if (!range.from && !range.to) return Prisma.empty;
  const inRange = (column: Prisma.Sql): Prisma.Sql => {
    const from = range.from
      ? Prisma.sql`AND ${column} >= ${range.from}`
      : Prisma.empty;
    const to = range.to
      ? Prisma.sql`AND ${column} <= ${range.to}`
      : Prisma.empty;
    return Prisma.sql`${from} ${to}`;
  };

  switch (basis ?? DEFAULT_REPORT_DATE_BASIS) {
    case 'PREMIUM_PAYMENT_DATE':
      return Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "reinsurance"."PlacementPayment" pay_date
          WHERE pay_date."tenantId" = ${tenantId}
            AND pay_date."placementId" = p."id"
            AND pay_date."type" = 'PREMIUM_RECEIVED'
            AND pay_date."status" IN ('RECORDED', 'BANK_CONFIRMED')
            AND pay_date."reversalOfPaymentId" IS NULL
            ${inRange(Prisma.sql`pay_date."paymentDate"`)}
        )
      `;
    case 'CLOSING_DATE':
      return Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "reinsurance"."PlacementClosing" pc_date
          WHERE pc_date."tenantId" = ${tenantId}
            AND pc_date."placementId" = p."id"
            AND pc_date."status" = 'CONFIRMED'
            ${inRange(Prisma.sql`COALESCE(pc_date."confirmedAt", pc_date."issuedAt", pc_date."createdAt")`)}
          UNION ALL
          SELECT 1
          FROM "reinsurance"."PlacementEndorsementClosing" ec_date
          JOIN "reinsurance"."PlacementEndorsement" e_date
            ON e_date."id" = ec_date."endorsementId"
           AND e_date."tenantId" = ec_date."tenantId"
          WHERE ec_date."tenantId" = ${tenantId}
            AND ec_date."placementId" = p."id"
            AND ec_date."status" = 'CONFIRMED'
            AND e_date."status" = 'CLOSED'
            AND e_date."effectiveDate" <= NOW()
            ${inRange(Prisma.sql`COALESCE(ec_date."confirmedAt", ec_date."createdAt")`)}
        )
      `;
    case 'PLACEMENT_CREATED':
    default:
      return inRange(Prisma.sql`p."createdAt"`);
  }
}
