import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosingSnapshotReader } from './closings/closing-snapshot.reader';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

describe('PlacementEffectiveViewService', () => {
  const tenantId = 'tenant-1';
  const placementId = 'placement-1';

  const placement = {
    id: placementId,
    reference: 'POL/UTC/MC/001',
    policyNumber: 'POL-001',
    title: 'Factory Fire',
    cedantId: 'cedant-1',
    riskTypeId: 'risk-type-1',
    businessDetails: { occupancy: 'Factory' },
    offerDetails: { warranty: 'Subject to survey' },
    description: 'Original placement comment',
    inceptionDate: new Date('2026-01-01T00:00:00.000Z'),
    expiryDate: new Date('2026-12-31T00:00:00.000Z'),
    currency: 'USD',
    sumInsured: '1000000.00',
    rate: '2.5000',
    premium: '100000.00',
    commission: '10.0000',
    facultativeOffer: '60.0000',
    preliminaryBrokerage: '7.5000',
  };

  const placementSnapshots = [
    {
      sourceType: 'PLACEMENT_CLOSING' as const,
      closingId: 'closing-a',
      participantId: 'participant-a',
      counterpartyId: 'reinsurer-a',
      signedLinePercent: 40,
      premium: 40000,
      commissionPercent: 10,
      commissionAmount: 4000,
      brokeragePercent: 7.5,
      brokerageAmount: 3000,
      netPremium: 33000,
      currency: 'USD',
    },
    {
      sourceType: 'PLACEMENT_CLOSING' as const,
      closingId: 'closing-b',
      participantId: 'participant-b',
      counterpartyId: 'reinsurer-b',
      signedLinePercent: 20,
      premium: 20000,
      commissionPercent: 10,
      commissionAmount: 2000,
      brokeragePercent: 7.5,
      brokerageAmount: 1500,
      netPremium: 16500,
      currency: 'USD',
    },
  ];

  const counterpartyRows = [
    {
      id: 'reinsurer-a',
      type: CounterpartyType.REINSURER,
      name: 'Avenue Re',
      registrationNumber: null,
    },
    {
      id: 'reinsurer-b',
      type: CounterpartyType.REINSURER,
      name: 'Bridge Re',
      registrationNumber: null,
    },
    {
      id: 'reinsurer-c',
      type: CounterpartyType.REINSURER,
      name: 'Cedar Re',
      registrationNumber: 'CED-001',
    },
  ];

  const makeConfirmedEndorsement = (
    overrides: Partial<Record<string, unknown>> = {},
  ) =>
    ({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      type: PlacementEndorsementType.PARTICIPANT_ADDITION,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: PlacementEndorsementStatus.CLOSED,
      effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
      createdAt: new Date('2026-06-10T09:00:00.000Z'),
      targetPercent: '70.0000',
      proposedSnapshot: {
        title: 'Factory Fire Revised',
        riskTypeId: 'risk-type-2',
        businessDetails: { occupancy: 'Expanded factory' },
        offerDetails: { warranty: 'Subject to survey and photos' },
        description: 'Revised placement terms',
        inceptionDate: '2026-01-15T00:00:00.000Z',
        expiryDate: '2027-01-14T00:00:00.000Z',
        sumInsured: '1500000.00',
        rate: '2.7500',
        premium: '150000.00',
        commission: '10.0000',
        preliminaryBrokerage: '7.5000',
        currency: 'USD',
        facultativeOffer: '70.0000',
      },
      closings: [
        {
          id: 'endorsement-closing-1',
          closingNumber: 'ENC-001',
          status: PlacementClosingStatus.CONFIRMED,
          endorsementParticipantId: 'endorsement-participant-1',
          signedLinePercent: '10.0000',
          endorsementParticipant: { counterpartyId: 'reinsurer-c' },
        },
      ],
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.CLOSED,
          signedLinePercent: '10.0000',
        },
      ],
      ...overrides,
    }) as never;

  let tx: {
    placement: { findFirst: jest.Mock };
    placementEndorsement: { findMany: jest.Mock };
    counterparty: { findMany: jest.Mock };
    placementClosing: { update: jest.Mock; create: jest.Mock };
    placementParticipant: { update: jest.Mock };
    placementEndorsementClosing: { update: jest.Mock; create: jest.Mock };
    placementNote: { update: jest.Mock; create: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };
  let closingSnapshotReader: {
    findConfirmedPlacementClosingSnapshots: jest.Mock;
    findConfirmedEndorsementClosingSnapshots: jest.Mock;
  };
  let service: PlacementEffectiveViewService;

  beforeEach(() => {
    tx = {
      placement: { findFirst: jest.fn().mockResolvedValue(placement) },
      placementEndorsement: { findMany: jest.fn().mockResolvedValue([]) },
      counterparty: { findMany: jest.fn().mockResolvedValue(counterpartyRows) },
      placementClosing: { update: jest.fn(), create: jest.fn() },
      placementParticipant: { update: jest.fn() },
      placementEndorsementClosing: { update: jest.fn(), create: jest.fn() },
      placementNote: { update: jest.fn(), create: jest.fn() },
    };
    const runTransaction = <T>(
      callback: (transaction: typeof tx) => Promise<T>,
    ): Promise<T> => callback(tx);
    prisma = {
      $transaction: jest.fn(runTransaction),
    };
    closingSnapshotReader = {
      findConfirmedPlacementClosingSnapshots: jest
        .fn()
        .mockResolvedValue(placementSnapshots),
      findConfirmedEndorsementClosingSnapshots: jest.fn().mockResolvedValue([]),
    };
    service = new PlacementEffectiveViewService(
      prisma as unknown as PrismaService,
      closingSnapshotReader as unknown as ClosingSnapshotReader,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns original confirmed position when placement has no endorsements', async () => {
    const result = await service.getEffectiveView(tenantId, placementId);

    expect(tx.placement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: placementId, tenantId, archivedAt: null },
      }),
    );
    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.viewAsOf).toEqual(expect.any(String));
    expect(result.effectiveTerms).toMatchObject({
      title: 'Factory Fire',
      policyNumber: 'POL-001',
      cedantId: 'cedant-1',
      riskTypeId: 'risk-type-1',
      businessDetails: { occupancy: 'Factory' },
      offerDetails: { warranty: 'Subject to survey' },
      description: 'Original placement comment',
      inceptionDate: '2026-01-01T00:00:00.000Z',
      expiryDate: '2026-12-31T00:00:00.000Z',
      currency: 'USD',
      sumInsured: 1000000,
      rate: 2.5,
      premium: 100000,
      commissionPercent: 10,
      brokeragePercent: 7.5,
      facultativeOfferPercent: 60,
    });
    expect(result.capacityBreakdown).toMatchObject({
      originalCapacityPercent: 60,
      acceptedEndorsementCapacityPercent: 0,
      confirmedEndorsementCapacityPercent: 0,
      remainingCapacityPercent: 0,
      effectiveTotalCapacityPercent: 60,
    });
    expect(result.effectiveTotals.grossPremium).toBe(60000);
    expect(result.effectiveParticipants).toHaveLength(2);
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([]);
  });

  it('adds a capacity increase endorsement delta to the effective share', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementId: 'endorsement-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 10,
          premium: 15000,
          commissionPercent: 10,
          commissionAmount: 1500,
          brokeragePercent: 7.5,
          brokerageAmount: 1125,
          netPremium: 12375,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement(),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(70);
    expect(result.capacityBreakdown).toMatchObject({
      originalCapacityPercent: 60,
      acceptedEndorsementCapacityPercent: 0,
      confirmedEndorsementCapacityPercent: 10,
      remainingCapacityPercent: 0,
      effectiveTotalCapacityPercent: 70,
    });
    expect(result.effectiveTotals.sumInsured).toBe(1500000);
    expect(result.effectiveTotals.rate).toBe(2.75);
    expect(result.effectiveTotals.premium).toBe(150000);
    expect(result.effectiveTerms).toMatchObject({
      title: 'Factory Fire Revised',
      riskTypeId: 'risk-type-2',
      businessDetails: { occupancy: 'Expanded factory' },
      offerDetails: { warranty: 'Subject to survey and photos' },
      description: 'Revised placement terms',
      inceptionDate: '2026-01-15T00:00:00.000Z',
      expiryDate: '2027-01-14T00:00:00.000Z',
      currency: 'USD',
      sumInsured: 1500000,
      rate: 2.75,
      premium: 150000,
      facultativeOfferPercent: 70,
    });
    expect(result.effectiveParticipants).toHaveLength(3);
    expect(
      result.effectiveParticipants.find(
        (participant) => participant.counterpartyId === 'reinsurer-c',
      )?.participationType,
    ).toBe('ADDED');
    expect(result.appliedEndorsements).toHaveLength(1);
    expect(result.appliedEndorsements[0].confirmedClosings[0]).toMatchObject({
      id: 'endorsement-closing-1',
      counterpartyId: 'reinsurer-c',
      signedLinePercent: 10,
    });
    expect(
      result.effectiveParticipants.find(
        (participant) => participant.counterpartyId === 'reinsurer-c',
      )?.sources[0],
    ).toMatchObject({
      sourceType: 'ENDORSEMENT_CLOSING',
      closingId: 'endorsement-closing-1',
      endorsementId: 'endorsement-1',
    });
  });

  it('aggregates an existing reinsurer taking an endorsement delta', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 50,
          premium: 75000,
          commissionPercent: 10,
          commissionAmount: 7500,
          brokeragePercent: 7.5,
          brokerageAmount: 5625,
          netPremium: 61875,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        closings: [
          {
            id: 'endorsement-closing-1',
            closingNumber: 'ENC-001',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-1',
            signedLinePercent: '50.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-a' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);
    const avenue = result.effectiveParticipants.find(
      (participant) => participant.counterpartyId === 'reinsurer-a',
    );

    expect(avenue?.signedLinePercent).toBe(50);
    expect(avenue?.participationType).toBe('REVISED');
    expect(avenue?.sources).toEqual([
      expect.objectContaining({
        sourceType: 'ENDORSEMENT_CLOSING',
        originalParticipantId: 'participant-a',
        signedLinePercent: 50,
      }),
    ]);
  });

  it('reports accepted endorsement capacity separately until it is confirmed into closings', async () => {
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        status: PlacementEndorsementStatus.MARKETING,
        closings: [],
        participants: [
          {
            id: 'endorsement-participant-1',
            status: PlacementEndorsementParticipantStatus.ACCEPTED,
            signedLinePercent: '10.0000',
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.capacityBreakdown).toMatchObject({
      originalCapacityPercent: 60,
      acceptedEndorsementCapacityPercent: 10,
      confirmedEndorsementCapacityPercent: 0,
      remainingCapacityPercent: 0,
      effectiveTotalCapacityPercent: 60,
    });
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toHaveLength(1);
  });

  it.each([
    PlacementEndorsementStatus.DRAFT,
    PlacementEndorsementStatus.MARKETING,
    PlacementEndorsementStatus.ACCEPTED,
    PlacementEndorsementStatus.CLOSING,
  ])(
    'does not apply a %s endorsement even when it has confirmed closing rows',
    async (status) => {
      closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
        [
          {
            sourceType: 'ENDORSEMENT_CLOSING',
            closingId: 'endorsement-closing-1',
            endorsementParticipantId: 'endorsement-participant-1',
            counterpartyId: 'reinsurer-c',
            signedLinePercent: 10,
            premium: 15000,
            commissionPercent: 10,
            commissionAmount: 1500,
            brokeragePercent: 7.5,
            brokerageAmount: 1125,
            netPremium: 12375,
            currency: 'USD',
          },
        ],
      );
      tx.placementEndorsement.findMany.mockResolvedValue([
        makeConfirmedEndorsement({ status }),
      ]);

      const result = await service.getEffectiveView(
        tenantId,
        placementId,
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
      expect(result.effectiveParticipants).toHaveLength(2);
      expect(result.appliedEndorsements).toEqual([]);
      expect(result.scheduledEndorsements).toEqual([]);
      expect(result.pendingEndorsements).toEqual([
        expect.objectContaining({
          id: 'endorsement-1',
          status,
        }),
      ]);
    },
  );

  it('reports a closed future-dated endorsement as scheduled without applying it', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 10,
          premium: 15000,
          commissionPercent: 10,
          commissionAmount: 1500,
          brokeragePercent: 7.5,
          brokerageAmount: 1125,
          netPremium: 12375,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        effectiveDate: new Date('2026-09-01T00:00:00.000Z'),
      }),
    ]);

    const result = await service.getEffectiveView(
      tenantId,
      placementId,
      new Date('2026-08-01T00:00:00.000Z'),
    );

    expect(result.viewAsOf).toBe('2026-08-01T00:00:00.000Z');
    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.effectiveParticipants).toHaveLength(2);
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([]);
    expect(result.scheduledEndorsements).toEqual([
      expect.objectContaining({
        id: 'endorsement-1',
        status: PlacementEndorsementStatus.CLOSED,
        confirmedClosingCount: 1,
      }),
    ]);
  });

  it('applies a closed endorsement once its effective date is reached', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 10,
          premium: 15000,
          commissionPercent: 10,
          commissionAmount: 1500,
          brokeragePercent: 7.5,
          brokerageAmount: 1125,
          netPremium: 12375,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        effectiveDate: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ]);

    const result = await service.getEffectiveView(
      tenantId,
      placementId,
      new Date('2026-08-01T00:00:00.000Z'),
    );

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(70);
    expect(result.effectiveParticipants).toHaveLength(3);
    expect(result.appliedEndorsements).toHaveLength(1);
    expect(result.scheduledEndorsements).toEqual([]);
  });

  it('does not expose declined endorsements as applied, scheduled or pending', async () => {
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        status: PlacementEndorsementStatus.DECLINED,
      }),
    ]);

    const result = await service.getEffectiveView(
      tenantId,
      placementId,
      new Date('2026-07-01T00:00:00.000Z'),
    );

    expect(result.appliedEndorsements).toEqual([]);
    expect(result.scheduledEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([]);
  });

  it('replaces an absolute revised facultative offer instead of adding it to the base', async () => {
    tx.placement.findFirst.mockResolvedValue({
      ...placement,
      facultativeOffer: '40.0000',
    });
    closingSnapshotReader.findConfirmedPlacementClosingSnapshots.mockResolvedValue(
      [placementSnapshots[0]],
    );
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 45,
          premium: 45000,
          commissionPercent: 10,
          commissionAmount: 4500,
          brokeragePercent: 7.5,
          brokerageAmount: 3375,
          netPremium: 37125,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        targetPercent: '5.0000',
        proposedSnapshot: {
          facultativeOffer: '45.0000',
          premium: '100000.00',
          currency: 'USD',
        },
        closings: [
          {
            id: 'endorsement-closing-1',
            closingNumber: 'ENC-001',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-1',
            signedLinePercent: '45.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-a' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.basePlacement.facultativeOfferPercent).toBe(40);
    expect(result.effectiveTotals.facultativeOfferPercent).toBe(45);
    expect(result.effectiveTotals.facultativeOfferPercent).not.toBe(85);
    expect(result.effectiveParticipants).toEqual([
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        signedLinePercent: 45,
        participationType: 'REVISED',
      }),
    ]);
  });

  it('uses confirmed endorsement closing snapshots, not proposed target capacity, after force close', async () => {
    tx.placement.findFirst.mockResolvedValue({
      ...placement,
      facultativeOffer: '70.0000',
    });
    closingSnapshotReader.findConfirmedPlacementClosingSnapshots.mockResolvedValue(
      [
        {
          ...placementSnapshots[0],
          signedLinePercent: 40,
          premium: 40000,
        },
        {
          ...placementSnapshots[1],
          signedLinePercent: 30,
          premium: 30000,
        },
      ],
    );
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 5,
          premium: 7500,
          commissionPercent: 10,
          commissionAmount: 750,
          brokeragePercent: 7.5,
          brokerageAmount: 562.5,
          netPremium: 6187.5,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        targetPercent: '80.0000',
        proposedSnapshot: {
          facultativeOffer: '80.0000',
          premium: '150000.00',
          currency: 'USD',
        },
        closings: [
          {
            id: 'endorsement-closing-1',
            closingNumber: 'ENC-001',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-1',
            signedLinePercent: '5.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-c' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(75);
    expect(result.effectiveTerms.facultativeOfferPercent).toBe(75);
    expect(result.capacityBreakdown).toMatchObject({
      originalCapacityPercent: 70,
      confirmedEndorsementCapacityPercent: 5,
      effectiveTotalCapacityPercent: 75,
      remainingCapacityPercent: 0,
    });
    expect(result.effectiveTotals.grossPremium).toBe(77500);
    expect(
      result.effectiveParticipants.map(
        (participant) => participant.signedLinePercent,
      ),
    ).toEqual([40, 30, 5]);
  });

  it('requests endorsements in effective-date order with deterministic created order', async () => {
    await service.getEffectiveView(tenantId, placementId);

    expect(tx.placementEndorsement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { effectiveDate: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      }),
    );
  });

  it('replaces a prior endorsement-added participant for the same counterparty', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-c1',
          endorsementParticipantId: 'endorsement-participant-c1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 10,
          premium: 15000,
          commissionPercent: 10,
          commissionAmount: 1500,
          brokeragePercent: 7.5,
          brokerageAmount: 1125,
          netPremium: 12375,
          currency: 'USD',
        },
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-c2',
          endorsementParticipantId: 'endorsement-participant-c2',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 15,
          premium: 22500,
          commissionPercent: 10,
          commissionAmount: 2250,
          brokeragePercent: 7.5,
          brokerageAmount: 1687.5,
          netPremium: 18562.5,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
        proposedSnapshot: {
          facultativeOffer: '70.0000',
        },
        closings: [
          {
            id: 'endorsement-closing-c1',
            closingNumber: 'ENC-001',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-c1',
            signedLinePercent: '10.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-c' },
          },
        ],
      }),
      makeConfirmedEndorsement({
        id: 'endorsement-2',
        endorsementNumber: 'END-002',
        effectiveDate: new Date('2026-06-20T00:00:00.000Z'),
        proposedSnapshot: {
          facultativeOffer: '75.0000',
        },
        closings: [
          {
            id: 'endorsement-closing-c2',
            closingNumber: 'ENC-002',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-c2',
            signedLinePercent: '15.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-c' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);
    const cedar = result.effectiveParticipants.find(
      (participant) => participant.counterpartyId === 'reinsurer-c',
    );

    expect(cedar?.signedLinePercent).toBe(15);
    expect(cedar?.grossPremium).toBe(22500);
    expect(cedar?.sources).toEqual([
      expect.objectContaining({
        closingId: 'endorsement-closing-c2',
        signedLinePercent: 15,
      }),
    ]);
  });

  it('applies multiple absolute endorsement revisions in effective-date order from the query result', async () => {
    tx.placement.findFirst.mockResolvedValue({
      ...placement,
      facultativeOffer: '40.0000',
    });
    closingSnapshotReader.findConfirmedPlacementClosingSnapshots.mockResolvedValue(
      [placementSnapshots[0]],
    );
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 45,
          premium: 45000,
          commissionPercent: 10,
          commissionAmount: 4500,
          brokeragePercent: 7.5,
          brokerageAmount: 3375,
          netPremium: 37125,
          currency: 'USD',
        },
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-2',
          endorsementParticipantId: 'endorsement-participant-2',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 50,
          premium: 60000,
          commissionPercent: 10,
          commissionAmount: 6000,
          brokeragePercent: 7.5,
          brokerageAmount: 4500,
          netPremium: 49500,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        proposedSnapshot: {
          facultativeOffer: '45.0000',
          premium: '110000.00',
        },
      }),
      makeConfirmedEndorsement({
        id: 'endorsement-2',
        endorsementNumber: 'END-002',
        effectiveDate: new Date('2026-06-20T00:00:00.000Z'),
        proposedSnapshot: {
          facultativeOffer: '50.0000',
          premium: '120000.00',
        },
        closings: [
          {
            id: 'endorsement-closing-2',
            closingNumber: 'ENC-002',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-2',
            signedLinePercent: '50.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-a' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(50);
    expect(result.effectiveTotals.premium).toBe(120000);
    expect(result.effectiveParticipants).toEqual([
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        signedLinePercent: 50,
        participationType: 'REVISED',
      }),
    ]);
  });

  it('does not apply unconfirmed endorsement closings and reports them as pending', async () => {
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        id: 'endorsement-2',
        endorsementNumber: 'END-002',
        status: PlacementEndorsementStatus.MARKETING,
        closings: [
          {
            id: 'endorsement-closing-2',
            closingNumber: 'ENC-002',
            status: PlacementClosingStatus.ISSUED,
            endorsementParticipantId: 'endorsement-participant-2',
            signedLinePercent: '10.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-c' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.effectiveParticipants).toHaveLength(2);
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([
      expect.objectContaining({
        id: 'endorsement-2',
        endorsementNumber: 'END-002',
        status: PlacementEndorsementStatus.MARKETING,
      }),
    ]);
  });

  it('does not apply confirmed closings from void endorsements', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 10,
          premium: 15000,
          commissionPercent: 10,
          commissionAmount: 1500,
          brokeragePercent: 7.5,
          brokerageAmount: 1125,
          netPremium: 12375,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        status: PlacementEndorsementStatus.VOID,
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.effectiveParticipants).toHaveLength(2);
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([]);
  });

  it.each([
    PlacementEndorsementImpactType.TERMS_ONLY,
    PlacementEndorsementImpactType.ADMINISTRATIVE,
  ])(
    'applies a closed %s endorsement without inventing capacity closings',
    async (impactType) => {
      tx.placementEndorsement.findMany.mockResolvedValue([
        makeConfirmedEndorsement({
          type: PlacementEndorsementType.PREMIUM_ADJUSTMENT,
          impactType,
          status: PlacementEndorsementStatus.CLOSED,
          targetPercent: null,
          proposedSnapshot: {
            premium: '120000.00',
            currency: 'USD',
          },
          closings: [],
        }),
      ]);

      const result = await service.getEffectiveView(tenantId, placementId);

      expect(result.effectiveTotals.premium).toBe(120000);
      expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
      expect(result.effectiveParticipants).toHaveLength(2);
      expect(result.appliedEndorsements).toHaveLength(1);
      expect(result.appliedEndorsements[0].confirmedClosings).toEqual([]);
      expect(result.pendingEndorsements).toEqual([]);
      expect(result.warnings).toContain(
        'Closed non-capacity endorsement terms are applied to the effective placement fields; closing-derived premium amounts remain based on confirmed closing snapshots.',
      );
    },
  );

  it('does not mutate placement, closings, notes or participants', async () => {
    await service.getEffectiveView(tenantId, placementId);

    expect(tx.placementClosing.update).not.toHaveBeenCalled();
    expect(tx.placementClosing.create).not.toHaveBeenCalled();
    expect(tx.placementParticipant.update).not.toHaveBeenCalled();
    expect(tx.placementEndorsementClosing.update).not.toHaveBeenCalled();
    expect(tx.placementEndorsementClosing.create).not.toHaveBeenCalled();
    expect(tx.placementNote.update).not.toHaveBeenCalled();
    expect(tx.placementNote.create).not.toHaveBeenCalled();
  });
});
