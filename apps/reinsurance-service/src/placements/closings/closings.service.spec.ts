import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementClosingsService } from './closings.service';

describe('PlacementClosingsService', () => {
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
    premium: '15000.00',
    commission: '10.0000',
    currency: 'USD',
    sumInsured: '600000.00',
  };

  const acceptedParticipant = {
    id: 'participant-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'reinsurer-1',
    role: PlacementParticipantRole.LEAD_REINSURER,
    status: PlacementParticipantStatus.ACCEPTED,
    sharePercent: '40.0000',
    signedLinePercent: '30.0000',
    brokerageFee: '7.50',
    notes: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  const closingWithParticipant = {
    id: 'closing-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    participantId: 'participant-1',
    closingNumber: 'CLO-001',
    status: PlacementClosingStatus.DRAFT,
    signedLinePercent: '30.0000',
    sharePercent: '40.0000',
    sumInsuredSnapshot: '180000.00',
    grossPremium: '4500.00',
    commissionPercent: '10.0000',
    commissionAmount: '450.00',
    brokeragePercent: '7.50',
    brokerageAmount: '337.50',
    netPremium: '3712.50',
    currency: 'USD',
    issuedAt: null,
    confirmedAt: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-04T00:00:00.000Z'),
    updatedAt: new Date('2026-06-04T00:00:00.000Z'),
    participant: {
      id: 'participant-1',
      counterpartyId: 'reinsurer-1',
      role: PlacementParticipantRole.LEAD_REINSURER,
      status: PlacementParticipantStatus.ACCEPTED,
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
        registrationNumber: null,
      },
    },
  };

  let prisma: {
    placement: { findFirst: PrismaMethod; update: PrismaMethod };
    placementParticipant: { findFirst: PrismaMethod; updateMany: PrismaMethod };
    placementClosing: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementStatusHistory: { create: PrismaMethod };
    $transaction: jest.Mock;
  };

  let service: PlacementClosingsService;

  beforeEach(() => {
    prisma = {
      placement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementParticipant: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({ count: 0 }),
      },
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementStatusHistory: {
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };

    service = new PlacementClosingsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns closings for an active placement', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findMany.mockResolvedValue([
        closingWithParticipant,
      ]);

      const result = await service.findAll('tenant-1', 'placement-1');

      expect(prisma.placementClosing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', placementId: 'placement-1' },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for an unknown placement', async () => {
      prisma.placement.findFirst.mockResolvedValue(null);

      await expect(service.findAll('tenant-1', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('returns a single closing by id', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );

      const result = await service.findOne(
        'tenant-1',
        'placement-1',
        'closing-1',
      );

      expect(result.closingNumber).toBe('CLO-001');
    });

    it('throws NotFoundException when closing id does not match the placement', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('tenant-1', 'placement-1', 'wrong-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.placement.findFirst.mockResolvedValue(placement);
      prisma.placementParticipant.findFirst.mockResolvedValue(
        acceptedParticipant,
      );
      prisma.placementClosing.findFirst.mockResolvedValue(null); // no existing active
      prisma.placementClosing.count.mockResolvedValue(0);
      prisma.placementClosing.create.mockResolvedValue(closingWithParticipant);
    });

    it('creates a DRAFT closing and snapshots financial values', async () => {
      const result = await service.create(user, 'placement-1', 'participant-1');

      const createArgs = firstCallArg<Prisma.PlacementClosingCreateArgs>(
        prisma.placementClosing.create,
      );

      expect(createArgs.data).toMatchObject({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        participantId: 'participant-1',
        closingNumber: 'CLO-001',
        status: PlacementClosingStatus.DRAFT,
        signedLinePercent: 30,
        sharePercent: 40,
        sumInsuredSnapshot: 180000,
        grossPremium: 4500,
        commissionPercent: 10,
        commissionAmount: 450,
        brokeragePercent: 7.5,
        brokerageAmount: 337.5,
        netPremium: 3712.5,
        currency: 'USD',
      });
      expect(result.status).toBe(PlacementClosingStatus.DRAFT);
    });

    it('snapshots financial values using the same closing preview formula outputs', async () => {
      await service.create(user, 'placement-1', 'participant-1');

      const createArgs = firstCallArg<Prisma.PlacementClosingCreateArgs>(
        prisma.placementClosing.create,
      );
      const data = createArgs.data as {
        grossPremium: number;
        commissionAmount: number;
        brokerageAmount: number;
        netPremium: number;
      };
      const grossPremium = 15000 * (30 / 100);
      const totalCommissionAmount = grossPremium * ((10 + 7.5) / 100);

      expect(data.grossPremium).toBe(grossPremium);
      expect(data.commissionAmount + data.brokerageAmount).toBe(
        totalCommissionAmount,
      );
      expect(data.netPremium).toBe(grossPremium - totalCommissionAmount);
    });

    it('generates sequential closing numbers within a placement', async () => {
      prisma.placementClosing.count.mockResolvedValue(3);

      await service.create(user, 'placement-1', 'participant-1');

      const createArgs = firstCallArg<Prisma.PlacementClosingCreateArgs>(
        prisma.placementClosing.create,
      );

      expect(createArgs.data).toMatchObject({ closingNumber: 'CLO-004' });
    });

    it('rejects closing when placement premium is not set', async () => {
      prisma.placement.findFirst.mockResolvedValue({
        ...placement,
        premium: null,
      });

      await expect(
        service.create(user, 'placement-1', 'participant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementParticipant.findFirst).not.toHaveBeenCalled();
      expect(prisma.placementClosing.create).not.toHaveBeenCalled();
    });

    it('rejects closing for a non-ACCEPTED participant', async () => {
      prisma.placementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        status: PlacementParticipantStatus.OFFER_SENT,
      });

      await expect(
        service.create(user, 'placement-1', 'participant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementClosing.create).not.toHaveBeenCalled();
    });

    it('rejects closing when participant has no signed line', async () => {
      prisma.placementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        signedLinePercent: null,
      });

      await expect(
        service.create(user, 'placement-1', 'participant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementClosing.create).not.toHaveBeenCalled();
    });

    it('rejects closing when participant has zero signed line', async () => {
      prisma.placementParticipant.findFirst.mockResolvedValue({
        ...acceptedParticipant,
        signedLinePercent: '0.0000',
      });

      await expect(
        service.create(user, 'placement-1', 'participant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate active closing for the same participant inside the transaction', async () => {
      prisma.placementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );

      await expect(
        service.create(user, 'placement-1', 'participant-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.placementClosing.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
      const findFirstArgs = firstCallArg<Prisma.PlacementClosingFindFirstArgs>(
        prisma.placementClosing.findFirst,
      );

      expect(findFirstArgs.where).toMatchObject({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        participantId: 'participant-1',
        status: { not: PlacementClosingStatus.VOID },
      });
    });

    it('allows a new closing after the previous one is VOID', async () => {
      // findFirst returns null because VOID closings are inactive.
      prisma.placementClosing.findFirst.mockResolvedValue(null);

      await service.create(user, 'placement-1', 'participant-1');

      expect(prisma.placementClosing.create).toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown placement', async () => {
      prisma.placement.findFirst.mockResolvedValue(null);

      await expect(
        service.create(user, 'unknown', 'participant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for participant not on placement', async () => {
      prisma.placementParticipant.findFirst.mockResolvedValue(null);

      await expect(
        service.create(user, 'placement-1', 'wrong-participant'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changeStatus', () => {
    const issuedClosing = {
      ...closingWithParticipant,
      status: PlacementClosingStatus.ISSUED,
    };

    it('transitions DRAFT to ISSUED and sets issuedAt', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );
      prisma.placementClosing.update.mockResolvedValue(issuedClosing);

      await service.changeStatus(user, 'placement-1', 'closing-1', {
        status: PlacementClosingStatus.ISSUED,
      });

      const updateArgs = firstCallArg<Prisma.PlacementClosingUpdateArgs>(
        prisma.placementClosing.update,
      );

      expect(updateArgs.data).toMatchObject({
        status: PlacementClosingStatus.ISSUED,
      });
      expect(
        (updateArgs.data as { issuedAt?: unknown }).issuedAt,
      ).toBeInstanceOf(Date);
    });

    it('transitions ISSUED to CONFIRMED and sets confirmedAt', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(issuedClosing);
      prisma.placementClosing.update.mockResolvedValue({
        ...issuedClosing,
        status: PlacementClosingStatus.CONFIRMED,
        confirmedAt: new Date(),
      });

      await service.changeStatus(user, 'placement-1', 'closing-1', {
        status: PlacementClosingStatus.CONFIRMED,
      });

      const updateArgs = firstCallArg<Prisma.PlacementClosingUpdateArgs>(
        prisma.placementClosing.update,
      );

      expect(updateArgs.data).toMatchObject({
        status: PlacementClosingStatus.CONFIRMED,
      });
      expect(
        (updateArgs.data as { confirmedAt?: unknown }).confirmedAt,
      ).toBeInstanceOf(Date);
      expect(prisma.placementParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
        },
        data: { status: PlacementParticipantStatus.CLOSED },
      });
    });

    it('automatically closes a CLOSING placement when confirmed closings reach the facultative offer', async () => {
      prisma.placement.findFirst
        .mockResolvedValueOnce({ id: 'placement-1' })
        .mockResolvedValueOnce({
          id: 'placement-1',
          status: PlacementStatus.CLOSING,
          facultativeOffer: '80.0000',
        });
      prisma.placementClosing.findFirst.mockResolvedValue(issuedClosing);
      prisma.placementClosing.update.mockResolvedValue({
        ...issuedClosing,
        status: PlacementClosingStatus.CONFIRMED,
        confirmedAt: new Date(),
      });
      prisma.placementClosing.findMany.mockResolvedValue([
        { signedLinePercent: '40.0000' },
        { signedLinePercent: '40.0000' },
      ]);

      await service.changeStatus(user, 'placement-1', 'closing-1', {
        status: PlacementClosingStatus.CONFIRMED,
      });

      const statusHistoryArgs = firstCallArg<{
        data: Record<string, unknown>;
      }>(prisma.placementStatusHistory.create);
      expect(statusHistoryArgs.data).toMatchObject({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        fromStatus: PlacementStatus.CLOSING,
        toStatus: PlacementStatus.CLOSED,
      });
      expect(prisma.placement.update).toHaveBeenCalledWith({
        where: {
          id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
        },
        data: {
          status: PlacementStatus.CLOSED,
          updatedByUserId: 'user-1',
        },
      });
    });

    it('keeps a CLOSING placement open when confirmed closings are below the facultative offer', async () => {
      prisma.placement.findFirst
        .mockResolvedValueOnce({ id: 'placement-1' })
        .mockResolvedValueOnce({
          id: 'placement-1',
          status: PlacementStatus.CLOSING,
          facultativeOffer: '80.0000',
        });
      prisma.placementClosing.findFirst.mockResolvedValue(issuedClosing);
      prisma.placementClosing.update.mockResolvedValue({
        ...issuedClosing,
        status: PlacementClosingStatus.CONFIRMED,
        confirmedAt: new Date(),
      });
      prisma.placementClosing.findMany.mockResolvedValue([
        { signedLinePercent: '40.0000' },
      ]);

      await service.changeStatus(user, 'placement-1', 'closing-1', {
        status: PlacementClosingStatus.CONFIRMED,
      });

      expect(prisma.placementStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.placement.update).not.toHaveBeenCalled();
    });

    it('transitions ISSUED to VOID without setting confirmedAt', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(issuedClosing);
      prisma.placementClosing.update.mockResolvedValue({
        ...issuedClosing,
        status: PlacementClosingStatus.VOID,
      });

      await service.changeStatus(user, 'placement-1', 'closing-1', {
        status: PlacementClosingStatus.VOID,
      });

      const updateArgs = firstCallArg<Prisma.PlacementClosingUpdateArgs>(
        prisma.placementClosing.update,
      );

      expect(updateArgs.data).not.toHaveProperty('confirmedAt');
      expect(updateArgs.data).not.toHaveProperty('issuedAt');
    });

    it('transitions DRAFT to VOID', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );
      prisma.placementClosing.update.mockResolvedValue({
        ...closingWithParticipant,
        status: PlacementClosingStatus.VOID,
      });

      await service.changeStatus(user, 'placement-1', 'closing-1', {
        status: PlacementClosingStatus.VOID,
      });

      const updateArgs = firstCallArg<Prisma.PlacementClosingUpdateArgs>(
        prisma.placementClosing.update,
      );

      expect(updateArgs.data).toMatchObject({
        status: PlacementClosingStatus.VOID,
      });
    });

    it('rejects invalid status transition DRAFT to CONFIRMED', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );

      await expect(
        service.changeStatus(user, 'placement-1', 'closing-1', {
          status: PlacementClosingStatus.CONFIRMED,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.placementClosing.update).not.toHaveBeenCalled();
    });

    it('returns the closing unchanged when transitioning to the current status', async () => {
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(
        closingWithParticipant,
      );

      const result = await service.changeStatus(
        user,
        'placement-1',
        'closing-1',
        {
          status: PlacementClosingStatus.DRAFT,
        },
      );

      expect(prisma.placementClosing.update).not.toHaveBeenCalled();
      expect(result.status).toBe(PlacementClosingStatus.DRAFT);
    });

    it('rejects transitions from CONFIRMED (terminal)', async () => {
      const confirmedClosing = {
        ...closingWithParticipant,
        status: PlacementClosingStatus.CONFIRMED,
      };
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(confirmedClosing);

      await expect(
        service.changeStatus(user, 'placement-1', 'closing-1', {
          status: PlacementClosingStatus.VOID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transitions from VOID (terminal)', async () => {
      const voidClosing = {
        ...closingWithParticipant,
        status: PlacementClosingStatus.VOID,
      };
      prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
      prisma.placementClosing.findFirst.mockResolvedValue(voidClosing);

      await expect(
        service.changeStatus(user, 'placement-1', 'closing-1', {
          status: PlacementClosingStatus.ISSUED,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
