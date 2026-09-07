import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FinancialPositionState,
  PlacementFinancialPositionAdjustmentDto,
  PlacementFinancialPositionResponseDto,
} from '../dto/placement-financial-position-response.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type EffectiveSnapshot = {
  participantId?: string;
  endorsementParticipantId?: string;
  originalParticipantId?: string | null;
  counterpartyId: string;
  counterpartyName: string;
  closingId: string;
  netPremium: number;
  cedantPremium: number;
  currency: string | null;
};

type ReinsurerPositionAccumulator = {
  counterpartyId: string;
  counterpartyName: string;
  originalPayable: number;
  endorsementAdjustments: number;
  adjustments: PlacementFinancialPositionAdjustmentDto[];
};

type PaymentSettlement = {
  grossRecorded: number;
  reversed: number;
  netSettled: number;
};

@Injectable()
export class PlacementFinancialPositionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async getFinancialPosition(
    tenantId: string,
    placementId: string,
    asOfDate: Date | string = new Date(),
  ): Promise<PlacementFinancialPositionResponseDto> {
    const effectiveAsOf = this.parseAsOfDate(asOfDate);

    return this.prisma.$transaction(async (tx) => {
      const placement = await tx.placement.findFirst({
        where: { id: placementId, tenantId, archivedAt: null },
        select: { id: true, currency: true },
      });
      if (!placement) throw new NotFoundException('Placement not found');

      const [originalClosings, endorsementClosings, payments] =
        await Promise.all([
          this.findOriginalClosings(tx, tenantId, placementId),
          this.findEffectiveEndorsementClosings(
            tx,
            tenantId,
            placementId,
            effectiveAsOf,
          ),
          this.findPayments(tx, tenantId, placementId, effectiveAsOf),
        ]);

      const reinsurers = new Map<string, ReinsurerPositionAccumulator>();
      const currentSnapshots: EffectiveSnapshot[] = [];
      const adjustments: PlacementFinancialPositionAdjustmentDto[] = [];
      let cedantEndorsementAdjustments = 0;
      const currencies = new Set<string>();

      for (const closing of originalClosings) {
        const netPremium = this.money.toNumber(closing.netPremium);
        const currency = this.cleanCurrencyOrNull(closing.currency);
        if (currency) currencies.add(currency);
        const snapshot: EffectiveSnapshot = {
          participantId: closing.participantId,
          counterpartyId: closing.participant.counterpartyId,
          counterpartyName: closing.participant.counterparty.name,
          closingId: closing.id,
          netPremium,
          cedantPremium: this.cedantReceivableAmount(
            closing.grossPremium,
            closing.commissionAmount,
            closing.netPremium,
          ),
          currency,
        };
        currentSnapshots.push(snapshot);

        const reinsurer = this.getReinsurerAccumulator(
          reinsurers,
          snapshot.counterpartyId,
          snapshot.counterpartyName,
        );
        reinsurer.originalPayable = this.round(
          reinsurer.originalPayable + netPremium,
        );
      }

      for (const closing of endorsementClosings) {
        const currency = this.cleanCurrencyOrNull(closing.currency);
        if (currency) currencies.add(currency);
        const snapshot: EffectiveSnapshot = {
          endorsementParticipantId: closing.endorsementParticipantId,
          originalParticipantId:
            closing.endorsementParticipant.originalParticipantId,
          counterpartyId: closing.endorsementParticipant.counterpartyId,
          counterpartyName: closing.endorsementParticipant.counterparty.name,
          closingId: closing.id,
          netPremium: this.money.toNumber(closing.netPremium),
          cedantPremium: this.cedantReceivableAmount(
            closing.premiumSnapshot,
            closing.commissionAmount,
            closing.netPremium,
          ),
          currency,
        };

        if (snapshot.originalParticipantId) {
          const previousIndex = currentSnapshots.findIndex(
            (current) =>
              current.participantId === snapshot.originalParticipantId ||
              current.originalParticipantId === snapshot.originalParticipantId,
          );
          const previous =
            previousIndex >= 0 ? currentSnapshots[previousIndex] : null;

          if (previous) {
            cedantEndorsementAdjustments = this.round(
              cedantEndorsementAdjustments +
                (snapshot.cedantPremium - previous.cedantPremium),
            );
            if (previous.counterpartyId === snapshot.counterpartyId) {
              this.addAdjustment({
                reinsurers,
                adjustments,
                counterpartyId: snapshot.counterpartyId,
                counterpartyName: snapshot.counterpartyName,
                amount: snapshot.netPremium - previous.netPremium,
                currency,
                closingId: snapshot.closingId,
                endorsementId: closing.endorsementId,
                endorsementNumber: closing.endorsement.endorsementNumber,
                effectiveDate: closing.endorsement.effectiveDate,
                originalParticipantId: snapshot.originalParticipantId,
              });
            } else {
              this.addAdjustment({
                reinsurers,
                adjustments,
                counterpartyId: previous.counterpartyId,
                counterpartyName: previous.counterpartyName,
                amount: -previous.netPremium,
                currency: previous.currency,
                closingId: snapshot.closingId,
                endorsementId: closing.endorsementId,
                endorsementNumber: closing.endorsement.endorsementNumber,
                effectiveDate: closing.endorsement.effectiveDate,
                originalParticipantId: snapshot.originalParticipantId,
              });
              this.addAdjustment({
                reinsurers,
                adjustments,
                counterpartyId: snapshot.counterpartyId,
                counterpartyName: snapshot.counterpartyName,
                amount: snapshot.netPremium,
                currency,
                closingId: snapshot.closingId,
                endorsementId: closing.endorsementId,
                endorsementNumber: closing.endorsement.endorsementNumber,
                effectiveDate: closing.endorsement.effectiveDate,
                originalParticipantId: snapshot.originalParticipantId,
              });
            }

            currentSnapshots.splice(previousIndex, 1, snapshot);
          } else {
            cedantEndorsementAdjustments = this.round(
              cedantEndorsementAdjustments + snapshot.cedantPremium,
            );
            this.addAdjustment({
              reinsurers,
              adjustments,
              counterpartyId: snapshot.counterpartyId,
              counterpartyName: snapshot.counterpartyName,
              amount: snapshot.netPremium,
              currency,
              closingId: snapshot.closingId,
              endorsementId: closing.endorsementId,
              endorsementNumber: closing.endorsement.endorsementNumber,
              effectiveDate: closing.endorsement.effectiveDate,
              originalParticipantId: snapshot.originalParticipantId,
            });
            currentSnapshots.push(snapshot);
          }
        } else {
          cedantEndorsementAdjustments = this.round(
            cedantEndorsementAdjustments + snapshot.cedantPremium,
          );
          this.addAdjustment({
            reinsurers,
            adjustments,
            counterpartyId: snapshot.counterpartyId,
            counterpartyName: snapshot.counterpartyName,
            amount: snapshot.netPremium,
            currency,
            closingId: snapshot.closingId,
            endorsementId: closing.endorsementId,
            endorsementNumber: closing.endorsement.endorsementNumber,
            effectiveDate: closing.endorsement.effectiveDate,
            originalParticipantId: null,
          });
          currentSnapshots.push(snapshot);
        }
      }

      for (const payment of payments) {
        currencies.add(this.cleanCurrency(payment.currency));
      }
      this.assertSingleCurrency(currencies);

      const currency = [...currencies][0] ?? placement.currency ?? null;
      const originalObligation = this.round(
        originalClosings.reduce(
          (total, closing) =>
            total +
            this.cedantReceivableAmount(
              closing.grossPremium,
              closing.commissionAmount,
              closing.netPremium,
            ),
          0,
        ),
      );
      const endorsementAdjustments = this.round(cedantEndorsementAdjustments);
      const currentObligation = this.round(
        originalObligation + endorsementAdjustments,
      );
      const cedantSettlement = this.calculateSettlement(payments, {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
      });

      return {
        placementId,
        asOfDate: effectiveAsOf.toISOString(),
        currency,
        isMultiCurrency: false,
        cedant: {
          originalObligation,
          endorsementAdjustments,
          currentObligation,
          received: cedantSettlement.netSettled,
          refunded: 0,
          grossRecorded: cedantSettlement.grossRecorded,
          reversed: cedantSettlement.reversed,
          netSettled: cedantSettlement.netSettled,
          outstanding: this.round(
            currentObligation - cedantSettlement.netSettled,
          ),
          position: this.positionFor(
            currentObligation - cedantSettlement.netSettled,
            'cedant',
          ),
        },
        reinsurers: [...reinsurers.values()]
          .map((reinsurer) => {
            const currentEffectivePayable = this.round(
              reinsurer.originalPayable + reinsurer.endorsementAdjustments,
            );
            const settlement = this.calculateSettlement(payments, {
              type: PlacementPaymentType.REINSURER_DISBURSEMENT,
              counterpartyId: reinsurer.counterpartyId,
            });
            const outstanding = this.round(
              currentEffectivePayable - settlement.netSettled,
            );
            return {
              counterpartyId: reinsurer.counterpartyId,
              counterpartyName: reinsurer.counterpartyName,
              originalPayable: this.round(reinsurer.originalPayable),
              endorsementAdjustments: this.round(
                reinsurer.endorsementAdjustments,
              ),
              currentEffectivePayable,
              paid: settlement.netSettled,
              refunded: 0,
              grossRecorded: settlement.grossRecorded,
              reversed: settlement.reversed,
              netSettled: settlement.netSettled,
              outstanding,
              position: this.positionFor(outstanding, 'reinsurer'),
              adjustments: reinsurer.adjustments,
            };
          })
          .sort((a, b) => a.counterpartyName.localeCompare(b.counterpartyName)),
        adjustments,
        warnings:
          originalClosings.length === 0
            ? [
                'No confirmed placement closings were found; financial position is not yet payable.',
              ]
            : [],
      };
    });
  }

  private findOriginalClosings(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ) {
    return tx.placementClosing.findMany({
      where: {
        tenantId,
        placementId,
        status: PlacementClosingStatus.CONFIRMED,
      },
      select: {
        id: true,
        participantId: true,
        grossPremium: true,
        commissionAmount: true,
        netPremium: true,
        currency: true,
        participant: {
          select: {
            counterpartyId: true,
            counterparty: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: [{ confirmedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private findEffectiveEndorsementClosings(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    asOfDate: Date,
  ) {
    return tx.placementEndorsementClosing.findMany({
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
        endorsementId: true,
        endorsementParticipantId: true,
        premiumSnapshot: true,
        commissionAmount: true,
        netPremium: true,
        currency: true,
        endorsement: {
          select: {
            endorsementNumber: true,
            effectiveDate: true,
          },
        },
        endorsementParticipant: {
          select: {
            counterpartyId: true,
            originalParticipantId: true,
            counterparty: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: [
        { endorsement: { effectiveDate: 'asc' } },
        { endorsement: { createdAt: 'asc' } },
        { endorsementId: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });
  }

  private findPayments(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    asOfDate: Date,
  ) {
    return tx.placementPayment.findMany({
      where: { tenantId, placementId, paymentDate: { lte: asOfDate } },
      select: {
        id: true,
        counterpartyId: true,
        endorsementClosingId: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        reversalOfPaymentId: true,
      },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private addAdjustment(input: {
    reinsurers: Map<string, ReinsurerPositionAccumulator>;
    adjustments: PlacementFinancialPositionAdjustmentDto[];
    counterpartyId: string;
    counterpartyName: string;
    amount: number;
    currency: string | null;
    closingId: string;
    endorsementId: string;
    endorsementNumber: string;
    effectiveDate: Date;
    originalParticipantId: string | null;
  }): void {
    const amount = this.round(input.amount);
    const adjustment: PlacementFinancialPositionAdjustmentDto = {
      sourceType: 'ENDORSEMENT_CLOSING',
      closingId: input.closingId,
      endorsementId: input.endorsementId,
      endorsementNumber: input.endorsementNumber,
      counterpartyId: input.counterpartyId,
      originalParticipantId: input.originalParticipantId,
      amount,
      currency: input.currency ?? 'UNKNOWN',
      effectiveDate: input.effectiveDate.toISOString(),
    };

    input.adjustments.push(adjustment);
    const reinsurer = this.getReinsurerAccumulator(
      input.reinsurers,
      input.counterpartyId,
      input.counterpartyName,
    );
    reinsurer.endorsementAdjustments = this.round(
      reinsurer.endorsementAdjustments + amount,
    );
    reinsurer.adjustments.push(adjustment);
  }

  private getReinsurerAccumulator(
    reinsurers: Map<string, ReinsurerPositionAccumulator>,
    counterpartyId: string,
    counterpartyName: string,
  ): ReinsurerPositionAccumulator {
    const existing = reinsurers.get(counterpartyId);
    if (existing) return existing;
    const created = {
      counterpartyId,
      counterpartyName,
      originalPayable: 0,
      endorsementAdjustments: 0,
      adjustments: [],
    };
    reinsurers.set(counterpartyId, created);
    return created;
  }

  private calculateSettlement(
    payments: Array<{
      counterpartyId: string;
      type: PlacementPaymentType;
      amount: Prisma.Decimal;
      status: PlacementPaymentStatus;
      reversalOfPaymentId: string | null;
    }>,
    filter: { type: PlacementPaymentType; counterpartyId?: string },
  ): PaymentSettlement {
    const relevant = payments.filter(
      (payment) =>
        payment.type === filter.type &&
        (!filter.counterpartyId ||
          payment.counterpartyId === filter.counterpartyId),
    );
    const originalRows = relevant.filter(
      (payment) => payment.reversalOfPaymentId === null,
    );
    const grossRecorded = this.round(
      originalRows.reduce(
        (total, payment) => total + this.money.toNumber(payment.amount),
        0,
      ),
    );
    const reversed = this.round(
      originalRows
        .filter((payment) => payment.status === PlacementPaymentStatus.REVERSED)
        .reduce(
          (total, payment) => total + this.money.toNumber(payment.amount),
          0,
        ),
    );
    const netSettled = this.round(
      originalRows
        .filter(
          (payment) => payment.status === PlacementPaymentStatus.BANK_CONFIRMED,
        )
        .reduce(
          (total, payment) => total + this.money.toNumber(payment.amount),
          0,
        ),
    );

    return { grossRecorded, reversed, netSettled };
  }

  private assertSingleCurrency(currencies: Set<string>): void {
    const realCurrencies = [...currencies].filter(
      (currency) => currency !== 'UNKNOWN',
    );
    if (realCurrencies.length > 1) {
      throw new ConflictException(
        'Financial position contains multiple currencies and cannot be aggregated safely.',
      );
    }
  }

  private cleanCurrency(value: string): string {
    return value.trim().toUpperCase();
  }

  private cleanCurrencyOrNull(value: string | null): string | null {
    const cleaned = value?.trim().toUpperCase();
    return cleaned || null;
  }

  /**
   * Cedant premium receipts settle the same amount billed by the placement
   * debit note: gross premium less cedant commission. Brokerage is a separate
   * broker/reinsurer-side deduction and must not reduce the cedant receivable.
   * Fall back to netPremium for historic snapshots that predate gross/commission
   * fields so existing tenant history remains readable.
   */
  private cedantReceivableAmount(
    grossPremium: Prisma.Decimal | number | string | null | undefined,
    commissionAmount: Prisma.Decimal | number | string | null | undefined,
    netPremium: Prisma.Decimal | number | string | null | undefined,
  ) {
    if (grossPremium === null || grossPremium === undefined) {
      return this.money.toNumber(netPremium);
    }
    return this.round(
      this.money.toNumber(grossPremium) - this.money.toNumber(commissionAmount),
    );
  }

  private positionFor(
    outstanding: number,
    side: 'cedant' | 'reinsurer',
  ): FinancialPositionState {
    if (Math.abs(outstanding) <= 0.0001) return 'SETTLED';
    if (outstanding < 0) return 'CREDIT_BALANCE';
    return side === 'cedant' ? 'RECEIVABLE' : 'PAYABLE';
  }

  private parseAsOfDate(value: Date | string): Date {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid financial position asOfDate');
    }
    return date;
  }

  private round(value: number): number {
    return this.money.roundMoney(value);
  }
}
