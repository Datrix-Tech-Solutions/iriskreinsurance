import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClosingSnapshot,
  ClosingSnapshotReader,
} from './closings/closing-snapshot.reader';
import { EffectivePlacementViewResponseDto } from './dto/placement-effective-view-response.dto';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

type PlacementForEffectiveView = {
  id: string;
  reference: string;
  policyNumber: string | null;
  title: string;
  cedantId: string;
  riskTypeId: string | null;
  businessDetails: Prisma.JsonValue | null;
  offerDetails: Prisma.JsonValue | null;
  description: string | null;
  inceptionDate: Date | null;
  expiryDate: Date | null;
  currency: string | null;
  sumInsured: Prisma.Decimal | null;
  rate: Prisma.Decimal | null;
  premium: Prisma.Decimal | null;
  commission: Prisma.Decimal | null;
  facultativeOffer: Prisma.Decimal | null;
  preliminaryBrokerage: Prisma.Decimal | null;
};

type EndorsementForEffectiveView = {
  id: string;
  endorsementNumber: string;
  type: PlacementEndorsementType;
  impactType: PlacementEndorsementImpactType;
  status: PlacementEndorsementStatus;
  effectiveDate: Date;
  createdAt: Date;
  targetPercent: Prisma.Decimal | null;
  proposedSnapshot: Prisma.JsonValue | null;
  closings: Array<{
    id: string;
    closingNumber: string;
    status: PlacementClosingStatus;
    endorsementParticipantId: string;
    signedLinePercent: Prisma.Decimal;
    endorsementParticipant: {
      counterpartyId: string;
    };
  }>;
  participants: Array<{
    id: string;
    status: PlacementEndorsementParticipantStatus;
    signedLinePercent: Prisma.Decimal | null;
  }>;
};

type CounterpartySummary = {
  id: string;
  type: CounterpartyType;
  name: string;
  registrationNumber: string | null;
};

type MutableEffectiveTotals = {
  title: string;
  policyNumber: string | null;
  cedantId: string;
  riskTypeId: string | null;
  businessDetails: Prisma.JsonValue | null;
  offerDetails: Prisma.JsonValue | null;
  description: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  sumInsured: number | null;
  rate: number | null;
  premium: number | null;
  currency: string | null;
  commissionPercent: number | null;
  brokeragePercent: number | null;
  facultativeOfferPercent: number | null;
};

