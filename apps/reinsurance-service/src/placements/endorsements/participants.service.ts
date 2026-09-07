import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementEndorsementParticipant,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlacementEndorsementParticipantDto } from '../dto/create-placement-endorsement-participant.dto';
import { UpdatePlacementEndorsementParticipantStatusDto } from '../dto/update-placement-endorsement-participant-status.dto';
import { UpdatePlacementEndorsementParticipantDto } from '../dto/update-placement-endorsement-participant.dto';

const participantInclude = {
  counterparty: {
    select: {
      id: true,
      name: true,
      registrationNumber: true,
    },
  },
} satisfies Prisma.PlacementEndorsementParticipantInclude;

type EndorsementParticipantRecord =
  Prisma.PlacementEndorsementParticipantGetPayload<{
    include: typeof participantInclude;
  }>;

type EndorsementSummary = {
  id: string;
  tenantId: string;
  placementId: string;
  status: PlacementEndorsementStatus;
  targetPercent: Prisma.Decimal | null;
};

type ParticipantForUpdate = PlacementEndorsementParticipant & {
  endorsement: EndorsementSummary;
};

export type EndorsementParticipantAggregates = {
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  remainingPercent: number | null;
  declinedPercent: number;
};

export type EndorsementParticipantListResult = {
  items: EndorsementParticipantRecord[];
  aggregates: EndorsementParticipantAggregates;
};

@Injectable()
export class PlacementEndorsementParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementParticipantListResult> {
    const endorsement = await this.findEndorsement(
      tenantId,
      placementId,
      endorsementId,
    );
    const items = await this.prisma.placementEndorsementParticipant.findMany({
      where: { tenantId, placementId, endorsementId },
      include: participantInclude,
      orderBy: { createdAt: 'asc' },
    });

