import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementAttachmentStatus,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementDocumentDownloadUrlDto } from '../../dto/placement-document-download-url.dto';
import { UploadPlacementAttachmentDto } from '../../dto/upload-placement-attachment.dto';
import { VoidPlacementAttachmentDto } from '../../dto/void-placement-attachment.dto';
import {
  S3DocumentStorageService,
  StoredObjectResult,
} from '../storage/s3-document-storage.service';

export type AttachmentParentType =
  | 'PLACEMENT'
  | 'PARTICIPANT'
  | 'CLOSING'
  | 'ENDORSEMENT'
  | 'ENDORSEMENT_PARTICIPANT'
  | 'ENDORSEMENT_CLOSING'
  | 'CLAIM'
  | 'CASH_CALL'
  | 'PAYMENT';

export interface AttachmentParentRef {
  type: AttachmentParentType;
  id?: string;
  endorsementId?: string;
  claimId?: string;
}

const attachmentInclude = {} satisfies Prisma.PlacementAttachmentInclude;

type AttachmentRecord = Prisma.PlacementAttachmentGetPayload<{
  include: typeof attachmentInclude;
}>;

type AttachmentParentCreateData = Partial<
  Pick<
    Prisma.PlacementAttachmentUncheckedCreateInput,
    | 'participantId'
    | 'closingId'
    | 'endorsementId'
    | 'endorsementParticipantId'
    | 'endorsementClosingId'
    | 'claimId'
    | 'claimCashCallId'
    | 'paymentId'
  >
>;

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

