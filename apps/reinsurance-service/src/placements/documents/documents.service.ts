import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementDocumentStatus,
  PlacementDocumentType,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementPdfRendererService } from './pdf/placement-pdf-renderer.service';
import {
  S3DocumentStorageService,
  SignedDocumentUrlResult,
  StoredObjectResult,
} from './storage/s3-document-storage.service';
import { VoidPlacementDocumentDto } from '../dto/void-placement-document.dto';
import { PlacementsService } from '../placements.service';
import {
  TenantDocumentProfileClient,
  TenantDocumentProfileSnapshot,
} from './tenant-document-profile.client';

const documentInclude = {} satisfies Prisma.PlacementDocumentInclude;

type PlacementDocumentRecord = Prisma.PlacementDocumentGetPayload<{
  include: typeof documentInclude;
}>;

type DocumentSourceDescriptor = {
  type: PlacementDocumentType;
  prefix: string;
  title: string;
  currency: string | null;
  sourceSnapshot: unknown;
  renderPayload: unknown;
  reuseActive?: boolean;
  sourceLinks?: Pick<
    Prisma.PlacementDocumentUncheckedCreateInput,
    | 'participantId'
    | 'closingId'
    | 'noteId'
    | 'endorsementId'
    | 'endorsementClosingId'
    | 'claimId'
    | 'claimCashCallId'
  >;
};

