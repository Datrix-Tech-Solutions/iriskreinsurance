import {
  canReversePayment,
  isActiveReinsurerDisbursement,
  paymentReversalRequest,
  PaymentReversalCandidate,
  premiumReversalBlockedByDisbursements,
} from './paymentHistoryActions';

function payment(overrides: Partial<PaymentReversalCandidate> = {}): PaymentReversalCandidate {
  return {
    id: 'payment-1',
    type: 'PREMIUM_RECEIVED',
    status: 'BANK_CONFIRMED',
    reversalOfPaymentId: null,
    ...overrides,
  };
}

describe('canReversePayment', () => {
  it('allows reversing bank-confirmed premium receipts', () => {
    expect(canReversePayment(payment())).toBe(true);
  });

  it('does not allow reversing recorded premium receipts', () => {
    expect(canReversePayment(payment({ status: 'RECORDED' }))).toBe(false);
  });

  it('does not allow reversing reversed premium receipts', () => {
    expect(canReversePayment(payment({ status: 'REVERSED' }))).toBe(false);
  });

  it('does not allow reversing linked reversal rows', () => {
    expect(canReversePayment(payment({ reversalOfPaymentId: 'original-payment-1' }))).toBe(false);
  });

  it('preserves existing bank-confirmed reinsurer disbursement visibility', () => {
    expect(
      canReversePayment(payment({ type: 'REINSURER_DISBURSEMENT', status: 'BANK_CONFIRMED' })),
    ).toBe(true);
  });

  it('builds the existing reversal hook payload with placement and payment IDs', () => {
    expect(paymentReversalRequest('placement-1', payment({ id: 'payment-1' }))).toEqual({
      placementId: 'placement-1',
      paymentId: 'payment-1',
    });
  });
});

describe('isActiveReinsurerDisbursement', () => {
  it('treats recorded and bank-confirmed disbursements as active', () => {
    expect(
      isActiveReinsurerDisbursement(
        payment({ type: 'REINSURER_DISBURSEMENT', status: 'RECORDED' }),
      ),
    ).toBe(true);
    expect(
      isActiveReinsurerDisbursement(
        payment({ type: 'REINSURER_DISBURSEMENT', status: 'BANK_CONFIRMED' }),
      ),
    ).toBe(true);
  });

  it('ignores reversed, cancelled and failed disbursements', () => {
    for (const status of ['REVERSED', 'CANCELLED', 'FAILED']) {
      expect(
        isActiveReinsurerDisbursement(payment({ type: 'REINSURER_DISBURSEMENT', status })),
      ).toBe(false);
    }
  });

  it('ignores the linked reversal row and non-disbursement payments', () => {
    expect(
      isActiveReinsurerDisbursement(
        payment({
          type: 'REINSURER_DISBURSEMENT',
          status: 'BANK_CONFIRMED',
          reversalOfPaymentId: 'original-1',
        }),
      ),
    ).toBe(false);
    expect(isActiveReinsurerDisbursement(payment({ type: 'PREMIUM_RECEIVED' }))).toBe(false);
  });
});

describe('premiumReversalBlockedByDisbursements', () => {
  const premium = payment({ type: 'PREMIUM_RECEIVED', status: 'BANK_CONFIRMED' });

  it('blocks a premium reversal while an active reinsurer disbursement remains', () => {
    expect(
      premiumReversalBlockedByDisbursements(premium, [
        premium,
        payment({ id: 'd1', type: 'REINSURER_DISBURSEMENT', status: 'BANK_CONFIRMED' }),
      ]),
    ).toBe(true);
  });

  it('allows the premium reversal once every disbursement is reversed', () => {
    expect(
      premiumReversalBlockedByDisbursements(premium, [
        premium,
        payment({ id: 'd1', type: 'REINSURER_DISBURSEMENT', status: 'REVERSED' }),
        payment({
          id: 'd1-rev',
          type: 'REINSURER_DISBURSEMENT',
          status: 'BANK_CONFIRMED',
          reversalOfPaymentId: 'd1',
        }),
      ]),
    ).toBe(false);
  });

  it('never blocks a non-premium payment', () => {
    expect(
      premiumReversalBlockedByDisbursements(
        payment({ type: 'REINSURER_DISBURSEMENT', status: 'BANK_CONFIRMED' }),
        [payment({ id: 'd1', type: 'REINSURER_DISBURSEMENT', status: 'BANK_CONFIRMED' })],
      ),
    ).toBe(false);
  });
});
