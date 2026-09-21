import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import {
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
  PrismaClient,
} from '../../prisma/generated/client';
import { LEGACY_SOURCE_SYSTEM } from './legacy-import.types';
import {
  correctedLegacyReinsurerDisbursementAmount,
  previousLegacyReinsurerDisbursementAmount,
} from './legacy-financials';

export type LegacyReinsurerDisbursementRepairClassification =
  | 'REPAIRABLE'
  | 'ALREADY_CORRECT'
  | 'CONFLICT'
  | 'BLOCKED'
  | 'EXCLUDED';

export type LegacyReinsurerDisbursementRepairRecord = {
  classification: LegacyReinsurerDisbursementRepairClassification;
  reasons: string[];
  legacyParticipantId: string;
  legacyOfferId?: string;
  paymentId: string;
  placementId?: string;
  participantId?: string | null;
  closingId?: string | null;
  currency?: string;
  existingAmount?: string;
  previousFormulaAmount?: string;
  correctedAmount?: string;
  delta?: string;
};

export type LegacyReinsurerDisbursementRepairPlan = {
  mode: 'dry-run';
  tenantId: string;
  tenantSlug: string;
  sourceSystem: typeof LEGACY_SOURCE_SYSTEM;
  generatedAt: string;
  database: {
    host: string;
    port: string;
    database: string;
    schema: string;
  };
  counts: Record<LegacyReinsurerDisbursementRepairClassification, number> & {
    examined: number;
  };
  totalsByCurrency: Record<
    string,
    {
      repairableCount: number;
      existingAmount: string;
      previousFormulaAmount: string;
      correctedAmount: string;
      delta: string;
    }
  >;
  records: LegacyReinsurerDisbursementRepairRecord[];
};

export type LegacyReinsurerDisbursementRepairApplyResult = {
  mode: 'apply';
  repairRunId: string;
  tenantId: string;
  tenantSlug: string;
  correctedPayments: number;
  skippedAlreadyCorrect: number;
  auditFile: string;
  totalsByCurrency: LegacyReinsurerDisbursementRepairPlan['totalsByCurrency'];
};

type RepairPrisma = Pick<
  PrismaClient,
  'legacyImportMap' | 'placementPayment' | 'reinsuranceAccountingOutbox'
>;

type ApplyPrisma = RepairPrisma & Pick<PrismaClient, '$transaction'>;

type ImportMapRow = {
  legacyId: string;
  currentId: string;
  currentModel: string;
  createdByImport: boolean;
  rawHash: string;
  importRunId: string;
};

type OfferMapRow = {
  legacyId: string;
  currentId: string;
};

type PaymentRow = {
  id: string;
  tenantId: string;
  placementId: string;
  participantId: string | null;
  closingId: string | null;
  type: PlacementPaymentType;
  direction: PlacementPaymentDirection;
  amount: unknown;
  currency: string;
  status: PlacementPaymentStatus;
  paymentDate: Date;
  bankConfirmedAt: Date | null;
  bankConfirmedByUserId: string | null;
  settlementMethod: string | null;
  reference: string | null;
  notes: string | null;
  reversalOfPaymentId: string | null;
  _count: {
    allocations: number;
    settledNotes: number;
    reversalPayments: number;
    attachments: number;
  };
};

type OutboxRow = {
  sourceRecordId: string;
};

type ContributingRow = {
  paidFacPremium: string;
  paidCommission?: string;
  brokeragePaid?: string;
  paidWht?: string;
  paidNic?: string;
};

const DEFAULT_BLOCKED_LEGACY_OFFER_IDS = new Set(['5273', '5734']);

export class LegacyReinsurerDisbursementRepairPlanner {
  constructor(private readonly prisma: RepairPrisma | ApplyPrisma) {}

