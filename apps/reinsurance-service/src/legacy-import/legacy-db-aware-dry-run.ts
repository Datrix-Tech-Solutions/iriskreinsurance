import { PrismaClient } from '../../prisma/generated/client';
import { sha256 } from './legacy-hash';
import {
  LEGACY_SOURCE_SYSTEM,
  LegacyDbAwareDryRunResolution,
  LegacyDbPlannedEntity,
  LegacyImportPlan,
  NormalizedLegacyOffer,
} from './legacy-import.types';
import { counterpartyAddressLegacyId } from './legacy-offers.importer';
import { ExistingImportMap } from './legacy-offers.plan';

type ReadOnlyPrisma = Pick<
  PrismaClient,
  | '$queryRaw'
  | 'currency'
  | 'counterparty'
  | 'counterpartyAddress'
  | 'riskClass'
  | 'riskType'
  | 'riskTypeField'
  | 'placement'
  | 'placementParticipant'
  | 'legacyImportMap'
>;

type AuthTenantRow = {
  id: string;
  slug: string;
  name?: string | null;
};

type AuthUserRow = {
  id: string;
  email?: string | null;
  role?: string | null;
};

type ExistingEntity = {
  id: string;
  legacyId?: string;
  key?: string;
  rawHash?: string;
};

export class LegacyDbAwareDryRun {
  constructor(private readonly prisma: ReadOnlyPrisma) {}

  async resolve(input: {
    tenantSlug: string;
    plan: LegacyImportPlan;
    normalizedOffers: NormalizedLegacyOffer[];
  }): Promise<{
    plan: LegacyImportPlan;
    resolution: LegacyDbAwareDryRunResolution;
    existingMaps: ExistingImportMap[];
  }> {
    const tenant = await this.resolveTenant(input.tenantSlug);
    const importUserCandidate = await this.resolveImportUserCandidate(
      tenant.id,
    );
    const eligibility = eligibilityByOfferId(input.plan);
    const eligibleOfferIds = new Set(
      [...eligibility.entries()]
        .filter(([, result]) => result.eligible)
        .map(([offerId]) => offerId),
    );
    const trackingTablesAvailable = await this.trackingTablesAvailable();
    const existingMaps = trackingTablesAvailable
      ? await this.readExistingMaps(
          tenant.id,
          input.normalizedOffers,
          eligibleOfferIds,
        )
      : [];

    const resolution = await this.buildResolution({
      tenant,
      importUserCandidate,
      trackingTablesAvailable,
      existingMaps,
      plan: input.plan,
      normalizedOffers: input.normalizedOffers,
    });

    return {
      plan: {
        ...input.plan,
        tenantId: tenant.id,
      },
      resolution,
      existingMaps,
    };
  }

  private async resolveTenant(slug: string): Promise<AuthTenantRow> {
    const rows = await this.prisma.$queryRaw<AuthTenantRow[]>`
      SELECT "id", "slug", "name"
      FROM "w_auth"."Tenant"
      WHERE "slug" = ${slug}
      LIMIT 2
    `;
    if (rows.length !== 1) {
      throw new Error(
        `Expected exactly one tenant with slug '${slug}', found ${rows.length}.`,
      );
    }
    return rows[0];
  }

  private async resolveImportUserCandidate(
    tenantId: string,
  ): Promise<AuthUserRow | null> {
    const rows = await this.prisma.$queryRaw<AuthUserRow[]>`
      SELECT "id", "email", "role"
      FROM "w_auth"."User"
      WHERE "tenantId" = ${tenantId}
      ORDER BY
        CASE
          WHEN "role" = 'TENANT_ADMIN' THEN 0
          WHEN "role" = 'SUPER_ADMIN' THEN 1
          ELSE 2
        END,
        "createdAt" ASC
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  private async trackingTablesAvailable(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM information_schema.tables
      WHERE table_schema = 'reinsurance'
        AND table_name IN ('LegacyImportRun', 'LegacyImportMap')
    `;
    return Number(rows[0]?.count ?? 0) === 2;
  }

