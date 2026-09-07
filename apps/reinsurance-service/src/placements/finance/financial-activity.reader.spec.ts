import { PlacementPaymentType, Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementFinancialActivityReader } from './financial-activity.reader';

describe('PlacementFinancialActivityReader', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  let prisma: {
    placementPayment: { findFirst: PrismaMethod };
  };
  let reader: PlacementFinancialActivityReader;

  beforeEach(() => {
    prisma = {
      placementPayment: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    reader = new PlacementFinancialActivityReader(
      prisma as unknown as PrismaService,
    );
  });

  it('returns null when no payment activity exists', async () => {
    prisma.placementPayment.findFirst.mockResolvedValue(null);

    await expect(
      reader.findLockingActivity('tenant-1', 'placement-1'),
    ).resolves.toBeNull();
  });

  it.each([
    [PlacementPaymentType.PREMIUM_RECEIVED, 'PREMIUM_PAYMENT'],
    [PlacementPaymentType.REINSURER_DISBURSEMENT, 'REINSURER_PAYMENT'],
    [PlacementPaymentType.CLAIM_SETTLEMENT, 'CLAIM_SETTLEMENT'],
  ] as const)('maps %s to %s lock source', async (type, source) => {
    const paymentDate = new Date('2026-06-04T12:00:00.000Z');
    prisma.placementPayment.findFirst.mockResolvedValue({
      type,
      amount: new Prisma.Decimal('100.00'),
      paymentDate,
      createdAt: new Date('2026-06-04T12:01:00.000Z'),
    });

    await expect(
      reader.findLockingActivity('tenant-1', 'placement-1'),
    ).resolves.toEqual({
      source,
      lockedAt: paymentDate,
    });
  });

  it('queries tenant and placement scoped payment history in chronological order', async () => {
    prisma.placementPayment.findFirst.mockResolvedValue(null);

    await reader.findLockingActivity('tenant-1', 'placement-1');

    expect(prisma.placementPayment.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
      },
      select: {
        type: true,
        paymentDate: true,
        createdAt: true,
      },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
    });
  });
});
