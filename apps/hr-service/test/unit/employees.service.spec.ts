import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LeaveService } from '../../src/leave/leave.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { RabbitMQPublisher } from '../../src/messaging/rabbitmq.publisher';
import { PrismaService } from '../../src/prisma/prisma.service';
import { FieldEncryptionService } from '../../src/crypto/field-encryption.service';
import { EmployeesService } from '../../src/employees/employees.service';
import { RESIGNATION_QUEUE } from '../../src/employees/resignation-notification.processor';

describe('EmployeesService', () => {
  const prisma = {
    department: { count: jest.fn(), findFirst: jest.fn() },
    employee: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    branch: { findFirst: jest.fn() },
    tenantConfig: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
  } as any;

  const rabbitmq = {
    authProvisionEmployeeInvite: jest.fn(async () => ({ userId: 'user-1' })),
    authDeletePendingEmployeeInvite: jest.fn(async () => undefined),
  };

  const leaveService = {
    initializeLeaveBalances: jest.fn(async () => undefined),
    ensurePublicHolidaysSeededForEmployee: jest.fn(async () => undefined),
  };

  const notificationsService = {
    notifyEmployeeCreated: jest.fn(async () => undefined),
  };

  const encryption = {
    encryptEmployeeFields: jest.fn((o: unknown) => o),
    decryptEmployeeFields: jest.fn((o: unknown) => o),
    maskListFields: jest.fn((o: unknown) => o),
    encrypt: jest.fn((v: unknown) => v),
    decrypt: jest.fn((v: unknown) => v),
    hmac: jest.fn((v: string) => `hmac:${v}`),
  };

  const resignationQueue = { add: jest.fn(async () => undefined) };

  let service: EmployeesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RabbitMQPublisher, useValue: rabbitmq },
        { provide: LeaveService, useValue: leaveService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: FieldEncryptionService, useValue: encryption },
        {
          provide: getQueueToken(RESIGNATION_QUEUE),
          useValue: resignationQueue,
        },
      ],
    }).compile();

    service = moduleRef.get(EmployeesService);
    jest.clearAllMocks();
  });

  const dto = {
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama.mensah@tenant.test',
    phone: '+233240000000',
    jobTitle: 'HR Generalist',
    employmentType: 'FULL_TIME',
    hireDate: '2025-01-10',
    dateOfBirth: '1995-06-15',
  } as any;

  it('fails fast when tenant has no active departments', async () => {
    prisma.department.count.mockResolvedValue(0);

    await expect(service.create('tenant-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects branch IDs that do not belong to the tenant', async () => {
    prisma.department.count.mockResolvedValue(1);
    prisma.employee.findUnique.mockResolvedValue(null);
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.create('tenant-1', { ...dto, branchId: 'branch-foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates employee and triggers async invite + leave initialization', async () => {
    prisma.department.count.mockResolvedValue(1);
    prisma.employee.findUnique.mockResolvedValue(null);
    prisma.employee.count.mockResolvedValue(0);
    prisma.employee.create.mockResolvedValue({
      id: 'emp-1',
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      hireDate: new Date(dto.hireDate),
    });

    const employee = await service.create('tenant-1', dto);

    expect(employee.id).toBe('emp-1');
    expect(rabbitmq.authProvisionEmployeeInvite).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', email: dto.email }),
    );
    expect(leaveService.initializeLeaveBalances).toHaveBeenCalledWith(
      'tenant-1',
      'emp-1',
    );
  });
});
