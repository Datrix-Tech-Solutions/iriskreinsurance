import * as fs from 'fs';
import * as path from 'path';
import {
  LEGACY_SOURCE_SYSTEM,
  NormalizedLegacyOffer,
} from './legacy-import.types';
import { sha256 } from './legacy-hash';

export type LegacyFinancialSourceOptions = {
  sourceDir: string;
  offerCrosswalkFile: string;
  participantCrosswalkFile: string;
};

export type LegacyFinancialPaymentKind =
  | 'PREMIUM_RECEIPT'
  | 'REINSURER_DISBURSEMENT';

export type LegacyFinancialPlanRecord = {
  kind: LegacyFinancialPaymentKind;
  entityType: 'offer_premium_receipt' | 'offer_participant_disbursement';
  legacyId: string;
  legacyOfferId: string;
  legacyParticipantId?: string;
  action: 'create' | 'skip' | 'review' | 'conflict';
  reason: string;
  amount: string;
  currency: string;
  effectiveDate: string;
  effectiveDateSource: 'derived_from_date_closed';
  paymentStatus: string;
  canonicalStatus: 'BANK_CONFIRMED';
  placementId?: string;
  participantId?: string;
  closingId?: string;
  currentPaymentId?: string;
  reference: string;
  settlementMethod: 'OTHER';
  notes: string;
  rawHash: string;
  provenance: {
    sourceSystem: typeof LEGACY_SOURCE_SYSTEM;
    sourceFile: string;
    sourceMonth: string;
    sourceRow: number;
    dateIsDerived: true;
    matchClass?: string;
    participantMatchClass?: string;
    contributingRows?: LegacyFinancialContributingRow[];
  };
};

export type LegacyFinancialPlan = {
  enabled: true;
  sourceDir: string;
  offerCrosswalkFile: string;
  participantCrosswalkFile: string;
  counts: {
    premiumReceipts: Record<'create' | 'skip' | 'review' | 'conflict', number>;
    reinsurerDisbursements: Record<
      'create' | 'skip' | 'review' | 'conflict',
      number
    >;
  };
  blockedOffers: Array<{
    legacyOfferId: string;
    reasons: string[];
  }>;
  records: LegacyFinancialPlanRecord[];
  sourceFieldPolicy: LegacyFinancialFieldPolicy[];
  warnings: string[];
};

export type LegacyFinancialContributingRow = {
  sourceFile: string;
  sourceMonth: string;
  sourceRow: number;
  sourceReinsurerRow?: number;
  matchClass: string;
  reinsurer: string;
  paidFacPremium: string;
  paidCommission: string;
  brokeragePaid: string;
  paidWht: string;
  paidNic: string;
  computedAmount: string;
};

export type LegacyFinancialFieldPolicy = {
  sourceField: string;
  scope: 'policy' | 'reinsurance_placements';
  meaning: string;
  canonicalTarget: string;
  safeToImport: boolean;
  reason: string;
};

type CrosswalkRow = {
  sourceFile: string;
  sourceMonth: string;
  sourceRow: number;
  sourceFileRow?: number;
  sourceReinsurerRow?: number;
  closedDate: string;
  policyNumber?: string;
  reinsurer?: string;
  legacyOfferId: string | null;
  legacyParticipantId?: string | null;
  matchClass: string;
};

type ManagerPolicyRow = Record<string, unknown> & {
  reinsurance_placements?: Array<Record<string, unknown>>;
};

type ExistingFinancialMap = {
  entityType: string;
  legacyId: string;
  currentId: string;
  currentModel: string;
};

type DisbursementGroup = {
  offer: NormalizedLegacyOffer;
  crosswalk: CrosswalkRow;
  participantMatch: CrosswalkRow;
  placementId?: string;
  participantId?: string;
  closingId?: string;
  currency: string;
  amount: Money;
  effectiveDate: string;
  paymentStatus: string;
  contributingRows: LegacyFinancialContributingRow[];
};

export class LegacyFinancialSourceReader {
  read(options: LegacyFinancialSourceOptions) {
    const offers = readJson<CrosswalkRow[]>(options.offerCrosswalkFile);
    const participants = readJson<CrosswalkRow[]>(
      options.participantCrosswalkFile,
    );
    const rowsBySourceRow = new Map<number, ManagerPolicyRow>();
    for (const offer of offers) {
      if (rowsBySourceRow.has(offer.sourceRow)) continue;
      const joined = readJson<{ policies?: ManagerPolicyRow[] }>(
        path.join(options.sourceDir, offer.sourceFile),
      );
      const policy =
        joined.policies?.[(offer.sourceFileRow ?? sourceFileRow(offer)) - 1];
      if (policy) rowsBySourceRow.set(offer.sourceRow, policy);
    }
    return {
      offerCrosswalk: offers,
      participantCrosswalk: participants,
      managerRows: rowsBySourceRow,
    };
  }
}

