import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementEndorsement,
  PlacementEndorsementImpactType,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlacementEndorsementDto } from '../dto/create-placement-endorsement.dto';
import { PlacementEndorsementSummaryResponseDto } from '../dto/placement-endorsement-summary-response.dto';
import { EffectivePlacementViewResponseDto } from '../dto/placement-effective-view-response.dto';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import { UpdatePlacementEndorsementStatusDto } from '../dto/update-placement-endorsement-status.dto';
import { UpdatePlacementEndorsementDto } from '../dto/update-placement-endorsement.dto';

type PlacementEndorsementRecord = PlacementEndorsement;

type CloseBlockingReason = {
  code: string;
  message: string;
};

const endorsementSummaryInclude = {
  participants: {
    select: {
      id: true,
      status: true,
      signedLinePercent: true,
    },
  },
  closings: {
    select: {
      id: true,
      endorsementParticipantId: true,
      status: true,
      signedLinePercent: true,
    },
  },
  notes: {
    select: {
      id: true,
      type: true,
      status: true,
      endorsementClosingId: true,
    },
  },
} satisfies Prisma.PlacementEndorsementInclude;

type PlacementEndorsementSummaryRecord = Prisma.PlacementEndorsementGetPayload<{
  include: typeof endorsementSummaryInclude;
}>;

type PlacementSnapshotRecord = Prisma.PlacementGetPayload<{
  include: {
    participants: {
      select: {
        id: true;
        counterpartyId: true;
        role: true;
        status: true;
        sharePercent: true;
        signedLinePercent: true;
        brokerageFee: true;
        notes: true;
      };
    };
    closings: {
      select: {
        id: true;
        participantId: true;
        closingNumber: true;
        status: true;
        signedLinePercent: true;
        sharePercent: true;
        grossPremium: true;
        commissionPercent: true;
        commissionAmount: true;
        brokeragePercent: true;
        brokerageAmount: true;
        netPremium: true;
        currency: true;
        issuedAt: true;
        confirmedAt: true;
      };
    };
    payments: {
      select: {
        id: true;
        type: true;
        direction: true;
        amount: true;
        currency: true;
        status: true;
        paymentDate: true;
        counterpartyId: true;
        closingId: true;
        participantId: true;
      };
    };
    notes: {
      select: {
        id: true;
        type: true;
        direction: true;
        noteNumber: true;
        status: true;
        grossAmount: true;
        netAmount: true;
        currency: true;
        closingId: true;
        participantId: true;
        counterpartyId: true;
      };
    };
  };
}>;

