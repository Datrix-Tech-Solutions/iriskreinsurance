/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CompanyAgreementSignatureStatus,
  CompanyAgreementState,
  CompanyAgreementType,
  EmploymentStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAgreementsService } from './company-agreements.service';

describe('CompanyAgreementsService', () => {
  const prisma: any = {
    companyAgreement: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    companyAgreementVersion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    companyAgreementSignature: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };

  let service: CompanyAgreementsService;

  const agreement = {
    id: 'agreement-1',
    tenantId: 'tenant-1',
    type: CompanyAgreementType.NDA,
    title: 'NDA',
    details: 'Keep company information confidential.',
    documentUrl: null,
    isRequired: true,
    state: CompanyAgreementState.DRAFT,
    activeVersionId: null,
    createdBy: 'admin-1',
    createdAt: new Date('2026-05-20T08:00:00Z'),
    updatedAt: new Date('2026-05-20T08:00:00Z'),
  };

  const publishedAgreement = {
    ...agreement,
    state: CompanyAgreementState.PUBLISHED,
    activeVersionId: 'version-1',
  };

  const version = {
    id: 'version-1',
    tenantId: 'tenant-1',
    agreementId: 'agreement-1',
    version: 1,
    title: 'NDA',
    details: 'Keep company information confidential.',
    documentUrl: null,
    agreementHash: 'hash-1',
    publishedBy: 'admin-1',
    publishedAt: new Date('2026-05-20T08:05:00Z'),
    createdAt: new Date('2026-05-20T08:05:00Z'),
  };

  const employee = {
    id: 'employee-1',
    userId: 'user-1',
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama@example.com',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CompanyAgreementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CompanyAgreementsService);
    jest.clearAllMocks();
  });

  it('publishes an immutable version and activates it for the agreement', async () => {
    prisma.companyAgreement.findFirst.mockResolvedValue(agreement);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue(null);
    prisma.companyAgreementVersion.create.mockImplementation(
      async (args: any) => ({
        id: 'version-1',
        ...args.data,
      }),
    );
    prisma.companyAgreement.update.mockResolvedValue({
      ...agreement,
      state: CompanyAgreementState.PUBLISHED,
      activeVersionId: 'version-1',
    });

    const result = await service.publish(
      'tenant-1',
      'agreement-1',
      {},
      'admin-1',
    );

    expect(result.version).toBe(1);
    expect(result.agreementHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.companyAgreementVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          agreementId: 'agreement-1',
          version: 1,
          title: agreement.title,
          details: agreement.details,
          publishedBy: 'admin-1',
        }),
      }),
    );
    expect(prisma.companyAgreement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agreement-1' },
        data: expect.objectContaining({
          state: CompanyAgreementState.PUBLISHED,
          activeVersionId: 'version-1',
        }),
      }),
    );
  });

  it('does not publish an archived agreement', async () => {
    prisma.companyAgreement.findFirst.mockResolvedValue({
      ...agreement,
      state: CompanyAgreementState.ARCHIVED,
    });

    await expect(
      service.publish('tenant-1', 'agreement-1', {}, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not republish unchanged agreement content', async () => {
    const agreementHash = crypto
      .createHash('sha256')
      .update(
        [
          agreement.tenantId,
          agreement.id,
          agreement.title,
          agreement.details,
          agreement.documentUrl ?? '',
        ].join('|'),
        'utf8',
      )
      .digest('hex');

    prisma.companyAgreement.findFirst.mockResolvedValue(agreement);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue({
      ...version,
      agreementHash,
    });

    await expect(
      service.publish('tenant-1', 'agreement-1', {}, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.companyAgreementVersion.create).not.toHaveBeenCalled();
  });

  it('returns conflict when concurrent publish creates the same version', async () => {
    prisma.companyAgreement.findFirst.mockResolvedValue(agreement);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue(null);
    prisma.companyAgreementVersion.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.publish('tenant-1', 'agreement-1', {}, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('signs only the active version for the authenticated employee', async () => {
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue({
      ...version,
      agreement: publishedAgreement,
    });
    prisma.companyAgreementSignature.create.mockImplementation(
      async (args: any) => ({
        id: 'signature-1',
        ...args.data,
      }),
    );

    const result = await service.signMyAgreement(
      'tenant-1',
      'user-1',
      'version-1',
      { typedName: 'Ama Mensah', consentAccepted: true },
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result.employeeId).toBe('employee-1');
    expect(result.userId).toBe('user-1');
    expect(result.status).toBe(CompanyAgreementSignatureStatus.SIGNED);
    expect(result.typedName).toBe('Ama Mensah');
    expect(result.agreementHash).toBe('hash-1');
    expect(prisma.companyAgreementVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'version-1',
          tenantId: 'tenant-1',
          agreement: expect.objectContaining({
            tenantId: 'tenant-1',
            state: CompanyAgreementState.PUBLISHED,
            activeVersionId: 'version-1',
          }),
        }),
      }),
    );
  });

  it('rejects duplicate sign or decline attempts for the same employee/version', async () => {
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue({
      ...version,
      agreement: publishedAgreement,
    });
    prisma.companyAgreementSignature.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.signMyAgreement(
        'tenant-1',
        'user-1',
        'version-1',
        { typedName: 'Ama Mensah', consentAccepted: true },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not allow signing inactive or archived versions', async () => {
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue(null);

    await expect(
      service.signMyAgreement(
        'tenant-1',
        'user-1',
        'version-1',
        { typedName: 'Ama Mensah', consentAccepted: true },
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the immutable active version snapshot to employees', async () => {
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue({
      ...version,
      title: 'Published NDA',
      details: 'Published text.',
      agreement: {
        ...publishedAgreement,
        title: 'Unpublished working copy title',
        details: 'Unpublished working copy text.',
      },
    });
    prisma.companyAgreementSignature.findUnique.mockResolvedValue(null);

    const result = await service.findMyAgreementVersion(
      'tenant-1',
      'user-1',
      'version-1',
    );

    expect(result.agreement.title).toBe('Published NDA');
    expect(result.agreement.details).toBe('Published text.');
    expect(result.version.title).toBe('Published NDA');
  });

  it('does not resolve employees across tenants for self-service actions', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.signMyAgreement(
        'tenant-2',
        'user-1',
        'version-1',
        { typedName: 'Ama Mensah', consentAccepted: true },
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-2',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('tracks signed, declined, and pending employees for the active version', async () => {
    prisma.companyAgreement.findFirst.mockResolvedValue(publishedAgreement);
    prisma.companyAgreementVersion.findFirst.mockResolvedValue(version);
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'employee-1',
        userId: 'user-1',
        employeeNumber: 'EMP-001',
        firstName: 'Ama',
        lastName: 'Mensah',
        email: 'ama@example.com',
        employmentStatus: EmploymentStatus.ACTIVE,
        department: { id: 'dept-1', name: 'HR' },
      },
      {
        id: 'employee-2',
        userId: 'user-2',
        employeeNumber: 'EMP-002',
        firstName: 'Kofi',
        lastName: 'Boateng',
        email: 'kofi@example.com',
        employmentStatus: EmploymentStatus.PROBATION,
        department: null,
      },
      {
        id: 'employee-3',
        userId: 'user-3',
        employeeNumber: 'EMP-003',
        firstName: 'Akosua',
        lastName: 'Owusu',
        email: 'akosua@example.com',
        employmentStatus: EmploymentStatus.ACTIVE,
        department: null,
      },
    ]);
    prisma.companyAgreementSignature.findMany.mockResolvedValue([
      {
        id: 'signature-1',
        employeeId: 'employee-1',
        status: CompanyAgreementSignatureStatus.SIGNED,
      },
      {
        id: 'signature-2',
        employeeId: 'employee-2',
        status: CompanyAgreementSignatureStatus.DECLINED,
      },
    ]);

    const result = await service.getSignatureTracking(
      'tenant-1',
      'agreement-1',
      {},
    );

    expect(result.summary).toEqual({
      signed: 1,
      declined: 1,
      pending: 1,
      total: 3,
    });
    expect(result.rows.map((row) => row.status)).toEqual([
      CompanyAgreementSignatureStatus.SIGNED,
      CompanyAgreementSignatureStatus.DECLINED,
      'PENDING',
    ]);
  });
});