export class LegacyFinancialPlanner {
  build(input: {
    options: LegacyFinancialSourceOptions;
    normalizedOffers: NormalizedLegacyOffer[];
    placementByOfferId: Map<string, string | undefined>;
    participantByLegacyId?: Map<
      string,
      { participantId: string; closingId: string }
    >;
    existingMaps?: ExistingFinancialMap[];
  }): LegacyFinancialPlan {
    const source = new LegacyFinancialSourceReader().read(input.options);
    const offerRows = acceptedRowsByOffer(source.offerCrosswalk);
    const existingMaps = new Map(
      (input.existingMaps ?? []).map((map) => [
        `${map.entityType}:${map.legacyId}`,
        map,
      ]),
    );
    const records: LegacyFinancialPlanRecord[] = [];
    const warnings: string[] = [];
    const blockedOffers = new Map<string, Set<string>>();
    const participantRows = participantRowsBySourceIdentity(
      source.participantCrosswalk,
    );

    for (const offer of input.normalizedOffers) {
      const crosswalk = offerRows.get(offer.offerId);
      if (!crosswalk) {
        warnings.push(
          `No accepted financial crosswalk for offer ${offer.offerId}`,
        );
        continue;
      }
      const row = source.managerRows.get(crosswalk.sourceRow);
      if (!row) {
        warnings.push(`No manager row for offer ${offer.offerId}`);
        continue;
      }
      const placementId = input.placementByOfferId.get(offer.offerId);
      const paymentStatus = clean(row['Payment Status']);
      const currency = clean(row.Currency) || offer.currency;
      const paidFacPremium = money(row['Paid fac premium']);
      if (paidFacPremium.gt(0) && paymentStatus !== 'UNPAID') {
        records.push(
          withExistingMap(
            premiumReceiptRecord({
              offer,
              crosswalk,
              row,
              placementId,
              currency,
              amount: paidFacPremium.toFixed(2),
            }),
            existingMaps,
          ),
        );
      }

      const disbursementGroups = new Map<string, DisbursementGroup>();
      const duplicateFingerprints = new Set<string>();
      for (const placement of row.reinsurance_placements ?? []) {
        const paidNet = paidNetReinsurerAmount(placement);
        if (!paidNet.gt(0) || paymentStatus === 'UNPAID') continue;

        const sourceReinsurerRow =
          (row.reinsurance_placements?.indexOf(placement) ?? -1) + 1;
        const participantMatch = participantRows.get(
          participantSourceIdentity(crosswalk, sourceReinsurerRow),
        );
        if (
          !participantMatch ||
          participantMatch.legacyOfferId !== offer.offerId ||
          !participantMatch?.legacyParticipantId ||
          !['EXACT', 'HIGH_CONFIDENCE'].includes(participantMatch.matchClass)
        ) {
          addBlockedReason(
            blockedOffers,
            offer.offerId,
            `non-deterministic-participant-disbursement:${clean(placement.Reinsurer)}`,
          );
          continue;
        }
        const fingerprint = disbursementSourceFingerprint({
          offer,
          crosswalk,
          placement,
        });
        if (duplicateFingerprints.has(fingerprint)) {
          warnings.push(
            `Duplicate manager reinsurer row ignored for offer ${offer.offerId} source row ${crosswalk.sourceRow} reinsurer row ${sourceReinsurerRow}`,
          );
          continue;
        }
        duplicateFingerprints.add(fingerprint);

        const legacyParticipantId = String(
          participantMatch.legacyParticipantId,
        );
        const groupKey = `${offer.offerId}:${legacyParticipantId}:${currency}`;
        const contributingRow = contributingDisbursementRow({
          crosswalk,
          participantMatch,
          placement,
          amount: paidNet.toFixed(2),
          sourceReinsurerRow,
        });
        const existingGroup = disbursementGroups.get(groupKey);
        if (existingGroup) {
          if (existingGroup.effectiveDate !== participantMatch.closedDate) {
            addBlockedReason(
              blockedOffers,
              offer.offerId,
              `conflicting-disbursement-effective-dates:${legacyParticipantId}`,
            );
            continue;
          }
          existingGroup.amount = existingGroup.amount.add(paidNet);
          existingGroup.contributingRows.push(contributingRow);
          continue;
        }
        const linked = input.participantByLegacyId?.get(legacyParticipantId);
        disbursementGroups.set(groupKey, {
          offer,
          crosswalk,
          participantMatch,
          placementId,
          participantId: linked?.participantId,
          closingId: linked?.closingId,
          currency,
          amount: paidNet,
          effectiveDate: participantMatch.closedDate,
          paymentStatus: clean(placement['Payment Status']),
          contributingRows: [contributingRow],
        });
      }

      for (const group of disbursementGroups.values()) {
        if (!group.amount.gt(0)) continue;
        records.push(
          withExistingMap(reinsurerDisbursementRecord(group), existingMaps),
        );
      }
    }
    const filteredRecords = records.filter(
      (record) => !blockedOffers.has(record.legacyOfferId),
    );

    return {
      enabled: true,
      sourceDir: input.options.sourceDir,
      offerCrosswalkFile: input.options.offerCrosswalkFile,
      participantCrosswalkFile: input.options.participantCrosswalkFile,
      counts: summarize(filteredRecords),
      blockedOffers: [...blockedOffers.entries()].map(
        ([legacyOfferId, reasons]) => ({
          legacyOfferId,
          reasons: [...reasons],
        }),
      ),
      records: filteredRecords,
      sourceFieldPolicy: financialFieldPolicy(),
      warnings,
    };
  }
}

