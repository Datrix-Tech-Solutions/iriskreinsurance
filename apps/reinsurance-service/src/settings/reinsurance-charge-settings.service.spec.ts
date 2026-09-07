import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  ReinsuranceChargeCalculationBasis,
  ReinsuranceChargeCode,
  ReinsuranceChargeDirection,
  ReinsuranceChargeRateType,
  ReinsuranceChargeRoundingMode,
  ReinsuranceChargeType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceChargeSettingsService } from './reinsurance-charge-settings.service';

describe('ReinsuranceChargeSettingsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const user: RequestUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'TENANT_ADMIN',
    tenantId: 'tenant-1',
    tenantSlug: 'demo',
    tenantName: 'Demo',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: ['operations.reinsurance.taxes-levies:VIEW'],
  };

  const config = {
    id: 'charge-1',
    tenantId: 'tenant-1',
    code: ReinsuranceChargeCode.NIC_LEVY,
    name: 'NIC Levy',
    chargeType: ReinsuranceChargeType.LEVY,
    rateType: ReinsuranceChargeRateType.PERCENTAGE,
    rate: new Prisma.Decimal('1.000000'),
    calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
    direction: ReinsuranceChargeDirection.DEDUCTION,
    currency: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    roundingMode: ReinsuranceChargeRoundingMode.HALF_UP,
    decimalPlaces: 2,
    isEnabled: true,
    displayOrder: 1,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let prisma: {
    reinsuranceChargeConfiguration: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    $executeRaw: jest.MockedFunction<(...args: unknown[]) => Promise<number>>;
    $transaction: jest.MockedFunction<
      (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>
    >;
  };
  let service: ReinsuranceChargeSettingsService;

  beforeEach(() => {
    prisma = {
      reinsuranceChargeConfiguration: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $executeRaw: jest.fn<Promise<number>, unknown[]>().mockResolvedValue(0),
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new ReinsuranceChargeSettingsService(
      prisma as unknown as PrismaService,
    );
  });

  it('lists tenant-scoped charge configurations with filters', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([config]);
    prisma.reinsuranceChargeConfiguration.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      code: ReinsuranceChargeCode.NIC_LEVY,
      currency: 'GHS',
      isEnabled: true,
      page: 1,
      limit: 10,
    });

    expect(
      prisma.reinsuranceChargeConfiguration.findMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        code: ReinsuranceChargeCode.NIC_LEVY,
        currency: 'GHS',
        isEnabled: true,
      },
      skip: 0,
      take: 10,
    });
    expect(result.meta.total).toBe(1);
  });

  it('rejects overlapping effective periods for the same code and currency', async () => {
    prisma.reinsuranceChargeConfiguration.findFirst.mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.create(user, {
        code: ReinsuranceChargeCode.NIC_LEVY,
        name: 'NIC Levy',
        chargeType: ReinsuranceChargeType.LEVY,
        rateType: ReinsuranceChargeRateType.PERCENTAGE,
        rate: 1,
        calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
        direction: ReinsuranceChargeDirection.DEDUCTION,
        currency: 'GHS',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: '2026-12-31T23:59:59.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('serializes create overlap checks with a transaction-scoped advisory lock', async () => {
    prisma.reinsuranceChargeConfiguration.findFirst.mockResolvedValue(null);
    prisma.reinsuranceChargeConfiguration.create.mockResolvedValue(config);

    await service.create(user, {
      code: ReinsuranceChargeCode.NIC_LEVY,
      name: 'NIC Levy',
      chargeType: ReinsuranceChargeType.LEVY,
      rateType: ReinsuranceChargeRateType.PERCENTAGE,
      rate: 1,
      calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
      direction: ReinsuranceChargeDirection.DEDUCTION,
      currency: 'GHS',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(prisma.$executeRaw.mock.calls[0]?.[0])).toContain(
      '::integer',
    );
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.reinsuranceChargeConfiguration.findFirst.mock
        .invocationCallOrder[0],
    );
  });

  it('rejects overlapping updates while excluding the updated record', async () => {
    prisma.reinsuranceChargeConfiguration.findFirst
      .mockResolvedValueOnce(config)
      .mockResolvedValueOnce({ id: 'other-config' });

    await expect(
      service.update(user, config.id, {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: null,
      }),
    ).rejects.toThrow(ConflictException);

    expect(
      prisma.reinsuranceChargeConfiguration.findFirst.mock.calls[1]?.[0],
    ).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        code: ReinsuranceChargeCode.NIC_LEVY,
        currency: null,
        id: { not: config.id },
      },
    });
    expect(prisma.reinsuranceChargeConfiguration.update).not.toHaveBeenCalled();
  });

  it('allows adjacent periods and currency-specific configs beside all-currency configs', async () => {
    prisma.reinsuranceChargeConfiguration.findFirst.mockResolvedValue(null);
    prisma.reinsuranceChargeConfiguration.create.mockResolvedValue({
      ...config,
      currency: 'GHS',
    });

    await service.create(user, {
      code: ReinsuranceChargeCode.NIC_LEVY,
      name: 'NIC Levy GHS',
      chargeType: ReinsuranceChargeType.LEVY,
      rateType: ReinsuranceChargeRateType.PERCENTAGE,
      rate: 1,
      calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
      direction: ReinsuranceChargeDirection.DEDUCTION,
      currency: 'GHS',
      effectiveFrom: '2027-01-01T00:00:00.000Z',
      effectiveTo: null,
    });

    expect(
      prisma.reinsuranceChargeConfiguration.findFirst.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        code: ReinsuranceChargeCode.NIC_LEVY,
        currency: 'GHS',
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date('2027-01-01T00:00:00.000Z') } },
        ],
      },
    });
    expect(prisma.reinsuranceChargeConfiguration.create).toHaveBeenCalled();
  });

  it('rejects activation when another configuration overlaps the same code and currency', async () => {
    prisma.reinsuranceChargeConfiguration.findFirst
      .mockResolvedValueOnce(config)
      .mockResolvedValueOnce({ id: 'overlap' });

    await expect(service.activate(user, config.id)).rejects.toThrow(
      ConflictException,
    );

    expect(prisma.reinsuranceChargeConfiguration.update).not.toHaveBeenCalled();
  });

  it('calculates percentage and fixed charges with additions and deductions', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      {
        ...config,
        id: 'nic',
        rate: new Prisma.Decimal('1'),
        direction: ReinsuranceChargeDirection.DEDUCTION,
      },
      {
        ...config,
        id: 'stamp',
        code: ReinsuranceChargeCode.WITHHOLDING_TAX,
        name: 'Document Fee',
        chargeType: ReinsuranceChargeType.FEE,
        rateType: ReinsuranceChargeRateType.FIXED_AMOUNT,
        rate: new Prisma.Decimal('25'),
        direction: ReinsuranceChargeDirection.ADDITION,
        displayOrder: 2,
      },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 10000,
      commissionAmount: 1000,
      brokerageAmount: 500,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
      isForeignReinsurer: true,
    });

    expect(result.netBeforeCharges).toBe(8500);
    expect(result.deductions).toBe(85);
    expect(result.additions).toBe(25);
    expect(result.netAmount).toBe(8440);
  });

  it('excludes NIC Levy and Withholding Tax when the reinsurer is not foreign', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      { ...config, id: 'nic', code: ReinsuranceChargeCode.NIC_LEVY },
      {
        ...config,
        id: 'wht',
        code: ReinsuranceChargeCode.WITHHOLDING_TAX,
        displayOrder: 2,
      },
    ]);

    const resident = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 10000,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    expect(resident.charges).toEqual([]);
    expect(resident.deductions).toBe(0);
    expect(resident.netAmount).toBe(10000);

    const foreign = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 10000,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
      isForeignReinsurer: true,
    });
    expect(foreign.charges).toHaveLength(2);
    expect(foreign.deductions).toBeGreaterThan(0);
  });

  it('prefers currency-specific configuration over all-currency configuration', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      {
        ...config,
        id: 'generic',
        rate: new Prisma.Decimal('1'),
        currency: null,
      },
      { ...config, id: 'usd', rate: new Prisma.Decimal('2'), currency: 'USD' },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 1000,
      commissionAmount: 0,
      brokerageAmount: 0,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
      isForeignReinsurer: true,
    });

    expect(result.charges).toHaveLength(1);
    expect(result.charges[0]).toMatchObject({
      configurationId: 'usd',
      amount: 20,
    });
  });

  it('uses enabled effective configurations only', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([]);

    await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 1000,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(
      prisma.reinsuranceChargeConfiguration.findMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        isEnabled: true,
        effectiveFrom: { lte: new Date('2026-06-01T00:00:00.000Z') },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date('2026-06-01T00:00:00.000Z') } },
        ],
        AND: [{ OR: [{ currency: 'USD' }, { currency: null }] }],
      },
    });
  });

  it('defensively ignores disabled, future and expired configs when calculating', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      { ...config, id: 'disabled', isEnabled: false },
      {
        ...config,
        id: 'future',
        effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
      },
      {
        ...config,
        id: 'expired',
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2025-12-31T23:59:59.000Z'),
      },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 1000,
      commissionAmount: 100,
      brokerageAmount: 50,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
      isForeignReinsurer: true,
    });

    expect(result.charges).toEqual([]);
    expect(result.additions).toBe(0);
    expect(result.deductions).toBe(0);
    expect(result.netAmount).toBe(850);
  });

  it('orders multiple charges predictably and supports basis variants', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      {
        ...config,
        id: 'gross-addition',
        code: ReinsuranceChargeCode.NIC_LEVY,
        name: 'Gross Fee',
        direction: ReinsuranceChargeDirection.ADDITION,
        calculationBasis: ReinsuranceChargeCalculationBasis.GROSS_AMOUNT,
        rate: new Prisma.Decimal('1'),
        displayOrder: 2,
      },
      {
        ...config,
        id: 'commission-deduction',
        code: ReinsuranceChargeCode.WITHHOLDING_TAX,
        name: 'Commission Withholding',
        chargeType: ReinsuranceChargeType.TAX,
        direction: ReinsuranceChargeDirection.DEDUCTION,
        calculationBasis: ReinsuranceChargeCalculationBasis.COMMISSION_AMOUNT,
        rate: new Prisma.Decimal('10'),
        displayOrder: 1,
      },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 1000,
      commissionAmount: 100,
      brokerageAmount: 50,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
      isForeignReinsurer: true,
    });

    expect(result.charges.map((charge) => charge.configurationId)).toEqual([
      'commission-deduction',
      'gross-addition',
    ]);
    expect(result.charges[0]).toMatchObject({ basisAmount: 100, amount: 10 });
    expect(result.charges[1]).toMatchObject({ basisAmount: 1000, amount: 10 });
    expect(result.netAmount).toBe(850);
  });

  it.each([
    [ReinsuranceChargeRoundingMode.UP, 2],
    [ReinsuranceChargeRoundingMode.DOWN, 1],
    [ReinsuranceChargeRoundingMode.HALF_UP, 1],
  ])('rounds according to %s mode', async (roundingMode, expectedAmount) => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      {
        ...config,
        rate: new Prisma.Decimal('1.111'),
        decimalPlaces: 0,
        roundingMode,
      },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 100,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
      isForeignReinsurer: true,
    });

    expect(result.charges[0].amount).toBe(expectedAmount);
  });
});
