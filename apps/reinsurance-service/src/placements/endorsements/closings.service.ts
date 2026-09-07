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
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePlacementEndorsementClosingStatusDto } from '../dto/update-placement-endorsement-closing-status.dto';
import { PlacementEndorsementSummaryResponseDto } from '../dto/placement-endorsement-summary-response.dto';
import { PlacementEndorsementsService } from './endorsements.service';

const endorsementClosingInclude = {
  endorsementParticipant: {
    include: {
      counterparty: {
        select: {
          id: true,
          name: true,
          registrationNumber: true,
        },
      },
    },
  },
} satisfies Prisma.PlacementEndorsementClosingInclude;

type EndorsementClosingRecord = Prisma.PlacementEndorsementClosingGetPayload<{
  include: typeof endorsementClosingInclude;
}>;

const endorsementParticipantInclude = {
  counterparty: {
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      // Fallback source for brokerage when there's no originalParticipant link below —
      // covers a genuinely new mid-term participant, or a broken/missing link on a
      // carried-over one, so brokerage doesn't silently default to 0%.
      brokerageFee: true,
    },
  },
  // `PlacementEndorsementParticipant` has no brokerageFee column of its own — participants
  // carried over from the base placement inherit theirs from the original participant record.
  originalParticipant: {
    select: {
      brokerageFee: true,
    },
  },
} satisfies Prisma.PlacementEndorsementParticipantInclude;

type EndorsementParticipantRecord =
  Prisma.PlacementEndorsementParticipantGetPayload<{
    include: typeof endorsementParticipantInclude;
  }>;

type EndorsementForClosing = {
  id: string;
  tenantId: string;
  placementId: string;
  status: PlacementEndorsementStatus;
  targetPercent: Prisma.Decimal | null;
  originalSnapshot: Prisma.JsonValue;
  proposedSnapshot: Prisma.JsonValue | null;
};

export type ValidateEndorsementParticipantResult = {
  participant: EndorsementParticipantRecord;
  closing: EndorsementClosingRecord;
  summary: PlacementEndorsementSummaryResponseDto;
  effectiveStatus: PlacementEndorsementStatus;
};

export type ForceCloseEndorsementResult = {
  endorsement: PlacementEndorsement;
  closings: EndorsementClosingRecord[];
  summary: PlacementEndorsementSummaryResponseDto;
  effectiveStatus: PlacementEndorsementStatus;
};

