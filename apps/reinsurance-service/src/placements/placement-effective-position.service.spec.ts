import {
  PlacementClosingStatus,
  PlacementEndorsementStatus,
} from '../../prisma/generated/client';
import { ClosingSnapshotReader } from './closings/closing-snapshot.reader';
import { PlacementEffectivePositionService } from './placement-effective-position.service';

describe('PlacementEffectivePositionService', () => {
  const tenantId = 'tenant-1';
  const placementId = 'placement-1';
  const asOfDate = new Date('2026-08-01T00:00:00.000Z');

  const placementSnapshotA = {
    sourceType: 'PLACEMENT_CLOSING' as const,
    closingId: 'closing-a',
    participantId: 'participant-a',
    counterpartyId: 'reinsurer-a',
    signedLinePercent: 60,
    premium: 6000,
    commissionPercent: 10,
    commissionAmount: 600,
    brokeragePercent: 7.5,
    brokerageAmount: 450,
    netPremium: 4950,
    currency: 'GHS',
  };

  const placementSnapshotB = {
    sourceType: 'PLACEMENT_CLOSING' as const,
    closingId: 'closing-b',
    participantId: 'participant-b',
    counterpartyId: 'reinsurer-b',
    signedLinePercent: 40,
    premium: 4000,
    commissionPercent: 10,
    commissionAmount: 400,
    brokeragePercent: 7.5,
    brokerageAmount: 300,
    netPremium: 3300,
    currency: 'GHS',
  };

  const replacementSnapshotA = {
    sourceType: 'ENDORSEMENT_CLOSING' as const,
    closingId: 'endorsement-closing-a',
    endorsementParticipantId: 'endorsement-participant-a',
    originalParticipantId: 'participant-a',
    counterpartyId: 'reinsurer-a',
    signedLinePercent: 40,
    premium: 4000,
    commissionPercent: 10,
    commissionAmount: 400,
    brokeragePercent: 7.5,
    brokerageAmount: 300,
    netPremium: 3300,
    currency: 'GHS',
  };

  const addedSnapshotC = {
    sourceType: 'ENDORSEMENT_CLOSING' as const,
    closingId: 'endorsement-closing-c',
    endorsementParticipantId: 'endorsement-participant-c',
    originalParticipantId: null,
    counterpartyId: 'reinsurer-c',
    signedLinePercent: 20,
    premium: 2000,
    commissionPercent: 10,
    commissionAmount: 200,
    brokeragePercent: 7.5,
    brokerageAmount: 150,
    netPremium: 1650,
    currency: 'GHS',
  };

  let tx: {
    placement: { findFirst: jest.Mock };
    placementEndorsement: { findMany: jest.Mock };
  };
  let closingSnapshotReader: {
    findConfirmedPlacementClosingSnapshots: jest.Mock;
    findConfirmedEndorsementClosingSnapshots: jest.Mock;
  };
  let service: PlacementEffectivePositionService;

  beforeEach(() => {
    tx = {
      placement: {
        findFirst: jest.fn().mockResolvedValue({ id: placementId }),
      },
      placementEndorsement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    closingSnapshotReader = {
      findConfirmedPlacementClosingSnapshots: jest
        .fn()
        .mockResolvedValue([placementSnapshotA, placementSnapshotB]),
      findConfirmedEndorsementClosingSnapshots: jest.fn().mockResolvedValue([]),
    };
    service = new PlacementEffectivePositionService(
      closingSnapshotReader as unknown as ClosingSnapshotReader,
    );
  });

  it('returns original placement snapshots when no closed endorsement is effective by the as-of date', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [addedSnapshotC],
    );

    const result = await service.getEffectivePositionAtDate(
      tx as never,
      tenantId,
      placementId,
      asOfDate,
    );

    expect(tx.placementEndorsement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          placementId,
          status: PlacementEndorsementStatus.CLOSED,
          effectiveDate: { lte: asOfDate },
        },
      }),
    );
    expect(result.snapshots).toEqual([placementSnapshotA, placementSnapshotB]);
    expect(result.sourceEndorsementClosingIds).toEqual([]);
  });

  it('applies closed endorsement additions and replacements chronologically', async () => {
    tx.placementEndorsement.findMany.mockResolvedValue([
      {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
        closings: [
          {
            id: 'endorsement-closing-a',
            status: PlacementClosingStatus.CONFIRMED,
          },
          {
            id: 'endorsement-closing-c',
            status: PlacementClosingStatus.CONFIRMED,
          },
        ],
      },
    ]);
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [replacementSnapshotA, addedSnapshotC],
    );

    const result = await service.getEffectivePositionAtDate(
      tx as never,
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.snapshots).toEqual([
      placementSnapshotB,
      replacementSnapshotA,
      addedSnapshotC,
    ]);
    expect(result.sourcePlacementClosingIds).toEqual(['closing-b']);
    expect(result.sourceEndorsementClosingIds).toEqual([
      'endorsement-closing-a',
      'endorsement-closing-c',
    ]);
    expect(result.sourceEndorsementIds).toEqual(['endorsement-1']);
  });

  it('ignores non-confirmed endorsement closings returned with an otherwise effective endorsement', async () => {
    tx.placementEndorsement.findMany.mockResolvedValue([
      {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
        closings: [
          {
            id: 'endorsement-closing-a',
            status: PlacementClosingStatus.ISSUED,
          },
        ],
      },
    ]);
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [replacementSnapshotA],
    );

    const result = await service.getEffectivePositionAtDate(
      tx as never,
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.snapshots).toEqual([placementSnapshotA, placementSnapshotB]);
  });
});