  private async readExistingMaps(
    tenantId: string,
    offers: NormalizedLegacyOffer[],
    eligibleOfferIds = new Set(offers.map((offer) => offer.offerId)),
  ): Promise<ExistingImportMap[]> {
    const identities = identitiesFor(offers, eligibleOfferIds);
    if (identities.length === 0) return [];
    const entityTypes = [
      ...new Set(identities.map((identity) => identity.entityType)),
    ];
    const legacyIds = [
      ...new Set(identities.map((identity) => identity.legacyId)),
    ];
    const rows = await this.prisma.legacyImportMap.findMany({
      where: {
        tenantId,
        sourceSystem: LEGACY_SOURCE_SYSTEM,
        entityType: { in: entityTypes },
        legacyId: { in: legacyIds },
      },
      select: {
        entityType: true,
        legacyId: true,
        currentModel: true,
        currentId: true,
        rawHash: true,
      },
    });
    return rows;
  }

  private async buildResolution(input: {
    tenant: AuthTenantRow;
    importUserCandidate: AuthUserRow | null;
    trackingTablesAvailable: boolean;
    existingMaps: ExistingImportMap[];
    plan: LegacyImportPlan;
    normalizedOffers: NormalizedLegacyOffer[];
  }): Promise<LegacyDbAwareDryRunResolution> {
    const tenantId = input.tenant.id;
    const eligibility = eligibilityByOfferId(input.plan);
    const eligibleOffers = input.normalizedOffers.filter(
      (offer) => eligibility.get(offer.offerId)?.eligible,
    );
    const currencies = uniqueBy(
      eligibleOffers.map((offer) => ({
        legacyId: offer.currency,
        key: offer.currency,
      })),
      (item) => item.legacyId,
    );
    const counterparties = uniqueBy(
      eligibleOffers.flatMap((offer) => [
        {
          entityType: 'insurer',
          legacyId: offer.insurerId,
          key: normalizeName(offer.insurerName),
          rawHash: sha256(offer.source.insurer),
          addressRawHash: sha256(offer.source.insurer?.insurer_address ?? null),
          hasAddress: Boolean(offer.source.insurer?.insurer_address?.country),
        },
        ...offer.participants.map((participant) => ({
          entityType: 'reinsurer',
          legacyId: participant.reinsurerId,
          key: normalizeName(participant.reinsurerName),
          rawHash: sha256(participant.source.reinsurer),
          addressRawHash: sha256(
            participant.source.reinsurer?.reinsurer_address ?? null,
          ),
          hasAddress: Boolean(
            participant.source.reinsurer?.reinsurer_address?.country,
          ),
        })),
      ]),
      (item) => `${item.entityType}:${item.legacyId}`,
    );
    const riskClasses = uniqueBy(
      eligibleOffers.map((offer) => ({
        legacyId: offer.classId,
        key: offer.className,
        rawHash: sha256(offer.source.classofbusiness),
      })),
      (item) => item.legacyId,
    );
    const placements = input.normalizedOffers.map((offer) => ({
      legacyId: offer.offerId,
      key: offer.normalizedReference,
      rawHash: offer.rawHash,
      eligible: eligibility.get(offer.offerId)?.eligible ?? false,
      ineligibleReason:
        eligibility.get(offer.offerId)?.reason ?? 'not-phase-1-eligible',
    }));
    const participants = input.normalizedOffers.flatMap((offer) =>
      offer.participants.map((participant) => ({
        legacyId: participant.participantId,
        key: `${offer.offerId}:${participant.participantId}`,
        rawHash: participant.rawHash,
        eligible: eligibility.get(offer.offerId)?.eligible ?? false,
        ineligibleReason:
          eligibility.get(offer.offerId)?.reason ??
          'parent-offer-not-phase-1-eligible',
      })),
    );
    const riskTypeFields = uniqueBy(
      eligibleOffers.flatMap((offer) =>
        [...offer.businessFields, ...offer.offerFields].map((field) => ({
          legacyId: `${offer.classId}:${field.normalizedKey}`,
          key: field.normalizedKey,
          riskClassLegacyId: offer.classId,
          rawHash: sha256(field),
        })),
      ),
      (item) => item.legacyId,
    );

    const [
      existingCurrencies,
      existingCounterparties,
      existingAddresses,
      existingRiskClasses,
      existingRiskTypes,
      existingRiskTypeFields,
      existingPlacements,
      existingParticipants,
    ] = await Promise.all([
      this.prisma.currency.findMany({
        where: {
          tenantId,
          isoCode: { in: currencies.map((currency) => currency.key) },
          archivedAt: null,
        },
        select: { id: true, isoCode: true },
      }),
      this.prisma.counterparty.findMany({
        where: {
          tenantId,
          normalizedName: {
            in: counterparties.map((counterparty) => counterparty.key),
          },
          archivedAt: null,
        },
        select: { id: true, normalizedName: true },
      }),
      this.prisma.counterpartyAddress.findMany({
        where: { tenantId },
        select: { id: true, counterpartyId: true },
      }),
      this.prisma.riskClass.findMany({
        where: {
          tenantId,
          name: { in: riskClasses.map((riskClass) => riskClass.key) },
          archivedAt: null,
        },
        select: { id: true, name: true },
      }),
      this.prisma.riskType.findMany({
        where: {
          tenantId,
          name: { in: riskClasses.map((riskClass) => riskClass.key) },
          archivedAt: null,
        },
        select: { id: true, name: true, riskClassId: true },
      }),
      this.prisma.riskTypeField.findMany({
        where: {
          tenantId,
          fieldKey: { in: riskTypeFields.map((field) => field.key) },
        },
        select: { id: true, riskTypeId: true, fieldKey: true },
      }),
      this.prisma.placement.findMany({
        where: {
          tenantId,
          normalizedReference: {
            in: placements.map((placement) => placement.key),
          },
          archivedAt: null,
        },
        select: { id: true, normalizedReference: true },
      }),
      this.prisma.placementParticipant.findMany({
        where: { tenantId },
        select: { id: true, placementId: true, counterpartyId: true },
      }),
    ]);

    const mapIndex = new Map(
      input.existingMaps.map((map) => [
        `${map.entityType}:${map.legacyId}`,
        map,
      ]),
    );
    const existingCurrencyIndex = indexBy(
      existingCurrencies.map((row) => ({ id: row.id, key: row.isoCode })),
    );
    const existingCounterpartyIndex = indexBy(
      existingCounterparties.map((row) => ({
        id: row.id,
        key: row.normalizedName,
      })),
    );
    const existingRiskClassIndex = indexBy(
      existingRiskClasses.map((row) => ({ id: row.id, key: row.name })),
    );
    const existingRiskTypeIndex = indexBy(
      existingRiskTypes.map((row) => ({ id: row.id, key: row.name })),
    );
    const existingRiskTypeFieldIndex = indexBy(
      existingRiskTypeFields.map((row) => ({ id: row.id, key: row.fieldKey })),
    );
    const existingPlacementIndex = indexBy(
      existingPlacements.map((row) => ({
        id: row.id,
        key: row.normalizedReference,
      })),
    );

    const plannedCounterparties = counterparties.map((counterparty) =>
      actionFor({
        entityType: counterparty.entityType,
        legacyId: counterparty.legacyId,
        rawHash: counterparty.rawHash,
        map: mapIndex.get(
          `${counterparty.entityType}:${counterparty.legacyId}`,
        ),
        existing: existingCounterpartyIndex.get(counterparty.key),
        currentModel: 'Counterparty',
      }),
    );
    const plannedRiskClasses = riskClasses.map((riskClass) =>
      actionFor({
        entityType: 'classofbusiness',
        legacyId: riskClass.legacyId,
        rawHash: riskClass.rawHash,
        map: mapIndex.get(`classofbusiness:${riskClass.legacyId}`),
        existing: existingRiskClassIndex.get(riskClass.key),
        currentModel: 'RiskClass',
      }),
    );
    const plannedRiskTypes = riskClasses.map((riskClass) =>
      actionFor({
        entityType: 'risk_type',
        legacyId: riskClass.legacyId,
        rawHash: sha256({
          classId: riskClass.legacyId,
          className: riskClass.key,
        }),
        map: mapIndex.get(`risk_type:${riskClass.legacyId}`),
        existing: existingRiskTypeIndex.get(riskClass.key),
        currentModel: 'RiskType',
      }),
    );
    const plannedAddresses: LegacyDbPlannedEntity[] = counterparties.map(
      (counterparty) => {
        const addressLegacyId = counterpartyAddressLegacyId(
          counterparty.entityType,
          counterparty.legacyId,
        );
        const plannedCounterparty = actionFor({
          entityType: counterparty.entityType,
          legacyId: counterparty.legacyId,
          rawHash: counterparty.rawHash,
          map: mapIndex.get(
            `${counterparty.entityType}:${counterparty.legacyId}`,
          ),
          existing: existingCounterpartyIndex.get(counterparty.key),
          currentModel: 'Counterparty',
        });
        if (!counterparty.hasAddress) {
          return {
            entityType: 'counterparty_address',
            legacyId: addressLegacyId,
            action: 'skip',
            currentModel: 'CounterpartyAddress',
            reason: 'no-legacy-address-country',
          };
        }
        const addressMap = mapIndex.get(
          `counterparty_address:${addressLegacyId}`,
        );
        if (addressMap) {
          return actionFor({
            entityType: 'counterparty_address',
            legacyId: addressLegacyId,
            rawHash: counterparty.addressRawHash,
            map: addressMap,
            existing: undefined,
            currentModel: 'CounterpartyAddress',
          });
        }
        if (plannedCounterparty.action === 'create') {
          return {
            entityType: 'counterparty_address',
            legacyId: addressLegacyId,
            action: 'create',
            currentModel: 'CounterpartyAddress',
            reason: 'counterparty-create-would-create-primary-legacy-address',
          };
        }
        return {
          entityType: 'counterparty_address',
          legacyId: addressLegacyId,
          action: 'reuse',
          currentId: existingAddresses.find(
            (address) =>
              address.counterpartyId === plannedCounterparty.currentId,
          )?.id,
          currentModel: 'CounterpartyAddress',
          reason: 'counterparty-reused-address-not-created-in-dry-run',
        };
      },
    );

    return {
      resolveDb: true,
      tenant: {
        slug: input.tenant.slug,
        id: input.tenant.id,
        name: input.tenant.name ?? undefined,
      },
      importUserCandidate: input.importUserCandidate
        ? {
            id: input.importUserCandidate.id,
            email: input.importUserCandidate.email ?? undefined,
            role: input.importUserCandidate.role ?? undefined,
          }
        : null,
      trackingTablesAvailable: input.trackingTablesAvailable,
      plannedEntities: {
        currencies: currencies.map((currency) =>
          actionFor({
            entityType: 'currency',
            legacyId: currency.legacyId,
            rawHash: sha256({ currency: currency.legacyId }),
            map: mapIndex.get(`currency:${currency.legacyId}`),
            existing: existingCurrencyIndex.get(currency.key),
            currentModel: 'Currency',
          }),
        ),
        counterparties: plannedCounterparties,
        addresses: plannedAddresses,
        riskClasses: plannedRiskClasses,
        riskTypes: plannedRiskTypes,
        riskTypeFields: riskTypeFields.map((field) =>
          actionFor({
            entityType: 'risk_type_field',
            legacyId: field.legacyId,
            rawHash: field.rawHash,
            map: mapIndex.get(`risk_type_field:${field.legacyId}`),
            existing: existingRiskTypeFieldIndex.get(field.key),
            currentModel: 'RiskTypeField',
          }),
        ),
        placements: placements.map((placement) => {
          if (placement.eligible) {
            return actionFor({
              entityType: 'offer',
              legacyId: placement.legacyId,
              rawHash: placement.rawHash,
              map: mapIndex.get(`offer:${placement.legacyId}`),
              existing: existingPlacementIndex.get(placement.key),
              currentModel: 'Placement',
            });
          }
          return {
            entityType: 'offer',
            legacyId: placement.legacyId,
            action: 'skip',
            currentModel: 'Placement',
            reason: placement.ineligibleReason,
          };
        }),
        participants: participants.map((participant) =>
          participant.eligible
            ? actionFor({
                entityType: 'offer_participant',
                legacyId: participant.legacyId,
                rawHash: participant.rawHash,
                map: mapIndex.get(`offer_participant:${participant.legacyId}`),
                existing: undefined,
                currentModel: 'PlacementParticipant',
              })
            : {
                entityType: 'offer_participant',
                legacyId: participant.legacyId,
                action: 'skip',
                currentModel: 'PlacementParticipant',
                reason: participant.ineligibleReason,
              },
        ),
      },
      readCounts: {
        currencies: existingCurrencies.length,
        counterparties: existingCounterparties.length,
        counterpartyAddresses: existingAddresses.length,
        riskClasses: existingRiskClasses.length,
        riskTypes: existingRiskTypes.length,
        riskTypeFields: existingRiskTypeFields.length,
        placements: existingPlacements.length,
        placementParticipants: existingParticipants.length,
        legacyImportMaps: input.existingMaps.length,
      },
    };
  }
}

