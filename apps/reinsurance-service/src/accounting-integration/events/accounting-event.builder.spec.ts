import { ReinsuranceAccountingEventBuilder } from './accounting-event.builder';

describe('ReinsuranceAccountingEventBuilder', () => {
  const builder = new ReinsuranceAccountingEventBuilder();

  it('builds the actual Accounting internal source-event DTO shape', () => {
    const event = builder.build({
      tenantId: 'tenant-1',
      sourceEventType: 'premium_payment_received',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      occurredAt: new Date('2026-07-29T10:00:00.000Z'),
      currency: 'ghs',
      payload: {
        placementId: 'placement-1',
        amounts: { amount: 1000 },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
      },
    });

    expect(event).toEqual({
      tenantId: 'tenant-1',
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      occurredAt: '2026-07-29T10:00:00.000Z',
      currency: 'GHS',
      payload: {
        placementId: 'placement-1',
        amounts: { amount: 1000 },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
      },
    });
  });

  it('creates a pending outbox row without any GL posting instructions', () => {
    const data = builder.asOutboxCreateInput({
      tenantId: 'tenant-1',
      sourceEventType: 'CLAIM_CASH_CALL_ISSUED',
      sourceRecordType: 'PlacementClaimCashCall',
      sourceRecordId: 'cash-call-1',
      idempotencyKey: 'reinsurance:cash-call:cash-call-1:issued:v1',
      occurredAt: '2026-07-29T10:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { amount: 5000 } },
    });

    expect(data).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'CLAIM_CASH_CALL_ISSUED',
      sourceRecordType: 'PlacementClaimCashCall',
      sourceRecordId: 'cash-call-1',
      sourceDocumentId: null,
      idempotencyKey: 'reinsurance:cash-call:cash-call-1:issued:v1',
      currency: 'GHS',
      payload: { amounts: { amount: 5000 } },
    });
  });

  it('rejects GL account, journal-line and posting-rule hints in payloads', () => {
    expect(() =>
      builder.build({
        tenantId: 'tenant-1',
        sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
        sourceRecordType: 'PlacementPayment',
        sourceRecordId: 'payment-1',
        idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
        occurredAt: '2026-07-29T10:00:00.000Z',
        currency: 'GHS',
        payload: {
          amounts: { amount: 1000 },
          journalLines: [{ glAccountId: 'account-1' }],
        },
      }),
    ).toThrow(/posting instruction/i);
  });
});
