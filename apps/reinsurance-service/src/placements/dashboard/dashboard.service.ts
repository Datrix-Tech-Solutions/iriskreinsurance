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
  ReinsuranceDashboardBreakdownsResponseDto,
  ReinsuranceDashboardClaimsResponseDto,
  ReinsuranceDashboardCurrencyBreakdownDto,
  ReinsuranceDashboardFinancialsResponseDto,
  ReinsuranceDashboardNoteCountsDto,
  ReinsuranceDashboardOverviewResponseDto,
  ReinsuranceDashboardPlacementsResponseDto,
} from './dashboard-response.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { QueryDashboardClaimsDto } from './query-dashboard-claims.dto';
import { QueryDashboardPeriodDto } from './query-dashboard-period.dto';

type CurrencyAmountMap = Map<string, number>;
type SqlNumber = Prisma.Decimal | string | number | null;

type DashboardStatusRow = {
  status: PlacementStatus;
  count: bigint | number | string;
};

type DashboardCurrencyRow = {
  currency: string | null;
  sumInsured: SqlNumber;
  totalRisk: SqlNumber;
  grossPremium: SqlNumber;
};

type DashboardRiskClassRow = {
  id: string | null;
  name: string | null;
  placementCount: bigint | number | string;
  currency: string | null;
  premium: SqlNumber;
  sumInsured: SqlNumber;
};

type DashboardTopCounterpartyRow = {
  id: string;
  name: string;
  offerCount: bigint | number | string;
  currency: string | null;
  premium: SqlNumber;
};

