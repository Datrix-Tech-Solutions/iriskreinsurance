import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import {
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../prisma/generated/client';
import { CreateRiskClassDto } from './dto/create-risk-class.dto';
import { CreateRiskTypeFieldDto } from './dto/create-risk-type-field.dto';
import { CreateRiskTypeDto } from './dto/create-risk-type.dto';
import { QueryRiskClassesDto } from './dto/query-risk-classes.dto';
import { UpdateRiskClassDto } from './dto/update-risk-class.dto';
import { UpdateRiskTypeFieldDto } from './dto/update-risk-type-field.dto';
import { UpdateRiskTypeDto } from './dto/update-risk-type.dto';
import { RiskClassSettingsController } from './risk-class-settings.controller';
import { RiskClassSettingsService } from './risk-class-settings.service';
import { RiskTypeSettingsController } from './risk-type-settings.controller';
import { RiskTypeSettingsService } from './risk-type-settings.service';

type ServiceMethod = jest.MockedFunction<
  (...args: unknown[]) => Promise<unknown>
>;

describe('RiskClassSettingsController', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'TENANT_ADMIN',
    tenantId: 'tenant-1',
    tenantSlug: 'acme-ghana',
    tenantName: 'Acme Ghana',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: ['operations.reinsurance.settings:VIEW'],
  };

  const request = { user } as Request & { user: RequestUser };
  let service: {
    findAll: ServiceMethod;
    create: ServiceMethod;
    findOne: ServiceMethod;
    update: ServiceMethod;
    archive: ServiceMethod;
  };
  let controller: RiskClassSettingsController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
    };
    controller = new RiskClassSettingsController(
      service as unknown as RiskClassSettingsService,
    );
  });

  it('lists risk classes for the request tenant', async () => {
    const query: QueryRiskClassesDto = { page: 1, limit: 20 };
    service.findAll.mockResolvedValue({ items: [], meta: {} });

    await controller.findAll(query, request);

    expect(service.findAll).toHaveBeenCalledWith('tenant-1', query);
  });

  it('creates a risk class with the request user', async () => {
    const dto: CreateRiskClassDto = { name: 'Marine' };
    service.create.mockResolvedValue({ id: 'rc-1' });

    await controller.create(dto, request);

    expect(service.create).toHaveBeenCalledWith(user, dto);
  });

  it('gets, updates and archives by risk class id', async () => {
    const dto: UpdateRiskClassDto = { name: 'Marine Cargo' };
    service.findOne.mockResolvedValue({ id: 'rc-1' });
    service.update.mockResolvedValue({ id: 'rc-1' });
    service.archive.mockResolvedValue({ id: 'rc-1' });

    await controller.findOne('rc-1', request);
    await controller.update('rc-1', dto, request);
    await controller.archive('rc-1', request);

    expect(service.findOne).toHaveBeenCalledWith('tenant-1', 'rc-1');
    expect(service.update).toHaveBeenCalledWith(user, 'rc-1', dto);
    expect(service.archive).toHaveBeenCalledWith(user, 'rc-1');
  });
});

describe('RiskTypeSettingsController', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'TENANT_ADMIN',
    tenantId: 'tenant-1',
    tenantSlug: 'acme-ghana',
    tenantName: 'Acme Ghana',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: ['operations.reinsurance.settings:VIEW'],
  };

  const request = { user } as Request & { user: RequestUser };
  let service: {
    findAll: ServiceMethod;
    create: ServiceMethod;
    findOne: ServiceMethod;
    update: ServiceMethod;
    archive: ServiceMethod;
    createField: ServiceMethod;
    updateField: ServiceMethod;
    deleteField: ServiceMethod;
    getFormSchema: ServiceMethod;
  };
  let controller: RiskTypeSettingsController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      createField: jest.fn(),
      updateField: jest.fn(),
      deleteField: jest.fn(),
      getFormSchema: jest.fn(),
    };
    controller = new RiskTypeSettingsController(
      service as unknown as RiskTypeSettingsService,
    );
  });

  it('lists and creates risk types through explicit routes', async () => {
    const query: QueryRiskClassesDto = { page: 1, limit: 20 };
    const dto: CreateRiskTypeDto = {
      riskClassId: 'rc-1',
      name: 'Marine Cargo',
    };
    service.findAll.mockResolvedValue({ items: [], meta: {} });
    service.create.mockResolvedValue({ id: 'rt-1' });

    await controller.findAll(query, request);
    await controller.create(dto, request);

    expect(service.findAll).toHaveBeenCalledWith('tenant-1', query);
    expect(service.create).toHaveBeenCalledWith(user, dto);
  });

  it('gets, updates and archives risk types by id', async () => {
    const dto: UpdateRiskTypeDto = { name: 'Marine Hull' };
    service.findOne.mockResolvedValue({ id: 'rt-1' });
    service.update.mockResolvedValue({ id: 'rt-1' });
    service.archive.mockResolvedValue({ id: 'rt-1' });

    await controller.findOne('rt-1', request);
    await controller.update('rt-1', dto, request);
    await controller.archive('rt-1', request);

    expect(service.findOne).toHaveBeenCalledWith('tenant-1', 'rt-1');
    expect(service.update).toHaveBeenCalledWith(user, 'rt-1', dto);
    expect(service.archive).toHaveBeenCalledWith(user, 'rt-1');
  });

  it('manages risk type fields through explicit risk type routes', async () => {
    const createFieldDto: CreateRiskTypeFieldDto = {
      section: RiskTypeFieldSection.BUSINESS_DETAILS,
      fieldKey: 'vessel_name',
      label: 'Vessel Name',
      fieldType: RiskTypeFieldType.TEXT,
    };
    const updateFieldDto: UpdateRiskTypeFieldDto = { label: 'Ship Name' };
    service.createField.mockResolvedValue({ id: 'field-1' });
    service.updateField.mockResolvedValue({ id: 'field-1' });
    service.deleteField.mockResolvedValue(undefined);

    await controller.createField('rt-1', createFieldDto, request);
    await controller.updateField('rt-1', 'field-1', updateFieldDto, request);
    await controller.deleteField('rt-1', 'field-1', request);

    expect(service.createField).toHaveBeenCalledWith(
      user,
      'rt-1',
      createFieldDto,
    );
    expect(service.updateField).toHaveBeenCalledWith(
      user,
      'rt-1',
      'field-1',
      updateFieldDto,
    );
    expect(service.deleteField).toHaveBeenCalledWith(user, 'rt-1', 'field-1');
  });

  it('fetches form schema by risk type id', async () => {
    service.getFormSchema.mockResolvedValue({
      id: 'rt-1',
      businessDetails: [],
      offerDetails: [],
    });

    await controller.getFormSchema('rt-1', request);

    expect(service.getFormSchema).toHaveBeenCalledWith('tenant-1', 'rt-1');
  });
});