  async buildPlan(input: {
    tenantId: string;
    tenantSlug: string;
    expectedDatabase?: {
      host: string;
      port: string;
      database: string;
      schema: string;
    };
    blockedLegacyOfferIds?: Set<string>;
  }): Promise<LegacyReinsurerDisbursementRepairPlan> {
    const database = assertDatabase(input.expectedDatabase);
    if (input.tenantSlug !== 'stellar-tech') {
      throw new Error(
        `Refusing repair dry-run for unexpected tenant slug ${input.tenantSlug}`,
      );
    }

    const maps = (await this.prisma.legacyImportMap.findMany({
      where: {
        tenantId: input.tenantId,
        sourceSystem: LEGACY_SOURCE_SYSTEM,
        entityType: 'offer_participant_disbursement',
        currentModel: 'PlacementPayment',
      },
      select: {
        legacyId: true,
        currentId: true,
        currentModel: true,
        createdByImport: true,
        rawHash: true,
        importRunId: true,
      },
    })) as ImportMapRow[];

    const paymentIds = [...new Set(maps.map((map) => map.currentId))];
    const payments = paymentIds.length
      ? ((await this.prisma.placementPayment.findMany({
          where: {
            tenantId: input.tenantId,
            id: { in: paymentIds },
          },
          select: {
            id: true,
            tenantId: true,
            placementId: true,
            participantId: true,
            closingId: true,
            type: true,
            direction: true,
            amount: true,
            currency: true,
            status: true,
            paymentDate: true,
            bankConfirmedAt: true,
            bankConfirmedByUserId: true,
            settlementMethod: true,
            reference: true,
            notes: true,
            reversalOfPaymentId: true,
            _count: {
              select: {
                allocations: true,
                settledNotes: true,
                reversalPayments: true,
                attachments: true,
              },
            },
          },
        })) as PaymentRow[])
      : [];
    const paymentById = new Map(
      payments.map((payment) => [payment.id, payment]),
    );
    const placementIds = [
      ...new Set(payments.map((payment) => payment.placementId)),
    ];
    const offerMaps = placementIds.length
      ? ((await this.prisma.legacyImportMap.findMany({
          where: {
            tenantId: input.tenantId,
            sourceSystem: LEGACY_SOURCE_SYSTEM,
            entityType: 'offer',
            currentModel: 'Placement',
            currentId: { in: placementIds },
          },
          select: {
            legacyId: true,
            currentId: true,
          },
        })) as OfferMapRow[])
      : [];
    const offerIdByPlacementId = new Map(
      offerMaps.map((map) => [map.currentId, map.legacyId]),
    );
    const outboxRows = paymentIds.length
      ? ((await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: input.tenantId,
            sourceRecordType: 'PlacementPayment',
            sourceRecordId: { in: paymentIds },
          },
          select: {
            sourceRecordId: true,
          },
        })) as OutboxRow[])
      : [];
    const outboxByPaymentId = countBy(
      outboxRows.map((row) => row.sourceRecordId),
    );

    const records = maps.map((map) =>
      this.classifyMap({
        tenantId: input.tenantId,
        map,
        payment: paymentById.get(map.currentId),
        legacyOfferId: legacyOfferIdForPayment(
          paymentById.get(map.currentId),
          offerIdByPlacementId,
        ),
        outboxCount: outboxByPaymentId.get(map.currentId) ?? 0,
        blockedLegacyOfferIds:
          input.blockedLegacyOfferIds ?? DEFAULT_BLOCKED_LEGACY_OFFER_IDS,
      }),
    );
    return {
      mode: 'dry-run',
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      generatedAt: new Date().toISOString(),
      database,
      counts: summarize(records),
      totalsByCurrency: summarizeCurrency(records),
      records,
    };
  }

  async writePlan(
    plan: LegacyReinsurerDisbursementRepairPlan,
    outputFile: string,
  ) {
    await fs.writeFile(outputFile, `${JSON.stringify(plan, null, 2)}\n`);
  }

  async apply(input: {
    tenantId: string;
    tenantSlug: string;
    auditFile: string;
    expectedDatabase?: {
      host: string;
      port: string;
      database: string;
      schema: string;
    };
  }): Promise<LegacyReinsurerDisbursementRepairApplyResult> {
    if (!('$transaction' in this.prisma)) {
      throw new Error(
        'Repair apply requires a Prisma client with transactions.',
      );
    }
    const plan = await this.buildPlan(input);
    assertPlanSafeToApply(plan);
    const repairRunId = randomUUID();
    const repairable = plan.records.filter(
      (record) => record.classification === 'REPAIRABLE',
    );
    const auditRecords: Array<{
      paymentId: string;
      legacyOfferId?: string;
      legacyParticipantId: string;
      placementId?: string;
      participantId?: string | null;
      closingId?: string | null;
      currency?: string;
      beforeAmount?: string;
      afterAmount?: string;
      sourceReason: string[];
    }> = [];

    await this.prisma.$transaction(
      async (tx) => {
        for (const record of repairable) {
          const rechecked = await recheckPaymentForUpdate(
            tx,
            input.tenantId,
            record,
          );
          if (!rechecked.ok) {
            throw new Error(
              `Repair precondition failed for payment ${record.paymentId}: ${rechecked.reason}`,
            );
          }
          const updated = await tx.placementPayment.updateMany({
            where: {
              id: record.paymentId,
              tenantId: input.tenantId,
              type: PlacementPaymentType.REINSURER_DISBURSEMENT,
              direction: PlacementPaymentDirection.OUTBOUND,
              status: PlacementPaymentStatus.BANK_CONFIRMED,
              amount: record.previousFormulaAmount,
              participantId: record.participantId ?? undefined,
              closingId: record.closingId ?? undefined,
              reversalOfPaymentId: null,
            },
            data: {
              amount: record.correctedAmount,
            },
          });
          if (updated.count !== 1) {
            throw new Error(
              `Conditional update changed ${updated.count} rows for payment ${record.paymentId}`,
            );
          }
          auditRecords.push({
            paymentId: record.paymentId,
            legacyOfferId: record.legacyOfferId,
            legacyParticipantId: record.legacyParticipantId,
            placementId: record.placementId,
            participantId: record.participantId,
            closingId: record.closingId,
            currency: record.currency,
            beforeAmount: record.existingAmount,
            afterAmount: record.correctedAmount,
            sourceReason: record.reasons,
          });
        }
      },
      {
        maxWait: 30_000,
        timeout: 120_000,
      },
    );

    await fs.writeFile(
      input.auditFile,
      `${JSON.stringify(
        {
          repairRunId,
          generatedAt: new Date().toISOString(),
          tenantId: input.tenantId,
          tenantSlug: input.tenantSlug,
          sourceSystem: LEGACY_SOURCE_SYSTEM,
          correctedPayments: auditRecords.length,
          records: auditRecords,
        },
        null,
        2,
      )}\n`,
    );

    return {
      mode: 'apply',
      repairRunId,
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
      correctedPayments: auditRecords.length,
      skippedAlreadyCorrect: plan.counts.ALREADY_CORRECT,
      auditFile: input.auditFile,
      totalsByCurrency: plan.totalsByCurrency,
    };
  }

  private classifyMap(input: {
    tenantId: string;
    map: ImportMapRow;
    payment?: PaymentRow;
    legacyOfferId?: string;
    outboxCount: number;
    blockedLegacyOfferIds: Set<string>;
  }): LegacyReinsurerDisbursementRepairRecord {
    const base: LegacyReinsurerDisbursementRepairRecord = {
      classification: 'CONFLICT',
      reasons: [],
      legacyParticipantId: input.map.legacyId,
      legacyOfferId: input.legacyOfferId,
      paymentId: input.map.currentId,
      placementId: input.payment?.placementId,
      participantId: input.payment?.participantId,
      closingId: input.payment?.closingId,
      currency: input.payment?.currency,
      existingAmount: input.payment
        ? decimalText(input.payment.amount)
        : undefined,
    };

    if (!input.map.createdByImport) {
      return mark(base, 'EXCLUDED', 'legacy-map-not-created-by-import');
    }
    const payment = input.payment;
    if (!payment) return mark(base, 'CONFLICT', 'mapped-payment-missing');
    if (payment.tenantId !== input.tenantId) {
      return mark(base, 'CONFLICT', 'payment-tenant-mismatch');
    }
    if (
      payment.type !== PlacementPaymentType.REINSURER_DISBURSEMENT ||
      payment.direction !== PlacementPaymentDirection.OUTBOUND
    ) {
      return mark(base, 'CONFLICT', 'payment-type-direction-mismatch');
    }
    if (payment.status !== PlacementPaymentStatus.BANK_CONFIRMED) {
      return mark(base, 'CONFLICT', 'payment-not-bank-confirmed');
    }
    if (!payment.notes?.includes('historicalMigration=true')) {
      return mark(base, 'CONFLICT', 'payment-not-marked-historical-migration');
    }
    if (
      input.legacyOfferId &&
      input.blockedLegacyOfferIds.has(input.legacyOfferId)
    ) {
      return mark(base, 'BLOCKED', 'source-offer-hard-rejected');
    }
    if (payment.reversalOfPaymentId || payment._count.reversalPayments > 0) {
      return mark(base, 'EXCLUDED', 'payment-has-reversal-link');
    }
    if (payment._count.allocations > 0) {
      return mark(base, 'EXCLUDED', 'payment-has-allocations');
    }
    if (payment._count.settledNotes > 0) {
      return mark(base, 'EXCLUDED', 'payment-settles-notes');
    }
    if (payment._count.attachments > 0) {
      return mark(base, 'EXCLUDED', 'payment-has-attachments');
    }
    if (input.outboxCount > 0) {
      return mark(base, 'EXCLUDED', 'payment-has-accounting-outbox');
    }
    const contributingRows = parseContributingRows(payment.notes);
    if (!contributingRows.length) {
      return mark(base, 'CONFLICT', 'missing-contributing-rows-provenance');
    }
    const previousAmount = sumMoney(
      contributingRows.map((row) =>
        previousLegacyReinsurerDisbursementAmount(row),
      ),
    );
    const correctedAmount = sumMoney(
      contributingRows.map((row) =>
        correctedLegacyReinsurerDisbursementAmount(row),
      ),
    );
    const enriched = {
      ...base,
      previousFormulaAmount: previousAmount,
      correctedAmount,
      delta: subtractMoney(correctedAmount, decimalText(payment.amount)),
    };
    const existingAmount = decimalText(payment.amount);
    if (moneyEquals(existingAmount, correctedAmount)) {
      return mark(
        enriched,
        'ALREADY_CORRECT',
        'amount-matches-corrected-paid-fac-premium',
      );
    }
    if (moneyEquals(existingAmount, previousAmount)) {
      return mark(
        enriched,
        'REPAIRABLE',
        'amount-matches-previous-double-deduction-formula',
      );
    }
    return mark(
      enriched,
      'CONFLICT',
      'amount-matches-neither-old-nor-corrected-formula',
    );
  }
}

