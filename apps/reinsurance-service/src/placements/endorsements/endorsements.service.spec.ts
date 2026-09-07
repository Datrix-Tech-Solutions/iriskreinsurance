import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementStatus,
  PlacementType,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import { PlacementEndorsementsService } from './endorsements.service';

describe('PlacementEndorsementsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE' as const,
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [] as string[],
  };

  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    reference: 'FAC-001',
    normalizedReference: 'fac-001',
    policyNumber: 'POL-001',
    title: 'Energy Risk',
    placementType: PlacementType.FACULTATIVE,
    status: PlacementStatus.CLOSED,
    cedantId: 'cedant-1',
    riskTypeId: 'risk-type-1',
    classOfBusiness: null,
    businessDetails: { location: 'Accra' },
    offerDetails: { notes: 'Original offer' },
    description: 'Original placement',
    inceptionDate: new Date('2026-06-01T00:00:00.000Z'),
    expiryDate: new Date('2027-06-01T00:00:00.000Z'),
    currency: 'USD',
    exchangeRateToBase: new Prisma.Decimal('1.000000'),
    sumInsured: new Prisma.Decimal('100000.00'),
    rate: new Prisma.Decimal('2.5000'),
    premium: new Prisma.Decimal('2500.00'),
    commission: new Prisma.Decimal('10.0000'),
    facultativeOffer: new Prisma.Decimal('70.0000'),
    preliminaryBrokerage: new Prisma.Decimal('7.5000'),
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedByUserId: null,
    archivedAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    participants: [
      {
        id: 'participant-1',
        counterpartyId: 'reinsurer-1',
        role: 'REINSURER',
        status: 'ACCEPTED',
        sharePercent: new Prisma.Decimal('40.0000'),
        signedLinePercent: new Prisma.Decimal('30.0000'),
        brokerageFee: new Prisma.Decimal('7.50'),
        notes: null,
      },
    ],
    closings: [
      {
        id: 'closing-1',
        participantId: 'participant-1',
        closingNumber: 'CLO-001',
        status: 'CONFIRMED',
        signedLinePercent: new Prisma.Decimal('30.0000'),
        sharePercent: new Prisma.Decimal('40.0000'),
        grossPremium: new Prisma.Decimal('750.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('75.00'),
        brokeragePercent: new Prisma.Decimal('7.50'),
        brokerageAmount: new Prisma.Decimal('56.25'),
        netPremium: new Prisma.Decimal('618.75'),
        currency: 'USD',
        issuedAt: new Date('2026-06-02T10:00:00.000Z'),
        confirmedAt: new Date('2026-06-02T11:00:00.000Z'),
      },
    ],
    payments: [
      {
        id: 'payment-1',
        type: 'PREMIUM_RECEIVED',
        direction: 'INBOUND',
        amount: new Prisma.Decimal('1000.00'),
        currency: 'USD',
        status: 'RECORDED',
        paymentDate: new Date('2026-06-03T00:00:00.000Z'),
        counterpartyId: 'cedant-1',
        closingId: null,
        participantId: null,
      },
    ],
    notes: [
      {
        id: 'note-1',
        type: 'DEBIT_NOTE',
        direction: 'CEDANT_TO_BROKER',
        noteNumber: 'DN-001',
        status: 'ISSUED',
        grossAmount: new Prisma.Decimal('750.00'),
        netAmount: new Prisma.Decimal('675.00'),
        currency: 'USD',
        closingId: null,
        participantId: null,
        counterpartyId: 'cedant-1',
      },
    ],
  };

  const endorsement = {
    id: 'endorsement-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    endorsementNumber: 'END-001',
    type: PlacementEndorsementType.SUM_INSURED_INCREASE,
    impactType: PlacementEndorsementImpactType.TERMS_ONLY,
    status: PlacementEndorsementStatus.DRAFT,
    effectiveDate: new Date('2026-06-04T00:00:00.000Z'),
    reason: 'Increase sum insured',
    description: null,
    changeSummary: null,
    originalSnapshot: { placement: { id: 'placement-1' } },
    proposedSnapshot: { sumInsured: '150000.00' },
    targetPercent: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    closedAt: null,
    voidedAt: null,
    createdAt: new Date('2026-06-04T00:00:00.000Z'),
    updatedAt: new Date('2026-06-04T00:00:00.000Z'),
  };

  let prisma: {
    placement: { findFirst: PrismaMethod; update: PrismaMethod };
    placementEndorsement: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let effectiveViewService: { getEffectiveView: jest.Mock };
  let service: PlacementEndorsementsService;

  const effectiveView = {
    viewAsOf: '2026-06-04T00:00:00.000Z',
    basePlacement: {
      id: 'placement-1',
      reference: 'FAC-001',
      policyNumber: 'POL-001',
      title: 'Energy Risk',
      cedantId: 'cedant-1',
      currency: 'USD',
      sumInsured: 100000,
      premium: 2500,
      rate: 2.5,
      commissionPercent: 10,
      brokeragePercent: 7.5,
      facultativeOfferPercent: 70,
    },
    effectiveTotals: {
      facultativeOfferPercent: 70,
      originalFacultativeOfferPercent: 70,
      acceptedEndorsementCapacityPercent: 0,
      confirmedEndorsementCapacityPercent: 0,
      remainingCapacityPercent: 40,
      participantCount: 1,
      sumInsured: 100000,
      premium: 2500,
      currency: 'USD',
      rate: 2.5,
      commissionPercent: 10,
      brokeragePercent: 7.5,
      grossPremium: 750,
      commissionAmount: 75,
      brokerageAmount: 56.25,
      netPremium: 618.75,
    },
    capacityBreakdown: {
      originalCapacityPercent: 70,
      acceptedEndorsementCapacityPercent: 0,
      confirmedEndorsementCapacityPercent: 0,
      remainingCapacityPercent: 40,
      effectiveTotalCapacityPercent: 70,
    },
    effectiveTerms: {
      title: 'Energy Risk',
      policyNumber: 'POL-001',
      cedantId: 'cedant-1',
      riskTypeId: 'risk-type-1',
      businessDetails: { location: 'Accra' },
      offerDetails: { notes: 'Original offer' },
      description: 'Original placement',
      inceptionDate: '2026-06-01T00:00:00.000Z',
      expiryDate: '2027-06-01T00:00:00.000Z',
      currency: 'USD',
      sumInsured: 100000,
      rate: 2.5,
      premium: 2500,
      commissionPercent: 10,
      brokeragePercent: 7.5,
      facultativeOfferPercent: 70,
    },
    effectiveParticipants: [
      {
        counterpartyId: 'reinsurer-1',
        counterparty: {
          id: 'reinsurer-1',
          type: 'REINSURER',
          name: 'Ghana Re',
          registrationNumber: null,
        },
        signedLinePercent: 30,
        participationType: 'ORIGINAL',
        grossPremium: 750,
        commissionAmount: 75,
        brokerageAmount: 56.25,
        netPremium: 618.75,
        sources: [
          {
            sourceType: 'PLACEMENT_CLOSING',
            closingId: 'closing-1',
            participantId: 'participant-1',
            signedLinePercent: 30,
          },
        ],
      },
    ],
    appliedEndorsements: [],
    scheduledEndorsements: [],
    pendingEndorsements: [],
    warnings: [],
  };

  beforeEach(() => {
    prisma = {
      placement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    effectiveViewService = {
      getEffectiveView: jest.fn().mockResolvedValue(effectiveView),
    };
    service = new PlacementEndorsementsService(
      prisma as unknown as PrismaService,
      effectiveViewService as unknown as PlacementEffectiveViewService,
    );
  });

  it('creates an endorsement without mutating the original placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);
    prisma.placementEndorsement.create.mockResolvedValue(endorsement);

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.SUM_INSURED_INCREASE,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Increase sum insured',
      proposedSnapshot: { sumInsured: '150000.00' },
    });

    const createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      endorsementNumber: 'END-001',
      impactType: PlacementEndorsementImpactType.TERMS_ONLY,
      status: PlacementEndorsementStatus.DRAFT,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
    expect(createArgs.data.originalSnapshot).toMatchObject({
      placement: {
        id: 'placement-1',
        policyNumber: 'POL-001',
        sumInsured: 100000,
        premium: 2500,
      },
      participants: [expect.objectContaining({ id: 'participant-1' })],
      closings: [expect.objectContaining({ id: 'closing-1' })],
      payments: [expect.objectContaining({ id: 'payment-1' })],
      notes: [expect.objectContaining({ id: 'note-1' })],
    });
    expect(effectiveViewService.getEffectiveView).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      new Date('2026-06-04T00:00:00.000Z'),
    );
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('uses the latest closed effective participant lines as the next endorsement baseline', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(1);
    prisma.placementEndorsement.create.mockResolvedValue({
      ...endorsement,
      endorsementNumber: 'END-002',
    });
    effectiveViewService.getEffectiveView.mockResolvedValue({
      ...effectiveView,
      effectiveTotals: {
        ...effectiveView.effectiveTotals,
        facultativeOfferPercent: 80,
        remainingCapacityPercent: 0,
        participantCount: 2,
      },
      effectiveTerms: {
        ...effectiveView.effectiveTerms,
        facultativeOfferPercent: 80,
        premium: 3000,
      },
      effectiveParticipants: [
        {
          counterpartyId: 'reinsurer-a',
          counterparty: {
            id: 'reinsurer-a',
            type: 'REINSURER',
            name: 'A Re',
            registrationNumber: null,
          },
          signedLinePercent: 45,
          participationType: 'REVISED',
          grossPremium: 1350,
          commissionAmount: 135,
          brokerageAmount: 101.25,
          netPremium: 1113.75,
          sources: [
            {
              sourceType: 'ENDORSEMENT_CLOSING',
              closingId: 'endorsement-closing-a',
              endorsementParticipantId: 'endorsement-participant-a',
              originalParticipantId: 'participant-a',
              signedLinePercent: 45,
            },
          ],
        },
        {
          counterpartyId: 'reinsurer-b',
          counterparty: {
            id: 'reinsurer-b',
            type: 'REINSURER',
            name: 'B Re',
            registrationNumber: null,
          },
          signedLinePercent: 35,
          participationType: 'REVISED',
          grossPremium: 1050,
          commissionAmount: 105,
          brokerageAmount: 78.75,
          netPremium: 866.25,
          sources: [
            {
              sourceType: 'ENDORSEMENT_CLOSING',
              closingId: 'endorsement-closing-b',
              endorsementParticipantId: 'endorsement-participant-b',
              originalParticipantId: 'participant-b',
              signedLinePercent: 35,
            },
          ],
        },
      ],
    });

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.POLICY_AMENDMENT,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Add new capacity',
      proposedSnapshot: { facultativeOffer: '90.0000', premium: '3500.00' },
      targetPercent: 90,
    });

    const createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data.impactType).toBe(
      PlacementEndorsementImpactType.CAPACITY_INCREASE,
    );
    expect(createArgs.data.originalSnapshot).toMatchObject({
      placement: {
        premium: 3000,
        facultativeOffer: 80,
      },
      participants: [
        expect.objectContaining({
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 45,
          originalParticipantId: 'participant-a',
        }),
        expect.objectContaining({
          counterpartyId: 'reinsurer-b',
          signedLinePercent: 35,
          originalParticipantId: 'participant-b',
        }),
      ],
    });
  });

  it('summarizes endorsement-only participant capacity, closings and notes', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSED,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
        {
          id: 'endorsement-participant-2',
          status: PlacementEndorsementParticipantStatus.DECLINED,
          signedLinePercent: null,
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [
        {
          id: 'endorsement-note-1',
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: null,
        },
        {
          id: 'endorsement-note-2',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: 'endorsement-closing-1',
        },
      ],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result).toMatchObject({
      id: 'endorsement-1',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: PlacementEndorsementStatus.CLOSED,
      targetPercent: 10,
      acceptedPercent: 10,
      placedPercent: 10,
      remainingPercent: 0,
      participants: { total: 2, accepted: 1, declined: 1 },
      closings: { total: 1, confirmed: 1 },
      notes: {
        total: 2,
        endorsementDebitNotes: 1,
        endorsementCreditNotes: 1,
        issued: 2,
      },
      pendingActions: [],
      canClose: true,
      closeBlockingReasons: [],
      isComplete: true,
    });
  });

  it('returns null remaining percent when endorsement target percent is unset', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.DRAFT,
      targetPercent: null,
      participants: [],
      closings: [],
      notes: [],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.remainingPercent).toBeNull();
    expect(result.pendingActions).toContain('SEND_TO_MARKET');
    expect(result.isComplete).toBe(false);
  });

  it('does not count accepted participants as placed before confirmed endorsement closings exist', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.MARKETING,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [],
      notes: [],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.acceptedPercent).toBe(10);
    expect(result.placedPercent).toBe(0);
    expect(result.remainingPercent).toBe(10);
    expect(result.pendingActions).toContain('CREATE_CLOSING');
    expect(result.pendingActions).not.toContain('ADD_CAPACITY');
    expect(result.canClose).toBe(false);
    expect(result.closeBlockingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ACCEPTED_PARTICIPANT_NOT_VALIDATED',
        }),
      ]),
    );
    expect(result.isComplete).toBe(false);
  });

  it('reports pending actions for unconfirmed closings without treating notes as close blockers', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSING,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      targetPercent: new Prisma.Decimal('20.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
        {
          id: 'endorsement-participant-2',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
        {
          id: 'endorsement-closing-2',
          endorsementParticipantId: 'endorsement-participant-2',
          status: PlacementClosingStatus.ISSUED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [
        {
          id: 'endorsement-note-1',
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          status: PlacementNoteStatus.DRAFT,
          endorsementClosingId: null,
        },
      ],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.acceptedPercent).toBe(20);
    expect(result.placedPercent).toBe(10);
    expect(result.remainingPercent).toBe(10);
    expect(result.pendingActions).not.toContain('ADD_CAPACITY');
    expect(result.pendingActions).toEqual(
      expect.arrayContaining(['CONFIRM_CLOSING']),
    );
    expect(result.pendingActions).not.toContain('GENERATE_NOTES');
    expect(result.pendingActions).not.toContain('ISSUE_NOTES');
    expect(result.canClose).toBe(false);
    expect(result.closeBlockingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ACCEPTED_PARTICIPANT_NOT_VALIDATED' }),
        expect.objectContaining({ code: 'UNCONFIRMED_CLOSING' }),
      ]),
    );
    expect(
      result.closeBlockingReasons.map((reason) => reason.code),
    ).not.toEqual(
      expect.arrayContaining([
        'MISSING_ENDORSEMENT_DEBIT_NOTE',
        'MISSING_ENDORSEMENT_CREDIT_NOTE',
        'DRAFT_ENDORSEMENT_NOTE',
      ]),
    );
    expect(result.isComplete).toBe(false);
  });

  it('requires explicit CLOSED status before summary is complete', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSING,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [
        {
          id: 'endorsement-note-1',
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: null,
        },
        {
          id: 'endorsement-note-2',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: 'endorsement-closing-1',
        },
      ],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.pendingActions).toEqual(['CLOSE_ENDORSEMENT']);
    expect(result.canClose).toBe(true);
    expect(result.closeBlockingReasons).toEqual([]);
    expect(result.isComplete).toBe(false);
  });

  it('marks a fully validated MARKETING endorsement ready to close after closings are confirmed', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.MARKETING,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.pendingActions).toEqual(['CLOSE_ENDORSEMENT']);
    expect(result.canClose).toBe(true);
    expect(result.closeBlockingReasons).toEqual([]);
    expect(result.isComplete).toBe(false);
  });

  it('does not leave a terms-only endorsement in market when no capacity workflow is required', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.MARKETING,
      impactType: PlacementEndorsementImpactType.TERMS_ONLY,
      targetPercent: null,
      participants: [],
      closings: [],
      notes: [],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.pendingActions).toEqual(['CLOSE_ENDORSEMENT']);
    expect(result.canClose).toBe(true);
    expect(result.closeBlockingReasons).toEqual([]);
    expect(result.remainingPercent).toBeNull();
  });

  it('allows a terms-only endorsement with confirmed closings to close without financial notes', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.MARKETING,
      impactType: PlacementEndorsementImpactType.TERMS_ONLY,
      targetPercent: new Prisma.Decimal('70.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.CLOSED,
          signedLinePercent: new Prisma.Decimal('35.0000'),
        },
        {
          id: 'endorsement-participant-2',
          status: PlacementEndorsementParticipantStatus.CLOSED,
          signedLinePercent: new Prisma.Decimal('35.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('35.0000'),
        },
        {
          id: 'endorsement-closing-2',
          endorsementParticipantId: 'endorsement-participant-2',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('35.0000'),
        },
      ],
      notes: [],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.pendingActions).toEqual(['CLOSE_ENDORSEMENT']);
    expect(result.canClose).toBe(true);
    expect(result.closeBlockingReasons).toEqual([]);
  });

  it('does not let declined participants block completion when another participant places full capacity', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSED,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
        {
          id: 'endorsement-participant-2',
          status: PlacementEndorsementParticipantStatus.DECLINED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [
        {
          id: 'endorsement-note-1',
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: null,
        },
        {
          id: 'endorsement-note-2',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: 'endorsement-closing-1',
        },
      ],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.participants).toMatchObject({
      accepted: 1,
      declined: 1,
    });
    expect(result.acceptedPercent).toBe(10);
    expect(result.placedPercent).toBe(10);
    expect(result.remainingPercent).toBe(0);
    expect(result.pendingActions).toEqual([]);
    expect(result.canClose).toBe(true);
    expect(result.closeBlockingReasons).toEqual([]);
    expect(result.isComplete).toBe(true);
  });

  it('ignores VOID closings as active completion progress', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSING,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.VOID,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.closings.void).toBe(1);
    expect(result.pendingActions).toContain('CREATE_CLOSING');
    expect(result.canClose).toBe(false);
    expect(result.closeBlockingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ACCEPTED_PARTICIPANT_NOT_VALIDATED',
        }),
      ]),
    );
    expect(result.isComplete).toBe(false);
  });

  it('ignores VOID notes as active completion progress', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSING,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [
        {
          id: 'endorsement-note-1',
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          status: PlacementNoteStatus.VOID,
          endorsementClosingId: null,
        },
        {
          id: 'endorsement-note-2',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          status: PlacementNoteStatus.VOID,
          endorsementClosingId: 'endorsement-closing-1',
        },
      ],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.notes.void).toBe(2);
    expect(result.pendingActions).not.toContain('GENERATE_NOTES');
    expect(result.pendingActions).not.toContain('ISSUE_NOTES');
    expect(result.pendingActions).toEqual(['CLOSE_ENDORSEMENT']);
    expect(result.canClose).toBe(true);
    expect(result.closeBlockingReasons).toEqual([]);
    expect(result.isComplete).toBe(false);
  });

  it('classifies facultative offer increase endorsements as capacity increase', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);
    prisma.placementEndorsement.create.mockResolvedValue({
      ...endorsement,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
    });

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.PARTICIPANT_ADDITION,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Increase market capacity',
      proposedSnapshot: { facultativeOffer: '80.0000' },
    });

    const createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data.impactType).toBe(
      PlacementEndorsementImpactType.CAPACITY_INCREASE,
    );
  });

  it('classifies sum insured, premium and period changes without capacity change as terms only', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);
    prisma.placementEndorsement.create.mockResolvedValue(endorsement);

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.POLICY_AMENDMENT,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Update terms',
      proposedSnapshot: {
        sumInsured: '150000.00',
        premium: '3000.00',
        inceptionDate: '2026-07-01T00:00:00.000Z',
      },
    });

    const createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data.impactType).toBe(
      PlacementEndorsementImpactType.TERMS_ONLY,
    );
  });

  it('classifies facultative offer decrease and cancellation as decrease or cancellation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);
    prisma.placementEndorsement.create.mockResolvedValue({
      ...endorsement,
      impactType: PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
    });

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.POLICY_AMENDMENT,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Reduce capacity',
      proposedSnapshot: { facultativeOffer: '50.0000' },
    });

    let createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data.impactType).toBe(
      PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
    );

    jest.clearAllMocks();
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);
    prisma.placementEndorsement.create.mockResolvedValue({
      ...endorsement,
      impactType: PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
    });

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.CANCELLATION,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Cancel endorsement',
    });

    createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data.impactType).toBe(
      PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
    );
  });

  it('classifies description or admin-only changes as administrative', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);
    prisma.placementEndorsement.create.mockResolvedValue({
      ...endorsement,
      impactType: PlacementEndorsementImpactType.ADMINISTRATIVE,
    });

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.OTHER,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Correct wording',
      description: 'Administrative correction only',
    });

    const createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data.impactType).toBe(
      PlacementEndorsementImpactType.ADMINISTRATIVE,
    );
  });

  it('rejects explicit impact type overrides that do not match derived impact', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementEndorsementType.PARTICIPANT_ADDITION,
        impactType: PlacementEndorsementImpactType.ADMINISTRATIVE,
        effectiveDate: '2026-06-04T00:00:00.000Z',
        reason: 'Increase market capacity',
        proposedSnapshot: { facultativeOffer: '80.0000' },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementEndorsement.create).not.toHaveBeenCalled();
  });

  it('increments endorsement numbering per placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(1);
    prisma.placementEndorsement.create.mockResolvedValue({
      ...endorsement,
      endorsementNumber: 'END-002',
    });

    const result = await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.PREMIUM_ADJUSTMENT,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Adjust premium',
    });

    expect(result.endorsementNumber).toBe('END-002');
  });

  it('rejects endorsement creation before any placement closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      closings: [],
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementEndorsementType.PREMIUM_ADJUSTMENT,
        effectiveDate: '2026-06-04T00:00:00.000Z',
        reason: 'Formal premium adjustment',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementEndorsement.create).not.toHaveBeenCalled();
  });

  it('does not expose endorsements for another tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findAll('tenant-1', 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates only draft endorsements', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue(endorsement);
    prisma.placementEndorsement.update.mockResolvedValue({
      ...endorsement,
      reason: 'Updated',
    });

    await service.update(user, 'placement-1', 'endorsement-1', {
      reason: 'Updated',
    });

    const updateArgs = firstCallArg<Prisma.PlacementEndorsementUpdateArgs>(
      prisma.placementEndorsement.update,
    );
    expect(updateArgs.data).toMatchObject({
      reason: 'Updated',
      updatedByUserId: 'user-1',
    });
  });

  it('recalculates impact type when draft proposed snapshot changes', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      impactType: PlacementEndorsementImpactType.ADMINISTRATIVE,
      originalSnapshot: {
        placement: {
          facultativeOffer: '70.0000',
        },
      },
      proposedSnapshot: null,
    });
    prisma.placementEndorsement.update.mockResolvedValue({
      ...endorsement,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
    });

    await service.update(user, 'placement-1', 'endorsement-1', {
      proposedSnapshot: { facultativeOffer: '80.0000' },
    });

    const updateArgs = firstCallArg<Prisma.PlacementEndorsementUpdateArgs>(
      prisma.placementEndorsement.update,
    );
    expect(updateArgs.data).toMatchObject({
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      updatedByUserId: 'user-1',
    });
  });

  it.each([PlacementEndorsementStatus.CLOSED, PlacementEndorsementStatus.VOID])(
    'rejects edits when endorsement status is %s',
    async (status) => {
      prisma.placement.findFirst.mockResolvedValue(placement);
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        status,
      });

      await expect(
        service.update(user, 'placement-1', 'endorsement-1', {
          reason: 'Updated',
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('allows supported lifecycle transitions and stamps closedAt', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst
      .mockResolvedValueOnce({
        ...endorsement,
        status: PlacementEndorsementStatus.CLOSING,
      })
      .mockResolvedValueOnce({
        ...endorsement,
        status: PlacementEndorsementStatus.CLOSING,
        impactType: PlacementEndorsementImpactType.TERMS_ONLY,
        targetPercent: null,
        participants: [],
        closings: [],
        notes: [],
      });
    prisma.placementEndorsement.update.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSED,
      closedAt: new Date('2026-06-04T10:00:00.000Z'),
    });

    await service.changeStatus(user, 'placement-1', 'endorsement-1', {
      status: PlacementEndorsementStatus.CLOSED,
    });

    const updateArgs = firstCallArg<Prisma.PlacementEndorsementUpdateArgs>(
      prisma.placementEndorsement.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementEndorsementStatus.CLOSED,
      updatedByUserId: 'user-1',
    });
    expect(updateArgs.data).toHaveProperty('closedAt');
  });

  it('rejects manual close while endorsement workflow actions remain', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst
      .mockResolvedValueOnce({
        ...endorsement,
        status: PlacementEndorsementStatus.MARKETING,
      })
      .mockResolvedValueOnce({
        ...endorsement,
        status: PlacementEndorsementStatus.MARKETING,
        impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
        targetPercent: new Prisma.Decimal('10.0000'),
        participants: [],
        closings: [],
        notes: [],
      });

    await expect(
      service.changeStatus(user, 'placement-1', 'endorsement-1', {
        status: PlacementEndorsementStatus.CLOSED,
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.placementEndorsement.update).not.toHaveBeenCalled();
  });

  it('returns existing state when an already closed endorsement is closed again', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSED,
    });

    const result = await service.changeStatus(
      user,
      'placement-1',
      'endorsement-1',
      { status: PlacementEndorsementStatus.CLOSED },
    );

    expect(result.status).toBe(PlacementEndorsementStatus.CLOSED);
    expect(prisma.placementEndorsement.update).not.toHaveBeenCalled();
  });

  it('allows decrease or cancellation endorsements to close with issued credit notes and no debit note', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSING,
      impactType: PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [
        {
          id: 'endorsement-note-1',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: 'endorsement-closing-1',
        },
      ],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.pendingActions).toEqual(['CLOSE_ENDORSEMENT']);
    expect(result.canClose).toBe(true);
    expect(result.closeBlockingReasons).toEqual([]);
  });

  it('blocks close when duplicate active endorsement closings exist for one participant', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSING,
      targetPercent: new Prisma.Decimal('10.0000'),
      participants: [
        {
          id: 'endorsement-participant-1',
          status: PlacementEndorsementParticipantStatus.ACCEPTED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      closings: [
        {
          id: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
        {
          id: 'endorsement-closing-2',
          endorsementParticipantId: 'endorsement-participant-1',
          status: PlacementClosingStatus.CONFIRMED,
          signedLinePercent: new Prisma.Decimal('10.0000'),
        },
      ],
      notes: [
        {
          id: 'endorsement-note-1',
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: null,
        },
        {
          id: 'endorsement-note-2',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: 'endorsement-closing-1',
        },
        {
          id: 'endorsement-note-3',
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          status: PlacementNoteStatus.ISSUED,
          endorsementClosingId: 'endorsement-closing-2',
        },
      ],
    });

    const result = await service.getSummary(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.canClose).toBe(false);
    expect(result.closeBlockingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_ACTIVE_CLOSING' }),
      ]),
    );
  });

  it('rejects unsupported status transitions from terminal statuses', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.VOID,
    });

    await expect(
      service.changeStatus(user, 'placement-1', 'endorsement-1', {
        status: PlacementEndorsementStatus.MARKETING,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