function addBlockedReason(
  blockedOffers: Map<string, Set<string>>,
  offerId: string,
  reason: string,
) {
  const reasons = blockedOffers.get(offerId) ?? new Set<string>();
  reasons.add(reason);
  blockedOffers.set(offerId, reasons);
}

export function financialLegacyMapEntityTypes() {
  return ['offer_premium_receipt', 'offer_participant_disbursement'];
}

function premiumReceiptRecord(input: {
  offer: NormalizedLegacyOffer;
  crosswalk: CrosswalkRow;
  row: ManagerPolicyRow;
  placementId?: string;
  currency: string;
  amount: string;
}): LegacyFinancialPlanRecord {
  const rawHash = sha256({
    kind: 'PREMIUM_RECEIPT',
    legacyOfferId: input.offer.offerId,
    amount: input.amount,
    currency: input.currency,
    effectiveDate: input.crosswalk.closedDate,
    effectiveDateSource: 'derived_from_date_closed',
    sourceFile: input.crosswalk.sourceFile,
    sourceRow: input.crosswalk.sourceRow,
  });
  return {
    kind: 'PREMIUM_RECEIPT',
    entityType: 'offer_premium_receipt',
    legacyId: input.offer.offerId,
    legacyOfferId: input.offer.offerId,
    action: 'create',
    reason: 'positive-paid-fac-premium',
    amount: input.amount,
    currency: input.currency,
    effectiveDate: input.crosswalk.closedDate,
    effectiveDateSource: 'derived_from_date_closed',
    paymentStatus: clean(input.row['Payment Status']),
    canonicalStatus: 'BANK_CONFIRMED',
    placementId: input.placementId,
    reference: `LEGACY-IRISK-RECEIPT-${input.offer.offerId}`,
    settlementMethod: 'OTHER',
    notes: `Historical legacy iRisk premium receipt; Date Closed used as derived effective date, not bank date; source ${input.crosswalk.sourceFile} row ${input.crosswalk.sourceRow}.`,
    rawHash,
    provenance: provenance(input.crosswalk),
  };
}