type DashboardPremiumTrendRow = {
  month: Date | string;
  currency: string | null;
  amount: SqlNumber;
};

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

  async getBreakdowns(
    tenantId: string,
    query: QueryDashboardPeriodDto = {},
  ): Promise<ReinsuranceDashboardBreakdownsResponseDto> {
    const range = this.dateRange(query.since, query.until);
    const previousRange = this.previousDateRange(range);
    const trendEnd = range?.lte ?? new Date();
    const trendStart = this.monthStartOffset(trendEnd, -11);

    const [
      currentStatusRows,
      previousStatusRows,
      capacityRows,
      riskClassRows,
      topCedantRows,
      topReinsurerRows,
      premiumTrendRows,
    ] = await Promise.all([
      this.prisma.$queryRaw<DashboardStatusRow[]>(
        this.statusCountsQuery(tenantId, range),
      ),
      this.prisma.$queryRaw<DashboardStatusRow[]>(
        this.statusCountsQuery(tenantId, previousRange),
      ),
      this.prisma.$queryRaw<DashboardCurrencyRow[]>(
        this.capacityByCurrencyQuery(tenantId, range),
      ),
      this.prisma.$queryRaw<DashboardRiskClassRow[]>(
        this.riskClassBreakdownQuery(tenantId, range),
      ),
      this.prisma.$queryRaw<DashboardTopCounterpartyRow[]>(
        this.topCedantsQuery(tenantId, range),
      ),
      this.prisma.$queryRaw<DashboardTopCounterpartyRow[]>(
        this.topReinsurersQuery(tenantId, range),
      ),
      this.prisma.$queryRaw<DashboardPremiumTrendRow[]>(
        this.premiumTrendQuery(tenantId, trendStart, trendEnd),
      ),
    ]);

    const current = this.statusCounts(currentStatusRows);
    const previous = this.statusCounts(previousStatusRows);
    const totalCapacity = this.roundPercent(
      capacityRows.reduce(
        (sum, row) => sum + this.money.toNumber(row.totalRisk),
        0,
      ),
    );
    const sumInsuredByCurrency = new Map<string, number>();
    const totalRiskByCurrency = new Map<string, number>();
    const grossPremiumByCurrency = new Map<string, number>();
    for (const row of capacityRows) {
      this.addCurrencyAmount(
        sumInsuredByCurrency,
        row.currency,
        row.sumInsured,
      );
      this.addCurrencyAmount(totalRiskByCurrency, row.currency, row.totalRisk);
      this.addCurrencyAmount(
        grossPremiumByCurrency,
        row.currency,
        row.grossPremium,
      );
    }

    return {
      offers: {
        placementCount: current.total,
        totalCapacity,
        acceptedCapacity: 0,
        pendingCapacity: totalCapacity,
        confirmedClosingCapacity: 0,
        placementsMissingTarget: 0,
        placedOffers: current.placed,
        partiallyClosedOffers: current.partiallyClosed,
        closedOffers: current.closed,
        closedRate: current.closedRate,
        previous: {
          placementCount: previous.total,
          placedOffers: previous.placed,
          partiallyClosedOffers: previous.partiallyClosed,
          closedOffers: previous.closed,
          closedRate: previous.closedRate,
        },
        trends: {
          placementCount: this.pctChange(current.total, previous.total),
          placedOffers: this.pctChange(current.placed, previous.placed),
          partiallyClosedOffers: this.pctChange(
            current.partiallyClosed,
            previous.partiallyClosed,
          ),
          closedOffers: this.pctChange(current.closed, previous.closed),
          closedRate: this.pctChange(current.closedRate, previous.closedRate),
        },
        warnings: [
          'Dashboard breakdowns are windowed by placement createdAt and exclude archived placements.',
        ],
      },
      sumInsuredByCurrency: this.toCurrencyBreakdown(sumInsuredByCurrency),
      totalRiskByCurrency: this.toCurrencyBreakdown(totalRiskByCurrency),
      grossPremiumByCurrency: this.toCurrencyBreakdown(grossPremiumByCurrency),
      riskClasses: this.toNamedBreakdowns(riskClassRows),
      topCedants: this.toTopCounterparties(topCedantRows),
      topReinsurers: this.toTopCounterparties(topReinsurerRows),
      premiumTrend: this.toPremiumTrend(premiumTrendRows),
      warnings: [
        'Monetary dashboard breakdowns are grouped by source currency and are not FX-converted.',
      ],
    };
  }

  async getFinancials(
    tenantId: string,
    query: QueryDashboardPeriodDto = {},
  ): Promise<ReinsuranceDashboardFinancialsResponseDto> {
    const range = this.dateRange(query.since, query.until);
    const placementPeriodFilter = this.prismaPlacementPeriodFilter(range);
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
          placement: { archivedAt: null, ...placementPeriodFilter },
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
          placement: { archivedAt: null, ...placementPeriodFilter },
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
          status: PlacementPaymentStatus.BANK_CONFIRMED,
          type: PlacementPaymentType.PREMIUM_RECEIVED,
          placement: { archivedAt: null, ...placementPeriodFilter },
        },
        select: { amount: true, currency: true },
      }),
      this.prisma.placementNote.findMany({
        where: {
          tenantId,
          placement: { archivedAt: null, ...placementPeriodFilter },
        },
        select: { status: true },
      }),
    ]);

    const grossPremiumByCurrency = new Map<string, number>();
    const netPremiumByCurrency = new Map<string, number>();
    const brokerageByCurrency = new Map<string, number>();
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
      this.addCurrencyAmount(
        brokerageByCurrency,
        closing.currency,
        closing.brokerageAmount,
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
      this.addCurrencyAmount(
        brokerageByCurrency,
        closing.currency,
        closing.brokerageAmount,
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
      brokerageByCurrency: this.toCurrencyBreakdown(brokerageByCurrency),
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

  private prismaPlacementPeriodFilter(range?: { gte?: Date; lte?: Date }): {
    createdAt?: { gte?: Date; lte?: Date };
  } {
    if (!range?.gte && !range?.lte) return {};
    return { createdAt: range };
  }

  private sqlDatePredicate(
    range?: { gte?: Date; lte?: Date },
    column: Prisma.Sql = Prisma.sql`p."createdAt"`,
  ): Prisma.Sql {
    if (!range?.gte && !range?.lte) return Prisma.empty;
    return Prisma.sql`
      ${range.gte ? Prisma.sql`AND ${column} >= ${range.gte}` : Prisma.empty}
      ${range.lte ? Prisma.sql`AND ${column} <= ${range.lte}` : Prisma.empty}
    `;
  }

  private previousDateRange(range?: {
    gte?: Date;
    lte?: Date;
  }): { gte?: Date; lte?: Date } | undefined {
    if (!range?.gte || !range?.lte) return undefined;
    const span = range.lte.getTime() - range.gte.getTime();
    return {
      gte: new Date(range.gte.getTime() - span),
      lte: new Date(range.gte.getTime() - 1),
    };
  }

  private statusCountsQuery(
    tenantId: string,
    range?: { gte?: Date; lte?: Date },
  ): Prisma.Sql {
    return Prisma.sql`
      SELECT p."status", COUNT(*) AS "count"
      FROM "reinsurance"."Placement" p
      WHERE p."tenantId" = ${tenantId}
        AND p."archivedAt" IS NULL
        ${this.sqlDatePredicate(range)}
      GROUP BY p."status"
    `;
  }

  private capacityByCurrencyQuery(
    tenantId: string,
    range?: { gte?: Date; lte?: Date },
  ): Prisma.Sql {
    return Prisma.sql`
      SELECT
        COALESCE(p."currency", 'UNKNOWN') AS "currency",
        SUM(COALESCE(p."sumInsured", 0)) AS "sumInsured",
        SUM(
          COALESCE(p."sumInsured", 0)
          * COALESCE(p."facultativeOffer", 0)
          / 100
        ) AS "totalRisk",
        SUM(COALESCE(p."premium", 0)) AS "grossPremium"
      FROM "reinsurance"."Placement" p
      WHERE p."tenantId" = ${tenantId}
        AND p."archivedAt" IS NULL
        ${this.sqlDatePredicate(range)}
      GROUP BY COALESCE(p."currency", 'UNKNOWN')
    `;
  }

  private riskClassBreakdownQuery(
    tenantId: string,
    range?: { gte?: Date; lte?: Date },
  ): Prisma.Sql {
    return Prisma.sql`
      SELECT
        rc."id",
        COALESCE(rc."name", 'Unclassified') AS "name",
        COUNT(*) AS "placementCount",
        COALESCE(p."currency", 'UNKNOWN') AS "currency",
        SUM(COALESCE(p."premium", 0)) AS "premium",
        SUM(COALESCE(p."sumInsured", 0)) AS "sumInsured"
      FROM "reinsurance"."Placement" p
      LEFT JOIN "reinsurance"."risk_type" rt
        ON rt."id" = p."riskTypeId"
       AND rt."tenantId" = p."tenantId"
      LEFT JOIN "reinsurance"."risk_class" rc
        ON rc."id" = rt."riskClassId"
       AND rc."tenantId" = p."tenantId"
      WHERE p."tenantId" = ${tenantId}
        AND p."archivedAt" IS NULL
        ${this.sqlDatePredicate(range)}
      GROUP BY rc."id", COALESCE(rc."name", 'Unclassified'), COALESCE(p."currency", 'UNKNOWN')
      ORDER BY COUNT(*) DESC, COALESCE(rc."name", 'Unclassified') ASC
    `;
  }

  private topCedantsQuery(
    tenantId: string,
    range?: { gte?: Date; lte?: Date },
  ): Prisma.Sql {
    return Prisma.sql`
      WITH cedant_currency AS (
        SELECT
          c."id",
          c."name",
          COUNT(*) AS "offerCount",
          COALESCE(p."currency", 'UNKNOWN') AS "currency",
          SUM(COALESCE(p."premium", 0)) AS "premium"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = p."cedantId"
         AND c."tenantId" = p."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          ${this.sqlDatePredicate(range)}
        GROUP BY c."id", c."name", COALESCE(p."currency", 'UNKNOWN')
      ),
      cedant_totals AS (
        SELECT "id", SUM("premium") AS "totalPremium"
        FROM cedant_currency
        GROUP BY "id"
      ),
      ranked AS (
        SELECT
          cc.*,
          DENSE_RANK() OVER (
            ORDER BY ct."totalPremium" DESC, cc."name" ASC
          ) AS rank
        FROM cedant_currency cc
        JOIN cedant_totals ct ON ct."id" = cc."id"
      )
      SELECT "id", "name", "offerCount", "currency", "premium"
      FROM ranked
      WHERE rank <= 5
      ORDER BY rank ASC, "name" ASC, "currency" ASC
    `;
  }

  private topReinsurersQuery(
    tenantId: string,
    range?: { gte?: Date; lte?: Date },
  ): Prisma.Sql {
    return Prisma.sql`
      WITH reinsurer_currency AS (
        SELECT
          c."id",
          c."name",
          COUNT(*) AS "offerCount",
          COALESCE(p."currency", 'UNKNOWN') AS "currency",
          SUM(
            COALESCE(p."premium", 0)
            * COALESCE(pp."sharePercent", pp."signedLinePercent", 0)
            / 100
          ) AS "premium"
        FROM "reinsurance"."Placement" p
        JOIN "reinsurance"."PlacementParticipant" pp
          ON pp."placementId" = p."id"
         AND pp."tenantId" = p."tenantId"
        JOIN "reinsurance"."Counterparty" c
          ON c."id" = pp."counterpartyId"
         AND c."tenantId" = pp."tenantId"
        WHERE p."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          AND pp."role" IN ('REINSURER', 'LEAD_REINSURER', 'CO_REINSURER')
          AND pp."status" IN ('ACCEPTED', 'CLOSED')
          ${this.sqlDatePredicate(range)}
        GROUP BY c."id", c."name", COALESCE(p."currency", 'UNKNOWN')
      ),
      reinsurer_totals AS (
        SELECT "id", SUM("premium") AS "totalPremium"
        FROM reinsurer_currency
        GROUP BY "id"
      ),
      ranked AS (
        SELECT
          rc.*,
          DENSE_RANK() OVER (
            ORDER BY rt."totalPremium" DESC, rc."name" ASC
          ) AS rank
        FROM reinsurer_currency rc
        JOIN reinsurer_totals rt ON rt."id" = rc."id"
      )
      SELECT "id", "name", "offerCount", "currency", "premium"
      FROM ranked
      WHERE rank <= 5
      ORDER BY rank ASC, "name" ASC, "currency" ASC
    `;
  }

  private premiumTrendQuery(
    tenantId: string,
    since: Date,
    until: Date,
  ): Prisma.Sql {
    return Prisma.sql`
      SELECT
        DATE_TRUNC('month', p."createdAt") AS "month",
        COALESCE(p."currency", 'UNKNOWN') AS "currency",
        SUM(COALESCE(p."premium", 0)) AS "amount"
      FROM "reinsurance"."Placement" p
      WHERE p."tenantId" = ${tenantId}
        AND p."archivedAt" IS NULL
        AND p."createdAt" >= ${since}
        AND p."createdAt" <= ${until}
      GROUP BY DATE_TRUNC('month', p."createdAt"), COALESCE(p."currency", 'UNKNOWN')
      ORDER BY DATE_TRUNC('month', p."createdAt") ASC, COALESCE(p."currency", 'UNKNOWN') ASC
    `;
  }

  private statusCounts(rows: DashboardStatusRow[]): {
    total: number;
    placed: number;
    partiallyClosed: number;
    closed: number;
    closedRate: number;
  } {
    const counts = new Map(
      rows.map((row) => [row.status, this.toInteger(row.count)]),
    );
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const closed = counts.get(PlacementStatus.CLOSED) ?? 0;
    return {
      total,
      placed:
        (counts.get(PlacementStatus.PARTIALLY_PLACED) ?? 0) +
        (counts.get(PlacementStatus.PLACED) ?? 0),
      partiallyClosed: counts.get(PlacementStatus.CLOSING) ?? 0,
      closed,
      closedRate: total > 0 ? (closed / total) * 100 : 0,
    };
  }

  private toNamedBreakdowns(
    rows: DashboardRiskClassRow[],
  ): ReinsuranceDashboardBreakdownsResponseDto['riskClasses'] {
    const grouped = new Map<
      string,
      {
        id: string | null;
        name: string;
        placementCount: number;
        premiumByCurrency: Map<string, number>;
        sumInsuredByCurrency: Map<string, number>;
      }
    >();

    for (const row of rows) {
      const key = row.id ?? 'unclassified';
      const existing = grouped.get(key) ?? {
        id: row.id,
        name: row.name ?? 'Unclassified',
        placementCount: 0,
        premiumByCurrency: new Map<string, number>(),
        sumInsuredByCurrency: new Map<string, number>(),
      };
      existing.placementCount += this.toInteger(row.placementCount);
      this.addCurrencyAmount(
        existing.premiumByCurrency,
        row.currency,
        row.premium,
      );
      this.addCurrencyAmount(
        existing.sumInsuredByCurrency,
        row.currency,
        row.sumInsured,
      );
      grouped.set(key, existing);
    }

    return [...grouped.values()]
      .sort(
        (left, right) =>
          right.placementCount - left.placementCount ||
          left.name.localeCompare(right.name),
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        placementCount: row.placementCount,
        premiumByCurrency: this.toCurrencyBreakdown(row.premiumByCurrency),
        sumInsuredByCurrency: this.toCurrencyBreakdown(
          row.sumInsuredByCurrency,
        ),
      }));
  }

  private toTopCounterparties(
    rows: DashboardTopCounterpartyRow[],
  ): ReinsuranceDashboardBreakdownsResponseDto['topCedants'] {
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        offerCount: number;
        totalPremiumByCurrency: Map<string, number>;
      }
    >();

    for (const row of rows) {
      const existing = grouped.get(row.id) ?? {
        id: row.id,
        name: row.name,
        offerCount: 0,
        totalPremiumByCurrency: new Map<string, number>(),
      };
      existing.offerCount += this.toInteger(row.offerCount);
      this.addCurrencyAmount(
        existing.totalPremiumByCurrency,
        row.currency,
        row.premium,
      );
      grouped.set(row.id, existing);
    }

    return [...grouped.values()]
      .sort(
        (left, right) =>
          this.currencyTotal(right.totalPremiumByCurrency) -
            this.currencyTotal(left.totalPremiumByCurrency) ||
          left.name.localeCompare(right.name),
      )
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        name: row.name,
        offerCount: row.offerCount,
        totalPremiumByCurrency: this.toCurrencyBreakdown(
          row.totalPremiumByCurrency,
        ),
      }));
  }

  private toPremiumTrend(
    rows: DashboardPremiumTrendRow[],
  ): ReinsuranceDashboardBreakdownsResponseDto['premiumTrend'] {
    const grouped = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const date = row.month instanceof Date ? row.month : new Date(row.month);
      const month = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
      ).toISOString();
      const map = grouped.get(month) ?? new Map<string, number>();
      this.addCurrencyAmount(map, row.currency, row.amount);
      grouped.set(month, map);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, amountByCurrency]) => ({
        month,
        amountByCurrency: this.toCurrencyBreakdown(amountByCurrency),
      }));
  }

  private monthStartOffset(date: Date, offset: number): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1),
    );
  }

  private currencyTotal(map: Map<string, number>): number {
    return [...map.values()].reduce((sum, amount) => sum + amount, 0);
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    const change = ((current - previous) / previous) * 100;
    return Math.min(Math.max(change, -100), 100);
  }

  private toInteger(value: bigint | number | string): number {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
    return value;
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
