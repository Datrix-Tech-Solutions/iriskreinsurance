import { PrismaClient } from '../../prisma/generated/client';
import {
  LEGACY_SOURCE_SYSTEM,
  LegacyClosedDateLookup,
  LegacyOffer,
} from './legacy-import.types';

export type LegacyClosedDateAction =
  | 'update'
  | 'skip'
  | 'conflict'
  | 'no_action';

export type LegacyClosedDateEnrichmentRecord = {
  legacyOfferId: string;
  action: LegacyClosedDateAction;
  closedDate?: string;
  placementId?: string;
  closingIds: string[];
  reasons: string[];
};

export type LegacyClosedDateEnrichmentPlan = {
  tenantId: string;
  sourceSystem: string;
  counts: Record<LegacyClosedDateAction, number>;
  records: LegacyClosedDateEnrichmentRecord[];
  ignoredLookupOnlyIds: string[];
};

type ImportMapRow = {
  entityType: string;
  legacyId: string;
  currentModel: string;
  currentId: string;
  createdByImport: boolean;
};

type ClosingRow = {
  id: string;
  confirmedAt: Date | null;
};

type ReadPrisma = Pick<PrismaClient, 'legacyImportMap' | 'placementClosing'>;
type WritePrisma = Pick<PrismaClient, '$transaction'>;

export const LEGACY_CLOSED_DATE_ENRICHMENT_TRANSACTION_OPTIONS = {
  maxWait: 30_000,
  timeout: 120_000,
} as const;

export class LegacyClosedDateEnrichment {
  constructor(private readonly prisma: ReadPrisma & Partial<WritePrisma>) {}