@Injectable()
export class PlacementEndorsementClosingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly endorsementsService: PlacementEndorsementsService,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementClosingRecord[]> {
    await this.findEndorsement(tenantId, placementId, endorsementId);
    return this.prisma.placementEndorsementClosing.findMany({
      where: { tenantId, placementId, endorsementId },
      include: endorsementClosingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<EndorsementClosingRecord> {
    await this.findEndorsement(tenantId, placementId, endorsementId);
    const closing = await this.prisma.placementEndorsementClosing.findFirst({
      where: { id: closingId, tenantId, placementId, endorsementId },
      include: endorsementClosingInclude,
    });
    if (!closing) {
      throw new NotFoundException('Placement endorsement closing not found');
    }
    return closing;
  }

  async create(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<EndorsementClosingRecord> {
    const endorsement = await this.findEndorsement(
      user.tenantId,
      placementId,
      endorsementId,
    );
    this.assertEndorsementCanClose(endorsement);

    const participant =
      await this.prisma.placementEndorsementParticipant.findFirst({
        where: {
          id: participantId,
          tenantId: user.tenantId,
          placementId,
          endorsementId,
        },
        include: endorsementParticipantInclude,
      });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }

    if (participant.status !== PlacementEndorsementParticipantStatus.ACCEPTED) {
      throw new BadRequestException(
        'Endorsement closing can only be created for accepted endorsement participants',
      );
    }

    const signedLinePercent = this.toNumber(participant.signedLinePercent);
    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    if (signedLinePercent <= 0 || signedLinePercent > 100) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage must be greater than zero and at most 100',
      );
    }
    if (sharePercent !== null && signedLinePercent > sharePercent) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage cannot exceed offered share percentage',
      );
    }

    const snapshotSource = this.buildSnapshotSource(endorsement);
    const snapshot = this.computeSnapshot(
      snapshotSource,
      participant,
      signedLinePercent,
    );

    return this.prisma.$transaction(async (tx) => {
      const existingActive = await tx.placementEndorsementClosing.findFirst({
        where: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId: participantId,
          status: { not: PlacementClosingStatus.VOID },
        },
      });
      if (existingActive) {
        throw new ConflictException(
          'An active endorsement closing already exists for this endorsement participant',
        );
      }

      const count = await tx.placementEndorsementClosing.count({
        where: { tenantId: user.tenantId, placementId },
      });
      const closingNumber = `ENC-${String(count + 1).padStart(3, '0')}`;

      return tx.placementEndorsementClosing.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId: participantId,
          closingNumber,
          status: PlacementClosingStatus.DRAFT,
          createdByUserId: user.id,
          ...snapshot,
        },
        include: endorsementClosingInclude,
      });
    });
  }

  async validateAndConfirm(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<ValidateEndorsementParticipantResult> {
    let result:
      | {
          participant: EndorsementParticipantRecord;
          closing: EndorsementClosingRecord;
        }
      | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) =>
            this.validateAndConfirmInTransaction(
              tx,
              user,
              placementId,
              endorsementId,
              participantId,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          attempt === 0 &&
          (this.isSerializableTransactionConflict(error) ||
            this.isUniqueConstraintConflict(error))
        ) {
          continue;
        }
        this.rethrowControlledPrismaError(error);
        throw error;
      }
    }

    if (!result) {
      throw new ConflictException(
        'Could not complete endorsement participant validation workflow',
      );
    }

    const participant = await this.findValidatedParticipant(
      user.tenantId,
      placementId,
      endorsementId,
      result.participant.id,
    );
    const closing = await this.findOne(
      user.tenantId,
      placementId,
      endorsementId,
      result.closing.id,
    );
    const summary = await this.endorsementsService.getSummary(
      user.tenantId,
      placementId,
      endorsementId,
    );

    return {
      participant,
      closing,
      summary,
      effectiveStatus: this.deriveEffectiveStatus(summary),
    };
  }

  async forceClose(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
  ): Promise<ForceCloseEndorsementResult> {
    let result:
      | {
          closingIds: string[];
        }
      | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) =>
            this.forceCloseInTransaction(tx, user, placementId, endorsementId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          attempt === 0 &&
          (this.isSerializableTransactionConflict(error) ||
            this.isUniqueConstraintConflict(error))
        ) {
          continue;
        }
        this.rethrowControlledPrismaError(error);
        throw error;
      }
    }

    if (!result) {
      throw new ConflictException('Could not force close endorsement');
    }

    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId: user.tenantId,
        placementId,
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }
    const closings = await this.prisma.placementEndorsementClosing.findMany({
      where: {
        tenantId: user.tenantId,
        placementId,
        endorsementId,
        id: { in: result.closingIds },
      },
      include: endorsementClosingInclude,
      orderBy: { createdAt: 'asc' },
    });
    const summary = await this.endorsementsService.getSummary(
      user.tenantId,
      placementId,
      endorsementId,
    );

    return {
      endorsement,
      closings,
      summary,
      effectiveStatus: PlacementEndorsementStatus.CLOSED,
    };
  }

  private async findValidatedParticipant(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<EndorsementParticipantRecord> {
    const participant =
      await this.prisma.placementEndorsementParticipant.findFirst({
        where: {
          id: participantId,
          tenantId,
          placementId,
          endorsementId,
        },
        include: endorsementParticipantInclude,
      });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }
    return participant;
  }

  private async forceCloseInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placementId: string,
    endorsementId: string,
  ): Promise<{
    closingIds: string[];
  }> {
    const endorsement = await this.findEndorsementInTransaction(
      tx,
      user.tenantId,
      placementId,
      endorsementId,
    );

    if (endorsement.status === PlacementEndorsementStatus.CLOSED) {
      const confirmedClosings = await tx.placementEndorsementClosing.findMany({
        where: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      return {
        closingIds: confirmedClosings.map((closing) => closing.id),
      };
    }

    this.assertEndorsementCanForceClose(endorsement);

    const agreedParticipants =
      await tx.placementEndorsementParticipant.findMany({
        where: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          status: {
            in: [
              PlacementEndorsementParticipantStatus.ACCEPTED,
              PlacementEndorsementParticipantStatus.CLOSED,
            ],
          },
        },
        include: endorsementParticipantInclude,
        orderBy: { createdAt: 'asc' },
      });

    const agreedStatuses: PlacementEndorsementParticipantStatus[] = [
      PlacementEndorsementParticipantStatus.ACCEPTED,
      PlacementEndorsementParticipantStatus.CLOSED,
    ];
    const eligibleParticipants = agreedParticipants.filter(
      (participant) =>
        agreedStatuses.includes(participant.status) &&
        this.toNumber(participant.signedLinePercent) > 0,
    );
    if (eligibleParticipants.length === 0) {
      throw new ConflictException(
        'Force close requires at least one accepted endorsement participant with an agreed signed line.',
      );
    }

    const snapshotSource = this.buildSnapshotSource(endorsement);
    const closingIds: string[] = [];

    for (const participant of eligibleParticipants) {
      this.assertParticipantClosingValues(participant);

      let closing = await tx.placementEndorsementClosing.findFirst({
        where: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId: participant.id,
          status: { not: PlacementClosingStatus.VOID },
        },
        include: endorsementClosingInclude,
        orderBy: { createdAt: 'desc' },
      });

      if (!closing) {
        const count = await tx.placementEndorsementClosing.count({
          where: { tenantId: user.tenantId, placementId },
        });
        const closingNumber = `ENC-${String(count + 1).padStart(3, '0')}`;
        const signedLinePercent = this.toNumber(participant.signedLinePercent);
        closing = await tx.placementEndorsementClosing.create({
          data: {
            tenantId: user.tenantId,
            placementId,
            endorsementId,
            endorsementParticipantId: participant.id,
            closingNumber,
            status: PlacementClosingStatus.DRAFT,
            createdByUserId: user.id,
            ...this.computeSnapshot(
              snapshotSource,
              participant,
              signedLinePercent,
            ),
          },
          include: endorsementClosingInclude,
        });
      }

      closing = await this.issueAndConfirmClosing(tx, closing);
      closingIds.push(closing.id);

      if (participant.status !== PlacementEndorsementParticipantStatus.CLOSED) {
        await tx.placementEndorsementParticipant.update({
          where: { id: participant.id },
          data: { status: PlacementEndorsementParticipantStatus.CLOSED },
          include: endorsementParticipantInclude,
        });
      }
    }

    await tx.placementEndorsement.update({
      where: { id: endorsementId },
      data: {
        status: PlacementEndorsementStatus.CLOSED,
        closedAt: new Date(),
        updatedByUserId: user.id,
      },
    });

    return { closingIds };
  }

  private async validateAndConfirmInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<{
    participant: EndorsementParticipantRecord;
    closing: EndorsementClosingRecord;
  }> {
    const endorsement = await this.findEndorsementInTransaction(
      tx,
      user.tenantId,
      placementId,
      endorsementId,
    );
    this.assertEndorsementCanValidate(endorsement);

    const participant = await tx.placementEndorsementParticipant.findFirst({
      where: {
        id: participantId,
        tenantId: user.tenantId,
        placementId,
        endorsementId,
      },
      include: endorsementParticipantInclude,
    });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }

    const existingActive = await tx.placementEndorsementClosing.findFirst({
      where: {
        tenantId: user.tenantId,
        placementId,
        endorsementId,
        endorsementParticipantId: participantId,
        status: { not: PlacementClosingStatus.VOID },
      },
      include: endorsementClosingInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (participant.status === PlacementEndorsementParticipantStatus.CLOSED) {
      if (existingActive?.status === PlacementClosingStatus.CONFIRMED) {
        return { participant, closing: existingActive };
      }
      throw new ConflictException(
        'Endorsement participant is already closed without a confirmed active endorsement closing',
      );
    }

    if (participant.status === PlacementEndorsementParticipantStatus.DECLINED) {
      throw new ConflictException(
        'Declined endorsement participants cannot be validated',
      );
    }

    if (participant.status !== PlacementEndorsementParticipantStatus.ACCEPTED) {
      throw new BadRequestException(
        'Endorsement participant must be ACCEPTED before validation',
      );
    }

    const signedLinePercent = this.toNumber(participant.signedLinePercent);
    this.assertParticipantClosingValues(participant);
    await this.assertAcceptedCapacityWithinTarget(
      tx,
      user.tenantId,
      endorsementId,
      endorsement.targetPercent,
      signedLinePercent,
      participantId,
    );

    let closing = existingActive;
    if (!closing) {
      const snapshotSource = this.buildSnapshotSource(endorsement);
      const snapshot = this.computeSnapshot(
        snapshotSource,
        participant,
        signedLinePercent,
      );
      const count = await tx.placementEndorsementClosing.count({
        where: { tenantId: user.tenantId, placementId },
      });
      const closingNumber = `ENC-${String(count + 1).padStart(3, '0')}`;

      closing = await tx.placementEndorsementClosing.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId: participantId,
          closingNumber,
          status: PlacementClosingStatus.DRAFT,
          createdByUserId: user.id,
          ...snapshot,
        },
        include: endorsementClosingInclude,
      });
    }

    closing = await this.issueAndConfirmClosing(tx, closing);

    const closedParticipant = await tx.placementEndorsementParticipant.update({
      where: { id: participantId },
      data: { status: PlacementEndorsementParticipantStatus.CLOSED },
      include: endorsementParticipantInclude,
    });

    return { participant: closedParticipant, closing };
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    closingId: string,
    dto: UpdatePlacementEndorsementClosingStatusDto,
  ): Promise<EndorsementClosingRecord> {
    const closing = await this.findOne(
      user.tenantId,
      placementId,
      endorsementId,
      closingId,
    );
    if (closing.status === dto.status) return closing;
    this.assertStatusTransition(closing.status, dto.status);

    const now = new Date();
    return this.prisma.placementEndorsementClosing.update({
      where: { id: closingId },
      data: {
        status: dto.status,
        ...(dto.status === PlacementClosingStatus.ISSUED
          ? { issuedAt: now }
          : {}),
        ...(dto.status === PlacementClosingStatus.CONFIRMED
          ? { confirmedAt: now }
          : {}),
      },
      include: endorsementClosingInclude,
    });
  }

  private async findEndorsement(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementForClosing> {
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId,
        placementId,
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        tenantId: true,
        placementId: true,
        status: true,
        targetPercent: true,
        originalSnapshot: true,
        proposedSnapshot: true,
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }
    return endorsement;
  }

  private async findEndorsementInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementForClosing> {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) {
      throw new NotFoundException('Placement not found');
    }

    const endorsement = await tx.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId,
        placementId,
      },
      select: {
        id: true,
        tenantId: true,
        placementId: true,
        status: true,
        targetPercent: true,
        originalSnapshot: true,
        proposedSnapshot: true,
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }
    return endorsement;
  }

  private assertEndorsementCanClose(endorsement: {
    status: PlacementEndorsementStatus;
  }): void {
    if (endorsement.status === PlacementEndorsementStatus.VOID) {
      throw new BadRequestException(
        'VOID endorsements cannot create endorsement closings',
      );
    }
  }

  private assertEndorsementCanValidate(endorsement: {
    status: PlacementEndorsementStatus;
  }): void {
    const terminalStatuses: PlacementEndorsementStatus[] = [
      PlacementEndorsementStatus.CLOSED,
      PlacementEndorsementStatus.DECLINED,
      PlacementEndorsementStatus.VOID,
    ];
    if (terminalStatuses.includes(endorsement.status)) {
      throw new ConflictException(
        'Terminal endorsements cannot validate endorsement participants',
      );
    }
    if (endorsement.status === PlacementEndorsementStatus.DRAFT) {
      throw new BadRequestException(
        'Endorsement must be sent to market before participant validation',
      );
    }
  }

  private assertEndorsementCanForceClose(endorsement: {
    status: PlacementEndorsementStatus;
  }): void {
    if (
      endorsement.status === PlacementEndorsementStatus.DECLINED ||
      endorsement.status === PlacementEndorsementStatus.VOID
    ) {
      throw new ConflictException(
        `Cannot force close a ${endorsement.status.toLowerCase()} endorsement`,
      );
    }
    if (endorsement.status === PlacementEndorsementStatus.DRAFT) {
      throw new BadRequestException(
        'Endorsement must be sent to market before force close',
      );
    }
  }

  private assertParticipantClosingValues(participant: {
    signedLinePercent: Prisma.Decimal | null;
    sharePercent: Prisma.Decimal | null;
  }): void {
    const signedLinePercent = this.toNumber(participant.signedLinePercent);
    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    if (signedLinePercent <= 0 || signedLinePercent > 100) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage must be greater than zero and at most 100',
      );
    }
    if (sharePercent !== null && signedLinePercent > sharePercent) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage cannot exceed offered share percentage',
      );
    }
  }

  private async assertAcceptedCapacityWithinTarget(
    tx: Prisma.TransactionClient,
    tenantId: string,
    endorsementId: string,
    targetPercent: Prisma.Decimal | null,
    signedLinePercent: number,
    participantId: string,
  ): Promise<void> {
    if (!targetPercent) return;
    const acceptedParticipants =
      await tx.placementEndorsementParticipant.findMany({
        where: {
          tenantId,
          endorsementId,
          status: {
            in: [
              PlacementEndorsementParticipantStatus.ACCEPTED,
              PlacementEndorsementParticipantStatus.CLOSED,
            ],
          },
          id: { not: participantId },
        },
        select: { signedLinePercent: true },
      });
    const currentAccepted = acceptedParticipants.reduce(
      (sum, item) => sum + (this.toOptionalNumber(item.signedLinePercent) ?? 0),
      0,
    );
    if (currentAccepted + signedLinePercent > targetPercent.toNumber()) {
      throw new BadRequestException(
        'Accepted endorsement signed lines cannot exceed targetPercent',
      );
    }
  }

  private async issueAndConfirmClosing(
    tx: Prisma.TransactionClient,
    closing: EndorsementClosingRecord,
  ): Promise<EndorsementClosingRecord> {
    const now = new Date();
    if (closing.status === PlacementClosingStatus.CONFIRMED) {
      return closing;
    }
    if (closing.status === PlacementClosingStatus.VOID) {
      throw new ConflictException(
        'VOID endorsement closings cannot be validated',
      );
    }

    let current = closing;
    if (current.status === PlacementClosingStatus.DRAFT) {
      current = await tx.placementEndorsementClosing.update({
        where: { id: current.id },
        data: {
          status: PlacementClosingStatus.ISSUED,
          issuedAt: current.issuedAt ?? now,
        },
        include: endorsementClosingInclude,
      });
    }

    if (current.status === PlacementClosingStatus.ISSUED) {
      current = await tx.placementEndorsementClosing.update({
        where: { id: current.id },
        data: {
          status: PlacementClosingStatus.CONFIRMED,
          confirmedAt: current.confirmedAt ?? now,
        },
        include: endorsementClosingInclude,
      });
    }

    if (current.status !== PlacementClosingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot validate endorsement closing from ${current.status}`,
      );
    }
    return current;
  }

  private deriveEffectiveStatus(
    summary: PlacementEndorsementSummaryResponseDto,
  ): PlacementEndorsementStatus {
    if (summary.status === PlacementEndorsementStatus.CLOSED) {
      return PlacementEndorsementStatus.CLOSED;
    }
    if (summary.pendingActions.includes('CLOSE_ENDORSEMENT')) {
      return PlacementEndorsementStatus.CLOSING;
    }
    if (summary.closings.confirmed > 0) {
      return PlacementEndorsementStatus.CLOSING;
    }
    return summary.status;
  }

  private assertStatusTransition(
    from: PlacementClosingStatus,
    to: PlacementClosingStatus,
  ): void {
    const allowed: Record<PlacementClosingStatus, PlacementClosingStatus[]> = {
      [PlacementClosingStatus.DRAFT]: [
        PlacementClosingStatus.ISSUED,
        PlacementClosingStatus.VOID,
      ],
      [PlacementClosingStatus.ISSUED]: [
        PlacementClosingStatus.CONFIRMED,
        PlacementClosingStatus.VOID,
      ],
      [PlacementClosingStatus.CONFIRMED]: [],
      [PlacementClosingStatus.VOID]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move endorsement closing from ${from} to ${to}`,
      );
    }
  }

  private buildSnapshotSource(endorsement: EndorsementForClosing) {
    const proposed = this.asRecord(endorsement.proposedSnapshot);
    const original = this.asRecord(endorsement.originalSnapshot);
    const originalPlacement = this.asRecord(original.placement);

    const premium = this.firstNumber(
      proposed.premium,
      this.asRecord(proposed.placement).premium,
      originalPlacement.premium,
    );
    if (premium === null) {
      throw new BadRequestException(
        'Endorsement premium snapshot is required before creating an endorsement closing',
      );
    }
    if (premium <= 0) {
      throw new BadRequestException(
        'Endorsement premium snapshot must be greater than zero before creating an endorsement closing',
      );
    }

    return {
      premium,
      sumInsured: this.firstOptionalNumber(
        proposed.sumInsured,
        this.asRecord(proposed.placement).sumInsured,
        originalPlacement.sumInsured,
      ),
      commission: this.firstOptionalNumber(
        proposed.commission,
        this.asRecord(proposed.placement).commission,
        originalPlacement.commission,
      ),
      currency: this.firstString(
        proposed.currency,
        this.asRecord(proposed.placement).currency,
        originalPlacement.currency,
      ),
    };
  }

  private computeSnapshot(
    source: {
      premium: number;
      sumInsured: number | null;
      commission: number | null;
      currency: string | null;
    },
    participant: {
      sharePercent: Prisma.Decimal | null;
      signedLinePercent: Prisma.Decimal | null;
      originalParticipant?: { brokerageFee: Prisma.Decimal | null } | null;
      counterparty: { brokerageFee: Prisma.Decimal | null };
    },
    signedLinePercent: number,
  ) {
    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    const commissionPct = source.commission ?? 0;
    // Brokerage is per-participant (each reinsurer's own brokerage cut), mirroring the
    // original closing path in placement-closings.service.ts — not a placement-level rate.
    // Prefer the carried-over original participant's negotiated rate; fall back to the
    // counterparty's default when there's no original-participant link (a genuinely new
    // mid-term participant, or a broken link) so brokerage doesn't silently become 0.
    const brokeragePct = this.toNumber(
      participant.originalParticipant?.brokerageFee ??
        participant.counterparty.brokerageFee ??
        null,
    );

    const premiumSnapshot = (signedLinePercent / 100) * source.premium;
    const commissionAmount = (commissionPct / 100) * premiumSnapshot;
    const brokerageAmount = (brokeragePct / 100) * premiumSnapshot;
    const netPremium = premiumSnapshot - commissionAmount - brokerageAmount;
    const sumInsuredSnapshot =
      source.sumInsured != null
        ? (signedLinePercent / 100) * source.sumInsured
        : null;

    return {
      signedLinePercent,
      sharePercent,
      sumInsuredSnapshot,
      premiumSnapshot,
      commissionPercent: commissionPct,
      commissionAmount,
      brokeragePercent: brokeragePct,
      brokerageAmount,
      netPremium,
      currency: source.currency,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private firstNumber(...values: unknown[]): number | null {
    for (const value of values) {
      const parsed = this.parseNumber(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private firstOptionalNumber(...values: unknown[]): number | null {
    return this.firstNumber(...values);
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Prisma.Decimal) return value.toNumber();
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toOptionalNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private isUniqueConstraintConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private rethrowControlledPrismaError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'An active endorsement closing was created by another request. Please retry validation.',
        );
      }
      if (['P2003', 'P2014', 'P2025'].includes(error.code)) {
        throw new ConflictException(
          'Endorsement validation could not be completed because related records changed. Refresh and retry.',
        );
      }
      if (error.code === 'P2034') {
        throw new ConflictException(
          'Endorsement validation could not be completed due to a concurrent update. Please retry.',
        );
      }
    }
  }
}
