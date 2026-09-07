import { Prisma } from '../../prisma/generated/client';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

describe('ReinsuranceMoneyHelper', () => {
  const helper = new ReinsuranceMoneyHelper();

  it('converts decimal-like values to safe numbers', () => {
    expect(helper.toNumber(new Prisma.Decimal('12.34'))).toBe(12.34);
    expect(helper.toNumber('56.78')).toBe(56.78);
    expect(helper.toNumber(null)).toBe(0);
    expect(helper.toNumber(Number.NaN)).toBe(0);
  });

  it('returns null for optional missing or invalid values', () => {
    expect(helper.toOptionalNumber(new Prisma.Decimal('12.34'))).toBe(12.34);
    expect(helper.toOptionalNumber(undefined)).toBeNull();
    expect(helper.toOptionalNumber(Number.NaN)).toBeNull();
  });

  it('rounds money to two decimal places', () => {
    expect(helper.roundMoney(123.456)).toBe(123.46);
    expect(helper.roundMoney(123.454)).toBe(123.45);
  });

  it('calculates percentage allocation', () => {
    expect(helper.percentOf(40000, 40)).toBe(16000);
    expect(helper.percentOf(new Prisma.Decimal('37500.00'), '10')).toBe(3750);
  });
});
