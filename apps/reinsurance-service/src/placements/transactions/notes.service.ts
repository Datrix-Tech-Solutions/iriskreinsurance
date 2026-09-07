import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyOrigin,
  CounterpartyType,
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementEndorsementStatus,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
  ReinsuranceChargeCode,
  ReinsuranceChargeRateType,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EffectiveDebitNotePreviewResponseDto } from '../dto/effective-debit-note.dto';
import {
  AppliedChargeSnapshot,
  ChargeCalculationResult,
  ReinsuranceChargeSettingsService,
} from '../../settings/reinsurance-charge-settings.service';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import { PlacementFinancialPositionService } from '../finance/financial-position.service';
import { UpdatePlacementNoteStatusDto } from '../dto/update-placement-note-status.dto';
import { VoidPlacementNoteDto } from '../dto/void-placement-note.dto';

const noteInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  participant: {
    select: {
      id: true,
      counterpartyId: true,
    },
  },
  closing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
  endorsementParticipant: {
    select: {
      id: true,
      counterpartyId: true,
    },
  },
  endorsement: {
    select: {
      id: true,
      endorsementNumber: true,
      type: true,
      impactType: true,
      effectiveDate: true,
      status: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
      endorsementParticipantId: true,
    },
  },
} satisfies Prisma.PlacementNoteInclude;

type PlacementNoteRecord = Prisma.PlacementNoteGetPayload<{
  include: typeof noteInclude;
}>;

type DebitClosingSnapshot = {
  grossPremium: Prisma.Decimal | null;
  commissionAmount: Prisma.Decimal | null;
  currency: string | null;
  isForeignReinsurer: boolean;
};

type EndorsementDebitClosingSnapshot = {
  id?: string;
  premiumSnapshot: Prisma.Decimal;
  commissionAmount: Prisma.Decimal | null;
  currency: string | null;
  isForeignReinsurer: boolean;
};

type CurrentEffectiveDebitNotePreview = EffectiveDebitNotePreviewResponseDto & {
  sourceSnapshot: Prisma.JsonObject;
  appliedCharges: Prisma.JsonObject;
};

