import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementClaimCedantSettlementStatus,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimStatus,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PlacementClaimFinancialCloseBlocker,
  PlacementClaimFinancialCloseReadinessResponseDto,
} from '../../dto/placement-claim-financial-close-readiness-response.dto';

type AggregateResult = {
  _sum?: {
    amount?: Prisma.Decimal | null;
    approvedAmount?: Prisma.Decimal | null;
  };
  _count?: { _all?: number } | number;
};

@Injectable()
export class PlacementClaimFinancialCloseReadinessService {
  private readonly zero = new Prisma.Decimal(0);

  constructor(private readonly prisma: PrismaService) {}

  async getReadiness(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimFinancialCloseReadinessResponseDto> {
    const claim = await this.prisma.placementClaim.findFirst({
      where: {
        id: claimId,
        tenantId,
        placementId,
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        status: true,
        approvedPayableAmount: true,
      },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');

    const [
      bankConfirmedCedantSettlements,
      pendingCedantSettlements,
      approvedRecoveries,
      bankConfirmedRecoveryReceipts,
      pendingRecoveryReceipts,
    ] = await Promise.all([
      this.prisma.placementClaimCedantSettlement.aggregate({
        where: {
          tenantId,
          placementId,
          claimId,
          status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
          reversalOfSettlementId: null,
        },
        _sum: { amount: true },
      }),
      this.prisma.placementClaimCedantSettlement.aggregate({
        where: {
          tenantId,
          placementId,
          claimId,
          status: PlacementClaimCedantSettlementStatus.RECORDED,
          reversalOfSettlementId: null,
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.placementClaimRecoveryApproval.aggregate({
        where: {
          tenantId,
          placementId,
          claimId,
        },
        _sum: { approvedAmount: true },
      }),
      this.prisma.placementClaimRecoveryReceipt.aggregate({
        where: {
          tenantId,
          placementId,
          claimId,
          status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
          reversalOfReceiptId: null,
        },
        _sum: { amount: true },
      }),
      this.prisma.placementClaimRecoveryReceipt.aggregate({
        where: {
          tenantId,
          placementId,
          claimId,
          status: PlacementClaimRecoveryReceiptStatus.RECORDED,
          reversalOfReceiptId: null,
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return this.toReadiness({
      claimId: claim.id,
      currentClaimStatus: claim.status,
      approvedPayableAmount: claim.approvedPayableAmount,
      bankConfirmedSettledAmount: this.sumAmount(
        bankConfirmedCedantSettlements,
      ),
      recordedCedantSettlementAmount: this.sumAmount(pendingCedantSettlements),
      recordedCedantSettlementCount: this.count(pendingCedantSettlements),
      approvedRecoveryAmount: this.sumApprovedAmount(approvedRecoveries),
      bankConfirmedRecoveryAmount: this.sumAmount(
        bankConfirmedRecoveryReceipts,
      ),
      recordedRecoveryReceiptAmount: this.sumAmount(pendingRecoveryReceipts),
      recordedRecoveryReceiptCount: this.count(pendingRecoveryReceipts),
    });
  }

  async assertReadyForSettlementStatus(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimFinancialCloseReadinessResponseDto> {
    const readiness = await this.getReadiness(tenantId, placementId, claimId);
    if (!readiness.isFinanciallyReadyToSettle) {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        message:
          'Claim cannot be marked settled because financial close readiness checks have not passed.',
        blockers: readiness.blockers,
        readiness,
      });
    }
    return readiness;
  }

  async assertReadyForClosedStatus(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimFinancialCloseReadinessResponseDto> {
    const readiness = await this.getReadiness(tenantId, placementId, claimId);
    if (!readiness.isFinanciallyReadyToClose) {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        message:
          'Claim cannot be closed because it is not settled or financial close readiness checks have not passed.',
        blockers: readiness.blockers,
        readiness,
      });
    }
    return readiness;
  }

  private toReadiness(input: {
    claimId: string;
    currentClaimStatus: PlacementClaimStatus;
    approvedPayableAmount: Prisma.Decimal | null;
    bankConfirmedSettledAmount: Prisma.Decimal;
    recordedCedantSettlementAmount: Prisma.Decimal;
    recordedCedantSettlementCount: number;
    approvedRecoveryAmount: Prisma.Decimal;
    bankConfirmedRecoveryAmount: Prisma.Decimal;
    recordedRecoveryReceiptAmount: Prisma.Decimal;
    recordedRecoveryReceiptCount: number;
  }): PlacementClaimFinancialCloseReadinessResponseDto {
    const outstandingPayable = input.approvedPayableAmount
      ? this.maxZero(
          input.approvedPayableAmount.minus(input.bankConfirmedSettledAmount),
        )
      : this.zero;
    const outstandingRecovery = this.maxZero(
      input.approvedRecoveryAmount.minus(input.bankConfirmedRecoveryAmount),
    );
    const blockers: PlacementClaimFinancialCloseBlocker[] = [];

    if (!input.approvedPayableAmount) blockers.push('PAYABLE_NOT_APPROVED');
    if (outstandingPayable.gt(this.zero))
      blockers.push('CLAIM_PAYABLE_OUTSTANDING');
    if (outstandingRecovery.gt(this.zero))
      blockers.push('RECOVERY_OUTSTANDING');
    if (input.recordedCedantSettlementCount > 0) {
      blockers.push('CEDANT_SETTLEMENT_CONFIRMATION_PENDING');
    }
    if (input.recordedRecoveryReceiptCount > 0) {
      blockers.push('RECOVERY_RECEIPT_CONFIRMATION_PENDING');
    }

    const isPayableFullySettled =
      !!input.approvedPayableAmount && outstandingPayable.eq(this.zero);
    const areRecoveriesFullyReceived = outstandingRecovery.eq(this.zero);
    const hasPendingFinancialConfirmations =
      input.recordedCedantSettlementCount > 0 ||
      input.recordedRecoveryReceiptCount > 0;
    const isFinanciallyReadyToSettle =
      isPayableFullySettled &&
      areRecoveriesFullyReceived &&
      !hasPendingFinancialConfirmations;

    return {
      claimId: input.claimId,
      currentClaimStatus: input.currentClaimStatus,
      payable: {
        approvedPayableAmount: input.approvedPayableAmount
          ? this.format(input.approvedPayableAmount)
          : null,
        bankConfirmedSettledAmount: this.format(
          input.bankConfirmedSettledAmount,
        ),
        outstandingPayable: this.format(outstandingPayable),
      },
      recovery: {
        approvedRecoveryAmount: this.format(input.approvedRecoveryAmount),
        bankConfirmedRecoveryAmount: this.format(
          input.bankConfirmedRecoveryAmount,
        ),
        outstandingRecovery: this.format(outstandingRecovery),
      },
      pendingConfirmations: {
        recordedCedantSettlementCount: input.recordedCedantSettlementCount,
        recordedCedantSettlementAmount: this.format(
          input.recordedCedantSettlementAmount,
        ),
        recordedRecoveryReceiptCount: input.recordedRecoveryReceiptCount,
        recordedRecoveryReceiptAmount: this.format(
          input.recordedRecoveryReceiptAmount,
        ),
      },
      isPayableFullySettled,
      areRecoveriesFullyReceived,
      hasPendingFinancialConfirmations,
      isFinanciallyReadyToSettle,
      isFinanciallyReadyToClose:
        isFinanciallyReadyToSettle &&
        (input.currentClaimStatus === PlacementClaimStatus.SETTLED ||
          input.currentClaimStatus === PlacementClaimStatus.CLOSED),
      blockers,
    };
  }

  private sumAmount(result: AggregateResult): Prisma.Decimal {
    return result._sum?.amount ?? this.zero;
  }

  private sumApprovedAmount(result: AggregateResult): Prisma.Decimal {
    return result._sum?.approvedAmount ?? this.zero;
  }

  private count(result: AggregateResult): number {
    if (typeof result._count === 'number') return result._count;
    return result._count?._all ?? 0;
  }

  private maxZero(value: Prisma.Decimal): Prisma.Decimal {
    return value.lt(this.zero) ? this.zero : value;
  }

  private format(value: Prisma.Decimal): string {
    return value.toDecimalPlaces(2).toFixed(2);
  }
}
