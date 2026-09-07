import { BadRequestException } from '@nestjs/common';
import { JournalPolicy } from './journal.policy';

describe('JournalPolicy', () => {
  const policy = new JournalPolicy();

  it('accepts a balanced double-entry journal', () => {
    expect(() =>
      policy.validateBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced journal', () => {
    expect(() =>
      policy.validateBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 90 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects a line with both debit and credit', () => {
    expect(() =>
      policy.validateBalanced([
        { debit: 100, credit: 100 },
        { debit: 0, credit: 0 },
      ]),
    ).toThrow('must contain either a debit or a credit');
  });

  it('calculates rounded base-currency amounts deterministically', () => {
    expect(policy.baseAmount(100, 15.4567, 2).toFixed(2)).toBe('1545.67');
  });

  it('rejects amounts beyond the configured currency precision', () => {
    expect(() =>
      policy.validateCurrencyPrecision(
        [
          { debit: 100.001, credit: 0 },
          { debit: 0, credit: 100.001 },
        ],
        'GHS',
        2,
      ),
    ).toThrow('exceeds GHS precision of 2 decimal places');
  });
});