function assertPlanSafeToApply(plan: LegacyReinsurerDisbursementRepairPlan) {
  if (plan.counts.CONFLICT || plan.counts.BLOCKED || plan.counts.EXCLUDED) {
    throw new Error(
      `Repair plan is not safe to apply: conflicts=${plan.counts.CONFLICT}, blocked=${plan.counts.BLOCKED}, excluded=${plan.counts.EXCLUDED}`,
    );
  }
}

async function recheckPaymentForUpdate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  record: LegacyReinsurerDisbursementRepairRecord,
) {
  const payment = await tx.placementPayment.findFirst({
    where: {
      id: record.paymentId,
      tenantId,
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      amount: record.previousFormulaAmount,
      participantId: record.participantId ?? undefined,
      closingId: record.closingId ?? undefined,
      reversalOfPaymentId: null,
    },
    select: {
      id: true,
      notes: true,
      _count: {
        select: {
          allocations: true,
          settledNotes: true,
          reversalPayments: true,
          attachments: true,
        },
      },
    },
  });
  if (!payment) return { ok: false, reason: 'payment-precondition-mismatch' };
  if (!payment.notes?.includes('historicalMigration=true')) {
    return { ok: false, reason: 'missing-historical-migration-marker' };
  }
  const dependentCount =
    payment._count.allocations +
    payment._count.settledNotes +
    payment._count.reversalPayments +
    payment._count.attachments;
  if (dependentCount > 0) {
    return { ok: false, reason: 'payment-has-dependent-records' };
  }
  const outboxCount = await tx.reinsuranceAccountingOutbox.count({
    where: {
      tenantId,
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: record.paymentId,
    },
  });
  if (outboxCount > 0) {
    return { ok: false, reason: 'payment-has-accounting-outbox' };
  }
  return { ok: true };
}

