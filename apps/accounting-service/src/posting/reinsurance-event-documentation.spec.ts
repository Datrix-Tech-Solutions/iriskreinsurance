import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Reinsurance accounting event documentation', () => {
  const spec = readFileSync(join(process.cwd(), 'README.md'), 'utf8');

  it('documents every active Reinsurance accounting event in the AR/AP matrix', () => {
    const activeReinsuranceEvents = [
      'DEBIT_NOTE_ISSUED',
      'CREDIT_NOTE_ISSUED',
      'ENDORSEMENT_DEBIT_NOTE_ISSUED',
      'ENDORSEMENT_CREDIT_NOTE_ISSUED',
      'PREMIUM_PAYMENT_RECEIVED',
      'PAYMENT_REVERSED',
      'REINSURER_DISBURSEMENT_RECORDED',
      'REINSURER_DISBURSEMENT_REVERSED',
    ];

    expect(spec).toContain('### Active Reinsurance AR/AP Matrix');
    for (const eventName of activeReinsuranceEvents) {
      expect(spec).toContain(`\`${eventName}\``);
    }
  });

  it('documents that Reinsurance claim source events are legacy historical only', () => {
    expect(spec).toContain(
      'Reinsurance Claims are currently financially controlled inside Reinsurance',
    );
    expect(spec).toMatch(
      /Historical claim source\s+events that were already delivered remain immutable Accounting history/,
    );
  });

  it('documents the current cash recognition boundaries for receipts and disbursements', () => {
    expect(spec).toMatch(/No Accounting outbox event is created at that point/);
    expect(spec).toContain('Cedant payment clears receivable');
    expect(spec).toContain('Accounting confirmation time (`bankConfirmedAt`)');
  });
});