@Injectable()
export class PlacementEndorsementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectiveViewService: PlacementEffectiveViewService,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementEndorsementRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementEndorsement.findMany({
      where: { tenantId, placementId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementEndorsementRecord> {
    await this.assertPlacement(tenantId, placementId);
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: { id: endorsementId, tenantId, placementId },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }
    return endorsement;
  }

  async getSummary(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementEndorsementSummaryResponseDto> {
    await this.assertPlacement(tenantId, placementId);
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: { id: endorsementId, tenantId, placementId },
      include: endorsementSummaryInclude,
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }

    return this.buildSummary(endorsement);
  }

  async create(
    user: RequestUser,
    placementId: string,
    dto: CreatePlacementEndorsementDto,
  ): Promise<PlacementEndorsementRecord> {
    const placement = await this.findPlacementSnapshot(
      user.tenantId,
      placementId,
    );
    const effectiveBaseline = await this.effectiveViewService.getEffectiveView(
      user.tenantId,
      placementId,
      new Date(dto.effectiveDate),
    );
    const originalSnapshot = this.buildEffectiveOriginalSnapshot(
      placement,
      effectiveBaseline,
    );

    return this.prisma.$transaction(async (tx) => {
      const endorsementNumber = await this.nextEndorsementNumber(
        tx,
        user.tenantId,
        placementId,
      );

      return tx.placementEndorsement.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementNumber,
          type: dto.type,
          impactType: this.deriveValidatedImpactType({
            requestedImpactType: dto.impactType,
            type: dto.type,
            originalSnapshot,
            proposedSnapshot: dto.proposedSnapshot,
            targetPercent: dto.targetPercent,
          }),
          status: PlacementEndorsementStatus.DRAFT,
          effectiveDate: new Date(dto.effectiveDate),
          reason: this.cleanRequired(dto.reason, 'Reason is required'),
          description: this.cleanOptional(dto.description),
          changeSummary: this.toJsonInput(dto.changeSummary),
          originalSnapshot: this.toJsonInput(originalSnapshot)!,
          proposedSnapshot: this.toJsonInput(dto.proposedSnapshot),
          targetPercent: this.toDecimalInput(dto.targetPercent),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    });
  }

  private buildSummary(
    endorsement: PlacementEndorsementSummaryRecord,
  ): PlacementEndorsementSummaryResponseDto {
    const acceptedStatuses: PlacementEndorsementParticipantStatus[] = [
      PlacementEndorsementParticipantStatus.ACCEPTED,
      PlacementEndorsementParticipantStatus.CLOSED,
    ];
    const acceptedParticipants = endorsement.participants.filter(
      (participant) => acceptedStatuses.includes(participant.status),
    );
    const declinedParticipants = endorsement.participants.filter(
      (participant) =>
        participant.status === PlacementEndorsementParticipantStatus.DECLINED,
    );
    const pendingParticipantStatuses: PlacementEndorsementParticipantStatus[] =
      [
        PlacementEndorsementParticipantStatus.INVITED,
        PlacementEndorsementParticipantStatus.OFFER_SENT,
        PlacementEndorsementParticipantStatus.QUOTED,
      ];
    const pendingParticipants = endorsement.participants.filter((participant) =>
      pendingParticipantStatuses.includes(participant.status),
    );
    const acceptedPercent = acceptedParticipants.reduce(
      (sum, participant) =>
        sum + (this.toOptionalNumber(participant.signedLinePercent) ?? 0),
      0,
    );
    const targetPercent = this.toOptionalNumber(endorsement.targetPercent);

    const activeClosings = endorsement.closings.filter(
      (closing) => closing.status !== PlacementClosingStatus.VOID,
    );
    const confirmedClosings = endorsement.closings.filter(
      (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
    );
    const activeConfirmedClosings = confirmedClosings.filter((closing) =>
      activeClosings.some((activeClosing) => activeClosing.id === closing.id),
    );
    const placedPercent = activeConfirmedClosings.reduce(
      (sum, closing) =>
        sum + (this.toOptionalNumber(closing.signedLinePercent) ?? 0),
      0,
    );
    const remainingPercent =
      targetPercent === null
        ? null
        : Math.max(0, targetPercent - placedPercent);
    const acceptedRemainingPercent =
      targetPercent === null
        ? null
        : Math.max(0, targetPercent - acceptedPercent);
    const activeClosingParticipantIds = new Set(
      activeClosings.map((closing) => closing.endorsementParticipantId),
    );
    const confirmedClosingParticipantIds = new Set(
      activeConfirmedClosings.map(
        (closing) => closing.endorsementParticipantId,
      ),
    );
    const acceptedWithoutActiveClosing = acceptedParticipants.filter(
      (participant) => !activeClosingParticipantIds.has(participant.id),
    );
    const acceptedWithoutConfirmedClosing = acceptedParticipants.filter(
      (participant) => !confirmedClosingParticipantIds.has(participant.id),
    );

    const pendingActions = new Set<string>();
    if (endorsement.status === PlacementEndorsementStatus.DRAFT) {
      pendingActions.add('SEND_TO_MARKET');
    }
    if (acceptedRemainingPercent !== null && acceptedRemainingPercent > 0) {
      pendingActions.add('ADD_CAPACITY');
    }
    if (
      pendingParticipants.length > 0 &&
      (acceptedRemainingPercent === null || acceptedRemainingPercent > 0)
    ) {
      pendingActions.add('ACCEPT_PARTICIPANTS');
    }
    if (acceptedWithoutActiveClosing.length > 0) {
      pendingActions.add('CREATE_CLOSING');
    }
    if (
      endorsement.closings.some(
        (closing) => closing.status === PlacementClosingStatus.DRAFT,
      )
    ) {
      pendingActions.add('ISSUE_CLOSING');
    }
    if (
      endorsement.closings.some(
        (closing) => closing.status === PlacementClosingStatus.ISSUED,
      )
    ) {
      pendingActions.add('CONFIRM_CLOSING');
    }
    const terminalStatuses: PlacementEndorsementStatus[] = [
      PlacementEndorsementStatus.CLOSED,
      PlacementEndorsementStatus.DECLINED,
      PlacementEndorsementStatus.VOID,
    ];
    const closeBlockingReasons = this.evaluateCloseReadiness({
      endorsement,
      pendingActions,
      acceptedWithoutConfirmedClosing,
      activeClosings,
      activeConfirmedClosings,
      terminalStatuses,
    });
    const canClose = closeBlockingReasons.length === 0;

    if (canClose && !terminalStatuses.includes(endorsement.status)) {
      pendingActions.add('CLOSE_ENDORSEMENT');
    }

    return {
      id: endorsement.id,
      placementId: endorsement.placementId,
      endorsementNumber: endorsement.endorsementNumber,
      type: endorsement.type,
      impactType: endorsement.impactType,
      status: endorsement.status,
      effectiveDate: endorsement.effectiveDate.toISOString(),
      targetPercent,
      acceptedPercent,
      placedPercent,
      remainingPercent,
      participants: {
        total: endorsement.participants.length,
        accepted: acceptedParticipants.length,
        declined: declinedParticipants.length,
      },
      closings: {
        total: endorsement.closings.length,
        confirmed: confirmedClosings.length,
        draft: endorsement.closings.filter(
          (closing) => closing.status === PlacementClosingStatus.DRAFT,
        ).length,
        issued: endorsement.closings.filter(
          (closing) => closing.status === PlacementClosingStatus.ISSUED,
        ).length,
        void: endorsement.closings.filter(
          (closing) => closing.status === PlacementClosingStatus.VOID,
        ).length,
      },
      notes: {
        total: endorsement.notes.length,
        endorsementDebitNotes: endorsement.notes.filter(
          (note) => note.type === PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        ).length,
        endorsementCreditNotes: endorsement.notes.filter(
          (note) => note.type === PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        ).length,
        issued: endorsement.notes.filter(
          (note) => note.status === PlacementNoteStatus.ISSUED,
        ).length,
        draft: endorsement.notes.filter(
          (note) => note.status === PlacementNoteStatus.DRAFT,
        ).length,
        void: endorsement.notes.filter(
          (note) => note.status === PlacementNoteStatus.VOID,
        ).length,
      },
      pendingActions: Array.from(pendingActions),
      canClose,
      closeBlockingReasons,
      isComplete:
        endorsement.status === PlacementEndorsementStatus.CLOSED &&
        (remainingPercent === null || remainingPercent === 0) &&
        acceptedWithoutConfirmedClosing.length === 0 &&
        closeBlockingReasons.length === 0,
    };
  }

  private evaluateCloseReadiness({
    endorsement,
    pendingActions,
    acceptedWithoutConfirmedClosing,
    activeClosings,
    activeConfirmedClosings,
    terminalStatuses,
  }: {
    endorsement: PlacementEndorsementSummaryRecord;
    pendingActions: Set<string>;
    acceptedWithoutConfirmedClosing: Array<{ id: string }>;
    activeClosings: Array<{
      id: string;
      endorsementParticipantId: string;
      status: PlacementClosingStatus;
    }>;
    activeConfirmedClosings: Array<{
      id: string;
      endorsementParticipantId: string;
      status: PlacementClosingStatus;
    }>;
    terminalStatuses: PlacementEndorsementStatus[];
  }): CloseBlockingReason[] {
    const reasons: CloseBlockingReason[] = [];
    const addReason = (code: string, message: string) => {
      if (!reasons.some((reason) => reason.code === code)) {
        reasons.push({ code, message });
      }
    };

    if (endorsement.status === PlacementEndorsementStatus.CLOSED) {
      return reasons;
    }
    if (terminalStatuses.includes(endorsement.status)) {
      addReason(
        'TERMINAL_ENDORSEMENT_STATUS',
        'This endorsement is already terminal and cannot be closed.',
      );
    }
    if (endorsement.status === PlacementEndorsementStatus.DRAFT) {
      addReason(
        'ENDORSEMENT_NOT_MARKETED',
        'Send the endorsement to market before closing it.',
      );
    }

    if (acceptedWithoutConfirmedClosing.length > 0) {
      addReason(
        'ACCEPTED_PARTICIPANT_NOT_VALIDATED',
        'One or more accepted endorsement participants still require confirmed closings.',
      );
    }
    if (pendingActions.has('ADD_CAPACITY')) {
      addReason(
        'CAPACITY_NOT_FULLY_ACCEPTED',
        'The endorsement capacity has not been fully accepted.',
      );
    }
    if (pendingActions.has('ACCEPT_PARTICIPANTS')) {
      addReason(
        'PARTICIPANTS_PENDING_RESPONSE',
        'One or more endorsement participants are still awaiting a final response.',
      );
    }
    if (
      activeClosings.some(
        (closing) => closing.status === PlacementClosingStatus.DRAFT,
      )
    ) {
      addReason('DRAFT_CLOSING', 'One endorsement closing is still in draft.');
    }
    if (
      activeClosings.some(
        (closing) => closing.status === PlacementClosingStatus.ISSUED,
      )
    ) {
      addReason(
        'UNCONFIRMED_CLOSING',
        'One endorsement closing has been issued but not confirmed.',
      );
    }
    if (this.hasDuplicateActiveClosings(activeClosings)) {
      addReason(
        'DUPLICATE_ACTIVE_CLOSING',
        'A participant has more than one active endorsement closing.',
      );
    }
    if (
      activeConfirmedClosings.length === 0 &&
      endorsement.impactType !== PlacementEndorsementImpactType.TERMS_ONLY &&
      endorsement.impactType !== PlacementEndorsementImpactType.ADMINISTRATIVE
    ) {
      addReason(
        'NO_CONFIRMED_ENDORSEMENT_CLOSING',
        'At least one confirmed endorsement closing is required before closing.',
      );
    }

    return reasons;
  }

  private hasDuplicateActiveClosings(
    activeClosings: Array<{ endorsementParticipantId: string }>,
  ): boolean {
    const counts = new Map<string, number>();
    for (const closing of activeClosings) {
      const count = (counts.get(closing.endorsementParticipantId) ?? 0) + 1;
      if (count > 1) return true;
      counts.set(closing.endorsementParticipantId, count);
    }
    return false;
  }

  async update(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    dto: UpdatePlacementEndorsementDto,
  ): Promise<PlacementEndorsementRecord> {
    const endorsement = await this.findOne(
      user.tenantId,
      placementId,
      endorsementId,
    );
    this.assertEditable(endorsement);
    const nextType = dto.type ?? endorsement.type;
    const nextProposedSnapshot =
      dto.proposedSnapshot !== undefined
        ? dto.proposedSnapshot
        : this.asRecord(endorsement.proposedSnapshot);
    const nextTargetPercent =
      dto.targetPercent !== undefined
        ? dto.targetPercent
        : this.toOptionalNumber(endorsement.targetPercent);

    return this.prisma.placementEndorsement.update({
      where: { id: endorsementId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.type !== undefined ||
        dto.proposedSnapshot !== undefined ||
        dto.targetPercent !== undefined ||
        dto.impactType !== undefined
          ? {
              impactType: this.deriveValidatedImpactType({
                requestedImpactType: dto.impactType,
                type: nextType,
                originalSnapshot: this.asRecord(endorsement.originalSnapshot),
                proposedSnapshot: nextProposedSnapshot,
                targetPercent: nextTargetPercent ?? undefined,
              }),
            }
          : {}),
        ...(dto.effectiveDate !== undefined
          ? { effectiveDate: new Date(dto.effectiveDate) }
          : {}),
        ...(dto.reason !== undefined
          ? { reason: this.cleanRequired(dto.reason, 'Reason is required') }
          : {}),
        ...(dto.description !== undefined
          ? { description: this.cleanOptional(dto.description) }
          : {}),
        ...(dto.changeSummary !== undefined
          ? { changeSummary: this.toJsonInput(dto.changeSummary) }
          : {}),
        ...(dto.proposedSnapshot !== undefined
          ? { proposedSnapshot: this.toJsonInput(dto.proposedSnapshot) }
          : {}),
        ...(dto.targetPercent !== undefined
          ? { targetPercent: this.toDecimalInput(dto.targetPercent) }
          : {}),
        updatedByUserId: user.id,
      },
    });
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    dto: UpdatePlacementEndorsementStatusDto,
  ): Promise<PlacementEndorsementRecord> {
    const endorsement = await this.findOne(
      user.tenantId,
      placementId,
      endorsementId,
    );
    if (endorsement.status === dto.status) return endorsement;

    if (dto.status === PlacementEndorsementStatus.CLOSED) {
      const summary = await this.getSummary(
        user.tenantId,
        placementId,
        endorsementId,
      );
      if (!summary.canClose) {
        throw new ConflictException(
          `Endorsement is not ready to close. ${summary.closeBlockingReasons
            .map((reason) => reason.message)
            .join(' ')}`,
        );
      }
    } else {
      this.assertTransition(endorsement.status, dto.status);
    }

    return this.prisma.placementEndorsement.update({
      where: { id: endorsementId },
      data: {
        status: dto.status,
        ...(dto.status === PlacementEndorsementStatus.CLOSED
          ? { closedAt: new Date() }
          : {}),
        ...(dto.status === PlacementEndorsementStatus.VOID
          ? { voidedAt: new Date() }
          : {}),
        updatedByUserId: user.id,
      },
    });
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');
  }

  private async findPlacementSnapshot(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementSnapshotRecord> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      include: {
        participants: {
          select: {
            id: true,
            counterpartyId: true,
            role: true,
            status: true,
            sharePercent: true,
            signedLinePercent: true,
            brokerageFee: true,
            notes: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        closings: {
          select: {
            id: true,
            participantId: true,
            closingNumber: true,
            status: true,
            signedLinePercent: true,
            sharePercent: true,
            grossPremium: true,
            commissionPercent: true,
            commissionAmount: true,
            brokeragePercent: true,
            brokerageAmount: true,
            netPremium: true,
            currency: true,
            issuedAt: true,
            confirmedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          select: {
            id: true,
            type: true,
            direction: true,
            amount: true,
            currency: true,
            status: true,
            paymentDate: true,
            counterpartyId: true,
            closingId: true,
            participantId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        notes: {
          select: {
            id: true,
            type: true,
            direction: true,
            noteNumber: true,
            status: true,
            grossAmount: true,
            netAmount: true,
            currency: true,
            closingId: true,
            participantId: true,
            counterpartyId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');
    if (placement.closings.length === 0) {
      throw new BadRequestException(
        'At least one placement closing is required before creating an endorsement',
      );
    }
    return placement;
  }

  private async nextEndorsementNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<string> {
    const count = await tx.placementEndorsement.count({
      where: { tenantId, placementId },
    });
    return `END-${String(count + 1).padStart(3, '0')}`;
  }

  private buildOriginalSnapshot(placement: PlacementSnapshotRecord) {
    return this.toPlainJson({
      placement: {
        id: placement.id,
        reference: placement.reference,
        title: placement.title,
        placementType: placement.placementType,
        status: placement.status,
        cedantId: placement.cedantId,
        riskTypeId: placement.riskTypeId,
        businessDetails: placement.businessDetails,
        offerDetails: placement.offerDetails,
        description: placement.description,
        inceptionDate: placement.inceptionDate,
        expiryDate: placement.expiryDate,
        currency: placement.currency,
        exchangeRateToBase: placement.exchangeRateToBase,
        sumInsured: placement.sumInsured,
        rate: placement.rate,
        premium: placement.premium,
        commission: placement.commission,
        facultativeOffer: placement.facultativeOffer,
        preliminaryBrokerage: placement.preliminaryBrokerage,
        createdAt: placement.createdAt,
        updatedAt: placement.updatedAt,
      },
      participants: placement.participants,
      closings: placement.closings,
      payments: placement.payments,
      notes: placement.notes,
    }) as Record<string, unknown>;
  }

  private buildEffectiveOriginalSnapshot(
    placement: PlacementSnapshotRecord,
    effectiveView: EffectivePlacementViewResponseDto,
  ) {
    const effectiveTerms = effectiveView.effectiveTerms;
    const effectiveParticipants = effectiveView.effectiveParticipants.map(
      (participant) => {
        const primarySource = participant.sources[0];
        const originalParticipantId =
          primarySource?.originalParticipantId ??
          primarySource?.participantId ??
          null;

        return {
          id:
            originalParticipantId ??
            primarySource?.endorsementParticipantId ??
            participant.counterpartyId,
          counterpartyId: participant.counterpartyId,
          role: 'REINSURER',
          status: 'CLOSED',
          sharePercent: participant.signedLinePercent,
          signedLinePercent: participant.signedLinePercent,
          brokerageFee:
            effectiveTerms.brokeragePercent ??
            participant.sources
              .map((source) => source.signedLinePercent)
              .find((value) => Number.isFinite(value)) ??
            null,
          notes: null,
          originalParticipantId,
          participationType: participant.participationType,
          sourceType: primarySource?.sourceType ?? null,
          sourceClosingId: primarySource?.closingId ?? null,
        };
      },
    );

    const effectiveClosings = effectiveView.effectiveParticipants.flatMap(
      (participant) =>
        participant.sources.map((source) => ({
          id: source.closingId,
          participantId: source.participantId ?? null,
          endorsementParticipantId: source.endorsementParticipantId ?? null,
          originalParticipantId: source.originalParticipantId ?? null,
          counterpartyId: participant.counterpartyId,
          closingNumber: null,
          status: 'CONFIRMED',
          signedLinePercent: source.signedLinePercent,
          sharePercent: source.signedLinePercent,
          grossPremium: participant.grossPremium,
          commissionAmount: participant.commissionAmount,
          brokerageAmount: participant.brokerageAmount,
          netPremium: participant.netPremium,
          currency: effectiveTerms.currency,
        })),
    );

    return this.toPlainJson({
      placement: {
        id: placement.id,
        reference: placement.reference,
        policyNumber: placement.policyNumber,
        title: effectiveTerms.title,
        placementType: placement.placementType,
        status: placement.status,
        cedantId: effectiveTerms.cedantId,
        riskTypeId: effectiveTerms.riskTypeId,
        businessDetails: effectiveTerms.businessDetails,
        offerDetails: effectiveTerms.offerDetails,
        description: effectiveTerms.description,
        inceptionDate: effectiveTerms.inceptionDate,
        expiryDate: effectiveTerms.expiryDate,
        currency: effectiveTerms.currency,
        exchangeRateToBase: placement.exchangeRateToBase,
        sumInsured: effectiveTerms.sumInsured,
        rate: effectiveTerms.rate,
        premium: effectiveTerms.premium,
        commission: effectiveTerms.commissionPercent,
        facultativeOffer: effectiveTerms.facultativeOfferPercent,
        preliminaryBrokerage: effectiveTerms.brokeragePercent,
        createdAt: placement.createdAt,
        updatedAt: placement.updatedAt,
      },
      participants: effectiveParticipants,
      closings: effectiveClosings,
      payments: placement.payments,
      notes: placement.notes,
      effectiveViewAsOf: effectiveView.viewAsOf,
      appliedEndorsements: effectiveView.appliedEndorsements,
      scheduledEndorsements: effectiveView.scheduledEndorsements,
    }) as Record<string, unknown>;
  }

  private deriveValidatedImpactType(input: {
    requestedImpactType?: PlacementEndorsementImpactType;
    type: PlacementEndorsementType;
    originalPlacement?: PlacementSnapshotRecord;
    originalSnapshot?: Record<string, unknown>;
    proposedSnapshot?: Record<string, unknown>;
    targetPercent?: number | null;
  }): PlacementEndorsementImpactType {
    const derived = this.deriveImpactType(input);
    if (input.requestedImpactType && input.requestedImpactType !== derived) {
      throw new BadRequestException(
        `impactType ${input.requestedImpactType} does not match derived endorsement impact ${derived}`,
      );
    }
    return derived;
  }

  private deriveImpactType(input: {
    type: PlacementEndorsementType;
    originalPlacement?: PlacementSnapshotRecord;
    originalSnapshot?: Record<string, unknown>;
    proposedSnapshot?: Record<string, unknown>;
    targetPercent?: number | null;
  }): PlacementEndorsementImpactType {
    if (
      input.type === PlacementEndorsementType.CANCELLATION ||
      input.type === PlacementEndorsementType.PARTICIPANT_REMOVAL ||
      input.type === PlacementEndorsementType.SUM_INSURED_DECREASE
    ) {
      return PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION;
    }

    const originalPlacement = this.extractOriginalPlacement(input);
    const proposed = this.asRecord(input.proposedSnapshot);
    const proposedPlacement = this.asRecord(proposed.placement);
    const originalFacultativeOffer = this.firstOptionalNumber(
      originalPlacement.facultativeOffer,
    );
    const proposedFacultativeOffer = this.firstOptionalNumber(
      proposed.facultativeOffer,
      proposedPlacement.facultativeOffer,
      input.targetPercent,
    );

    if (
      originalFacultativeOffer !== null &&
      proposedFacultativeOffer !== null
    ) {
      if (proposedFacultativeOffer > originalFacultativeOffer) {
        return PlacementEndorsementImpactType.CAPACITY_INCREASE;
      }
      if (proposedFacultativeOffer < originalFacultativeOffer) {
        return PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION;
      }
    }

    if (this.hasTermsChange(originalPlacement, proposed, proposedPlacement)) {
      return PlacementEndorsementImpactType.TERMS_ONLY;
    }

    return PlacementEndorsementImpactType.ADMINISTRATIVE;
  }

  private extractOriginalPlacement(input: {
    originalPlacement?: PlacementSnapshotRecord;
    originalSnapshot?: Record<string, unknown>;
  }): Record<string, unknown> {
    if (input.originalPlacement) {
      return input.originalPlacement as unknown as Record<string, unknown>;
    }
    return this.asRecord(this.asRecord(input.originalSnapshot).placement);
  }

  private hasTermsChange(
    originalPlacement: Record<string, unknown>,
    proposed: Record<string, unknown>,
    proposedPlacement: Record<string, unknown>,
  ): boolean {
    const fields = [
      'sumInsured',
      'premium',
      'rate',
      'commission',
      'preliminaryBrokerage',
      'brokeragePercent',
      'currency',
      'inceptionDate',
      'expiryDate',
      'riskTypeId',
      'businessDetails',
      'offerDetails',
    ];

    return fields.some((field) => {
      const proposedValue =
        proposed[field] !== undefined
          ? proposed[field]
          : proposedPlacement[field];
      if (proposedValue === undefined) return false;
      return !this.valuesEqual(originalPlacement[field], proposedValue);
    });
  }

  private assertEditable(endorsement: { status: PlacementEndorsementStatus }) {
    if (endorsement.status !== PlacementEndorsementStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT endorsements can be edited directly',
      );
    }
  }

  private assertTransition(
    from: PlacementEndorsementStatus,
    to: PlacementEndorsementStatus,
  ) {
    if (from === to) return;

    const allowed: Record<
      PlacementEndorsementStatus,
      PlacementEndorsementStatus[]
    > = {
      [PlacementEndorsementStatus.DRAFT]: [
        PlacementEndorsementStatus.MARKETING,
        PlacementEndorsementStatus.DECLINED,
        PlacementEndorsementStatus.VOID,
      ],
      [PlacementEndorsementStatus.MARKETING]: [
        PlacementEndorsementStatus.PARTIALLY_ACCEPTED,
        PlacementEndorsementStatus.ACCEPTED,
        PlacementEndorsementStatus.DECLINED,
        PlacementEndorsementStatus.VOID,
      ],
      [PlacementEndorsementStatus.PARTIALLY_ACCEPTED]: [
        PlacementEndorsementStatus.ACCEPTED,
        PlacementEndorsementStatus.CLOSING,
        PlacementEndorsementStatus.DECLINED,
        PlacementEndorsementStatus.VOID,
      ],
      [PlacementEndorsementStatus.ACCEPTED]: [
        PlacementEndorsementStatus.CLOSING,
        PlacementEndorsementStatus.DECLINED,
        PlacementEndorsementStatus.VOID,
      ],
      [PlacementEndorsementStatus.CLOSING]: [
        PlacementEndorsementStatus.CLOSED,
        PlacementEndorsementStatus.VOID,
      ],
      [PlacementEndorsementStatus.CLOSED]: [],
      [PlacementEndorsementStatus.DECLINED]: [],
      [PlacementEndorsementStatus.VOID]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move endorsement from ${from} to ${to}`,
      );
    }
  }

  private cleanRequired(value: string, message: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException(message);
    return cleaned;
  }

  private cleanOptional(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    const cleaned = value.trim();
    return cleaned ? cleaned : null;
  }

  private toDecimalInput(value?: number): Prisma.Decimal | undefined {
    if (value === undefined) return undefined;
    return new Prisma.Decimal(value);
  }

  private toOptionalNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private firstOptionalNumber(...values: unknown[]): number | null {
    for (const value of values) {
      const parsed = this.parseOptionalNumber(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private parseOptionalNumber(value: unknown): number {
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return Number.NaN;
    }
    if (
      value instanceof Prisma.Decimal ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      return Number(value.toString());
    }
    return Number.NaN;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    const leftNumber = this.firstOptionalNumber(left);
    const rightNumber = this.firstOptionalNumber(right);
    if (leftNumber !== null || rightNumber !== null) {
      return leftNumber === rightNumber;
    }

    const normalize = (value: unknown) => {
      if (value instanceof Date) return value.toISOString();
      if (value instanceof Prisma.Decimal) return value.toString();
      return JSON.stringify(this.toPlainJson(value));
    };

    return normalize(left) === normalize(right);
  }

  private toJsonInput(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return this.toPlainJson(value) as Prisma.InputJsonValue;
  }

  private toPlainJson(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Prisma.Decimal) return value.toString();
    if (Array.isArray(value))
      return value.map((item) => this.toPlainJson(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.toPlainJson(item),
        ]),
      );
    }
    return value;
  }
}
