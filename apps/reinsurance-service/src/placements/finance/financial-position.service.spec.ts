import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementFinancialPositionService } from './financial-position.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

describe('PlacementFinancialPositionService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const tenantId = 'tenant-1';
  const placementId = 'placement-1';
  const asOfDate = new Date('2026-08-01T00:00:00.000Z');

  const originalClosingA = {
    id: 'closing-a',
    participantId: 'participant-a',
    netPremium: new Prisma.Decimal('60000.00'),
    grossPremium: new Prisma.Decimal('60000.00'),
    commissionAmount: new Prisma.Decimal('0.00'),
    currency: 'GHS',
    participant: {
      counterpartyId: 'reinsurer-a',
      counterparty: { name: 'A Re' },
    },
  };

  const originalClosingB = {
    id: 'closing-b',
    participantId: 'participant-b',
    netPremium: new Prisma.Decimal('40000.00'),
    grossPremium: new Prisma.Decimal('40000.00'),
    commissionAmount: new Prisma.Decimal('0.00'),
    currency: 'GHS',
    participant: {
      counterpartyId: 'reinsurer-b',
      counterparty: { name: 'B Re' },
    },
  };

  let tx: {
    placement: { findFirst: PrismaMethod };
    placementClosing: { findMany: PrismaMethod };
    placementEndorsementClosing: { findMany: PrismaMethod };
    placementPayment: { findMany: PrismaMethod };
  };
  let prisma: { $transaction: jest.Mock };
  let service: PlacementFinancialPositionService;

  beforeEach(() => {
    tx = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClosing: { findMany: jest.fn<Promise<unknown>, [unknown]>() },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: { findMany: jest.fn<Promise<unknown>, [unknown]>() },
    };
    tx.placement.findFirst.mockResolvedValue({
      id: placementId,
      currency: 'GHS',
    });
    tx.placementClosing.findMany.mockResolvedValue([
      originalClosingA,
      originalClosingB,
    ]);
    tx.placementEndorsementClosing.findMany.mockResolvedValue([]);
    tx.placementPayment.findMany.mockResolvedValue([]);
    prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    service = new PlacementFinancialPositionService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns original placement obligation when there are no effective endorsements', async () => {
    const result = await service.getFinancialPosition(
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result).toMatchObject({
      placementId,
      currency: 'GHS',
      isMultiCurrency: false,
      cedant: {
        originalObligation: 100000,
        endorsementAdjustments: 0,
        currentObligation: 100000,
        received: 0,
        outstanding: 100000,
        position: 'RECEIVABLE',
      },
    });
    expect(result.reinsurers).toEqual([
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        originalPayable: 60000,
        currentEffectivePayable: 60000,
        outstanding: 60000,
        position: 'PAYABLE',
      }),
      expect.objectContaining({
        counterpartyId: 'reinsurer-b',
        originalPayable: 40000,
        currentEffectivePayable: 40000,
        outstanding: 40000,
        position: 'PAYABLE',
      }),
    ]);
  });

  it('uses the debit-note basis for cedant receipts while retaining net premium for reinsurer payables', async () => {
    tx.placementClosing.findMany.mockResolvedValue([
      {
        ...originalClosingA,
        grossPremium: new Prisma.Decimal('31200.00'),
        commissionAmount: new Prisma.Decimal('4680.00'),
        netPremium: new Prisma.Decimal('24180.00'),
      },
    ]);

    const result = await service.getFinancialPosition(
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.cedant).toMatchObject({
      originalObligation: 26520,
      currentObligation: 26520,
      outstanding: 26520,
    });
    expect(result.reinsurers).toContainEqual(
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        originalPayable: 24180,
        outstanding: 24180,
      }),
    );
  });

  it('subtracts only bank-confirmed non-reversed premium receipts from cedant outstanding', async () => {
    tx.placementPayment.findMany.mockResolvedValue([
      {
        id: 'payment-active',
        counterpartyId: 'cedant-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        amount: new Prisma.Decimal('70000.00'),
        currency: 'GHS',
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: null,
      },
      {
        id: 'payment-reversed',
        counterpartyId: 'cedant-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        amount: new Prisma.Decimal('30000.00'),
        currency: 'GHS',
        status: PlacementPaymentStatus.REVERSED,
        reversalOfPaymentId: null,
      },
      {
        id: 'payment-reversal-row',
        counterpartyId: 'cedant-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        amount: new Prisma.Decimal('-30000.00'),
        currency: 'GHS',
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: 'payment-reversed',
      },
    ]);

    const result = await service.getFinancialPosition(
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.cedant).toMatchObject({
      grossRecorded: 100000,
      reversed: 30000,
      netSettled: 70000,
      outstanding: 30000,
      position: 'RECEIVABLE',
    });
  });

  it('subtracts bank-confirmed reinsurer disbursements from reinsurer outstanding', async () => {
    tx.placementPayment.findMany.mockResolvedValue([
      {
        id: 'payment-disbursement',
        counterpartyId: 'reinsurer-a',
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        amount: new Prisma.Decimal('25000.00'),
        currency: 'GHS',
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: null,
      },
      {
        id: 'payment-failed',
        counterpartyId: 'reinsurer-a',
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        amount: new Prisma.Decimal('5000.00'),
        currency: 'GHS',
        status: PlacementPaymentStatus.FAILED,
        reversalOfPaymentId: null,
      },
    ]);

    const result = await service.getFinancialPosition(
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.reinsurers).toContainEqual(
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        grossRecorded: 30000,
        netSettled: 25000,
        outstanding: 35000,
        position: 'PAYABLE',
      }),
    );
  });

  it('adds effective additional-premium endorsement adjustments', async () => {
    tx.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-c',
        endorsementId: 'endorsement-1',
        endorsementParticipantId: 'endorsement-participant-c',
        netPremium: new Prisma.Decimal('20000.00'),
        currency: 'GHS',
        endorsement: {
          endorsementNumber: 'END-001',
          effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        },
        endorsementParticipant: {
          counterpartyId: 'reinsurer-c',
          originalParticipantId: null,
          counterparty: { name: 'C Re' },
        },
      },
    ]);

    const result = await service.getFinancialPosition(
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.cedant).toMatchObject({
      originalObligation: 100000,
      endorsementAdjustments: 20000,
      currentObligation: 120000,
      outstanding: 120000,
    });
    expect(result.reinsurers).toContainEqual(
      expect.objectContaining({
        counterpartyId: 'reinsurer-c',
        originalPayable: 0,
        endorsementAdjustments: 20000,
        currentEffectivePayable: 20000,
      }),
    );
  });

  it('uses closed endorsements effective on or before the requested as-of date', async () => {
    await service.getFinancialPosition(tenantId, placementId, asOfDate);

    const findManyArgs = tx.placementEndorsementClosing.findMany.mock
      .calls[0]?.[0] as Prisma.PlacementEndorsementClosingFindManyArgs;
    expect(findManyArgs.where).toMatchObject({
      status: PlacementClosingStatus.CONFIRMED,
      endorsement: {
        status: PlacementEndorsementStatus.CLOSED,
        effectiveDate: { lte: asOfDate },
      },
    });
  });

  it('uses only payments recorded on or before the requested as-of date', async () => {
    await service.getFinancialPosition(tenantId, placementId, asOfDate);

    const paymentArgs = tx.placementPayment.findMany.mock
      .calls[0]?.[0] as Prisma.PlacementPaymentFindManyArgs;
    expect(paymentArgs.where).toMatchObject({
      tenantId,
      placementId,
      paymentDate: { lte: asOfDate },
    });
  });

  it('calculates replacement endorsement adjustments as revised minus previously effective line', async () => {
    tx.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-a',
        endorsementId: 'endorsement-1',
        endorsementParticipantId: 'endorsement-participant-a',
        netPremium: new Prisma.Decimal('75000.00'),
        currency: 'GHS',
        endorsement: {
          endorsementNumber: 'END-001',
          effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        },
        endorsementParticipant: {
          counterpartyId: 'reinsurer-a',
          originalParticipantId: 'participant-a',
          counterparty: { name: 'A Re' },
        },
      },
    ]);

    const result = await service.getFinancialPosition(
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.cedant).toMatchObject({
      endorsementAdjustments: 15000,
      currentObligation: 115000,
    });
    expect(result.reinsurers).toContainEqual(
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        originalPayable: 60000,
        endorsementAdjustments: 15000,
        currentEffectivePayable: 75000,
      }),
    );
  });

  it('supports signed negative return-premium adjustments when snapshots provide them', async () => {
    tx.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-a',
        endorsementId: 'endorsement-1',
        endorsementParticipantId: 'endorsement-participant-a',
        netPremium: new Prisma.Decimal('45000.00'),
        currency: 'GHS',
        endorsement: {
          endorsementNumber: 'END-001',
          effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        },
        endorsementParticipant: {
          counterpartyId: 'reinsurer-a',
          originalParticipantId: 'participant-a',
          counterparty: { name: 'A Re' },
        },
      },
    ]);
    tx.placementPayment.findMany.mockResolvedValue([
      {
        id: 'payment-active',
        counterpartyId: 'cedant-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        amount: new Prisma.Decimal('100000.00'),
        currency: 'GHS',
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: null,
      },
    ]);

    const result = await service.getFinancialPosition(
      tenantId,
      placementId,
      asOfDate,
    );

    expect(result.cedant).toMatchObject({
      endorsementAdjustments: -15000,
      currentObligation: 85000,
      netSettled: 100000,
      outstanding: -15000,
      position: 'CREDIT_BALANCE',
    });
  });

  it('rejects mixed-currency financial positions instead of silently aggregating them', async () => {
    tx.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-c',
        endorsementId: 'endorsement-1',
        endorsementParticipantId: 'endorsement-participant-c',
        netPremium: new Prisma.Decimal('20000.00'),
        currency: 'USD',
        endorsement: {
          endorsementNumber: 'END-001',
          effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
        },
        endorsementParticipant: {
          counterpartyId: 'reinsurer-c',
          originalParticipantId: null,
          counterparty: { name: 'C Re' },
        },
      },
    ]);

    await expect(
      service.getFinancialPosition(tenantId, placementId, asOfDate),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException for missing or archived placements', async () => {
    tx.placement.findFirst.mockResolvedValue(null);

    await expect(
      service.getFinancialPosition(tenantId, placementId, asOfDate),
    ).rejects.toThrow(NotFoundException);
  });
});
