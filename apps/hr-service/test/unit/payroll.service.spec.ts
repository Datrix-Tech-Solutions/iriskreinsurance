/// <reference types="jest" />

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PayrollService } from '../../src/payroll/payroll.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RabbitMQPublisher } from '../../src/messaging/rabbitmq.publisher';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { FieldEncryptionService } from '../../src/crypto/field-encryption.service';
import { RequestUser } from '@work-phelo/types';
import {
  EmployeeCompensationType,
  PayrollTaxPolicy,
} from '../../prisma/generated/client';

const actor = (overrides: Partial<RequestUser> = {}): RequestUser => ({
  id: 'user-1',
  email: 'admin@acme.com',
  role: 'TENANT_ADMIN',
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  tenantName: 'Acme Corp',
  firstName: 'Admin',
  moduleConfig: {},
  featureConfig: {},
  permissions: [],
  ...overrides,
});

const payrollViewer = () =>
  actor({ id: 'user-2', role: 'EMPLOYEE', permissions: ['payroll:VIEW'] });

const plainEmployee = () =>
  actor({ id: 'user-3', role: 'EMPLOYEE', permissions: [] });

const draftRun = {
  id: 'run-1',
  tenantId: 'tenant-1',
  month: 5,
  year: 2026,
  status: 'DRAFT',
  totalGross: '5000',
  totalNet: '4200',
  totalSSNIT: '300',
  totalTier1: '25',
  totalTier2: '250',
  totalTier3: '0',
  totalPAYE: '200',
  totalEmployerCost: '5650',
  notes: null,
  payrollCountry: 'GH',
  payrollCurrency: 'GHS',
  tier3Enabled: false,
  tier3Rate: null,
  tier3SchemeName: null,
  items: [],
};

