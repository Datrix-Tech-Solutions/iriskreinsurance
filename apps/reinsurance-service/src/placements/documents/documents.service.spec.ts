import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementDocumentStatus,
  PlacementDocumentType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementPdfRendererService } from './pdf/placement-pdf-renderer.service';
import { PlacementDocumentsService } from './documents.service';
import { PlacementFinancialActivityReader } from '../finance/financial-activity.reader';
import { PlacementFinancialLockPolicy } from '../finance/financial-lock.policy';
import { PlacementsService } from '../placements.service';
import { S3DocumentStorageService } from './storage/s3-document-storage.service';
import {
  TenantDocumentProfileClient,
  TenantDocumentProfileSnapshot,
} from './tenant-document-profile.client';

describe('PlacementDocumentsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  const callArg = <TArgs>(mock: PrismaMethod, index: number): TArgs => {
    const call = mock.mock.calls[index];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  const jsonRecord = (value: unknown): Record<string, unknown> =>
    value as Record<string, unknown>;

  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE' as const,
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [] as string[],
  };

  const placement = { id: 'placement-1' };
  const document = {
    id: 'document-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    participantId: null,
    closingId: null,
    noteId: null,
    endorsementId: null,
    endorsementClosingId: null,
    claimId: null,
    claimCashCallId: null,
    type: PlacementDocumentType.OFFER_SLIP,
    status: PlacementDocumentStatus.GENERATED,
    documentNumber: 'DOC-OS-001',
    version: 1,
    title: 'Offer Slip FAC-001',
    currency: 'GHS',
    sourceSnapshot: { placement: { reference: 'FAC-001' } },
    renderPayload: { placement: { reference: 'FAC-001' } },
    storageProvider: null,
    objectKey: null,
    fileName: null,
    mimeType: null,
    sizeBytes: null,
    checksum: null,
    generatedAt: new Date('2026-06-11T12:00:00.000Z'),
    voidedAt: null,
    voidReason: null,
    failureReason: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-11T12:00:00.000Z'),
    updatedAt: new Date('2026-06-11T12:00:00.000Z'),
  };

  const offerPreview = {
    placement: {
      id: 'placement-1',
      reference: 'FAC-001',
      currency: 'GHS',
      policyNumber: 'POL-001',
      sumInsured: 1000000,
      premium: 50000,
      facultativeOffer: 60,
    },
    cedant: { id: 'cedant-1', name: 'Acme Insurance' },
    businessEntries: [{ label: 'Original Insured', value: 'Acme Plant' }],
    offerEntries: [{ label: 'Policy Number', value: 'POL-001' }],
    debitGuaranteeFinancials: {
      currency: 'GHS',
      grossPremium: 50000,
      commissionPct: 10,
      commissionAmount: 5000,
      netPremium: 45000,
    },
    participantPreviews: [
      {
        participant: {
          id: 'participant-1',
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.REINSURER,
          status: PlacementParticipantStatus.OFFER_SENT,
          sharePercent: 40,
          signedLinePercent: null,
          brokerageFee: 5,
          notes: null,
          counterparty: { id: 'reinsurer-1', name: 'Avenue Re' },
        },
        slipFinancials: {
          currency: 'GHS',
          sumInsured: 1000000,
          grossPremium: 50000,
          facultativeOfferPct: 60,
          facultativeOfferAmount: 600000,
          commissionPct: 10,
          commissionAmount: 5000,
          nicLevyPct: 0,
          nicLevyAmount: 0,
          withholdingTaxPct: 0,
          withholdingTaxAmount: 0,
          netPremium: 45000,
        },
        distributionFinancials: {
          currency: 'GHS',
          offeredLinePct: 40,
          signedLinePct: null,
          brokerageFeePct: 5,
          offeredCapacityAmount: 400000,
          signedCapacityAmount: null,
          grossPremium: 20000,
          brokerageAmount: 1000,
          netPremium: 19000,
        },
      },
    ],
    totalOfferedPercent: 40,
    totalAcceptedPercent: 0,
    remainingPercent: 20,
  };

  const documentProfile: TenantDocumentProfileSnapshot = {
    tenantId: 'tenant-1',
    identity: {
      displayName: 'Acme Brokers',
      legalName: 'Acme Brokers Limited',
      registrationNumber: 'CS-123',
      taxNumber: 'TIN-123',
    },
    contact: {
      physicalAddress: '1 Broker Street',
      postalAddress: 'P.O. Box 1',
      phone: '+233200000000',
      email: 'broker@acme.example',
      website: 'https://acme.example',
    },
    footer: { text: 'Licensed insurance broker' },
    branding: {
      logo: null,
      signature: null,
      colors: null,
      version: 3,
    },
    banking: {
      defaultCurrency: 'GHS',
      defaultAccounts: [
        {
          id: 'account-1',
          bankName: 'GCB Bank',
          branchName: 'High Street',
          accountName: 'Acme Brokers Limited',
          accountNumber: '1036000007232',
          currency: 'GHS',
          swiftCode: 'GHCBGHAC',
          sortCode: null,
        },
      ],
    },
    signatory: { name: 'Ama Mensah', title: 'Managing Director' },
    profileActive: true,
    defaultsApplied: false,
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementDocument: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementParticipant: { findFirst: PrismaMethod };
    placementClosing: { findFirst: PrismaMethod; update: PrismaMethod };
    placementNote: { findFirst: PrismaMethod; update: PrismaMethod };
    placementEndorsement: { findFirst: PrismaMethod; update: PrismaMethod };
    placementEndorsementClosing: {
      findFirst: PrismaMethod;
      update: PrismaMethod;
    };
    placementClaim: { findFirst: PrismaMethod; update: PrismaMethod };
    placementClaimCashCall: { findFirst: PrismaMethod; update: PrismaMethod };
    placementPayment: { findFirst: PrismaMethod };
    $transaction: jest.Mock;
  };
  let placementsService: { getOfferSlipPreview: jest.Mock };
  let pdfRenderer: { render: jest.Mock };
  let documentStorage: {
    storePdf: jest.Mock;
    signedDownloadUrl: jest.Mock;
    readStoredObject: jest.Mock;
  };
  let tenantDocumentProfile: { getSnapshot: jest.Mock };
  let service: PlacementDocumentsService;
  let lockPolicy: PlacementFinancialLockPolicy;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementDocument: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementParticipant: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementNote: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaim: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCashCall: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    placementsService = {
      getOfferSlipPreview: jest.fn().mockResolvedValue(offerPreview),
    };
    pdfRenderer = {
      render: jest.fn().mockResolvedValue(Buffer.from('%PDF test')),
    };
    documentStorage = {
      storePdf: jest.fn().mockResolvedValue({
        storageProvider: 'S3',
        objectKey:
          'reinsurance/tenants/tenant-1/placements/placement-1/documents/document-1/v1/DOC-CS-001.pdf',
        fileName: 'DOC-CS-001.pdf',
        mimeType: 'application/pdf',
        sizeBytes: Buffer.from('%PDF test').byteLength,
      }),
      signedDownloadUrl: jest.fn().mockResolvedValue({
        url: 'https://signed.example/DOC-CS-001.pdf',
        expiresAt: new Date('2026-06-11T12:05:00.000Z'),
        mimeType: 'application/pdf',
        fileName: 'DOC-CS-001.pdf',
      }),
      readStoredObject: jest.fn().mockResolvedValue({
        body: Buffer.from('%PDF stored'),
        mimeType: 'application/pdf',
        fileName: 'DOC-OS-001.pdf',
        sizeBytes: Buffer.from('%PDF stored').byteLength,
      }),
    };
    tenantDocumentProfile = {
      getSnapshot: jest.fn().mockResolvedValue(documentProfile),
    };
    service = new PlacementDocumentsService(
      prisma as unknown as PrismaService,
      placementsService as unknown as PlacementsService,
      pdfRenderer as unknown as PlacementPdfRendererService,
      documentStorage as unknown as S3DocumentStorageService,
      tenantDocumentProfile as unknown as TenantDocumentProfileClient,
    );
    lockPolicy = new PlacementFinancialLockPolicy(
      new PlacementFinancialActivityReader(prisma as unknown as PrismaService),
    );
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementParticipant.findFirst.mockResolvedValue({
      id: 'participant-1',
    });
    prisma.placementDocument.findMany.mockResolvedValue([]);
    prisma.placementDocument.count.mockResolvedValue(0);
    prisma.placementDocument.create.mockResolvedValue(document);
  });

  it('lists and details document registry entries for an active tenant placement', async () => {
    prisma.placementDocument.findMany.mockResolvedValue([document]);
    prisma.placementDocument.findFirst.mockResolvedValue(document);

    const list = await service.findAll('tenant-1', 'placement-1');
    const detail = await service.findOne(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(prisma.placementDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', placementId: 'placement-1' },
      }),
    );
    expect(list).toEqual([document]);
    expect(detail).toBe(document);
  });

  it('does not expose another tenant placement documents', async () => {
    prisma.placement.findFirst.mockResolvedValueOnce(null);

    await expect(service.findAll('tenant-1', 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('generates an offer slip document from the current offer preview payload', async () => {
    await service.generateOfferSlip(user, 'placement-1');

    expect(placementsService.getOfferSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    const createArgs = firstCallArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
    );
    expect(createArgs.data).toMatchObject({
      type: PlacementDocumentType.OFFER_SLIP,
      documentNumber: 'DOC-OS-001',
      version: 1,
      title: 'Offer Slip FAC-001',
      currency: 'GHS',
      status: PlacementDocumentStatus.GENERATED,
    });
    expect(
      jsonRecord(jsonRecord(createArgs.data.sourceSnapshot).placement),
    ).toMatchObject({ reference: 'FAC-001' });
    expect(
      jsonRecord(jsonRecord(createArgs.data.renderPayload).placement),
    ).toMatchObject({ reference: 'FAC-001' });
    expect(jsonRecord(createArgs.data.renderPayload).documentProfile).toEqual(
      documentProfile,
    );
  });

  it('generates a participant-scoped offer slip document for one reinsurer', async () => {
    prisma.placementDocument.create.mockResolvedValue({
      ...document,
      participantId: 'participant-1',
      title: 'Offer Slip FAC-001 - Avenue Re',
    });

    await service.generateParticipantOfferSlip(
      user,
      'placement-1',
      'participant-1',
    );

    expect(prisma.placementParticipant.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'participant-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
      },
      select: { id: true },
    });
    expect(placementsService.getOfferSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    const createArgs = firstCallArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
    );
    expect(createArgs.data).toMatchObject({
      participantId: 'participant-1',
      type: PlacementDocumentType.OFFER_SLIP,
      documentNumber: 'DOC-OS-001',
      version: 1,
      title: 'Offer Slip FAC-001 - Avenue Re',
      currency: 'GHS',
      status: PlacementDocumentStatus.GENERATED,
    });
    const sourceSnapshot = jsonRecord(createArgs.data.sourceSnapshot);
    expect(sourceSnapshot.participantPreviews).toBeUndefined();
    expect(jsonRecord(sourceSnapshot.placement)).toMatchObject({
      reference: 'FAC-001',
      policyNumber: 'POL-001',
    });
    expect(jsonRecord(sourceSnapshot.cedant)).toMatchObject({
      name: 'Acme Insurance',
    });
    expect(
      jsonRecord(jsonRecord(sourceSnapshot.participantPreview).participant),
    ).toMatchObject({
      id: 'participant-1',
      counterpartyId: 'reinsurer-1',
      sharePercent: 40,
    });
    expect(jsonRecord(sourceSnapshot.offerContext)).toMatchObject({
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      reinsurerName: 'Avenue Re',
      offeredLinePercent: 40,
      totalOfferedPercent: 40,
      remainingPercent: 20,
    });
    expect(sourceSnapshot.branding).toBeUndefined();
    expect(jsonRecord(createArgs.data.renderPayload).documentProfile).toEqual(
      documentProfile,
    );
  });

  it('reuses an active participant offer slip instead of creating duplicates', async () => {
    const participantPayload = {
      documentType: PlacementDocumentType.OFFER_SLIP,
      placement: offerPreview.placement,
      cedant: offerPreview.cedant,
      businessEntries: offerPreview.businessEntries,
      offerEntries: offerPreview.offerEntries,
      debitGuaranteeFinancials: offerPreview.debitGuaranteeFinancials,
      participantPreview: offerPreview.participantPreviews[0],
      offerContext: {
        participantId: 'participant-1',
        counterpartyId: 'reinsurer-1',
        reinsurerName: 'Avenue Re',
        offeredLinePercent: 40,
        signedLinePercent: null,
        totalOfferedPercent: 40,
        totalAcceptedPercent: 0,
        remainingPercent: 20,
      },
    };
    const existing = {
      ...document,
      id: 'document-existing',
      participantId: 'participant-1',
      type: PlacementDocumentType.OFFER_SLIP,
      sourceSnapshot: participantPayload,
    };
    prisma.placementDocument.findMany.mockResolvedValue([existing]);

    const result = await service.generateParticipantOfferSlip(
      user,
      'placement-1',
      'participant-1',
    );

    expect(result).toBe(existing);
    const expectedWhere: Prisma.PlacementDocumentWhereInput = {
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      participantId: 'participant-1',
      type: PlacementDocumentType.OFFER_SLIP,
      status: { not: PlacementDocumentStatus.VOID },
    };
    const findManyArgs = firstCallArg<Prisma.PlacementDocumentFindManyArgs>(
      prisma.placementDocument.findMany,
    );
    expect(findManyArgs.where).toMatchObject(expectedWhere);
    expect(prisma.placementDocument.create).not.toHaveBeenCalled();
    expect(tenantDocumentProfile.getSnapshot).not.toHaveBeenCalled();
  });

  it('rejects participant-scoped offer slips for participant placement mismatches', async () => {
    prisma.placementParticipant.findFirst.mockResolvedValue(null);

    await expect(
      service.generateParticipantOfferSlip(
        user,
        'placement-1',
        'participant-other-placement',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(placementsService.getOfferSlipPreview).not.toHaveBeenCalled();
    expect(prisma.placementDocument.create).not.toHaveBeenCalled();
  });

  it('rejects participant-scoped offer slips when the participant is not a reinsurer preview', async () => {
    placementsService.getOfferSlipPreview.mockResolvedValueOnce({
      ...offerPreview,
      participantPreviews: [],
    });

    await expect(
      service.generateParticipantOfferSlip(
        user,
        'placement-1',
        'participant-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.placementDocument.create).not.toHaveBeenCalled();
  });

  it('does not expose another tenant participant when generating participant offer slips', async () => {
    prisma.placementParticipant.findFirst.mockResolvedValue(null);

    await expect(
      service.generateParticipantOfferSlip(
        user,
        'placement-1',
        'participant-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.placementParticipant.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'participant-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
      },
      select: { id: true },
    });
    expect(prisma.placementDocument.create).not.toHaveBeenCalled();
  });

  it('generates a closing slip from a PlacementClosing snapshot', async () => {
    const closing = {
      id: 'closing-1',
      participantId: 'participant-1',
      closingNumber: 'CLO-001',
      currency: 'GHS',
      grossPremium: new Prisma.Decimal('2500.00'),
      participant: {
        id: 'participant-1',
        counterparty: { id: 'reinsurer-1', name: 'Avenue Re' },
      },
    };
    prisma.placementClosing.findFirst.mockResolvedValue(closing);
    prisma.placementDocument.create.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      documentNumber: 'DOC-CS-001',
    });

    await service.generateClosingSlip(user, 'placement-1', 'closing-1');

    const createArgs = firstCallArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
    );
    expect(createArgs.data).toMatchObject({
      closingId: 'closing-1',
      participantId: 'participant-1',
      type: PlacementDocumentType.CLOSING_SLIP,
      documentNumber: 'DOC-CS-001',
    });
    expect(jsonRecord(createArgs.data.sourceSnapshot)).toMatchObject({
      grossPremium: '2500',
    });
    expect(jsonRecord(createArgs.data.renderPayload).documentProfile).toEqual(
      documentProfile,
    );
  });

  it('generates note documents from PlacementNote values', async () => {
    prisma.placementNote.findFirst.mockResolvedValue({
      id: 'note-1',
      placementId: 'placement-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      endorsementId: null,
      endorsementClosingId: null,
      noteNumber: 'DN-001',
      type: PlacementNoteType.DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      status: PlacementNoteStatus.ISSUED,
      currency: 'GHS',
      grossAmount: new Prisma.Decimal('5000.00'),
      commissionAmount: new Prisma.Decimal('500.00'),
      brokerageAmount: null,
      nicLevyAmount: new Prisma.Decimal('50.00'),
      withholdingTaxAmount: new Prisma.Decimal('100.00'),
      netAmount: new Prisma.Decimal('4350.00'),
      noteDate: new Date('2026-06-12T00:00:00.000Z'),
      placement: {
        id: 'placement-1',
        reference: 'FAC-001',
        title: 'Engineering Risk',
      },
      counterparty: {
        id: 'cedant-1',
        name: 'Acme Insurance',
        registrationNumber: 'CED-001',
      },
      closing: { id: 'closing-1', closingNumber: 'CLO-001' },
      participant: { id: 'participant-1', counterpartyId: 'reinsurer-1' },
      endorsement: null,
      endorsementClosing: null,
      endorsementParticipant: null,
    });
    prisma.placementDocument.create.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.DEBIT_NOTE,
      documentNumber: 'DOC-DN-001',
    });

    await service.generateNoteDocument(user, 'placement-1', 'note-1');

    const createArgs = firstCallArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
    );
    expect(createArgs.data).toMatchObject({
      noteId: 'note-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      type: PlacementDocumentType.DEBIT_NOTE,
      documentNumber: 'DOC-DN-001',
    });
    expect(jsonRecord(createArgs.data.sourceSnapshot)).toMatchObject({
      grossAmount: '5000',
    });
    expect(jsonRecord(createArgs.data.renderPayload)).toMatchObject({
      documentType: PlacementDocumentType.DEBIT_NOTE,
      note: {
        noteNumber: 'DN-001',
        grossAmount: '5000',
        commissionAmount: '500',
        nicLevyAmount: '50',
        withholdingTaxAmount: '100',
        netAmount: '4350',
        placement: {
          reference: 'FAC-001',
          title: 'Engineering Risk',
        },
        counterparty: {
          name: 'Acme Insurance',
        },
      },
      documentProfile,
    });
  });

  it('generates endorsement note documents with immutable endorsement context', async () => {
    prisma.placementNote.findFirst.mockResolvedValue({
      id: 'note-1',
      placementId: 'placement-1',
      closingId: null,
      participantId: null,
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      noteNumber: 'ECN-001',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      status: PlacementNoteStatus.ISSUED,
      currency: 'USD',
      grossAmount: new Prisma.Decimal('2500.00'),
      commissionAmount: new Prisma.Decimal('250.00'),
      brokerageAmount: new Prisma.Decimal('125.00'),
      nicLevyAmount: new Prisma.Decimal('0'),
      withholdingTaxAmount: new Prisma.Decimal('0'),
      netAmount: new Prisma.Decimal('2125.00'),
      noteDate: new Date('2026-06-12T00:00:00.000Z'),
      placement: {
        id: 'placement-1',
        reference: 'FAC-001',
        title: 'Engineering Risk',
      },
      counterparty: {
        id: 'reinsurer-1',
        name: 'Avenue Re',
        registrationNumber: 'RE-001',
      },
      closing: null,
      participant: null,
      endorsement: {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        type: 'ADDITION',
        impactType: 'CAPACITY_INCREASE',
        effectiveDate: new Date('2026-06-01T00:00:00.000Z'),
      },
      endorsementClosing: {
        id: 'endorsement-closing-1',
        closingNumber: 'END-CLO-001',
      },
      endorsementParticipant: {
        id: 'endorsement-participant-1',
        counterpartyId: 'reinsurer-1',
      },
    });
    prisma.placementDocument.create.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      documentNumber: 'DOC-ECN-001',
    });

    await service.generateNoteDocument(user, 'placement-1', 'note-1');

    const createArgs = firstCallArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
    );
    expect(createArgs.data).toMatchObject({
      noteId: 'note-1',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      type: PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      documentNumber: 'DOC-ECN-001',
    });
    expect(jsonRecord(createArgs.data.renderPayload)).toMatchObject({
      documentType: PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      note: {
        noteNumber: 'ECN-001',
        grossAmount: '2500',
        netAmount: '2125',
        endorsement: { endorsementNumber: 'END-001' },
        endorsementClosing: { closingNumber: 'END-CLO-001' },
        counterparty: { name: 'Avenue Re' },
      },
      documentProfile,
    });
  });

  it('reuses an active note document for the same backend note', async () => {
    const note = {
      id: 'note-1',
      placementId: 'placement-1',
      closingId: null,
      participantId: null,
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      noteNumber: 'ECN-001',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      status: PlacementNoteStatus.ISSUED,
      currency: 'USD',
      grossAmount: new Prisma.Decimal('2500.00'),
      commissionAmount: new Prisma.Decimal('250.00'),
      brokerageAmount: new Prisma.Decimal('125.00'),
      nicLevyAmount: new Prisma.Decimal('0'),
      withholdingTaxAmount: new Prisma.Decimal('0'),
      netAmount: new Prisma.Decimal('2125.00'),
      noteDate: new Date('2026-06-12T00:00:00.000Z'),
      placement: {
        id: 'placement-1',
        reference: 'FAC-001',
        title: 'Engineering Risk',
      },
      counterparty: {
        id: 'reinsurer-1',
        name: 'Avenue Re',
        registrationNumber: 'RE-001',
      },
      closing: null,
      participant: null,
      endorsement: {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        type: 'ADDITION',
        impactType: 'CAPACITY_INCREASE',
        effectiveDate: new Date('2026-06-01T00:00:00.000Z'),
      },
      endorsementClosing: {
        id: 'endorsement-closing-1',
        closingNumber: 'END-CLO-001',
      },
      endorsementParticipant: {
        id: 'endorsement-participant-1',
        counterpartyId: 'reinsurer-1',
      },
    };
    prisma.placementNote.findFirst.mockResolvedValue(note);
    const existingDocument = {
      ...document,
      id: 'document-existing',
      noteId: 'note-1',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      type: PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      sourceSnapshot: note,
    };
    prisma.placementDocument.findMany.mockResolvedValue([existingDocument]);

    const result = await service.generateNoteDocument(
      user,
      'placement-1',
      'note-1',
    );

    expect(result).toBe(existingDocument);
    const findManyArgs = firstCallArg<Prisma.PlacementDocumentFindManyArgs>(
      prisma.placementDocument.findMany,
    );
    expect(findManyArgs.where).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      type: PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      status: { not: PlacementDocumentStatus.VOID },
      noteId: 'note-1',
    });
    expect(prisma.placementDocument.create).not.toHaveBeenCalled();
  });

  it('does not create a document when the tenant profile is unavailable', async () => {
    tenantDocumentProfile.getSnapshot.mockRejectedValue(
      new InternalServerErrorException('Auth unavailable'),
    );

    await expect(
      service.generateOfferSlip(user, 'placement-1'),
    ).rejects.toThrow(InternalServerErrorException);
    expect(prisma.placementDocument.create).not.toHaveBeenCalled();
  });

  it('requires a matching default bank account for debit note documents', async () => {
    prisma.placementNote.findFirst.mockResolvedValue({
      id: 'note-1',
      placementId: 'placement-1',
      closingId: null,
      participantId: null,
      endorsementId: null,
      endorsementClosingId: null,
      noteNumber: 'DN-001',
      type: PlacementNoteType.DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      status: PlacementNoteStatus.DRAFT,
      currency: 'USD',
      grossAmount: new Prisma.Decimal('5000'),
      commissionAmount: new Prisma.Decimal('500'),
      brokerageAmount: null,
      nicLevyAmount: new Prisma.Decimal('0'),
      withholdingTaxAmount: new Prisma.Decimal('0'),
      netAmount: new Prisma.Decimal('4500'),
      noteDate: new Date('2026-06-12T00:00:00.000Z'),
      placement: {
        id: 'placement-1',
        reference: 'FAC-001',
        title: 'Engineering Risk',
      },
      counterparty: {
        id: 'cedant-1',
        name: 'Acme Insurance',
        registrationNumber: 'CED-001',
      },
      closing: null,
      participant: null,
      endorsement: null,
      endorsementClosing: null,
      endorsementParticipant: null,
    });

    await expect(
      service.generateNoteDocument(user, 'placement-1', 'note-1'),
    ).rejects.toThrow(
      'Tenant document profile requires an active default USD bank account',
    );
    expect(prisma.placementDocument.create).not.toHaveBeenCalled();
  });

  it('generates endorsement slip, certificate and endorsement closing slip documents', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      placement: { id: 'placement-1', reference: 'FAC-001', currency: 'GHS' },
      participants: [],
      closings: [],
      notes: [],
    });
    prisma.placementDocument.create
      .mockResolvedValueOnce({
        ...document,
        type: PlacementDocumentType.ENDORSEMENT_SLIP,
        documentNumber: 'DOC-ES-001',
      })
      .mockResolvedValueOnce({
        ...document,
        type: PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
        documentNumber: 'DOC-ECF-001',
      })
      .mockResolvedValueOnce({
        ...document,
        type: PlacementDocumentType.CLOSING_SLIP,
        documentNumber: 'DOC-CS-001',
      });

    await service.generateEndorsementSlip(user, 'placement-1', 'endorsement-1');
    expect(
      firstCallArg<Prisma.PlacementDocumentCreateArgs>(
        prisma.placementDocument.create,
      ).data,
    ).toMatchObject({
      endorsementId: 'endorsement-1',
      type: PlacementDocumentType.ENDORSEMENT_SLIP,
      documentNumber: 'DOC-ES-001',
    });

    prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
      id: 'endorsement-closing-1',
      endorsementId: 'endorsement-1',
      closingNumber: 'ENC-001',
      status: 'CONFIRMED',
      currency: 'GHS',
      placement: { id: 'placement-1', reference: 'FAC-001', currency: 'GHS' },
      endorsement: {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        originalSnapshot: {},
        proposedSnapshot: {},
      },
      endorsementParticipant: {
        id: 'endorsement-participant-1',
        counterparty: { id: 'reinsurer-1', name: 'Avenue Re' },
        originalParticipant: null,
      },
      notes: [],
    });

    await service.generateEndorsementCertificate(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
    const certificateCreate = callArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
      1,
    );
    expect(certificateCreate.data).toMatchObject({
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      type: PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
      documentNumber: 'DOC-ECF-001',
    });

    await service.generateEndorsementClosingSlip(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
    const secondCreate = callArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
      2,
    );
    expect(secondCreate.data).toMatchObject({
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      type: PlacementDocumentType.CLOSING_SLIP,
      documentNumber: 'DOC-CS-001',
    });
  });

  it('reuses active endorsement documents only when the source snapshot is unchanged', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      placement: { id: 'placement-1', reference: 'FAC-001', currency: 'GHS' },
      participants: [],
      closings: [],
      notes: [],
    });
    prisma.placementDocument.findMany
      .mockResolvedValueOnce([
        {
          ...document,
          type: PlacementDocumentType.ENDORSEMENT_SLIP,
          endorsementId: 'endorsement-1',
          sourceSnapshot: {
            id: 'endorsement-1',
            endorsementNumber: 'END-OLD',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          ...document,
          type: PlacementDocumentType.ENDORSEMENT_SLIP,
          endorsementId: 'endorsement-1',
          sourceSnapshot: {
            id: 'endorsement-1',
            endorsementNumber: 'END-OLD',
          },
        },
      ]);
    prisma.placementDocument.create.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.ENDORSEMENT_SLIP,
      documentNumber: 'DOC-ES-002',
      version: 2,
    });
    prisma.placementDocument.count.mockResolvedValue(1);

    await service.generateEndorsementSlip(user, 'placement-1', 'endorsement-1');

    expect(prisma.placementDocument.create).toHaveBeenCalled();
    expect(
      firstCallArg<Prisma.PlacementDocumentCreateArgs>(
        prisma.placementDocument.create,
      ).data,
    ).toMatchObject({
      type: PlacementDocumentType.ENDORSEMENT_SLIP,
      version: 2,
    });
  });

  it('generates claim notice and claim cash call documents', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue({
      id: 'claim-1',
      claimNumber: 'CLM-001',
      currency: 'GHS',
      estimatedLossAmount: new Prisma.Decimal('40000.00'),
      allocations: [],
      cashCalls: [],
    });
    prisma.placementDocument.create
      .mockResolvedValueOnce({
        ...document,
        type: PlacementDocumentType.CLAIM_NOTICE,
        documentNumber: 'DOC-CLM-001',
      })
      .mockResolvedValueOnce({
        ...document,
        type: PlacementDocumentType.CLAIM_CASH_CALL,
        documentNumber: 'DOC-CCL-001',
      });

    await service.generateClaimNotice(user, 'placement-1', 'claim-1');
    expect(
      firstCallArg<Prisma.PlacementDocumentCreateArgs>(
        prisma.placementDocument.create,
      ).data,
    ).toMatchObject({
      claimId: 'claim-1',
      type: PlacementDocumentType.CLAIM_NOTICE,
      documentNumber: 'DOC-CLM-001',
    });
    expect(
      jsonRecord(
        firstCallArg<Prisma.PlacementDocumentCreateArgs>(
          prisma.placementDocument.create,
        ).data.sourceSnapshot,
      ),
    ).toMatchObject({
      estimatedLossAmount: '40000',
    });

    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      id: 'cash-call-1',
      claimId: 'claim-1',
      cashCallNumber: 'CCL-001',
      currency: 'GHS',
      amount: new Prisma.Decimal('16000.00'),
      allocation: { id: 'allocation-1' },
      counterparty: { id: 'reinsurer-1', name: 'Avenue Re' },
    });

    await service.generateClaimCashCall(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
    );
    const secondCreate = callArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
      1,
    );
    expect(secondCreate.data).toMatchObject({
      claimId: 'claim-1',
      claimCashCallId: 'cash-call-1',
      type: PlacementDocumentType.CLAIM_CASH_CALL,
      documentNumber: 'DOC-CCL-001',
    });
    expect(jsonRecord(secondCreate.data.sourceSnapshot)).toMatchObject({
      amount: '16000',
    });
  });

  it('increments version on regeneration and never reuses placement-scoped numbers', async () => {
    prisma.placementDocument.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    await service.generateOfferSlip(user, 'placement-1');

    const createArgs = firstCallArg<Prisma.PlacementDocumentCreateArgs>(
      prisma.placementDocument.create,
    );
    expect(createArgs.data).toMatchObject({
      documentNumber: 'DOC-OS-002',
      version: 2,
    });
  });

  it('voids a document while keeping the row readable', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue(document);
    prisma.placementDocument.update.mockResolvedValue({
      ...document,
      status: PlacementDocumentStatus.VOID,
      voidReason: 'Replacement generated',
    });

    const result = await service.void(user, 'placement-1', 'document-1', {
      voidReason: 'Replacement generated',
    });

    expect(prisma.placementDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'document-1' },
        data: {
          status: PlacementDocumentStatus.VOID,
          voidedAt: expect.any(Date) as Date,
          voidReason: 'Replacement generated',
        },
      }),
    );
    expect(result.status).toBe(PlacementDocumentStatus.VOID);
  });

  it('rejects voiding a VOID document', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      status: PlacementDocumentStatus.VOID,
    });

    await expect(
      service.void(user, 'placement-1', 'document-1', {
        voidReason: 'Replacement generated',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renders a CLOSING_SLIP document as PDF using renderPayload', async () => {
    const closingDocument = {
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      documentNumber: 'DOC-CS-001',
      title: 'Closing Slip CLO-001',
      sourceSnapshot: { closing: { closingNumber: 'CLO-001' } },
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    };
    prisma.placementDocument.findFirst.mockResolvedValue(closingDocument);

    const pdf = await service.renderPdf(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(pdf.toString()).toBe('%PDF test');
    expect(pdfRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PlacementDocumentType.CLOSING_SLIP,
        renderPayload: closingDocument.renderPayload,
      }),
    );
    const renderArg = firstCallArg<Record<string, unknown>>(
      pdfRenderer.render as PrismaMethod,
    );
    expect(renderArg.sourceSnapshot).toBeUndefined();
    expect(documentStorage.storePdf).not.toHaveBeenCalled();
  });

  it('renders a participant-scoped OFFER_SLIP document as PDF using renderPayload', async () => {
    const participantOfferDocument = {
      ...document,
      type: PlacementDocumentType.OFFER_SLIP,
      participantId: 'participant-1',
      documentNumber: 'DOC-OS-001',
      title: 'Offer Slip FAC-001 - Avenue Re',
      sourceSnapshot: {
        documentType: PlacementDocumentType.OFFER_SLIP,
        participantPreview: offerPreview.participantPreviews[0],
      },
      renderPayload: {
        documentType: PlacementDocumentType.OFFER_SLIP,
        placement: offerPreview.placement,
        cedant: offerPreview.cedant,
        businessEntries: offerPreview.businessEntries,
        offerEntries: offerPreview.offerEntries,
        debitGuaranteeFinancials: offerPreview.debitGuaranteeFinancials,
        participantPreview: offerPreview.participantPreviews[0],
        offerContext: {
          participantId: 'participant-1',
          reinsurerName: 'Avenue Re',
          offeredLinePercent: 40,
        },
        branding: {
          productName: 'WorkPhelo',
          documentFamily: 'Reinsurance Operations',
        },
      },
    };
    prisma.placementDocument.findFirst.mockResolvedValue(
      participantOfferDocument,
    );

    const pdf = await service.renderPdf(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(pdf.toString()).toBe('%PDF test');
    expect(pdfRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PlacementDocumentType.OFFER_SLIP,
        renderPayload: participantOfferDocument.renderPayload,
      }),
    );
  });

  it.each([
    PlacementDocumentType.DEBIT_NOTE,
    PlacementDocumentType.CREDIT_NOTE,
    PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE,
    PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
  ])('renders %s documents as PDF using renderPayload', async (type) => {
    const noteDocument = {
      ...document,
      type,
      documentNumber: 'DOC-NOTE-001',
      title: 'Note',
      renderPayload: {
        documentType: type,
        note: {
          type,
          noteNumber: 'NOTE-001',
          status: PlacementNoteStatus.ISSUED,
          direction: PlacementNoteDirection.BROKER_TO_REINSURER,
          noteDate: '2026-06-12T00:00:00.000Z',
          currency: 'GHS',
          grossAmount: '5000',
          netAmount: '4500',
          counterparty: { name: 'Avenue Re' },
        },
      },
    };
    prisma.placementDocument.findFirst.mockResolvedValue(noteDocument);

    const pdf = await service.renderPdf(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(pdf.toString()).toBe('%PDF test');
    expect(pdfRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        type,
        renderPayload: noteDocument.renderPayload,
      }),
    );
  });

  it('renders and stores a CLOSING_SLIP PDF with checksum and storage metadata', async () => {
    const closingDocument = {
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      documentNumber: 'DOC-CS-001',
      title: 'Closing Slip CLO-001',
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    };
    prisma.placementDocument.findFirst.mockResolvedValue(closingDocument);
    prisma.placementDocument.update.mockResolvedValue({
      ...closingDocument,
      storageProvider: 'S3',
      objectKey:
        'reinsurance/tenants/tenant-1/placements/placement-1/documents/document-1/v1/DOC-CS-001.pdf',
      fileName: 'DOC-CS-001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9,
      checksum:
        'sha256:bb094c25184067415837d8dc66cfa65366384a80625877252719369a2dc80575',
      generatedAt: new Date('2026-06-11T12:01:00.000Z'),
    });

    const result = await service.renderAndStorePdf(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(documentStorage.storePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        documentId: 'document-1',
        version: 1,
        documentNumber: 'DOC-CS-001',
        body: Buffer.from('%PDF test'),
        checksum:
          'sha256:bb094c25184067415837d8dc66cfa65366384a80625877252719369a2dc80575',
        contentType: 'application/pdf',
      }),
    );
    expect(prisma.placementDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'document-1' },
      }),
    );
    const updateArgs = firstCallArg<Prisma.PlacementDocumentUpdateArgs>(
      prisma.placementDocument.update,
    );
    expect(updateArgs.data).toMatchObject({
      storageProvider: 'S3',
      objectKey:
        'reinsurance/tenants/tenant-1/placements/placement-1/documents/document-1/v1/DOC-CS-001.pdf',
      fileName: 'DOC-CS-001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9,
      checksum:
        'sha256:bb094c25184067415837d8dc66cfa65366384a80625877252719369a2dc80575',
      failureReason: null,
    });
    expect(updateArgs.data.generatedAt).toBeInstanceOf(Date);
    expect(result.storageProvider).toBe('S3');
  });

  it('reads an existing stored OFFER_SLIP PDF for an outbound email', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.OFFER_SLIP,
      objectKey: 'reinsurance/offer-slip.pdf',
      fileName: 'DOC-OS-001.pdf',
      mimeType: 'application/pdf',
    });

    const result = await service.readStoredPdfForEmail(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(documentStorage.storePdf).not.toHaveBeenCalled();
    expect(documentStorage.readStoredObject).toHaveBeenCalledWith({
      objectKey: 'reinsurance/offer-slip.pdf',
      mimeType: 'application/pdf',
      fileName: 'DOC-OS-001.pdf',
    });
    expect(result.body).toEqual(Buffer.from('%PDF stored'));
  });

  it('renders and stores an unstored CLOSING_SLIP before reading it for email', async () => {
    const closingDocument = {
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      documentNumber: 'DOC-CS-001',
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    };
    const storedDocument = {
      ...closingDocument,
      objectKey: 'reinsurance/closing-slip.pdf',
      fileName: 'DOC-CS-001.pdf',
      mimeType: 'application/pdf',
      storageProvider: 'S3',
      sizeBytes: 9,
    };
    prisma.placementDocument.findFirst.mockResolvedValue(closingDocument);
    prisma.placementDocument.update.mockResolvedValue(storedDocument);

    await service.readStoredPdfForEmail(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(documentStorage.storePdf).toHaveBeenCalled();
    expect(documentStorage.readStoredObject).toHaveBeenCalledWith({
      objectKey: 'reinsurance/closing-slip.pdf',
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });
  });

  it('rejects already stored documents during render-and-store', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      objectKey: 'reinsurance/existing.pdf',
    });

    await expect(
      service.renderAndStorePdf('tenant-1', 'placement-1', 'document-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(pdfRenderer.render).not.toHaveBeenCalled();
    expect(documentStorage.storePdf).not.toHaveBeenCalled();
  });

  it('records a safe failure reason when S3 upload fails without clearing metadata or snapshots', async () => {
    const closingDocument = {
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      documentNumber: 'DOC-CS-001',
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    };
    prisma.placementDocument.findFirst.mockResolvedValue(closingDocument);
    documentStorage.storePdf.mockRejectedValue(new Error('S3 outage'));
    prisma.placementDocument.update.mockResolvedValue({
      ...closingDocument,
      failureReason: 'S3 outage',
    });

    await expect(
      service.renderAndStorePdf('tenant-1', 'placement-1', 'document-1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(prisma.placementDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'document-1' },
        data: { failureReason: 'S3 outage' },
      }),
    );
    const updateArgs = firstCallArg<Prisma.PlacementDocumentUpdateArgs>(
      prisma.placementDocument.update,
    );
    expect(updateArgs.data.sourceSnapshot).toBeUndefined();
    expect(updateArgs.data.renderPayload).toBeUndefined();
    expect(updateArgs.data.objectKey).toBeUndefined();
    expect(updateArgs.data.storageProvider).toBeUndefined();
  });

  it('creates signed download URLs only for stored tenant-scoped documents', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      storageProvider: 'S3',
      objectKey: 'reinsurance/document.pdf',
      fileName: 'DOC-CS-001.pdf',
      mimeType: 'application/pdf',
    });

    const result = await service.createDownloadUrl(
      'tenant-1',
      'placement-1',
      'document-1',
    );

    expect(documentStorage.signedDownloadUrl).toHaveBeenCalledWith({
      objectKey: 'reinsurance/document.pdf',
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });
    expect(result).toMatchObject({
      url: 'https://signed.example/DOC-CS-001.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('rejects signed download URLs for documents without stored object metadata', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      objectKey: null,
    });

    await expect(
      service.createDownloadUrl('tenant-1', 'placement-1', 'document-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(documentStorage.signedDownloadUrl).not.toHaveBeenCalled();
  });

  it('rejects unsupported document types for PDF rendering', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.CLAIM_NOTICE,
    });

    await expect(
      service.renderPdf('tenant-1', 'placement-1', 'document-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pdfRenderer.render).not.toHaveBeenCalled();
  });

  it('rejects VOID documents for PDF rendering', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      status: PlacementDocumentStatus.VOID,
    });

    await expect(
      service.renderPdf('tenant-1', 'placement-1', 'document-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pdfRenderer.render).not.toHaveBeenCalled();
  });

  it('does not expose wrong-tenant documents during PDF rendering', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue(null);

    await expect(
      service.renderPdf('tenant-1', 'placement-1', 'document-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a safe error when PDF rendering fails without mutating snapshots', async () => {
    prisma.placementDocument.findFirst.mockResolvedValue({
      ...document,
      type: PlacementDocumentType.CLOSING_SLIP,
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    });
    pdfRenderer.render.mockRejectedValue(new Error('Chromium failed'));

    await expect(
      service.renderPdf('tenant-1', 'placement-1', 'document-1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(prisma.placementDocument.update).not.toHaveBeenCalled();
  });

  it('allows locked placements to generate documents without mutating source records or unlocking', async () => {
    const lockedPlacement = {
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.MARKETING,
    };
    const paymentDate = new Date('2026-06-11T13:00:00.000Z');
    prisma.placementPayment.findFirst.mockResolvedValue({
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      paymentDate,
      createdAt: paymentDate,
    });

    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
      endorsementRequired: true,
      lockSource: 'PREMIUM_PAYMENT',
    });

    await expect(
      service.generateOfferSlip(user, 'placement-1'),
    ).resolves.toMatchObject({
      documentNumber: 'DOC-OS-001',
    });

    expect(prisma.placementClosing.update).not.toHaveBeenCalled();
    expect(prisma.placementNote.update).not.toHaveBeenCalled();
    expect(prisma.placementEndorsement.update).not.toHaveBeenCalled();
    expect(prisma.placementEndorsementClosing.update).not.toHaveBeenCalled();
    expect(prisma.placementClaim.update).not.toHaveBeenCalled();
    expect(prisma.placementClaimCashCall.update).not.toHaveBeenCalled();
    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
    });
  });
});
