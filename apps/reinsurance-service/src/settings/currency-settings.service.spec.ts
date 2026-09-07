import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencySettingsService } from './currency-settings.service';

describe('CurrencySettingsService', () => {
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
    permissions: ['operations.reinsurance.settings:VIEW'],
  };

  const baseCurrency = {
    id: 'cur-base',
    tenantId: 'tenant-1',
    isoCode: 'USD',
    name: 'US Dollar',
    symbol: '$',
    exchangeRateToBase: { toNumber: () => 1 } as unknown,
    isBaseCurrency: true,
    isActive: true,
    displayOrder: 0,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedAt: null,
    createdAt: new Date('2026-05-29T10:00:00.000Z'),
    updatedAt: new Date('2026-05-29T10:00:00.000Z'),
  };

  const ghsCurrency = {
    id: 'cur-ghs',
    tenantId: 'tenant-1',
    isoCode: 'GHS',
    name: 'Ghana Cedi',
    symbol: '₵',
    exchangeRateToBase: { toNumber: () => 16.5 } as unknown,
    isBaseCurrency: false,
    isActive: true,
    displayOrder: 1,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedAt: null,
    createdAt: new Date('2026-05-29T10:00:00.000Z'),
    updatedAt: new Date('2026-05-29T10:00:00.000Z'),
  };

  let prisma: {
    currency: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      updateMany: PrismaMethod;
    };
    placement: {
      count: PrismaMethod;
    };
  };
  let service: CurrencySettingsService;

  beforeEach(() => {
    prisma = {
      currency: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
        updateMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placement: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    service = new CurrencySettingsService(prisma as unknown as PrismaService);
  });

  it('lists only non-archived currencies for the tenant with paging — base currency first', async () => {
    prisma.currency.findMany.mockResolvedValue([baseCurrency, ghsCurrency]);
    prisma.currency.count.mockResolvedValue(2);

    const result = await service.findAll('tenant-1', { page: 1, limit: 10 });

    expect(prisma.currency.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: 'tenant-1', archivedAt: null },
      orderBy: [
        { isBaseCurrency: 'desc' },
        { displayOrder: 'asc' },
        { isoCode: 'asc' },
      ],
      skip: 0,
      take: 10,
    });
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('filters by isActive when provided', async () => {
    prisma.currency.findMany.mockResolvedValue([]);
    prisma.currency.count.mockResolvedValue(0);

    await service.findAll('tenant-1', { isActive: false });

    expect(prisma.currency.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: 'tenant-1', archivedAt: null, isActive: false },
    });
  });

  it('does not expose another tenant currency by id', async () => {
    prisma.currency.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'cur-ghs')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.currency.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cur-ghs', tenantId: 'tenant-1', archivedAt: null },
      }),
    );
  });

  it('creates a base currency and forces exchangeRateToBase to 1', async () => {
    prisma.currency.findFirst.mockResolvedValue(null); // no existing base
    prisma.currency.create.mockResolvedValue(baseCurrency);

    await service.create(user, {
      isoCode: 'USD',
      name: 'US Dollar',
      symbol: '$',
      isBaseCurrency: true,
    });

    expect(prisma.currency.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        isoCode: 'USD',
        isBaseCurrency: true,
        exchangeRateToBase: 1,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
    });
  });

  it('creates a non-base currency with the provided exchange rate', async () => {
    prisma.currency.create.mockResolvedValue(ghsCurrency);

    await service.create(user, {
      isoCode: 'GHS',
      name: 'Ghana Cedi',
      exchangeRateToBase: 16.5,
    });

    expect(prisma.currency.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        isoCode: 'GHS',
        isBaseCurrency: false,
        exchangeRateToBase: 16.5,
      },
    });
  });

  it('throws BadRequestException when creating a non-base currency without a rate', async () => {
    await expect(
      service.create(user, { isoCode: 'GHS', name: 'Ghana Cedi' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.currency.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a second base currency is created for the same tenant', async () => {
    prisma.currency.findFirst.mockResolvedValue(baseCurrency); // existing base

    await expect(
      service.create(user, {
        isoCode: 'EUR',
        name: 'Euro',
        isBaseCurrency: true,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.currency.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException when isoCode already exists for tenant (P2002)', async () => {
    const { Prisma } = await import('../../prisma/generated/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '5.x',
      },
    );
    prisma.currency.create.mockRejectedValue(p2002);

    await expect(
      service.create(user, {
        isoCode: 'GHS',
        name: 'Ghana Cedi',
        exchangeRateToBase: 16.5,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects empty update payload', async () => {
    await expect(service.update(user, 'cur-ghs', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.currency.update).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields', async () => {
    prisma.currency.findFirst.mockResolvedValue(ghsCurrency);
    prisma.currency.update.mockResolvedValue({
      ...ghsCurrency,
      exchangeRateToBase: 17,
    });

    await service.update(user, 'cur-ghs', { exchangeRateToBase: 17 });

    const updateCall = prisma.currency.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data).toMatchObject({
      exchangeRateToBase: 17,
      updatedByUserId: 'user-1',
    });
    expect(updateCall.data).not.toHaveProperty('name');
    expect(updateCall.data).not.toHaveProperty('isoCode');
  });

  it('demotes existing base currency when promoting another currency to base', async () => {
    prisma.currency.findFirst.mockResolvedValue(ghsCurrency); // GHS is not base
    prisma.currency.updateMany.mockResolvedValue({ count: 1 });
    prisma.currency.update.mockResolvedValue({
      ...ghsCurrency,
      isBaseCurrency: true,
      exchangeRateToBase: 1,
    });

    await service.update(user, 'cur-ghs', { isBaseCurrency: true });

    const updateManyCall = prisma.currency.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(updateManyCall.where).toMatchObject({
      tenantId: 'tenant-1',
      isBaseCurrency: true,
      id: { not: 'cur-ghs' },
    });
    expect(updateManyCall.data).toEqual({ isBaseCurrency: false });
    const updateCall = prisma.currency.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data).toMatchObject({
      isBaseCurrency: true,
      exchangeRateToBase: 1,
    });
  });

  it('refuses to archive when active placements reference the currency', async () => {
    prisma.currency.findFirst.mockResolvedValue(ghsCurrency);
    prisma.placement.count.mockResolvedValue(5);

    await expect(service.archive(user, 'cur-ghs')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.currency.update).not.toHaveBeenCalled();
  });

  it('soft-archives when no active placements reference the currency', async () => {
    prisma.currency.findFirst.mockResolvedValue(ghsCurrency);
    prisma.placement.count.mockResolvedValue(0);
    prisma.currency.update.mockResolvedValue({
      ...ghsCurrency,
      archivedAt: new Date(),
    });

    await service.archive(user, 'cur-ghs');

    const updateArg = prisma.currency.update.mock.calls[0]?.[0] as {
      data: { archivedAt: unknown; updatedByUserId: string };
    };
    expect(updateArg.data.archivedAt).toBeInstanceOf(Date);
    expect(updateArg.data.updatedByUserId).toBe('user-1');
  });

  it('checks active placements using the correct tenantId and isoCode', async () => {
    prisma.currency.findFirst.mockResolvedValue(ghsCurrency);
    prisma.placement.count.mockResolvedValue(0);
    prisma.currency.update.mockResolvedValue({
      ...ghsCurrency,
      archivedAt: new Date(),
    });

    await service.archive(user, 'cur-ghs');

    expect(prisma.placement.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          currency: 'GHS',
          archivedAt: null,
        },
      }),
    );
  });
});