@Injectable()
export class PlacementEffectiveViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closingSnapshotReader: ClosingSnapshotReader,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async getEffectiveView(
    tenantId: string,
    placementId: string,
    asOfDate: Date | string = new Date(),
  ): Promise<EffectivePlacementViewResponseDto> {
    const viewAsOf = this.parseAsOfDate(asOfDate);
    return this.prisma.$transaction(async (tx) => {
      const placement = await this.findPlacement(tx, tenantId, placementId);
      const [placementSnapshots, endorsementSnapshots, endorsements] =
        await Promise.all([
          this.closingSnapshotReader.findConfirmedPlacementClosingSnapshots(
            tx,
            tenantId,
            placementId,
          ),
          this.closingSnapshotReader.findConfirmedEndorsementClosingSnapshots(
            tx,
            tenantId,
            placementId,
          ),
          this.findEndorsements(tx, tenantId, placementId),
        ]);

      const baseTotals = this.buildBaseTotals(placement);
      const appliedEndorsements = endorsements.filter((endorsement) =>
        this.isEffectiveEndorsement(endorsement, viewAsOf),
      );
      const scheduledEndorsements = endorsements.filter((endorsement) =>
        this.isScheduledEndorsement(endorsement, viewAsOf),
      );
      const appliedEndorsementClosingIds = new Set(
        appliedEndorsements.flatMap((endorsement) =>
          endorsement.closings
            .filter(
              (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
            )
            .map((closing) => closing.id),
        ),
      );
      const effectiveEndorsementSnapshots = endorsementSnapshots.filter(
        (snapshot) => appliedEndorsementClosingIds.has(snapshot.closingId),
      );
      const snapshots = this.composeEffectiveSnapshots(
        placementSnapshots,
        effectiveEndorsementSnapshots,
        appliedEndorsements,
      );
      const counterparties = await this.findCounterparties(
        tx,
        tenantId,
        snapshots.map((snapshot) => snapshot.counterpartyId),
      );
      const warnings = this.buildWarnings(placement, snapshots);
      if (
        appliedEndorsements.some(
          (endorsement) =>
            endorsement.closings.every(
              (closing) => closing.status !== PlacementClosingStatus.CONFIRMED,
            ) &&
            (endorsement.impactType ===
              PlacementEndorsementImpactType.TERMS_ONLY ||
              endorsement.impactType ===
                PlacementEndorsementImpactType.ADMINISTRATIVE),
        )
      ) {
        warnings.push(
          'Closed non-capacity endorsement terms are applied to the effective placement fields; closing-derived premium amounts remain based on confirmed closing snapshots.',
        );
      }
      const effectiveFinancials = this.applyEndorsementFinancialSnapshots(
        baseTotals,
        appliedEndorsements,
      );
      const effectiveParticipants = this.buildEffectiveParticipants(
        snapshots,
        counterparties,
      );
      const acceptedEndorsementCapacityPercent =
        this.sumAcceptedPendingEndorsementCapacity(
          endorsements,
          appliedEndorsements,
          viewAsOf,
        );
      const confirmedEndorsementCapacityPercent = this.money.roundMoney(
        effectiveEndorsementSnapshots.reduce(
          (total, snapshot) => total + snapshot.signedLinePercent,
          0,
        ),
      );
      const effectivePlacedPercent = this.money.roundMoney(
        effectiveParticipants.reduce(
          (total, participant) => total + participant.signedLinePercent,
          0,
        ),
      );
      const facultativeOfferPercent = this.resolveEffectiveCapacityPercent({
        effectiveFinancials,
        effectivePlacedPercent,
        hasConfirmedEndorsementClosings:
          effectiveEndorsementSnapshots.length > 0,
      });
      const remainingCapacityPercent = this.money.roundMoney(
        Math.max(0, facultativeOfferPercent - effectivePlacedPercent),
      );
      const snapshotCurrencyCodes = new Set(
        snapshots
          .map((snapshot) => snapshot.currency)
          .filter((currency): currency is string => Boolean(currency)),
      );

      if (snapshotCurrencyCodes.size > 1) {
        warnings.push(
          'Confirmed closing snapshots contain multiple currencies; effective financial totals should be reviewed.',
        );
      }

      return {
        viewAsOf: viewAsOf.toISOString(),
        basePlacement: {
          id: placement.id,
          reference: placement.reference,
          policyNumber: placement.policyNumber,
          title: placement.title,
          cedantId: placement.cedantId,
          currency: placement.currency,
          sumInsured: this.money.toOptionalNumber(placement.sumInsured),
          premium: this.money.toOptionalNumber(placement.premium),
          rate: this.money.toOptionalNumber(placement.rate),
          commissionPercent: this.money.toOptionalNumber(placement.commission),
          brokeragePercent: this.money.toOptionalNumber(
            placement.preliminaryBrokerage,
          ),
          facultativeOfferPercent: this.money.toOptionalNumber(
            placement.facultativeOffer,
          ),
        },
        effectiveTotals: {
          facultativeOfferPercent,
          originalFacultativeOfferPercent: this.money.toOptionalNumber(
            placement.facultativeOffer,
          ),
          acceptedEndorsementCapacityPercent,
          confirmedEndorsementCapacityPercent,
          remainingCapacityPercent,
          participantCount: effectiveParticipants.length,
          sumInsured: effectiveFinancials.sumInsured,
          premium: effectiveFinancials.premium,
          currency: effectiveFinancials.currency,
          rate: effectiveFinancials.rate,
          commissionPercent: effectiveFinancials.commissionPercent,
          brokeragePercent: effectiveFinancials.brokeragePercent,
          grossPremium: this.sumMoney(snapshots, 'premium'),
          commissionAmount: this.sumMoney(snapshots, 'commissionAmount'),
          brokerageAmount: this.sumMoney(snapshots, 'brokerageAmount'),
          netPremium: this.sumMoney(snapshots, 'netPremium'),
        },
        capacityBreakdown: {
          originalCapacityPercent: this.money.toOptionalNumber(
            placement.facultativeOffer,
          ),
          acceptedEndorsementCapacityPercent,
          confirmedEndorsementCapacityPercent,
          remainingCapacityPercent,
          effectiveTotalCapacityPercent: facultativeOfferPercent,
        },
        effectiveTerms: {
          title: effectiveFinancials.title,
          policyNumber: effectiveFinancials.policyNumber,
          cedantId: effectiveFinancials.cedantId,
          riskTypeId: effectiveFinancials.riskTypeId,
          businessDetails: this.toRecordOrNull(
            effectiveFinancials.businessDetails,
          ),
          offerDetails: this.toRecordOrNull(effectiveFinancials.offerDetails),
          description: effectiveFinancials.description,
          inceptionDate: effectiveFinancials.inceptionDate,
          expiryDate: effectiveFinancials.expiryDate,
          currency: effectiveFinancials.currency,
          sumInsured: effectiveFinancials.sumInsured,
          rate: effectiveFinancials.rate,
          premium: effectiveFinancials.premium,
          commissionPercent: effectiveFinancials.commissionPercent,
          brokeragePercent: effectiveFinancials.brokeragePercent,
          facultativeOfferPercent,
        },
        effectiveParticipants,
        appliedEndorsements: this.mapAppliedEndorsements(appliedEndorsements),
        scheduledEndorsements: this.mapEndorsementSummaries(
          scheduledEndorsements,
        ),
        pendingEndorsements: this.mapPendingEndorsements(
          endorsements,
          viewAsOf,
        ),
        warnings,
      };
    });
  }

  private async findPlacement(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<PlacementForEffectiveView> {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: {
        id: true,
        reference: true,
        policyNumber: true,
        title: true,
        cedantId: true,
        riskTypeId: true,
        businessDetails: true,
        offerDetails: true,
        description: true,
        inceptionDate: true,
        expiryDate: true,
        currency: true,
        sumInsured: true,
        rate: true,
        premium: true,
        commission: true,
        facultativeOffer: true,
        preliminaryBrokerage: true,
      },
    });

    if (!placement) {
      throw new NotFoundException('Placement not found');
    }
    return placement;
  }

  private async findEndorsements(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<EndorsementForEffectiveView[]> {
    return tx.placementEndorsement.findMany({
      where: { tenantId, placementId },
      select: {
        id: true,
        endorsementNumber: true,
        type: true,
        impactType: true,
        status: true,
        effectiveDate: true,
        createdAt: true,
        targetPercent: true,
        proposedSnapshot: true,
        closings: {
          select: {
            id: true,
            closingNumber: true,
            status: true,
            endorsementParticipantId: true,
            signedLinePercent: true,
            endorsementParticipant: {
              select: { counterpartyId: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        participants: {
          select: {
            id: true,
            status: true,
            signedLinePercent: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private async findCounterparties(
    tx: Prisma.TransactionClient,
    tenantId: string,
    counterpartyIds: string[],
  ): Promise<Map<string, CounterpartySummary>> {
    const uniqueIds = [...new Set(counterpartyIds)];
    if (uniqueIds.length === 0) return new Map();

    const counterparties = await tx.counterparty.findMany({
      where: { tenantId, id: { in: uniqueIds } },
      select: {
        id: true,
        type: true,
        name: true,
        registrationNumber: true,
      },
    });

    return new Map(
      counterparties.map((counterparty) => [counterparty.id, counterparty]),
    );
  }

  private buildBaseTotals(
    placement: PlacementForEffectiveView,
  ): MutableEffectiveTotals {
    return {
      title: placement.title,
      policyNumber: placement.policyNumber,
      cedantId: placement.cedantId,
      riskTypeId: placement.riskTypeId,
      businessDetails: placement.businessDetails,
      offerDetails: placement.offerDetails,
      description: placement.description,
      inceptionDate: this.toIsoStringOrNull(placement.inceptionDate),
      expiryDate: this.toIsoStringOrNull(placement.expiryDate),
      sumInsured: this.money.toOptionalNumber(placement.sumInsured),
      rate: this.money.toOptionalNumber(placement.rate),
      premium: this.money.toOptionalNumber(placement.premium),
      currency: placement.currency,
      commissionPercent: this.money.toOptionalNumber(placement.commission),
      brokeragePercent: this.money.toOptionalNumber(
        placement.preliminaryBrokerage,
      ),
      facultativeOfferPercent: this.money.toOptionalNumber(
        placement.facultativeOffer,
      ),
    };
  }

  private applyEndorsementFinancialSnapshots(
    baseTotals: MutableEffectiveTotals,
    endorsements: EndorsementForEffectiveView[],
  ): MutableEffectiveTotals {
    return endorsements.reduce<MutableEffectiveTotals>(
      (current, endorsement) => {
        const proposed = this.asRecord(endorsement.proposedSnapshot);
        const proposedPlacement = this.asRecord(proposed.placement);

        return {
          title:
            this.firstString(
              proposed.title,
              proposedPlacement.title,
              current.title,
            ) ?? current.title,
          policyNumber:
            this.firstNullableString(
              proposed.policyNumber,
              proposedPlacement.policyNumber,
              current.policyNumber,
            ) ?? current.policyNumber,
          cedantId:
            this.firstString(
              proposed.cedantId,
              proposedPlacement.cedantId,
              current.cedantId,
            ) ?? current.cedantId,
          riskTypeId: this.firstNullableString(
            proposed.riskTypeId,
            proposedPlacement.riskTypeId,
            current.riskTypeId,
          ),
          businessDetails: this.firstJsonValue(
            proposed.businessDetails,
            proposedPlacement.businessDetails,
            current.businessDetails,
          ),
          offerDetails: this.firstJsonValue(
            proposed.offerDetails,
            proposedPlacement.offerDetails,
            current.offerDetails,
          ),
          description: this.firstNullableString(
            proposed.description,
            proposedPlacement.description,
            current.description,
          ),
          inceptionDate: this.firstDateIsoString(
            proposed.inceptionDate,
            proposedPlacement.inceptionDate,
            current.inceptionDate,
          ),
          expiryDate: this.firstDateIsoString(
            proposed.expiryDate,
            proposedPlacement.expiryDate,
            current.expiryDate,
          ),
          sumInsured: this.firstOptionalNumber(
            proposed.sumInsured,
            proposedPlacement.sumInsured,
            current.sumInsured,
          ),
          rate: this.firstOptionalNumber(
            proposed.rate,
            proposedPlacement.rate,
            current.rate,
          ),
          premium: this.firstOptionalNumber(
            proposed.premium,
            proposedPlacement.premium,
            current.premium,
          ),
          currency: this.firstString(
            proposed.currency,
            proposedPlacement.currency,
            current.currency,
          ),
          commissionPercent: this.firstOptionalNumber(
            proposed.commission,
            proposedPlacement.commission,
            current.commissionPercent,
          ),
          brokeragePercent: this.firstOptionalNumber(
            proposed.brokeragePercent,
            proposed.preliminaryBrokerage,
            proposedPlacement.brokeragePercent,
            proposedPlacement.preliminaryBrokerage,
            current.brokeragePercent,
          ),
          facultativeOfferPercent: this.firstOptionalNumber(
            proposed.facultativeOffer,
            proposedPlacement.facultativeOffer,
            current.facultativeOfferPercent,
          ),
        };
      },
      baseTotals,
    );
  }

  private resolveEffectiveCapacityPercent(input: {
    effectiveFinancials: MutableEffectiveTotals;
    effectivePlacedPercent: number;
    hasConfirmedEndorsementClosings: boolean;
  }): number {
    if (input.hasConfirmedEndorsementClosings) {
      return this.money.roundMoney(input.effectivePlacedPercent);
    }

    return this.money.roundMoney(
      input.effectiveFinancials.facultativeOfferPercent ??
        input.effectivePlacedPercent,
    );
  }

  private composeEffectiveSnapshots(
    placementSnapshots: ClosingSnapshot[],
    endorsementSnapshots: ClosingSnapshot[],
    endorsements: EndorsementForEffectiveView[],
  ): ClosingSnapshot[] {
    let effectiveSnapshots = [...placementSnapshots];
    const endorsementSnapshotByClosingId = new Map(
      endorsementSnapshots.map((snapshot) => [snapshot.closingId, snapshot]),
    );

    for (const endorsement of endorsements) {
      for (const closing of endorsement.closings) {
        if (closing.status !== PlacementClosingStatus.CONFIRMED) continue;
        const snapshot = endorsementSnapshotByClosingId.get(closing.id);
        if (!snapshot) continue;

        if (snapshot.originalParticipantId) {
          effectiveSnapshots = effectiveSnapshots.filter(
            (current) =>
              current.participantId !== snapshot.originalParticipantId &&
              current.originalParticipantId !== snapshot.originalParticipantId,
          );
        } else if (snapshot.sourceType === 'ENDORSEMENT_CLOSING') {
          effectiveSnapshots = effectiveSnapshots.filter(
            (current) => current.counterpartyId !== snapshot.counterpartyId,
          );
        }
        effectiveSnapshots.push(snapshot);
      }
    }

    return effectiveSnapshots;
  }

  private buildEffectiveParticipants(
    snapshots: ClosingSnapshot[],
    counterparties: Map<string, CounterpartySummary>,
  ) {
    const byCounterparty = new Map<
      string,
      {
        counterpartyId: string;
        counterparty: CounterpartySummary;
        signedLinePercent: number;
        grossPremium: number;
        commissionAmount: number;
        brokerageAmount: number;
        netPremium: number;
        sources: Array<{
          sourceType: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';
          closingId: string;
          endorsementId?: string;
          participantId?: string;
          endorsementParticipantId?: string;
          originalParticipantId?: string | null;
          signedLinePercent: number;
        }>;
      }
    >();

    for (const snapshot of snapshots) {
      const counterparty = counterparties.get(snapshot.counterpartyId) ?? {
        id: snapshot.counterpartyId,
        type: CounterpartyType.REINSURER,
        name: 'Unknown reinsurer',
        registrationNumber: null,
      };
      const existing = byCounterparty.get(snapshot.counterpartyId) ?? {
        counterpartyId: snapshot.counterpartyId,
        counterparty,
        signedLinePercent: 0,
        grossPremium: 0,
        commissionAmount: 0,
        brokerageAmount: 0,
        netPremium: 0,
        sources: [],
      };

      existing.signedLinePercent += snapshot.signedLinePercent;
      existing.grossPremium += snapshot.premium ?? 0;
      existing.commissionAmount += snapshot.commissionAmount ?? 0;
      existing.brokerageAmount += snapshot.brokerageAmount ?? 0;
      existing.netPremium += snapshot.netPremium ?? 0;
      existing.sources.push({
        sourceType: snapshot.sourceType,
        closingId: snapshot.closingId,
        ...(snapshot.endorsementId
          ? { endorsementId: snapshot.endorsementId }
          : {}),
        ...(snapshot.participantId
          ? { participantId: snapshot.participantId }
          : {}),
        ...(snapshot.endorsementParticipantId
          ? { endorsementParticipantId: snapshot.endorsementParticipantId }
          : {}),
        ...(snapshot.originalParticipantId
          ? { originalParticipantId: snapshot.originalParticipantId }
          : {}),
        signedLinePercent: this.money.roundMoney(snapshot.signedLinePercent),
      });
      byCounterparty.set(snapshot.counterpartyId, existing);
    }

    return [...byCounterparty.values()]
      .map((participant) => ({
        ...participant,
        participationType: this.deriveParticipationType(participant.sources),
        signedLinePercent: this.money.roundMoney(participant.signedLinePercent),
        grossPremium: this.money.roundMoney(participant.grossPremium),
        commissionAmount: this.money.roundMoney(participant.commissionAmount),
        brokerageAmount: this.money.roundMoney(participant.brokerageAmount),
        netPremium: this.money.roundMoney(participant.netPremium),
      }))
      .sort((a, b) => a.counterparty.name.localeCompare(b.counterparty.name));
  }

  private deriveParticipationType(
    sources: Array<{
      sourceType: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';
      originalParticipantId?: string | null;
    }>,
  ): 'ORIGINAL' | 'REVISED' | 'ADDED' {
    const endorsementSource = sources.find(
      (source) => source.sourceType === 'ENDORSEMENT_CLOSING',
    );
    if (!endorsementSource) return 'ORIGINAL';
    return endorsementSource.originalParticipantId ? 'REVISED' : 'ADDED';
  }

  private sumAcceptedPendingEndorsementCapacity(
    endorsements: EndorsementForEffectiveView[],
    appliedEndorsements: EndorsementForEffectiveView[],
    asOfDate: Date,
  ): number {
    const appliedIds = new Set(
      appliedEndorsements.map((endorsement) => endorsement.id),
    );
    const acceptedStatuses = new Set<PlacementEndorsementParticipantStatus>([
      PlacementEndorsementParticipantStatus.ACCEPTED,
      PlacementEndorsementParticipantStatus.CLOSED,
    ]);
    return this.money.roundMoney(
      endorsements
        .filter(
          (endorsement) =>
            !appliedIds.has(endorsement.id) &&
            endorsement.status !== PlacementEndorsementStatus.VOID &&
            endorsement.status !== PlacementEndorsementStatus.DECLINED,
        )
        .filter(
          (endorsement) => !this.isScheduledEndorsement(endorsement, asOfDate),
        )
        .flatMap((endorsement) => endorsement.participants)
        .filter((participant) => acceptedStatuses.has(participant.status))
        .reduce(
          (total, participant) =>
            total +
            (this.money.toOptionalNumber(participant.signedLinePercent) ?? 0),
          0,
        ),
    );
  }

  private mapAppliedEndorsements(endorsements: EndorsementForEffectiveView[]) {
    return endorsements.map((endorsement) => ({
      id: endorsement.id,
      endorsementNumber: endorsement.endorsementNumber,
      type: endorsement.type,
      status: endorsement.status,
      effectiveDate: endorsement.effectiveDate.toISOString(),
      targetPercent: this.money.toOptionalNumber(endorsement.targetPercent),
      confirmedClosings: endorsement.closings
        .filter(
          (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
        )
        .map((closing) => ({
          id: closing.id,
          closingNumber: closing.closingNumber,
          endorsementParticipantId: closing.endorsementParticipantId,
          counterpartyId: closing.endorsementParticipant.counterpartyId,
          signedLinePercent: this.money.toNumber(closing.signedLinePercent),
        })),
    }));
  }

  private isEffectiveEndorsement(
    endorsement: EndorsementForEffectiveView,
    asOfDate: Date,
  ): boolean {
    if (
      endorsement.status !== PlacementEndorsementStatus.CLOSED ||
      endorsement.effectiveDate.getTime() > asOfDate.getTime()
    ) {
      return false;
    }
    if (
      endorsement.status === PlacementEndorsementStatus.CLOSED &&
      (endorsement.impactType === PlacementEndorsementImpactType.TERMS_ONLY ||
        endorsement.impactType ===
          PlacementEndorsementImpactType.ADMINISTRATIVE)
    ) {
      return true;
    }
    return endorsement.closings.some(
      (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
    );
  }

  private isScheduledEndorsement(
    endorsement: EndorsementForEffectiveView,
    asOfDate: Date,
  ): boolean {
    return (
      endorsement.status === PlacementEndorsementStatus.CLOSED &&
      endorsement.effectiveDate.getTime() > asOfDate.getTime()
    );
  }

  private mapEndorsementSummaries(endorsements: EndorsementForEffectiveView[]) {
    return endorsements.map((endorsement) => ({
      id: endorsement.id,
      endorsementNumber: endorsement.endorsementNumber,
      type: endorsement.type,
      status: endorsement.status,
      effectiveDate: endorsement.effectiveDate.toISOString(),
      targetPercent: this.money.toOptionalNumber(endorsement.targetPercent),
      confirmedClosingCount: endorsement.closings.filter(
        (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
      ).length,
    }));
  }

  private mapPendingEndorsements(
    endorsements: EndorsementForEffectiveView[],
    asOfDate: Date,
  ) {
    return endorsements
      .filter(
        (endorsement) =>
          endorsement.status !== PlacementEndorsementStatus.VOID &&
          endorsement.status !== PlacementEndorsementStatus.DECLINED &&
          !this.isScheduledEndorsement(endorsement, asOfDate) &&
          !this.isEffectiveEndorsement(endorsement, asOfDate),
      )
      .map((endorsement) => ({
        ...this.mapEndorsementSummaries([endorsement])[0],
        confirmedClosingCount: 0,
      }));
  }

  private buildWarnings(
    placement: PlacementForEffectiveView,
    snapshots: ClosingSnapshot[],
  ): string[] {
    const warnings: string[] = [];
    if (snapshots.length === 0) {
      warnings.push(
        'No confirmed placement or endorsement closings were found for this placement.',
      );
    }
    if (!placement.sumInsured) {
      warnings.push('Placement sum insured is not available.');
    }
    if (!placement.premium) {
      warnings.push('Placement premium is not available.');
    }
    if (snapshots.some((snapshot) => snapshot.premium === null)) {
      warnings.push(
        'Some confirmed closing snapshots do not include premium values.',
      );
    }
    return warnings;
  }

  private sumMoney(
    snapshots: ClosingSnapshot[],
    field: 'premium' | 'commissionAmount' | 'brokerageAmount' | 'netPremium',
  ): number {
    return this.money.roundMoney(
      snapshots.reduce((total, snapshot) => total + (snapshot[field] ?? 0), 0),
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private firstOptionalNumber(...values: Array<unknown>): number | null {
    for (const value of values) {
      const parsed = this.money.toOptionalNumber(
        value as Prisma.Decimal | number | string | null | undefined,
      );
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private firstString(...values: Array<unknown>): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }

  private firstNullableString(...values: Array<unknown>): string | null {
    for (const value of values) {
      if (value === null) return null;
      if (typeof value === 'string') {
        const cleaned = value.trim();
        return cleaned.length > 0 ? cleaned : null;
      }
    }
    return null;
  }

  private firstDateIsoString(...values: Array<unknown>): string | null {
    for (const value of values) {
      if (value === null) return null;
      const iso = this.toIsoStringOrNull(value);
      if (iso) return iso;
    }
    return null;
  }

  private firstJsonValue(...values: Array<unknown>): Prisma.JsonValue | null {
    for (const value of values) {
      if (value === undefined) continue;
      return value === null ? null : (value as Prisma.JsonValue);
    }
    return null;
  }

  private toIsoStringOrNull(value: unknown): string | null {
    if (!value) return null;
    if (
      !(value instanceof Date) &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private toRecordOrNull(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private parseAsOfDate(value: Date | string): Date {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid effective view asOfDate');
    }
    return date;
  }
}
