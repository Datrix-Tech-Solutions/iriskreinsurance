import { GoneException } from '@nestjs/common';
import { ReinsuranceAccountingIntegrationController } from './reinsurance-accounting-integration.controller';

describe('ReinsuranceAccountingIntegrationController', () => {
  let controller: ReinsuranceAccountingIntegrationController;

  beforeEach(() => {
    controller = new ReinsuranceAccountingIntegrationController();
  });

  it.each([
    ['status', () => controller.status()],
    ['counterparty sync', () => controller.syncCounterparty()],
    ['manual outbox processing', () => controller.processPending()],
    ['dispatcher status', () => controller.dispatcherStatus()],
    [
      'debit note reconciliation',
      () => controller.reconcileDebitNoteIssuedEvents(),
    ],
    [
      'credit note reconciliation',
      () => controller.reconcileCreditNoteIssuedEvents(),
    ],
    [
      'endorsement debit note reconciliation',
      () => controller.reconcileEndorsementDebitNoteIssuedEvents(),
    ],
    [
      'endorsement credit note reconciliation',
      () => controller.reconcileEndorsementCreditNoteIssuedEvents(),
    ],
    [
      'premium payment reconciliation',
      () => controller.reconcilePremiumPaymentReceivedEvents(),
    ],
    [
      'payment reversal reconciliation',
      () => controller.reconcilePaymentReversedEvents(),
    ],
    [
      'reinsurer disbursement reconciliation',
      () => controller.reconcileReinsurerDisbursementRecordedEvents(),
    ],
    [
      'reinsurer disbursement reversal reconciliation',
      () => controller.reconcileReinsurerDisbursementReversedEvents(),
    ],
  ])('returns 410 for retired %s endpoint', (_label, action) => {
    expect(action).toThrow(GoneException);
  });
});
