import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../../prisma/generated/client';
import {
  ClaimRowBucket,
  ClaimRowStateResponseDto,
} from '../dto/claim-row-state-response.dto';
import { QueryClaimRowStateDto } from '../dto/query-claim-row-state.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type ClaimRecord = {
  id: string;
  placementId: string;
  finalLossAmount: Prisma.Decimal | null;
};

type AllocationRecord = {
  id: string;
  claimId: string;
  allocatedEstimatedLossAmount: Prisma.Decimal;
  allocatedFinalLossAmount: Prisma.Decimal | null;
};

type CashCallRecord = {
  id: string;
  claimId: string;
  allocationId: string;
  counterpartyId: string;
  currency: string;
  status: PlacementClaimCashCallStatus;
  amount: Prisma.Decimal;
};

type RecoveryReceiptRecord = {
  claimId: string;
  cashCallId: string;
  status: PlacementClaimRecoveryReceiptStatus;
  amount: Prisma.Decimal;
  bankConfirmedAt: Date | null;
  reversalOfReceiptId: string | null;
};

type RecoveryApprovalRecord = {
  allocationId: string;
  cashCallId: string | null;
  counterpartyId: string;
  currency: string;
  approvedAmount: Prisma.Decimal;
};

type CashCallPosition = {
  totalCashCalled: number;
  totalConfirmed: number;
  totalReversed: number;
  totalOutstanding: number;
  recoveredAt: string | null;
};

