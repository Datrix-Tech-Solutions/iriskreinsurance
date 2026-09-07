import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementClaimAllocationStatus,
  PlacementClaimStatus,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApprovePlacementClaimRecoveryDto } from '../../dto/approve-placement-claim-recovery.dto';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

const recoveryApprovalInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
} satisfies Prisma.PlacementClaimRecoveryApprovalInclude;

const allocationInclude = {
  claim: {
    select: {
      id: true,
      placementId: true,
      status: true,
      currency: true,
      finalizedAt: true,
      voidedAt: true,
      closedAt: true,
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
} satisfies Prisma.PlacementClaimAllocationInclude;

type RecoveryApprovalRecord = Prisma.PlacementClaimRecoveryApprovalGetPayload<{
  include: typeof recoveryApprovalInclude;
}>;

type ClaimAllocationRecord = Prisma.PlacementClaimAllocationGetPayload<{
  include: typeof allocationInclude;
}>;

@Injectable()
export class PlacementClaimRecoveryApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<RecoveryApprovalRecord[]> {
    await this.assertPlacementClaim(tenantId, placementId, claimId);
    return this.prisma.placementClaimRecoveryApproval.findMany({
      where: { tenantId, placementId, claimId },
      include: recoveryApprovalInclude,
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async approve(
    user: RequestUser,
    placementId: string,
    claimId: string,
    allocationId: string,
    dto: ApprovePlacementClaimRecoveryDto,
  ): Promise<RecoveryApprovalRecord> {
    const approvedAmount = this.money.roundMoney(dto.approvedAmount);
    const dtoCurrency = dto.currency ? this.cleanCurrency(dto.currency) : null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const allocation = await this.findAllocation(
              tx,
              user.tenantId,
              placementId,
              claimId,
              allocationId,
            );
            this.assertAllocationCanBeApproved(allocation);

            const currency = dtoCurrency ?? allocation.claim.currency;
            if (currency !== allocation.claim.currency) {
              throw new BadRequestException(
                'Recovery approval currency must match the claim currency',
              );
            }

            if (dto.cashCallId) {
              await this.assertCashCallBelongsToAllocation(
                tx,
                user.tenantId,
                placementId,
                claimId,
                allocationId,
                dto.cashCallId,
                currency,
              );
            }

            const eligibleAmount = this.recoveryEligibleAmount(allocation);
            if (eligibleAmount <= 0) {
              throw new BadRequestException(
                'Claim allocation has no positive recovery amount to approve',
              );
            }

            const existingApprovals =
              await tx.placementClaimRecoveryApproval.findMany({
                where: {
                  tenantId: user.tenantId,
                  placementId,
                  claimId,
                  allocationId,
                },
                orderBy: { approvalVersion: 'desc' },
              });
            const previouslyApproved = this.money.roundMoney(
              existingApprovals.reduce(
                (sum, approval) =>
                  sum + this.money.toNumber(approval.approvedAmount),
                0,
              ),
            );
            const totalApproved = this.money.roundMoney(
              previouslyApproved + approvedAmount,
            );
            if (totalApproved > eligibleAmount) {
              throw new ConflictException(
                'Recovery approval amount cannot exceed the allocation outstanding approval balance',
              );
            }

            const approvalVersion =
              (existingApprovals[0]?.approvalVersion ?? 0) + 1;
            const approvedAt = new Date();
            return tx.placementClaimRecoveryApproval.create({
              data: {
                tenantId: user.tenantId,
                placementId: allocation.placementId,
                claimId: allocation.claimId,
                allocationId: allocation.id,
                cashCallId: dto.cashCallId ?? null,
                counterpartyId: allocation.counterpartyId,
                approvalVersion,
                approvedAmount,
                eligibleAmount,
                currency,
                approvedAt,
                approvedByUserId: user.id,
                reference: this.cleanOptional(dto.reference),
                notes: this.cleanOptional(dto.notes),
              },
              include: recoveryApprovalInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Could not approve claim recovery');
  }

  private async assertPlacementClaim(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<void> {
    const claim = await this.prisma.placementClaim.findFirst({
      where: {
        id: claimId,
        tenantId,
        placementId,
        placement: { archivedAt: null },
      },
      select: { id: true },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');
  }

  private async findAllocation(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
    allocationId: string,
  ): Promise<ClaimAllocationRecord> {
    const placement = await prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const allocation = await prisma.placementClaimAllocation.findFirst({
      where: {
        id: allocationId,
        tenantId,
        placementId,
        claimId,
      },
      include: allocationInclude,
    });
    if (!allocation) {
      throw new NotFoundException('Placement claim allocation not found');
    }
    return allocation;
  }

  private assertAllocationCanBeApproved(
    allocation: ClaimAllocationRecord,
  ): void {
    if (allocation.claim.voidedAt) {
      throw new BadRequestException('Voided claims cannot be approved');
    }
    if (allocation.claim.status === PlacementClaimStatus.VOID) {
      throw new BadRequestException('Voided claims cannot be approved');
    }
    if (allocation.status === PlacementClaimAllocationStatus.VOID) {
      throw new BadRequestException(
        'Voided claim allocations cannot be approved',
      );
    }
    if (allocation.counterparty.type !== CounterpartyType.REINSURER) {
      throw new BadRequestException(
        'Claim recovery approvals can only be recorded for reinsurer allocations',
      );
    }
  }

  private async assertCashCallBelongsToAllocation(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
    allocationId: string,
    cashCallId: string,
    currency: string,
  ): Promise<void> {
    const cashCall = await prisma.placementClaimCashCall.findFirst({
      where: {
        id: cashCallId,
        tenantId,
        placementId,
        claimId,
        allocationId,
      },
      select: { id: true, currency: true },
    });
    if (!cashCall) {
      throw new NotFoundException('Placement claim cash call not found');
    }
    if (cashCall.currency !== currency) {
      throw new BadRequestException(
        'Recovery approval currency must match the cash call currency',
      );
    }
  }

  private recoveryEligibleAmount(allocation: ClaimAllocationRecord): number {
    return this.money.roundMoney(
      this.money.toNumber(
        allocation.allocatedFinalLossAmount ??
          allocation.allocatedEstimatedLossAmount,
      ),
    );
  }

  private cleanCurrency(value: string): string {
    return value.trim().toUpperCase();
  }

  private cleanOptional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