function legacyOfferIdForPayment(
  payment: PaymentRow | undefined,
  offerIdByPlacementId: Map<string, string>,
) {
  return payment ? offerIdByPlacementId.get(payment.placementId) : undefined;
}

function parseContributingRows(notes: string): ContributingRow[] {
  const line = notes
    .split('\n')
    .find((candidate) => candidate.startsWith('contributingRows='));
  if (!line) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(line.slice('contributingRows='.length));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isContributingRow);
}

function isContributingRow(value: unknown): value is ContributingRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.paidFacPremium === 'string';
}

function mark<T extends LegacyReinsurerDisbursementRepairRecord>(
  record: T,
  classification: LegacyReinsurerDisbursementRepairClassification,
  reason: string,
): T {
  return {
    ...record,
    classification,
    reasons: [...record.reasons, reason],
  };
}

function summarize(records: LegacyReinsurerDisbursementRepairRecord[]) {
  const counts = {
    examined: records.length,
    REPAIRABLE: 0,
    ALREADY_CORRECT: 0,
    CONFLICT: 0,
    BLOCKED: 0,
    EXCLUDED: 0,
  };
  for (const record of records) counts[record.classification] += 1;
  return counts;
}

function summarizeCurrency(records: LegacyReinsurerDisbursementRepairRecord[]) {
  const totals: LegacyReinsurerDisbursementRepairPlan['totalsByCurrency'] = {};
  for (const record of records) {
    if (record.classification !== 'REPAIRABLE' || !record.currency) continue;
    const bucket = totals[record.currency] ?? {
      repairableCount: 0,
      existingAmount: '0.00',
      previousFormulaAmount: '0.00',
      correctedAmount: '0.00',
      delta: '0.00',
    };
    bucket.repairableCount += 1;
    bucket.existingAmount = sumMoney([
      bucket.existingAmount,
      record.existingAmount ?? '0.00',
    ]);
    bucket.previousFormulaAmount = sumMoney([
      bucket.previousFormulaAmount,
      record.previousFormulaAmount ?? '0.00',
    ]);
    bucket.correctedAmount = sumMoney([
      bucket.correctedAmount,
      record.correctedAmount ?? '0.00',
    ]);
    bucket.delta = sumMoney([bucket.delta, record.delta ?? '0.00']);
    totals[record.currency] = bucket;
  }
  return totals;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function assertDatabase(expected?: {
  host: string;
  port: string;
  database: string;
  schema: string;
}) {
  const database = databaseInfo(process.env.DATABASE_URL);
  const required =
    expected ??
    ({
      host: '127.0.0.1',
      port: '55433',
      database: 'irisk_local',
      schema: 'reinsurance',
    } as const);
  if (
    database.host !== required.host ||
    database.port !== required.port ||
    database.database !== required.database ||
    database.schema !== required.schema
  ) {
    throw new Error(
      `Refusing repair dry-run for DATABASE_URL ${database.host}:${database.port}/${database.database}?schema=${database.schema}; expected ${required.host}:${required.port}/${required.database}?schema=${required.schema}`,
    );
  }
  return database;
}

function databaseInfo(databaseUrl: string | undefined) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port,
    database: url.pathname.replace(/^\//, ''),
    schema: url.searchParams.get('schema') ?? '',
  };
}

