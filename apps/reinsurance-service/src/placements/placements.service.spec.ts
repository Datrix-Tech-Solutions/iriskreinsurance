import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementNoteStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  PlacementType,
  Prisma,
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../prisma/generated/client';
import { PlacementEventPublisher } from '../messaging/placement-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementFinancialLockPolicy } from './finance/financial-lock.policy';
import {
  FacultativeOfferPermission,
  PlacementPermission,
} from './placement.permissions';
import { PlacementsService } from './placements.service';

describe('PlacementsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

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
    permissions: [PlacementPermission.CREATE, PlacementPermission.EDIT],
  };
  const employeeWithPermissions = (permissions: string[]) => ({
    ...user,
    permissions,
  });
  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    reference: 'FAC-2026-0001',
    normalizedReference: 'fac-2026-0001',
    title: 'Acme Energy Placement',
    placementType: PlacementType.FACULTATIVE,
    status: PlacementStatus.DRAFT,
    cedantId: 'cedant-1',
    classOfBusiness: null,
    description: null,
    inceptionDate: null,
    expiryDate: null,
    currency: null,
    sumInsured: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedByUserId: null,
    archiveReason: null,
    archivedAt: null,
    createdAt: new Date('2026-05-28T10:00:00.000Z'),
    updatedAt: new Date('2026-05-28T10:00:00.000Z'),
    cedant: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Cedant',
      registrationNumber: null,
    },
    participants: [],
    statusHistory: [],
  };
  const placementWithParticipant = (
    status: PlacementParticipantStatus = PlacementParticipantStatus.QUOTED,
  ) => ({
    ...placement,
    premium: '1000.00',
    commission: '10.0000',
    facultativeOffer: '60.0000',
    status: PlacementStatus.MARKETING,
    participants: [
      {
        id: 'participant-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        counterpartyId: 'reinsurer-1',
        role: PlacementParticipantRole.REINSURER,
        status,
        sharePercent: '60.0000',
        signedLinePercent: '40.0000',
        brokerageFee: '5.00',
        notes: null,
        counterparty: {
          id: 'reinsurer-1',
          type: CounterpartyType.REINSURER,
          name: 'Ghana Re',
          registrationNumber: null,
        },
      },
    ],
  });
  const acceptedParticipant = {
    id: 'participant-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'reinsurer-1',
    role: PlacementParticipantRole.REINSURER,
    status: PlacementParticipantStatus.ACCEPTED,
    sharePercent: '60.0000',
    signedLinePercent: '40.0000',
    brokerageFee: '5.00',
    notes: null,
    counterparty: {
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      name: 'Ghana Re',
      registrationNumber: null,
    },
  };
  const confirmedClosing = {
    id: 'closing-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    participantId: 'participant-1',
    closingNumber: 'CLO-001',
    status: PlacementClosingStatus.CONFIRMED,
    signedLinePercent: '40.0000',
    sharePercent: '60.0000',
    grossPremium: '400.00',
    commissionPercent: '10.0000',
    commissionAmount: '40.00',
    brokeragePercent: '5.00',
    brokerageAmount: '20.00',
    netPremium: '340.00',
    currency: null,
    issuedAt: new Date('2026-05-28T10:01:00.000Z'),
    confirmedAt: new Date('2026-05-28T10:02:00.000Z'),
    createdByUserId: 'user-1',
    createdAt: new Date('2026-05-28T10:00:00.000Z'),
    updatedAt: new Date('2026-05-28T10:02:00.000Z'),
    participant: acceptedParticipant,
  };

  let prisma: {
    counterparty: {
      findFirst: PrismaMethod;
      findMany: PrismaMethod;
    };
    riskType: {
      findFirst: PrismaMethod;
    };
    placement: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementParticipant: {
      create: PrismaMethod;
      findFirst: PrismaMethod;
      update: PrismaMethod;
      updateMany: PrismaMethod;
      delete: PrismaMethod;
    };
    placementClosing: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      updateMany: PrismaMethod;
    };
    placementNote: {
      count: PrismaMethod;
      findFirst: PrismaMethod;
      updateMany: PrismaMethod;
    };
    placementPayment: {
      count: PrismaMethod;
      findFirst: PrismaMethod;
    };
    placementClaim: {
      findFirst: PrismaMethod;
    };
    placementClaimAllocation: {
      count: PrismaMethod;
      findFirst: PrismaMethod;
    };
    placementClaimCashCall: {
      findFirst: PrismaMethod;
    };
    placementDocument: {
      count: PrismaMethod;
      findMany: PrismaMethod;
      updateMany: PrismaMethod;
    };
    placementEndorsement: {
      findFirst: PrismaMethod;
    };
    placementAttachment: {
      count: PrismaMethod;
    };
    placementEndorsementParticipant: {
      count: PrismaMethod;
    };
    placementStatusHistory: {
      create: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let publisher: {
    created: jest.Mock;
    updated: jest.Mock;
    deleted: jest.Mock;
    statusChanged: jest.Mock;
  };
  let financialLockPolicy: {
    evaluate: jest.Mock;
    assertEditable: jest.Mock;
    assertArchivable: jest.Mock;
  };
  let service: PlacementsService;

  beforeEach(() => {
    prisma = {
      counterparty: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      riskType: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementParticipant: {
        create: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({ count: 0 }),
        delete: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(0),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({ count: 0 }),
      },
      placementNote: {
        count: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(0),
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({ count: 0 }),
      },
      placementPayment: {
        count: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(0),
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
      },
      placementClaim: {
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
      },
      placementClaimAllocation: {
        count: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(0),
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
      },
      placementClaimCashCall: {
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
      },
      placementDocument: {
        count: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(0),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({ count: 0 }),
      },
      placementEndorsement: {
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
      },
      placementAttachment: {
        count: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(0),
      },
      placementEndorsementParticipant: {
        count: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(0),
      },
      placementStatusHistory: {
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    publisher = {
      created: jest.fn().mockResolvedValue(undefined),
      updated: jest.fn().mockResolvedValue(undefined),
      deleted: jest.fn().mockResolvedValue(undefined),
      statusChanged: jest.fn().mockResolvedValue(undefined),
    };
    financialLockPolicy = {
      evaluate: jest.fn().mockResolvedValue({
        editable: true,
        locked: false,
        endorsementRequired: false,
        reason: 'Placement has no financial activity and can be edited.',
        lockSource: 'NONE',
        canEdit: true,
        editRequiresEndorsement: false,
      }),
      assertEditable: jest.fn((item: { status: PlacementStatus }) => {
        if (
          item.status === PlacementStatus.CLOSED ||
          item.status === PlacementStatus.CANCELLED
        ) {
          return Promise.reject(
            new BadRequestException(`Cannot edit a ${item.status} placement.`),
          );
        }
        return Promise.resolve();
      }),
      assertArchivable: jest.fn().mockResolvedValue(undefined),
    };
    service = new PlacementsService(
      prisma as unknown as PrismaService,
      publisher as unknown as PlacementEventPublisher,
      financialLockPolicy as unknown as PlacementFinancialLockPolicy,
    );
  });

  it('lists only active records in the current tenant with filters and paging', async () => {
    prisma.placement.findMany.mockResolvedValue([placement]);
    prisma.placement.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      search: 'FAC-2026',
      status: PlacementStatus.DRAFT,
      placementType: PlacementType.FACULTATIVE,
      cedantId: 'cedant-1',
      page: 2,
      limit: 10,
    });

    expect(prisma.placement.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        archivedAt: null,
        status: PlacementStatus.DRAFT,
        placementType: PlacementType.FACULTATIVE,
        cedantId: 'cedant-1',
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
    expect(result.items[0]).toMatchObject({
      totalOfferedPercent: 0,
      totalAcceptedPercent: 0,
      remainingPercent: 0,
    });
  });

  it('filters open placement statuses before pagination and count', async () => {
    prisma.placement.findMany.mockResolvedValue([
      { ...placement, status: PlacementStatus.DRAFT },
    ]);
    prisma.placement.count.mockResolvedValue(25);

    const openStatuses = [
      PlacementStatus.DRAFT,
      PlacementStatus.MARKETING,
      PlacementStatus.PARTIALLY_PLACED,
      PlacementStatus.PLACED,
    ];

    const result = await service.findAll('tenant-1', {
      statuses: openStatuses,
      page: 1,
      limit: 20,
    });

    const expectedWhere = {
      tenantId: 'tenant-1',
      archivedAt: null,
      status: { in: openStatuses },
    };
    expect(prisma.placement.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: expectedWhere,
      skip: 0,
      take: 20,
    });
    expect(prisma.placement.count.mock.calls[0]?.[0]).toMatchObject({
      where: expectedWhere,
    });
    expect(openStatuses).not.toContain(PlacementStatus.CLOSING);
    expect(openStatuses).not.toContain(PlacementStatus.CLOSED);
    expect(openStatuses).not.toContain(PlacementStatus.DECLINED);
    expect(openStatuses).not.toContain(PlacementStatus.CANCELLED);
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 25,
      totalPages: 2,
    });
  });

  it('lists archived records with the same filters, search and pagination', async () => {
    const archivedPlacement = {
      ...placement,
      archivedAt: new Date('2026-05-28T11:00:00.000Z'),
      archivedByUserId: 'user-1',
      archiveReason: 'Duplicate placement',
    };
    prisma.placement.findMany.mockResolvedValue([archivedPlacement]);
    prisma.placement.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      archived: true,
      search: 'Acme',
      status: PlacementStatus.DRAFT,
      placementType: PlacementType.FACULTATIVE,
      page: 3,
      limit: 5,
    });

    const findManyArgs = prisma.placement.findMany.mock.calls[0]?.[0] as {
      where?: { OR?: unknown };
      orderBy?: unknown;
      skip?: number;
      take?: number;
    };
    expect(findManyArgs).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        archivedAt: { not: null },
        status: PlacementStatus.DRAFT,
        placementType: PlacementType.FACULTATIVE,
      },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 5,
    });
    expect(Array.isArray(findManyArgs.where?.OR)).toBe(true);
    expect(result.items[0]).toMatchObject({
      archivedByUserId: 'user-1',
      archiveReason: 'Duplicate placement',
    });
  });

  it('does not expose another tenant record by id', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.placement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'placement-1',
          tenantId: 'tenant-1',
          archivedAt: null,
        },
      }),
    );
  });

  it('includes lock status on placement detail responses', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);

    const result = await service.findOne('tenant-1', 'placement-1');

    expect(financialLockPolicy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'placement-1',
        tenantId: 'tenant-1',
      }),
    );
    expect(result.lockStatus).toMatchObject({
      editable: true,
      locked: false,
      endorsementRequired: false,
    });
  });

  it('returns tenant-scoped lock status without exposing financial internals', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.MARKETING,
      archivedAt: null,
    });

    const result = await service.getLockStatus('tenant-1', 'placement-1');

    expect(prisma.placement.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'placement-1',
        tenantId: 'tenant-1',
        archivedAt: null,
      },
      select: { id: true, tenantId: true, status: true, archivedAt: true },
    });
    expect(result).toMatchObject({
      editable: true,
      locked: false,
      endorsementRequired: false,
      lockSource: 'NONE',
    });
  });

  it('creates a draft placement with tenant-owned cedant and participant data', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
      },
    ]);
    prisma.placement.create.mockResolvedValue({
      ...placement,
      participants: [{ id: 'participant-1' }],
    });

    await service.create(user, {
      reference: ' FAC-2026-0001 ',
      title: ' Acme Energy Placement ',
      cedantId: 'cedant-1',
      description: ' Subject to survey and signed proposal. ',
      participants: [
        {
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.LEAD_REINSURER,
          sharePercent: 45,
        },
      ],
    });

    expect(prisma.counterparty.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'cedant-1',
          tenantId: 'tenant-1',
          type: CounterpartyType.CEDANT,
          archivedAt: null,
        },
      }),
    );
    expect(prisma.placement.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        reference: 'FAC-2026-0001',
        normalizedReference: 'fac-2026-0001',
        description: 'Subject to survey and signed proposal.',
        status: PlacementStatus.DRAFT,
        participants: {
          create: [
            {
              counterpartyId: 'reinsurer-1',
              role: PlacementParticipantRole.LEAD_REINSURER,
            },
          ],
        },
      },
    });
    expect(publisher.created).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        actorUserId: 'user-1',
      }),
    );
  });

  it('accepts structured custom placement fields alongside configured risk fields', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([]);
    prisma.riskType.findFirst
      .mockResolvedValueOnce({ id: 'risk-type-1', name: 'Marine Cargo' })
      .mockResolvedValueOnce({
        fields: [
          {
            section: RiskTypeFieldSection.BUSINESS_DETAILS,
            fieldKey: 'vessel_name',
            fieldType: RiskTypeFieldType.TEXT,
            required: true,
            options: null,
          },
          {
            section: RiskTypeFieldSection.BUSINESS_DETAILS,
            fieldKey: 'estimated_value',
            fieldType: RiskTypeFieldType.NUMBER,
            required: false,
            options: null,
          },
          {
            section: RiskTypeFieldSection.BUSINESS_DETAILS,
            fieldKey: 'war_cover',
            fieldType: RiskTypeFieldType.CHECKBOX,
            required: false,
            options: null,
          },
        ],
      });
    prisma.placement.create.mockResolvedValue({
      ...placement,
      riskTypeId: 'risk-type-1',
      classOfBusiness: 'Marine Cargo',
      businessDetails: {
        vessel_name: 'MV Ocean Pioneer',
        estimated_value: 125000,
        war_cover: true,
        customFields: [
          {
            id: 'custom-special-condition',
            label: 'Special Condition',
            value: 'Subject to survey',
            type: 'TEXT',
            displayOrder: 1,
          },
        ],
      },
    });

    await service.create(user, {
      reference: 'FAC-2026-0002',
      title: 'Marine Cargo Placement',
      cedantId: 'cedant-1',
      riskTypeId: 'risk-type-1',
      businessDetails: {
        vessel_name: 'MV Ocean Pioneer',
        estimated_value: 125000,
        war_cover: true,
        customFields: [
          {
            id: 'custom-special-condition',
            label: 'Special Condition',
            value: 'Subject to survey',
            type: 'TEXT',
            displayOrder: 1,
          },
        ],
      },
    });

    expect(prisma.placement.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        riskTypeId: 'risk-type-1',
        classOfBusiness: 'Marine Cargo',
        businessDetails: {
          vessel_name: 'MV Ocean Pioneer',
          estimated_value: 125000,
          war_cover: true,
          customFields: [
            {
              id: 'custom-special-condition',
              label: 'Special Condition',
              value: 'Subject to survey',
              type: 'TEXT',
              displayOrder: 1,
            },
          ],
        },
      },
    });
  });

  it('rejects participant roles that do not match counterparty type', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'broker-1',
        type: CounterpartyType.BROKER,
        name: 'Broker Ltd',
      },
    ]);

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0002',
        title: 'Invalid Participant',
        cedantId: 'cedant-1',
        participants: [
          {
            counterpartyId: 'broker-1',
            role: PlacementParticipantRole.LEAD_REINSURER,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placement.create).not.toHaveBeenCalled();
  });

  it('rejects a signed line percentage that exceeds the participant offered share', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0004',
        title: 'Invalid Signed Line',
        cedantId: 'cedant-1',
        participants: [
          {
            counterpartyId: 'reinsurer-1',
            role: PlacementParticipantRole.REINSURER,
            sharePercent: 20,
            signedLinePercent: 30,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placement.create).not.toHaveBeenCalled();
  });

  it('allows multiple participants to be offered the same share before any acceptance', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([
      { id: 'reinsurer-1', type: CounterpartyType.REINSURER, name: 'Ghana Re' },
      {
        id: 'reinsurer-2',
        type: CounterpartyType.REINSURER,
        name: 'Continental Re',
      },
      {
        id: 'reinsurer-3',
        type: CounterpartyType.REINSURER,
        name: 'Africa Re',
      },
    ]);
    prisma.placement.create.mockResolvedValue({
      ...placement,
      facultativeOffer: 30,
      participants: [],
    });

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0010',
        title: 'Multi-Market Offer',
        cedantId: 'cedant-1',
        facultativeOffer: 30,
        participants: [
          {
            counterpartyId: 'reinsurer-1',
            role: PlacementParticipantRole.LEAD_REINSURER,
            sharePercent: 30,
          },
          {
            counterpartyId: 'reinsurer-2',
            role: PlacementParticipantRole.CO_REINSURER,
            sharePercent: 30,
          },
          {
            counterpartyId: 'reinsurer-3',
            role: PlacementParticipantRole.CO_REINSURER,
            sharePercent: 30,
          },
        ],
      }),
    ).resolves.toBeDefined();
    expect(prisma.placement.create).toHaveBeenCalled();
  });

  it('rejects adding an ACCEPTED participant that would push accepted total above the facultative offer cap', async () => {
    const existingWithAccepted = {
      ...placement,
      status: PlacementStatus.MARKETING,
      facultativeOffer: 30,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.LEAD_REINSURER,
          status: PlacementParticipantStatus.ACCEPTED,
          sharePercent: 30,
          signedLinePercent: 25,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    prisma.placement.findFirst.mockResolvedValue(existingWithAccepted);
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'reinsurer-2',
        type: CounterpartyType.REINSURER,
        name: 'Continental Re',
      },
    ]);

    await expect(
      service.addParticipant(user, 'placement-1', {
        counterpartyId: 'reinsurer-2',
        role: PlacementParticipantRole.CO_REINSURER,
        sharePercent: 30,
        signedLinePercent: 10,
        status: PlacementParticipantStatus.ACCEPTED,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementParticipant.create).not.toHaveBeenCalled();
  });

  it('allows ACCEPTED signed capacity that exactly meets the facultative offer cap', async () => {
    const emptyMarketing = {
      ...placement,
      status: PlacementStatus.MARKETING,
      facultativeOffer: 30,
      participants: [],
    };
    const acceptedParticipant = {
      id: 'participant-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      counterpartyId: 'reinsurer-1',
      role: PlacementParticipantRole.LEAD_REINSURER,
      status: PlacementParticipantStatus.ACCEPTED,
      sharePercent: 30,
      signedLinePercent: 30,
      brokerageFee: null,
      notes: null,
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
        registrationNumber: null,
      },
    };
    const withAccepted = {
      ...emptyMarketing,
      participants: [acceptedParticipant],
    };
    const placed = { ...withAccepted, status: PlacementStatus.PLACED };
    prisma.placement.findFirst
      .mockResolvedValueOnce(emptyMarketing)
      .mockResolvedValueOnce(withAccepted);
    prisma.counterparty.findMany.mockResolvedValue([
      { id: 'reinsurer-1', type: CounterpartyType.REINSURER, name: 'Ghana Re' },
    ]);
    prisma.placementParticipant.create.mockResolvedValue({
      id: 'participant-1',
    });
    prisma.placementStatusHistory.create.mockResolvedValue({ id: 'sh-1' });
    prisma.placement.update.mockResolvedValue(placed);

    const result = await service.addParticipant(user, 'placement-1', {
      counterpartyId: 'reinsurer-1',
      role: PlacementParticipantRole.LEAD_REINSURER,
      sharePercent: 30,
      signedLinePercent: 30,
      status: PlacementParticipantStatus.ACCEPTED,
    });

    expect(prisma.placementParticipant.create).toHaveBeenCalled();
    expect(result.totalAcceptedPercent).toBe(30);
    expect(result.remainingPercent).toBe(0);
  });

  it('does not count a DECLINED participant signed line toward the accepted capacity cap', async () => {
    const withAccepted = {
      ...placement,
      status: PlacementStatus.PARTIALLY_PLACED,
      facultativeOffer: 30,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.LEAD_REINSURER,
          status: PlacementParticipantStatus.ACCEPTED,
          sharePercent: 30,
          signedLinePercent: 25,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    const withDeclined = {
      ...withAccepted,
      status: PlacementStatus.PARTIALLY_PLACED,
      participants: [
        withAccepted.participants[0],
        {
          id: 'participant-2',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-2',
          role: PlacementParticipantRole.CO_REINSURER,
          status: PlacementParticipantStatus.DECLINED,
          sharePercent: 30,
          signedLinePercent: 10,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-2',
            type: CounterpartyType.REINSURER,
            name: 'Continental Re',
            registrationNumber: null,
          },
        },
      ],
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(withAccepted)
      .mockResolvedValueOnce(withDeclined);
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'reinsurer-2',
        type: CounterpartyType.REINSURER,
        name: 'Continental Re',
      },
    ]);
    prisma.placementParticipant.create.mockResolvedValue({
      id: 'participant-2',
    });

    const result = await service.addParticipant(user, 'placement-1', {
      counterpartyId: 'reinsurer-2',
      role: PlacementParticipantRole.CO_REINSURER,
      sharePercent: 30,
      signedLinePercent: 10,
      status: PlacementParticipantStatus.DECLINED,
    });

    expect(prisma.placementParticipant.create).toHaveBeenCalled();
    expect(result.totalAcceptedPercent).toBe(25);
    expect(result.remainingPercent).toBe(5);
  });

  it('rejects changing participant status to ACCEPTED when accepted total would exceed the facultative offer cap', async () => {
    const twoParticipants = {
      ...placement,
      status: PlacementStatus.MARKETING,
      facultativeOffer: 30,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.LEAD_REINSURER,
          status: PlacementParticipantStatus.ACCEPTED,
          sharePercent: 30,
          signedLinePercent: 25,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
        {
          id: 'participant-2',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-2',
          role: PlacementParticipantRole.CO_REINSURER,
          status: PlacementParticipantStatus.QUOTED,
          sharePercent: 30,
          signedLinePercent: 10,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-2',
            type: CounterpartyType.REINSURER,
            name: 'Continental Re',
            registrationNumber: null,
          },
        },
      ],
    };
    prisma.placement.findFirst.mockResolvedValue(twoParticipants);

    await expect(
      service.changeParticipantStatus(user, 'placement-1', 'participant-2', {
        status: PlacementParticipantStatus.ACCEPTED,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
  });

  it('returns totalOfferedPercent above 100 and remainingPercent based on accepted not offered', async () => {
    const makeParticipant = (
      id: string,
      cid: string,
      sharePercent: number,
      status: PlacementParticipantStatus,
    ) => ({
      id,
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      counterpartyId: cid,
      role: PlacementParticipantRole.CO_REINSURER,
      status,
      sharePercent,
      signedLinePercent: null,
      brokerageFee: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      counterparty: {
        id: cid,
        type: CounterpartyType.REINSURER,
        name: `Re ${id}`,
        registrationNumber: null,
      },
    });

    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      facultativeOffer: 30,
      participants: [
        makeParticipant(
          'p-1',
          'r-1',
          30,
          PlacementParticipantStatus.OFFER_SENT,
        ),
        makeParticipant(
          'p-2',
          'r-2',
          30,
          PlacementParticipantStatus.OFFER_SENT,
        ),
        makeParticipant(
          'p-3',
          'r-3',
          30,
          PlacementParticipantStatus.OFFER_SENT,
        ),
        makeParticipant(
          'p-4',
          'r-4',
          30,
          PlacementParticipantStatus.OFFER_SENT,
        ),
      ],
    });

    const result = await service.findOne('tenant-1', 'placement-1');

    expect(result.totalOfferedPercent).toBe(120);
    expect(result.totalAcceptedPercent).toBe(0);
    expect(result.remainingPercent).toBe(30);
  });

  it('updates only an active record using the tenant-qualified compound key', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue({
      ...placement,
      title: 'Updated Placement',
    });

    await service.update(user, 'placement-1', { title: 'Updated Placement' });

    expect(prisma.placement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
          archivedAt: null,
        },
      }),
    );
    const updateArgs = prisma.placement.update.mock.calls[0]?.[0] as {
      data?: Record<string, unknown>;
    };
    expect(updateArgs.data).not.toHaveProperty('description');
    expect(publisher.updated).toHaveBeenCalled();
  });

  it('updates placement description when explicitly supplied', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue({
      ...placement,
      description: 'Revised placement comment',
    });

    await service.update(user, 'placement-1', {
      description: ' Revised placement comment ',
    });

    expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
      data: { description: 'Revised placement comment' },
    });
  });

  it('clears placement description when an empty description is supplied', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      description: 'Existing placement comment',
    });
    prisma.placement.update.mockResolvedValue({
      ...placement,
      description: null,
    });

    await service.update(user, 'placement-1', { description: '   ' });

    expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
      data: { description: null },
    });
  });

  it('updates administrative placement fields without reopening or superseding market artifacts', async () => {
    const placedWithoutImmutableActivity = {
      ...placementWithParticipant(PlacementParticipantStatus.CLOSED),
      status: PlacementStatus.PARTIALLY_PLACED,
    };
    const updated = {
      ...placedWithoutImmutableActivity,
      description: 'Internal admin note',
    };
    prisma.placement.findFirst.mockResolvedValue(
      placedWithoutImmutableActivity,
    );
    prisma.placement.update.mockResolvedValue(updated);

    const result = await service.update(user, 'placement-1', {
      description: 'Internal admin note',
    });

    expect(result.status).toBe(PlacementStatus.PARTIALLY_PLACED);
    expect(prisma.placementStatusHistory.create).not.toHaveBeenCalled();
    expect(prisma.placementClosing.updateMany).not.toHaveBeenCalled();
    expect(prisma.placementNote.updateMany).not.toHaveBeenCalled();
    expect(prisma.placementDocument.updateMany).not.toHaveBeenCalled();
    expect(prisma.placementParticipant.updateMany).not.toHaveBeenCalled();
    expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
      data: {
        description: 'Internal admin note',
        status: PlacementStatus.PARTIALLY_PLACED,
      },
    });
  });

  it.each([
    PlacementStatus.CLOSED,
    PlacementStatus.PARTIALLY_PLACED,
    PlacementStatus.CLOSING,
  ])(
    'updates policy number on a %s placement without reopening or mutating historical records',
    async (status) => {
      const placementWithConfirmedHistory = {
        ...placementWithParticipant(PlacementParticipantStatus.CLOSED),
        policyNumber: null,
        status,
      };
      prisma.placement.findFirst.mockResolvedValue(
        placementWithConfirmedHistory,
      );
      prisma.placement.update.mockResolvedValue({
        ...placementWithConfirmedHistory,
        policyNumber: 'POL-2026-001',
      });

      const result = await service.update(user, 'placement-1', {
        policyNumber: 'POL-2026-001',
      });

      expect(result.status).toBe(status);
      expect(result.policyNumber).toBe('POL-2026-001');
      expect(prisma.placementStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.placementClosing.updateMany).not.toHaveBeenCalled();
      expect(prisma.placementNote.updateMany).not.toHaveBeenCalled();
      expect(prisma.placementDocument.updateMany).not.toHaveBeenCalled();
      expect(prisma.placementParticipant.updateMany).not.toHaveBeenCalled();
      expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
        data: {
          policyNumber: 'POL-2026-001',
          status,
        },
      });
    },
  );

  it('keeps a safely editable placement with no active participants in draft without duplicate status history', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue({
      ...placement,
      title: 'Draft Edit',
      status: PlacementStatus.DRAFT,
    });

    const result = await service.update(user, 'placement-1', {
      title: 'Draft Edit',
    });

    expect(result.status).toBe(PlacementStatus.DRAFT);
    expect(prisma.placementStatusHistory.create).not.toHaveBeenCalled();
  });

  it('allows direct placement edits with closings and issued notes when no financial/downstream lock exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(
      placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
    );
    prisma.placement.update.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      title: 'Safe Update',
    });

    await service.update(user, 'placement-1', { title: 'Safe Update' });

    expect(prisma.placementClosing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PlacementClosingStatus.VOID },
      }),
    );
    const noteArgs = prisma.placementNote.updateMany.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(noteArgs?.data).toMatchObject({
      status: PlacementNoteStatus.VOID,
    });
    expect(prisma.placement.update).toHaveBeenCalled();
  });

  it('resets accepted and closed participants to offer-sent when premium changes', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.CLOSED),
      premium: '1000.00',
      status: PlacementStatus.PLACED,
    });
    prisma.placement.update.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.OFFER_SENT),
      premium: '1250.00',
      status: PlacementStatus.MARKETING,
    });

    await service.update(user, 'placement-1', { premium: 1250 });

    expect(
      prisma.placementParticipant.updateMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        status: {
          in: [
            PlacementParticipantStatus.CLOSED,
            PlacementParticipantStatus.ACCEPTED,
            PlacementParticipantStatus.QUOTED,
          ],
        },
      },
      data: { status: PlacementParticipantStatus.OFFER_SENT },
    });
    const historyArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as
      | {
          data: Record<string, unknown>;
        }
      | undefined;
    expect(historyArgs?.data).toMatchObject({
      note: 'Placement edited and returned to Open Offers (material edit: premium)',
    });
    expect(prisma.placementClosing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PlacementClosingStatus.VOID },
      }),
    );
  });

  it('resets accepted participants to offer-sent when expiry date changes', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      expiryDate: new Date('2027-05-31T00:00:00.000Z'),
      status: PlacementStatus.PLACED,
    });
    prisma.placement.update.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.OFFER_SENT),
      status: PlacementStatus.MARKETING,
    });

    await service.update(user, 'placement-1', {
      expiryDate: '2027-06-30T00:00:00.000Z',
    });

    expect(
      prisma.placementParticipant.updateMany.mock.calls[0]?.[0],
    ).toMatchObject({
      data: { status: PlacementParticipantStatus.OFFER_SENT },
    });
  });

  it('resets quoted participants to offer-sent when business details change', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.QUOTED),
      businessDetails: { occupancy: 'Warehouse' },
      status: PlacementStatus.PARTIALLY_PLACED,
    });
    prisma.placement.update.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.OFFER_SENT),
      status: PlacementStatus.MARKETING,
    });

    await service.update(user, 'placement-1', {
      businessDetails: { occupancy: 'Factory' },
    });

    expect(
      prisma.placementParticipant.updateMany.mock.calls[0]?.[0],
    ).toMatchObject({
      data: { status: PlacementParticipantStatus.OFFER_SENT },
    });
  });

  it('does not treat decimal and date formatting-only differences as material edits', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.CLOSED),
      premium: '1000.00',
      expiryDate: new Date('2027-05-31T00:00:00.000Z'),
      status: PlacementStatus.PLACED,
    });
    prisma.placement.update.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      status: PlacementStatus.PLACED,
    });

    await service.update(user, 'placement-1', {
      premium: 1000,
      expiryDate: '2027-05-31T00:00:00.000Z',
    });

    expect(prisma.placementParticipant.updateMany).not.toHaveBeenCalled();
    expect(prisma.placementStatusHistory.create).not.toHaveBeenCalled();
    expect(prisma.placementClosing.updateMany).not.toHaveBeenCalled();
    expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
      data: { status: PlacementStatus.PLACED },
    });
  });

  it('leaves invited and declined participants out of material reoffer resets', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.INVITED),
      premium: '1000.00',
      status: PlacementStatus.PLACED,
    });
    prisma.placement.update.mockResolvedValue({
      ...placementWithParticipant(PlacementParticipantStatus.INVITED),
      status: PlacementStatus.MARKETING,
    });

    await service.update(user, 'placement-1', { premium: 1250 });

    const participantArgs = prisma.placementParticipant.updateMany.mock
      .calls[0]?.[0] as
      | {
          where: {
            status?: { in?: PlacementParticipantStatus[] };
          };
        }
      | undefined;
    expect(participantArgs?.where.status?.in).not.toContain(
      PlacementParticipantStatus.INVITED,
    );
    expect(participantArgs?.where.status?.in).not.toContain(
      PlacementParticipantStatus.DECLINED,
    );
  });

  it('exposes direct edit blocking reason through lock status', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.MARKETING,
      archivedAt: null,
    });
    prisma.placementClaim.findFirst.mockResolvedValueOnce({ id: 'claim-1' });

    const status = await service.getLockStatus('tenant-1', 'placement-1');

    expect(status).toMatchObject({
      editable: false,
      canEdit: false,
      endorsementRequired: true,
      editRequiresEndorsement: true,
      lockSource: 'DOWNSTREAM_ACTIVITY',
      editBlockedReason: 'Claim exists.',
    });
  });

  it('blocks placement updates when financial activity has locked the placement', async () => {
    financialLockPolicy.evaluate.mockResolvedValueOnce({
      editable: false,
      locked: true,
      endorsementRequired: true,
      reason: 'Placement is financially locked. Changes require endorsement.',
      lockSource: 'PREMIUM_PAYMENT',
      canEdit: false,
      editBlockedReason:
        'Placement is financially locked. Changes require endorsement.',
      editRequiresEndorsement: true,
    });
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(
      service.update(user, 'placement-1', { title: 'Locked Update' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('does not silently mutate a closed placement', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      status: PlacementStatus.CLOSED,
    });

    await expect(
      service.update(user, 'placement-1', { title: 'Unsafe Update' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('records status changes in the same transaction as placement update', async () => {
    const marketingPlacement = {
      ...placement,
      status: PlacementStatus.MARKETING,
    };
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue(marketingPlacement);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    await service.changeStatus(user, 'placement-1', {
      status: PlacementStatus.MARKETING,
      note: 'Ready for market',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    const historyArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as {
      data: {
        tenantId: string;
        placementId: string;
        fromStatus: PlacementStatus;
        toStatus: PlacementStatus;
      };
    };
    expect(historyArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      fromStatus: PlacementStatus.DRAFT,
      toStatus: PlacementStatus.MARKETING,
    });
    expect(publisher.statusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PlacementStatus.DRAFT,
        nextStatus: PlacementStatus.MARKETING,
      }),
    );
  });

  it('blocks placement status changes when financial activity has locked the placement', async () => {
    financialLockPolicy.evaluate.mockResolvedValue({
      editable: false,
      locked: true,
      endorsementRequired: true,
      reason: 'Placement is financially locked. Changes require endorsement.',
      lockSource: 'PREMIUM_PAYMENT',
    });
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      status: PlacementStatus.MARKETING,
    });

    await expect(
      service.changeStatus(user, 'placement-1', {
        status: PlacementStatus.CLOSING,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows an unpaid closed placement to reopen to closing', async () => {
    const closed = {
      ...placement,
      status: PlacementStatus.CLOSED,
    };
    const reopened = {
      ...placement,
      status: PlacementStatus.CLOSING,
    };
    prisma.placement.findFirst.mockResolvedValue(closed);
    prisma.placement.update.mockResolvedValue(reopened);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    const result = await service.changeStatus(user, 'placement-1', {
      status: PlacementStatus.CLOSING,
      note: 'Reopen unpaid placement for correction',
    });

    expect(result.status).toBe(PlacementStatus.CLOSING);
    const historyArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as {
      data: {
        fromStatus: PlacementStatus;
        toStatus: PlacementStatus;
      };
    };
    expect(historyArgs.data).toMatchObject({
      fromStatus: PlacementStatus.CLOSED,
      toStatus: PlacementStatus.CLOSING,
    });
    expect(publisher.statusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PlacementStatus.CLOSED,
        nextStatus: PlacementStatus.CLOSING,
      }),
    );
  });

  it('allows reopen-offer permission only for CLOSED to CLOSING', async () => {
    const reopenUser = employeeWithPermissions([
      FacultativeOfferPermission.REOPEN_OFFER,
    ]);
    const closed = {
      ...placement,
      status: PlacementStatus.CLOSED,
    };
    const reopened = {
      ...placement,
      status: PlacementStatus.CLOSING,
    };
    prisma.placement.findFirst.mockResolvedValue(closed);
    prisma.placement.update.mockResolvedValue(reopened);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    await service.changeStatus(reopenUser, 'placement-1', {
      status: PlacementStatus.CLOSING,
      note: 'Reopen unpaid placement for correction',
    });

    const placementUpdateArgs = firstCallArg<{
      data: { status?: PlacementStatus };
    }>(prisma.placement.update);
    expect(placementUpdateArgs.data.status).toBe(PlacementStatus.CLOSING);

    prisma.placement.update.mockClear();
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      status: PlacementStatus.DRAFT,
    });

    await expect(
      service.changeStatus(reopenUser, 'placement-1', {
        status: PlacementStatus.MARKETING,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('blocks reopening a closed placement when financial activity exists', async () => {
    financialLockPolicy.evaluate.mockResolvedValue({
      editable: false,
      locked: true,
      endorsementRequired: true,
      reason: 'Placement is financially locked. Changes require endorsement.',
      lockSource: 'PREMIUM_PAYMENT',
    });
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      status: PlacementStatus.CLOSED,
    });

    await expect(
      service.changeStatus(user, 'placement-1', {
        status: PlacementStatus.CLOSING,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows edits after a closed unpaid placement is reopened to closing', async () => {
    const closed = {
      ...placement,
      status: PlacementStatus.CLOSED,
    };
    const reopened = {
      ...placement,
      status: PlacementStatus.CLOSING,
    };
    const updated = {
      ...reopened,
      title: 'Corrected Placement',
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(closed)
      .mockResolvedValueOnce(reopened);
    prisma.placement.update
      .mockResolvedValueOnce(reopened)
      .mockResolvedValueOnce(updated);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    await service.changeStatus(user, 'placement-1', {
      status: PlacementStatus.CLOSING,
    });
    const result = await service.update(user, 'placement-1', {
      title: 'Corrected Placement',
    });

    expect(result.title).toBe('Corrected Placement');
    const updateArgs = prisma.placement.update.mock.calls.at(-1)?.[0] as {
      data: { title?: string };
    };
    expect(updateArgs.data.title).toBe('Corrected Placement');
  });

  it('force closes placement using confirmed closing percentage', async () => {
    const closingPlacement = {
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      status: PlacementStatus.CLOSING,
      closeMode: null,
      forceClosedAt: null,
      forceClosedByUserId: null,
    };
    const forceClosedAt = new Date('2026-05-28T12:00:00.000Z');
    const closed = {
      ...closingPlacement,
      status: PlacementStatus.CLOSED,
      facultativeOffer: new Prisma.Decimal('80.0000'),
      closeMode: 'FORCED',
      forceClosedAt,
      forceClosedByUserId: user.id,
    };
    prisma.placement.findFirst.mockResolvedValue(closingPlacement);
    prisma.placementClosing.findMany.mockResolvedValue([
      { signedLinePercent: new Prisma.Decimal('40.0000') },
      { signedLinePercent: new Prisma.Decimal('40.0000') },
    ]);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });
    prisma.placement.update.mockResolvedValue(closed);

    const result = await service.forceClose(user, 'placement-1');

    expect(result.status).toBe(PlacementStatus.CLOSED);
    expect(result.forceClosed).toBe(true);
    expect(result.facultativeOffer?.toString()).toBe('80');
    expect(prisma.placementClosing.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: user.tenantId,
        placementId: 'placement-1',
        status: PlacementClosingStatus.CONFIRMED,
        participant: {
          status: { not: PlacementParticipantStatus.DECLINED },
        },
      },
      select: { signedLinePercent: true },
    });
    const historyArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as
      | {
          data: {
            fromStatus: PlacementStatus;
            toStatus: PlacementStatus;
            note: string;
          };
        }
      | undefined;
    expect(historyArgs?.data).toMatchObject({
      fromStatus: PlacementStatus.CLOSING,
      toStatus: PlacementStatus.CLOSED,
    });
    expect(historyArgs?.data.note).toContain('FORCED_OPERATION');
    const updateArgs = prisma.placement.update.mock.calls[0]?.[0] as {
      data: {
        status: PlacementStatus;
        facultativeOffer: Prisma.Decimal;
        closeMode: string;
        forceClosedByUserId: string;
      };
    };
    expect(updateArgs.data.status).toBe(PlacementStatus.CLOSED);
    expect(updateArgs.data.facultativeOffer.toString()).toBe('80');
    expect(updateArgs.data.closeMode).toBe('FORCED');
    expect(updateArgs.data.forceClosedByUserId).toBe(user.id);
    expect(publisher.statusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PlacementStatus.CLOSING,
        nextStatus: PlacementStatus.CLOSED,
        note: 'FORCED_OPERATION',
      }),
    );
  });

  it('force closes a fully placed placement at 100 percent', async () => {
    const placed = {
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      status: PlacementStatus.CLOSING,
      closeMode: null,
      forceClosedAt: null,
      forceClosedByUserId: null,
    };
    prisma.placement.findFirst.mockResolvedValue(placed);
    prisma.placementClosing.findMany.mockResolvedValue([
      { signedLinePercent: new Prisma.Decimal('60.0000') },
      { signedLinePercent: new Prisma.Decimal('40.0000') },
    ]);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });
    prisma.placement.update.mockResolvedValue({
      ...placed,
      status: PlacementStatus.CLOSED,
      facultativeOffer: new Prisma.Decimal('100.0000'),
      closeMode: 'FORCED',
      forceClosedAt: new Date('2026-05-28T12:00:00.000Z'),
      forceClosedByUserId: user.id,
    });

    const result = await service.forceClose(user, 'placement-1');

    expect(result.facultativeOffer?.toString()).toBe('100');
  });

  it('force closes with zero actual placed percentage when no confirmed closings exist', async () => {
    const inClosing = {
      ...placementWithParticipant(PlacementParticipantStatus.OFFER_SENT),
      status: PlacementStatus.CLOSING,
      closeMode: null,
      forceClosedAt: null,
      forceClosedByUserId: null,
    };
    prisma.placement.findFirst.mockResolvedValue(inClosing);
    prisma.placementClosing.findMany.mockResolvedValue([]);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });
    prisma.placement.update.mockResolvedValue({
      ...inClosing,
      status: PlacementStatus.CLOSED,
      facultativeOffer: new Prisma.Decimal('0.0000'),
      closeMode: 'FORCED',
      forceClosedAt: new Date('2026-05-28T12:00:00.000Z'),
      forceClosedByUserId: user.id,
    });

    const result = await service.forceClose(user, 'placement-1');

    expect(result.status).toBe(PlacementStatus.CLOSED);
    expect(result.facultativeOffer?.toString()).toBe('0');
  });

  it('treats repeated force close on an already forced placement as idempotent', async () => {
    const forced = {
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      status: PlacementStatus.CLOSED,
      closeMode: 'FORCED',
      forceClosedAt: new Date('2026-05-28T12:00:00.000Z'),
      forceClosedByUserId: user.id,
    };
    prisma.placement.findFirst.mockResolvedValue(forced);

    const result = await service.forceClose(user, 'placement-1');

    expect(result.status).toBe(PlacementStatus.CLOSED);
    expect(result.forceClosed).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.placementClosing.findMany).not.toHaveBeenCalled();
    expect(prisma.placementStatusHistory.create).not.toHaveBeenCalled();
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('rejects force close for archived placements', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      archivedAt: new Date('2026-05-28T12:00:00.000Z'),
    });

    await expect(service.forceClose(user, 'placement-1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([PlacementStatus.CANCELLED, PlacementStatus.DECLINED])(
    'rejects force close for %s placements',
    async (status) => {
      prisma.placement.findFirst.mockResolvedValue({
        ...placement,
        status,
      });

      await expect(service.forceClose(user, 'placement-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('does not reveal cross-tenant placements during force close', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.forceClose(user, 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('archives only an active record in the current tenant', async () => {
    const archived = {
      ...placement,
      archivedAt: new Date('2026-05-28T11:00:00.000Z'),
      archivedByUserId: 'user-1',
      archiveReason: 'Duplicate placement',
    };
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue(archived);

    await service.archive(user, 'placement-1', {
      archiveReason: 'Duplicate placement',
    });

    expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
        archivedAt: null,
      },
      data: {
        archivedByUserId: 'user-1',
        archiveReason: 'Duplicate placement',
      },
    });
    const updatedMock = publisher.updated as jest.MockedFunction<
      (event: unknown) => Promise<void>
    >;
    const archiveEvent = updatedMock.mock.calls[0]?.[0] as {
      changes?: { after?: Record<string, unknown> };
    };
    expect(archiveEvent.changes?.after).toMatchObject({
      lifecycleEvent: 'PLACEMENT_ARCHIVED',
      reason: 'Duplicate placement',
    });
  });

  it('rejects archiving a placement that is already archived', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      archivedAt: new Date('2026-05-28T11:00:00.000Z'),
    });

    await expect(service.archive(user, 'placement-1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('blocks archive when financial activity has locked the placement', async () => {
    financialLockPolicy.assertArchivable.mockRejectedValueOnce(
      new ConflictException(
        'Placement is financially locked. Changes require endorsement.',
      ),
    );
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(service.archive(user, 'placement-1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('archives a closed placement that has no financial activity', async () => {
    const closed = { ...placement, status: PlacementStatus.CLOSED };
    prisma.placement.findFirst.mockResolvedValue(closed);
    prisma.placement.update.mockResolvedValue({
      ...closed,
      archivedAt: new Date('2026-05-28T11:00:00.000Z'),
      archivedByUserId: 'user-1',
    });

    await service.archive(user, 'placement-1');

    expect(prisma.placement.update).toHaveBeenCalled();
  });

  it('restores an archived placement and clears archive metadata', async () => {
    const archived = {
      ...placement,
      archivedAt: new Date('2026-05-28T11:00:00.000Z'),
      archivedByUserId: 'user-1',
      archiveReason: 'Duplicate placement',
    };
    const restored = {
      ...placement,
      archivedAt: null,
      archivedByUserId: null,
      archiveReason: null,
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(archived)
      .mockResolvedValueOnce(null);
    prisma.placement.update.mockResolvedValue(restored);

    await service.restore(user, 'placement-1');

    expect(prisma.placement.findFirst.mock.calls[1]?.[0]).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        id: { not: 'placement-1' },
        normalizedReference: 'fac-2026-0001',
        archivedAt: null,
      },
      select: { id: true, reference: true },
    });

    expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
      },
      data: {
        archivedAt: null,
        archivedByUserId: null,
        archiveReason: null,
        updatedByUserId: 'user-1',
      },
    });
    const updatedMock = publisher.updated as jest.MockedFunction<
      (event: unknown) => Promise<void>
    >;
    const restoreEvent = updatedMock.mock.calls[0]?.[0] as {
      changes?: {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
      };
    };
    expect(restoreEvent.changes?.before).toMatchObject({
      lifecycleEvent: 'PLACEMENT_RESTORED',
      reason: 'Duplicate placement',
    });
    expect(restoreEvent.changes?.after).toMatchObject({
      lifecycleEvent: 'PLACEMENT_RESTORED',
    });
  });

  it('rejects restoring when another active placement already uses the reference', async () => {
    prisma.placement.findFirst
      .mockResolvedValueOnce({
        ...placement,
        archivedAt: new Date('2026-05-28T11:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'placement-2',
        reference: 'FAC-2026-0001',
      });

    await expect(service.restore(user, 'placement-1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('rejects restoring an active placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(service.restore(user, 'placement-1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('does not restore placements from another tenant', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.restore(user, 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
    const findFirstArgs = prisma.placement.findFirst.mock.calls[0]?.[0] as {
      where?: Record<string, unknown>;
      include?: unknown;
    };
    expect(findFirstArgs.where).toEqual({
      id: 'placement-1',
      tenantId: 'tenant-1',
    });
    expect(findFirstArgs.include).toBeDefined();
  });

  it('adds one participant without replacing the full participant collection', async () => {
    const updatedPlacement = {
      ...placement,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.INVITED,
          sharePercent: 25,
          signedLinePercent: null,
          brokerageFee: 7.5,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(placement)
      .mockResolvedValueOnce(updatedPlacement);
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
      },
    ]);
    prisma.placementParticipant.create.mockResolvedValue({
      id: 'participant-1',
    });

    const result = await service.addParticipant(user, 'placement-1', {
      counterpartyId: 'reinsurer-1',
      role: PlacementParticipantRole.REINSURER,
      sharePercent: 25,
      brokerageFee: 7.5,
    });

    const createArgs = prisma.placementParticipant.create.mock.calls[0]?.[0] as
      | { data?: Record<string, unknown> }
      | undefined;
    expect(createArgs?.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      counterpartyId: 'reinsurer-1',
      status: PlacementParticipantStatus.INVITED,
    });
    expect(result).toMatchObject({
      totalOfferedPercent: 25,
      totalAcceptedPercent: 0,
      remainingPercent: 0,
    });
    expect(publisher.updated).toHaveBeenCalled();
  });

  it('blocks participant mutations when financial activity has locked the placement', async () => {
    const participant = {
      id: 'participant-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      counterpartyId: 'reinsurer-1',
      role: PlacementParticipantRole.REINSURER,
      status: PlacementParticipantStatus.OFFER_SENT,
      sharePercent: 25,
      signedLinePercent: null,
      brokerageFee: null,
      notes: null,
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
        registrationNumber: null,
      },
    };
    financialLockPolicy.assertEditable.mockRejectedValue(
      new ConflictException(
        'Placement is financially locked. Changes require endorsement.',
      ),
    );
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      status: PlacementStatus.MARKETING,
      participants: [participant],
    });

    await expect(
      service.addParticipant(user, 'placement-1', {
        counterpartyId: 'reinsurer-2',
        role: PlacementParticipantRole.CO_REINSURER,
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.updateParticipant(user, 'placement-1', 'participant-1', {
        sharePercent: 30,
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.deleteParticipant(user, 'placement-1', 'participant-1'),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.changeParticipantStatus(user, 'placement-1', 'participant-1', {
        status: PlacementParticipantStatus.QUOTED,
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.placementParticipant.create).not.toHaveBeenCalled();
    expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
    expect(prisma.placementParticipant.delete).not.toHaveBeenCalled();
  });

  it('does not auto-place accepted capacity when facultative offer is not yet known', async () => {
    const existingPlacement = {
      ...placement,
      status: PlacementStatus.MARKETING,
      facultativeOffer: null,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.QUOTED,
          sharePercent: 40,
          signedLinePercent: 30,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    const acceptedPlacement = {
      ...existingPlacement,
      participants: [
        {
          ...existingPlacement.participants[0],
          status: PlacementParticipantStatus.ACCEPTED,
        },
      ],
    };
    const partiallyPlaced = {
      ...acceptedPlacement,
      status: PlacementStatus.PARTIALLY_PLACED,
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(acceptedPlacement);
    prisma.placementParticipant.update.mockResolvedValue({
      id: 'participant-1',
    });
    prisma.placement.update.mockResolvedValue(partiallyPlaced);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    const result = await service.changeParticipantStatus(
      user,
      'placement-1',
      'participant-1',
      {
        status: PlacementParticipantStatus.ACCEPTED,
      },
    );

    expect(result.status).toBe(PlacementStatus.PARTIALLY_PLACED);
    expect(result.remainingPercent).toBe(0);
    const statusHistoryArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect(statusHistoryArgs?.data).toMatchObject({
      fromStatus: PlacementStatus.MARKETING,
      toStatus: PlacementStatus.PARTIALLY_PLACED,
    });
  });

  it('updates one participant and recalculates accepted capacity aggregates', async () => {
    const existingPlacement = {
      ...placement,
      facultativeOffer: 60,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.INVITED,
          sharePercent: 30,
          signedLinePercent: null,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    const acceptedPlacement = {
      ...existingPlacement,
      participants: [
        {
          ...existingPlacement.participants[0],
          status: PlacementParticipantStatus.ACCEPTED,
          signedLinePercent: 20,
        },
      ],
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(acceptedPlacement);
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
      },
    ]);
    prisma.placementParticipant.update.mockResolvedValue({
      id: 'participant-1',
    });

    const result = await service.updateParticipant(
      user,
      'placement-1',
      'participant-1',
      {
        signedLinePercent: 20,
        status: PlacementParticipantStatus.ACCEPTED,
      },
    );

    const updateArgs = prisma.placementParticipant.update.mock.calls[0]?.[0] as
      | {
          where?: Record<string, unknown>;
          data?: Record<string, unknown>;
        }
      | undefined;
    expect(updateArgs?.where).toMatchObject({ id: 'participant-1' });
    expect(updateArgs?.data).toMatchObject({
      signedLinePercent: 20,
      status: PlacementParticipantStatus.ACCEPTED,
    });
    expect(result).toMatchObject({
      totalOfferedPercent: 30,
      totalAcceptedPercent: 20,
      remainingPercent: 40,
    });
  });

  it('moves a marketing placement to partially placed when accepted capacity is below target', async () => {
    const existingPlacement = {
      ...placement,
      status: PlacementStatus.MARKETING,
      facultativeOffer: 60,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.OFFER_SENT,
          sharePercent: 30,
          signedLinePercent: null,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    const acceptedPlacement = {
      ...existingPlacement,
      participants: [
        {
          ...existingPlacement.participants[0],
          status: PlacementParticipantStatus.ACCEPTED,
          signedLinePercent: 20,
        },
      ],
    };
    const partiallyPlaced = {
      ...acceptedPlacement,
      status: PlacementStatus.PARTIALLY_PLACED,
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(acceptedPlacement);
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
      },
    ]);
    prisma.placementParticipant.update.mockResolvedValue({
      id: 'participant-1',
    });
    prisma.placement.update.mockResolvedValue(partiallyPlaced);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    const result = await service.updateParticipant(
      user,
      'placement-1',
      'participant-1',
      {
        signedLinePercent: 20,
        status: PlacementParticipantStatus.ACCEPTED,
      },
    );

    expect(result.status).toBe(PlacementStatus.PARTIALLY_PLACED);
    const partialHistoryArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect(partialHistoryArgs?.data).toMatchObject({
      fromStatus: PlacementStatus.MARKETING,
      toStatus: PlacementStatus.PARTIALLY_PLACED,
    });
    expect(publisher.statusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PlacementStatus.MARKETING,
        nextStatus: PlacementStatus.PARTIALLY_PLACED,
      }),
    );
  });

  it('moves a partially placed placement to placed when accepted capacity reaches target', async () => {
    const existingPlacement = {
      ...placement,
      status: PlacementStatus.PARTIALLY_PLACED,
      facultativeOffer: 60,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.QUOTED,
          sharePercent: 60,
          signedLinePercent: 30,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    const acceptedPlacement = {
      ...existingPlacement,
      participants: [
        {
          ...existingPlacement.participants[0],
          status: PlacementParticipantStatus.ACCEPTED,
          signedLinePercent: 60,
        },
      ],
    };
    const placed = {
      ...acceptedPlacement,
      status: PlacementStatus.PLACED,
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(acceptedPlacement);
    prisma.placementParticipant.update.mockResolvedValue({
      id: 'participant-1',
    });
    prisma.placement.update.mockResolvedValue(placed);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    const result = await service.changeParticipantStatus(
      user,
      'placement-1',
      'participant-1',
      {
        status: PlacementParticipantStatus.ACCEPTED,
      },
    );

    expect(result.status).toBe(PlacementStatus.PLACED);
    const placedHistoryArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect(placedHistoryArgs?.data).toMatchObject({
      fromStatus: PlacementStatus.PARTIALLY_PLACED,
      toStatus: PlacementStatus.PLACED,
    });
  });

  it('changes participant status through the workflow endpoint', async () => {
    const offeredPlacement = {
      ...placement,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.INVITED,
          sharePercent: 30,
          signedLinePercent: null,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    };
    const sentPlacement = {
      ...offeredPlacement,
      participants: [
        {
          ...offeredPlacement.participants[0],
          status: PlacementParticipantStatus.OFFER_SENT,
          notes: 'Offer slip sent',
        },
      ],
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(offeredPlacement)
      .mockResolvedValueOnce(sentPlacement);
    prisma.placementParticipant.update.mockResolvedValue({
      id: 'participant-1',
    });

    await service.changeParticipantStatus(
      user,
      'placement-1',
      'participant-1',
      {
        status: PlacementParticipantStatus.OFFER_SENT,
        note: 'Offer slip sent',
      },
    );

    expect(prisma.placementParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: PlacementParticipantStatus.OFFER_SENT,
          notes: 'Offer slip sent',
        },
      }),
    );
  });

  it('rejects accepted participant status when no signed line is recorded', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.OFFER_SENT,
          sharePercent: 30,
          signedLinePercent: null,
          brokerageFee: null,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
          },
        },
      ],
    });

    await expect(
      service.changeParticipantStatus(user, 'placement-1', 'participant-1', {
        status: PlacementParticipantStatus.ACCEPTED,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
  });

  it('accepts a participant and creates, issues and confirms a closing transactionally', async () => {
    const existingPlacement = placementWithParticipant(
      PlacementParticipantStatus.QUOTED,
    );
    const placementAfterWorkflow = {
      ...existingPlacement,
      status: PlacementStatus.PARTIALLY_PLACED,
      participants: [acceptedParticipant],
    };
    const draftClosing = {
      ...confirmedClosing,
      status: PlacementClosingStatus.DRAFT,
      issuedAt: null,
      confirmedAt: null,
    };
    const issuedClosing = {
      ...draftClosing,
      status: PlacementClosingStatus.ISSUED,
      issuedAt: new Date('2026-05-28T10:01:00.000Z'),
    };

    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(placementAfterWorkflow)
      .mockResolvedValueOnce(placementAfterWorkflow);
    prisma.placementParticipant.update.mockResolvedValue(acceptedParticipant);
    prisma.placement.update.mockResolvedValue(placementAfterWorkflow);
    prisma.placementClosing.findFirst.mockResolvedValue(null);
    prisma.placementClosing.count.mockResolvedValue(0);
    prisma.placementClosing.create.mockResolvedValue(draftClosing);
    prisma.placementClosing.update
      .mockResolvedValueOnce(issuedClosing)
      .mockResolvedValueOnce(confirmedClosing);

    const result = await service.acceptParticipantAndConfirm(
      user,
      'placement-1',
      'participant-1',
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.placementParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'participant-1' },
        data: { status: PlacementParticipantStatus.ACCEPTED },
      }),
    );
    const createClosingArgs = prisma.placementClosing.create.mock
      .calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect(createClosingArgs?.data).toMatchObject({
      closingNumber: 'CLO-001',
      status: PlacementClosingStatus.DRAFT,
      grossPremium: 400,
      commissionAmount: 40,
      brokerageAmount: 20,
      netPremium: 340,
    });
    const issueClosingArgs = prisma.placementClosing.update.mock
      .calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect(issueClosingArgs?.data).toMatchObject({
      status: PlacementClosingStatus.ISSUED,
    });
    const confirmClosingArgs = prisma.placementClosing.update.mock
      .calls[1]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect(confirmClosingArgs?.data).toMatchObject({
      status: PlacementClosingStatus.CONFIRMED,
    });
    expect(result.participant.status).toBe(PlacementParticipantStatus.ACCEPTED);
    expect(result.closing.status).toBe(PlacementClosingStatus.CONFIRMED);
  });

  it('moves a placement to CLOSING when the sole invited reinsurer closes but capacity remains unfilled', async () => {
    const existingPlacement = placementWithParticipant(
      PlacementParticipantStatus.QUOTED,
    );
    const placementAfterWorkflow = {
      ...existingPlacement,
      status: PlacementStatus.PARTIALLY_PLACED,
      participants: [acceptedParticipant],
    };
    const draftClosing = {
      ...confirmedClosing,
      status: PlacementClosingStatus.DRAFT,
      issuedAt: null,
      confirmedAt: null,
    };
    const issuedClosing = {
      ...draftClosing,
      status: PlacementClosingStatus.ISSUED,
      issuedAt: new Date('2026-05-28T10:01:00.000Z'),
    };

    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(placementAfterWorkflow)
      .mockResolvedValueOnce(placementAfterWorkflow);
    prisma.placementParticipant.update.mockResolvedValue(acceptedParticipant);
    prisma.placement.update.mockResolvedValue(placementAfterWorkflow);
    prisma.placementClosing.findFirst.mockResolvedValue(null);
    prisma.placementClosing.count.mockResolvedValue(0);
    prisma.placementClosing.create.mockResolvedValue(draftClosing);
    prisma.placementClosing.update
      .mockResolvedValueOnce(issuedClosing)
      .mockResolvedValueOnce(confirmedClosing);
    // The one invited reinsurer now has a confirmed closing at 40%, short of the 60% offer —
    // everyone invited has been resolved, but there's still capacity left on the offer.
    prisma.placementClosing.findMany.mockResolvedValue([
      { participantId: 'participant-1', signedLinePercent: '40.0000' },
    ]);
    prisma.placementStatusHistory.create.mockResolvedValue({ id: 'sh-1' });

    await service.acceptParticipantAndConfirm(
      user,
      'placement-1',
      'participant-1',
    );

    type StatusHistoryCreateCall = [
      {
        data: {
          fromStatus: PlacementStatus;
          toStatus: PlacementStatus;
          note?: string;
        };
      },
    ];
    const statusHistoryCalls = prisma.placementStatusHistory.create.mock
      .calls as unknown as StatusHistoryCreateCall[];
    const closingTransition = statusHistoryCalls.find(
      ([args]) => args.data.toStatus === PlacementStatus.CLOSING,
    );
    expect(closingTransition?.[0].data).toMatchObject({
      fromStatus: PlacementStatus.PARTIALLY_PLACED,
      toStatus: PlacementStatus.CLOSING,
      note: 'All invited reinsurers have resolved their offers with capacity remaining',
    });
    expect(prisma.placement.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' } },
      data: { status: PlacementStatus.CLOSING, updatedByUserId: 'user-1' },
    });

    const closedTransition = statusHistoryCalls.some(
      ([args]) => args.data.toStatus === PlacementStatus.CLOSED,
    );
    expect(closedTransition).toBe(false);

    type PlacementUpdateCall = [{ data: { status?: PlacementStatus } }];
    const placementUpdateCalls = prisma.placement.update.mock
      .calls as unknown as PlacementUpdateCall[];
    const closedUpdate = placementUpdateCalls.some(
      ([args]) => args.data.status === PlacementStatus.CLOSED,
    );
    expect(closedUpdate).toBe(false);
  });

  it('auto closes a CLOSING placement when accept-and-confirm reaches the facultative offer', async () => {
    const existingPlacement = {
      ...placementWithParticipant(PlacementParticipantStatus.QUOTED),
      status: PlacementStatus.CLOSING,
      facultativeOffer: '40.0000',
    };
    const draftClosing = {
      ...confirmedClosing,
      status: PlacementClosingStatus.DRAFT,
      issuedAt: null,
      confirmedAt: null,
    };
    const issuedClosing = {
      ...draftClosing,
      status: PlacementClosingStatus.ISSUED,
      issuedAt: new Date('2026-05-28T10:01:00.000Z'),
    };

    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce({
        ...existingPlacement,
        status: PlacementStatus.CLOSED,
      });
    prisma.placementParticipant.update.mockResolvedValue(acceptedParticipant);
    prisma.placementClosing.findFirst.mockResolvedValue(null);
    prisma.placementClosing.count.mockResolvedValue(0);
    prisma.placementClosing.create.mockResolvedValue(draftClosing);
    prisma.placementClosing.update
      .mockResolvedValueOnce(issuedClosing)
      .mockResolvedValueOnce(confirmedClosing)
      .mockResolvedValueOnce({
        ...existingPlacement,
        status: PlacementStatus.CLOSED,
      });
    prisma.placementClosing.findMany.mockResolvedValue([
      { signedLinePercent: '40.0000' },
    ]);
    prisma.placement.update.mockResolvedValue({
      ...existingPlacement,
      status: PlacementStatus.CLOSED,
    });
    prisma.placementStatusHistory.create.mockResolvedValue({ id: 'sh-close' });

    await service.acceptParticipantAndConfirm(
      user,
      'placement-1',
      'participant-1',
    );

    const statusHistoryArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as
      | {
          data: Record<string, unknown>;
        }
      | undefined;
    expect(statusHistoryArgs?.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      fromStatus: PlacementStatus.CLOSING,
      toStatus: PlacementStatus.CLOSED,
    });
    expect(prisma.placement.update).toHaveBeenCalledWith({
      where: {
        id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
      },
      data: {
        status: PlacementStatus.CLOSED,
        updatedByUserId: 'user-1',
      },
    });
  });

  it('moves a fully confirmed PLACED placement through CLOSING to CLOSED during accept-and-confirm', async () => {
    const existingPlacement = {
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      status: PlacementStatus.PLACED,
      facultativeOffer: '40.0000',
      participants: [acceptedParticipant],
    };
    const closedPlacement = {
      ...existingPlacement,
      status: PlacementStatus.CLOSED,
    };
    const draftClosing = {
      ...confirmedClosing,
      status: PlacementClosingStatus.DRAFT,
      issuedAt: null,
      confirmedAt: null,
    };
    const issuedClosing = {
      ...draftClosing,
      status: PlacementClosingStatus.ISSUED,
      issuedAt: new Date('2026-05-28T10:01:00.000Z'),
    };

    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(closedPlacement);
    prisma.placementParticipant.findFirst.mockResolvedValue(
      acceptedParticipant,
    );
    prisma.placementClosing.findFirst.mockResolvedValue(null);
    prisma.placementClosing.count.mockResolvedValue(0);
    prisma.placementClosing.create.mockResolvedValue(draftClosing);
    prisma.placementClosing.update
      .mockResolvedValueOnce(issuedClosing)
      .mockResolvedValueOnce(confirmedClosing);
    prisma.placementClosing.findMany.mockResolvedValue([
      { signedLinePercent: '40.0000' },
    ]);
    prisma.placement.update.mockResolvedValue(closedPlacement);
    prisma.placementStatusHistory.create.mockResolvedValue({ id: 'history' });

    await service.acceptParticipantAndConfirm(
      user,
      'placement-1',
      'participant-1',
    );

    type StatusHistoryCreateCall = [
      { data: { fromStatus: PlacementStatus; toStatus: PlacementStatus } },
    ];
    const statusHistoryCalls = prisma.placementStatusHistory.create.mock
      .calls as unknown as StatusHistoryCreateCall[];
    const statusHistoryTransitions = statusHistoryCalls.map(([args]) => ({
      fromStatus: args.data.fromStatus,
      toStatus: args.data.toStatus,
    }));
    expect(statusHistoryTransitions).toContainEqual({
      fromStatus: PlacementStatus.PLACED,
      toStatus: PlacementStatus.CLOSING,
    });
    expect(statusHistoryTransitions).toContainEqual({
      fromStatus: PlacementStatus.CLOSING,
      toStatus: PlacementStatus.CLOSED,
    });
    expect(prisma.placement.update).toHaveBeenCalledWith({
      where: {
        id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
      },
      data: {
        status: PlacementStatus.CLOSING,
        updatedByUserId: 'user-1',
      },
    });
    expect(prisma.placement.update).toHaveBeenCalledWith({
      where: {
        id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
      },
      data: {
        status: PlacementStatus.CLOSED,
        updatedByUserId: 'user-1',
      },
    });
  });

  it('reuses an existing confirmed closing on retry without creating a duplicate', async () => {
    const existingPlacement = {
      ...placementWithParticipant(PlacementParticipantStatus.ACCEPTED),
      status: PlacementStatus.PARTIALLY_PLACED,
      participants: [acceptedParticipant],
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement);
    prisma.placementParticipant.findFirst.mockResolvedValue(
      acceptedParticipant,
    );
    prisma.placementClosing.findFirst.mockResolvedValue(confirmedClosing);

    const result = await service.acceptParticipantAndConfirm(
      user,
      'placement-1',
      'participant-1',
    );

    expect(prisma.placementParticipant.update).not.toHaveBeenCalled();
    expect(prisma.placementClosing.create).not.toHaveBeenCalled();
    expect(prisma.placementClosing.update).not.toHaveBeenCalled();
    expect(result.closing.id).toBe('closing-1');
    expect(result.closing.status).toBe(PlacementClosingStatus.CONFIRMED);
  });

  it('confirms an existing active draft closing instead of creating a duplicate', async () => {
    const existingPlacement = placementWithParticipant(
      PlacementParticipantStatus.QUOTED,
    );
    const placementAfterWorkflow = {
      ...existingPlacement,
      status: PlacementStatus.PARTIALLY_PLACED,
      participants: [acceptedParticipant],
    };
    const draftClosing = {
      ...confirmedClosing,
      status: PlacementClosingStatus.DRAFT,
      issuedAt: null,
      confirmedAt: null,
    };
    const issuedClosing = {
      ...draftClosing,
      status: PlacementClosingStatus.ISSUED,
      issuedAt: new Date('2026-05-28T10:01:00.000Z'),
    };
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(placementAfterWorkflow)
      .mockResolvedValueOnce(placementAfterWorkflow);
    prisma.placementParticipant.update.mockResolvedValue(acceptedParticipant);
    prisma.placement.update.mockResolvedValue(placementAfterWorkflow);
    prisma.placementClosing.findFirst.mockResolvedValue(draftClosing);
    prisma.placementClosing.update
      .mockResolvedValueOnce(issuedClosing)
      .mockResolvedValueOnce(confirmedClosing);

    await service.acceptParticipantAndConfirm(
      user,
      'placement-1',
      'participant-1',
    );

    expect(prisma.placementClosing.create).not.toHaveBeenCalled();
    expect(prisma.placementClosing.update).toHaveBeenCalledTimes(2);
  });

  it('deletes one participant without archiving the placement', async () => {
    const existingPlacement = placementWithParticipant();
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(placement);
    prisma.placementParticipant.delete.mockResolvedValue({
      id: 'participant-1',
    });

    await service.deleteParticipant(user, 'placement-1', 'participant-1');

    expect(prisma.placementParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
    });
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('rejects participant deletion when a placement closing depends on it', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(
      placementWithParticipant(),
    );
    prisma.placementClosing.count.mockResolvedValueOnce(1);

    await expect(
      service.deleteParticipant(user, 'placement-1', 'participant-1'),
    ).rejects.toThrow('placement closings');
    expect(prisma.placementParticipant.delete).not.toHaveBeenCalled();
  });

  it('rejects participant deletion when notes or payments depend on it', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(
      placementWithParticipant(),
    );
    prisma.placementNote.count.mockResolvedValueOnce(1);
    prisma.placementPayment.count.mockResolvedValueOnce(1);

    await expect(
      service.deleteParticipant(user, 'placement-1', 'participant-1'),
    ).rejects.toThrow('placement notes, placement payments');
    expect(prisma.placementParticipant.delete).not.toHaveBeenCalled();
  });

  it('rejects participant deletion when claim allocations, documents, or endorsement participants depend on it', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(
      placementWithParticipant(),
    );
    prisma.placementClaimAllocation.count.mockResolvedValueOnce(1);
    prisma.placementDocument.count.mockResolvedValueOnce(1);
    prisma.placementEndorsementParticipant.count.mockResolvedValueOnce(1);

    await expect(
      service.deleteParticipant(user, 'placement-1', 'participant-1'),
    ).rejects.toThrow(
      'claim allocations, placement documents, endorsement participants',
    );
    expect(prisma.placementParticipant.delete).not.toHaveBeenCalled();
  });

  it('rejects participant deletion when attachments reference the participant', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(
      placementWithParticipant(),
    );
    prisma.placementAttachment.count.mockResolvedValueOnce(1);

    await expect(
      service.deleteParticipant(user, 'placement-1', 'participant-1'),
    ).rejects.toThrow('placement attachments');
    expect(prisma.placementAttachment.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        participantId: 'participant-1',
      },
    });
    expect(prisma.placementParticipant.delete).not.toHaveBeenCalled();
  });

  it('does not block participant deletion for placement-level or other-participant attachments', async () => {
    const existingPlacement = placementWithParticipant();
    prisma.placement.findFirst
      .mockResolvedValueOnce(existingPlacement)
      .mockResolvedValueOnce(placement);
    prisma.placementParticipant.delete.mockResolvedValue({
      id: 'participant-1',
    });

    await service.deleteParticipant(user, 'placement-1', 'participant-1');

    expect(prisma.placementAttachment.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        participantId: 'participant-1',
      },
    });
    expect(prisma.placementParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
    });
  });

  it('blocks participant deletion when a voided attachment still preserves participant history', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(
      placementWithParticipant(),
    );
    prisma.placementAttachment.count.mockResolvedValueOnce(1);

    await expect(
      service.deleteParticipant(user, 'placement-1', 'participant-1'),
    ).rejects.toThrow(ConflictException);
    const countArgs = prisma.placementAttachment.count.mock.calls[0]?.[0] as {
      where?: Record<string, unknown>;
    };
    expect(countArgs.where).not.toHaveProperty('status');
    expect(prisma.placementParticipant.delete).not.toHaveBeenCalled();
  });

  it('converts late participant FK delete failures into business conflicts', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(
      placementWithParticipant(),
    );
    prisma.placementParticipant.delete.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.22.0',
        },
      ),
    );

    await expect(
      service.deleteParticipant(user, 'placement-1', 'participant-1'),
    ).rejects.toThrow(
      'This participant cannot be deleted because it is referenced by one or more related records.',
    );
  });

  it('does not fail a completed write when audit event delivery fails', async () => {
    const loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([]);
    prisma.placement.create.mockResolvedValue(placement);
    publisher.created.mockRejectedValueOnce(new Error('broker offline'));

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0003',
        title: 'Fail Open Audit',
        cedantId: 'cedant-1',
      }),
    ).resolves.toMatchObject(placement);
    await Promise.resolve();

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('audit event failed'),
    );
    loggerWarn.mockRestore();
  });

  it('returns offer slip preview values using the current frontend formulas', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      riskTypeId: 'risk-type-1',
      classOfBusiness: 'Marine Cargo',
      businessDetails: { vessel_name: 'MV Ocean Pioneer' },
      offerDetails: { coverage_type: 'All Risk' },
      currency: 'USD',
      sumInsured: 500000,
      rate: 2,
      premium: 10000,
      commission: 10,
      facultativeOffer: 40,
      preliminaryBrokerage: null,
      cedant: {
        ...placement.cedant,
        email: 'cedant@example.com',
        phone: '+233240000000',
        country: 'GH',
        contacts: [
          {
            id: 'contact-1',
            fullName: 'Ama Cedant',
            jobTitle: 'Manager',
            email: 'ama@example.com',
            phone: '+233240000001',
            isPrimary: true,
          },
        ],
        addresses: [
          {
            id: 'address-1',
            label: 'Head office',
            line1: '1 High Street',
            line2: null,
            city: 'Accra',
            state: 'Greater Accra',
            postalCode: null,
            country: 'GH',
            isPrimary: true,
          },
        ],
      },
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.OFFER_SENT,
          sharePercent: 40,
          signedLinePercent: null,
          brokerageFee: 5,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: 'RE-001',
            email: 're@example.com',
            phone: '+233240000002',
            country: 'GH',
            contacts: [],
            addresses: [],
          },
        },
      ],
    });

    const result = await service.getOfferSlipPreview('tenant-1', 'placement-1');

    expect(prisma.placement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'placement-1',
          tenantId: 'tenant-1',
          archivedAt: null,
        },
      }),
    );
    expect(result.businessEntries).toEqual([
      { key: 'vessel_name', label: 'Vessel Name', value: 'MV Ocean Pioneer' },
    ]);
    expect(result.offerEntries).toEqual([
      { key: 'coverage_type', label: 'Coverage Type', value: 'All Risk' },
    ]);
    expect(result.debitGuaranteeFinancials).toMatchObject({
      facSumInsured: 200000,
      facPremium: 4000,
      commissionAmount: 400,
      netPremium: 3600,
    });
    expect(result.participantPreviews[0]).toMatchObject({
      participant: {
        id: 'participant-1',
        brokerageFee: 5,
        counterparty: {
          email: 're@example.com',
          phone: '+233240000002',
          country: 'GH',
          registrationNumber: 'RE-001',
        },
      },
      slipFinancials: {
        brokerageFee: 5,
        facOffer: 40,
        facSumInsured: 200000,
        reinsurancePremium: 4000,
        commissions: 600,
        netPremium: 3400,
      },
      distributionFinancials: {
        shareLine: 40,
        brokerageFee: 5,
        facPremium: 4000,
        premiumShare: 1600,
        brokerageAmount: 80,
      },
    });
  });

  it('keeps slip previews readable when financial activity has locked mutations', async () => {
    financialLockPolicy.assertEditable.mockRejectedValue(
      new ConflictException(
        'Placement is financially locked. Changes require endorsement.',
      ),
    );
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      businessDetails: {},
      offerDetails: {},
      sumInsured: 500000,
      premium: 10000,
      commission: 10,
      facultativeOffer: 40,
      cedant: {
        ...placement.cedant,
        email: null,
        phone: null,
        country: 'GH',
        contacts: [],
        addresses: [],
      },
      participants: [],
    });

    await expect(
      service.getOfferSlipPreview('tenant-1', 'placement-1'),
    ).resolves.toMatchObject({
      placement: { id: 'placement-1' },
      totalOfferedPercent: 0,
    });
    expect(financialLockPolicy.assertEditable).not.toHaveBeenCalled();
  });

  it('returns closing preview values using the current frontend formulas', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      classOfBusiness: 'Marine Cargo',
      businessDetails: {},
      offerDetails: {},
      currency: 'USD',
      sumInsured: 500000,
      premium: 10000,
      commission: 10,
      facultativeOffer: 40,
      cedant: {
        ...placement.cedant,
        email: null,
        phone: null,
        country: 'GH',
        contacts: [],
        addresses: [],
      },
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.ACCEPTED,
          sharePercent: 40,
          signedLinePercent: 30,
          brokerageFee: 5,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: 'RE-001',
            email: 're@example.com',
            phone: '+233240000002',
            country: 'GH',
            contacts: [],
            addresses: [],
          },
        },
      ],
    });

    const result = await service.getClosingSlipPreview(
      'tenant-1',
      'placement-1',
      'participant-1',
    );

    expect(result.slipFinancials).toMatchObject({
      brokerageFee: 5,
      facOffer: 40,
      facSumInsured: 200000,
      reinsurancePremium: 4000,
      commissions: 600,
      netPremium: 3400,
    });
    expect(result.closingRow).toMatchObject({
      signedShare: 30,
      signedGrossPremium: 3000,
      brokerageFee: 5,
    });
    expect(result.creditNoteFinancials).toMatchObject({
      sharePercent: 30,
      brokerageFee: 5,
      yourSumInsured: 150000,
      yourPremium: 3000,
      totalCommissionPct: 15,
      commissionAmount: 450,
      nicLevyPct: 0,
      nicLevyAmount: 0,
      withholdingTaxPct: 0,
      withholdingTaxAmount: 0,
      netPremium: 2550,
    });
  });

  it('generates slip preview with zeroed offer calculations when facultativeOffer is omitted', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      classOfBusiness: 'Marine Cargo',
      businessDetails: {},
      offerDetails: {},
      currency: 'USD',
      sumInsured: 500000,
      premium: 10000,
      commission: 10,
      facultativeOffer: null,
      cedant: {
        ...placement.cedant,
        email: null,
        phone: null,
        country: 'GH',
        contacts: [],
        addresses: [],
      },
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.OFFER_SENT,
          sharePercent: 40,
          signedLinePercent: null,
          brokerageFee: 5,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
            email: null,
            phone: null,
            country: 'GH',
            contacts: [],
            addresses: [],
          },
        },
      ],
    });

    const result = await service.getOfferSlipPreview('tenant-1', 'placement-1');

    expect(result.participantPreviews[0]?.slipFinancials).toMatchObject({
      facOffer: 0,
      facSumInsured: 0,
      reinsurancePremium: 0,
      commissions: 0,
      netPremium: 0,
    });
    expect(result.participantPreviews[0]?.distributionFinancials).toMatchObject(
      {
        facPremium: 0,
        premiumShare: 0,
        brokerageAmount: 0,
      },
    );
    expect(result.remainingPercent).toBe(0);
  });

  it('rejects closing preview for participants that are not accepted or closed', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      cedant: {
        ...placement.cedant,
        email: null,
        phone: null,
        country: 'GH',
        contacts: [],
        addresses: [],
      },
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.OFFER_SENT,
          sharePercent: 40,
          signedLinePercent: 30,
          brokerageFee: 5,
          notes: null,
          counterparty: {
            id: 'reinsurer-1',
            type: CounterpartyType.REINSURER,
            name: 'Ghana Re',
            registrationNumber: null,
            email: null,
            phone: null,
            country: 'GH',
            contacts: [],
            addresses: [],
          },
        },
      ],
    });

    await expect(
      service.getClosingSlipPreview('tenant-1', 'placement-1', 'participant-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
