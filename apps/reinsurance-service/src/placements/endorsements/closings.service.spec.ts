import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementClosingStatus,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementEndorsementClosingsService } from './closings.service';

describe('PlacementEndorsementClosingsService', () => {
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
    status: PlacementEndorsementStatus.CLOSING,
    proposedSnapshot: {
      sumInsured: '150000.00',
      premium: '30000.00',
      commission: '10.0000',
      preliminaryBrokerage: '7.50',
      currency: 'USD',
    },
    originalSnapshot: {
      placement: {
        sumInsured: '100000.00',
        premium: '20000.00',
        commission: '8.0000',
        preliminaryBrokerage: '5.00',
        currency: 'USD',
      },
    },
  };

  const acceptedParticipant = {
    id: 'endorsement-participant-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    endorsementId: 'endorsement-1',
    originalParticipantId: 'participant-1',
    counterpartyId: 'reinsurer-1',
    status: PlacementEndorsementParticipantStatus.ACCEPTED,
    sharePercent: '40.0000',
    signedLinePercent: '30.0000',
    notes: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-05T08:00:00.000Z'),
    updatedAt: new Date('2026-06-05T08:00:00.000Z'),
    counterparty: {
      id: 'reinsurer-1',
      name: 'Ghana Re',
      registrationNumber: null,
    },
    originalParticipant: {
      brokerageFee: '7.50',
    },
  };

  const closingWithParticipant = {
    id: 'endorsement-closing-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    endorsementId: 'endorsement-1',
    endorsementParticipantId: 'endorsement-participant-1',
    closingNumber: 'ENC-001',
    status: PlacementClosingStatus.DRAFT,
    signedLinePercent: '30.0000',
    sharePercent: '40.0000',
    sumInsuredSnapshot: '150000.00',
    premiumSnapshot: '9000.00',
    commissionPercent: '10.0000',
    commissionAmount: '900.00',
    brokeragePercent: '7.50',
    brokerageAmount: '675.00',
    netPremium: '7425.00',
    currency: 'USD',
    issuedAt: null,
    confirmedAt: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-05T09:00:00.000Z'),
    updatedAt: new Date('2026-06-05T09:00:00.000Z'),
    endorsementParticipant: acceptedParticipant,
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementEndorsement: { findFirst: PrismaMethod; update: PrismaMethod };
    placementEndorsementParticipant: {
      findFirst: PrismaMethod;
      findMany: PrismaMethod;
      update: PrismaMethod;
    };
    placementEndorsementClosing: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementClosing: {
      create: jest.Mock;
      update: jest.Mock;
    };
    placementParticipant: {
      update: jest.Mock;
    };
    placementPayment: {
      create: jest.Mock;
      update: jest.Mock;
    };
    placementNote: {
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let endorsementsService: {
    getSummary: jest.Mock;
  };

  let service: PlacementEndorsementClosingsService;

  beforeEach(() => {
    prisma = {
      placement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementParticipant: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: {
        create: jest.fn(),
        update: jest.fn(),
      },
      placementParticipant: {
        update: jest.fn(),
      },
      placementPayment: {
        create: jest.fn(),
        update: jest.fn(),
      },
      placementNote: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    endorsementsService = {
      getSummary: jest.fn().mockResolvedValue({
        id: 'endorsement-1',
        placementId: 'placement-1',
        endorsementNumber: 'END-001',
        type: 'PARTICIPANT_ADDITION',
        impactType: 'CAPACITY_INCREASE',
        status: PlacementEndorsementStatus.MARKETING,
        effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
        targetPercent: 30,
        placedPercent: 30,
        remainingPercent: 0,
        participants: { total: 1, accepted: 1, declined: 0 },
        closings: { total: 1, confirmed: 1, draft: 0, issued: 0, void: 0 },
        notes: {
          total: 0,
          endorsementDebitNotes: 0,
          endorsementCreditNotes: 0,
          issued: 0,
          draft: 0,
          void: 0,
        },
        pendingActions: ['CLOSE_ENDORSEMENT'],
        isComplete: true,
      }),
    };

    service = new PlacementEndorsementClosingsService(
      prisma as unknown as PrismaService,
      endorsementsService as never,
    );
  });

  describe('findAll', () => {
    it('returns endorsement closings scoped to tenant placement and endorsement', async () => {
      prisma.placementEndorsement.findFirst.mockResolvedValue(endorsement);
      prisma.placementEndorsementClosing.findMany.mockResolvedValue([
        closingWithParticipant,
      ]);

      const result = await service.findAll(
        'tenant-1',
        'placement-1',
        'endorsement-1',
      );

      expect(prisma.placementEndorsementClosing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            placementId: 'placement-1',
            endorsementId: 'endorsement-1',
          },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when endorsement does not match tenant placement', async () => {
      prisma.placementEndorsement.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll('tenant-1', 'placement-1', 'endorsement-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns a single endorsement closing by scoped id', async () => {
      prisma.placementEndorsement.findFirst.mockResolvedValue(endorsement);
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );

      const result = await service.findOne(
        'tenant-1',
        'placement-1',
        'endorsement-1',
        'endorsement-closing-1',
      );

      expect(result.closingNumber).toBe('ENC-001');
      expect(prisma.placementEndorsementClosing.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'endorsement-closing-1',
            tenantId: 'tenant-1',
            placementId: 'placement-1',
            endorsementId: 'endorsement-1',
          },
        }),
      );
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.placementEndorsement.findFirst.mockResolvedValue(endorsement);
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue(
        acceptedParticipant,
      );
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue(null);
      prisma.placementEndorsementClosing.count.mockResolvedValue(0);
      prisma.placementEndorsementClosing.create.mockResolvedValue(
        closingWithParticipant,
      );
    });

    it('creates a DRAFT endorsement closing for an accepted endorsement participant', async () => {
      const result = await service.create(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      const createArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingCreateArgs>(
          prisma.placementEndorsementClosing.create,
        );

      expect(createArgs.data).toMatchObject({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        endorsementId: 'endorsement-1',
        endorsementParticipantId: 'endorsement-participant-1',
        closingNumber: 'ENC-001',
        status: PlacementClosingStatus.DRAFT,
        signedLinePercent: 30,
        sharePercent: 40,
        sumInsuredSnapshot: 45000,
        premiumSnapshot: 9000,
        commissionPercent: 10,
        commissionAmount: 900,
        brokeragePercent: 7.5,
        brokerageAmount: 675,
        netPremium: 7425,
        currency: 'USD',
      });
      expect(result.status).toBe(PlacementClosingStatus.DRAFT);
    });

    it('falls back to the counterparty default brokerage rate when there is no original-participant link', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        originalParticipantId: null,
        originalParticipant: null,
        counterparty: {
          ...acceptedParticipant.counterparty,
          brokerageFee: '5.00',
        },
      });

      await service.create(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      const createArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingCreateArgs>(
          prisma.placementEndorsementClosing.create,
        );

      expect(createArgs.data).toMatchObject({
        brokeragePercent: 5,
        brokerageAmount: 450, // 5% of the 9000 premium snapshot
        netPremium: 7650, // 9000 - 900 commission - 450 brokerage
      });
    });

    it('defaults brokerage to zero when neither the original participant nor the counterparty has a rate', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        originalParticipantId: null,
        originalParticipant: null,
        counterparty: {
          ...acceptedParticipant.counterparty,
          brokerageFee: null,
        },
      });

      await service.create(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      const createArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingCreateArgs>(
          prisma.placementEndorsementClosing.create,
        );

      expect(createArgs.data).toMatchObject({
        brokeragePercent: 0,
        brokerageAmount: 0,
        netPremium: 8100, // 9000 - 900 commission, no brokerage
      });
    });

    it('does not mutate original placement records when creating an endorsement closing', async () => {
      await service.create(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      expect(prisma.placementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementClosing.update).not.toHaveBeenCalled();
      expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
      expect(prisma.placementPayment.create).not.toHaveBeenCalled();
      expect(prisma.placementPayment.update).not.toHaveBeenCalled();
      expect(prisma.placementNote.create).not.toHaveBeenCalled();
      expect(prisma.placementNote.update).not.toHaveBeenCalled();
    });

    it('rejects non-accepted endorsement participants', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        status: PlacementEndorsementParticipantStatus.QUOTED,
      });

      await expect(
        service.create(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects accepted participants without a signed line percentage', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        signedLinePercent: '0.0000',
      });

      await expect(
        service.create(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate active endorsement closings', async () => {
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );

      await expect(
        service.create(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows reissue after a previous endorsement closing was VOID', async () => {
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue(null);
      prisma.placementEndorsementClosing.count.mockResolvedValue(1);
      prisma.placementEndorsementClosing.create.mockResolvedValue({
        ...closingWithParticipant,
        id: 'endorsement-closing-2',
        closingNumber: 'ENC-002',
      });

      await service.create(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      const createArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingCreateArgs>(
          prisma.placementEndorsementClosing.create,
        );
      expect(createArgs.data).toMatchObject({ closingNumber: 'ENC-002' });
    });

    it('rejects VOID endorsements', async () => {
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        status: PlacementEndorsementStatus.VOID,
      });

      await expect(
        service.create(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeStatus', () => {
    beforeEach(() => {
      prisma.placementEndorsement.findFirst.mockResolvedValue(endorsement);
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );
      prisma.placementEndorsementClosing.update.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.ISSUED,
      });
    });

    it('transitions DRAFT to ISSUED and sets issuedAt', async () => {
      await service.changeStatus(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-closing-1',
        { status: PlacementClosingStatus.ISSUED },
      );

      const updateArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingUpdateArgs>(
          prisma.placementEndorsementClosing.update,
        );
      expect(updateArgs.data).toMatchObject({
        status: PlacementClosingStatus.ISSUED,
      });
      expect(updateArgs.data).toHaveProperty('issuedAt');
    });

    it('transitions ISSUED to CONFIRMED and sets confirmedAt', async () => {
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.ISSUED,
      });
      prisma.placementEndorsementClosing.update.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.CONFIRMED,
      });

      await service.changeStatus(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-closing-1',
        { status: PlacementClosingStatus.CONFIRMED },
      );

      const updateArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingUpdateArgs>(
          prisma.placementEndorsementClosing.update,
        );
      expect(updateArgs.data).toMatchObject({
        status: PlacementClosingStatus.CONFIRMED,
      });
      expect(updateArgs.data).toHaveProperty('confirmedAt');
    });

    it.each([PlacementClosingStatus.DRAFT, PlacementClosingStatus.ISSUED])(
      'transitions %s to VOID',
      async (fromStatus) => {
        prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
          ...closingWithParticipant,
          status: fromStatus,
        });

        await service.changeStatus(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-closing-1',
          { status: PlacementClosingStatus.VOID },
        );

        const updateArgs =
          firstCallArg<Prisma.PlacementEndorsementClosingUpdateArgs>(
            prisma.placementEndorsementClosing.update,
          );
        expect(updateArgs.data).toMatchObject({
          status: PlacementClosingStatus.VOID,
        });
      },
    );

    it.each([PlacementClosingStatus.CONFIRMED, PlacementClosingStatus.VOID])(
      'rejects transitions from terminal %s',
      async (fromStatus) => {
        prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
          ...closingWithParticipant,
          status: fromStatus,
        });

        await expect(
          service.changeStatus(
            user,
            'placement-1',
            'endorsement-1',
            'endorsement-closing-1',
            { status: PlacementClosingStatus.ISSUED },
          ),
        ).rejects.toThrow(BadRequestException);
      },
    );
  });

  describe('validateAndConfirm', () => {
    beforeEach(() => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        targetPercent: new Prisma.Decimal('30.0000'),
        status: PlacementEndorsementStatus.MARKETING,
      });
      prisma.placementEndorsementParticipant.findFirst
        .mockResolvedValueOnce(acceptedParticipant)
        .mockResolvedValue({
          ...acceptedParticipant,
          status: PlacementEndorsementParticipantStatus.CLOSED,
        });
      prisma.placementEndorsementParticipant.findMany.mockResolvedValue([]);
      prisma.placementEndorsementParticipant.update.mockResolvedValue({
        ...acceptedParticipant,
        status: PlacementEndorsementParticipantStatus.CLOSED,
      });
      prisma.placementEndorsementClosing.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          ...closingWithParticipant,
          status: PlacementClosingStatus.CONFIRMED,
        });
      prisma.placementEndorsementClosing.count.mockResolvedValue(0);
      prisma.placementEndorsementClosing.create.mockResolvedValue(
        closingWithParticipant,
      );
      prisma.placementEndorsementClosing.update
        .mockResolvedValueOnce({
          ...closingWithParticipant,
          status: PlacementClosingStatus.ISSUED,
          issuedAt: new Date('2026-06-05T09:10:00.000Z'),
        })
        .mockResolvedValueOnce({
          ...closingWithParticipant,
          status: PlacementClosingStatus.CONFIRMED,
          issuedAt: new Date('2026-06-05T09:10:00.000Z'),
          confirmedAt: new Date('2026-06-05T09:11:00.000Z'),
        });
    });

    it('creates, issues, confirms and closes an accepted endorsement participant atomically', async () => {
      const result = await service.validateAndConfirm(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const createArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingCreateArgs>(
          prisma.placementEndorsementClosing.create,
        );
      expect(createArgs.data).toMatchObject({
        status: PlacementClosingStatus.DRAFT,
        endorsementParticipantId: 'endorsement-participant-1',
        signedLinePercent: 30,
        premiumSnapshot: 9000,
        netPremium: 7425,
      });
      const issueArgs = prisma.placementEndorsementClosing.update.mock
        .calls[0][0] as Prisma.PlacementEndorsementClosingUpdateArgs;
      const confirmArgs = prisma.placementEndorsementClosing.update.mock
        .calls[1][0] as Prisma.PlacementEndorsementClosingUpdateArgs;
      expect(issueArgs.data).toMatchObject({
        status: PlacementClosingStatus.ISSUED,
      });
      expect(confirmArgs.data).toMatchObject({
        status: PlacementClosingStatus.CONFIRMED,
      });
      expect(
        prisma.placementEndorsementParticipant.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PlacementEndorsementParticipantStatus.CLOSED },
        }),
      );
      expect(result.closing.status).toBe(PlacementClosingStatus.CONFIRMED);
      expect(result.participant.status).toBe(
        PlacementEndorsementParticipantStatus.CLOSED,
      );
      expect(result.effectiveStatus).toBe(PlacementEndorsementStatus.CLOSING);
      expect(prisma.placementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementClosing.update).not.toHaveBeenCalled();
      expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
    });

    it('reuses an existing confirmed closing on idempotent retry', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockReset();
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        status: PlacementEndorsementParticipantStatus.CLOSED,
      });
      prisma.placementEndorsementClosing.findFirst.mockReset();
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.CONFIRMED,
      });

      const result = await service.validateAndConfirm(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementEndorsementClosing.update).not.toHaveBeenCalled();
      expect(result.closing.status).toBe(PlacementClosingStatus.CONFIRMED);
    });

    it('issues and confirms an existing DRAFT closing without creating a duplicate', async () => {
      prisma.placementEndorsementClosing.findFirst.mockReset();
      prisma.placementEndorsementClosing.findFirst
        .mockResolvedValueOnce(closingWithParticipant)
        .mockResolvedValue({
          ...closingWithParticipant,
          status: PlacementClosingStatus.CONFIRMED,
        });

      await service.validateAndConfirm(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementEndorsementClosing.update).toHaveBeenCalledTimes(
        2,
      );
    });

    it('confirms an existing ISSUED closing without creating a duplicate', async () => {
      prisma.placementEndorsementClosing.findFirst.mockReset();
      prisma.placementEndorsementClosing.findFirst
        .mockResolvedValueOnce({
          ...closingWithParticipant,
          status: PlacementClosingStatus.ISSUED,
        })
        .mockResolvedValue({
          ...closingWithParticipant,
          status: PlacementClosingStatus.CONFIRMED,
        });
      prisma.placementEndorsementClosing.update.mockReset();
      prisma.placementEndorsementClosing.update.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.CONFIRMED,
      });

      await service.validateAndConfirm(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementEndorsementClosing.update).toHaveBeenCalledTimes(
        1,
      );
      const updateArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingUpdateArgs>(
          prisma.placementEndorsementClosing.update,
        );
      expect(updateArgs.data).toMatchObject({
        status: PlacementClosingStatus.CONFIRMED,
      });
      expect(updateArgs.data).toHaveProperty('confirmedAt');
    });

    it('retries once when serializable transaction conflict is reported', async () => {
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

      await service.validateAndConfirm(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('returns controlled conflict after bounded P2034 retry exhaustion', async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError(
        'Transaction conflict',
        {
          code: 'P2034',
          clientVersion: 'test',
        },
      );
      prisma.$transaction.mockRejectedValue(conflict);

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(endorsementsService.getSummary).not.toHaveBeenCalled();
    });

    it('retries unique closing-number conflicts and succeeds without leaking raw Prisma errors', async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError(
        'Unique conflict',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );
      prisma.$transaction
        .mockRejectedValueOnce(conflict)
        .mockImplementationOnce((callback: (tx: unknown) => Promise<unknown>) =>
          callback(prisma),
        );

      await service.validateAndConfirm(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('rejects declined participants', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockReset();
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        status: PlacementEndorsementParticipantStatus.DECLINED,
      });

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects CLOSED participants without a confirmed active closing as inconsistent state', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockReset();
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        status: PlacementEndorsementParticipantStatus.CLOSED,
      });
      prisma.placementEndorsementClosing.findFirst.mockReset();
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.DRAFT,
      });

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.placementEndorsementClosing.update).not.toHaveBeenCalled();
    });

    it('does not reuse VOID closings and creates a fresh active closing', async () => {
      await service.validateAndConfirm(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-participant-1',
      );

      const findArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingFindFirstArgs>(
          prisma.placementEndorsementClosing.findFirst,
        );
      expect(findArgs.where).toMatchObject({
        status: { not: PlacementClosingStatus.VOID },
      });
      expect(prisma.placementEndorsementClosing.create).toHaveBeenCalled();
    });

    it('rejects terminal endorsements', async () => {
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        targetPercent: new Prisma.Decimal('30.0000'),
        status: PlacementEndorsementStatus.CLOSED,
      });

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects capacity overrun before creating or updating a closing', async () => {
      prisma.placementEndorsementParticipant.findMany.mockResolvedValue([
        { signedLinePercent: new Prisma.Decimal('10.0000') },
      ]);

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementEndorsementClosing.update).not.toHaveBeenCalled();
    });

    it('rejects accepted signed lines that exceed the offered endorsement share', async () => {
      prisma.placementEndorsementParticipant.findFirst.mockReset();
      prisma.placementEndorsementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        sharePercent: '20.0000',
        signedLinePercent: '30.0000',
      });

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
    });

    it('rejects non-positive endorsement premium snapshots', async () => {
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        targetPercent: new Prisma.Decimal('30.0000'),
        status: PlacementEndorsementStatus.MARKETING,
        proposedSnapshot: {
          ...endorsement.proposedSnapshot,
          premium: '0.00',
        },
      });

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
    });

    it('does not reveal cross-tenant or missing placements', async () => {
      prisma.placement.findFirst.mockResolvedValue(null);

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates failures before participant close so the transaction can roll back', async () => {
      prisma.placementEndorsementClosing.update
        .mockReset()
        .mockRejectedValueOnce(new Error('database failed'));

      await expect(
        service.validateAndConfirm(
          user,
          'placement-1',
          'endorsement-1',
          'endorsement-participant-1',
        ),
      ).rejects.toThrow('database failed');
      expect(
        prisma.placementEndorsementParticipant.update,
      ).not.toHaveBeenCalled();
    });
  });

  describe('forceClose', () => {
    beforeEach(() => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        status: PlacementEndorsementStatus.CLOSING,
      });
      prisma.placementEndorsementParticipant.findMany.mockResolvedValue([
        acceptedParticipant,
        {
          ...acceptedParticipant,
          id: 'endorsement-participant-2',
          counterpartyId: 'reinsurer-2',
          status: PlacementEndorsementParticipantStatus.DECLINED,
          signedLinePercent: '10.0000',
        },
      ]);
      prisma.placementEndorsementParticipant.update.mockResolvedValue({
        ...acceptedParticipant,
        status: PlacementEndorsementParticipantStatus.CLOSED,
      });
      prisma.placementEndorsementClosing.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          ...closingWithParticipant,
          status: PlacementClosingStatus.CONFIRMED,
        });
      prisma.placementEndorsementClosing.findMany.mockResolvedValue([
        {
          ...closingWithParticipant,
          status: PlacementClosingStatus.CONFIRMED,
        },
      ]);
      prisma.placementEndorsementClosing.count.mockResolvedValue(0);
      prisma.placementEndorsementClosing.create.mockResolvedValue(
        closingWithParticipant,
      );
      prisma.placementEndorsementClosing.update
        .mockResolvedValueOnce({
          ...closingWithParticipant,
          status: PlacementClosingStatus.ISSUED,
          issuedAt: new Date('2026-06-05T09:10:00.000Z'),
        })
        .mockResolvedValueOnce({
          ...closingWithParticipant,
          status: PlacementClosingStatus.CONFIRMED,
          issuedAt: new Date('2026-06-05T09:10:00.000Z'),
          confirmedAt: new Date('2026-06-05T09:11:00.000Z'),
        });
      prisma.placementEndorsement.update.mockResolvedValue({
        id: 'endorsement-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        endorsementNumber: 'END-001',
        type: 'PARTICIPANT_ADDITION',
        impactType: 'CAPACITY_INCREASE',
        status: PlacementEndorsementStatus.CLOSED,
        effectiveDate: new Date('2026-06-05T00:00:00.000Z'),
        reason: 'Additional capacity',
        description: null,
        changeSummary: null,
        originalSnapshot: endorsement.originalSnapshot,
        proposedSnapshot: endorsement.proposedSnapshot,
        targetPercent: new Prisma.Decimal('30.0000'),
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        closedAt: new Date('2026-06-05T09:11:00.000Z'),
        voidedAt: null,
        createdAt: new Date('2026-06-05T08:00:00.000Z'),
        updatedAt: new Date('2026-06-05T09:11:00.000Z'),
      });
    });

    it('creates and confirms closings for accepted participant lines, then closes the endorsement', async () => {
      const result = await service.forceClose(
        user,
        'placement-1',
        'endorsement-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const participantsFindArgs =
        firstCallArg<Prisma.PlacementEndorsementParticipantFindManyArgs>(
          prisma.placementEndorsementParticipant.findMany,
        );
      expect(participantsFindArgs.where).toMatchObject({
        status: {
          in: [
            PlacementEndorsementParticipantStatus.ACCEPTED,
            PlacementEndorsementParticipantStatus.CLOSED,
          ],
        },
      });
      expect(participantsFindArgs.orderBy).toEqual({ createdAt: 'asc' });
      const createArgs =
        firstCallArg<Prisma.PlacementEndorsementClosingCreateArgs>(
          prisma.placementEndorsementClosing.create,
        );
      expect(createArgs.data).toMatchObject({
        status: PlacementClosingStatus.DRAFT,
        endorsementParticipantId: 'endorsement-participant-1',
        signedLinePercent: 30,
        premiumSnapshot: 9000,
        netPremium: 7425,
      });
      const issueArgs = prisma.placementEndorsementClosing.update.mock
        .calls[0][0] as Prisma.PlacementEndorsementClosingUpdateArgs;
      const confirmArgs = prisma.placementEndorsementClosing.update.mock
        .calls[1][0] as Prisma.PlacementEndorsementClosingUpdateArgs;
      expect(issueArgs.data).toMatchObject({
        status: PlacementClosingStatus.ISSUED,
      });
      expect(confirmArgs.data).toMatchObject({
        status: PlacementClosingStatus.CONFIRMED,
      });
      expect(
        prisma.placementEndorsementParticipant.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PlacementEndorsementParticipantStatus.CLOSED },
        }),
      );
      const endorsementUpdateArgs =
        firstCallArg<Prisma.PlacementEndorsementUpdateArgs>(
          prisma.placementEndorsement.update,
        );
      expect(endorsementUpdateArgs.where).toEqual({ id: 'endorsement-1' });
      expect(endorsementUpdateArgs.data).toMatchObject({
        status: PlacementEndorsementStatus.CLOSED,
        updatedByUserId: 'user-1',
      });
      expect(result.effectiveStatus).toBe(PlacementEndorsementStatus.CLOSED);
      expect(result.closings).toHaveLength(1);
      expect(prisma.placementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementClosing.update).not.toHaveBeenCalled();
      expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
      expect(prisma.placementNote.create).not.toHaveBeenCalled();
      expect(prisma.placementPayment.create).not.toHaveBeenCalled();
    });

    it('reuses existing confirmed active closings without creating duplicates', async () => {
      prisma.placementEndorsementParticipant.findMany.mockResolvedValue([
        {
          ...acceptedParticipant,
          status: PlacementEndorsementParticipantStatus.CLOSED,
        },
      ]);
      prisma.placementEndorsementClosing.findFirst.mockReset();
      prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.CONFIRMED,
      });

      await service.forceClose(user, 'placement-1', 'endorsement-1');

      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
      expect(prisma.placementEndorsementClosing.update).not.toHaveBeenCalled();
      expect(
        prisma.placementEndorsementParticipant.update,
      ).not.toHaveBeenCalled();
    });

    it('rejects force close when no accepted participant lines exist', async () => {
      prisma.placementEndorsementParticipant.findMany.mockResolvedValue([
        {
          ...acceptedParticipant,
          status: PlacementEndorsementParticipantStatus.DECLINED,
        },
      ]);

      await expect(
        service.forceClose(user, 'placement-1', 'endorsement-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.placementEndorsement.update).not.toHaveBeenCalled();
    });

    it.each([
      PlacementEndorsementStatus.DRAFT,
      PlacementEndorsementStatus.DECLINED,
      PlacementEndorsementStatus.VOID,
    ])('rejects force close for %s endorsements', async (status) => {
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        status,
      });

      await expect(
        service.forceClose(user, 'placement-1', 'endorsement-1'),
      ).rejects.toThrow(
        status === PlacementEndorsementStatus.DRAFT
          ? BadRequestException
          : ConflictException,
      );
      expect(prisma.placementEndorsementClosing.create).not.toHaveBeenCalled();
    });
  });
});