@Injectable()
export class ReinsuranceClaimRowStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findRowState(
    tenantId: string,
    query: QueryClaimRowStateDto,
  ): Promise<ClaimRowStateResponseDto> {
    const requestedClaimIds = [...new Set(query.claimIds ?? [])];
    if (requestedClaimIds.length === 0) return { items: [] };
    if (requestedClaimIds.length > 100) {
      throw new BadRequestException('A maximum of 100 claimIds is allowed.');
    }

    const claims = await this.prisma.placementClaim.findMany({
      where: {
        tenantId,
        id: { in: requestedClaimIds },
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        placementId: true,
        finalLossAmount: true,
      },
    });
    if (claims.length === 0) return { items: [] };

    const tenantClaimIds = claims.map((claim) => claim.id);
    const placementIds = [...new Set(claims.map((claim) => claim.placementId))];
    const [allocations, cashCalls, receipts, approvals, endorsementCounts] =
      await Promise.all([
        this.prisma.placementClaimAllocation.findMany({
          where: { tenantId, claimId: { in: tenantClaimIds } },
          select: {
            id: true,
            claimId: true,
            allocatedEstimatedLossAmount: true,
            allocatedFinalLossAmount: true,
          },
        }),
        this.prisma.placementClaimCashCall.findMany({
          where: { tenantId, claimId: { in: tenantClaimIds } },
          select: {
            id: true,
            claimId: true,
            allocationId: true,
            counterpartyId: true,
            currency: true,
            status: true,
            amount: true,
          },
        }),
        this.prisma.placementClaimRecoveryReceipt.findMany({
          where: { tenantId, claimId: { in: tenantClaimIds } },
          select: {
            claimId: true,
            cashCallId: true,
            status: true,
            amount: true,
            bankConfirmedAt: true,
            reversalOfReceiptId: true,
          },
        }),
        this.prisma.placementClaimRecoveryApproval.findMany({
          where: { tenantId, claimId: { in: tenantClaimIds } },
          select: {
            allocationId: true,
            cashCallId: true,
            counterpartyId: true,
            currency: true,
            approvedAmount: true,
          },
        }),
        this.prisma.placementEndorsement.groupBy({
          by: ['placementId'],
          where: {
            tenantId,
            placementId: { in: placementIds },
            status: { not: PlacementEndorsementStatus.VOID },
          },
          _count: { _all: true },
        }),
      ]);

    const claimById = new Map(claims.map((claim) => [claim.id, claim]));
    const allocatedByClaim = this.allocatedTotals(allocations);
    const cashCallPositions = this.cashCallPositions({
      cashCalls,
      receipts,
      approvals,
    });
    const endorsementCountByPlacement = new Map(
      endorsementCounts.map((row) => [row.placementId, row._count._all]),
    );

    return {
      items: requestedClaimIds
        .map((claimId) => claimById.get(claimId))
        .filter((claim): claim is ClaimRecord => !!claim)
        .map((claim) => {
          const totalAllocated = allocatedByClaim.get(claim.id) ?? 0;
          const position = cashCallPositions.get(claim.id) ?? {
            totalCashCalled: 0,
            totalConfirmed: 0,
            totalReversed: 0,
            totalOutstanding: 0,
            recoveredAt: null,
          };
          const bucket = this.bucketForClaim({
            claim,
            totalAllocated,
            totalCashCalled: position.totalCashCalled,
            totalOutstanding: position.totalOutstanding,
          });
          const nonVoidEndorsementCount =
            endorsementCountByPlacement.get(claim.placementId) ?? 0;

          return {
            claimId: claim.id,
            placementId: claim.placementId,
            bucket,
            recoveredAmount: this.formatMoney(
              this.round(position.totalConfirmed - position.totalReversed),
            ),
            recoveredAt: position.recoveredAt,
            isFullyRecovered: bucket === 'closed',
            nonVoidEndorsementCount,
            hasNonVoidEndorsement: nonVoidEndorsementCount > 0,
          };
        }),
    };
  }

  private allocatedTotals(allocations: AllocationRecord[]) {
    const totals = new Map<string, number>();
    for (const allocation of allocations) {
      totals.set(
        allocation.claimId,
        this.round(
          (totals.get(allocation.claimId) ?? 0) +
            this.money.toNumber(
              allocation.allocatedFinalLossAmount ??
                allocation.allocatedEstimatedLossAmount,
            ),
        ),
      );
    }
    return totals;
  }

  private cashCallPositions(input: {
    cashCalls: CashCallRecord[];
    receipts: RecoveryReceiptRecord[];
    approvals: RecoveryApprovalRecord[];
  }) {
    const receiptsByCashCall = this.groupBy(
      input.receipts,
      (row) => row.cashCallId,
    );
    const approvalsByAllocation = this.groupBy(
      input.approvals,
      (row) => row.allocationId,
    );
    const positions = new Map<string, CashCallPosition>();

    for (const cashCall of input.cashCalls) {
      const receipts = receiptsByCashCall.get(cashCall.id) ?? [];
      const approvals = approvalsByAllocation.get(cashCall.allocationId) ?? [];
      const confirmedAmount = this.round(
        receipts
          .filter(
            (receipt) =>
              receipt.status ===
                PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED &&
              !receipt.reversalOfReceiptId,
          )
          .reduce(
            (sum, receipt) => sum + this.money.toNumber(receipt.amount),
            0,
          ),
      );
      const reversedAmount = this.round(
        receipts
          .filter((receipt) => !!receipt.reversalOfReceiptId)
          .reduce(
            (sum, receipt) =>
              sum + Math.abs(this.money.toNumber(receipt.amount)),
            0,
          ),
      );
      const approvedAmount = this.approvedRecoveryAmount(cashCall, approvals);
      const outstandingAmount = Math.max(
        0,
        this.round(
          this.isRecoverableCashCallStatus(cashCall.status)
            ? approvedAmount - confirmedAmount
            : 0,
        ),
      );
      const latestConfirmedAt = this.latestConfirmedReceiptAt(receipts);
      const current = positions.get(cashCall.claimId) ?? {
        totalCashCalled: 0,
        totalConfirmed: 0,
        totalReversed: 0,
        totalOutstanding: 0,
        recoveredAt: null,
      };

      if (this.isRecoverableCashCallStatus(cashCall.status)) {
        current.totalCashCalled = this.round(
          current.totalCashCalled + this.money.toNumber(cashCall.amount),
        );
      }
      current.totalConfirmed = this.round(
        current.totalConfirmed + confirmedAmount,
      );
      current.totalReversed = this.round(
        current.totalReversed + reversedAmount,
      );
      current.totalOutstanding = this.round(
        current.totalOutstanding + outstandingAmount,
      );
      current.recoveredAt = this.maxIso(current.recoveredAt, latestConfirmedAt);
      positions.set(cashCall.claimId, current);
    }

    return positions;
  }

  private bucketForClaim(input: {
    claim: ClaimRecord;
    totalAllocated: number;
    totalCashCalled: number;
    totalOutstanding: number;
  }): ClaimRowBucket {
    if (input.claim.finalLossAmount === null) return 'notification';
    const allAllocationsCalled =
      input.totalAllocated > 0 &&
      input.totalCashCalled >= input.totalAllocated - 0.01;
    return allAllocationsCalled && input.totalOutstanding <= 0.01
      ? 'closed'
      : 'open';
  }

  private approvedRecoveryAmount(
    cashCall: CashCallRecord,
    approvals: RecoveryApprovalRecord[],
  ): number {
    const approvedAmount = approvals
      .filter(
        (approval) =>
          approval.currency === cashCall.currency &&
          approval.counterpartyId === cashCall.counterpartyId &&
          (!approval.cashCallId || approval.cashCallId === cashCall.id),
      )
      .reduce(
        (sum, approval) => sum + this.money.toNumber(approval.approvedAmount),
        0,
      );
    return approvedAmount > 0
      ? this.round(approvedAmount)
      : this.money.toNumber(cashCall.amount);
  }

  private latestConfirmedReceiptAt(
    receipts: RecoveryReceiptRecord[],
  ): string | null {
    const latest = receipts
      .filter(
        (receipt) =>
          receipt.status ===
            PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED &&
          receipt.bankConfirmedAt,
      )
      .map((receipt) => receipt.bankConfirmedAt as Date)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    return latest ? latest.toISOString() : null;
  }

  private maxIso(left: string | null, right: string | null): string | null {
    if (!left) return right;
    if (!right) return left;
    return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
  }

  private isRecoverableCashCallStatus(
    status: PlacementClaimCashCallStatus,
  ): boolean {
    return (
      status === PlacementClaimCashCallStatus.ISSUED ||
      status === PlacementClaimCashCallStatus.PAID
    );
  }

  private groupBy<T>(rows: T[], keyFor: (row: T) => string): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const row of rows) {
      const key = keyFor(row);
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
    }
    return grouped;
  }

  private formatMoney(value: number): string {
    return this.round(value).toFixed(2);
  }

  private round(value: number): number {
    return this.money.roundMoney(value);
  }
}
