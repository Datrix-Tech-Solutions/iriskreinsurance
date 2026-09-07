import {
  PlacementClosingStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { ClosingSnapshotReader } from './closing-snapshot.reader';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

describe('ClosingSnapshotReader', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  let tx: {
    placementClosing: { findMany: PrismaMethod };
    placementEndorsementClosing: { findMany: PrismaMethod };
  };
  let reader: ClosingSnapshotReader;

  beforeEach(() => {
    tx = {
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    reader = new ClosingSnapshotReader(new ReinsuranceMoneyHelper());
  });

  it('returns confirmed placement closing snapshots', async () => {
    tx.placementClosing.findMany.mockResolvedValue([
      {
        id: 'closing-1',
        participantId: 'participant-1',
        signedLinePercent: new Prisma.Decimal('40.0000'),
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('450.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('337.50'),
        netPremium: new Prisma.Decimal('3712.50'),
        currency: 'GHS',
        participant: { counterpartyId: 'reinsurer-1' },
      },
    ]);

    const snapshots = await reader.findConfirmedPlacementClosingSnapshots(
      tx as unknown as Prisma.TransactionClient,
      'tenant-1',
      'placement-1',
    );

    const findArgs = firstCallArg<Prisma.PlacementClosingFindManyArgs>(
      tx.placementClosing.findMany,
    );
    expect(findArgs.where).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      status: PlacementClosingStatus.CONFIRMED,
    });
    expect(snapshots).toEqual([
      {
        sourceType: 'PLACEMENT_CLOSING',
        closingId: 'closing-1',
        participantId: 'participant-1',
        counterpartyId: 'reinsurer-1',
        signedLinePercent: 40,
        premium: 4500,
        commissionPercent: 10,
        commissionAmount: 450,
        brokeragePercent: 7.5,
        brokerageAmount: 337.5,
        netPremium: 3712.5,
        currency: 'GHS',
      },
    ]);
  });

  it('returns confirmed endorsement closing snapshots', async () => {
    tx.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        endorsementId: 'endorsement-1',
        endorsementParticipantId: 'endorsement-participant-1',
        signedLinePercent: new Prisma.Decimal('10.0000'),
        premiumSnapshot: new Prisma.Decimal('1200.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('120.00'),
        brokeragePercent: new Prisma.Decimal('7.5000'),
        brokerageAmount: new Prisma.Decimal('90.00'),
        netPremium: new Prisma.Decimal('990.00'),
        currency: 'GHS',
        endorsementParticipant: {
          counterpartyId: 'reinsurer-2',
          originalParticipantId: 'participant-2',
        },
      },
    ]);

    const snapshots = await reader.findConfirmedEndorsementClosingSnapshots(
      tx as unknown as Prisma.TransactionClient,
      'tenant-1',
      'placement-1',
    );

    const findArgs =
      firstCallArg<Prisma.PlacementEndorsementClosingFindManyArgs>(
        tx.placementEndorsementClosing.findMany,
      );
    expect(findArgs.where).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      status: PlacementClosingStatus.CONFIRMED,
    });
    expect(snapshots).toEqual([
      {
        sourceType: 'ENDORSEMENT_CLOSING',
        closingId: 'endorsement-closing-1',
        endorsementId: 'endorsement-1',
        endorsementParticipantId: 'endorsement-participant-1',
        originalParticipantId: 'participant-2',
        counterpartyId: 'reinsurer-2',
        signedLinePercent: 10,
        premium: 1200,
        commissionPercent: 10,
        commissionAmount: 120,
        brokeragePercent: 7.5,
        brokerageAmount: 90,
        netPremium: 990,
        currency: 'GHS',
      },
    ]);
  });
});