    return {
      items,
      aggregates: this.calculateAggregates(items, endorsement.targetPercent),
    };
  }

  async findOne(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<EndorsementParticipantRecord> {
    await this.findEndorsement(tenantId, placementId, endorsementId);
    const participant =
      await this.prisma.placementEndorsementParticipant.findFirst({
        where: { id: participantId, tenantId, placementId, endorsementId },
        include: participantInclude,
      });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }
    return participant;
  }

  async create(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    dto: CreatePlacementEndorsementParticipantDto,
  ): Promise<EndorsementParticipantRecord> {
    const endorsement = await this.findEndorsement(
      user.tenantId,
      placementId,
      endorsementId,
    );
    this.assertEndorsementMutable(endorsement);
    await this.assertReinsurerCounterparty(user.tenantId, dto.counterpartyId);
    if (dto.originalParticipantId) {
      await this.assertOriginalParticipant(
        user.tenantId,
        placementId,
        dto.originalParticipantId,
        dto.counterpartyId,
      );
    }

    const status = dto.status ?? PlacementEndorsementParticipantStatus.INVITED;
    if (status === PlacementEndorsementParticipantStatus.CLOSED) {
      throw new BadRequestException(
        'Endorsement participants must reach CLOSED through a status transition',
      );
    }
    this.assertParticipantValues(
      status,
      dto.sharePercent,
      dto.signedLinePercent,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveDuplicate(
        tx,
        user.tenantId,
        endorsementId,
        dto.counterpartyId,
      );
      await this.assertAcceptedCap(
        tx,
        user.tenantId,
        endorsementId,
        endorsement.targetPercent,
        status,
        dto.signedLinePercent,
      );

      return tx.placementEndorsementParticipant.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          originalParticipantId: dto.originalParticipantId,
          counterpartyId: dto.counterpartyId,
          status,
          sharePercent: this.toDecimalInput(dto.sharePercent),
          signedLinePercent: this.toDecimalInput(dto.signedLinePercent),
          notes: this.cleanOptional(dto.notes),
          createdByUserId: user.id,
        },
        include: participantInclude,
      });
    });
  }

  async update(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
    dto: UpdatePlacementEndorsementParticipantDto,
  ): Promise<EndorsementParticipantRecord> {
    const participant = await this.findParticipantForUpdate(
      user.tenantId,
      placementId,
      endorsementId,
      participantId,
    );
    this.assertEndorsementMutable(participant.endorsement);
    this.assertParticipantMutable(participant.status);

    const nextCounterpartyId = dto.counterpartyId ?? participant.counterpartyId;
    const nextOriginalParticipantId =
      dto.originalParticipantId ?? participant.originalParticipantId;
    const nextStatus = dto.status ?? participant.status;
    const nextSharePercent =
      dto.sharePercent !== undefined
        ? dto.sharePercent
        : this.decimalToOptionalNumber(participant.sharePercent);
    const nextSignedLinePercent =
      dto.signedLinePercent !== undefined
        ? dto.signedLinePercent
        : this.decimalToOptionalNumber(participant.signedLinePercent);

    if (dto.counterpartyId !== undefined) {
      await this.assertReinsurerCounterparty(user.tenantId, nextCounterpartyId);
    }
    if (nextOriginalParticipantId) {
      await this.assertOriginalParticipant(
        user.tenantId,
        placementId,
        nextOriginalParticipantId,
        nextCounterpartyId,
      );
    }
    if (dto.status !== undefined) {
      this.assertParticipantTransition(participant.status, dto.status);
    }
    this.assertParticipantValues(
      nextStatus,
      nextSharePercent,
      nextSignedLinePercent,
    );

    return this.prisma.$transaction(async (tx) => {
      if (dto.counterpartyId !== undefined) {
        await this.assertNoActiveDuplicate(
          tx,
          user.tenantId,
          endorsementId,
          nextCounterpartyId,
          participantId,
        );
      }
      await this.assertAcceptedCap(
        tx,
        user.tenantId,
        endorsementId,
        participant.endorsement.targetPercent,
        nextStatus,
        nextSignedLinePercent,
        participantId,
      );

      return tx.placementEndorsementParticipant.update({
        where: { id: participantId },
        data: {
          ...(dto.counterpartyId !== undefined
            ? { counterpartyId: nextCounterpartyId }
            : {}),
          ...(dto.originalParticipantId !== undefined
            ? { originalParticipantId: dto.originalParticipantId }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.sharePercent !== undefined
            ? { sharePercent: this.toDecimalInput(dto.sharePercent) }
            : {}),
          ...(dto.signedLinePercent !== undefined
            ? {
                signedLinePercent: this.toDecimalInput(dto.signedLinePercent),
              }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: this.cleanOptional(dto.notes) }
            : {}),
        },
        include: participantInclude,
      });
    });
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
    dto: UpdatePlacementEndorsementParticipantStatusDto,
  ): Promise<EndorsementParticipantRecord> {
    const participant = await this.findParticipantForUpdate(
      user.tenantId,
      placementId,
      endorsementId,
      participantId,
    );
    this.assertEndorsementMutable(participant.endorsement);
    this.assertParticipantTransition(participant.status, dto.status);

    const signedLinePercent = this.decimalToOptionalNumber(
      participant.signedLinePercent,
    );
    this.assertParticipantValues(
      dto.status,
      this.decimalToOptionalNumber(participant.sharePercent),
      signedLinePercent,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.assertAcceptedCap(
        tx,
        user.tenantId,
        endorsementId,
        participant.endorsement.targetPercent,
        dto.status,
        signedLinePercent,
        participantId,
      );

      return tx.placementEndorsementParticipant.update({
        where: { id: participantId },
        data: { status: dto.status },
        include: participantInclude,
      });
    });
  }

  async reinvite(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<EndorsementParticipantRecord> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) =>
            this.reinviteInTransaction(
              tx,
              user,
              placementId,
              endorsementId,
              participantId,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          attempt === 0 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Could not re-invite endorsement participant due to a concurrent update. Please retry.',
    );
  }

  private async reinviteInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<EndorsementParticipantRecord> {
    const participant = await tx.placementEndorsementParticipant.findFirst({
      where: {
        id: participantId,
        tenantId: user.tenantId,
        placementId,
        endorsementId,
      },
      include: {
        endorsement: {
          select: {
            id: true,
            tenantId: true,
            placementId: true,
            status: true,
            targetPercent: true,
          },
        },
      },
    });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }
    this.assertEndorsementMutable(participant.endorsement);

    if (participant.status !== PlacementEndorsementParticipantStatus.DECLINED) {
      throw new ConflictException(
        'Only declined endorsement participants can be re-invited',
      );
    }

    await this.assertNoActiveDuplicate(
      tx,
      user.tenantId,
      endorsementId,
      participant.counterpartyId,
      participantId,
    );

    return tx.placementEndorsementParticipant.create({
      data: {
        tenantId: user.tenantId,
        placementId,
        endorsementId,
        originalParticipantId: participant.originalParticipantId,
        counterpartyId: participant.counterpartyId,
        status: PlacementEndorsementParticipantStatus.INVITED,
        sharePercent: participant.sharePercent,
        signedLinePercent: null,
        notes: participant.notes
          ? `Re-invited after declined attempt ${participant.id}. Previous notes: ${participant.notes}`
          : `Re-invited after declined attempt ${participant.id}.`,
        createdByUserId: user.id,
      },
      include: participantInclude,
    });
  }

  async delete(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<void> {
    const participant = await this.findParticipantForUpdate(
      user.tenantId,
      placementId,
      endorsementId,
      participantId,
    );
    this.assertEndorsementMutable(participant.endorsement);
    this.assertParticipantMutable(participant.status);

    await this.prisma.placementEndorsementParticipant.delete({
      where: { id: participantId },
    });
  }

  private async findEndorsement(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementSummary> {
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
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }
    return endorsement;
  }

  private async findParticipantForUpdate(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<ParticipantForUpdate> {
    const participant =
      await this.prisma.placementEndorsementParticipant.findFirst({
        where: { id: participantId, tenantId, placementId, endorsementId },
        include: {
          endorsement: {
            select: {
              id: true,
              tenantId: true,
              placementId: true,
              status: true,
              targetPercent: true,
            },
          },
        },
      });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }
    return participant;
  }

  private async assertReinsurerCounterparty(
    tenantId: string,
    counterpartyId: string,
  ): Promise<void> {
    const counterparty = await this.prisma.counterparty.findFirst({
      where: {
        id: counterpartyId,
        tenantId,
        archivedAt: null,
        type: CounterpartyType.REINSURER,
      },
      select: { id: true },
    });
    if (!counterparty) {
      throw new BadRequestException(
        'Endorsement participant counterparty must be an active reinsurer',
      );
    }
  }

  private async assertOriginalParticipant(
    tenantId: string,
    placementId: string,
    originalParticipantId: string,
    counterpartyId: string,
  ): Promise<void> {
    const participant = await this.prisma.placementParticipant.findFirst({
      where: { id: originalParticipantId, tenantId, placementId },
      select: { id: true, counterpartyId: true },
    });
    if (!participant) {
      throw new BadRequestException(
        'Original participant must belong to the same placement',
      );
    }
    if (participant.counterpartyId !== counterpartyId) {
      throw new BadRequestException(
        'Original participant counterparty must match endorsement participant counterparty',
      );
    }
  }

  private async assertNoActiveDuplicate(
    tx: Prisma.TransactionClient,
    tenantId: string,
    endorsementId: string,
    counterpartyId: string,
    excludeParticipantId?: string,
  ): Promise<void> {
    const duplicate = await tx.placementEndorsementParticipant.findFirst({
      where: {
        tenantId,
        endorsementId,
        counterpartyId,
        status: { not: PlacementEndorsementParticipantStatus.DECLINED },
        ...(excludeParticipantId ? { id: { not: excludeParticipantId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'An active endorsement participant already exists for this reinsurer',
      );
    }
  }

  private async assertAcceptedCap(
    tx: Prisma.TransactionClient,
    tenantId: string,
    endorsementId: string,
    targetPercent: Prisma.Decimal | null,
    nextStatus: PlacementEndorsementParticipantStatus,
    nextSignedLinePercent?: number | null,
    excludeParticipantId?: string,
  ): Promise<void> {
    if (!targetPercent) return;
    if (!this.countsAsAccepted(nextStatus)) return;

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
          ...(excludeParticipantId
            ? { id: { not: excludeParticipantId } }
            : {}),
        },
        select: { signedLinePercent: true },
      });
    const currentAccepted = acceptedParticipants.reduce(
      (sum, participant) =>
        sum + this.decimalToOptionalNumber(participant.signedLinePercent),
      0,
    );
    const total = currentAccepted + (nextSignedLinePercent ?? 0);
    if (total > targetPercent.toNumber()) {
      throw new BadRequestException(
        'Accepted endorsement signed lines cannot exceed targetPercent',
      );
    }
  }

  private assertParticipantValues(
    status: PlacementEndorsementParticipantStatus,
    sharePercent?: number | null,
    signedLinePercent?: number | null,
  ): void {
    if (sharePercent !== undefined && sharePercent !== null) {
      if (sharePercent <= 0 || sharePercent > 100) {
        throw new BadRequestException(
          'Endorsement sharePercent must be greater than 0 and at most 100',
        );
      }
    }
    if (signedLinePercent !== undefined && signedLinePercent !== null) {
      if (signedLinePercent < 0 || signedLinePercent > 100) {
        throw new BadRequestException(
          'Endorsement signedLinePercent must be between 0 and 100',
        );
      }
    }
    if (
      signedLinePercent !== undefined &&
      signedLinePercent !== null &&
      sharePercent !== undefined &&
      sharePercent !== null &&
      signedLinePercent > sharePercent
    ) {
      throw new BadRequestException(
        'Endorsement signedLinePercent cannot exceed sharePercent',
      );
    }
    if (
      status === PlacementEndorsementParticipantStatus.ACCEPTED &&
      (!signedLinePercent || signedLinePercent <= 0)
    ) {
      throw new BadRequestException(
        'ACCEPTED endorsement participants require signedLinePercent greater than 0',
      );
    }
  }

  private assertEndorsementMutable(endorsement: {
    status: PlacementEndorsementStatus;
  }): void {
    const terminalStatuses: PlacementEndorsementStatus[] = [
      PlacementEndorsementStatus.CLOSED,
      PlacementEndorsementStatus.DECLINED,
      PlacementEndorsementStatus.VOID,
    ];
    if (terminalStatuses.includes(endorsement.status)) {
      throw new BadRequestException(
        'Endorsement participants cannot be changed after the endorsement is terminal',
      );
    }
  }

  private assertParticipantMutable(
    status: PlacementEndorsementParticipantStatus,
  ): void {
    const terminalStatuses: PlacementEndorsementParticipantStatus[] = [
      PlacementEndorsementParticipantStatus.DECLINED,
      PlacementEndorsementParticipantStatus.CLOSED,
    ];
    if (terminalStatuses.includes(status)) {
      throw new BadRequestException(
        'Terminal endorsement participants cannot be edited or deleted',
      );
    }
  }

  private assertParticipantTransition(
    from: PlacementEndorsementParticipantStatus,
    to: PlacementEndorsementParticipantStatus,
  ): void {
    if (from === to) return;

    const allowed: Record<
      PlacementEndorsementParticipantStatus,
      PlacementEndorsementParticipantStatus[]
    > = {
      [PlacementEndorsementParticipantStatus.INVITED]: [
        PlacementEndorsementParticipantStatus.OFFER_SENT,
        PlacementEndorsementParticipantStatus.DECLINED,
      ],
      [PlacementEndorsementParticipantStatus.OFFER_SENT]: [
        PlacementEndorsementParticipantStatus.QUOTED,
        PlacementEndorsementParticipantStatus.ACCEPTED,
        PlacementEndorsementParticipantStatus.DECLINED,
      ],
      [PlacementEndorsementParticipantStatus.QUOTED]: [
        PlacementEndorsementParticipantStatus.ACCEPTED,
        PlacementEndorsementParticipantStatus.DECLINED,
      ],
      [PlacementEndorsementParticipantStatus.ACCEPTED]: [
        PlacementEndorsementParticipantStatus.CLOSED,
      ],
      [PlacementEndorsementParticipantStatus.DECLINED]: [],
      [PlacementEndorsementParticipantStatus.CLOSED]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move endorsement participant from ${from} to ${to}`,
      );
    }
  }

  private calculateAggregates(
    participants: Array<{
      status: PlacementEndorsementParticipantStatus;
      sharePercent: Prisma.Decimal | null;
      signedLinePercent: Prisma.Decimal | null;
    }>,
    targetPercent: Prisma.Decimal | null,
  ): EndorsementParticipantAggregates {
    const totalOfferedPercent = participants.reduce(
      (sum, participant) =>
        sum + this.decimalToOptionalNumber(participant.sharePercent),
      0,
    );
    const totalAcceptedPercent = participants
      .filter((participant) => this.countsAsAccepted(participant.status))
      .reduce(
        (sum, participant) =>
          sum + this.decimalToOptionalNumber(participant.signedLinePercent),
        0,
      );
    const declinedPercent = participants
      .filter(
        (participant) =>
          participant.status === PlacementEndorsementParticipantStatus.DECLINED,
      )
      .reduce(
        (sum, participant) =>
          sum + this.decimalToOptionalNumber(participant.sharePercent),
        0,
      );

    return {
      totalOfferedPercent,
      totalAcceptedPercent,
      remainingPercent: targetPercent
        ? Math.max(0, targetPercent.toNumber() - totalAcceptedPercent)
        : null,
      declinedPercent,
    };
  }

  private countsAsAccepted(
    status: PlacementEndorsementParticipantStatus,
  ): boolean {
    const acceptedStatuses: PlacementEndorsementParticipantStatus[] = [
      PlacementEndorsementParticipantStatus.ACCEPTED,
      PlacementEndorsementParticipantStatus.CLOSED,
    ];
    return acceptedStatuses.includes(status);
  }

  private toDecimalInput(value?: number): Prisma.Decimal | undefined {
    if (value === undefined) return undefined;
    return new Prisma.Decimal(value);
  }

  private decimalToOptionalNumber(value: Prisma.Decimal | null): number {
    return value ? value.toNumber() : 0;
  }

  private cleanOptional(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    const cleaned = value.trim();
    return cleaned ? cleaned : null;
  }
}
