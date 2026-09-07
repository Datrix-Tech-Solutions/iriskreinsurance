import { Injectable } from '@nestjs/common';
import {
  PlacementClaimCashCallStatus,
  PlacementClaimAllocationStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimStatus,
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementNoteStatus,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReinsuranceDashboardCashCallCountsDto,
  ReinsuranceDashboardClaimsResponseDto,
  ReinsuranceDashboardCurrencyBreakdownDto,
  ReinsuranceDashboardFinancialsResponseDto,
  ReinsuranceDashboardNoteCountsDto,
  ReinsuranceDashboardOverviewResponseDto,
  ReinsuranceDashboardPlacementsResponseDto,
} from './dashboard-response.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { QueryDashboardClaimsDto } from './query-dashboard-claims.dto';

type CurrencyAmountMap = Map<string, number>;

@Injectable()
export class ReinsuranceDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async getOverview(
    tenantId: string,
  ): Promise<ReinsuranceDashboardOverviewResponseDto> {
    const [
      activePlacements,
      closedPlacements,
      lockedPlacementRows,
      endorsementsPending,
      claimsOpen,
    ] = await Promise.all([
      this.prisma.placement.count({
        where: {
          tenantId,
          archivedAt: null,
          status: {
            notIn: [PlacementStatus.CLOSED, PlacementStatus.CANCELLED],
          },
        },
      }),
      this.prisma.placement.count({
        where: { tenantId, archivedAt: null, status: PlacementStatus.CLOSED },
      }),
      this.prisma.placementPayment.findMany({
        where: { tenantId, placement: { archivedAt: null } },
        distinct: ['placementId'],
        select: { placementId: true },
      }),
      this.prisma.placementEndorsement.count({
        where: {
          tenantId,
          placement: { archivedAt: null },
          status: {
            notIn: [
              PlacementEndorsementStatus.CLOSED,
              PlacementEndorsementStatus.DECLINED,
              PlacementEndorsementStatus.VOID,
            ],
          },
        },
      }),
      this.prisma.placementClaim.count({
        where: {
          tenantId,
          placement: { archivedAt: null },
          status: {
            notIn: [
              PlacementClaimStatus.SETTLED,
              PlacementClaimStatus.CLOSED,
              PlacementClaimStatus.DECLINED,
              PlacementClaimStatus.VOID,
            ],
          },
        },
      }),
    ]);

    return {
      activePlacements,
      closedPlacements,
      lockedPlacements: lockedPlacementRows.length,
      endorsementsPending,
      claimsOpen,
      warnings: [
        'lockedPlacements is derived from payment activity because payments are the hard financial lock source.',
      ],
    };
  }

  async getPlacements(
    tenantId: string,
  ): Promise<ReinsuranceDashboardPlacementsResponseDto> {
    const [
      placementTargets,
      confirmedPlacementClosings,
      confirmedEndorsementClosings,
    ] = await Promise.all([
      this.prisma.placement.findMany({
        where: { tenantId, archivedAt: null },
        select: { facultativeOffer: true },
      }),
      this.prisma.placementClosing.findMany({
        where: {
          tenantId,
          status: PlacementClosingStatus.CONFIRMED,
          placement: { archivedAt: null },
        },
        select: { signedLinePercent: true },
      }),
      this.prisma.placementEndorsementClosing.findMany({
        where: {
          tenantId,
          status: PlacementClosingStatus.CONFIRMED,
          placement: { archivedAt: null },
          endorsement: {
            status: { not: PlacementEndorsementStatus.VOID },
          },
        },
        select: { signedLinePercent: true },
      }),
    ]);

    const totalCapacity = this.roundPercent(
      placementTargets.reduce(
        (sum, item) => sum + this.money.toNumber(item.facultativeOffer),
        0,
      ),
    );
    const confirmedClosingCapacity = this.roundPercent(
      confirmedPlacementClosings.reduce(
        (sum, item) => sum + this.money.toNumber(item.signedLinePercent),
        0,
      ) +
        confirmedEndorsementClosings.reduce(
          (sum, item) => sum + this.money.toNumber(item.signedLinePercent),
          0,
        ),
    );
    const placementsMissingTarget = placementTargets.filter(
      (item) => item.facultativeOffer === null,
    ).length;

    const warnings: string[] = [];
    if (placementsMissingTarget > 0) {
      warnings.push(
        'Some placements do not have facultativeOffer set, so total and pending capacity may be understated.',
      );
    }

    return {
      placementCount: placementTargets.length,
      totalCapacity,
      acceptedCapacity: confirmedClosingCapacity,
      pendingCapacity: this.roundPercent(
        Math.max(0, totalCapacity - confirmedClosingCapacity),
      ),
      confirmedClosingCapacity,
      placementsMissingTarget,
      warnings,
    };
  }

  async getFinancials(
    tenantId: string,
  ): Promise<ReinsuranceDashboardFinancialsResponseDto> {
    const [
      confirmedPlacementClosings,
      confirmedEndorsementClosings,
      payments,
      notes,
    ] = await Promise.all([
      this.prisma.placementClosing.findMany({
        where: {
          tenantId,
          status: PlacementClosingStatus.CONFIRMED,
          placement: { archivedAt: null },
        },
        select: {
          grossPremium: true,
          netPremium: true,
          brokerageAmount: true,
          commissionAmount: true,
          currency: true,
        },
      }),
      this.prisma.placementEndorsementClosing.findMany({
        where: {
          tenantId,
          status: PlacementClosingStatus.CONFIRMED,
          placement: { archivedAt: null },
          endorsement: {
            status: { not: PlacementEndorsementStatus.VOID },
          },
        },
        select: {
          premiumSnapshot: true,
          netPremium: true,
          brokerageAmount: true,
          commissionAmount: true,
          currency: true,
        },
      }),
      this.prisma.placementPayment.findMany({
        where: {
          tenantId,
          status: PlacementPaymentStatus.RECORDED,
          type: PlacementPaymentType.PREMIUM_RECEIVED,
          placement: { archivedAt: null },
        },
        select: { amount: true, currency: true },
      }),
      this.prisma.placementNote.findMany({
        where: { tenantId, placement: { archivedAt: null } },
        select: { status: true },
      }),
    ]);

    const grossPremiumByCurrency = new Map<string, number>();
    const netPremiumByCurrency = new Map<string, number>();
    const paidByCurrency = new Map<string, number>();
    const outstandingByCurrency = new Map<string, number>();

    let grossPremium = 0;
    let netPremium = 0;
    let brokerage = 0;
    let commission = 0;
    let paid = 0;

    for (const closing of confirmedPlacementClosings) {
      grossPremium += this.money.toNumber(closing.grossPremium);
      netPremium += this.money.toNumber(closing.netPremium);
      brokerage += this.money.toNumber(closing.brokerageAmount);
      commission += this.money.toNumber(closing.commissionAmount);
      this.addCurrencyAmount(
        grossPremiumByCurrency,
        closing.currency,
        closing.grossPremium,
      );
      this.addCurrencyAmount(
        netPremiumByCurrency,
        closing.currency,
        closing.netPremium,
      );
    }

    for (const closing of confirmedEndorsementClosings) {
      grossPremium += this.money.toNumber(closing.premiumSnapshot);
      netPremium += this.money.toNumber(closing.netPremium);
      brokerage += this.money.toNumber(closing.brokerageAmount);
      commission += this.money.toNumber(closing.commissionAmount);
      this.addCurrencyAmount(
        grossPremiumByCurrency,
        closing.currency,
        closing.premiumSnapshot,
      );
      this.addCurrencyAmount(
        netPremiumByCurrency,
        closing.currency,
        closing.netPremium,
      );
    }

    for (const payment of payments) {
      paid += this.money.toNumber(payment.amount);
      this.addCurrencyAmount(paidByCurrency, payment.currency, payment.amount);
    }

    for (const [currency, amount] of netPremiumByCurrency.entries()) {
      const currencyPaid = paidByCurrency.get(currency) ?? 0;
      outstandingByCurrency.set(
        currency,
        this.money.roundMoney(amount - currencyPaid),
      );
    }

    const noteCounts = this.countNotes(notes);
    const warnings = this.currencyWarnings([
      grossPremiumByCurrency,
      paidByCurrency,
    ]);

    return {
      grossPremium: this.money.roundMoney(grossPremium),
      netPremium: this.money.roundMoney(netPremium),
      brokerage: this.money.roundMoney(brokerage),
      commission: this.money.roundMoney(commission),
      paid: this.money.roundMoney(paid),
      outstanding: this.money.roundMoney(netPremium - paid),
      grossPremiumByCurrency: this.toCurrencyBreakdown(grossPremiumByCurrency),
      netPremiumByCurrency: this.toCurrencyBreakdown(netPremiumByCurrency),
      paidByCurrency: this.toCurrencyBreakdown(paidByCurrency),
      outstandingByCurrency: this.toCurrencyBreakdown(outstandingByCurrency),
      noteCounts,
      warnings,
    };
  }

  async getClaims(
    tenantId: string,
    query: QueryDashboardClaimsDto = {},
  ): Promise<ReinsuranceDashboardClaimsResponseDto> {
    const range = this.dateRange(query.since, query.until);
    const [claims, allocations, cashCalls, windowedClaims, recoveryReceipts] =
      await Promise.all([
        this.prisma.placementClaim.findMany({
          where: {
            tenantId,
            placement: { archivedAt: null },
            status: { not: PlacementClaimStatus.VOID },
          },
          select: {
            status: true,
            currency: true,
            estimatedLossAmount: true,
            finalLossAmount: true,
          },
        }),
        this.prisma.placementClaimAllocation.findMany({
          where: {
            tenantId,
            placement: { archivedAt: null },
            status: { not: PlacementClaimAllocationStatus.VOID },
          },
          select: {
            allocatedEstimatedLossAmount: true,
            allocatedFinalLossAmount: true,
          },
        }),
        this.prisma.placementClaimCashCall.findMany({
          where: {
            tenantId,
            placement: { archivedAt: null },
            status: { not: PlacementClaimCashCallStatus.VOID },
          },
          select: { status: true, amount: true },
        }),
        // Claims incurred, windowed by loss occurrence date.
        this.prisma.placementClaim.findMany({
          where: {
            tenantId,
            placement: { archivedAt: null },
            status: { not: PlacementClaimStatus.VOID },
            ...(range ? { occurrenceDate: range } : {}),
          },
          select: {
            currency: true,
            estimatedLossAmount: true,
            finalLossAmount: true,
          },
        }),
        // Recoveries received, windowed by bank-confirmation date.
        this.prisma.placementClaimRecoveryReceipt.findMany({
          where: {
            tenantId,
            placement: { archivedAt: null },
            claim: { status: { not: PlacementClaimStatus.VOID } },
            status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
            ...(range ? { bankConfirmedAt: range } : {}),
          },
          select: { currency: true, amount: true, reversalOfReceiptId: true },
        }),
      ]);

    const estimatedLoss = claims.reduce(
      (sum, claim) => sum + this.money.toNumber(claim.estimatedLossAmount),
      0,
    );
    const finalLoss = claims.reduce(
      (sum, claim) => sum + this.money.toNumber(claim.finalLossAmount),
      0,
    );
    const allocatedLiability = allocations.reduce((sum, allocation) => {
      const amount =
        allocation.allocatedFinalLossAmount ??
        allocation.allocatedEstimatedLossAmount;
      return sum + this.money.toNumber(amount);
    }, 0);

    const claimsIncurredByCurrency = new Map<string, number>();
    for (const claim of windowedClaims) {
      this.addCurrencyAmount(
        claimsIncurredByCurrency,
        claim.currency,
        claim.finalLossAmount ?? claim.estimatedLossAmount,
      );
    }

    const recoveriesByCurrency = new Map<string, number>();
    for (const receipt of recoveryReceipts) {
      // Reversal rows carry positive amounts; subtract them, add originals.
      const signedAmount =
        this.money.toNumber(receipt.amount) *
        (receipt.reversalOfReceiptId ? -1 : 1);
      this.addCurrencyAmount(
        recoveriesByCurrency,
        receipt.currency,
        signedAmount,
      );
    }

    const cashCallCounts: ReinsuranceDashboardCashCallCountsDto = {
      draft: 0,
      issued: 0,
      paid: 0,
    };
    let cashCallsIssued = 0;
    let cashCallsPaid = 0;
    for (const cashCall of cashCalls) {
      if (cashCall.status === PlacementClaimCashCallStatus.DRAFT) {
        cashCallCounts.draft += 1;
      }
      if (cashCall.status === PlacementClaimCashCallStatus.ISSUED) {
        cashCallCounts.issued += 1;
        cashCallsIssued += this.money.toNumber(cashCall.amount);
      }
      if (cashCall.status === PlacementClaimCashCallStatus.PAID) {
        cashCallCounts.paid += 1;
        cashCallsPaid += this.money.toNumber(cashCall.amount);
      }
    }

    const terminalClaimStatuses: PlacementClaimStatus[] = [
      PlacementClaimStatus.SETTLED,
      PlacementClaimStatus.CLOSED,
      PlacementClaimStatus.DECLINED,
      PlacementClaimStatus.VOID,
    ];
    const openClaims = claims.filter(
      (claim) => !terminalClaimStatuses.includes(claim.status),
    ).length;

    return {
      claimsCount: claims.length,
      openClaims,
      estimatedLoss: this.money.roundMoney(estimatedLoss),
      finalLoss: this.money.roundMoney(finalLoss),
      allocatedLiability: this.money.roundMoney(allocatedLiability),
      claimsIncurredByCurrency: this.toCurrencyBreakdown(
        claimsIncurredByCurrency,
      ),
      recoveriesByCurrency: this.toCurrencyBreakdown(recoveriesByCurrency),
      cashCallsIssued: this.money.roundMoney(cashCallsIssued),
      cashCallsPaid: this.money.roundMoney(cashCallsPaid),
      cashCallsPending: this.money.roundMoney(cashCallsIssued - cashCallsPaid),
      cashCallCounts,
      warnings: [
        'allocatedLiability uses allocatedFinalLossAmount when present, otherwise allocatedEstimatedLossAmount.',
        'PAID cash calls are reserved for future settlement-payment integration.',
      ],
    };
  }

  private countNotes(
    notes: Array<{ status: PlacementNoteStatus }>,
  ): ReinsuranceDashboardNoteCountsDto {
    return notes.reduce(
      (counts, note) => {
        if (note.status === PlacementNoteStatus.DRAFT) counts.draft += 1;
        if (note.status === PlacementNoteStatus.ISSUED) counts.issued += 1;
        if (note.status === PlacementNoteStatus.VOID) counts.void += 1;
        return counts;
      },
      { draft: 0, issued: 0, void: 0 },
    );
  }

  private dateRange(
    since?: string,
    until?: string,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!since && !until) return undefined;
    return {
      ...(since ? { gte: new Date(since) } : {}),
      ...(until ? { lte: new Date(until) } : {}),
    };
  }

  private addCurrencyAmount(
    values: CurrencyAmountMap,
    currency: string | null,
    amount: Prisma.Decimal | number | string | null,
  ): void {
    const key = currency ?? 'UNKNOWN';
    values.set(
      key,
      this.money.roundMoney(
        (values.get(key) ?? 0) + this.money.toNumber(amount),
      ),
    );
  }

  private toCurrencyBreakdown(
    values: CurrencyAmountMap,
  ): ReinsuranceDashboardCurrencyBreakdownDto[] {
    return [...values.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((left, right) => left.currency.localeCompare(right.currency));
  }

  private currencyWarnings(maps: CurrencyAmountMap[]): string[] {
    const currencies = new Set<string>();
    for (const map of maps) {
      for (const currency of map.keys()) currencies.add(currency);
    }
    if (currencies.size <= 1) return [];
    return [
      'Multiple currencies are present. Use the byCurrency fields for reliable financial reporting.',
    ];
  }

  private roundPercent(value: number): number {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }
}
