import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementParticipantStatus,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePlacementClosingStatusDto } from '../dto/update-placement-closing-status.dto';

const closingInclude = {
  participant: {
    include: {
      counterparty: {
        select: {
          id: true,
          type: true,
          name: true,
          registrationNumber: true,
        },
      },
    },
  },
} satisfies Prisma.PlacementClosingInclude;

type PlacementClosingRecord = Prisma.PlacementClosingGetPayload<{
  include: typeof closingInclude;
}>;

@Injectable()
export class PlacementClosingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementClosingRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementClosing.findMany({
      where: { tenantId, placementId },
      include: closingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    closingId: string,
  ): Promise<PlacementClosingRecord> {
    await this.assertPlacement(tenantId, placementId);
    const closing = await this.prisma.placementClosing.findFirst({
      where: { id: closingId, tenantId, placementId },
      include: closingInclude,
    });
    if (!closing) throw new NotFoundException('Placement closing not found');
    return closing;
  }

  async create(
    user: RequestUser,
    placementId: string,
    participantId: string,
  ): Promise<PlacementClosingRecord> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId: user.tenantId, archivedAt: null },
      select: {
        id: true,
        tenantId: true,
        premium: true,
        commission: true,
        currency: true,
        sumInsured: true,
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');
    if (placement.premium === null) {
      throw new BadRequestException(
        'Placement premium is required before creating a closing',
      );
    }
    const placementSnapshot = {
      premium: placement.premium,
      commission: placement.commission,
      currency: placement.currency,
      sumInsured: placement.sumInsured,
    };

    const participant = await this.prisma.placementParticipant.findFirst({
      where: {
        id: participantId,
        tenantId: user.tenantId,
        placementId,
      },
    });
    if (!participant) {
      throw new NotFoundException('Placement participant not found');
    }

    if (participant.status !== PlacementParticipantStatus.ACCEPTED) {
      throw new BadRequestException(
        'Closing can only be created for accepted participants',
      );
    }

    const signedLinePercent = this.toNumber(participant.signedLinePercent);
    if (signedLinePercent <= 0) {
      throw new BadRequestException(
        'Participant must have a signed line percentage greater than zero',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingActive = await tx.placementClosing.findFirst({
        where: {
          tenantId: user.tenantId,
          placementId,
          participantId,
          status: { not: PlacementClosingStatus.VOID },
        },
      });
      if (existingActive) {
        throw new ConflictException(
          'An active closing already exists for this participant',
        );
      }

      const count = await tx.placementClosing.count({
        where: { tenantId: user.tenantId, placementId },
      });
      const closingNumber = `CLO-${String(count + 1).padStart(3, '0')}`;
      const snapshot = this.computeSnapshot(
        placementSnapshot,
        participant,
        signedLinePercent,
      );

      return tx.placementClosing.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          participantId,
          closingNumber,
          status: PlacementClosingStatus.DRAFT,
          createdByUserId: user.id,
          ...snapshot,
        },
        include: closingInclude,
      });
    });
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    closingId: string,
    dto: UpdatePlacementClosingStatusDto,
  ): Promise<PlacementClosingRecord> {
    const closing = await this.findOne(user.tenantId, placementId, closingId);
    if (closing.status === dto.status) return closing;
    this.assertStatusTransition(closing.status, dto.status);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.placementClosing.update({
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
        include: closingInclude,
      });

      if (dto.status === PlacementClosingStatus.CONFIRMED) {
        await tx.placementParticipant.updateMany({
          where: {
            id: updated.participantId,
            tenantId: user.tenantId,
            placementId,
          },
          data: { status: PlacementParticipantStatus.CLOSED },
        });
        await this.syncPlacementClosedIfFullyConfirmed(tx, user, placementId);
      }

      return updated;
    });
  }

  private async syncPlacementClosedIfFullyConfirmed(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placementId: string,
  ): Promise<void> {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, tenantId: user.tenantId, archivedAt: null },
      select: { id: true, status: true, facultativeOffer: true },
    });
    if (!placement || placement.status !== PlacementStatus.CLOSING) return;

    const targetPercent = this.toOptionalNumber(placement.facultativeOffer);
    if (targetPercent === null || targetPercent <= 0) return;

    const confirmedClosings = await tx.placementClosing.findMany({
      where: {
        tenantId: user.tenantId,
        placementId,
        status: PlacementClosingStatus.CONFIRMED,
      },
      select: { signedLinePercent: true },
    });
    const confirmedPlacedPercent = this.roundPercent(
      confirmedClosings.reduce(
        (total, item) => total + this.toNumber(item.signedLinePercent),
        0,
      ),
    );

    if (confirmedPlacedPercent + 0.0001 < targetPercent) return;

    await tx.placementStatusHistory.create({
      data: {
        tenantId: user.tenantId,
        placementId,
        fromStatus: PlacementStatus.CLOSING,
        toStatus: PlacementStatus.CLOSED,
        changedByUserId: user.id,
        note: 'Confirmed placement closings reached facultative offer',
      },
    });

    await tx.placement.update({
      where: {
        id_tenantId: { id: placementId, tenantId: user.tenantId },
      },
      data: { status: PlacementStatus.CLOSED, updatedByUserId: user.id },
    });
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
        `Cannot move closing from ${from} to ${to}`,
      );
    }
  }

  private computeSnapshot(
    placement: {
      premium: Prisma.Decimal;
      commission: Prisma.Decimal | null;
      currency: string | null;
      sumInsured: Prisma.Decimal | null;
    },
    participant: {
      sharePercent: Prisma.Decimal | null;
      brokerageFee: Prisma.Decimal | null;
    },
    signedLinePercent: number,
  ) {
    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    const premium = this.toNumber(placement.premium);
    const commissionPct = this.toNumber(placement.commission);
    const brokeragePct = this.toNumber(participant.brokerageFee);
    const sumInsured = this.toOptionalNumber(placement.sumInsured);

    const grossPremium = (signedLinePercent / 100) * premium;
    const commissionAmount = (commissionPct / 100) * grossPremium;
    const brokerageAmount = (brokeragePct / 100) * grossPremium;
    const netPremium = grossPremium - commissionAmount - brokerageAmount;
    const sumInsuredSnapshot =
      sumInsured != null ? (signedLinePercent / 100) * sumInsured : null;

    return {
      signedLinePercent,
      sharePercent,
      sumInsuredSnapshot,
      grossPremium,
      commissionPercent: commissionPct,
      commissionAmount,
      brokeragePercent: brokeragePct,
      brokerageAmount,
      netPremium,
      currency: placement.currency,
    };
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

  private roundPercent(value: number): number {
    return Math.round(value * 10000) / 10000;
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
}