describe('PayrollService', () => {
  const prisma: any = {
    payrollRun: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    payrollItem: { findMany: jest.fn(), update: jest.fn() },
    employee: { findMany: jest.fn(), findFirst: jest.fn() },
    tenantConfig: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const rabbitmq: any = {
    authResolvePermissionRecipients: jest.fn(async () => []),
    authGetUserStatuses: jest.fn(async () => []),
    notificationPayrollApprovalRequested: jest.fn(async () => undefined),
    notificationPayrollDecision: jest.fn(async () => undefined),
  };

  const notificationsService: any = {
    createMany: jest.fn(async () => []),
  };

  const encryption: any = {
    encrypt: jest.fn((v: unknown) => v),
    decrypt: jest.fn((v: unknown) => v),
    mask: jest.fn((v: unknown) => v),
  };

  let service: PayrollService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: RabbitMQPublisher, useValue: rabbitmq },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: FieldEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = moduleRef.get(PayrollService);
    jest.clearAllMocks();
  });

  // ── getPayrollRuns — access control ──────────────────────────────────────

  describe('getPayrollRuns', () => {
    it('allows TENANT_ADMIN to list payroll runs', async () => {
      prisma.payrollRun.findMany.mockResolvedValueOnce([]);

      await expect(
        service.getPayrollRuns('tenant-1', actor()),
      ).resolves.toEqual([]);
    });

    it('allows EMPLOYEE with payroll:VIEW permission to list payroll runs', async () => {
      prisma.payrollRun.findMany.mockResolvedValueOnce([]);

      await expect(
        service.getPayrollRuns('tenant-1', payrollViewer()),
      ).resolves.toEqual([]);
    });

    it('throws ForbiddenException for EMPLOYEE with no payroll permissions', async () => {
      await expect(
        service.getPayrollRuns('tenant-1', plainEmployee()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── runPayroll ─────────────────────────────────────────────────────────────

  describe('runPayroll', () => {
    const dto = { month: 5, year: 2026, notes: null } as any;

    it('throws BadRequestException when payroll for the month is already approved or paid', async () => {
      prisma.payrollRun.findUnique.mockResolvedValueOnce({
        ...draftRun,
        status: 'APPROVED',
      });

      await expect(
        service.runPayroll('tenant-1', 'user-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when there are no payroll-eligible employees', async () => {
      prisma.payrollRun.findUnique.mockResolvedValueOnce(null);
      prisma.employee.findMany.mockResolvedValueOnce([]);

      await expect(
        service.runPayroll('tenant-1', 'user-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── approvePayroll ─────────────────────────────────────────────────────────

  describe('approvePayroll', () => {
    it('throws BadRequestException when payroll is not in PENDING_APPROVAL status', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftRun,
        status: 'DRAFT',
      });

      await expect(
        service.approvePayroll('tenant-1', 'run-1', actor(), {
          note: 'Approved',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the reviewer note is empty', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftRun,
        status: 'PENDING_APPROVAL',
      });

      await expect(
        service.approvePayroll('tenant-1', 'run-1', actor(), { note: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── returnPayrollToDraft ───────────────────────────────────────────────────

  describe('returnPayrollToDraft', () => {
    it('throws BadRequestException when payroll is not pending approval', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftRun,
        status: 'DRAFT',
      });

      await expect(
        service.returnPayrollToDraft('tenant-1', 'run-1', actor(), {
          note: 'Needs revision',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the reviewer note is empty', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftRun,
        status: 'PENDING_APPROVAL',
      });

      await expect(
        service.returnPayrollToDraft('tenant-1', 'run-1', actor(), {
          note: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── markAsPaid ─────────────────────────────────────────────────────────────

  describe('markAsPaid', () => {
    it('throws NotFoundException when the payroll run does not exist', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.markAsPaid('tenant-1', 'run-missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when payroll is not in APPROVED status', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftRun,
        status: 'DRAFT',
        items: [],
      });

      await expect(
        service.markAsPaid('tenant-1', 'run-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('transitions an APPROVED run to PAID', async () => {
      const approvedRun = { ...draftRun, status: 'APPROVED', items: [] };
      const paidRun = { ...approvedRun, status: 'PAID' };

      prisma.payrollRun.findFirst.mockResolvedValueOnce(approvedRun);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.payrollRun.update.mockResolvedValueOnce(paidRun);

      const result = await service.markAsPaid('tenant-1', 'run-1');

      expect(result.status).toBe('PAID');
      expect(prisma.payrollRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });
  });

  // ── submitPayrollForApproval ───────────────────────────────────────────────

  describe('updatePayrollItem commission fields', () => {
    const draftCommissionRun = {
      ...draftRun,
      status: 'DRAFT',
      payrollCountry: 'GH',
      payrollCurrency: 'GHS',
      tier3Enabled: false,
      tier3Rate: null,
      tier3SchemeName: null,
      items: [
        {
          id: 'item-1',
          basicSalary: '0',
          commissionAmount: '0',
          totalAllowances: '0',
          transportAmount: '0',
          otherDeductions: '0',
          fixedTaxAmount: null,
          taxPolicySnapshot: PayrollTaxPolicy.STANDARD_PAYE,
          compensationTypeSnapshot: EmployeeCompensationType.COMMISSION,
          commissionTaxableSnapshot: true,
          allowanceItems: [],
          deductionItems: [],
        },
      ],
    };

    it('recalculates a draft payroll item with commission and fixed tax', async () => {
      prisma.payrollRun.findFirst
        .mockResolvedValueOnce(draftCommissionRun)
        .mockResolvedValueOnce({
          ...draftCommissionRun,
          items: [],
        });
      prisma.tenantConfig.findUnique.mockResolvedValueOnce(null);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.payrollItem.update.mockResolvedValueOnce({});
      prisma.payrollItem.findMany.mockResolvedValueOnce([
        {
          grossSalary: '2000',
          netSalary: '1850',
          employeeSSNIT: '0',
          employerSSNIT: '0',
          tier1Contribution: '0',
          tier2Contribution: '0',
          tier3Employee: '0',
          payeTax: '150',
        },
      ]);
      prisma.payrollRun.update.mockResolvedValueOnce({});

      await service.updatePayrollItem('tenant-1', 'run-1', 'item-1', {
        commissionAmount: 2000,
        taxPolicy: PayrollTaxPolicy.FIXED_AMOUNT,
        fixedTaxAmount: 150,
      });

      expect(prisma.payrollItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: expect.objectContaining({
          basicSalary: '0',
          commissionAmount: '2000.00',
          grossSalary: '2000',
          taxableIncome: '2000',
          payeTax: '150',
          fixedTaxAmount: '150.00',
          taxPolicySnapshot: PayrollTaxPolicy.FIXED_AMOUNT,
          commissionTaxableSnapshot: true,
          netSalary: '1850',
        }),
      });
    });

    it('rejects commission edits when the payroll item is not in a draft run', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftCommissionRun,
        status: 'APPROVED',
      });

      await expect(
        service.updatePayrollItem('tenant-1', 'run-1', 'item-1', {
          commissionAmount: 2000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollItem.update).not.toHaveBeenCalled();
    });

    it('rejects FIXED_AMOUNT tax policy without a fixed tax amount', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce(draftCommissionRun);

      await expect(
        service.updatePayrollItem('tenant-1', 'run-1', 'item-1', {
          commissionAmount: 2000,
          taxPolicy: PayrollTaxPolicy.FIXED_AMOUNT,
        }),
      ).rejects.toThrow(
        'fixedTaxAmount is required when taxPolicy is FIXED_AMOUNT.',
      );

      expect(prisma.payrollItem.update).not.toHaveBeenCalled();
    });
  });

  describe('submitPayrollForApproval', () => {
    it('throws BadRequestException when the draft run has no payroll items', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftRun,
        status: 'DRAFT',
        items: [],
      });

      await expect(
        service.submitPayrollForApproval('tenant-1', 'run-1', actor()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the run is not a draft', async () => {
      prisma.payrollRun.findFirst.mockResolvedValueOnce({
        ...draftRun,
        status: 'PENDING_APPROVAL',
        items: [{ id: 'item-1' }],
      });

      await expect(
        service.submitPayrollForApproval('tenant-1', 'run-1', actor()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── getMyPayslips ──────────────────────────────────────────────────────────

  describe('getMyPayslips', () => {
    it('throws NotFoundException when no employee record is linked to the userId', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getMyPayslips('tenant-1', 'user-3'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
