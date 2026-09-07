import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlacementAttachmentStatus } from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementAttachmentsService } from './attachments.service';
import { S3DocumentStorageService } from '../storage/s3-document-storage.service';

describe('PlacementAttachmentsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected mock to be called');
    return call[0] as TArgs;
  };

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

  const file = {
    originalname: 'supporting schedule.pdf',
    mimetype: 'application/pdf',
    size: 12,
    buffer: Buffer.from('hello world!'),
  } as Express.Multer.File;

  const attachment = {
    id: 'attachment-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    participantId: null,
    closingId: null,
    endorsementId: null,
    endorsementParticipantId: null,
    endorsementClosingId: null,
    claimId: null,
    claimCashCallId: null,
    paymentId: null,
    status: PlacementAttachmentStatus.ACTIVE,
    title: 'Signed schedule',
    description: null,
    originalFileName: 'supporting schedule.pdf',
    fileName: 'supporting schedule.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 12,
    checksum: 'checksum',
    storageProvider: 'S3',
    objectKey: 'reinsurance/tenants/tenant-1/placements/placement-1/file.pdf',
    voidedAt: null,
    voidReason: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
    updatedAt: new Date('2026-06-30T12:00:00.000Z'),
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementParticipant: { findFirst: PrismaMethod };
    placementClosing: { findFirst: PrismaMethod };
    placementEndorsement: { findFirst: PrismaMethod };
    placementEndorsementParticipant: { findFirst: PrismaMethod };
    placementEndorsementClosing: { findFirst: PrismaMethod };
    placementClaim: { findFirst: PrismaMethod };
    placementClaimCashCall: { findFirst: PrismaMethod };
    placementPayment: { findFirst: PrismaMethod };
    placementAttachment: {
      create: PrismaMethod;
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      update: PrismaMethod;
    };
  };
  let storage: {
    storeAttachment: jest.Mock;
    signedDownloadUrl: jest.Mock;
    readStoredObject: jest.Mock;
  };
  let service: PlacementAttachmentsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementParticipant: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementEndorsement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementParticipant: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaim: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaimCashCall: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementAttachment: {
        create: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    storage = {
      storeAttachment: jest.fn(),
      signedDownloadUrl: jest.fn(),
      readStoredObject: jest.fn(),
    };
    service = new PlacementAttachmentsService(
      prisma as unknown as PrismaService,
      storage as unknown as S3DocumentStorageService,
    );

    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    storage.storeAttachment.mockResolvedValue({
      storageProvider: 'S3',
      objectKey: attachment.objectKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    });
    prisma.placementAttachment.create.mockResolvedValue(attachment);
  });

  it('uploads a private placement attachment and stores metadata', async () => {
    const result = await service.upload(
      user,
      'placement-1',
      { type: 'PLACEMENT' },
      file,
      { title: 'Signed schedule' },
    );

    expect(result).toBe(attachment);
    expect(storage.storeAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        parentType: 'PLACEMENT',
        contentType: 'application/pdf',
        originalFileName: 'supporting schedule.pdf',
      }),
    );
    const createArgs = firstCallArg<{ data: Record<string, unknown> }>(
      prisma.placementAttachment.create,
    );
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        title: 'Signed schedule',
        originalFileName: 'supporting schedule.pdf',
        storageProvider: 'S3',
      }),
    );
  });

  it('links participant attachments only when the participant belongs to the placement and tenant', async () => {
    prisma.placementParticipant.findFirst.mockResolvedValue({
      id: 'participant-1',
    });

    await service.upload(
      user,
      'placement-1',
      { type: 'PARTICIPANT', id: 'participant-1' },
      file,
      {},
    );

    expect(prisma.placementParticipant.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'participant-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
      },
      select: { id: true },
    });
    const createArgs = firstCallArg<{ data: Record<string, unknown> }>(
      prisma.placementAttachment.create,
    );
    expect(createArgs.data.participantId).toBe('participant-1');
  });

  it('rejects parent records outside the tenant/placement scope', async () => {
    prisma.placementParticipant.findFirst.mockResolvedValue(null);

    await expect(
      service.upload(
        user,
        'placement-1',
        { type: 'PARTICIPANT', id: 'participant-1' },
        file,
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.storeAttachment).not.toHaveBeenCalled();
  });

  it('rejects missing and unsupported files before storing', async () => {
    await expect(
      service.upload(user, 'placement-1', { type: 'PLACEMENT' }, undefined, {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.upload(
        user,
        'placement-1',
        { type: 'PLACEMENT' },
        {
          ...file,
          mimetype: 'application/x-msdownload',
        } as Express.Multer.File,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists attachments for the selected parent only', async () => {
    prisma.placementAttachment.findMany.mockResolvedValue([attachment]);

    const result = await service.findAll('tenant-1', 'placement-1', {
      type: 'PLACEMENT',
    });

    expect(result).toEqual([attachment]);
    const findManyArgs = firstCallArg<{ where: Record<string, unknown> }>(
      prisma.placementAttachment.findMany,
    );
    expect(findManyArgs.where).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        participantId: null,
      }),
    );
  });

  it('generates signed download URLs from private object metadata', async () => {
    prisma.placementAttachment.findFirst.mockResolvedValue(attachment);
    storage.signedDownloadUrl.mockResolvedValue({
      url: 'https://signed.example.com/file.pdf',
      expiresAt: new Date('2026-06-30T12:05:00.000Z'),
      mimeType: 'application/pdf',
      fileName: 'supporting schedule.pdf',
    });

    const result = await service.createDownloadUrl(
      'tenant-1',
      'placement-1',
      { type: 'PLACEMENT' },
      'attachment-1',
    );

    expect(result).toEqual({
      url: 'https://signed.example.com/file.pdf',
      expiresAt: '2026-06-30T12:05:00.000Z',
      mimeType: 'application/pdf',
      fileName: 'supporting schedule.pdf',
    });
  });

  it('reads only active tenant-scoped attachments for outbound email', async () => {
    prisma.placementAttachment.findFirst.mockResolvedValue(attachment);
    storage.readStoredObject.mockResolvedValue({
      body: Buffer.from('hello world!'),
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      sizeBytes: attachment.sizeBytes,
    });

    const result = await service.readStoredAttachmentForEmail(
      'tenant-1',
      'placement-1',
      'attachment-1',
    );

    expect(prisma.placementAttachment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'attachment-1',
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        status: PlacementAttachmentStatus.ACTIVE,
        participantId: null,
        closingId: null,
        endorsementId: null,
        endorsementParticipantId: null,
        endorsementClosingId: null,
        claimId: null,
        claimCashCallId: null,
        paymentId: null,
      },
    });
    expect(storage.readStoredObject).toHaveBeenCalledWith({
      objectKey: attachment.objectKey,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    });
    expect(result.body).toEqual(Buffer.from('hello world!'));
  });

  it('rejects void or cross-tenant attachments for outbound email', async () => {
    prisma.placementAttachment.findFirst.mockResolvedValue(null);

    await expect(
      service.readStoredAttachmentForEmail(
        'tenant-1',
        'placement-1',
        'attachment-from-another-scope',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.readStoredObject).not.toHaveBeenCalled();
  });

  it('voids attachments without deleting the stored object or audit row', async () => {
    prisma.placementAttachment.findFirst.mockResolvedValue(attachment);
    prisma.placementAttachment.update.mockResolvedValue({
      ...attachment,
      status: PlacementAttachmentStatus.VOID,
      voidReason: 'Uploaded in error',
    });

    const result = await service.void(
      user,
      'placement-1',
      { type: 'PLACEMENT' },
      'attachment-1',
      { reason: 'Uploaded in error' },
    );

    expect(result.status).toBe(PlacementAttachmentStatus.VOID);
    const updateArgs = firstCallArg<{
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }>(prisma.placementAttachment.update);
    expect(updateArgs.where).toEqual({ id: 'attachment-1' });
    expect(updateArgs.data).toEqual(
      expect.objectContaining({
        status: PlacementAttachmentStatus.VOID,
        voidReason: 'Uploaded in error',
      }),
    );
  });
});
