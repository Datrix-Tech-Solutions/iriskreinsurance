import { randomUUID } from 'crypto';
import {
  CounterpartyOrigin,
  CounterpartyType,
  PlacementClosingStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  PlacementType,
  Prisma,
  PrismaClient,
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../prisma/generated/client';
import { riskFieldDefinitionHash, sha256 } from './legacy-hash';
import {
  LEGACY_SOURCE_SYSTEM,
  LEGACY_TOLERANCES,
  LegacyImportPlan,
  NormalizedLegacyOffer,
  NormalizedLegacyParticipant,
} from './legacy-import.types';
import { LegacyDecimal } from './legacy-decimal';
import {
  legacyRiskClassLegacyId,
  normalizeLegacyRiskTypeName,
  resolveLegacyRiskClass,
  riskClassDefinitionHash,
  riskTypeDefinitionHash,
} from './legacy-risk-taxonomy';

type LegacyImportPrisma = PrismaClient | Prisma.TransactionClient;
type LegacyImportMapCache = Map<string, LegacyImportMapRecord | null>;

export const LEGACY_IMPORT_TRANSACTION_OPTIONS = {
  maxWait: 30_000,
  timeout: 120_000,
} as const;

export type ApplyLegacyOffersInput = {
  tenantId: string;
  tenantSlug: string;
  importUserId: string;
  sourceFilePath: string;
  sourceFileHash: string;
  plan: LegacyImportPlan;
  normalizedOffers: NormalizedLegacyOffer[];
};

export type ApplyLegacyOffersResult = {
  importRunId: string;
  created: Record<string, number>;
  skipped: number;
  conflicts: number;
  rejected: number;
};

export class LegacyOffersImporter {
  constructor(private readonly prisma: PrismaClient) {}

  async apply(input: ApplyLegacyOffersInput): Promise<ApplyLegacyOffersResult> {
    const creatableOfferIds = new Set(
      input.plan.records
        .filter(
          (record) =>
            record.action === 'create' && record.classification === 'AUTO_SAFE',
        )
        .map((record) => record.offerId),
    );
    const offers = input.normalizedOffers.filter((offer) =>
      creatableOfferIds.has(offer.offerId),
    );

    return this.prisma.$transaction(async (tx) => {
      const mapCache: LegacyImportMapCache = new Map();
      const importRunId = randomUUID();
      await tx.legacyImportRun.create({
        data: {
          id: importRunId,
          tenantId: input.tenantId,
          sourceSystem: LEGACY_SOURCE_SYSTEM,
          sourceFileHash: input.sourceFileHash,
          sourceFilePath: input.sourceFilePath,
          mode: 'apply',
          status: 'STARTED',
          summary: input.plan as unknown as Prisma.InputJsonValue,
        },
      });

      const created = emptyCreatedCounts();
      for (const offer of offers) {
        await this.ensureCurrency(
          tx,
          mapCache,
          input,
          importRunId,
          offer,
          created,
        );
        const riskTypeId = await this.ensureRisk(
          tx,
          mapCache,
          input,
          importRunId,
          offer,
          created,
        );
        const cedantId = await this.ensureCedant(
          tx,
          mapCache,
          input,
          importRunId,
          offer,
          created,
        );
        const reinsurerIds = new Map<string, string>();
        for (const participant of offer.participants) {
          reinsurerIds.set(
            participant.participantId,
            await this.ensureReinsurer(
              tx,
              mapCache,
              input,
              importRunId,
              participant,
              created,
            ),
          );
        }
        const placementId = await this.createPlacement(
          tx,
          mapCache,
          input,
          importRunId,
          offer,
          riskTypeId,
          cedantId,
          created,
        );
        for (const participant of offer.participants) {
          const participantId = await this.createParticipant(
            tx,
            mapCache,
            input,
            importRunId,
            placementId,
            participant,
            reinsurerIds.get(participant.participantId)!,
            created,
          );
          await this.createHistoricalClosing(
            tx,
            mapCache,
            input,
            importRunId,
            offer,
            participant,
            placementId,
            participantId,
            created,
          );
        }
      }

      await tx.legacyImportRun.update({
        where: { id: importRunId },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          summary: {
            ...input.plan,
            applyCreated: created,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        importRunId,
        created,
        skipped: input.plan.counts.skips,
        conflicts: input.plan.counts.conflicts,
        rejected: input.plan.counts.rejected,
      };
    }, LEGACY_IMPORT_TRANSACTION_OPTIONS);
  }

  private async ensureCurrency(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    created: Record<string, number>,
  ) {
    const legacyId = offer.currency;
    const mapped = await this.findMap(
      tx,
      mapCache,
      input.tenantId,
      'currency',
      legacyId,
    );
    if (mapped) return mapped.currentId;
    const existing = await tx.currency.findFirst({
      where: {
        tenantId: input.tenantId,
        isoCode: offer.currency,
        archivedAt: null,
      },
    });
    const currentId =
      existing?.id ??
      (
        await tx.currency.create({
          data: {
            tenantId: input.tenantId,
            isoCode: offer.currency,
            name: offer.currency,
            exchangeRateToBase: offer.currency === 'GHS' ? 1 : 1,
            isBaseCurrency: false,
            isActive: true,
            createdByUserId: input.importUserId,
            updatedByUserId: input.importUserId,
          },
        })
      ).id;
    if (!existing) created.currencies += 1;
    await this.createMap(tx, mapCache, input.tenantId, importRunId, created, {
      entityType: 'currency',
      legacyId,
      currentModel: 'Currency',
      currentId,
      rawHash: sha256({ currency: offer.currency }),
      createdByImport: !existing,
    });
    return currentId;
  }

  private async ensureRisk(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    created: Record<string, number>,
  ) {
    const riskClassMapping = resolveLegacyRiskClass(offer.className);
    if (!riskClassMapping) {
      throw new Error(
        `Legacy class of business '${offer.className}' has no approved RiskClass mapping`,
      );
    }
    const riskClassLegacyId = legacyRiskClassLegacyId(riskClassMapping);
    const mappedRiskType = await this.findMap(
      tx,
      mapCache,
      input.tenantId,
      'risk_type',
      offer.classId,
    );
    if (mappedRiskType) return mappedRiskType.currentId;

    let createdRiskClass = false;
    const mappedRiskClass = await this.findMap(
      tx,
      mapCache,
      input.tenantId,
      'risk_class',
      riskClassLegacyId,
    );
    let riskClass = await tx.riskClass.findFirst({
      where: {
        tenantId: input.tenantId,
        ...(mappedRiskClass
          ? { id: mappedRiskClass.currentId }
          : { name: riskClassMapping.name, archivedAt: null }),
      },
    });
    if (!riskClass) {
      riskClass = await tx.riskClass.create({
        data: {
          tenantId: input.tenantId,
          name: riskClassMapping.name,
          description: 'Imported from approved legacy iRisk risk taxonomy.',
          isActive: true,
          createdByUserId: input.importUserId,
          updatedByUserId: input.importUserId,
        },
      });
      created.riskClasses += 1;
      createdRiskClass = true;
    }
    if (!mappedRiskClass) {
      await this.createMap(tx, mapCache, input.tenantId, importRunId, created, {
        entityType: 'risk_class',
        legacyId: riskClassLegacyId,
        currentModel: 'RiskClass',
        currentId: riskClass.id,
        rawHash: riskClassDefinitionHash(riskClassMapping),
        createdByImport: createdRiskClass,
      });
    }

    let createdRiskType = false;
    let riskType = await findRiskTypeByCanonicalName(
      tx,
      input.tenantId,
      riskClass.id,
      offer.className,
    );
    if (!riskType) {
      riskType = await tx.riskType.create({
        data: {
          tenantId: input.tenantId,
          riskClassId: riskClass.id,
          name: offer.className,
          description: 'Imported from legacy iRisk class of business.',
          isActive: true,
          createdByUserId: input.importUserId,
          updatedByUserId: input.importUserId,
        },
      });
      created.riskTypes += 1;
      createdRiskType = true;
    }
    await this.createMap(tx, mapCache, input.tenantId, importRunId, created, {
      entityType: 'risk_type',
      legacyId: offer.classId,
      currentModel: 'RiskType',
      currentId: riskType.id,
      rawHash: riskTypeDefinitionHash({
        legacyClassId: offer.classId,
        riskTypeName: offer.className,
        riskClass: riskClassMapping,
      }),
      createdByImport: createdRiskType,
    });

    const allFields = uniqueFields([
      ...offer.businessFields,
      ...offer.offerFields,
    ]);
    for (const field of allFields) {
      const riskFieldLegacyId = `${offer.classId}:${field.normalizedKey}`;
      const mappedRiskField = await this.findMap(
        tx,
        mapCache,
        input.tenantId,
        'risk_type_field',
        riskFieldLegacyId,
      );
      if (mappedRiskField) continue;
      const existingField = await tx.riskTypeField.findFirst({
        where: {
          tenantId: input.tenantId,
          riskTypeId: riskType.id,
          section: RiskTypeFieldSection.OFFER_DETAILS,
          fieldKey: field.normalizedKey,
        },
      });
      const createdField =
        existingField ??
        (await tx.riskTypeField.create({
          data: {
            tenantId: input.tenantId,
            riskTypeId: riskType.id,
            section: RiskTypeFieldSection.OFFER_DETAILS,
            fieldKey: field.normalizedKey,
            label: field.key,
            fieldType: RiskTypeFieldType.TEXT,
            required: false,
            isActive: true,
          },
        }));
      if (!existingField) created.riskTypeFields += 1;
      await this.createMap(tx, mapCache, input.tenantId, importRunId, created, {
        entityType: 'risk_type_field',
        legacyId: riskFieldLegacyId,
        currentModel: 'RiskTypeField',
        currentId: createdField.id,
        rawHash: riskFieldDefinitionHash({
          riskTypeLegacyId: offer.classId,
          key: field.key,
          normalizedKey: field.normalizedKey,
        }),
        createdByImport: !existingField,
      });
    }
    return riskType.id;
  }

  private async ensureCedant(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    created: Record<string, number>,
  ) {
    return this.ensureCounterparty(tx, mapCache, input, importRunId, {
      entityType: 'insurer',
      legacyId: offer.insurerId,
      type: CounterpartyType.CEDANT,
      name: offer.insurerName,
      email: offer.source.insurer?.insurer_company_email,
      website: offer.source.insurer?.insurer_company_website,
      address: offer.source.insurer?.insurer_address,
      raw: offer.source.insurer,
      created,
    });
  }

  private async ensureReinsurer(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    participant: NormalizedLegacyParticipant,
    created: Record<string, number>,
  ) {
    return this.ensureCounterparty(tx, mapCache, input, importRunId, {
      entityType: 'reinsurer',
      legacyId: participant.reinsurerId,
      type: CounterpartyType.REINSURER,
      name: participant.reinsurerName,
      email: participant.source.reinsurer?.re_company_email,
      address: participant.source.reinsurer?.reinsurer_address,
      raw: participant.source.reinsurer,
      created,
    });
  }

  private async ensureCounterparty(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    args: {
      entityType: string;
      legacyId: string;
      type: CounterpartyType;
      name: string;
      email?: string | null;
      website?: string | null;
      address?: {
        street?: string | null;
        suburb?: string | null;
        region?: string | null;
        country?: string | null;
      } | null;
      raw: unknown;
      created: Record<string, number>;
    },
  ) {
    const mapped = await this.findMap(
      tx,
      mapCache,
      input.tenantId,
      args.entityType,
      args.legacyId,
    );
    if (mapped) return mapped.currentId;
    let createdCounterparty = false;
    let counterparty = await tx.counterparty.findFirst({
      where: {
        tenantId: input.tenantId,
        type: args.type,
        normalizedName: normalizeCounterpartyName(args.name),
        archivedAt: null,
      },
    });
    if (!counterparty) {
      counterparty = await tx.counterparty.create({
        data: {
          tenantId: input.tenantId,
          type: args.type,
          origin:
            args.address?.country?.toLowerCase() === 'ghana'
              ? CounterpartyOrigin.LOCAL
              : CounterpartyOrigin.FOREIGN,
          name: args.name,
          normalizedName: normalizeCounterpartyName(args.name),
          email: clean(args.email),
          website: clean(args.website),
          country: clean(args.address?.country),
          createdByUserId: input.importUserId,
          updatedByUserId: input.importUserId,
        },
      });
      args.created.counterparties += 1;
      createdCounterparty = true;
      if (args.address?.country) {
        const address = await tx.counterpartyAddress.create({
          data: {
            tenantId: input.tenantId,
            counterpartyId: counterparty.id,
            label: 'Legacy address',
            line1:
              clean(args.address.street) ??
              clean(args.address.suburb) ??
              'Legacy address',
            city:
              clean(args.address.suburb) ??
              clean(args.address.region) ??
              'Unknown',
            state: clean(args.address.region),
            country: clean(args.address.country) ?? 'Unknown',
            isPrimary: true,
          },
        });
        args.created.counterpartyAddresses += 1;
        await this.createMap(
          tx,
          mapCache,
          input.tenantId,
          importRunId,
          args.created,
          {
            entityType: 'counterparty_address',
            legacyId: counterpartyAddressLegacyId(
              args.entityType,
              args.legacyId,
            ),
            currentModel: 'CounterpartyAddress',
            currentId: address.id,
            rawHash: sha256(args.address),
            createdByImport: true,
          },
        );
      }
    }
    await this.createMap(
      tx,
      mapCache,
      input.tenantId,
      importRunId,
      args.created,
      {
        entityType: args.entityType,
        legacyId: args.legacyId,
        currentModel: 'Counterparty',
        currentId: counterparty.id,
        rawHash: sha256(args.raw),
        createdByImport: createdCounterparty,
      },
    );
    return counterparty.id;
  }

  private async createPlacement(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    riskTypeId: string,
    cedantId: string,
    created: Record<string, number>,
  ) {
    const existingMap = await this.findMap(
      tx,
      mapCache,
      input.tenantId,
      'offer',
      offer.offerId,
    );
    if (existingMap) return existingMap.currentId;
    const placement = await tx.placement.create({
      data: {
        tenantId: input.tenantId,
        reference: offer.reference,
        normalizedReference: offer.normalizedReference,
        title: offer.title,
        placementType: PlacementType.FACULTATIVE,
        status: PlacementStatus.CLOSED,
        cedantId,
        policyNumber: offer.policyNumber,
        riskTypeId,
        classOfBusiness: offer.className,
        businessDetails: Prisma.JsonNull,
        offerDetails: canonicalLegacyOfferDetails(offer),
        inceptionDate: offer.inceptionDate,
        expiryDate: offer.expiryDate,
        currency: offer.currency,
        sumInsured: offer.numbers.sumInsured,
        rate: offer.numbers.rate,
        premium: offer.numbers.premium,
        commission: offer.numbers.commission,
        facultativeOffer: offer.numbers.facultativeOffer,
        createdByUserId: input.importUserId,
        updatedByUserId: input.importUserId,
      },
    });
    created.placements += 1;
    await this.createMap(tx, mapCache, input.tenantId, importRunId, created, {
      entityType: 'offer',
      legacyId: offer.offerId,
      currentModel: 'Placement',
      currentId: placement.id,
      rawHash: offer.rawHash,
      createdByImport: true,
    });
    return placement.id;
  }

  private async createParticipant(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    placementId: string,
    participant: NormalizedLegacyParticipant,
    counterpartyId: string,
    created: Record<string, number>,
  ) {
    const existingMap = await this.findMap(
      tx,
      mapCache,
      input.tenantId,
      'offer_participant',
      participant.participantId,
    );
    if (existingMap) return existingMap.currentId;
    const row = await tx.placementParticipant.create({
      data: {
        tenantId: input.tenantId,
        placementId,
        counterpartyId,
        role: PlacementParticipantRole.REINSURER,
        status: PlacementParticipantStatus.ACCEPTED,
        sharePercent: participant.percentage,
        signedLinePercent: participant.percentage,
        brokerageFee: participant.brokerageFee,
        notes: `Imported legacy participant ${participant.participantId}; financial closings/payments deferred.`,
      },
    });
    created.participants += 1;
    await this.createMap(tx, mapCache, input.tenantId, importRunId, created, {
      entityType: 'offer_participant',
      legacyId: participant.participantId,
      currentModel: 'PlacementParticipant',
      currentId: row.id,
      rawHash: participant.rawHash,
      createdByImport: true,
    });
    return row.id;
  }

  private async createHistoricalClosing(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    participant: NormalizedLegacyParticipant,
    placementId: string,
    participantId: string,
    created: Record<string, number>,
  ) {
    const legacyId = participant.participantId;
    const rawHash = historicalPlacementClosingHash(offer, participant);
    const existingMap = await this.findMap(
      tx,
      mapCache,
      input.tenantId,
      'offer_participant_closing',
      legacyId,
    );
    if (existingMap) {
      if (
        existingMap.currentModel !== 'PlacementClosing' ||
        existingMap.rawHash !== rawHash
      ) {
        throw new Error(
          `Legacy placement closing map conflict for offer_participant_id ${legacyId}`,
        );
      }
      return existingMap.currentId;
    }

    assertHistoricalClosingSnapshot(offer, participant);
    const [placement, participantRow] = await Promise.all([
      tx.placement.findFirst({
        where: { id: placementId, tenantId: input.tenantId },
        select: { id: true },
      }),
      tx.placementParticipant.findFirst({
        where: {
          id: participantId,
          tenantId: input.tenantId,
          placementId,
        },
        select: { id: true, sharePercent: true, status: true },
      }),
    ]);
    if (!placement) {
      throw new Error(
        `Mapped placement not found for legacy offer ${offer.offerId}`,
      );
    }
    if (!participantRow) {
      throw new Error(
        `Mapped participant not found on placement for offer_participant_id ${legacyId}`,
      );
    }

    const closingNumber = historicalPlacementClosingNumber(legacyId);
    const existingClosing = await tx.placementClosing.findFirst({
      where: {
        tenantId: input.tenantId,
        placementId,
        closingNumber,
      },
      select: { id: true },
    });
    if (existingClosing) {
      throw new Error(
        `Historical closing number ${closingNumber} already exists without an import map`,
      );
    }

    const closing = await tx.placementClosing.create({
      data: {
        tenantId: input.tenantId,
        placementId,
        participantId,
        closingNumber,
        status: PlacementClosingStatus.CONFIRMED,
        signedLinePercent: participant.percentage,
        sharePercent: participantRow.sharePercent,
        sumInsuredSnapshot: participant.facSumInsured,
        grossPremium: participant.facPremium,
        commissionPercent: participant.commissionPercent,
        commissionAmount: participant.commissionAmount,
        brokeragePercent: participant.brokerageFee,
        brokerageAmount: participant.brokerageAmount,
        netPremium: participant.offerAmount,
        currency: offer.currency,
        createdByUserId: input.importUserId,
      },
    });
    created.placementClosings += 1;
    if (participantRow.status !== PlacementParticipantStatus.CLOSED) {
      await tx.placementParticipant.update({
        where: { id_tenantId: { id: participantId, tenantId: input.tenantId } },
        data: { status: PlacementParticipantStatus.CLOSED },
      });
    }
    await this.createMap(tx, mapCache, input.tenantId, importRunId, created, {
      entityType: 'offer_participant_closing',
      legacyId,
      currentModel: 'PlacementClosing',
      currentId: closing.id,
      rawHash,
      createdByImport: true,
    });
    return closing.id;
  }

  private async findMap(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    tenantId: string,
    entityType: string,
    legacyId: string,
  ): Promise<LegacyImportMapRecord | null> {
    const cacheKey = importMapCacheKey(tenantId, entityType, legacyId);
    if (mapCache.has(cacheKey)) return mapCache.get(cacheKey) ?? null;
    const map = await tx.legacyImportMap.findUnique({
      where: {
        tenantId_sourceSystem_entityType_legacyId: {
          tenantId,
          sourceSystem: LEGACY_SOURCE_SYSTEM,
          entityType,
          legacyId,
        },
      },
    });
    mapCache.set(cacheKey, map);
    return map;
  }

  private async createMap(
    tx: LegacyImportPrisma,
    mapCache: LegacyImportMapCache,
    tenantId: string,
    importRunId: string,
    created: Record<string, number>,
    data: {
      entityType: string;
      legacyId: string;
      currentModel: string;
      currentId: string;
      rawHash: string;
      createdByImport: boolean;
    },
  ) {
    await tx.legacyImportMap.create({
      data: {
        tenantId,
        sourceSystem: LEGACY_SOURCE_SYSTEM,
        importRunId,
        ...data,
      },
    });
    created.legacyImportMaps += 1;
    mapCache.set(importMapCacheKey(tenantId, data.entityType, data.legacyId), {
      currentId: data.currentId,
      currentModel: data.currentModel,
      rawHash: data.rawHash,
    });
  }
}

export type LegacyImportMapRecord = {
  currentId: string;
  currentModel: string;
  rawHash: string;
};

function importMapCacheKey(
  tenantId: string,
  entityType: string,
  legacyId: string,
) {
  return `${tenantId}:${entityType}:${legacyId}`;
}

function uniqueFields(fields: Array<{ key: string; normalizedKey: string }>) {
  return [
    ...new Map(fields.map((field) => [field.normalizedKey, field])).values(),
  ];
}

export function canonicalLegacyOfferDetails(
  offer: NormalizedLegacyOffer,
): Prisma.InputJsonObject | typeof Prisma.JsonNull {
  const values = Object.fromEntries(
    offer.offerFields
      .filter((field) => field.value !== undefined && field.value !== null)
      .map((field) => [field.normalizedKey, String(field.value)]),
  );
  return Object.keys(values).length > 0 ? values : Prisma.JsonNull;
}

function normalizeCounterpartyName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function findRiskTypeByCanonicalName(
  tx: LegacyImportPrisma,
  tenantId: string,
  riskClassId: string,
  riskTypeName: string,
) {
  const riskTypes = await tx.riskType.findMany({
    where: {
      tenantId,
      riskClassId,
      archivedAt: null,
    },
  });
  const normalizedName = normalizeLegacyRiskTypeName(riskTypeName);
  return (
    riskTypes.find(
      (riskType) =>
        normalizeLegacyRiskTypeName(riskType.name) === normalizedName,
    ) ?? null
  );
}

export function counterpartyAddressLegacyId(
  ownerEntityType: string,
  ownerLegacyId: string,
) {
  return `${ownerEntityType}:${ownerLegacyId}:primary`;
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'bigint'
  ) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emptyCreatedCounts() {
  return {
    currencies: 0,
    counterparties: 0,
    counterpartyAddresses: 0,
    riskClasses: 0,
    riskTypes: 0,
    riskTypeFields: 0,
    placements: 0,
    participants: 0,
    placementClosings: 0,
    legacyImportRuns: 1,
    legacyImportMaps: 0,
  };
}

export function historicalPlacementClosingNumber(offerParticipantId: string) {
  return `LEGACY-${offerParticipantId}`;
}

export function historicalPlacementClosingHash(
  offer: NormalizedLegacyOffer,
  participant: NormalizedLegacyParticipant,
) {
  return sha256({
    offerParticipantId: participant.participantId,
    signedLinePercent: participant.percentage,
    sumInsuredSnapshot: participant.facSumInsured,
    grossPremium: participant.facPremium,
    commissionPercent: participant.commissionPercent,
    commissionAmount: participant.commissionAmount,
    brokeragePercent: participant.brokerageFee,
    brokerageAmount: participant.brokerageAmount,
    netPremium: participant.offerAmount,
    currency: offer.currency,
  });
}

function assertHistoricalClosingSnapshot(
  offer: NormalizedLegacyOffer,
  participant: NormalizedLegacyParticipant,
) {
  assertPositivePercent(participant.percentage, participant.participantId);
  assertDecimalFits(participant.percentage, 7, 4, 'signedLinePercent');
  assertDecimalFits(participant.facSumInsured, 18, 2, 'sumInsuredSnapshot');
  assertDecimalFits(participant.facPremium, 18, 2, 'grossPremium');
  assertDecimalFits(participant.commissionPercent, 7, 4, 'commissionPercent');
  assertDecimalFits(participant.commissionAmount, 18, 2, 'commissionAmount');
  if (participant.brokerageFee !== null) {
    assertDecimalFits(participant.brokerageFee, 5, 2, 'brokeragePercent');
  }
  assertDecimalFits(participant.brokerageAmount, 18, 2, 'brokerageAmount');
  assertDecimalFits(participant.offerAmount, 18, 2, 'netPremium');
  if (!/^[A-Z]{3}$/.test(offer.currency)) {
    throw new Error(`Invalid legacy closing currency '${offer.currency}'`);
  }
  const expectedNet = LegacyDecimal.from(participant.facPremium)
    .subtract(LegacyDecimal.from(participant.commissionAmount))
    .subtract(LegacyDecimal.from(participant.brokerageAmount))
    .subtract(LegacyDecimal.from(participant.nicLevyAmount))
    .subtract(LegacyDecimal.from(participant.withholdingTaxAmount));
  const delta = expectedNet
    .subtract(LegacyDecimal.from(participant.offerAmount))
    .abs();
  if (delta.gt(LegacyDecimal.from(LEGACY_TOLERANCES.money))) {
    throw new Error(
      `Legacy participant net premium mismatch for offer_participant_id ${participant.participantId}`,
    );
  }
}

function assertPositivePercent(value: string, legacyId: string) {
  if (!LegacyDecimal.from(value).gt(LegacyDecimal.zero())) {
    throw new Error(
      `Legacy participant ${legacyId} must have a signed line percentage greater than zero`,
    );
  }
}

function assertDecimalFits(
  value: string,
  precision: number,
  scale: number,
  fieldName: string,
) {
  const [integerRaw] = value.replace(/^-/, '').split('.');
  const integer = integerRaw.replace(/^0+/, '');
  if (integer.length > precision - scale) {
    throw new Error(
      `Legacy closing ${fieldName} value '${value}' exceeds Decimal(${precision}, ${scale})`,
    );
  }
}
