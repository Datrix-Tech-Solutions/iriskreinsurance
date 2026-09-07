/// <reference types="jest" />

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LeaveService } from '../../src/leave/leave.service';
import { RabbitMQPublisher } from '../../src/messaging/rabbitmq.publisher';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RequestUser } from '@work-phelo/types';

const actor = (overrides: Partial<RequestUser> = {}): RequestUser => ({
  id: 'user-emp-1',
  email: 'ama@acme.com',
  role: 'EMPLOYEE',
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  tenantName: 'Acme Corp',
  firstName: 'Ama',
  moduleConfig: {},
  featureConfig: {},
  permissions: [],
  ...overrides,
});

const tenantAdmin = () =>
  actor({ id: 'user-admin-1', role: 'TENANT_ADMIN', permissions: [] });

const approver = () =>
  actor({
    id: 'user-approver-1',
    role: 'EMPLOYEE',
    permissions: ['leave:APPROVE'],
  });

const empRecord = {
  id: 'emp-1',
  userId: 'user-emp-1',
  firstName: 'Ama',
  lastName: 'Mensah',
  email: 'ama@acme.com',
  employmentType: 'FULL_TIME',
  employmentStatus: 'ACTIVE',
  gender: 'FEMALE',
  hireDate: new Date('2025-01-01'),
  managerId: null,
  departmentId: null,
};

const activeLeaveType = {
  id: 'lt-annual',
  name: 'Annual Leave',
  isActive: true,
  applicableTo: [],
  applicableGenders: [],
  requiresApproval: true,
  requiresSupportingDocument: false,
  daysAllowed: 21,
};

// Returns an employee record with no branch/nationality so holiday seeding is skipped.
const employeeWithNoLocation = {
  nationality: null,
  region: null,
  branch: null,
};

const pendingLeaveRequest = {
  id: 'req-1',
  tenantId: 'tenant-1',
  status: 'PENDING',
  employeeId: 'emp-1',
  leaveTypeId: 'lt-annual',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-01'),
  totalDays: 1,
  supportingDocumentName: null,
  supportingDocumentUrl: null,
  employee: { id: 'emp-1' },
  leaveType: { requiresSupportingDocument: false },
};