function reinsurerDisbursementRecord(
  input: DisbursementGroup,
): LegacyFinancialPlanRecord {
  const legacyParticipantId = String(
    input.participantMatch.legacyParticipantId,
  );
  const amount = input.amount.toFixed(2);
  const rawHash = sha256({
    kind: 'REINSURER_DISBURSEMENT',
    legacyOfferId: input.offer.offerId,
    legacyParticipantId,
    amount,
    currency: input.currency,
    effectiveDate: input.crosswalk.closedDate,
    effectiveDateSource: 'derived_from_date_closed',
    contributingRows: input.contributingRows,
  });
  return {
    kind: 'REINSURER_DISBURSEMENT',
    entityType: 'offer_participant_disbursement',
    legacyId: legacyParticipantId,
    legacyOfferId: input.offer.offerId,
    legacyParticipantId,
    action: 'create',
    reason: 'positive-aggregated-paid-net-reinsurer-components',
    amount,
    currency: input.currency,
    effectiveDate: input.crosswalk.closedDate,
    effectiveDateSource: 'derived_from_date_closed',
    paymentStatus: input.paymentStatus,
    canonicalStatus: 'BANK_CONFIRMED',
    placementId: input.placementId,
    participantId: input.participantId,
    closingId: input.closingId,
    reference: `LEGACY-IRISK-DISBURSEMENT-${legacyParticipantId}`,
    settlementMethod: 'OTHER',
    notes: `Historical legacy iRisk reinsurer disbursement aggregated by legacy participant; Date Closed used as derived effective date, not bank date; ${input.contributingRows.length} manager report row(s) contributed.`,
    rawHash,
    provenance: {
      ...provenance(input.crosswalk),
      participantMatchClass: input.participantMatch.matchClass,
      contributingRows: input.contributingRows,
    },
  };
}

function withExistingMap(
  record: LegacyFinancialPlanRecord,
  existingMaps: Map<string, ExistingFinancialMap>,
): LegacyFinancialPlanRecord {
  const existing = existingMaps.get(`${record.entityType}:${record.legacyId}`);
  if (!existing) return record;
  if (existing.currentModel !== 'PlacementPayment') {
    return {
      ...record,
      action: 'conflict',
      reason: `legacy-map-current-model-${existing.currentModel}`,
      currentPaymentId: existing.currentId,
    };
  }
  return {
    ...record,
    action: 'skip',
    reason: 'legacy-import-map-match',
    currentPaymentId: existing.currentId,
  };
}

function acceptedRowsByOffer(rows: CrosswalkRow[]) {
  const accepted = new Map<string, CrosswalkRow>();
  for (const row of rows) {
    if (
      row.legacyOfferId &&
      ['EXACT', 'HIGH_CONFIDENCE'].includes(row.matchClass) &&
      !accepted.has(String(row.legacyOfferId))
    ) {
      accepted.set(String(row.legacyOfferId), row);
    }
  }
  return accepted;
}

function participantRowsBySourceIdentity(rows: CrosswalkRow[]) {
  const byIdentity = new Map<string, CrosswalkRow>();
  for (const row of rows) {
    if (!row.sourceReinsurerRow) continue;
    byIdentity.set(participantSourceIdentity(row, row.sourceReinsurerRow), row);
  }
  return byIdentity;
}

function participantSourceIdentity(
  row: CrosswalkRow,
  sourceReinsurerRow: number,
) {
  return [
    row.sourceFile,
    row.sourceMonth,
    row.sourceRow,
    sourceReinsurerRow,
  ].join(':');
}

function disbursementSourceFingerprint(input: {
  offer: NormalizedLegacyOffer;
  crosswalk: CrosswalkRow;
  placement: Record<string, unknown>;
}) {
  return sha256({
    legacyOfferId: input.offer.offerId,
    sourceFile: input.crosswalk.sourceFile,
    sourceRow: input.crosswalk.sourceRow,
    reinsurer: clean(input.placement.Reinsurer),
    facSumInsured: clean(input.placement['Fac Sum Insured']),
    facPremium: clean(input.placement['Fac Premium']),
    paidFacPremium: clean(input.placement['Paid fac premium']),
    paidCommission: clean(input.placement['Paid Commission']),
    brokeragePaid: clean(input.placement['Brokerage Paid']),
    paidWht: clean(input.placement['Paid WHT']),
    paidNic: clean(input.placement['Paid NIC']),
    dateClosed: input.crosswalk.closedDate,
    currency: clean(input.placement.Currency),
  });
}

function contributingDisbursementRow(input: {
  crosswalk: CrosswalkRow;
  participantMatch: CrosswalkRow;
  placement: Record<string, unknown>;
  amount: string;
  sourceReinsurerRow: number;
}): LegacyFinancialContributingRow {
  return {
    sourceFile: input.crosswalk.sourceFile,
    sourceMonth: input.crosswalk.sourceMonth,
    sourceRow: input.crosswalk.sourceRow,
    sourceReinsurerRow: input.sourceReinsurerRow,
    matchClass: input.participantMatch.matchClass,
    reinsurer: clean(input.placement.Reinsurer),
    paidFacPremium: clean(input.placement['Paid fac premium']),
    paidCommission: clean(input.placement['Paid Commission']),
    brokeragePaid: clean(input.placement['Brokerage Paid']),
    paidWht: clean(input.placement['Paid WHT']),
    paidNic: clean(input.placement['Paid NIC']),
    computedAmount: input.amount,
  };
}