  async plan(input: {
    tenantId: string;
    sourceOffers: LegacyOffer[];
    closedDateLookup: LegacyClosedDateLookup;
    ignoredLookupOnlyIds?: string[];
  }): Promise<LegacyClosedDateEnrichmentPlan> {
    const closedOffers = input.sourceOffers.filter(
      (offer) =>
        String(offer.offer_status ?? '')
          .trim()
          .toUpperCase() === 'CLOSED',
    );
    const sourceOfferIds = new Set(
      closedOffers
        .map((offer) => String(offer.offer_id ?? '').trim())
        .filter(Boolean),
    );
    const participantIdsByOffer = new Map<string, string[]>();
    for (const offer of closedOffers) {
      const offerId = String(offer.offer_id ?? '').trim();
      participantIdsByOffer.set(
        offerId,
        (offer.offer_participant ?? [])
          .map((participant) =>
            String(participant.offer_participant_id ?? '').trim(),
          )
          .filter(Boolean),
      );
    }

    const lookupOfferIds = [...input.closedDateLookup.keys()].filter(
      (offerId) => sourceOfferIds.has(offerId),
    );
    const participantIds = [...participantIdsByOffer.values()].flat();
    const maps = (await this.prisma.legacyImportMap.findMany({
      where: {
        tenantId: input.tenantId,
        sourceSystem: LEGACY_SOURCE_SYSTEM,
        entityType: { in: ['offer', 'offer_participant_closing'] },
        legacyId: { in: [...lookupOfferIds, ...participantIds] },
      },
      select: {
        entityType: true,
        legacyId: true,
        currentModel: true,
        currentId: true,
        createdByImport: true,
      },
    })) as ImportMapRow[];
    const offerMaps = new Map(
      maps
        .filter((map) => map.entityType === 'offer')
        .map((map) => [map.legacyId, map]),
    );
    const closingMaps = new Map(
      maps
        .filter((map) => map.entityType === 'offer_participant_closing')
        .map((map) => [map.legacyId, map]),
    );
    const closingIds = maps
      .filter(
        (map) =>
          map.entityType === 'offer_participant_closing' &&
          map.currentModel === 'PlacementClosing' &&
          map.createdByImport,
      )
      .map((map) => map.currentId);
    const closings = closingIds.length
      ? ((await this.prisma.placementClosing.findMany({
          where: {
            tenantId: input.tenantId,
            id: { in: closingIds },
          },
          select: { id: true, confirmedAt: true },
        })) as ClosingRow[])
      : [];
    const closingById = new Map(
      closings.map((closing) => [closing.id, closing]),
    );

    const records: LegacyClosedDateEnrichmentRecord[] = [];
    for (const offer of closedOffers) {
      const legacyOfferId = String(offer.offer_id ?? '').trim();
      const lookup = input.closedDateLookup.get(legacyOfferId);
      if (!lookup) {
        records.push({
          legacyOfferId,
          action: 'no_action',
          closingIds: [],
          reasons: ['no-closed-date-lookup'],
        });
        continue;
      }
      const offerMap = offerMaps.get(legacyOfferId);
      if (!offerMap) {
        records.push({
          legacyOfferId,
          action: 'no_action',
          closedDate: dateOnly(lookup.closedDate),
          closingIds: [],
          reasons: ['source-offer-not-imported'],
        });
        continue;
      }
      if (offerMap.currentModel !== 'Placement') {
        records.push({
          legacyOfferId,
          action: 'conflict',
          closedDate: dateOnly(lookup.closedDate),
          placementId: offerMap.currentId,
          closingIds: [],
          reasons: ['offer-map-current-model-mismatch'],
        });
        continue;
      }

      const offerParticipantIds =
        participantIdsByOffer.get(legacyOfferId) ?? [];
      const mappedClosings = offerParticipantIds.map((participantId) => ({
        participantId,
        map: closingMaps.get(participantId),
      }));
      const invalidClosing = mappedClosings.find(
        ({ map }) =>
          !map ||
          map.currentModel !== 'PlacementClosing' ||
          !map.createdByImport ||
          !closingById.get(map.currentId),
      );
      if (invalidClosing) {
        records.push({
          legacyOfferId,
          action: 'conflict',
          closedDate: dateOnly(lookup.closedDate),
          placementId: offerMap.currentId,
          closingIds: mappedClosings.flatMap(({ map }) =>
            map?.currentId ? [map.currentId] : [],
          ),
          reasons: ['imported-closing-map-missing-or-invalid'],
        });
        continue;
      }

      const rows = mappedClosings.map(
        ({ map }) => closingById.get(map!.currentId)!,
      );
      const mismatched = rows.some(
        (closing) =>
          closing.confirmedAt !== null &&
          dateOnly(closing.confirmedAt) !== dateOnly(lookup.closedDate),
      );
      if (mismatched) {
        records.push({
          legacyOfferId,
          action: 'conflict',
          closedDate: dateOnly(lookup.closedDate),
          placementId: offerMap.currentId,
          closingIds: rows.map((closing) => closing.id),
          reasons: ['existing-confirmed-at-differs-from-lookup'],
        });
        continue;
      }
      const needsUpdate = rows.some((closing) => closing.confirmedAt === null);
      records.push({
        legacyOfferId,
        action: needsUpdate ? 'update' : 'skip',
        closedDate: dateOnly(lookup.closedDate),
        placementId: offerMap.currentId,
        closingIds: rows.map((closing) => closing.id),
        reasons: needsUpdate ? ['confirmed-at-null'] : ['confirmed-at-match'],
      });
    }

    return {
      tenantId: input.tenantId,
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      counts: summarize(records),
      records,
      ignoredLookupOnlyIds: input.ignoredLookupOnlyIds ?? [],
    };
  }

  async apply(input: {
    tenantId: string;
    plan: LegacyClosedDateEnrichmentPlan;
    closedDateLookup: LegacyClosedDateLookup;
  }): Promise<LegacyClosedDateEnrichmentPlan> {
    if (input.plan.counts.conflict > 0) {
      throw new Error('Closed-date enrichment has conflicts; apply aborted.');
    }
    const transaction = this.prisma.$transaction;
    if (!transaction)
      throw new Error('Closed-date apply requires Prisma transaction support.');
    await transaction(async (tx) => {
      for (const record of input.plan.records) {
        if (record.action !== 'update') continue;
        const lookup = input.closedDateLookup.get(record.legacyOfferId);
        if (!lookup) continue;
        for (const closingId of record.closingIds) {
          const updated = await tx.placementClosing.updateMany({
            where: {
              id: closingId,
              tenantId: input.tenantId,
              confirmedAt: null,
            },
            data: { confirmedAt: lookup.closedDate },
          });
          if (updated.count !== 1) {
            throw new Error(
              `Expected to update one imported closing ${closingId}, updated ${updated.count}.`,
            );
          }
        }
      }
    }, LEGACY_CLOSED_DATE_ENRICHMENT_TRANSACTION_OPTIONS);
    return input.plan;
  }
}

function summarize(records: LegacyClosedDateEnrichmentRecord[]) {
  const counts: Record<LegacyClosedDateAction, number> = {
    update: 0,
    skip: 0,
    conflict: 0,
    no_action: 0,
  };
  for (const record of records) counts[record.action] += 1;
  return counts;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
