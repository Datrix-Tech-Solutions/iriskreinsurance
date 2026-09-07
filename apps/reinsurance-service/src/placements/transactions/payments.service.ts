import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementSettlementMethod,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CancelPlacementPaymentDto } from '../dto/cancel-placement-payment.dto';
import { ConfirmPlacementPaymentBankDto } from '../dto/confirm-placement-payment-bank.dto';
import { CreatePlacementPaymentDto } from '../dto/create-placement-payment.dto';
import { PlacementFinancialPositionService } from '../finance/financial-position.service';

const paymentInclude = {
  placement: {
    select: {
      id: true,
      reference: true,
      policyNumber: true,
      title: true,
      currency: true,
    },
  },
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
      netPremium: true,
      currency: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
      netPremium: true,
      currency: true,
      endorsementId: true,
      endorsement: {
        select: {
          id: true,
          endorsementNumber: true,
          effectiveDate: true,
          type: true,
        },
      },
    },
  },
  allocations: {
    include: {
      note: {
        select: {
          id: true,
          noteNumber: true,
          type: true,
          currency: true,
          status: true,
          direction: true,
          netAmount: true,
          nicLevyPercent: true,
          nicLevyAmount: true,
          withholdingTaxPercent: true,
          withholdingTaxAmount: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PlacementPaymentInclude;

const FINANCIALLY_CONFIRMABLE_PAYMENT_LIFECYCLE: Readonly<
  Record<PlacementPaymentStatus, readonly PlacementPaymentStatus[]>
> = {
  [PlacementPaymentStatus.RECORDED]: [
    PlacementPaymentStatus.CANCELLED,
    PlacementPaymentStatus.FAILED,
    PlacementPaymentStatus.BANK_CONFIRMED,
  ],
  [PlacementPaymentStatus.BANK_CONFIRMED]: [PlacementPaymentStatus.REVERSED],
  [PlacementPaymentStatus.CANCELLED]: [],
  [PlacementPaymentStatus.FAILED]: [],
  [PlacementPaymentStatus.REVERSED]: [],
};

type PlacementPaymentRecord = Prisma.PlacementPaymentGetPayload<{
  include: typeof paymentInclude;
}>;

type ValidatedDisbursementAllocation = {
  tenantId: string;
  placementId: string;
  noteId: string;
  allocatedAmount: Prisma.Decimal;
  allocatedCurrency: string;
  obligationAmount: Prisma.Decimal;
  obligationCurrency: string;
  agreedExchangeRate: Prisma.Decimal | null;
  createdByUserId: string;
};

@Injectable()
export class PlacementPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialPositionService: PlacementFinancialPositionService,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementPaymentRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementPayment.findMany({
      where: { tenantId, placementId },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingBankConfirmations(
    tenantId: string,
  ): Promise<PlacementPaymentRecord[]> {
    return this.prisma.placementPayment.findMany({
      where: {
        tenantId,
        OR: [
          {
            type: PlacementPaymentType.PREMIUM_RECEIVED,
            direction: PlacementPaymentDirection.INBOUND,
          },
          {
            type: PlacementPaymentType.REINSURER_DISBURSEMENT,
            direction: PlacementPaymentDirection.OUTBOUND,
          },
        ],
        status: PlacementPaymentStatus.RECORDED,
        reversalOfPaymentId: null,
        placement: { archivedAt: null },
      },
      include: paymentInclude,
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    paymentId: string,
  ): Promise<PlacementPaymentRecord> {
    await this.assertPlacement(tenantId, placementId);
    const payment = await this.prisma.placementPayment.findFirst({
      where: { id: paymentId, tenantId, placementId },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException('Placement payment not found');
    return payment;
  }

  async create(
    user: RequestUser,
    placementId: string,
    dto: CreatePlacementPaymentDto,
  ): Promise<PlacementPaymentRecord> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId: user.tenantId, archivedAt: null },
      select: {
        id: true,
        tenantId: true,
        cedantId: true,
        currency: true,
        reference: true,
        policyNumber: true,
        title: true,
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const currency = this.cleanCurrency(dto.currency);
    if (!placement.currency) {
      throw new BadRequestException(
        'Placement currency is required before recording payment',
      );
    }
    const counterparty = await this.prisma.counterparty.findFirst({
      where: {
        id: dto.counterpartyId,
        tenantId: user.tenantId,
        archivedAt: null,
      },
      select: { id: true, type: true },
    });
    if (!counterparty) throw new NotFoundException('Counterparty not found');

    let disbursementAllocations: ValidatedDisbursementAllocation[] = [];

    if (dto.type === PlacementPaymentType.PREMIUM_RECEIVED) {
      await this.assertPremiumReceived(
        user.tenantId,
        placementId,
        placement.cedantId,
        counterparty.id,
        currency,
        dto,
      );
    } else if (dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT) {
      disbursementAllocations = await this.assertReinsurerDisbursement(
        user.tenantId,
        placementId,
        counterparty,
        dto,
        user.id,
      );
    } else {
      throw new BadRequestException(
        'Claim settlement payments are deferred until claims are implemented',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.placementPayment.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          closingId: dto.closingId,
          endorsementClosingId: dto.endorsementClosingId,
          participantId: dto.participantId,
          counterpartyId: dto.counterpartyId,
          type: dto.type,
          direction: dto.direction,
          amount: dto.amount,
          currency,
          paymentDate: new Date(dto.paymentDate),
          reference: this.cleanOptional(dto.reference),
          settlementReference: this.cleanOptional(dto.settlementReference),
          settlementMethod: dto.settlementMethod ?? null,
          settlementCurrency: this.cleanOptional(dto.settlementCurrency)
            ? this.cleanCurrency(dto.settlementCurrency as string)
            : null,
          bankReference: null,
          bankConfirmedAt: null,
          bankConfirmedByUserId: null,
          agreedExchangeRate: dto.agreedExchangeRate ?? null,
          bankChargeAmount: 0,
          withholdingTaxAmount:
            dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT
              ? 0
              : (dto.withholdingTaxAmount ?? 0),
          notes: this.cleanOptional(dto.notes),
          status: PlacementPaymentStatus.RECORDED,
          createdByUserId: user.id,
          ...(disbursementAllocations.length
            ? {
                allocations: {
                  create: disbursementAllocations,
                },
              }
            : {}),
        },
        include: paymentInclude,
      });

      return payment;
    });
  }

  async confirmBankPayment(
    user: RequestUser,
    placementId: string,
    paymentId: string,
    dto: ConfirmPlacementPaymentBankDto,
  ): Promise<PlacementPaymentRecord> {
    const payment = await this.findOne(user.tenantId, placementId, paymentId);

    if (!this.isConfirmablePayment(payment)) {
      throw new BadRequestException(
        'Only original recorded inbound premium receipts or outbound reinsurer disbursements can be financially confirmed',
      );
    }
    if (payment.status === PlacementPaymentStatus.BANK_CONFIRMED) {
      throw new ConflictException(
        'Payment has already been financially confirmed',
      );
    }
    if (payment.status !== PlacementPaymentStatus.RECORDED) {
      throw new BadRequestException(
        `Cannot financially confirm a payment from ${payment.status}`,
      );
    }

    const settlementMethod = this.resolveConfirmationSettlementMethod(
      payment,
      dto.settlementMethod,
    );
    const settlementCurrency = this.resolveConfirmationSettlementCurrency(
      payment,
      dto.settlementCurrency,
    );
    const bankReference = this.resolveConfirmationBankReference(
      payment,
      dto.bankReference,
    );
    const confirmedExchangeRate =
      dto.confirmedExchangeRate ?? dto.agreedExchangeRate ?? undefined;
    this.assertConfirmationFacts({
      settlementMethod,
      bankReference,
      operationalReference: payment.reference,
      notes: dto.notes,
    });
    this.assertSettlementFxFacts(
      payment,
      settlementCurrency,
      confirmedExchangeRate,
    );

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.placementPayment.updateMany({
        where: {
          id: paymentId,
          tenantId: user.tenantId,
          placementId,
          status: PlacementPaymentStatus.RECORDED,
        },
        data: {
          status: PlacementPaymentStatus.BANK_CONFIRMED,
          bankConfirmedAt: new Date(dto.bankConfirmedAt),
          bankConfirmedByUserId: user.id,
          settlementMethod,
          settlementCurrency,
          bankReference,
          accountingCashAccountId: dto.accountingCashAccountId ?? null,
          agreedExchangeRate:
            confirmedExchangeRate ?? payment.agreedExchangeRate,
          bankChargeAmount: dto.bankChargeAmount ?? 0,
          notes: this.appendConfirmationNotes(payment.notes, dto.notes),
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'Payment could not be financially confirmed because its status changed',
        );
      }

      const confirmed = await tx.placementPayment.findFirst({
        where: { id: paymentId, tenantId: user.tenantId, placementId },
        include: paymentInclude,
      });
      if (!confirmed) {
        throw new NotFoundException('Placement payment not found');
      }

      return confirmed;
    });
  }

  async reverse(
    user: RequestUser,
    placementId: string,
    paymentId: string,
  ): Promise<PlacementPaymentRecord> {
    const payment = await this.findOne(user.tenantId, placementId, paymentId);

    if (payment.reversalOfPaymentId) {
      throw new BadRequestException('Cannot reverse a reversal payment');
    }
    if (payment.status === PlacementPaymentStatus.REVERSED) {
      throw new ConflictException('Payment has already been reversed');
    }
    this.assertCanReversePayment(payment);

    return this.prisma.$transaction(async (tx) => {
      await tx.placementPayment.update({
        where: { id: payment.id },
        data: { status: PlacementPaymentStatus.REVERSED },
      });

      const reversal = await tx.placementPayment.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          closingId: payment.closingId,
          endorsementClosingId: payment.endorsementClosingId,
          participantId: payment.participantId,
          counterpartyId: payment.counterpartyId,
          type: payment.type,
          direction: payment.direction,
          amount: payment.amount.negated(),
          currency: payment.currency,
          paymentDate: new Date(),
          reference: payment.reference
            ? `REVERSAL-${payment.reference}`
            : `REVERSAL-${payment.id}`,
          settlementReference: payment.settlementReference
            ? `REVERSAL-${payment.settlementReference}`
            : null,
          settlementMethod: payment.settlementMethod,
          settlementCurrency: payment.settlementCurrency,
          bankReference: payment.bankReference
            ? `REVERSAL-${payment.bankReference}`
            : null,
          accountingCashAccountId: payment.accountingCashAccountId,
          bankConfirmedAt: null,
          bankConfirmedByUserId: null,
          agreedExchangeRate: payment.agreedExchangeRate,
          bankChargeAmount: payment.bankChargeAmount.negated(),
          withholdingTaxAmount: payment.withholdingTaxAmount.negated(),
          notes: 'Payment reversal',
          status: PlacementPaymentStatus.RECORDED,
          reversalOfPaymentId: payment.id,
          createdByUserId: user.id,
          ...(payment.allocations.length
            ? {
                allocations: {
                  create: payment.allocations.map((allocation) => ({
                    tenantId: user.tenantId,
                    placementId,
                    noteId: allocation.noteId,
                    allocatedAmount: allocation.allocatedAmount.negated(),
                    allocatedCurrency: allocation.allocatedCurrency,
                    obligationAmount: allocation.obligationAmount.negated(),
                    obligationCurrency: allocation.obligationCurrency,
                    agreedExchangeRate: allocation.agreedExchangeRate,
                    createdByUserId: user.id,
                  })),
                },
              }
            : {}),
        },
        include: paymentInclude,
      });

      return reversal;
    });
  }

  /**
   * Cancels a payment that was recorded but never bank confirmed. This is the
   * correction path for RECORDED entries, which cannot be reversed (reverse only
   * applies once a payment is BANK_CONFIRMED). No reversal row is created because
   * a RECORDED payment only ever counted towards the pending position. Re-record
   * the corrected payment through the normal create endpoint.
   */
  async cancel(
    user: RequestUser,
    placementId: string,
    paymentId: string,
    dto: CancelPlacementPaymentDto,
  ): Promise<PlacementPaymentRecord> {
    const payment = await this.findOne(user.tenantId, placementId, paymentId);

    if (payment.reversalOfPaymentId) {
      throw new BadRequestException('Cannot cancel a reversal payment');
    }
    if (payment.status !== PlacementPaymentStatus.RECORDED) {
      throw new BadRequestException(
        `Cannot cancel a payment from ${payment.status}. Only a RECORDED payment that has not been bank confirmed can be cancelled; reverse it once it is bank confirmed.`,
      );
    }

    const reason = this.cleanOptional(dto.reason);
    return this.prisma.placementPayment.update({
      where: { id: payment.id },
      data: {
        status: PlacementPaymentStatus.CANCELLED,
        notes: reason
          ? `${payment.notes ? `${payment.notes}\n` : ''}Cancelled: ${reason}`
          : payment.notes,
      },
      include: paymentInclude,
    });
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

  private async effectiveRecordedPaymentsTotal(where: {
    tenantId: string;
    placementId: string;
    type: PlacementPaymentType;
    currency: string;
    closingId?: string;
    endorsementClosingId?: string;
    participantId?: string;
  }): Promise<number> {
    const payments = await this.prisma.placementPayment.findMany({
      where: {
        ...where,
        status: {
          in: [
            PlacementPaymentStatus.RECORDED,
            PlacementPaymentStatus.BANK_CONFIRMED,
          ],
        },
        reversalOfPaymentId: null,
      },
      select: { amount: true },
    });

    return payments.reduce(
      (total, payment) => total + this.decimalToNumber(payment.amount),
      0,
    );
  }

  private assertDoesNotExceedOutstanding(
    amount: number,
    outstanding: number,
    message: string,
  ): void {
    if (amount > Math.max(0, outstanding) + 0.0001) {
      throw new ConflictException(message);
    }
  }

  private assertCanReversePayment(payment: PlacementPaymentRecord): void {
    const allowedNext =
      FINANCIALLY_CONFIRMABLE_PAYMENT_LIFECYCLE[payment.status] ?? [];
    if (!allowedNext.includes(PlacementPaymentStatus.REVERSED)) {
      throw new BadRequestException(
        `Cannot reverse a payment from ${payment.status}. The payment must be bank confirmed before reversal is available.`,
      );
    }
  }

  private isConfirmablePayment(payment: PlacementPaymentRecord): boolean {
    if (payment.reversalOfPaymentId) return false;
    if (
      payment.type === PlacementPaymentType.PREMIUM_RECEIVED &&
      payment.direction === PlacementPaymentDirection.INBOUND
    ) {
      return true;
    }
    return (
      payment.type === PlacementPaymentType.REINSURER_DISBURSEMENT &&
      payment.direction === PlacementPaymentDirection.OUTBOUND
    );
  }

  private assertConfirmationFacts(input: {
    settlementMethod: PlacementSettlementMethod;
    bankReference: string | null;
    operationalReference: string | null;
    notes?: string;
  }): void {
    const referenceRequiredMethods: PlacementSettlementMethod[] = [
      PlacementSettlementMethod.BANK_TRANSFER,
      PlacementSettlementMethod.CHEQUE,
      PlacementSettlementMethod.MOBILE_MONEY,
    ];
    const referenceRequired = referenceRequiredMethods.includes(
      input.settlementMethod,
    );

    const hasReference = Boolean(
      input.bankReference || input.operationalReference,
    );
    if (referenceRequired && !hasReference) {
      throw new BadRequestException(
        `${input.settlementMethod} confirmation requires a settlement reference`,
      );
    }

    if (
      input.settlementMethod === PlacementSettlementMethod.OTHER &&
      !hasReference &&
      !this.cleanOptional(input.notes)
    ) {
      throw new BadRequestException(
        'OTHER settlement method requires either a reference or confirmation notes',
      );
    }
  }

  private resolveConfirmationSettlementMethod(
    payment: PlacementPaymentRecord,
    requested: PlacementSettlementMethod | undefined,
  ): PlacementSettlementMethod {
    if (payment.settlementMethod) {
      if (requested && requested !== payment.settlementMethod) {
        throw new BadRequestException(
          'Confirmation cannot change the operational settlement method',
        );
      }
      return payment.settlementMethod;
    }
    return requested ?? PlacementSettlementMethod.BANK_TRANSFER;
  }

  private resolveConfirmationSettlementCurrency(
    payment: PlacementPaymentRecord,
    requested: string | undefined,
  ): string {
    if (payment.settlementCurrency) {
      const cleanedRequested = this.cleanOptional(requested);
      if (
        cleanedRequested &&
        this.cleanCurrency(cleanedRequested) !== payment.settlementCurrency
      ) {
        throw new BadRequestException(
          'Confirmation cannot change the operational settlement currency',
        );
      }
      return payment.settlementCurrency;
    }
    return this.cleanCurrency(requested ?? payment.currency);
  }

  private resolveConfirmationBankReference(
    payment: PlacementPaymentRecord,
    requested: string | undefined,
  ): string | null {
    if (payment.bankReference) {
      const cleanedRequested = this.cleanOptional(requested);
      if (cleanedRequested && cleanedRequested !== payment.bankReference) {
        throw new BadRequestException(
          'Confirmation cannot change the source payment reference',
        );
      }
      return payment.bankReference;
    }
    return this.cleanOptional(requested);
  }

  private assertSettlementFxFacts(
    payment: PlacementPaymentRecord,
    settlementCurrency: string,
    confirmedExchangeRate: number | undefined,
  ): void {
    const persistedPaymentRate = this.optionalDecimalToNumber(
      payment.agreedExchangeRate,
    );
    const hasPaymentFx = Boolean(confirmedExchangeRate ?? persistedPaymentRate);
    const allocations = payment.allocations ?? [];
    const placementCurrency = this.cleanOptional(
      payment.placement?.currency ?? undefined,
    );
    if (
      placementCurrency &&
      payment.type === PlacementPaymentType.PREMIUM_RECEIVED &&
      this.cleanCurrency(placementCurrency) !== settlementCurrency &&
      !hasPaymentFx
    ) {
      throw new BadRequestException(
        'Cross-currency premium receipt confirmation requires a persisted agreed FX rate',
      );
    }

    if (allocations.length > 0) {
      const missingFxAllocation = allocations.find((allocation) => {
        const obligationCurrency = this.cleanCurrency(
          allocation.obligationCurrency,
        );
        if (obligationCurrency === settlementCurrency) return false;
        return !allocation.agreedExchangeRate && !hasPaymentFx;
      });
      if (missingFxAllocation) {
        throw new BadRequestException(
          'Cross-currency reinsurer disbursement confirmation requires a persisted agreed FX rate for every different-currency obligation',
        );
      }
      return;
    }

    const obligationCurrency =
      this.cleanOptional(payment.closing?.currency ?? undefined) ??
      this.cleanOptional(payment.endorsementClosing?.currency ?? undefined) ??
      payment.currency;
    if (
      this.cleanCurrency(obligationCurrency) !== settlementCurrency &&
      !hasPaymentFx
    ) {
      throw new BadRequestException(
        'Cross-currency reinsurer disbursement confirmation requires a persisted agreed FX rate',
      );
    }
  }

  private async assertPremiumReceived(
    tenantId: string,
    placementId: string,
    cedantId: string,
    counterpartyId: string,
    currency: string,
    dto: CreatePlacementPaymentDto,
  ): Promise<void> {
    if (dto.direction !== PlacementPaymentDirection.INBOUND) {
      throw new BadRequestException('Premium received must be INBOUND');
    }
    if (dto.counterpartyId !== cedantId || counterpartyId !== cedantId) {
      throw new BadRequestException(
        'Premium received counterparty must be the placement cedant',
      );
    }
    if (dto.closingId || dto.endorsementClosingId || dto.participantId) {
      throw new BadRequestException(
        'Premium received is placement-level; omit closingId, endorsementClosingId and participantId',
      );
    }

    const position = await this.financialPositionService.getFinancialPosition(
      tenantId,
      placementId,
      new Date(dto.paymentDate),
    );
    if (position.isMultiCurrency) {
      throw new BadRequestException(
        'Premium received cannot be recorded against a multi-currency financial position',
      );
    }
    if (position.cedant.currentObligation <= 0) {
      throw new BadRequestException(
        'At least one confirmed closing is required before recording payment',
      );
    }
    this.assertDoesNotExceedOutstanding(
      this.paymentAmountInPositionCurrency(
        dto.amount,
        currency,
        position.currency ?? currency,
        dto.agreedExchangeRate,
      ),
      position.cedant.outstanding,
      'Premium received exceeds the outstanding current effective premium',
    );
  }

  private paymentAmountInPositionCurrency(
    amount: number,
    paymentCurrency: string,
    positionCurrency: string,
    exchangeRate: number | undefined,
  ): number {
    if (paymentCurrency === positionCurrency) return amount;
    if (!exchangeRate) return 0;
    return amount / exchangeRate;
  }

  private async assertReinsurerDisbursement(
    tenantId: string,
    placementId: string,
    counterparty: { id: string; type: CounterpartyType },
    dto: CreatePlacementPaymentDto,
    userId: string,
  ): Promise<ValidatedDisbursementAllocation[]> {
    if (dto.direction !== PlacementPaymentDirection.OUTBOUND) {
      throw new BadRequestException('Reinsurer disbursement must be OUTBOUND');
    }
    if (counterparty.type !== CounterpartyType.REINSURER) {
      throw new BadRequestException(
        'Reinsurer disbursement counterparty must be a reinsurer',
      );
    }

    await this.assertReinsurerDisbursementSettlementSource(
      tenantId,
      placementId,
      counterparty.id,
      dto,
    );

    if (!dto.allocations?.length) {
      return [];
    }

    return this.validateReinsurerDisbursementAllocations(
      tenantId,
      placementId,
      counterparty.id,
      dto,
      userId,
    );
  }

  private async assertReinsurerDisbursementSettlementSource(
    tenantId: string,
    placementId: string,
    counterpartyId: string,
    dto: CreatePlacementPaymentDto,
  ): Promise<void> {
    if (dto.closingId && dto.endorsementClosingId) {
      throw new BadRequestException(
        'Reinsurer disbursement can reference either an original closing or endorsement closing, not both',
      );
    }

    if (
      !dto.closingId &&
      !dto.endorsementClosingId &&
      !dto.allocations?.length
    ) {
      throw new BadRequestException(
        'Reinsurer disbursement requires a confirmed closing source or optional credit-note allocation',
      );
    }

    if (dto.closingId) {
      const closing = await this.prisma.placementClosing.findFirst({
        where: {
          id: dto.closingId,
          tenantId,
          placementId,
          status: PlacementClosingStatus.CONFIRMED,
          participant: { counterpartyId },
        },
        select: {
          id: true,
          participantId: true,
          netPremium: true,
          currency: true,
        },
      });
      if (!closing) {
        throw new BadRequestException(
          'Reinsurer disbursement must reference a confirmed original closing for the payment reinsurer',
        );
      }
      if (dto.participantId && dto.participantId !== closing.participantId) {
        throw new BadRequestException(
          'Reinsurer disbursement participantId must match the original closing participant',
        );
      }
      const paid = await this.effectiveRecordedPaymentsTotal({
        tenantId,
        placementId,
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        currency: this.cleanCurrency(dto.currency),
        closingId: closing.id,
      });
      this.assertDoesNotExceedOutstanding(
        dto.amount,
        this.decimalToNumber(closing.netPremium) - paid,
        'Reinsurer disbursement exceeds the outstanding original closing amount',
      );
    }

    if (dto.endorsementClosingId) {
      if (dto.participantId) {
        throw new BadRequestException(
          'Reinsurer disbursement participantId is only supported for original placement closings',
        );
      }
      const endorsementClosing =
        await this.prisma.placementEndorsementClosing.findFirst({
          where: {
            id: dto.endorsementClosingId,
            tenantId,
            placementId,
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipant: { counterpartyId },
          },
          select: {
            id: true,
            netPremium: true,
            currency: true,
          },
        });
      if (!endorsementClosing) {
        throw new BadRequestException(
          'Reinsurer disbursement must reference a confirmed endorsement closing for the payment reinsurer',
        );
      }
      const paid = await this.effectiveRecordedPaymentsTotal({
        tenantId,
        placementId,
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        currency: this.cleanCurrency(dto.currency),
        endorsementClosingId: endorsementClosing.id,
      });
      this.assertDoesNotExceedOutstanding(
        dto.amount,
        this.decimalToNumber(endorsementClosing.netPremium) - paid,
        'Reinsurer disbursement exceeds the outstanding endorsement closing amount',
      );
    }
  }

  private async validateReinsurerDisbursementAllocations(
    tenantId: string,
    placementId: string,
    counterpartyId: string,
    dto: CreatePlacementPaymentDto,
    userId: string,
  ): Promise<ValidatedDisbursementAllocation[]> {
    const allocations = dto.allocations ?? [];
    const uniqueNoteIds = new Set(
      allocations.map((allocation) => allocation.noteId),
    );
    if (uniqueNoteIds.size !== allocations.length) {
      throw new BadRequestException(
        'Reinsurer disbursement allocations must not duplicate credit notes',
      );
    }

    const paymentCurrency = this.cleanCurrency(dto.currency);
    const notes = await this.prisma.placementNote.findMany({
      where: {
        id: { in: [...uniqueNoteIds] },
        tenantId,
        placementId,
        counterpartyId,
        status: PlacementNoteStatus.ISSUED,
        direction: PlacementNoteDirection.BROKER_TO_REINSURER,
        type: {
          in: [
            PlacementNoteType.CREDIT_NOTE,
            PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          ],
        },
      },
      select: {
        id: true,
        currency: true,
        netAmount: true,
      },
    });

    if (notes.length !== uniqueNoteIds.size) {
      throw new BadRequestException(
        'Reinsurer disbursement allocations must reference issued credit notes for the payment reinsurer',
      );
    }

    const notesById = new Map(notes.map((note) => [note.id, note]));
    const allocationCreates: ValidatedDisbursementAllocation[] = [];
    let allocatedTotal = new Prisma.Decimal(0);

    for (const allocation of allocations) {
      const note = notesById.get(allocation.noteId);
      if (!note) continue;
      const obligationCurrency = this.cleanCurrency(note.currency);
      const requiresFx = obligationCurrency !== paymentCurrency;
      if (requiresFx && !dto.agreedExchangeRate) {
        throw new BadRequestException(
          'Reinsurer disbursement requires agreedExchangeRate when payment currency differs from credit-note currency',
        );
      }
      if (requiresFx && !allocation.obligationAmount) {
        throw new BadRequestException(
          'Reinsurer disbursement requires obligationAmount when payment currency differs from credit-note currency',
        );
      }
      const allocatedAmount = new Prisma.Decimal(allocation.allocatedAmount);
      const obligationAmount = new Prisma.Decimal(
        allocation.obligationAmount ?? allocation.allocatedAmount,
      );
      allocatedTotal = allocatedTotal.plus(allocatedAmount);
      allocationCreates.push({
        tenantId,
        placementId,
        noteId: allocation.noteId,
        allocatedAmount,
        allocatedCurrency: paymentCurrency,
        obligationAmount,
        obligationCurrency,
        agreedExchangeRate: requiresFx
          ? new Prisma.Decimal(dto.agreedExchangeRate as number)
          : dto.agreedExchangeRate
            ? new Prisma.Decimal(dto.agreedExchangeRate)
            : null,
        createdByUserId: userId,
      });
    }

    if (!allocatedTotal.equals(new Prisma.Decimal(dto.amount))) {
      throw new BadRequestException(
        'Reinsurer disbursement allocated amounts must equal the payment amount; unallocated payments are not supported',
      );
    }

    return allocationCreates;
  }

  private cleanCurrency(value: string): string {
    return value.trim().toUpperCase();
  }

  private cleanOptional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private appendConfirmationNotes(
    existing: string | null,
    notes: string | undefined,
  ): string | null {
    const cleaned = this.cleanOptional(notes);
    if (!cleaned) return existing;
    const confirmationNote = `Bank confirmation: ${cleaned}`;
    return existing ? `${existing}\n${confirmationNote}` : confirmationNote;
  }

  private decimalToNumber(
    value: Prisma.Decimal | number | string | null,
  ): number {
    if (value === null) return 0;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private optionalDecimalToNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
