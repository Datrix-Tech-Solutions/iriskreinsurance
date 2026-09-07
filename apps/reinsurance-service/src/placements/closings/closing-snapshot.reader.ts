import { Injectable } from '@nestjs/common';
import {
  PlacementClosingStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

export type ClosingSnapshotSourceType =
  | 'PLACEMENT_CLOSING'
  | 'ENDORSEMENT_CLOSING';

export type ClosingSnapshot = {
  sourceType: ClosingSnapshotSourceType;
  closingId: string;
  endorsementId?: string;
  participantId?: string;
  endorsementParticipantId?: string;
  originalParticipantId?: string | null;
  counterpartyId: string;
  signedLinePercent: number;
  premium: number | null;
  commissionPercent: number | null;
  commissionAmount: number | null;
  brokeragePercent: number | null;
  brokerageAmount: number | null;
  netPremium: number | null;
  currency: string | null;
};

@Injectable()
export class ClosingSnapshotReader {
  constructor(private readonly money: ReinsuranceMoneyHelper) {}

  async findConfirmedSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<ClosingSnapshot[]> {
    const [placementClosings, endorsementClosings] = await Promise.all([
      this.findConfirmedPlacementClosingSnapshots(tx, tenantId, placementId),
      this.findConfirmedEndorsementClosingSnapshots(tx, tenantId, placementId),
    ]);

    return [...placementClosings, ...endorsementClosings];
  }

  async findConfirmedPlacementClosingSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<ClosingSnapshot[]> {
    const closings = await tx.placementClosing.findMany({
      where: {
        tenantId,
        placementId,
        status: PlacementClosingStatus.CONFIRMED,
      },
      select: {
        id: true,
        participantId: true,
        signedLinePercent: true,
        grossPremium: true,
        commissionPercent: true,
        commissionAmount: true,
        brokeragePercent: true,
        brokerageAmount: true,
        netPremium: true,
        currency: true,
        participant: {
          select: {
            counterpartyId: true,
          },
        },
      },
    });

    return closings.map((closing) => ({
      sourceType: 'PLACEMENT_CLOSING',
      closingId: closing.id,
      participantId: closing.participantId,
      counterpartyId: closing.participant.counterpartyId,
      signedLinePercent: this.money.toNumber(closing.signedLinePercent),
      premium: this.money.toOptionalNumber(closing.grossPremium),
      commissionPercent: this.money.toOptionalNumber(closing.commissionPercent),
      commissionAmount: this.money.toOptionalNumber(closing.commissionAmount),
      brokeragePercent: this.money.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount: this.money.toOptionalNumber(closing.brokerageAmount),
      netPremium: this.money.toOptionalNumber(closing.netPremium),
      currency: closing.currency,
    }));
  }

  async findConfirmedEndorsementClosingSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<ClosingSnapshot[]> {
    const closings = await tx.placementEndorsementClosing.findMany({
      where: {
        tenantId,
        placementId,
        status: PlacementClosingStatus.CONFIRMED,
      },
      select: {
        id: true,
        endorsementId: true,
        endorsementParticipantId: true,
        signedLinePercent: true,
        premiumSnapshot: true,
        commissionPercent: true,
        commissionAmount: true,
        brokeragePercent: true,
        brokerageAmount: true,
        netPremium: true,
        currency: true,
        endorsementParticipant: {
          select: {
            counterpartyId: true,
            originalParticipantId: true,
          },
        },
      },
    });

    return closings.map((closing) => ({
      sourceType: 'ENDORSEMENT_CLOSING',
      closingId: closing.id,
      endorsementId: closing.endorsementId,
      endorsementParticipantId: closing.endorsementParticipantId,
      originalParticipantId:
        closing.endorsementParticipant.originalParticipantId,
      counterpartyId: closing.endorsementParticipant.counterpartyId,
      signedLinePercent: this.money.toNumber(closing.signedLinePercent),
      premium: this.money.toOptionalNumber(closing.premiumSnapshot),
      commissionPercent: this.money.toOptionalNumber(closing.commissionPercent),
      commissionAmount: this.money.toOptionalNumber(closing.commissionAmount),
      brokeragePercent: this.money.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount: this.money.toOptionalNumber(closing.brokerageAmount),
      netPremium: this.money.toOptionalNumber(closing.netPremium),
      currency: closing.currency,
    }));
  }
}