function paidNetReinsurerAmount(row: Record<string, unknown>) {
  return money(row['Paid fac premium'])
    .subtract(money(row['Paid Commission']))
    .subtract(money(row['Brokerage Paid']))
    .subtract(money(row['Paid WHT']))
    .subtract(money(row['Paid NIC']));
}

function summarize(records: LegacyFinancialPlanRecord[]) {
  const counts = {
    premiumReceipts: emptyActionCounts(),
    reinsurerDisbursements: emptyActionCounts(),
  };
  for (const record of records) {
    const bucket =
      record.kind === 'PREMIUM_RECEIPT'
        ? counts.premiumReceipts
        : counts.reinsurerDisbursements;
    bucket[record.action] += 1;
  }
  return counts;
}

function emptyActionCounts() {
  return { create: 0, skip: 0, review: 0, conflict: 0 };
}

function provenance(row: CrosswalkRow) {
  return {
    sourceSystem: LEGACY_SOURCE_SYSTEM as typeof LEGACY_SOURCE_SYSTEM,
    sourceFile: row.sourceFile,
    sourceMonth: row.sourceMonth,
    sourceRow: row.sourceRow,
    dateIsDerived: true as const,
    matchClass: row.matchClass,
  };
}

function financialFieldPolicy(): LegacyFinancialFieldPolicy[] {
  return [
    {
      sourceField: 'Paid fac premium',
      scope: 'policy',
      meaning:
        'Historical premium amount evidenced as paid by the cedant/insurer in the manager report.',
      canonicalTarget: 'PlacementPayment PREMIUM_RECEIVED amount',
      safeToImport: true,
      reason: 'Positive component-level paid amount; not inferred from status.',
    },
    {
      sourceField: 'Payment Status',
      scope: 'policy',
      meaning: 'Legacy payment status label.',
      canonicalTarget: 'Eligibility guard only',
      safeToImport: false,
      reason: 'Status alone cannot create money.',
    },
    {
      sourceField: 'Net Premium Paid',
      scope: 'policy',
      meaning: 'Report paid-total field.',
      canonicalTarget: 'None',
      safeToImport: false,
      reason: 'Observed as cumulative/report accumulator in joined files.',
    },
    {
      sourceField:
        'Paid fac premium - Paid Commission - Brokerage Paid - Paid WHT - Paid NIC',
      scope: 'reinsurance_placements',
      meaning: 'Component-evidenced net amount paid to/for reinsurer.',
      canonicalTarget: 'PlacementPayment REINSURER_DISBURSEMENT amount',
      safeToImport: true,
      reason:
        'Uses positive paid component fields and excludes ambiguous participant matches.',
    },
    {
      sourceField: 'Date Closed',
      scope: 'policy',
      meaning: 'Manager report closed date.',
      canonicalTarget: 'PlacementPayment.paymentDate',
      safeToImport: true,
      reason:
        'Used only as derived historical effective date when no actual payment date exists.',
    },
  ];
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function sourceFileRow(row: CrosswalkRow) {
  return Number((row as unknown as { sourceFileRow?: number }).sourceFileRow);
}

function clean(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  return '';
}

class Money {
  constructor(private readonly cents: bigint) {}
  static from(value: unknown) {
    const text = clean(value).replace(/,/g, '');
    if (!text || text === '-') return new Money(0n);
    const negative = text.startsWith('-');
    const [wholeRaw, decimalRaw = ''] = text.replace(/^-/, '').split('.');
    const whole = BigInt(wholeRaw || '0') * 100n;
    const decimals = BigInt((decimalRaw + '00').slice(0, 2));
    return new Money((whole + decimals) * (negative ? -1n : 1n));
  }
  subtract(other: Money) {
    return new Money(this.cents - other.cents);
  }
  add(other: Money) {
    return new Money(this.cents + other.cents);
  }
  gt(value: number) {
    return this.cents > BigInt(Math.round(value * 100));
  }
  toFixed(scale: number) {
    const negative = this.cents < 0;
    const abs = negative ? -this.cents : this.cents;
    const whole = abs / 100n;
    const cents = String(abs % 100n).padStart(2, '0');
    return `${negative ? '-' : ''}${whole}.${cents.slice(0, scale)}`;
  }
}

function money(value: unknown) {
  return Money.from(value);
}
