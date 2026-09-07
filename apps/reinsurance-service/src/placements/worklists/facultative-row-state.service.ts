import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FacultativeRowPaymentStatus,
  FacultativeRowStateResponseDto,
} from '../dto/facultative-row-state-response.dto';
import { QueryFacultativeRowStateDto } from '../dto/query-facultative-row-state.dto';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type EffectiveTerms = {
  sumInsured: number | null;
  premium: number | null;
  facultativeOfferPercent: number | null;
  participantCount: number;
};

type SnapshotCandidate = {
  placementId: string;
  snapshotKey: string;
  cedantPremium: number;
  sourceRank: 0 | 1;
  effectiveDate: Date | null;
  endorsementCreatedAt: Date | null;
  endorsementId: string | null;
  createdAt: Date;
  id: string;
};

type PaymentRecord = {
  placementId: string;
  type: PlacementPaymentType;
  status: PlacementPaymentStatus;
  amount: Prisma.Decimal;
  reversalOfPaymentId: string | null;
};

@Injectable()
export class ReinsuranceFacultativeRowStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
    private readonly effectiveViewService: PlacementEffectiveViewService,
  ) {}

  async findRowState(
    tenantId: string,
    query: QueryFacultativeRowStateDto,
  ): Promise<FacultativeRowStateResponseDto> {
    const requestedPlacementIds = [...new Set(query.placementIds ?? [])];
    if (requestedPlacementIds.length === 0) return { items: [] };
    if (requestedPlacementIds.length > 100) {
      throw new BadRequestException(
        'A maximum of 100 placementIds is allowed.',
      );
    }

    const placements = await this.prisma.placement.findMany({
      where: {
        tenantId,
        archivedAt: null,
        id: { in: requestedPlacementIds },
      },
      select: {
        id: true,
        sumInsured: true,
        premium: true,
        facultativeOffer: true,
      },
    });
    const tenantPlacementIds = placements.map((placement) => placement.id);
    if (tenantPlacementIds.length === 0) return { items: [] };

    const baseTermsById = new Map<string, EffectiveTerms>(
      placements.map((placement) => [
        placement.id,
        {
          sumInsured: this.money.toOptionalNumber(placement.sumInsured),
          premium: this.money.toOptionalNumber(placement.premium),
          facultativeOfferPercent: this.money.toOptionalNumber(
            placement.facultativeOffer,
          ),
          participantCount: 0,
        },
      ]),
    );

    const [originalClosings, endorsementClosings, payments, endorsementCounts] =
      await Promise.all([
        this.prisma.placementClosing.findMany({
          where: {
            tenantId,
            placementId: { in: tenantPlacementIds },
            status: PlacementClosingStatus.CONFIRMED,
          },
          select: {
            id: true,
            placementId: true,
            participantId: true,
            grossPremium: true,
            commissionAmount: true,
            netPremium: true,
            createdAt: true,
          },
        }),
        this.prisma.placementEndorsementClosing.findMany({
          where: {
            tenantId,
            placementId: { in: tenantPlacementIds },
            status: PlacementClosingStatus.CONFIRMED,
            endorsement: {
              tenantId,
              status: PlacementEndorsementStatus.CLOSED,
              effectiveDate: { lte: new Date() },
            },
          },
          select: {
            id: true,
            placementId: true,
            endorsementParticipantId: true,
            premiumSnapshot: true,
            commissionAmount: true,
            netPremium: true,
            createdAt: true,
            endorsementId: true,
            endorsement: {
              select: {
                effectiveDate: true,
                createdAt: true,
              },
            },
            endorsementParticipant: {
              select: {
                originalParticipantId: true,
              },
            },
          },
        }),
        this.prisma.placementPayment.findMany({
          where: {
            tenantId,
            placementId: { in: tenantPlacementIds },
          },
          select: {
            placementId: true,
            type: true,
            status: true,
            amount: true,
            reversalOfPaymentId: true,
          },
        }),
        this.prisma.placementEndorsement.groupBy({
          by: ['placementId'],
          where: {
            tenantId,
            placementId: { in: tenantPlacementIds },
            status: { not: PlacementEndorsementStatus.VOID },
          },
          _count: { _all: true },
        }),
      ]);

    const currentObligationByPlacement = this.currentObligations([
      ...originalClosings.map(
        (closing): SnapshotCandidate => ({
          placementId: closing.placementId,
          snapshotKey: closing.participantId,
          cedantPremium: this.cedantReceivableAmount(
            closing.grossPremium,
            closing.commissionAmount,
            closing.netPremium,
          ),
          sourceRank: 0,
          effectiveDate: null,
          endorsementCreatedAt: null,
          endorsementId: null,
          createdAt: closing.createdAt,
          id: closing.id,
        }),
      ),
      ...endorsementClosings.map(
        (closing): SnapshotCandidate => ({
          placementId: closing.placementId,
          snapshotKey:
            closing.endorsementParticipant.originalParticipantId ??
            closing.endorsementParticipantId,
          cedantPremium: this.cedantReceivableAmount(
            closing.premiumSnapshot,
            closing.commissionAmount,
            closing.netPremium,
          ),
          sourceRank: 1,
          effectiveDate: closing.endorsement.effectiveDate,
          endorsementCreatedAt: closing.endorsement.createdAt,
          endorsementId: closing.endorsementId,
          createdAt: closing.createdAt,
          id: closing.id,
        }),
      ),
    ]);
    const paymentTotals = this.paymentTotals(payments);
    const endorsementCountByPlacement = new Map(
      endorsementCounts.map((row) => [row.placementId, row._count._all]),
    );

    // Base participant count = distinct participants across a placement's confirmed
    // original closings. Used as the fallback whenever no endorsement rewrites the view.
    const baseParticipantsByPlacement = new Map<string, Set<string>>();
    for (const closing of originalClosings) {
      const participants =
        baseParticipantsByPlacement.get(closing.placementId) ??
        new Set<string>();
      participants.add(closing.participantId);
      baseParticipantsByPlacement.set(closing.placementId, participants);
    }
    for (const [placementId, participants] of baseParticipantsByPlacement) {
      const baseTerms = baseTermsById.get(placementId);
      if (baseTerms) baseTerms.participantCount = participants.size;
    }

    // Only endorsed placements can diverge from their base terms — resolve the canonical
    // effective view for those so the table never disagrees with the placement detail page.
    // Placements without a non-void endorsement fall back to their base terms below.
    const endorsedPlacementIds = tenantPlacementIds.filter(
      (placementId) => (endorsementCountByPlacement.get(placementId) ?? 0) > 0,
    );
    const effectiveTermsByPlacement = new Map<string, EffectiveTerms>();
    await Promise.all(
      endorsedPlacementIds.map(async (placementId) => {
        try {
          const view = await this.effectiveViewService.getEffectiveView(
            tenantId,
            placementId,
          );
          effectiveTermsByPlacement.set(placementId, {
            sumInsured: view.effectiveTotals.sumInsured,
            premium: view.effectiveTotals.premium,
            facultativeOfferPercent:
              view.effectiveTotals.facultativeOfferPercent,
            participantCount: view.effectiveTotals.participantCount,
          });
        } catch {
          // Leave this placement to fall back to base terms rather than fail the worklist.
        }
      }),
    );

    const tenantPlacementIdSet = new Set(tenantPlacementIds);
    return {
      items: requestedPlacementIds
        .filter((placementId) => tenantPlacementIdSet.has(placementId))
        .map((placementId) => {
          const currentObligation =
            currentObligationByPlacement.get(placementId) ?? 0;
          const totals = paymentTotals.get(placementId) ?? {
            paidAmount: 0,
            pendingAmount: 0,
            hasRecordedPayment: false,
          };
          const paymentStatus = this.paymentStatus({
            currentObligation,
            paidAmount: totals.paidAmount,
            pendingAmount: totals.pendingAmount,
          });
          const nonVoidEndorsementCount =
            endorsementCountByPlacement.get(placementId) ?? 0;

          const baseTerms: EffectiveTerms = baseTermsById.get(placementId) ?? {
            sumInsured: null,
            premium: null,
            facultativeOfferPercent: null,
            participantCount: 0,
          };
          const effectiveTerms =
            effectiveTermsByPlacement.get(placementId) ?? baseTerms;

          return {
            placementId,
            paymentStatus,
            hasRecordedPayment: totals.hasRecordedPayment,
            nonVoidEndorsementCount,
            hasNonVoidEndorsement: nonVoidEndorsementCount > 0,
            effectiveSumInsured:
              effectiveTerms.sumInsured ?? baseTerms.sumInsured,
            effectivePremium: effectiveTerms.premium ?? baseTerms.premium,
            effectiveFacultativeOfferPercent:
              effectiveTerms.facultativeOfferPercent ??
              baseTerms.facultativeOfferPercent,
            effectiveParticipantCount: effectiveTerms.participantCount,
          };
        }),
    };
  }

  private currentObligations(candidates: SnapshotCandidate[]) {
    const selectedByPlacementAndKey = new Map<string, SnapshotCandidate>();
    for (const candidate of candidates) {
      const key = `${candidate.placementId}:${candidate.snapshotKey}`;
      const existing = selectedByPlacementAndKey.get(key);
      if (!existing || this.compareSnapshots(candidate, existing) < 0) {
        selectedByPlacementAndKey.set(key, candidate);
      }
    }

    const totals = new Map<string, number>();
    for (const snapshot of selectedByPlacementAndKey.values()) {
      totals.set(
        snapshot.placementId,
        this.round(
          (totals.get(snapshot.placementId) ?? 0) + snapshot.cedantPremium,
        ),
      );
    }
    return totals;
  }

  private paymentTotals(payments: PaymentRecord[]) {
    const totals = new Map<
      string,
      { paidAmount: number; pendingAmount: number; hasRecordedPayment: boolean }
    >();
    for (const payment of payments) {
      const current = totals.get(payment.placementId) ?? {
        paidAmount: 0,
        pendingAmount: 0,
        hasRecordedPayment: false,
      };

      if (payment.status === PlacementPaymentStatus.RECORDED) {
        current.hasRecordedPayment = true;
      }

      if (
        payment.type === PlacementPaymentType.PREMIUM_RECEIVED &&
        payment.reversalOfPaymentId === null
      ) {
        if (payment.status === PlacementPaymentStatus.BANK_CONFIRMED) {
          current.paidAmount = this.round(
            current.paidAmount + this.money.toNumber(payment.amount),
          );
        }
        if (payment.status === PlacementPaymentStatus.RECORDED) {
          current.pendingAmount = this.round(
            current.pendingAmount + this.money.toNumber(payment.amount),
          );
        }
      }

      totals.set(payment.placementId, current);
    }
    return totals;
  }

  private paymentStatus(input: {
    currentObligation: number;
    paidAmount: number;
    pendingAmount: number;
  }): FacultativeRowPaymentStatus {
    const outstanding = this.round(input.currentObligation - input.paidAmount);
    if (input.currentObligation > 0 && outstanding <= 0.0001) return 'Paid';
    if (input.paidAmount > 0) return 'Part Payment';
    if (input.pendingAmount > 0.0001) return 'Pending';
    return 'Outstanding';
  }

  private compareSnapshots(
    left: SnapshotCandidate,
    right: SnapshotCandidate,
  ): number {
    return (
      right.sourceRank - left.sourceRank ||
      this.compareDatesDesc(left.effectiveDate, right.effectiveDate) ||
      this.compareDatesDesc(
        left.endorsementCreatedAt,
        right.endorsementCreatedAt,
      ) ||
      this.compareStringsDesc(left.endorsementId, right.endorsementId) ||
      this.compareDatesDesc(left.createdAt, right.createdAt) ||
      this.compareStringsDesc(left.id, right.id)
    );
  }

  private compareDatesDesc(left: Date | null, right: Date | null): number {
    const leftValue = left?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightValue = right?.getTime() ?? Number.NEGATIVE_INFINITY;
    return rightValue - leftValue;
  }

  private compareStringsDesc(
    left: string | null,
    right: string | null,
  ): number {
    return (right ?? '').localeCompare(left ?? '');
  }

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

  private round(value: number): number {
    return this.money.roundMoney(value);
  }
}
