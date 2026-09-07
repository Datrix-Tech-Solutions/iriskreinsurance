import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../prisma/generated/client';
import {
  ClosingSnapshot,
  ClosingSnapshotReader,
} from './closings/closing-snapshot.reader';

type EffectiveEndorsementForPosition = {
  id: string;
  endorsementNumber: string;
  effectiveDate: Date;
  createdAt: Date;
  closings: Array<{
    id: string;
    status: PlacementClosingStatus;
  }>;
};

export type EffectivePositionAtDate = {
  placementId: string;
  asOfDate: Date;
  snapshots: ClosingSnapshot[];
  sourcePlacementClosingIds: string[];
  sourceEndorsementClosingIds: string[];
  sourceEndorsementIds: string[];
  effectiveEndorsementSequence: Array<{
    id: string;
    endorsementNumber: string;
    effectiveDate: Date;
  }>;
};

@Injectable()
export class PlacementEffectivePositionService {
  constructor(private readonly closingSnapshotReader: ClosingSnapshotReader) {}

  async getEffectivePositionAtDate(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    asOfDate: Date,
  ): Promise<EffectivePositionAtDate> {
    await this.assertPlacementExists(tx, tenantId, placementId);

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
        this.findEffectiveEndorsements(tx, tenantId, placementId, asOfDate),
      ]);

    const confirmedEndorsementClosingIds = new Set(
      endorsements.flatMap((endorsement) =>
        endorsement.closings
          .filter(
            (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
          )
          .map((closing) => closing.id),
      ),
    );
    const eligibleEndorsementSnapshots = endorsementSnapshots.filter(
      (snapshot) => confirmedEndorsementClosingIds.has(snapshot.closingId),
    );
    const snapshots = this.composeEffectiveSnapshots(
      placementSnapshots,
      eligibleEndorsementSnapshots,
      endorsements,
    );

    return {
      placementId,
      asOfDate,
      snapshots,
      sourcePlacementClosingIds: snapshots
        .filter((snapshot) => snapshot.sourceType === 'PLACEMENT_CLOSING')
        .map((snapshot) => snapshot.closingId),
      sourceEndorsementClosingIds: snapshots
        .filter((snapshot) => snapshot.sourceType === 'ENDORSEMENT_CLOSING')
        .map((snapshot) => snapshot.closingId),
      sourceEndorsementIds: endorsements.map((endorsement) => endorsement.id),
      effectiveEndorsementSequence: endorsements.map((endorsement) => ({
        id: endorsement.id,
        endorsementNumber: endorsement.endorsementNumber,
        effectiveDate: endorsement.effectiveDate,
      })),
    };
  }

  private async assertPlacementExists(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');
  }

  private findEffectiveEndorsements(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    asOfDate: Date,
  ): Promise<EffectiveEndorsementForPosition[]> {
    return tx.placementEndorsement.findMany({
      where: {
        tenantId,
        placementId,
        status: PlacementEndorsementStatus.CLOSED,
        effectiveDate: { lte: asOfDate },
      },
      select: {
        id: true,
        endorsementNumber: true,
        effectiveDate: true,
        createdAt: true,
        closings: {
          select: {
            id: true,
            status: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [
        { effectiveDate: 'asc' },
        { createdAt: 'asc' },
        { endorsementNumber: 'asc' },
        { id: 'asc' },
      ],
    });
  }

  private composeEffectiveSnapshots(
    placementSnapshots: ClosingSnapshot[],
    endorsementSnapshots: ClosingSnapshot[],
    endorsements: EffectiveEndorsementForPosition[],
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
        }
        effectiveSnapshots.push(snapshot);
      }
    }

    return effectiveSnapshots;
  }
}
