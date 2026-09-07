import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyOrigin,
  CounterpartyType,
} from '../../prisma/generated/client';
import { CounterpartyEventPublisher } from '../messaging/counterparty-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { CounterpartiesService } from './counterparties.service';

describe('CounterpartiesService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const user: RequestUser = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  };
  const counterparty = {
    id: 'counterparty-1',
    tenantId: 'tenant-1',
    type: CounterpartyType.CEDANT,
    origin: CounterpartyOrigin.LOCAL,
    name: 'Acme Cedant',
    normalizedName: 'acme cedant',
    registrationNumber: null,
    country: null,
    taxId: null,
    licenseNumber: null,
    email: null,
    phone: null,
    website: null,
    notes: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedByUserId: null,
    archivedAt: null,
    createdAt: new Date('2026-05-26T10:00:00.000Z'),
    updatedAt: new Date('2026-05-26T10:00:00.000Z'),
    contacts: [],
    addresses: [],
  };

  let prisma: {
    counterparty: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
  };
  let publisher: {
    created: jest.Mock;
    updated: jest.Mock;
    deleted: jest.Mock;
  };
  let service: CounterpartiesService;

  beforeEach(() => {
    prisma = {
      counterparty: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    publisher = {
      created: jest.fn().mockResolvedValue(undefined),
      updated: jest.fn().mockResolvedValue(undefined),
      deleted: jest.fn().mockResolvedValue(undefined),
    };
    service = new CounterpartiesService(
      prisma as unknown as PrismaService,
      publisher as unknown as CounterpartyEventPublisher,
    );
  });

  it('lists only active records in the current tenant with filters and paging', async () => {
    prisma.counterparty.findMany.mockResolvedValue([counterparty]);
    prisma.counterparty.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      search: 'Acme',
      type: CounterpartyType.CEDANT,
      origin: CounterpartyOrigin.LOCAL,
      country: 'GH',
      page: 2,
      limit: 10,
    });

    expect(prisma.counterparty.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        archivedAt: null,
        type: CounterpartyType.CEDANT,
        origin: CounterpartyOrigin.LOCAL,
        country: 'GH',
      },
      skip: 10,
      take: 10,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('does not expose another tenant record by id', async () => {
    prisma.counterparty.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'counterparty-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.counterparty.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'counterparty-1',
          tenantId: 'tenant-1',
          archivedAt: null,
        },
      }),
    );
  });

  it('creates nested data under the tenant-owned parent and publishes a lifecycle event', async () => {
    prisma.counterparty.create.mockResolvedValue({
      ...counterparty,
      contacts: [{ id: 'contact-1' }],
      addresses: [{ id: 'address-1' }],
    });

    await service.create(user, {
      type: CounterpartyType.CEDANT,
      name: ' Acme Cedant ',
      contacts: [
        {
          fullName: ' Kofi Broker ',
          email: 'broker@acme.test',
          isPrimary: true,
        },
      ],
      addresses: [
        {
          line1: ' 1 High Street ',
          city: ' Accra ',
          country: 'gh',
          isPrimary: true,
        },
      ],
    });

    expect(prisma.counterparty.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        origin: CounterpartyOrigin.LOCAL,
        name: 'Acme Cedant',
        normalizedName: 'acme cedant',
        contacts: {
          create: [{ fullName: 'Kofi Broker' }],
        },
        addresses: {
          create: [{ country: 'GH' }],
        },
      },
    });
    expect(publisher.created).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        counterpartyId: 'counterparty-1',
      }),
    );
  });

  it('creates a local counterparty without country', async () => {
    prisma.counterparty.create.mockResolvedValue(counterparty);

    await service.create(user, {
      type: CounterpartyType.CEDANT,
      name: 'Local Cedant',
    });

    expect(prisma.counterparty.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        origin: CounterpartyOrigin.LOCAL,
        country: null,
      },
    });
  });

  it('rejects a foreign counterparty without country', async () => {
    await expect(
      service.create(user, {
        type: CounterpartyType.REINSURER,
        origin: CounterpartyOrigin.FOREIGN,
        name: 'Foreign Re',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.counterparty.create).not.toHaveBeenCalled();
  });

  it('rejects invalid country codes before creating records', async () => {
    await expect(
      service.create(user, {
        type: CounterpartyType.REINSURER,
        origin: CounterpartyOrigin.FOREIGN,
        name: 'Foreign Re',
        country: 'ghana',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.counterparty.create).not.toHaveBeenCalled();
  });

  it('creates a foreign counterparty with normalized country and origin details', async () => {
    prisma.counterparty.create.mockResolvedValue({
      ...counterparty,
      origin: CounterpartyOrigin.FOREIGN,
      country: 'NG',
      taxId: 'TIN-001',
      licenseNumber: 'LIC-001',
    });

    await service.create(user, {
      type: CounterpartyType.REINSURER,
      origin: CounterpartyOrigin.FOREIGN,
      name: 'Foreign Re',
      country: 'ng',
      taxId: ' TIN-001 ',
      licenseNumber: ' LIC-001 ',
    });

    expect(prisma.counterparty.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        origin: CounterpartyOrigin.FOREIGN,
        country: 'NG',
        taxId: 'TIN-001',
        licenseNumber: 'LIC-001',
      },
    });
  });

  it('rejects multiple primary contacts before creating records', async () => {
    await expect(
      service.create(user, {
        type: CounterpartyType.BROKER,
        name: 'Broker Group',
        contacts: [
          { fullName: 'A One', email: 'a@test.com', isPrimary: true },
          { fullName: 'B Two', email: 'b@test.com', isPrimary: true },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.counterparty.create).not.toHaveBeenCalled();
  });

  it('does not fail a completed write when audit event delivery fails', async () => {
    const loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.counterparty.create.mockResolvedValue(counterparty);
    publisher.created.mockRejectedValueOnce(new Error('broker offline'));

    await expect(
      service.create(user, {
        type: CounterpartyType.CEDANT,
        name: 'Acme Cedant',
      }),
    ).resolves.toEqual(counterparty);
    await Promise.resolve();

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('audit event failed'),
    );
    loggerWarn.mockRestore();
  });

  it('does not fail a completed write when audit publication throws synchronously', async () => {
    const loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.counterparty.create.mockResolvedValue(counterparty);
    publisher.created.mockImplementationOnce(() => {
      throw new Error('publisher unavailable');
    });

    await expect(
      service.create(user, {
        type: CounterpartyType.CEDANT,
        name: 'Acme Cedant',
      }),
    ).resolves.toEqual(counterparty);

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('audit event failed'),
    );
    loggerWarn.mockRestore();
  });

  it('updates only an active record using the tenant-qualified compound key', async () => {
    prisma.counterparty.findFirst.mockResolvedValue(counterparty);
    prisma.counterparty.update.mockResolvedValue({
      ...counterparty,
      name: 'Updated Cedant',
    });

    await service.update(user, 'counterparty-1', { name: 'Updated Cedant' });

    expect(prisma.counterparty.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_tenantId: { id: 'counterparty-1', tenantId: 'tenant-1' },
          archivedAt: null,
        },
      }),
    );
    expect(publisher.updated).toHaveBeenCalled();
  });

  it('rejects changing a local counterparty to foreign without country', async () => {
    prisma.counterparty.findFirst.mockResolvedValue(counterparty);

    await expect(
      service.update(user, 'counterparty-1', {
        origin: CounterpartyOrigin.FOREIGN,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.counterparty.update).not.toHaveBeenCalled();
  });

  it('changes a local counterparty to foreign when country is provided', async () => {
    prisma.counterparty.findFirst.mockResolvedValue(counterparty);
    prisma.counterparty.update.mockResolvedValue({
      ...counterparty,
      origin: CounterpartyOrigin.FOREIGN,
      country: 'CI',
    });

    await service.update(user, 'counterparty-1', {
      origin: CounterpartyOrigin.FOREIGN,
      country: 'ci',
    });

    expect(prisma.counterparty.update.mock.calls[0]?.[0]).toMatchObject({
      data: {
        origin: CounterpartyOrigin.FOREIGN,
        country: 'CI',
      },
    });
  });

  it('updates tax and licence details', async () => {
    prisma.counterparty.findFirst.mockResolvedValue(counterparty);
    prisma.counterparty.update.mockResolvedValue({
      ...counterparty,
      taxId: 'TIN-002',
      licenseNumber: 'LIC-002',
    });

    await service.update(user, 'counterparty-1', {
      taxId: ' TIN-002 ',
      licenseNumber: ' LIC-002 ',
    });

    expect(prisma.counterparty.update.mock.calls[0]?.[0]).toMatchObject({
      data: {
        taxId: 'TIN-002',
        licenseNumber: 'LIC-002',
      },
    });
  });

  it('archives only an active record in the current tenant', async () => {
    const archived = {
      ...counterparty,
      archivedAt: new Date('2026-05-26T11:00:00.000Z'),
    };
    prisma.counterparty.findFirst.mockResolvedValue(counterparty);
    prisma.counterparty.update.mockResolvedValue(archived);

    await service.archive(user, 'counterparty-1');

    expect(prisma.counterparty.update.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id_tenantId: { id: 'counterparty-1', tenantId: 'tenant-1' },
        archivedAt: null,
      },
      data: {
        archivedByUserId: 'user-1',
      },
    });
    expect(publisher.deleted).toHaveBeenCalled();
  });
});
