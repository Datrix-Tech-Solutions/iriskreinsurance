import { Injectable } from '@nestjs/common';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

export type ClaimAllocationCalculationInput = {
  estimatedLossAmount: number;
  finalLossAmount?: number | null;
  signedLinePercent: number;
};

export type ClaimAllocationCalculationResult = {
  basisAmount: number;
  allocatedEstimatedLossAmount: number;
  allocatedFinalLossAmount: number | null;
};

@Injectable()
export class ClaimAllocationCalculator {
  constructor(private readonly money: ReinsuranceMoneyHelper) {}

  calculateFromSnapshot(
    input: ClaimAllocationCalculationInput,
  ): ClaimAllocationCalculationResult {
    const finalLossAmount =
      input.finalLossAmount === undefined ? null : input.finalLossAmount;
    const basisAmount = finalLossAmount ?? input.estimatedLossAmount;

    return {
      basisAmount: this.money.roundMoney(basisAmount),
      allocatedEstimatedLossAmount: this.money.roundMoney(
        this.money.percentOf(
          input.estimatedLossAmount,
          input.signedLinePercent,
        ),
      ),
      allocatedFinalLossAmount:
        finalLossAmount === null
          ? null
          : this.money.roundMoney(
              this.money.percentOf(finalLossAmount, input.signedLinePercent),
            ),
    };
  }
}
