import { randomUUID } from 'crypto';
import {
  CounterpartyOrigin,
  CounterpartyType,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  PlacementType,
  Prisma,
  PrismaClient,
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../prisma/generated/client';
import { sha256 } from './legacy-hash';
import {
  LEGACY_SOURCE_SYSTEM,
  LegacyImportPlan,
  NormalizedLegacyOffer,
  NormalizedLegacyParticipant,
} from './legacy-import.types';

type LegacyImportPrisma = PrismaClient | Prisma.TransactionClient;

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
        await this.ensureCurrency(tx, input, importRunId, offer, created);
        const riskTypeId = await this.ensureRisk(
          tx,
          input,
          importRunId,
          offer,
          created,
        );
        const cedantId = await this.ensureCedant(
          tx,
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
              input,
              importRunId,
              participant,
              created,
            ),
          );
        }
        const placementId = await this.createPlacement(
          tx,
          input,
          importRunId,
          offer,
          riskTypeId,
          cedantId,
          created,
        );
        for (const participant of offer.participants) {
          await this.createParticipant(
            tx,
            input,
            importRunId,
            placementId,
            participant,
            reinsurerIds.get(participant.participantId)!,
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
    });
  }

  private async ensureCurrency(
    tx: LegacyImportPrisma,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    created: Record<string, number>,
  ) {
    const legacyId = offer.currency;
    const mapped = await this.findMap(tx, input.tenantId, 'currency', legacyId);
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
    await this.createMap(tx, input.tenantId, importRunId, {
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
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    created: Record<string, number>,
  ) {
    const mapped = await this.findMap(
      tx,
      input.tenantId,
      'classofbusiness',
      offer.classId,
    );
    if (mapped) {
      const riskType = await tx.riskType.findFirst({
        where: {
          tenantId: input.tenantId,
          riskClassId: mapped.currentId,
          name: offer.className,
        },
      });
      if (riskType) return riskType.id;
    }

    let createdRiskClass = false;
    let riskClass = await tx.riskClass.findFirst({
      where: {
        tenantId: input.tenantId,
        name: offer.className,
        archivedAt: null,
      },
    });
    if (!riskClass) {
      riskClass = await tx.riskClass.create({
        data: {
          tenantId: input.tenantId,
          name: offer.className,
          description: 'Imported from legacy iRisk class of business.',
          isActive: true,
          createdByUserId: input.importUserId,
          updatedByUserId: input.importUserId,
        },
      });
      created.riskClasses += 1;
      createdRiskClass = true;
    }
    await this.createMap(tx, input.tenantId, importRunId, {
      entityType: 'classofbusiness',
      legacyId: offer.classId,
      currentModel: 'RiskClass',
      currentId: riskClass.id,
      rawHash: sha256(offer.source.classofbusiness),
      createdByImport: createdRiskClass,
    });

    let createdRiskType = false;
    let riskType = await tx.riskType.findFirst({
      where: {
        tenantId: input.tenantId,
        riskClassId: riskClass.id,
        name: offer.className,
      },
    });
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
    await this.createMap(tx, input.tenantId, importRunId, {
      entityType: 'risk_type',
      legacyId: offer.classId,
      currentModel: 'RiskType',
      currentId: riskType.id,
      rawHash: sha256({ classId: offer.classId, className: offer.className }),
      createdByImport: createdRiskType,
    });

    const allFields = uniqueFields([
      ...offer.businessFields,
      ...offer.offerFields,
    ]);
    for (const field of allFields) {
      const existingField = await tx.riskTypeField.findFirst({
        where: {
          tenantId: input.tenantId,
          riskTypeId: riskType.id,
          section: RiskTypeFieldSection.OFFER_DETAILS,
          fieldKey: field.normalizedKey,
        },
      });
      if (existingField) continue;
      const createdField = await tx.riskTypeField.create({
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
      });
      created.riskTypeFields += 1;
      await this.createMap(tx, input.tenantId, importRunId, {
        entityType: 'risk_type_field',
        legacyId: `${offer.classId}:${field.normalizedKey}`,
        currentModel: 'RiskTypeField',
        currentId: createdField.id,
        rawHash: sha256(field),
        createdByImport: true,
      });
    }
    return riskType.id;
  }

  private async ensureCedant(
    tx: LegacyImportPrisma,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    created: Record<string, number>,
  ) {
    return this.ensureCounterparty(tx, input, importRunId, {
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
    input: ApplyLegacyOffersInput,
    importRunId: string,
    participant: NormalizedLegacyParticipant,
    created: Record<string, number>,
  ) {
    return this.ensureCounterparty(tx, input, importRunId, {
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
        await this.createMap(tx, input.tenantId, importRunId, {
          entityType: 'counterparty_address',
          legacyId: counterpartyAddressLegacyId(args.entityType, args.legacyId),
          currentModel: 'CounterpartyAddress',
          currentId: address.id,
          rawHash: sha256(args.address),
          createdByImport: true,
        });
      }
    }
    await this.createMap(tx, input.tenantId, importRunId, {
      entityType: args.entityType,
      legacyId: args.legacyId,
      currentModel: 'Counterparty',
      currentId: counterparty.id,
      rawHash: sha256(args.raw),
      createdByImport: createdCounterparty,
    });
    return counterparty.id;
  }

  private async createPlacement(
    tx: LegacyImportPrisma,
    input: ApplyLegacyOffersInput,
    importRunId: string,
    offer: NormalizedLegacyOffer,
    riskTypeId: string,
    cedantId: string,
    created: Record<string, number>,
  ) {
    const existingMap = await this.findMap(
      tx,
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
        businessDetails: {
          legacy: {
            offerId: offer.offerId,
            policyNumber: offer.policyNumber,
            insuredBy: offer.title,
            classId: offer.classId,
            sourceSystem: LEGACY_SOURCE_SYSTEM,
          },
        },
        offerDetails: {
          legacyFields: Object.fromEntries(
            offer.offerFields.map((field) => [
              field.normalizedKey,
              field.value ?? null,
            ]),
          ),
        },
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
    await this.createMap(tx, input.tenantId, importRunId, {
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
    input: ApplyLegacyOffersInput,
    importRunId: string,
    placementId: string,
    participant: NormalizedLegacyParticipant,
    counterpartyId: string,
    created: Record<string, number>,
  ) {
    const existingMap = await this.findMap(
      tx,
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
    await this.createMap(tx, input.tenantId, importRunId, {
      entityType: 'offer_participant',
      legacyId: participant.participantId,
      currentModel: 'PlacementParticipant',
      currentId: row.id,
      rawHash: participant.rawHash,
      createdByImport: true,
    });
    return row.id;
  }

  private async findMap(
    tx: LegacyImportPrisma,
    tenantId: string,
    entityType: string,
    legacyId: string,
  ): Promise<LegacyImportMapRecord | null> {
    return tx.legacyImportMap.findUnique({
      where: {
        tenantId_sourceSystem_entityType_legacyId: {
          tenantId,
          sourceSystem: LEGACY_SOURCE_SYSTEM,
          entityType,
          legacyId,
        },
      },
    });
  }

  private async createMap(
    tx: LegacyImportPrisma,
    tenantId: string,
    importRunId: string,
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
  }
}

export type LegacyImportMapRecord = {
  currentId: string;
  currentModel: string;
  rawHash: string;
};

function uniqueFields(fields: Array<{ key: string; normalizedKey: string }>) {
  return [
    ...new Map(fields.map((field) => [field.normalizedKey, field])).values(),
  ];
}

function normalizeCounterpartyName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
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
    legacyImportRuns: 1,
    legacyImportMaps: 0,
  };
}
