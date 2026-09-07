import { ClaimAllocationCalculator } from './allocation.calculator';
import { ReinsuranceMoneyHelper } from '../../reinsurance-money.helper';

describe('ClaimAllocationCalculator', () => {
  const calculator = new ClaimAllocationCalculator(
    new ReinsuranceMoneyHelper(),
  );

  it('uses estimated loss when final loss is not present', () => {
    expect(
      calculator.calculateFromSnapshot({
        estimatedLossAmount: 40000,
        finalLossAmount: null,
        signedLinePercent: 40,
      }),
    ).toEqual({
      basisAmount: 40000,
      allocatedEstimatedLossAmount: 16000,
      allocatedFinalLossAmount: null,
    });
  });

  it('uses final loss as basis when present', () => {
    expect(
      calculator.calculateFromSnapshot({
        estimatedLossAmount: 40000,
        finalLossAmount: 37500,
        signedLinePercent: 10,
      }),
    ).toEqual({
      basisAmount: 37500,
      allocatedEstimatedLossAmount: 4000,
      allocatedFinalLossAmount: 3750,
    });
  });

  it('rounds allocation amounts to two decimal places', () => {
    expect(
      calculator.calculateFromSnapshot({
        estimatedLossAmount: 1234.56,
        signedLinePercent: 12.5,
      }),
    ).toMatchObject({
      basisAmount: 1234.56,
      allocatedEstimatedLossAmount: 154.32,
    });
  });
});
