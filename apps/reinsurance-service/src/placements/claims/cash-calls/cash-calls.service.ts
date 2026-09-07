import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  Prisma,
} from '../../../../prisma/generated/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdatePlacementClaimCashCallStatusDto } from '../../dto/update-placement-claim-cash-call-status.dto';
import { VoidPlacementClaimCashCallDto } from '../../dto/void-placement-claim-cash-call.dto';

const cashCallInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  allocation: {
    select: {
      id: true,
      status: true,
    },
  },
} satisfies Prisma.PlacementClaimCashCallInclude;

type PlacementClaimCashCallRecord = Prisma.PlacementClaimCashCallGetPayload<{
  include: typeof cashCallInclude;
}>;

@Injectable()
export class PlacementClaimCashCallsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimCashCallRecord[]> {
    await this.assertClaim(tenantId, placementId, claimId);
    return this.prisma.placementClaimCashCall.findMany({
      where: { tenantId, placementId, claimId },
      include: cashCallInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<PlacementClaimCashCallRecord> {
    await this.assertClaim(tenantId, placementId, claimId);
    const cashCall = await this.prisma.placementClaimCashCall.findFirst({
      where: { id: cashCallId, tenantId, placementId, claimId },
      include: cashCallInclude,
    });
    if (!cashCall) {
      throw new NotFoundException('Placement claim cash call not found');
    }
    return cashCall;
  }

  async create(
    user: RequestUser,
    placementId: string,
    claimId: string,
    allocationId: string,
  ): Promise<PlacementClaimCashCallRecord> {
    const claim = await this.findClaim(user.tenantId, placementId, claimId);

    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.placementClaimAllocation.findFirst({
        where: {
          id: allocationId,
          tenantId: user.tenantId,
          placementId,
          claimId,
        },
        select: {
          id: true,
          counterpartyId: true,
          signedLinePercent: true,
          basisAmount: true,
          allocatedEstimatedLossAmount: true,
          allocatedFinalLossAmount: true,
        },
      });
      if (!allocation) {
        throw new NotFoundException('Placement claim allocation not found');
      }

      const existing = await tx.placementClaimCashCall.findFirst({
        where: {
          tenantId: user.tenantId,
          placementId,
          claimId,
          allocationId,
          status: { not: PlacementClaimCashCallStatus.VOID },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'An active cash call already exists for this claim allocation',
        );
      }

      const cashCallNumber = await this.nextCashCallNumber(
        tx,
        user.tenantId,
        placementId,
      );

      return tx.placementClaimCashCall.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          claimId,
          allocationId,
          counterpartyId: allocation.counterpartyId,
          cashCallNumber,
          status: PlacementClaimCashCallStatus.DRAFT,
          currency: claim.currency,
          amount:
            allocation.allocatedFinalLossAmount ??
            allocation.allocatedEstimatedLossAmount,
          basisAmount: allocation.basisAmount,
          signedLinePercent: allocation.signedLinePercent,
          createdByUserId: user.id,
        },
        include: cashCallInclude,
      });
    });
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    claimId: string,
    cashCallId: string,
    dto: UpdatePlacementClaimCashCallStatusDto,
  ): Promise<PlacementClaimCashCallRecord> {
    const cashCall = await this.findOne(
      user.tenantId,
      placementId,
      claimId,
      cashCallId,
    );
    if (cashCall.status === dto.status) return cashCall;
    this.assertStatusTransition(cashCall.status, dto.status);
    if (dto.status === PlacementClaimCashCallStatus.VOID) {
      await this.assertNoEffectiveRecoveryReceipts(
        user.tenantId,
        placementId,
        claimId,
        cashCallId,
      );
    }

    const now = new Date();
    return this.prisma.placementClaimCashCall.update({
      where: { id: cashCallId },
      data: {
        status: dto.status,
        ...(dto.status === PlacementClaimCashCallStatus.ISSUED
          ? { issuedAt: now }
          : {}),
        ...(dto.status === PlacementClaimCashCallStatus.VOID
          ? { voidedAt: now }
          : {}),
      },
      include: cashCallInclude,
    });
  }

  async void(
    user: RequestUser,
    placementId: string,
    claimId: string,
    cashCallId: string,
    dto: VoidPlacementClaimCashCallDto,
  ): Promise<PlacementClaimCashCallRecord> {
    const cashCall = await this.findOne(
      user.tenantId,
      placementId,
      claimId,
      cashCallId,
    );
    this.assertStatusTransition(
      cashCall.status,
      PlacementClaimCashCallStatus.VOID,
    );
    await this.assertNoEffectiveRecoveryReceipts(
      user.tenantId,
      placementId,
      claimId,
      cashCallId,
    );

    return this.prisma.placementClaimCashCall.update({
      where: { id: cashCallId },
      data: {
        status: PlacementClaimCashCallStatus.VOID,
        voidedAt: new Date(),
        voidReason: this.cleanRequired(dto.voidReason),
      },
      include: cashCallInclude,
    });
  }

  private async assertClaim(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<void> {
    await this.findClaim(tenantId, placementId, claimId);
  }

  private async findClaim(
    tenantId: string,
    placementId: string,
    claimId: string,
  ) {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const claim = await this.prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId, placementId },
      select: { id: true, currency: true },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');
    return claim;
  }

  private async nextCashCallNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<string> {
    const count = await tx.placementClaimCashCall.count({
      where: {
        tenantId,
        placementId,
        cashCallNumber: { startsWith: 'CCL-' },
      },
    });
    return `CCL-${String(count + 1).padStart(3, '0')}`;
  }

  private assertStatusTransition(
    from: PlacementClaimCashCallStatus,
    to: PlacementClaimCashCallStatus,
  ): void {
    const allowed: Record<
      PlacementClaimCashCallStatus,
      PlacementClaimCashCallStatus[]
    > = {
      [PlacementClaimCashCallStatus.DRAFT]: [
        PlacementClaimCashCallStatus.ISSUED,
        PlacementClaimCashCallStatus.VOID,
      ],
      [PlacementClaimCashCallStatus.ISSUED]: [
        PlacementClaimCashCallStatus.VOID,
      ],
      [PlacementClaimCashCallStatus.PAID]: [],
      [PlacementClaimCashCallStatus.VOID]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move claim cash call from ${from} to ${to}`,
      );
    }
  }

  private async assertNoEffectiveRecoveryReceipts(
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<void> {
    const receipt = await this.prisma.placementClaimRecoveryReceipt.findFirst({
      where: {
        tenantId,
        placementId,
        claimId,
        cashCallId,
        status: {
          in: [
            PlacementClaimRecoveryReceiptStatus.RECORDED,
            PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
          ],
        },
        reversalOfReceiptId: null,
      },
      select: { id: true },
    });
    if (receipt) {
      throw new ConflictException(
        'Claim cash call cannot be voided while active recovery receipts exist. Reverse receipts first.',
      );
    }
  }

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Required text is missing');
    return cleaned;
  }
}