@Injectable()
export class PlacementDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly placementsService: PlacementsService,
    private readonly pdfRenderer: PlacementPdfRendererService,
    private readonly documentStorage: S3DocumentStorageService,
    private readonly tenantDocumentProfile: TenantDocumentProfileClient,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementDocumentRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementDocument.findMany({
      where: { tenantId, placementId },
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    documentId: string,
  ): Promise<PlacementDocumentRecord> {
    await this.assertPlacement(tenantId, placementId);
    const document = await this.prisma.placementDocument.findFirst({
      where: { id: documentId, tenantId, placementId },
      include: documentInclude,
    });
    if (!document) throw new NotFoundException('Placement document not found');
    return document;
  }

  async generateOfferSlip(
    user: RequestUser,
    placementId: string,
  ): Promise<PlacementDocumentRecord> {
    const preview = await this.placementsService.getOfferSlipPreview(
      user.tenantId,
      placementId,
    );

    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.OFFER_SLIP,
      prefix: 'DOC-OS-',
      title: `Offer Slip ${preview.placement.reference}`,
      currency: preview.placement.currency,
      sourceSnapshot: preview,
      renderPayload: preview,
    });
  }

  async generateParticipantOfferSlip(
    user: RequestUser,
    placementId: string,
    participantId: string,
  ): Promise<PlacementDocumentRecord> {
    const participant = await this.prisma.placementParticipant.findFirst({
      where: {
        id: participantId,
        tenantId: user.tenantId,
        placementId,
      },
      select: { id: true },
    });
    if (!participant) {
      throw new NotFoundException('Placement participant not found');
    }

    const preview = await this.placementsService.getOfferSlipPreview(
      user.tenantId,
      placementId,
    );
    const participantPreview = preview.participantPreviews.find(
      (item) => item.participant.id === participantId,
    );
    if (!participantPreview) {
      throw new BadRequestException(
        'Offer slip documents can only be generated for placement reinsurers',
      );
    }

    const participantPayload = {
      documentType: PlacementDocumentType.OFFER_SLIP,
      placement: preview.placement,
      cedant: preview.cedant,
      businessEntries: preview.businessEntries,
      offerEntries: preview.offerEntries,
      debitGuaranteeFinancials: preview.debitGuaranteeFinancials,
      participantPreview,
      offerContext: {
        participantId,
        counterpartyId: participantPreview.participant.counterpartyId,
        reinsurerName: participantPreview.participant.counterparty.name,
        offeredLinePercent: participantPreview.participant.sharePercent,
        signedLinePercent: participantPreview.participant.signedLinePercent,
        totalOfferedPercent: preview.totalOfferedPercent,
        totalAcceptedPercent: preview.totalAcceptedPercent,
        remainingPercent: preview.remainingPercent,
      },
    };

    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.OFFER_SLIP,
      prefix: 'DOC-OS-',
      title: `Offer Slip ${preview.placement.reference} - ${participantPreview.participant.counterparty.name}`,
      currency: preview.placement.currency,
      sourceSnapshot: participantPayload,
      renderPayload: participantPayload,
      sourceLinks: { participantId },
      reuseActive: true,
    });
  }

  async generateClosingSlip(
    user: RequestUser,
    placementId: string,
    closingId: string,
  ): Promise<PlacementDocumentRecord> {
    const closing = await this.prisma.placementClosing.findFirst({
      where: { id: closingId, tenantId: user.tenantId, placementId },
      include: {
        participant: {
          include: {
            counterparty: {
              select: {
                id: true,
                type: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
          },
        },
      },
    });
    if (!closing) throw new NotFoundException('Placement closing not found');

    const snapshot = this.toJsonSafe(closing);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLOSING_SLIP,
      prefix: 'DOC-CS-',
      title: `Closing Slip ${closing.closingNumber}`,
      currency: closing.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: snapshot,
      },
      sourceLinks: {
        closingId: closing.id,
        participantId: closing.participantId,
      },
    });
  }

  async generateNoteDocument(
    user: RequestUser,
    placementId: string,
    noteId: string,
  ): Promise<PlacementDocumentRecord> {
    const note = await this.prisma.placementNote.findFirst({
      where: { id: noteId, tenantId: user.tenantId, placementId },
      include: {
        placement: {
          select: {
            id: true,
            reference: true,
            title: true,
            classOfBusiness: true,
            inceptionDate: true,
            expiryDate: true,
            currency: true,
          },
        },
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
            email: true,
            phone: true,
            country: true,
          },
        },
        closing: { select: { id: true, closingNumber: true } },
        participant: { select: { id: true, counterpartyId: true } },
        endorsement: {
          select: {
            id: true,
            endorsementNumber: true,
            type: true,
            impactType: true,
            effectiveDate: true,
          },
        },
        endorsementClosing: {
          select: { id: true, closingNumber: true },
        },
        endorsementParticipant: {
          select: { id: true, counterpartyId: true },
        },
      },
    });
    if (!note) throw new NotFoundException('Placement note not found');

    const type = this.documentTypeForNote(note);
    const snapshot = this.toJsonSafe(note);
    return this.createGeneratedDocument(user, placementId, {
      type,
      prefix: this.prefixForDocumentType(type),
      title: `${this.titleForDocumentType(type)} ${note.noteNumber}`,
      currency: note.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: type,
        note: snapshot,
      },
      sourceLinks: {
        noteId: note.id,
        closingId: note.closingId,
        participantId: note.participantId,
        endorsementId: note.endorsementId,
        endorsementClosingId: note.endorsementClosingId,
      },
      reuseActive: true,
    });
  }

  async generateEndorsementSlip(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementDocumentRecord> {
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: { id: endorsementId, tenantId: user.tenantId, placementId },
      include: {
        placement: {
          select: {
            id: true,
            reference: true,
            title: true,
            classOfBusiness: true,
            currency: true,
            inceptionDate: true,
            expiryDate: true,
            cedant: {
              select: {
                id: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
          },
        },
        participants: {
          include: {
            counterparty: {
              select: {
                id: true,
                type: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
            originalParticipant: {
              select: {
                id: true,
                sharePercent: true,
                signedLinePercent: true,
                counterpartyId: true,
              },
            },
          },
        },
        closings: {
          include: {
            endorsementParticipant: {
              include: {
                counterparty: {
                  select: {
                    id: true,
                    type: true,
                    name: true,
                    registrationNumber: true,
                    email: true,
                    phone: true,
                    country: true,
                  },
                },
              },
            },
          },
        },
        notes: {
          where: { status: { not: PlacementNoteStatus.VOID } },
          select: {
            id: true,
            type: true,
            noteNumber: true,
            status: true,
            currency: true,
            grossAmount: true,
            commissionAmount: true,
            brokerageAmount: true,
            nicLevyAmount: true,
            withholdingTaxAmount: true,
            netAmount: true,
            endorsementClosingId: true,
          },
        },
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }

    const snapshot = this.toJsonSafe(endorsement);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.ENDORSEMENT_SLIP,
      prefix: 'DOC-ES-',
      title: `Endorsement Slip ${endorsement.endorsementNumber}`,
      currency: endorsement.placement.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.ENDORSEMENT_SLIP,
        endorsement: snapshot,
      },
      sourceLinks: { endorsementId: endorsement.id },
      reuseActive: true,
    });
  }

  async generateEndorsementCertificate(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<PlacementDocumentRecord> {
    const closing = await this.prisma.placementEndorsementClosing.findFirst({
      where: {
        id: closingId,
        tenantId: user.tenantId,
        placementId,
        endorsementId,
        status: PlacementClosingStatus.CONFIRMED,
      },
      include: {
        placement: {
          select: {
            id: true,
            reference: true,
            title: true,
            classOfBusiness: true,
            currency: true,
            inceptionDate: true,
            expiryDate: true,
            cedant: {
              select: {
                id: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
          },
        },
        endorsement: {
          select: {
            id: true,
            endorsementNumber: true,
            type: true,
            impactType: true,
            status: true,
            effectiveDate: true,
            reason: true,
            description: true,
            changeSummary: true,
            originalSnapshot: true,
            proposedSnapshot: true,
            targetPercent: true,
            closedAt: true,
          },
        },
        endorsementParticipant: {
          include: {
            counterparty: {
              select: {
                id: true,
                type: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
            originalParticipant: {
              select: {
                id: true,
                sharePercent: true,
                signedLinePercent: true,
                counterpartyId: true,
              },
            },
          },
        },
        notes: {
          where: { status: { not: PlacementNoteStatus.VOID } },
          select: {
            id: true,
            type: true,
            noteNumber: true,
            status: true,
            currency: true,
            grossAmount: true,
            commissionAmount: true,
            brokerageAmount: true,
            nicLevyAmount: true,
            withholdingTaxAmount: true,
            netAmount: true,
          },
        },
      },
    });
    if (!closing) {
      throw new BadRequestException(
        'A confirmed endorsement closing is required before generating an endorsement certificate',
      );
    }

    const snapshot = this.toJsonSafe(closing);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
      prefix: 'DOC-ECF-',
      title: `Endorsement Certificate ${closing.closingNumber}`,
      currency: closing.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
        endorsementCertificate: snapshot,
      },
      sourceLinks: {
        endorsementId: closing.endorsementId,
        endorsementClosingId: closing.id,
      },
      reuseActive: true,
    });
  }

  async generateEndorsementClosingSlip(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<PlacementDocumentRecord> {
    const closing = await this.prisma.placementEndorsementClosing.findFirst({
      where: {
        id: closingId,
        tenantId: user.tenantId,
        placementId,
        endorsementId,
      },
      include: {
        endorsement: { select: { id: true, endorsementNumber: true } },
        endorsementParticipant: {
          include: {
            counterparty: {
              select: {
                id: true,
                type: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
          },
        },
      },
    });
    if (!closing) {
      throw new NotFoundException('Placement endorsement closing not found');
    }

    const snapshot = this.toJsonSafe(closing);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLOSING_SLIP,
      prefix: 'DOC-CS-',
      title: `Endorsement Closing Slip ${closing.closingNumber}`,
      currency: closing.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        endorsementClosing: snapshot,
      },
      sourceLinks: {
        endorsementId: closing.endorsementId,
        endorsementClosingId: closing.id,
      },
    });
  }

  async generateClaimNotice(
    user: RequestUser,
    placementId: string,
    claimId: string,
  ): Promise<PlacementDocumentRecord> {
    const claim = await this.prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId: user.tenantId, placementId },
      include: {
        allocations: true,
        cashCalls: true,
      },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');

    const snapshot = this.toJsonSafe(claim);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLAIM_NOTICE,
      prefix: 'DOC-CLM-',
      title: `Claim Notice ${claim.claimNumber}`,
      currency: claim.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLAIM_NOTICE,
        claim: snapshot,
      },
      sourceLinks: { claimId: claim.id },
    });
  }

  async generateClaimCashCall(
    user: RequestUser,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<PlacementDocumentRecord> {
    const cashCall = await this.prisma.placementClaimCashCall.findFirst({
      where: {
        id: cashCallId,
        tenantId: user.tenantId,
        placementId,
        claimId,
      },
      include: {
        allocation: true,
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
            email: true,
            phone: true,
            country: true,
          },
        },
      },
    });
    if (!cashCall) {
      throw new NotFoundException('Placement claim cash call not found');
    }

    const snapshot = this.toJsonSafe(cashCall);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLAIM_CASH_CALL,
      prefix: 'DOC-CCL-',
      title: `Claim Cash Call ${cashCall.cashCallNumber}`,
      currency: cashCall.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLAIM_CASH_CALL,
        cashCall: snapshot,
      },
      sourceLinks: {
        claimId: cashCall.claimId,
        claimCashCallId: cashCall.id,
      },
    });
  }

  async void(
    user: RequestUser,
    placementId: string,
    documentId: string,
    dto: VoidPlacementDocumentDto,
  ): Promise<PlacementDocumentRecord> {
    const document = await this.findOne(user.tenantId, placementId, documentId);
    if (document.status === PlacementDocumentStatus.VOID) {
      throw new BadRequestException('VOID documents are terminal');
    }

    return this.prisma.placementDocument.update({
      where: { id: documentId },
      data: {
        status: PlacementDocumentStatus.VOID,
        voidedAt: new Date(),
        voidReason: this.cleanRequired(dto.voidReason),
      },
      include: documentInclude,
    });
  }

  async renderPdf(
    tenantId: string,
    placementId: string,
    documentId: string,
  ): Promise<Buffer> {
    const document = await this.findOne(tenantId, placementId, documentId);
    this.assertPdfRenderable(document);

    try {
      return await this.renderDocumentBuffer(document);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to render placement document PDF',
      );
    }
  }

  async renderAndStorePdf(
    tenantId: string,
    placementId: string,
    documentId: string,
  ): Promise<PlacementDocumentRecord> {
    const document = await this.findOne(tenantId, placementId, documentId);
    this.assertPdfRenderable(document);

    if (document.objectKey) {
      throw new ConflictException('Document PDF has already been stored');
    }

    let pdf: Buffer;
    try {
      pdf = await this.renderDocumentBuffer(document);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to render placement document PDF',
      );
    }

    try {
      const checksum = this.checksum(pdf);
      const stored = await this.documentStorage.storePdf({
        tenantId,
        placementId,
        documentId,
        version: document.version,
        documentNumber: document.documentNumber,
        body: pdf,
        checksum,
        contentType: 'application/pdf',
      });

      return await this.prisma.placementDocument.update({
        where: { id: documentId },
        data: {
          storageProvider: stored.storageProvider,
          objectKey: stored.objectKey,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          checksum,
          generatedAt: new Date(),
          failureReason: null,
        },
        include: documentInclude,
      });
    } catch (error: unknown) {
      await this.prisma.placementDocument.update({
        where: { id: documentId },
        data: { failureReason: this.safeFailureReason(error) },
        include: documentInclude,
      });
      throw new InternalServerErrorException(
        'Failed to store placement document PDF',
      );
    }
  }

  async createDownloadUrl(
    tenantId: string,
    placementId: string,
    documentId: string,
  ): Promise<SignedDocumentUrlResult> {
    const document = await this.findOne(tenantId, placementId, documentId);
    if (!document.objectKey) {
      throw new BadRequestException('Document PDF has not been stored');
    }

    return this.documentStorage.signedDownloadUrl({
      objectKey: document.objectKey,
      mimeType: document.mimeType ?? 'application/pdf',
      fileName: document.fileName ?? `${document.documentNumber}.pdf`,
    });
  }

  async readStoredPdfForEmail(
    tenantId: string,
    placementId: string,
    documentId: string,
  ): Promise<StoredObjectResult> {
    let document = await this.findOne(tenantId, placementId, documentId);
    this.assertPdfRenderable(document);

    if (!document.objectKey) {
      document = await this.renderAndStorePdf(
        tenantId,
        placementId,
        documentId,
      );
    }

    if (!document.objectKey) {
      throw new InternalServerErrorException(
        'Document PDF storage metadata is missing',
      );
    }

    return this.documentStorage.readStoredObject({
      objectKey: document.objectKey,
      mimeType: document.mimeType ?? 'application/pdf',
      fileName: document.fileName ?? `${document.documentNumber}.pdf`,
    });
  }

  private assertPdfRenderable(document: PlacementDocumentRecord): void {
    const renderableTypes = new Set<PlacementDocumentType>([
      PlacementDocumentType.CLOSING_SLIP,
      PlacementDocumentType.OFFER_SLIP,
      PlacementDocumentType.DEBIT_NOTE,
      PlacementDocumentType.CREDIT_NOTE,
      PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE,
      PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      PlacementDocumentType.ENDORSEMENT_SLIP,
      PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
    ]);
    if (!renderableTypes.has(document.type)) {
      throw new BadRequestException(
        'PDF rendering is currently supported only for OFFER_SLIP, CLOSING_SLIP, DEBIT_NOTE, CREDIT_NOTE, ENDORSEMENT_DEBIT_NOTE, ENDORSEMENT_CREDIT_NOTE, ENDORSEMENT_SLIP and ENDORSEMENT_CERTIFICATE documents',
      );
    }
    if (document.status === PlacementDocumentStatus.VOID) {
      throw new BadRequestException('VOID documents cannot be rendered');
    }
  }

  private renderDocumentBuffer(
    document: PlacementDocumentRecord,
  ): Promise<Buffer> {
    return this.pdfRenderer.render({
      documentNumber: document.documentNumber,
      title: document.title,
      type: document.type,
      status: document.status,
      renderPayload: document.renderPayload,
      generatedAt: document.generatedAt,
    });
  }

  private async createGeneratedDocument(
    user: RequestUser,
    placementId: string,
    descriptor: DocumentSourceDescriptor,
  ): Promise<PlacementDocumentRecord> {
    await this.assertPlacement(user.tenantId, placementId);
    if (descriptor.reuseActive) {
      const existing = await this.findReusableDocument(
        user.tenantId,
        placementId,
        descriptor,
      );
      if (existing) return existing;
    }

    const renderPayload = this.isBrandedDocument(descriptor.type)
      ? this.withTenantDocumentProfile(
          descriptor.renderPayload,
          await this.tenantDocumentProfile.getSnapshot(user.tenantId),
        )
      : descriptor.renderPayload;
    this.assertRequiredDocumentProfileData(
      descriptor.type,
      descriptor.currency,
      renderPayload,
    );

    return this.prisma.$transaction(async (tx) => {
      if (descriptor.reuseActive) {
        const existing = await this.findReusableDocument(
          user.tenantId,
          placementId,
          descriptor,
          tx,
        );
        if (existing) return existing;
      }

      const documentNumber = await this.nextDocumentNumber(
        tx,
        user.tenantId,
        placementId,
        descriptor.prefix,
      );
      const version = await this.nextVersion(
        tx,
        user.tenantId,
        placementId,
        descriptor,
      );

      return tx.placementDocument.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          ...(descriptor.sourceLinks ?? {}),
          type: descriptor.type,
          status: PlacementDocumentStatus.GENERATED,
          documentNumber,
          version,
          title: descriptor.title,
          currency: descriptor.currency,
          sourceSnapshot: this.toJsonSafe(descriptor.sourceSnapshot),
          renderPayload: this.toJsonSafe(renderPayload),
          generatedAt: new Date(),
          createdByUserId: user.id,
        },
        include: documentInclude,
      });
    });
  }

  private findReusableDocument(
    tenantId: string,
    placementId: string,
    descriptor: DocumentSourceDescriptor,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PlacementDocumentRecord | null> {
    return tx.placementDocument
      .findMany({
        where: {
          tenantId,
          placementId,
          type: descriptor.type,
          status: { not: PlacementDocumentStatus.VOID },
          ...this.versionSourceWhere(descriptor.sourceLinks),
        },
        include: documentInclude,
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      .then((documents) => {
        const sourceSnapshot = this.stableJson(descriptor.sourceSnapshot);
        return (
          documents.find(
            (document) =>
              this.stableJson(document.sourceSnapshot) === sourceSnapshot,
          ) ?? null
        );
      });
  }

  private isBrandedDocument(type: PlacementDocumentType): boolean {
    return new Set<PlacementDocumentType>([
      PlacementDocumentType.OFFER_SLIP,
      PlacementDocumentType.CLOSING_SLIP,
      PlacementDocumentType.DEBIT_NOTE,
      PlacementDocumentType.CREDIT_NOTE,
      PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE,
      PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
      PlacementDocumentType.ENDORSEMENT_SLIP,
      PlacementDocumentType.ENDORSEMENT_CERTIFICATE,
    ]).has(type);
  }

  private stableJson(value: unknown): string {
    return JSON.stringify(this.sortJson(this.toJsonSafe(value)));
  }

  private sortJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sortJson(item));
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = this.sortJson((value as Record<string, unknown>)[key]);
          return sorted;
        }, {});
    }
    return value;
  }

  private withTenantDocumentProfile(
    renderPayload: unknown,
    profile: TenantDocumentProfileSnapshot,
  ): Record<string, unknown> {
    const payload =
      renderPayload && typeof renderPayload === 'object'
        ? (renderPayload as Record<string, unknown>)
        : {};
    return { ...payload, documentProfile: profile };
  }

  private assertRequiredDocumentProfileData(
    type: PlacementDocumentType,
    currency: string | null,
    renderPayload: unknown,
  ): void {
    if (!this.isBrandedDocument(type)) return;
    const payload = renderPayload as {
      documentProfile?: TenantDocumentProfileSnapshot;
    };
    const profile = payload.documentProfile;
    if (
      !profile?.identity.displayName.trim() ||
      !profile.identity.legalName.trim()
    ) {
      throw new BadRequestException(
        'Tenant document profile requires a display name and legal name before generating documents.',
      );
    }

    const requiresBankAccount =
      type === PlacementDocumentType.DEBIT_NOTE ||
      type === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE;
    if (
      requiresBankAccount &&
      (!currency ||
        !profile.banking.defaultAccounts.some(
          (account) => account.currency === currency,
        ))
    ) {
      throw new BadRequestException(
        `Tenant document profile requires an active default ${currency ?? 'document currency'} bank account before generating this debit note.`,
      );
    }
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');
  }

  private async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    prefix: string,
  ): Promise<string> {
    const count = await tx.placementDocument.count({
      where: {
        tenantId,
        placementId,
        documentNumber: { startsWith: prefix },
      },
    });
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  private async nextVersion(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    descriptor: DocumentSourceDescriptor,
  ): Promise<number> {
    const count = await tx.placementDocument.count({
      where: {
        tenantId,
        placementId,
        type: descriptor.type,
        ...this.versionSourceWhere(descriptor.sourceLinks),
      },
    });
    return count + 1;
  }

  private versionSourceWhere(
    sourceLinks: DocumentSourceDescriptor['sourceLinks'],
  ): Prisma.PlacementDocumentWhereInput {
    if (!sourceLinks) return {};
    if (sourceLinks.noteId) return { noteId: sourceLinks.noteId };
    if (sourceLinks.closingId) return { closingId: sourceLinks.closingId };
    if (sourceLinks.participantId) {
      return { participantId: sourceLinks.participantId };
    }
    if (sourceLinks.endorsementClosingId) {
      return { endorsementClosingId: sourceLinks.endorsementClosingId };
    }
    if (sourceLinks.claimCashCallId) {
      return { claimCashCallId: sourceLinks.claimCashCallId };
    }
    if (sourceLinks.claimId) return { claimId: sourceLinks.claimId };
    if (sourceLinks.endorsementId) {
      return { endorsementId: sourceLinks.endorsementId };
    }
    return {};
  }

  private documentTypeForNote(note: {
    type: PlacementNoteType;
    noteNumber: string;
  }): PlacementDocumentType {
    if (note.type === PlacementNoteType.ENDORSEMENT_DEBIT_NOTE) {
      return PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE;
    }
    if (note.type === PlacementNoteType.ENDORSEMENT_CREDIT_NOTE) {
      return PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE;
    }
    if (
      note.type === PlacementNoteType.DEBIT_NOTE ||
      note.type === PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE
    ) {
      return PlacementDocumentType.DEBIT_NOTE;
    }
    return PlacementDocumentType.CREDIT_NOTE;
  }

  private prefixForDocumentType(type: PlacementDocumentType): string {
    const prefixes: Record<PlacementDocumentType, string> = {
      [PlacementDocumentType.OFFER_SLIP]: 'DOC-OS-',
      [PlacementDocumentType.CLOSING_SLIP]: 'DOC-CS-',
      [PlacementDocumentType.DEBIT_NOTE]: 'DOC-DN-',
      [PlacementDocumentType.CREDIT_NOTE]: 'DOC-CN-',
      [PlacementDocumentType.ENDORSEMENT_SLIP]: 'DOC-ES-',
      [PlacementDocumentType.ENDORSEMENT_CERTIFICATE]: 'DOC-ECF-',
      [PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE]: 'DOC-EDN-',
      [PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE]: 'DOC-ECN-',
      [PlacementDocumentType.CLAIM_CASH_CALL]: 'DOC-CCL-',
      [PlacementDocumentType.CLAIM_NOTICE]: 'DOC-CLM-',
    };
    return prefixes[type];
  }

  private titleForDocumentType(type: PlacementDocumentType): string {
    const titles: Record<PlacementDocumentType, string> = {
      [PlacementDocumentType.OFFER_SLIP]: 'Offer Slip',
      [PlacementDocumentType.CLOSING_SLIP]: 'Closing Slip',
      [PlacementDocumentType.DEBIT_NOTE]: 'Debit Note',
      [PlacementDocumentType.CREDIT_NOTE]: 'Credit Note',
      [PlacementDocumentType.ENDORSEMENT_SLIP]: 'Endorsement Slip',
      [PlacementDocumentType.ENDORSEMENT_CERTIFICATE]:
        'Endorsement Certificate',
      [PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE]: 'Endorsement Debit Note',
      [PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE]:
        'Endorsement Credit Note',
      [PlacementDocumentType.CLAIM_CASH_CALL]: 'Claim Cash Call',
      [PlacementDocumentType.CLAIM_NOTICE]: 'Claim Notice',
    };
    return titles[type];
  }

  private toJsonSafe(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(value, (_key, item: unknown) => {
        if (item instanceof Prisma.Decimal) return item.toString();
        return item;
      }),
    ) as Prisma.InputJsonValue;
  }

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Required text is missing');
    return cleaned;
  }

  private checksum(pdf: Buffer): string {
    return `sha256:${createHash('sha256').update(pdf).digest('hex')}`;
  }

  private safeFailureReason(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.slice(0, 500);
    }
    return 'S3 upload failed';
  }
}
