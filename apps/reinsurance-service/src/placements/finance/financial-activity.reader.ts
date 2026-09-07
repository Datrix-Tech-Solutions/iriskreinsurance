import { Injectable } from '@nestjs/common';
import { PlacementPaymentType } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementFinancialLockSource } from '../dto/placement-lock-status.dto';

export type PlacementFinancialActivity = {
  source: Exclude<PlacementFinancialLockSource, 'NONE' | 'STATUS_TERMINAL'>;
  lockedAt?: Date | null;
};

@Injectable()
export class PlacementFinancialActivityReader {
  constructor(private readonly prisma: PrismaService) {}

  async findLockingActivity(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementFinancialActivity | null> {
    const payment = await this.prisma.placementPayment.findFirst({
      where: {
        tenantId,
        placementId,
        // A reversed original and its reversal record still prove financial
        // activity happened, so both RECORDED and REVERSED payments lock.
      },
      select: {
        type: true,
        paymentDate: true,
        createdAt: true,
      },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
    });

    if (!payment) return null;

    return {
      source: this.toLockSource(payment.type),
      lockedAt: payment.paymentDate ?? payment.createdAt,
    };
  }

  private toLockSource(
    type: PlacementPaymentType,
  ): Exclude<PlacementFinancialLockSource, 'NONE' | 'STATUS_TERMINAL'> {
    if (type === PlacementPaymentType.REINSURER_DISBURSEMENT) {
      return 'REINSURER_PAYMENT';
    }
    if (type === PlacementPaymentType.CLAIM_SETTLEMENT) {
      return 'CLAIM_SETTLEMENT';
    }
    return 'PREMIUM_PAYMENT';
  }
}