function actionFor(input: {
  entityType: string;
  legacyId: string;
  rawHash: string;
  map?: ExistingImportMap;
  existing?: ExistingEntity;
  currentModel: string;
}): LegacyDbPlannedEntity {
  if (input.map) {
    if (input.map.rawHash !== input.rawHash) {
      return {
        entityType: input.entityType,
        legacyId: input.legacyId,
        action: 'conflict',
        currentId: input.map.currentId,
        currentModel: input.map.currentModel,
        reason: 'legacy-import-map-raw-hash-mismatch',
      };
    }
    return {
      entityType: input.entityType,
      legacyId: input.legacyId,
      action: 'skip',
      currentId: input.map.currentId,
      currentModel: input.map.currentModel,
      reason: 'legacy-import-map-match',
    };
  }
  if (input.existing) {
    return {
      entityType: input.entityType,
      legacyId: input.legacyId,
      action: 'reuse',
      currentId: input.existing.id,
      currentModel: input.currentModel,
      reason: 'matching-current-record-found-without-import-map',
    };
  }
  return {
    entityType: input.entityType,
    legacyId: input.legacyId,
    action: 'create',
    currentModel: input.currentModel,
    reason: 'no-current-record-or-import-map-found',
  };
}

function identitiesFor(
  offers: NormalizedLegacyOffer[],
  eligibleOfferIds = new Set(offers.map((offer) => offer.offerId)),
) {
  return offers.flatMap((offer) => {
    const base = [
      { entityType: 'offer', legacyId: offer.offerId },
      ...offer.participants.map((participant) => ({
        entityType: 'offer_participant',
        legacyId: participant.participantId,
      })),
    ];
    if (!eligibleOfferIds.has(offer.offerId)) return base;
    return [
      { entityType: 'currency', legacyId: offer.currency },
      { entityType: 'insurer', legacyId: offer.insurerId },
      ...(offer.source.insurer?.insurer_address?.country
        ? [
            {
              entityType: 'counterparty_address',
              legacyId: counterpartyAddressLegacyId('insurer', offer.insurerId),
            },
          ]
        : []),
      { entityType: 'classofbusiness', legacyId: offer.classId },
      { entityType: 'risk_type', legacyId: offer.classId },
      { entityType: 'offer', legacyId: offer.offerId },
      ...offer.participants.flatMap((participant) => [
        { entityType: 'reinsurer', legacyId: participant.reinsurerId },
        ...(participant.source.reinsurer?.reinsurer_address?.country
          ? [
              {
                entityType: 'counterparty_address',
                legacyId: counterpartyAddressLegacyId(
                  'reinsurer',
                  participant.reinsurerId,
                ),
              },
            ]
          : []),
        {
          entityType: 'offer_participant',
          legacyId: participant.participantId,
        },
      ]),
      ...[...offer.businessFields, ...offer.offerFields].map((field) => ({
        entityType: 'risk_type_field',
        legacyId: `${offer.classId}:${field.normalizedKey}`,
      })),
    ];
  });
}

function eligibilityByOfferId(plan: LegacyImportPlan) {
  return new Map(
    plan.records.map((record) => [
      record.offerId,
      record.classification === 'AUTO_SAFE'
        ? {
            eligible: true,
            reason: 'phase-1-auto-safe',
          }
        : {
            eligible: false,
            reason:
              record.classification === 'NEEDS_FINANCIAL_REVIEW'
                ? `phase-1-financial-review:${record.reasons.join(',')}`
                : `phase-1-rejected:${record.reasons.join(',')}`,
          },
    ]),
  );
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  return [...new Map(items.map((item) => [getKey(item), item])).values()];
}

function indexBy(items: ExistingEntity[]) {
  return new Map(items.map((item) => [item.key, item]));
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