@Injectable()
export class PlacementNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chargeSettings: ReinsuranceChargeSettingsService,
    private readonly financialPosition: PlacementFinancialPositionService,
    private readonly effectiveView: PlacementEffectiveViewService,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementNoteRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementNote.findMany({
      where: { tenantId, placementId },
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    noteId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertPlacement(tenantId, placementId);
    const note = await this.prisma.placementNote.findFirst({
      where: { id: noteId, tenantId, placementId },
      include: noteInclude,
    });
    if (!note) throw new NotFoundException('Placement note not found');
    return note;
  }

  async findAllEndorsementNotes(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementNoteRecord[]> {
    await this.assertEndorsement(tenantId, placementId, endorsementId);
    return this.prisma.placementNote.findMany({
      where: { tenantId, placementId, endorsementId },
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEndorsementNote(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    noteId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertEndorsement(tenantId, placementId, endorsementId);
    const note = await this.prisma.placementNote.findFirst({
      where: { id: noteId, tenantId, placementId, endorsementId },
      include: noteInclude,
    });
    if (!note)
      throw new NotFoundException('Placement endorsement note not found');
    return note;
  }

  async createDebitNote(
    user: RequestUser,
    placementId: string,
  ): Promise<PlacementNoteRecord> {
    const placement = await this.findPlacement(user.tenantId, placementId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveDebitNote(tx, user.tenantId, placementId);

      const closings = await tx.placementClosing.findMany({
        where: {
          tenantId: user.tenantId,
          placementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        select: {
          grossPremium: true,
          commissionAmount: true,
          currency: true,
          participant: {
            select: {
              counterparty: {
                select: {
                  addresses: { select: { country: true, isPrimary: true } },
                },
              },
            },
          },
        },
      });
      if (closings.length === 0) {
        throw new BadRequestException(
          'At least one confirmed closing is required before creating a debit note',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.DEBIT_NOTE,
      );
      const noteDate = new Date();
      const snapshot = await this.debitSnapshot(
        tx,
        user.tenantId,
        placement.currency,
        this.isForeignCedant(placement),
        closings.map((closing) => ({
          ...closing,
          isForeignReinsurer: this.isForeignReinsurer(
            closing.participant?.counterparty?.addresses,
          ),
        })),
        noteDate,
      );

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          counterpartyId: placement.cedantId,
          type: PlacementNoteType.DEBIT_NOTE,
          direction: PlacementNoteDirection.CEDANT_TO_BROKER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          noteDate,
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async createCreditNote(
    user: RequestUser,
    placementId: string,
    closingId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertPlacement(user.tenantId, placementId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveCreditNote(
        tx,
        user.tenantId,
        placementId,
        closingId,
      );

      const closing = await tx.placementClosing.findFirst({
        where: {
          id: closingId,
          tenantId: user.tenantId,
          placementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        include: {
          participant: {
            include: {
              counterparty: {
                select: {
                  id: true,
                  type: true,
                  addresses: { select: { country: true, isPrimary: true } },
                },
              },
            },
          },
        },
      });
      if (!closing) {
        throw new BadRequestException(
          'Credit note requires a confirmed closing in the placement',
        );
      }
      if (
        closing.participant.counterparty.type !== CounterpartyType.REINSURER
      ) {
        throw new BadRequestException(
          'Credit note counterparty must be a reinsurer',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.CREDIT_NOTE,
      );
      const noteDate = new Date();
      const snapshot = await this.creditSnapshot(
        tx,
        user.tenantId,
        closing,
        noteDate,
        this.isForeignReinsurer(closing.participant.counterparty.addresses),
      );

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          closingId,
          participantId: closing.participantId,
          counterpartyId: closing.participant.counterpartyId,
          type: PlacementNoteType.CREDIT_NOTE,
          direction: PlacementNoteDirection.BROKER_TO_REINSURER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          noteDate,
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async createEndorsementDebitNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementNoteRecord> {
    const placement = await this.findPlacement(user.tenantId, placementId);
    const endorsement = await this.assertEndorsement(
      user.tenantId,
      placementId,
      endorsementId,
    );
    if (endorsement.status !== PlacementEndorsementStatus.CLOSED) {
      throw new BadRequestException(
        'Endorsement debit notes require a CLOSED endorsement',
      );
    }
    if (endorsement.effectiveDate.getTime() > Date.now()) {
      throw new BadRequestException(
        'Future-dated closed endorsements are excluded from current endorsement debit-note generation',
      );
    }
    if (
      endorsement.impactType ===
      PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION
    ) {
      throw new BadRequestException(
        'Endorsement debit notes are not required for decrease or cancellation endorsements',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveEndorsementDebitNote(
        tx,
        user.tenantId,
        placementId,
        endorsementId,
      );

      const closings = await tx.placementEndorsementClosing.findMany({
        where: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        select: {
          id: true,
          premiumSnapshot: true,
          commissionAmount: true,
          currency: true,
          endorsementParticipant: {
            select: {
              counterparty: {
                select: {
                  addresses: { select: { country: true, isPrimary: true } },
                },
              },
            },
          },
        },
      });
      if (closings.length === 0) {
        throw new BadRequestException(
          'At least one confirmed endorsement closing is required before creating an endorsement debit note',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      );
      const noteDate = new Date();
      const snapshot = await this.endorsementDebitSnapshot(
        tx,
        user.tenantId,
        this.isForeignCedant(placement),
        closings.map((closing) => ({
          ...closing,
          isForeignReinsurer: this.isForeignReinsurer(
            closing.endorsementParticipant?.counterparty?.addresses,
          ),
        })),
        noteDate,
      );

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          counterpartyId: placement.cedantId,
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          direction: PlacementNoteDirection.CEDANT_TO_BROKER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          sourceSnapshot: {
            statementType: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
            postingBehavior: 'POSTING_ENDORSEMENT_ADJUSTMENT',
            placementId,
            endorsementId,
            endorsementNumber: endorsement.endorsementNumber,
            endorsementEffectiveDate: endorsement.effectiveDate.toISOString(),
            sourceClosingIds: closings
              .map((closing) => closing.id)
              .filter((id): id is string => Boolean(id)),
            generatedAt: noteDate.toISOString(),
            generatedByUserId: user.id,
          },
          postingEnabled: true,
          noteDate,
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async previewCurrentEffectiveDebitNote(
    tenantId: string,
    placementId: string,
    asOfDate?: Date | string,
  ): Promise<EffectiveDebitNotePreviewResponseDto> {
    return this.buildCurrentEffectiveDebitNotePreview(
      tenantId,
      placementId,
      asOfDate,
    );
  }

  async createCurrentEffectiveDebitNote(
    user: RequestUser,
    placementId: string,
    asOfDate?: Date | string,
  ): Promise<PlacementNoteRecord> {
    const preview = await this.buildCurrentEffectiveDebitNotePreview(
      user.tenantId,
      placementId,
      asOfDate,
    );
    const placement = await this.findPlacement(user.tenantId, placementId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.placementNote.findFirst({
          where: {
            tenantId: user.tenantId,
            placementId,
            type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
            effectiveVersionKey: preview.effectiveVersionKey,
          },
          include: noteInclude,
        });
        if (existing) return existing;

        const noteNumber = await this.nextNoteNumber(
          tx,
          user.tenantId,
          placementId,
          PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
        );
        const noteDate = new Date();

        return tx.placementNote.create({
          data: {
            tenantId: user.tenantId,
            placementId,
            counterpartyId: placement.cedantId,
            type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
            direction: PlacementNoteDirection.CEDANT_TO_BROKER,
            noteNumber,
            status: PlacementNoteStatus.DRAFT,
            currency: preview.currency,
            grossAmount: preview.grossAmount,
            commissionPercent: preview.commissionPercent,
            commissionAmount: preview.commissionAmount,
            brokeragePercent: preview.brokeragePercent,
            brokerageAmount: preview.brokerageAmount,
            nicLevyPercent: 0,
            nicLevyAmount: this.sumSourceNoteAmount(
              preview.sourceSnapshot,
              'nicLevyAmount',
            ),
            withholdingTaxPercent: 0,
            withholdingTaxAmount: this.sumSourceNoteAmount(
              preview.sourceSnapshot,
              'withholdingTaxAmount',
            ),
            netAmount: preview.netAmount,
            appliedCharges: preview.appliedCharges,
            sourceSnapshot: preview.sourceSnapshot,
            effectiveAsOf: new Date(preview.asOfDate),
            effectiveVersionKey: preview.effectiveVersionKey,
            postingEnabled: false,
            noteDate,
            createdByUserId: user.id,
          },
          include: noteInclude,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.placementNote.findFirst({
          where: {
            tenantId: user.tenantId,
            placementId,
            type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
            effectiveVersionKey: preview.effectiveVersionKey,
          },
          include: noteInclude,
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findAllCurrentEffectiveDebitNotes(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementNoteRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementNote.findMany({
      where: {
        tenantId,
        placementId,
        type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
      },
      include: noteInclude,
      orderBy: [{ effectiveAsOf: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findCurrentEffectiveDebitNote(
    tenantId: string,
    placementId: string,
    noteId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertPlacement(tenantId, placementId);
    const note = await this.prisma.placementNote.findFirst({
      where: {
        id: noteId,
        tenantId,
        placementId,
        type: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
      },
      include: noteInclude,
    });
    if (!note)
      throw new NotFoundException('Current effective debit note not found');
    return note;
  }

  async createEndorsementCreditNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertEndorsement(user.tenantId, placementId, endorsementId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveEndorsementCreditNote(
        tx,
        user.tenantId,
        placementId,
        endorsementId,
        closingId,
      );

      const closing = await tx.placementEndorsementClosing.findFirst({
        where: {
          id: closingId,
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        include: {
          endorsementParticipant: {
            include: {
              counterparty: {
                select: {
                  id: true,
                  type: true,
                  addresses: { select: { country: true, isPrimary: true } },
                },
              },
            },
          },
        },
      });
      if (!closing) {
        throw new BadRequestException(
          'Endorsement credit note requires a confirmed endorsement closing',
        );
      }
      if (
        closing.endorsementParticipant.counterparty.type !==
        CounterpartyType.REINSURER
      ) {
        throw new BadRequestException(
          'Endorsement credit note counterparty must be a reinsurer',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      );
      const noteDate = new Date();
      const snapshot = await this.endorsementCreditSnapshot(
        tx,
        user.tenantId,
        closing,
        noteDate,
        this.isForeignReinsurer(
          closing.endorsementParticipant.counterparty.addresses,
        ),
      );

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementClosingId: closing.id,
          endorsementParticipantId: closing.endorsementParticipantId,
          counterpartyId: closing.endorsementParticipant.counterpartyId,
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          direction: PlacementNoteDirection.BROKER_TO_REINSURER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          noteDate,
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async issue(
    user: RequestUser,
    placementId: string,
    noteId: string,
    dto: UpdatePlacementNoteStatusDto,
  ): Promise<PlacementNoteRecord> {
    if (dto.status !== PlacementNoteStatus.ISSUED) {
      throw new BadRequestException(
        'Only issuing a draft note is supported by this endpoint',
      );
    }

    const note = await this.findOne(user.tenantId, placementId, noteId);
    if (note.status === PlacementNoteStatus.ISSUED) return note;
    if (note.status !== PlacementNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot move note from ${note.status} to ${dto.status}`,
      );
    }

    const issuedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      return tx.placementNote.update({
        where: { id: noteId },
        data: {
          status: PlacementNoteStatus.ISSUED,
          issuedAt,
        },
        include: noteInclude,
      });
    });
  }

  async void(
    user: RequestUser,
    placementId: string,
    noteId: string,
    dto: VoidPlacementNoteDto,
  ): Promise<PlacementNoteRecord> {
    const note = await this.findOne(user.tenantId, placementId, noteId);
    if (note.status === PlacementNoteStatus.VOID) {
      throw new BadRequestException('VOID notes are terminal');
    }

    return this.prisma.placementNote.update({
      where: { id: noteId },
      data: {
        status: PlacementNoteStatus.VOID,
        voidedAt: new Date(),
        voidReason: this.cleanRequired(dto.voidReason),
      },
      include: noteInclude,
    });
  }

  async issueEndorsementNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    noteId: string,
    dto: UpdatePlacementNoteStatusDto,
  ): Promise<PlacementNoteRecord> {
    if (dto.status !== PlacementNoteStatus.ISSUED) {
      throw new BadRequestException(
        'Only issuing a draft note is supported by this endpoint',
      );
    }

    const note = await this.findEndorsementNote(
      user.tenantId,
      placementId,
      endorsementId,
      noteId,
    );
    if (note.status === PlacementNoteStatus.ISSUED) return note;
    if (note.status !== PlacementNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot move note from ${note.status} to ${dto.status}`,
      );
    }

    const issuedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      return tx.placementNote.update({
        where: { id: noteId },
        data: {
          status: PlacementNoteStatus.ISSUED,
          issuedAt,
        },
        include: noteInclude,
      });
    });
  }

  async voidEndorsementNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    noteId: string,
    dto: VoidPlacementNoteDto,
  ): Promise<PlacementNoteRecord> {
    const note = await this.findEndorsementNote(
      user.tenantId,
      placementId,
      endorsementId,
      noteId,
    );
    if (note.status === PlacementNoteStatus.VOID) {
      throw new BadRequestException('VOID notes are terminal');
    }

    return this.prisma.placementNote.update({
      where: { id: noteId },
      data: {
        status: PlacementNoteStatus.VOID,
        voidedAt: new Date(),
        voidReason: this.cleanRequired(dto.voidReason),
      },
      include: noteInclude,
    });
  }

  private async findPlacement(tenantId: string, placementId: string) {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: {
        id: true,
        cedantId: true,
        currency: true,
        cedant: {
          select: {
            origin: true,
          },
        },
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');
    if (!placement.currency) {
      throw new BadRequestException(
        'Placement currency is required before creating notes',
      );
    }
    return placement;
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    await this.findPlacement(tenantId, placementId);
  }

  private async assertEndorsement(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<{
    id: string;
    endorsementNumber: string;
    impactType: PlacementEndorsementImpactType;
    status: PlacementEndorsementStatus;
    effectiveDate: Date;
  }> {
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId,
        placementId,
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        endorsementNumber: true,
        impactType: true,
        status: true,
        effectiveDate: true,
      },
    });
    if (!endorsement)
      throw new NotFoundException('Placement endorsement not found');
    return endorsement;
  }

  private async assertNoActiveDebitNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        type: PlacementNoteType.DEBIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active debit note already exists for this placement',
      );
    }
  }

  private async assertNoActiveCreditNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    closingId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        closingId,
        type: PlacementNoteType.CREDIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active credit note already exists for this closing',
      );
    }
  }

  private async assertNoActiveEndorsementDebitNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        endorsementId,
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active endorsement debit note already exists for this endorsement',
      );
    }
  }

  private async assertNoActiveEndorsementCreditNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        endorsementId,
        endorsementClosingId: closingId,
        type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active endorsement credit note already exists for this endorsement closing',
      );
    }
  }

  private async nextNoteNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    type: PlacementNoteType,
  ): Promise<string> {
    const count = await tx.placementNote.count({
      where: { tenantId, placementId, type },
    });
    const prefix =
      type === PlacementNoteType.DEBIT_NOTE
        ? 'DN'
        : type === PlacementNoteType.CREDIT_NOTE
          ? 'CN'
          : type === PlacementNoteType.ENDORSEMENT_DEBIT_NOTE
            ? 'EDN'
            : type === PlacementNoteType.ENDORSEMENT_CREDIT_NOTE
              ? 'ECN'
              : 'CEDN';
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  private async buildCurrentEffectiveDebitNotePreview(
    tenantId: string,
    placementId: string,
    asOfDate?: Date | string,
  ): Promise<CurrentEffectiveDebitNotePreview> {
    const effectiveAsOf = this.parseOptionalDate(asOfDate);
    const [financialPosition, effectiveView, sourceReferences] =
      await Promise.all([
        this.financialPosition.getFinancialPosition(
          tenantId,
          placementId,
          effectiveAsOf,
        ),
        this.effectiveView.getEffectiveView(
          tenantId,
          placementId,
          effectiveAsOf,
        ),
        this.findCurrentEffectiveDebitNoteSourceReferences(
          tenantId,
          placementId,
          effectiveAsOf,
        ),
      ]);

    if (financialPosition.isMultiCurrency || !financialPosition.currency) {
      throw new ConflictException(
        'Current effective debit note requires a single confirmed currency.',
      );
    }
    if (financialPosition.cedant.currentObligation <= 0) {
      throw new BadRequestException(
        'Current effective debit note requires a positive cedant obligation.',
      );
    }

    const includedEndorsementIds = effectiveView.appliedEndorsements.map(
      (endorsement) => endorsement.id,
    );
    const excludedFutureEndorsementIds =
      effectiveView.scheduledEndorsements.map((endorsement) => endorsement.id);
    const sourceNoteReferences = sourceReferences.filter(
      (source) => source.sourceType === 'NOTE',
    );
    const versionPayload = {
      placementId,
      currency: financialPosition.currency,
      originalObligation: financialPosition.cedant.originalObligation,
      endorsementAdjustments: financialPosition.cedant.endorsementAdjustments,
      currentEffectiveObligation: financialPosition.cedant.currentObligation,
      includedEndorsementIds,
      sourceClosingIds: sourceReferences
        .filter((source) => source.sourceType !== 'NOTE')
        .map((source) => source.id)
        .sort(),
      effectiveTerms: effectiveView.effectiveTerms,
    };
    const effectiveVersionKey = this.hashVersion(versionPayload);
    const sourceSnapshot = this.toJsonObject({
      statementType: PlacementNoteType.CURRENT_EFFECTIVE_DEBIT_NOTE,
      postingBehavior: 'NON_POSTING_CONSOLIDATED_STATEMENT',
      postingDecision:
        'Original and endorsement-adjustment debit notes carry financial recognition; posting this consolidated statement would duplicate receivables.',
      placementId,
      asOfDate: effectiveAsOf.toISOString(),
      effectiveVersionKey,
      financialPosition: {
        cedant: financialPosition.cedant,
        adjustments: financialPosition.adjustments,
        warnings: financialPosition.warnings,
      },
      effectiveView: {
        basePlacement: effectiveView.basePlacement,
        effectiveTerms: effectiveView.effectiveTerms,
        effectiveTotals: effectiveView.effectiveTotals,
        capacityBreakdown: effectiveView.capacityBreakdown,
        appliedEndorsements: effectiveView.appliedEndorsements,
        scheduledEndorsements: effectiveView.scheduledEndorsements,
        pendingEndorsements: effectiveView.pendingEndorsements,
        warnings: effectiveView.warnings,
      },
      sourceReferences,
      sourceNoteIds: sourceNoteReferences.map((source) => source.id),
      sourceNotes: sourceNoteReferences,
      generatedAt: new Date().toISOString(),
    });
    const appliedCharges = this.toJsonObject({
      statementMode: 'CONSOLIDATED_FROM_SOURCE_SNAPSHOTS',
      postingEnabled: false,
      sourceNoteIds: sourceNoteReferences.map((source) => source.id),
    });
    const grossAmount =
      effectiveView.effectiveTotals.grossPremium ||
      financialPosition.cedant.currentObligation;

    return {
      placementId,
      asOfDate: effectiveAsOf.toISOString(),
      postingEnabled: false,
      currency: financialPosition.currency,
      originalObligation: financialPosition.cedant.originalObligation,
      endorsementAdjustments: financialPosition.cedant.endorsementAdjustments,
      currentEffectiveObligation: financialPosition.cedant.currentObligation,
      grossAmount,
      // The effective view pools business across original participants plus
      // applied endorsements, so a single commissionPercent/brokeragePercent
      // can't be reused verbatim — derive the blended rate the summed amounts
      // actually represent against grossAmount (same approach as debitSnapshot).
      commissionPercent:
        grossAmount > 0
          ? (effectiveView.effectiveTotals.commissionAmount / grossAmount) * 100
          : null,
      commissionAmount: effectiveView.effectiveTotals.commissionAmount,
      brokeragePercent:
        grossAmount > 0
          ? (effectiveView.effectiveTotals.brokerageAmount / grossAmount) * 100
          : null,
      brokerageAmount: effectiveView.effectiveTotals.brokerageAmount,
      netAmount: financialPosition.cedant.currentObligation,
      effectiveVersionKey,
      includedEndorsementIds,
      excludedFutureEndorsementIds,
      sourceReferences,
      sourceSnapshot,
      appliedCharges,
    };
  }

  private async findCurrentEffectiveDebitNoteSourceReferences(
    tenantId: string,
    placementId: string,
    asOfDate: Date,
  ) {
    const [placementClosings, endorsementClosings, sourceNotes] =
      await Promise.all([
        this.prisma.placementClosing.findMany({
          where: {
            tenantId,
            placementId,
            status: PlacementClosingStatus.CONFIRMED,
          },
          select: { id: true, closingNumber: true },
          orderBy: [
            { confirmedAt: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        }),
        this.prisma.placementEndorsementClosing.findMany({
          where: {
            tenantId,
            placementId,
            status: PlacementClosingStatus.CONFIRMED,
            endorsement: {
              tenantId,
              placementId,
              status: PlacementEndorsementStatus.CLOSED,
              effectiveDate: { lte: asOfDate },
            },
          },
          select: {
            id: true,
            closingNumber: true,
            endorsementId: true,
          },
          orderBy: [
            { endorsement: { effectiveDate: 'asc' } },
            { endorsement: { createdAt: 'asc' } },
            { endorsementId: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        }),
        this.prisma.placementNote.findMany({
          where: {
            tenantId,
            placementId,
            type: {
              in: [
                PlacementNoteType.DEBIT_NOTE,
                PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
                PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
              ],
            },
            status: { not: PlacementNoteStatus.VOID },
          },
          select: {
            id: true,
            noteNumber: true,
            endorsementId: true,
            type: true,
            grossAmount: true,
            nicLevyAmount: true,
            withholdingTaxAmount: true,
            netAmount: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      ]);

    return [
      ...placementClosings.map((closing) => ({
        sourceType: 'PLACEMENT_CLOSING' as const,
        id: closing.id,
        reference: closing.closingNumber,
        endorsementId: null,
      })),
      ...endorsementClosings.map((closing) => ({
        sourceType: 'ENDORSEMENT_CLOSING' as const,
        id: closing.id,
        reference: closing.closingNumber,
        endorsementId: closing.endorsementId,
      })),
      ...sourceNotes.map((note) => ({
        sourceType: 'NOTE' as const,
        id: note.id,
        reference: note.noteNumber,
        endorsementId: note.endorsementId,
        noteType: note.type,
        grossAmount: this.toNumber(note.grossAmount),
        nicLevyAmount: this.toNumber(note.nicLevyAmount),
        withholdingTaxAmount: this.toNumber(note.withholdingTaxAmount),
        netAmount: this.toNumber(note.netAmount),
      })),
    ];
  }

  private async debitSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementCurrency: string | null,
    isForeignCedant: boolean,
    closings: DebitClosingSnapshot[],
    effectiveAt: Date,
  ) {
    const currency = placementCurrency ?? closings[0]?.currency;
    if (!currency) {
      throw new BadRequestException(
        'Confirmed closing currency is required before creating a debit note',
      );
    }

    const grossAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.grossPremium),
      0,
    );
    const commissionAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.commissionAmount),
      0,
    );
    // Each closing carries its own commissionPercent, so a placement-level debit note
    // pooling multiple reinsurers can't reuse a single one verbatim — derive the blended
    // rate that the summed commissionAmount actually represents against grossAmount.
    const commissionPercent =
      grossAmount > 0 ? (commissionAmount / grossAmount) * 100 : null;
    const chargeRows = closings.map((closing) => ({
      grossAmount: this.toNumber(closing.grossPremium),
      commissionAmount: this.toNumber(closing.commissionAmount),
      isForeignReinsurer: closing.isForeignReinsurer,
    }));
    const chargeResult = isForeignCedant
      ? this.debitNoteResultWithoutCedantLevies(
          currency,
          effectiveAt,
          chargeRows,
        )
      : await this.pooledChargeResult(
          tx,
          tenantId,
          currency,
          effectiveAt,
          chargeRows,
        );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency,
      grossAmount,
      commissionPercent,
      commissionAmount,
      brokeragePercent: null,
      brokerageAmount: null,
      ...legacyCharges,
      netAmount: chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  private async creditSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    closing: {
      currency: string | null;
      grossPremium: Prisma.Decimal | null;
      commissionPercent: Prisma.Decimal | null;
      commissionAmount: Prisma.Decimal | null;
      brokeragePercent: Prisma.Decimal | null;
      brokerageAmount: Prisma.Decimal | null;
      netPremium: Prisma.Decimal | null;
    },
    effectiveAt: Date,
    isForeignReinsurer: boolean,
  ) {
    if (!closing.currency) {
      throw new BadRequestException(
        'Closing currency is required before creating a credit note',
      );
    }

    const grossAmount = this.toNumber(closing.grossPremium);
    const commissionAmount = this.toOptionalNumber(closing.commissionAmount);
    const brokerageAmount = this.toOptionalNumber(closing.brokerageAmount);
    const chargeResult = await this.chargeSettings.calculateCharges(
      tenantId,
      {
        currency: closing.currency,
        grossAmount,
        commissionAmount: commissionAmount ?? 0,
        brokerageAmount: brokerageAmount ?? 0,
        effectiveAt,
        isForeignReinsurer,
      },
      tx,
    );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency: closing.currency,
      grossAmount,
      commissionPercent: this.toOptionalNumber(closing.commissionPercent),
      commissionAmount,
      brokeragePercent: this.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount,
      ...legacyCharges,
      netAmount:
        chargeResult.charges.length === 0
          ? this.toNumber(closing.netPremium)
          : chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  private async endorsementDebitSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    isForeignCedant: boolean,
    closings: EndorsementDebitClosingSnapshot[],
    effectiveAt: Date,
  ) {
    const currencies = closings.map((closing) => closing.currency);
    if (currencies.some((currency) => !currency)) {
      throw new BadRequestException(
        'Confirmed endorsement closing currency is required before creating a debit note',
      );
    }
    const uniqueCurrencies = new Set(currencies);
    if (uniqueCurrencies.size !== 1) {
      throw new BadRequestException(
        'Endorsement debit note requires confirmed endorsement closings in a single currency',
      );
    }
    const [currency] = Array.from(uniqueCurrencies) as [string];

    const grossAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.premiumSnapshot),
      0,
    );
    if (grossAmount <= 0) {
      throw new BadRequestException(
        'Endorsement debit notes require a positive additional-premium adjustment',
      );
    }
    const commissionAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.commissionAmount),
      0,
    );
    // Same reasoning as debitSnapshot: each endorsement closing carries its own
    // commissionPercent, so the pooled placement-level note derives a blended rate
    // from the summed amounts rather than reusing a single closing's percent verbatim.
    const commissionPercent =
      grossAmount > 0 ? (commissionAmount / grossAmount) * 100 : null;
    const chargeRows = closings.map((closing) => ({
      grossAmount: this.toNumber(closing.premiumSnapshot),
      commissionAmount: this.toNumber(closing.commissionAmount),
      isForeignReinsurer: closing.isForeignReinsurer,
    }));
    const chargeResult = isForeignCedant
      ? this.debitNoteResultWithoutCedantLevies(
          currency,
          effectiveAt,
          chargeRows,
        )
      : await this.pooledChargeResult(
          tx,
          tenantId,
          currency,
          effectiveAt,
          chargeRows,
        );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency,
      grossAmount,
      commissionPercent,
      commissionAmount,
      brokeragePercent: null,
      brokerageAmount: null,
      ...legacyCharges,
      netAmount: chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  private async endorsementCreditSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    closing: {
      currency: string | null;
      premiumSnapshot: Prisma.Decimal;
      commissionPercent: Prisma.Decimal | null;
      commissionAmount: Prisma.Decimal | null;
      brokeragePercent: Prisma.Decimal | null;
      brokerageAmount: Prisma.Decimal | null;
      netPremium: Prisma.Decimal | null;
    },
    effectiveAt: Date,
    isForeignReinsurer: boolean,
  ) {
    if (!closing.currency) {
      throw new BadRequestException(
        'Endorsement closing currency is required before creating a credit note',
      );
    }

    const grossAmount = this.toNumber(closing.premiumSnapshot);
    const commissionAmount = this.toOptionalNumber(closing.commissionAmount);
    const brokerageAmount = this.toOptionalNumber(closing.brokerageAmount);
    const chargeResult = await this.chargeSettings.calculateCharges(
      tenantId,
      {
        currency: closing.currency,
        grossAmount,
        commissionAmount: commissionAmount ?? 0,
        brokerageAmount: brokerageAmount ?? 0,
        effectiveAt,
        isForeignReinsurer,
      },
      tx,
    );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency: closing.currency,
      grossAmount,
      commissionPercent: this.toOptionalNumber(closing.commissionPercent),
      commissionAmount,
      brokeragePercent: this.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount,
      ...legacyCharges,
      netAmount:
        chargeResult.charges.length === 0
          ? this.toNumber(closing.netPremium)
          : chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  /**
   * A reinsurer counts as foreign for levy purposes when its primary address
   * (or first address, if none is flagged primary) is in a country other than
   * Ghana. Matches PlacementsService.isForeignCedant.
   */
  private isForeignReinsurer(
    addresses: { country: string; isPrimary: boolean }[] | null | undefined,
  ): boolean {
    if (!addresses?.length) return false;
    const primary =
      addresses.find((address) => address.isPrimary) ?? addresses[0];
    return !!primary && primary.country.toUpperCase() !== 'GH';
  }

  private isForeignCedant(placement: {
    cedant?: { origin: CounterpartyOrigin } | null;
  }): boolean {
    return placement.cedant?.origin === CounterpartyOrigin.FOREIGN;
  }

  private debitNoteResultWithoutCedantLevies(
    currency: string,
    effectiveAt: Date,
    rows: {
      grossAmount: number;
      commissionAmount: number;
    }[],
  ): ChargeCalculationResult {
    const round2 = (value: number): number => Math.round(value * 100) / 100;
    const grossAmount = round2(
      rows.reduce((total, row) => total + row.grossAmount, 0),
    );
    const commissionAmount = round2(
      rows.reduce((total, row) => total + row.commissionAmount, 0),
    );
    const netBeforeCharges = round2(grossAmount - commissionAmount);

    return {
      currency: currency.toUpperCase(),
      effectiveAt: effectiveAt.toISOString(),
      grossAmount,
      commissionAmount,
      brokerageAmount: 0,
      netBeforeCharges,
      additions: 0,
      deductions: 0,
      netAmount: netBeforeCharges,
      charges: [],
    };
  }

  /**
   * Runs the charge engine separately for the foreign-ceded and resident-ceded
   * portions of a pooled note, then merges the results. NIC Levy / Withholding
   * Tax are computed only against the foreign sub-pool; every other figure is the
   * sum across both.
   */
  private async pooledChargeResult(
    tx: Prisma.TransactionClient,
    tenantId: string,
    currency: string,
    effectiveAt: Date,
    rows: {
      grossAmount: number;
      commissionAmount: number;
      isForeignReinsurer: boolean;
    }[],
  ): Promise<ChargeCalculationResult> {
    const groups = [true, false]
      .map((isForeignReinsurer) => ({
        isForeignReinsurer,
        rows: rows.filter(
          (row) => row.isForeignReinsurer === isForeignReinsurer,
        ),
      }))
      .filter((group) => group.rows.length > 0);

    const results: ChargeCalculationResult[] = [];
    for (const group of groups) {
      results.push(
        await this.chargeSettings.calculateCharges(
          tenantId,
          {
            currency,
            grossAmount: group.rows.reduce(
              (total, row) => total + row.grossAmount,
              0,
            ),
            commissionAmount: group.rows.reduce(
              (total, row) => total + row.commissionAmount,
              0,
            ),
            brokerageAmount: 0,
            effectiveAt,
            isForeignReinsurer: group.isForeignReinsurer,
          },
          tx,
        ),
      );
    }

    return this.combineChargeResults(results, currency, effectiveAt);
  }

  private combineChargeResults(
    results: ChargeCalculationResult[],
    fallbackCurrency: string,
    fallbackEffectiveAt: Date,
  ): ChargeCalculationResult {
    if (results.length === 1) return results[0];
    const round2 = (value: number): number => Math.round(value * 100) / 100;

    return results.reduce<ChargeCalculationResult>(
      (acc, result) => ({
        currency: acc.currency,
        effectiveAt: acc.effectiveAt,
        grossAmount: round2(acc.grossAmount + result.grossAmount),
        commissionAmount: round2(
          acc.commissionAmount + result.commissionAmount,
        ),
        brokerageAmount: round2(acc.brokerageAmount + result.brokerageAmount),
        netBeforeCharges: round2(
          acc.netBeforeCharges + result.netBeforeCharges,
        ),
        additions: round2(acc.additions + result.additions),
        deductions: round2(acc.deductions + result.deductions),
        netAmount: round2(acc.netAmount + result.netAmount),
        charges: [...acc.charges, ...result.charges],
      }),
      {
        currency: results[0]?.currency ?? fallbackCurrency.toUpperCase(),
        effectiveAt:
          results[0]?.effectiveAt ?? fallbackEffectiveAt.toISOString(),
        grossAmount: 0,
        commissionAmount: 0,
        brokerageAmount: 0,
        netBeforeCharges: 0,
        additions: 0,
        deductions: 0,
        netAmount: 0,
        charges: [],
      },
    );
  }

  private legacyChargeFields(result: ChargeCalculationResult) {
    const nicLevy = this.findCharge(
      result.charges,
      ReinsuranceChargeCode.NIC_LEVY,
    );
    const withholdingTax = this.findCharge(
      result.charges,
      ReinsuranceChargeCode.WITHHOLDING_TAX,
    );
    return {
      nicLevyPercent: this.legacyPercent(nicLevy),
      nicLevyAmount: nicLevy?.amount ?? 0,
      withholdingTaxPercent: this.legacyPercent(withholdingTax),
      withholdingTaxAmount: withholdingTax?.amount ?? 0,
    };
  }

  private findCharge(
    charges: AppliedChargeSnapshot[],
    code: ReinsuranceChargeCode,
  ): AppliedChargeSnapshot | undefined {
    return charges.find((charge) => charge.code === code);
  }

  private legacyPercent(charge: AppliedChargeSnapshot | undefined): number {
    if (!charge || charge.rateType !== ReinsuranceChargeRateType.PERCENTAGE) {
      return 0;
    }
    const rate = Number(charge.rate);
    return Number.isFinite(rate) ? rate : 0;
  }

  private appliedChargesSnapshot(
    result: ChargeCalculationResult,
  ): Prisma.InputJsonObject {
    return {
      version: 1,
      currency: result.currency,
      effectiveAt: result.effectiveAt,
      grossAmount: result.grossAmount,
      commissionAmount: result.commissionAmount,
      brokerageAmount: result.brokerageAmount,
      netBeforeCharges: result.netBeforeCharges,
      additions: result.additions,
      deductions: result.deductions,
      netAmount: result.netAmount,
      charges: result.charges as unknown as Prisma.InputJsonArray,
    };
  }

  private toNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toOptionalNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseOptionalDate(value: Date | string | undefined): Date {
    const date =
      value == null
        ? new Date()
        : value instanceof Date
          ? value
          : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid effective debit note asOfDate');
    }
    return date;
  }

  private hashVersion(payload: unknown): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 32);
    return `current-effective-debit-note:v1:${hash}`;
  }

  private sumSourceNoteAmount(
    sourceSnapshot: Prisma.JsonObject,
    field: 'nicLevyAmount' | 'withholdingTaxAmount',
  ): number {
    const sourceNotes = sourceSnapshot.sourceNotes;
    if (!Array.isArray(sourceNotes)) return 0;
    return sourceNotes.reduce<number>((total, source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return total;
      }
      const value = (source as Record<string, unknown>)[field];
      return (
        total +
        (typeof value === 'number' && Number.isFinite(value) ? value : 0)
      );
    }, 0);
  }

  private toJsonObject(value: Record<string, unknown>): Prisma.JsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.JsonObject;
  }

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Void reason is required');
    return cleaned;
  }
}