describe('LeaveService', () => {
  const prisma: any = {
    employee: { findFirst: jest.fn(), findUnique: jest.fn() },
    leaveType: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    leaveRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    leaveBalance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    publicHoliday: { findMany: jest.fn() },
    department: { findFirst: jest.fn() },
    notification: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const rabbitmq: any = {
    authResolvePermissionRecipients: jest.fn(async () => []),
    notificationLeaveRequested: jest.fn(async () => undefined),
    notificationLeaveReviewed: jest.fn(async () => undefined),
    notificationLeaveCancelled: jest.fn(async () => undefined),
  };

  let service: LeaveService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: PrismaService, useValue: prisma },
        { provide: RabbitMQPublisher, useValue: rabbitmq },
      ],
    }).compile();

    service = moduleRef.get(LeaveService);
    jest.clearAllMocks();
  });

  // ── Leave types ───────────────────────────────────────────────────────────

  describe('leave type management', () => {
    it('does not overwrite tenant-customized seeded leave types on reseed', async () => {
      prisma.leaveType.upsert.mockResolvedValue({});

      await service.seedDefaultLeaveTypes('tenant-1');

      expect(prisma.leaveType.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_name: { tenantId: 'tenant-1', name: 'Annual Leave' },
          },
          update: { isDefault: true },
        }),
      );
    });

    it('archives seeded leave types instead of rejecting or hard deleting them', async () => {
      prisma.leaveType.findFirst.mockResolvedValueOnce({
        id: 'lt-annual',
        tenantId: 'tenant-1',
        name: 'Annual Leave',
        isDefault: true,
        isActive: true,
      });
      prisma.leaveRequest.count.mockResolvedValueOnce(1);
      prisma.leaveBalance.count.mockResolvedValueOnce(3);
      prisma.leaveType.update.mockResolvedValueOnce({
        id: 'lt-annual',
        tenantId: 'tenant-1',
        name: 'Annual Leave',
        isDefault: true,
        isActive: false,
      });

      const result = await service.deleteLeaveType('tenant-1', 'lt-annual');

      expect(prisma.leaveType.update).toHaveBeenCalledWith({
        where: { id: 'lt-annual' },
        data: { isActive: false },
      });
      expect(result.message).toBe('Leave type archived successfully');
      expect(result.warning).toContain('archived instead');
    });
  });

  // ── createRequest ──────────────────────────────────────────────────────────

  describe('createRequest', () => {
    const dto = {
      leaveTypeId: 'lt-annual',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      reason: 'Rest',
    } as any;

    it('throws NotFoundException when actor has no linked employee record', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createRequest('tenant-1', actor(), dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the leave type does not exist or is inactive', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce(empRecord);
      prisma.leaveType.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createRequest('tenant-1', actor(), dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when a PENDING or APPROVED request overlaps the date range', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce(empRecord);
      prisma.leaveType.findFirst.mockResolvedValueOnce(activeLeaveType);
      prisma.leaveRequest.findFirst.mockResolvedValueOnce({
        id: 'req-existing',
        status: 'PENDING',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-05'),
      });

      await expect(
        service.createRequest('tenant-1', actor(), dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException when leave balance is insufficient', async () => {
      prisma.employee.findFirst
        .mockResolvedValueOnce(empRecord)
        .mockResolvedValueOnce(employeeWithNoLocation);
      prisma.leaveType.findFirst.mockResolvedValueOnce(activeLeaveType);
      prisma.leaveRequest.findFirst.mockResolvedValueOnce(null);
      prisma.publicHoliday.findMany.mockResolvedValueOnce([]);
      prisma.leaveBalance.findUnique.mockResolvedValueOnce({
        id: 'bal-1',
        remainingDays: 0,
        pendingDays: 0,
      });

      await expect(
        service.createRequest('tenant-1', actor(), dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the request and atomically deducts pendingDays when balance is sufficient', async () => {
      const createdRequest = {
        id: 'req-new',
        tenantId: 'tenant-1',
        status: 'PENDING',
        leaveType: activeLeaveType,
        employee: { firstName: 'Ama', lastName: 'Mensah' },
        coverageEmployee: null,
      };

      prisma.employee.findFirst
        .mockResolvedValueOnce(empRecord)
        .mockResolvedValueOnce(employeeWithNoLocation);
      prisma.leaveType.findFirst.mockResolvedValueOnce(activeLeaveType);
      prisma.leaveRequest.findFirst.mockResolvedValueOnce(null);
      prisma.publicHoliday.findMany.mockResolvedValueOnce([]);
      prisma.leaveBalance.findUnique.mockResolvedValueOnce({
        id: 'bal-1',
        remainingDays: 21,
        pendingDays: 0,
      });
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.leaveBalance.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.leaveRequest.create.mockResolvedValueOnce(createdRequest);

      const result = await service.createRequest('tenant-1', actor(), dto);

      expect(result.request.id).toBe('req-new');
      expect(prisma.leaveBalance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'bal-1' }),
        }),
      );
    });
  });

  // ── reviewRequest ──────────────────────────────────────────────────────────

  describe('reviewRequest', () => {
    it('throws BadRequestException when the request has already been reviewed', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValueOnce({
        ...pendingLeaveRequest,
        status: 'APPROVED',
      });

      await expect(
        service.reviewRequest('tenant-1', 'req-1', tenantAdmin(), {
          action: 'APPROVED',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when a plain EMPLOYEE (no APPROVE permission) attempts to review', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValueOnce(pendingLeaveRequest);

      await expect(
        service.reviewRequest('tenant-1', 'req-1', actor(), {
          action: 'APPROVED',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows TENANT_ADMIN to approve a pending request', async () => {
      const approvedRequest = { ...pendingLeaveRequest, status: 'APPROVED' };

      prisma.leaveRequest.findFirst.mockResolvedValueOnce(pendingLeaveRequest);
      prisma.employee.findFirst.mockResolvedValueOnce(employeeWithNoLocation);
      prisma.publicHoliday.findMany.mockResolvedValueOnce([]);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.leaveRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.leaveBalance.findUnique.mockResolvedValueOnce({
        id: 'bal-1',
        remainingDays: 0,
        pendingDays: 1,
      });
      prisma.leaveBalance.update.mockResolvedValueOnce({});
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(approvedRequest);

      const result = await service.reviewRequest(
        'tenant-1',
        'req-1',
        tenantAdmin(),
        { action: 'APPROVED' },
      );

      expect(result.status).toBe('APPROVED');
    });

    it('allows an EMPLOYEE with leave:APPROVE permission to review', async () => {
      const rejectedRequest = { ...pendingLeaveRequest, status: 'REJECTED' };

      prisma.leaveRequest.findFirst.mockResolvedValueOnce(pendingLeaveRequest);
      prisma.employee.findFirst.mockResolvedValueOnce(employeeWithNoLocation);
      prisma.publicHoliday.findMany.mockResolvedValueOnce([]);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.leaveRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.leaveBalance.findUnique.mockResolvedValueOnce({
        id: 'bal-1',
        remainingDays: 0,
        pendingDays: 1,
      });
      prisma.leaveBalance.update.mockResolvedValueOnce({});
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(rejectedRequest);

      const result = await service.reviewRequest(
        'tenant-1',
        'req-1',
        approver(),
        { action: 'REJECTED', note: 'Not enough cover' },
      );

      expect(result.status).toBe('REJECTED');
    });

    it('restores remainingDays on rejection (pendingDays decremented, remaining incremented)', async () => {
      const rejectedRequest = { ...pendingLeaveRequest, status: 'REJECTED' };

      prisma.leaveRequest.findFirst.mockResolvedValueOnce(pendingLeaveRequest);
      prisma.employee.findFirst.mockResolvedValueOnce(employeeWithNoLocation);
      prisma.publicHoliday.findMany.mockResolvedValueOnce([]);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.leaveRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.leaveBalance.findUnique.mockResolvedValueOnce({
        id: 'bal-1',
        remainingDays: 0,
        pendingDays: 1,
      });
      prisma.leaveBalance.update.mockResolvedValueOnce({});
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(rejectedRequest);

      await service.reviewRequest('tenant-1', 'req-1', tenantAdmin(), {
        action: 'REJECTED',
        note: 'Rejected',
      });

      expect(prisma.leaveBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pendingDays: expect.objectContaining({
              decrement: expect.any(Number),
            }),
            remainingDays: expect.objectContaining({
              increment: expect.any(Number),
            }),
          }),
        }),
      );
    });
  });

  // ── getRequests ────────────────────────────────────────────────────────────

  describe('getRequests', () => {
    it('TENANT_ADMIN retrieves all requests without scoping by employeeId', async () => {
      prisma.leaveRequest.findMany.mockResolvedValueOnce([]);

      await service.getRequests('tenant-1', tenantAdmin(), {});

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ employeeId: expect.anything() }),
        }),
      );
    });

    it('EMPLOYEE with leave:APPROVE retrieves all requests without scoping by employeeId', async () => {
      prisma.leaveRequest.findMany.mockResolvedValueOnce([]);

      await service.getRequests('tenant-1', approver(), {});

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ employeeId: 'emp-1' }),
        }),
      );
    });

    it('plain EMPLOYEE sees only their own requests (scoped by employeeId)', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        departmentId: null,
      });
      prisma.leaveRequest.findMany.mockResolvedValueOnce([]);

      await service.getRequests('tenant-1', actor(), {});

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'emp-1' }),
        }),
      );
    });
  });
});
