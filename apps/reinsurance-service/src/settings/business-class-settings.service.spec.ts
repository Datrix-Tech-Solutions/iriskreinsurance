/**
 * Tests for RiskClassSettingsService and RiskTypeSettingsService.
 * File retained at its original path; covers the renamed services after PR1.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { RiskClassSettingsService } from './risk-class-settings.service';
import { RiskTypeSettingsService } from './risk-type-settings.service';

describe('RiskClassSettingsService', () => {
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

  const riskClass = {
    id: 'rc-1',
    tenantId: 'tenant-1',
    name: 'Marine',
    description: null,
    isActive: true,
    displayOrder: 0,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedAt: null,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    riskTypes: [],
  };

  let prisma: {
    riskClass: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placement: {
      count: PrismaMethod;
    };
  };
  let service: RiskClassSettingsService;

  beforeEach(() => {
    prisma = {
      riskClass: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placement: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    service = new RiskClassSettingsService(prisma as unknown as PrismaService);
  });

  it('lists only active non-archived records in the current tenant with paging', async () => {
    prisma.riskClass.findMany.mockResolvedValue([riskClass]);
    prisma.riskClass.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', { page: 2, limit: 5 });

    expect(prisma.riskClass.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: 'tenant-1', archivedAt: null },
      skip: 5,
      take: 5,
    });
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
  });

  it('filters by isActive when provided', async () => {
    prisma.riskClass.findMany.mockResolvedValue([]);
    prisma.riskClass.count.mockResolvedValue(0);

    await service.findAll('tenant-1', { isActive: false });

    expect(prisma.riskClass.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: 'tenant-1', archivedAt: null, isActive: false },
    });
  });

  it('does not expose another tenant record by id', async () => {
    prisma.riskClass.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'rc-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.riskClass.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rc-1', tenantId: 'tenant-1', archivedAt: null },
      }),
    );
  });

  it('creates a risk class with name (no code)', async () => {
    prisma.riskClass.create.mockResolvedValue(riskClass);

    await service.create(user, {
      name: 'Marine',
      isActive: true,
      displayOrder: 0,
    });

    expect(prisma.riskClass.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        name: 'Marine',
        isActive: true,
        displayOrder: 0,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
    });
    const createData = (
      prisma.riskClass.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(createData).not.toHaveProperty('code');
  });

  it('throws ConflictException when name already exists for tenant', async () => {
    const { Prisma } = await import('../../prisma/generated/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '5.x',
      },
    );
    prisma.riskClass.create.mockRejectedValue(p2002);

    await expect(service.create(user, { name: 'Marine' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects empty update payload', async () => {
    await expect(service.update(user, 'rc-1', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.riskClass.update).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields', async () => {
    prisma.riskClass.findFirst.mockResolvedValue(riskClass);
    prisma.riskClass.update.mockResolvedValue({
      ...riskClass,
      name: 'Marine Insurance',
    });

    await service.update(user, 'rc-1', { name: 'Marine Insurance' });

    const updateCall = prisma.riskClass.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data).toMatchObject({
      name: 'Marine Insurance',
      updatedByUserId: 'user-1',
    });
    expect(updateCall.data).not.toHaveProperty('isActive');
  });

  it('refuses to archive when active placements reference a risk type under this class', async () => {
    const rcWithTypes = {
      ...riskClass,
      riskTypes: [{ id: 'rt-1' }],
    };
    prisma.riskClass.findFirst.mockResolvedValue(rcWithTypes);
    prisma.placement.count.mockResolvedValue(3);

    await expect(service.archive(user, 'rc-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.riskClass.update).not.toHaveBeenCalled();
  });

  it('soft-archives when no active placements reference the class', async () => {
    prisma.riskClass.findFirst.mockResolvedValue(riskClass);
    prisma.placement.count.mockResolvedValue(0);
    prisma.riskClass.update.mockResolvedValue({
      ...riskClass,
      archivedAt: new Date(),
    });

    await service.archive(user, 'rc-1');

    const updateArg = prisma.riskClass.update.mock.calls[0]?.[0] as {
      data: { archivedAt: unknown; updatedByUserId: string };
    };
    expect(updateArg.data.updatedByUserId).toBe('user-1');
    expect(updateArg.data.archivedAt).toBeInstanceOf(Date);
  });
});

describe('RiskTypeSettingsService', () => {
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

  const riskType = {
    id: 'rt-1',
    tenantId: 'tenant-1',
    riskClassId: 'rc-1',
    name: 'Marine Cargo',
    description: null,
    isActive: true,
    displayOrder: 0,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedAt: null,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    fields: [],
  };

  const field = {
    id: 'field-1',
    tenantId: 'tenant-1',
    riskTypeId: 'rt-1',
    section: RiskTypeFieldSection.BUSINESS_DETAILS,
    fieldKey: 'vessel_name',
    label: 'Vessel Name',
    fieldType: RiskTypeFieldType.TEXT,
    required: true,
    options: null,
    validationRules: null,
    placeholder: null,
    helpText: null,
    displayOrder: 0,
    isActive: true,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:00:00.000Z'),
  };

  let prisma: {
    riskClass: { findFirst: PrismaMethod };
    riskType: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    riskTypeField: {
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      delete: PrismaMethod;
    };
    placement: { count: PrismaMethod };
  };
  let service: RiskTypeSettingsService;

  beforeEach(() => {
    prisma = {
      riskClass: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      riskType: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      riskTypeField: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
        delete: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placement: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    service = new RiskTypeSettingsService(prisma as unknown as PrismaService);
  });

  it('lists only active non-archived risk types with paging', async () => {
    prisma.riskType.findMany.mockResolvedValue([riskType]);
    prisma.riskType.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', { page: 2, limit: 5 });

    expect(prisma.riskType.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: 'tenant-1', archivedAt: null },
      skip: 5,
      take: 5,
    });
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
  });

  it('does not expose another tenant risk type by id', async () => {
    prisma.riskType.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'rt-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('validates riskClassId existence before creating a risk type', async () => {
    prisma.riskClass.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, { riskClassId: 'rc-1', name: 'Marine Cargo' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.riskType.create).not.toHaveBeenCalled();
  });

  it('creates a risk type under an existing risk class', async () => {
    prisma.riskClass.findFirst.mockResolvedValue({ id: 'rc-1' });
    prisma.riskType.create.mockResolvedValue(riskType);

    await service.create(user, { riskClassId: 'rc-1', name: 'Marine Cargo' });

    expect(prisma.riskType.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        riskClassId: 'rc-1',
        name: 'Marine Cargo',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
    });
  });

  it('throws ConflictException on duplicate name within a risk class', async () => {
    const { Prisma } = await import('../../prisma/generated/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '5.x',
      },
    );
    prisma.riskClass.findFirst.mockResolvedValue({ id: 'rc-1' });
    prisma.riskType.create.mockRejectedValue(p2002);

    await expect(
      service.create(user, { riskClassId: 'rc-1', name: 'Marine Cargo' }),
    ).rejects.toThrow(ConflictException);
  });

  it('refuses to archive when active placements reference this risk type', async () => {
    prisma.riskType.findFirst.mockResolvedValue(riskType);
    prisma.placement.count.mockResolvedValue(2);

    await expect(service.archive(user, 'rt-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.riskType.update).not.toHaveBeenCalled();
  });

  it('soft-archives when no active placements reference this risk type', async () => {
    prisma.riskType.findFirst.mockResolvedValue(riskType);
    prisma.placement.count.mockResolvedValue(0);
    prisma.riskType.update.mockResolvedValue({
      ...riskType,
      archivedAt: new Date(),
    });

    await service.archive(user, 'rt-1');

    const updateArg = prisma.riskType.update.mock.calls[0]?.[0] as {
      data: { archivedAt: unknown; updatedByUserId: string };
    };
    expect(updateArg.data.archivedAt).toBeInstanceOf(Date);
    expect(updateArg.data.updatedByUserId).toBe('user-1');
  });

  it('rejects a SELECT field created without options', async () => {
    prisma.riskType.findFirst.mockResolvedValue(riskType);

    await expect(
      service.createField(user, 'rt-1', {
        section: RiskTypeFieldSection.BUSINESS_DETAILS,
        fieldKey: 'coverage',
        label: 'Coverage Type',
        fieldType: RiskTypeFieldType.SELECT,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.riskTypeField.create).not.toHaveBeenCalled();
  });

  it('creates a TEXT field correctly under a risk type', async () => {
    prisma.riskType.findFirst.mockResolvedValue(riskType);
    prisma.riskTypeField.create.mockResolvedValue(field);

    await service.createField(user, 'rt-1', {
      section: RiskTypeFieldSection.BUSINESS_DETAILS,
      fieldKey: 'vessel_name',
      label: 'Vessel Name',
      fieldType: RiskTypeFieldType.TEXT,
      required: true,
    });

    expect(prisma.riskTypeField.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        riskTypeId: 'rt-1',
        section: RiskTypeFieldSection.BUSINESS_DETAILS,
        fieldKey: 'vessel_name',
        label: 'Vessel Name',
        fieldType: RiskTypeFieldType.TEXT,
        required: true,
      },
    });
    const createData = (
      prisma.riskTypeField.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(createData).not.toHaveProperty('businessClassId');
  });

  it('throws ConflictException on duplicate fieldKey within a section', async () => {
    const { Prisma } = await import('../../prisma/generated/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '5.x',
      },
    );
    prisma.riskType.findFirst.mockResolvedValue(riskType);
    prisma.riskTypeField.create.mockRejectedValue(p2002);

    await expect(
      service.createField(user, 'rt-1', {
        section: RiskTypeFieldSection.BUSINESS_DETAILS,
        fieldKey: 'vessel_name',
        label: 'Vessel Name',
        fieldType: RiskTypeFieldType.TEXT,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects empty field update payload', async () => {
    await expect(
      service.updateField(user, 'rt-1', 'field-1', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes a field after verifying tenant and riskType ownership', async () => {
    prisma.riskTypeField.findFirst.mockResolvedValue(field);
    prisma.riskTypeField.delete.mockResolvedValue(field);

    await service.deleteField(user, 'rt-1', 'field-1');

    expect(prisma.riskTypeField.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'field-1', tenantId: 'tenant-1', riskTypeId: 'rt-1' },
      }),
    );
    expect(prisma.riskTypeField.delete).toHaveBeenCalledWith({
      where: { id: 'field-1' },
    });
  });

  it('throws NotFoundException when deleting a field from another tenant', async () => {
    prisma.riskTypeField.findFirst.mockResolvedValue(null);

    await expect(service.deleteField(user, 'rt-1', 'field-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.riskTypeField.delete).not.toHaveBeenCalled();
  });

  it('returns form schema split by section with only active fields', async () => {
    const offerField = {
      ...field,
      id: 'field-2',
      section: RiskTypeFieldSection.OFFER_DETAILS,
      fieldKey: 'coverage_type',
      label: 'Coverage Type',
      fieldType: RiskTypeFieldType.SELECT,
      options: ['All Risk', 'Named Perils'],
    };
    const inactiveField = {
      ...field,
      id: 'field-3',
      fieldKey: 'old_field',
      isActive: false,
    };

    prisma.riskType.findFirst.mockResolvedValue({
      ...riskType,
      fields: [field, offerField, inactiveField],
    });

    const schema = await service.getFormSchema('tenant-1', 'rt-1');

    expect(schema.businessDetails).toHaveLength(1);
    expect(schema.businessDetails[0]).toMatchObject({
      fieldKey: 'vessel_name',
    });
    expect(schema.offerDetails).toHaveLength(1);
    expect(schema.offerDetails[0]).toMatchObject({ fieldKey: 'coverage_type' });
  });
});