@Injectable()
export class PlacementAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3DocumentStorageService,
  ) {}

  async upload(
    user: RequestUser,
    placementId: string,
    parent: AttachmentParentRef,
    file: Express.Multer.File | undefined,
    dto: UploadPlacementAttachmentDto,
  ): Promise<AttachmentRecord> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Attachment file is required.');
    }

    this.assertFileAllowed(file);
    await this.assertParent(user.tenantId, placementId, parent);

    const attachmentId = randomUUID();
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const stored = await this.storage.storeAttachment({
      tenantId: user.tenantId,
      placementId,
      attachmentId,
      parentType: parent.type,
      body: file.buffer,
      checksum,
      contentType: file.mimetype,
      originalFileName: file.originalname,
    });

    return this.prisma.placementAttachment.create({
      data: {
        id: attachmentId,
        tenantId: user.tenantId,
        placementId,
        ...this.parentCreateData(parent),
        title: dto.title?.trim() || null,
        description: dto.description?.trim() || null,
        originalFileName: file.originalname,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        checksum,
        storageProvider: stored.storageProvider,
        objectKey: stored.objectKey,
        createdByUserId: user.id,
      },
      include: attachmentInclude,
    });
  }

  async findAll(
    tenantId: string,
    placementId: string,
    parent: AttachmentParentRef,
  ): Promise<AttachmentRecord[]> {
    await this.assertParent(tenantId, placementId, parent);

    return this.prisma.placementAttachment.findMany({
      where: {
        tenantId,
        placementId,
        ...this.parentWhere(parent),
      },
      include: attachmentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDownloadUrl(
    tenantId: string,
    placementId: string,
    parent: AttachmentParentRef,
    attachmentId: string,
  ): Promise<PlacementDocumentDownloadUrlDto> {
    await this.assertParent(tenantId, placementId, parent);
    const attachment = await this.findOne(
      tenantId,
      placementId,
      parent,
      attachmentId,
    );

    const signedUrl = await this.storage.signedDownloadUrl({
      objectKey: attachment.objectKey,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    });
    return {
      ...signedUrl,
      expiresAt: signedUrl.expiresAt.toISOString(),
    };
  }

  async readStoredAttachmentForEmail(
    tenantId: string,
    placementId: string,
    attachmentId: string,
  ): Promise<StoredObjectResult> {
    const attachment = await this.prisma.placementAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        placementId,
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
    if (!attachment) throw new NotFoundException('Attachment not found');

    return this.storage.readStoredObject({
      objectKey: attachment.objectKey,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    });
  }

  async void(
    user: RequestUser,
    placementId: string,
    parent: AttachmentParentRef,
    attachmentId: string,
    dto: VoidPlacementAttachmentDto,
  ): Promise<AttachmentRecord> {
    await this.assertParent(user.tenantId, placementId, parent);
    const attachment = await this.findOne(
      user.tenantId,
      placementId,
      parent,
      attachmentId,
    );
    if (attachment.status === PlacementAttachmentStatus.VOID) {
      throw new BadRequestException('Attachment is already void.');
    }

    return this.prisma.placementAttachment.update({
      where: { id: attachment.id },
      data: {
        status: PlacementAttachmentStatus.VOID,
        voidedAt: new Date(),
        voidReason: dto.reason.trim(),
      },
      include: attachmentInclude,
    });
  }

  private async findOne(
    tenantId: string,
    placementId: string,
    parent: AttachmentParentRef,
    attachmentId: string,
  ): Promise<AttachmentRecord> {
    const attachment = await this.prisma.placementAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        placementId,
        ...this.parentWhere(parent),
      },
      include: attachmentInclude,
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  private async assertParent(
    tenantId: string,
    placementId: string,
    parent: AttachmentParentRef,
  ): Promise<void> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const exists = await this.parentExists(tenantId, placementId, parent);
    if (!exists) throw new NotFoundException(`${parent.type} record not found`);
  }

  private async parentExists(
    tenantId: string,
    placementId: string,
    parent: AttachmentParentRef,
  ): Promise<boolean> {
    if (parent.type === 'PLACEMENT') return true;
    if (!parent.id) return false;

    if (parent.type === 'PARTICIPANT') {
      return !!(await this.prisma.placementParticipant.findFirst({
        where: { id: parent.id, tenantId, placementId },
        select: { id: true },
      }));
    }
    if (parent.type === 'CLOSING') {
      return !!(await this.prisma.placementClosing.findFirst({
        where: { id: parent.id, tenantId, placementId },
        select: { id: true },
      }));
    }
    if (parent.type === 'ENDORSEMENT') {
      return !!(await this.prisma.placementEndorsement.findFirst({
        where: { id: parent.id, tenantId, placementId },
        select: { id: true },
      }));
    }
    if (parent.type === 'ENDORSEMENT_PARTICIPANT') {
      return !!(await this.prisma.placementEndorsementParticipant.findFirst({
        where: {
          id: parent.id,
          tenantId,
          placementId,
          ...(parent.endorsementId
            ? { endorsementId: parent.endorsementId }
            : {}),
        },
        select: { id: true },
      }));
    }
    if (parent.type === 'ENDORSEMENT_CLOSING') {
      return !!(await this.prisma.placementEndorsementClosing.findFirst({
        where: {
          id: parent.id,
          tenantId,
          placementId,
          ...(parent.endorsementId
            ? { endorsementId: parent.endorsementId }
            : {}),
        },
        select: { id: true },
      }));
    }
    if (parent.type === 'CLAIM') {
      return !!(await this.prisma.placementClaim.findFirst({
        where: { id: parent.id, tenantId, placementId },
        select: { id: true },
      }));
    }
    if (parent.type === 'CASH_CALL') {
      return !!(await this.prisma.placementClaimCashCall.findFirst({
        where: {
          id: parent.id,
          tenantId,
          placementId,
          ...(parent.claimId ? { claimId: parent.claimId } : {}),
        },
        select: { id: true },
      }));
    }
    if (parent.type === 'PAYMENT') {
      return !!(await this.prisma.placementPayment.findFirst({
        where: { id: parent.id, tenantId, placementId },
        select: { id: true },
      }));
    }

    return false;
  }

  private parentWhere(
    parent: AttachmentParentRef,
  ): Prisma.PlacementAttachmentWhereInput {
    if (parent.type === 'PLACEMENT') {
      return {
        participantId: null,
        closingId: null,
        endorsementId: null,
        endorsementParticipantId: null,
        endorsementClosingId: null,
        claimId: null,
        claimCashCallId: null,
        paymentId: null,
      };
    }

    const field = this.parentField(parent.type);
    return { [field]: parent.id } as Prisma.PlacementAttachmentWhereInput;
  }

  private parentCreateData(
    parent: AttachmentParentRef,
  ): AttachmentParentCreateData {
    if (parent.type === 'PLACEMENT') return {};

    const field = this.parentField(parent.type);
    return {
      [field]: parent.id,
      ...(parent.type === 'ENDORSEMENT_PARTICIPANT' && parent.endorsementId
        ? { endorsementId: parent.endorsementId }
        : {}),
      ...(parent.type === 'ENDORSEMENT_CLOSING' && parent.endorsementId
        ? { endorsementId: parent.endorsementId }
        : {}),
      ...(parent.type === 'CASH_CALL' && parent.claimId
        ? { claimId: parent.claimId }
        : {}),
    } as AttachmentParentCreateData;
  }

  private parentField(
    parentType: Exclude<AttachmentParentType, 'PLACEMENT'>,
  ): keyof Prisma.PlacementAttachmentUncheckedCreateInput {
    const map = {
      PARTICIPANT: 'participantId',
      CLOSING: 'closingId',
      ENDORSEMENT: 'endorsementId',
      ENDORSEMENT_PARTICIPANT: 'endorsementParticipantId',
      ENDORSEMENT_CLOSING: 'endorsementClosingId',
      CLAIM: 'claimId',
      CASH_CALL: 'claimCashCallId',
      PAYMENT: 'paymentId',
    } as const;
    return map[parentType];
  }

  private assertFileAllowed(file: Express.Multer.File): void {
    const maxBytes = this.maxFileSizeBytes();
    if (file.size > maxBytes || file.buffer.byteLength > maxBytes) {
      throw new BadRequestException(
        `Attachment exceeds maximum size of ${Math.floor(maxBytes / 1024 / 1024)}MB.`,
      );
    }

    if (!this.allowedMimeTypes().includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported attachment type: ${file.mimetype}`,
      );
    }
  }

  private allowedMimeTypes(): string[] {
    const configured = process.env.REINSURANCE_ATTACHMENT_ALLOWED_MIME_TYPES;
    if (!configured?.trim()) return DEFAULT_ALLOWED_MIME_TYPES;
    return configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private maxFileSizeBytes(): number {
    const configured = Number.parseInt(
      process.env.REINSURANCE_ATTACHMENT_MAX_BYTES ?? '',
      10,
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : 25 * 1024 * 1024;
  }
}
