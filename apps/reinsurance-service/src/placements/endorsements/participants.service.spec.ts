import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CounterpartyType,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementEndorsementParticipantsService } from './participants.service';

describe('PlacementEndorsementParticipantsService', () => {
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

  const endorsement = {
    id: 'endorsement-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    status: PlacementEndorsementStatus.MARKETING,
    targetPercent: new Prisma.Decimal('40.0000'),
  };

  const participant = {
    id: 'endorsement-participant-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    endorsementId: 'endorsement-1',
    originalParticipantId: 'participant-1',
    counterpartyId: 'reinsurer-1',
    status: PlacementEndorsementParticipantStatus.OFFER_SENT,
    sharePercent: new Prisma.Decimal('30.0000'),
    signedLinePercent: null,
    notes: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-05T09:00:00.000Z'),
    updatedAt: new Date('2026-06-05T09:00:00.000Z'),
    counterparty: {
      id: 'reinsurer-1',
      name: 'Acme Re',
      registrationNumber: null,
    },
  };

  let prisma: {
    placementEndorsement: { findFirst: PrismaMethod };
    placementEndorsementParticipant: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      delete: PrismaMethod;
    };
    counterparty: { findFirst: PrismaMethod };
    placementParticipant: {
      findFirst: PrismaMethod;
      update: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let service: PlacementEndorsementParticipantsService;

  beforeEach(() => {
    prisma = {
      placementEndorsement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementParticipant: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
        delete: jest.fn<Promise<unknown>, [unknown]>(),
      },
      counterparty: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementParticipant: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new PlacementEndorsementParticipantsService(
      prisma as unknown as PrismaService,
    );
  });

  const mockMutableEndorsement = (targetPercent = '40.0000') => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      targetPercent: targetPercent ? new Prisma.Decimal(targetPercent) : null,
    });
  };

  const mockReinsurer = () => {
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
  };

  const mockOriginalParticipant = (counterpartyId = 'reinsurer-1') => {
    prisma.placementParticipant.findFirst.mockResolvedValue({
      id: 'participant-1',
      counterpartyId,
    });
  };

  it('adds an existing reinsurer with originalParticipantId without mutating the original participant', async () => {
    mockMutableEndorsement();
    mockReinsurer();
    mockOriginalParticipant();
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementParticipant.findMany.mockResolvedValue([]);
    prisma.placementEndorsementParticipant.create.mockResolvedValue(
      participant,
    );

    await service.create(user, 'placement-1', 'endorsement-1', {
      counterpartyId: 'reinsurer-1',
      originalParticipantId: 'participant-1',
      sharePercent: 30,
    });

    const createArgs =
      firstCallArg<Prisma.PlacementEndorsementParticipantCreateArgs>(
        prisma.placementEndorsementParticipant.create,
      );
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      originalParticipantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      status: PlacementEndorsementParticipantStatus.INVITED,
      createdByUserId: 'user-1',
    });
    expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
  });

  it('adds a new reinsurer without originalParticipantId', async () => {
    mockMutableEndorsement();
    mockReinsurer();
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementParticipant.findMany.mockResolvedValue([]);
    prisma.placementEndorsementParticipant.create.mockResolvedValue({
      ...participant,
      originalParticipantId: null,
    });

    const result = await service.create(user, 'placement-1', 'endorsement-1', {
      counterpartyId: 'reinsurer-1',
      sharePercent: 20,
    });

    expect(result.originalParticipantId).toBeNull();
    expect(prisma.placementParticipant.findFirst).not.toHaveBeenCalled();
  });

  it('rejects non-reinsurer counterparties', async () => {
    mockMutableEndorsement();
    prisma.counterparty.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, 'placement-1', 'endorsement-1', {
        counterpartyId: 'cedant-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an original participant with a different counterparty', async () => {
    mockMutableEndorsement();
    mockReinsurer();
    mockOriginalParticipant('other-reinsurer');

    await expect(
      service.create(user, 'placement-1', 'endorsement-1', {
        counterpartyId: 'reinsurer-1',
        originalParticipantId: 'participant-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate active counterparty in the same endorsement', async () => {
    mockMutableEndorsement();
    mockReinsurer();
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.create(user, 'placement-1', 'endorsement-1', {
        counterpartyId: 'reinsurer-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows re-add after a declined participant because declined is inactive for duplicate checks', async () => {
    mockMutableEndorsement();
    mockReinsurer();
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementParticipant.findMany.mockResolvedValue([]);
    prisma.placementEndorsementParticipant.create.mockResolvedValue(
      participant,
    );

    await service.create(user, 'placement-1', 'endorsement-1', {
      counterpartyId: 'reinsurer-1',
    });

    const duplicateArgs =
      firstCallArg<Prisma.PlacementEndorsementParticipantFindFirstArgs>(
        prisma.placementEndorsementParticipant.findFirst,
      );
    expect(duplicateArgs.where).toMatchObject({
      status: { not: PlacementEndorsementParticipantStatus.DECLINED },
    });
  });

  it('requires signedLinePercent when accepting an endorsement participant', async () => {
    mockMutableEndorsement();
    mockReinsurer();

    await expect(
      service.create(user, 'placement-1', 'endorsement-1', {
        counterpartyId: 'reinsurer-1',
        status: PlacementEndorsementParticipantStatus.ACCEPTED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects signedLinePercent greater than sharePercent', async () => {
    mockMutableEndorsement();
    mockReinsurer();

    await expect(
      service.create(user, 'placement-1', 'endorsement-1', {
        counterpartyId: 'reinsurer-1',
        sharePercent: 10,
        signedLinePercent: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects accepted total above targetPercent when targetPercent is set', async () => {
    mockMutableEndorsement('40.0000');
    mockReinsurer();
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementParticipant.findMany.mockResolvedValue([
      { signedLinePercent: new Prisma.Decimal('30.0000') },
    ]);

    await expect(
      service.create(user, 'placement-1', 'endorsement-1', {
        counterpartyId: 'reinsurer-1',
        status: PlacementEndorsementParticipantStatus.ACCEPTED,
        sharePercent: 20,
        signedLinePercent: 15,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not enforce accepted cap when targetPercent is null', async () => {
    mockMutableEndorsement('');
    mockReinsurer();
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementParticipant.create.mockResolvedValue({
      ...participant,
      status: PlacementEndorsementParticipantStatus.ACCEPTED,
      signedLinePercent: new Prisma.Decimal('80.0000'),
    });

    await service.create(user, 'placement-1', 'endorsement-1', {
      counterpartyId: 'reinsurer-1',
      status: PlacementEndorsementParticipantStatus.ACCEPTED,
      sharePercent: 80,
      signedLinePercent: 80,
    });

    expect(
      prisma.placementEndorsementParticipant.findMany,
    ).not.toHaveBeenCalled();
  });

  it('returns offered, accepted, remaining and declined aggregates', async () => {
    mockMutableEndorsement('70.0000');
    prisma.placementEndorsementParticipant.findMany.mockResolvedValue([
      {
        ...participant,
        status: PlacementEndorsementParticipantStatus.ACCEPTED,
        sharePercent: new Prisma.Decimal('40.0000'),
        signedLinePercent: new Prisma.Decimal('30.0000'),
      },
      {
        ...participant,
        id: 'declined',
        status: PlacementEndorsementParticipantStatus.DECLINED,
        sharePercent: new Prisma.Decimal('20.0000'),
        signedLinePercent: new Prisma.Decimal('20.0000'),
      },
    ]);

    const result = await service.findAll(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );

    expect(result.aggregates).toEqual({
      totalOfferedPercent: 60,
      totalAcceptedPercent: 30,
      remainingPercent: 40,
      declinedPercent: 20,
    });
  });

  it('blocks participant mutation when endorsement is terminal', async () => {
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
      ...participant,
      endorsement: {
        ...endorsement,
        status: PlacementEndorsementStatus.CLOSED,
      },
    });

    await expect(
      service.update(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
        { notes: 'Nope' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces participant status transitions', async () => {
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
      ...participant,
      status: PlacementEndorsementParticipantStatus.INVITED,
      endorsement,
    });

    await expect(
      service.changeStatus(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
        { status: PlacementEndorsementParticipantStatus.ACCEPTED },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes only non-terminal endorsement participants', async () => {
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
      ...participant,
      endorsement,
    });
    prisma.placementEndorsementParticipant.delete.mockResolvedValue(
      participant,
    );

    await service.delete(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );

    expect(prisma.placementEndorsementParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'endorsement-participant-1' },
    });
  });

  it('re-invites a declined participant by creating a new invitation attempt', async () => {
    prisma.placementEndorsementParticipant.findFirst
      .mockResolvedValueOnce({
        ...participant,
        status: PlacementEndorsementParticipantStatus.DECLINED,
        endorsement,
        notes: 'No market appetite',
      })
      .mockResolvedValueOnce(null);
    prisma.placementEndorsementParticipant.create.mockResolvedValue({
      ...participant,
      id: 'endorsement-participant-2',
      status: PlacementEndorsementParticipantStatus.INVITED,
      signedLinePercent: null,
    });

    const result = await service.reinvite(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );

    expect(result.id).toBe('endorsement-participant-2');
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
    const duplicateArgs =
      firstCallArg<Prisma.PlacementEndorsementParticipantFindFirstArgs>(
        prisma.placementEndorsementParticipant.findFirst,
      );
    expect(duplicateArgs.where).toMatchObject({
      id: 'endorsement-participant-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
    });
    const createArgs =
      firstCallArg<Prisma.PlacementEndorsementParticipantCreateArgs>(
        prisma.placementEndorsementParticipant.create,
      );
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      originalParticipantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      status: PlacementEndorsementParticipantStatus.INVITED,
      sharePercent: participant.sharePercent,
      signedLinePercent: null,
      createdByUserId: 'user-1',
    });
    expect(String(createArgs.data.notes)).toContain(
      'Re-invited after declined attempt endorsement-participant-1',
    );
    expect(
      prisma.placementEndorsementParticipant.update,
    ).not.toHaveBeenCalled();
    expect(
      prisma.placementEndorsementParticipant.delete,
    ).not.toHaveBeenCalled();
  });

  it('rejects re-inviting an accepted participant', async () => {
    prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
      ...participant,
      status: PlacementEndorsementParticipantStatus.ACCEPTED,
      endorsement,
    });

    await expect(
      service.reinvite(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(
      prisma.placementEndorsementParticipant.create,
    ).not.toHaveBeenCalled();
  });

  it('rejects re-invite when another active attempt already exists', async () => {
    prisma.placementEndorsementParticipant.findFirst
      .mockResolvedValueOnce({
        ...participant,
        status: PlacementEndorsementParticipantStatus.DECLINED,
        endorsement,
      })
      .mockResolvedValueOnce({ id: 'active-attempt' });

    await expect(
      service.reinvite(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(
      prisma.placementEndorsementParticipant.create,
    ).not.toHaveBeenCalled();
  });

  it('retries re-invite once when a serializable transaction conflict is reported', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Transaction conflict',
      {
        code: 'P2034',
        clientVersion: 'test',
      },
    );
    prisma.$transaction
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      );
    prisma.placementEndorsementParticipant.findFirst
      .mockResolvedValueOnce({
        ...participant,
        status: PlacementEndorsementParticipantStatus.DECLINED,
        endorsement,
      })
      .mockResolvedValueOnce(null);
    prisma.placementEndorsementParticipant.create.mockResolvedValue({
      ...participant,
      id: 'endorsement-participant-2',
      status: PlacementEndorsementParticipantStatus.INVITED,
      signedLinePercent: null,
    });

    await service.reinvite(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.placementEndorsementParticipant.create).toHaveBeenCalledTimes(
      1,
    );
  });
});