function decimalText(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toFixed' in value &&
    typeof (value as { toFixed: (scale: number) => string }).toFixed ===
      'function'
  ) {
    return (value as { toFixed: (scale: number) => string }).toFixed(2);
  }
  if (value === null || value === undefined) return '0.00';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return toMoneyText(String(value));
  }
  throw new Error('Unsupported decimal value.');
}

function moneyEquals(left: string, right: string) {
  return toCents(left) === toCents(right);
}

function sumMoney(values: string[]) {
  return fromCents(values.reduce((sum, value) => sum + toCents(value), 0n));
}

function subtractMoney(left: string, right: string) {
  return fromCents(toCents(left) - toCents(right));
}

function toMoneyText(value: string) {
  return fromCents(toCents(value));
}

function toCents(value: string) {
  const text = value.trim().replace(/,/g, '');
  if (!text || text === '-') return 0n;
  const negative = text.startsWith('-');
  const [wholeRaw, decimalRaw = ''] = text.replace(/^-/, '').split('.');
  const whole = BigInt(wholeRaw || '0') * 100n;
  const decimals = BigInt((decimalRaw + '00').slice(0, 2));
  return (whole + decimals) * (negative ? -1n : 1n);
}

function fromCents(cents: bigint) {
  const negative = cents < 0;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const decimal = String(abs % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${decimal}`;
}
