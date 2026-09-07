import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';

export interface JournalAmountLine {
  debit?: number | string | Prisma.Decimal;
  credit?: number | string | Prisma.Decimal;
}

@Injectable()
export class JournalPolicy {
  validateBalanced(lines: JournalAmountLine[]): void {
    if (lines.length < 2) {
      throw new BadRequestException(
        'A journal must contain at least two lines',
      );
    }

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const [index, line] of lines.entries()) {
      const debit = new Prisma.Decimal(line.debit ?? 0);
      const credit = new Prisma.Decimal(line.credit ?? 0);
      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException(
          `Journal line ${index + 1} cannot contain negative amounts`,
        );
      }
      const hasDebit = debit.greaterThan(0);
      const hasCredit = credit.greaterThan(0);
      if (hasDebit === hasCredit) {
        throw new BadRequestException(
          `Journal line ${index + 1} must contain either a debit or a credit`,
        );
      }
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
    }

    if (totalDebit.isZero() || !totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal is unbalanced: debit ${totalDebit.toFixed(2)} does not equal credit ${totalCredit.toFixed(2)}`,
      );
    }
  }

  baseAmount(
    amount: number | string | Prisma.Decimal,
    exchangeRate: number | string | Prisma.Decimal,
    decimalPlaces: number,
  ): Prisma.Decimal {
    return new Prisma.Decimal(amount)
      .times(exchangeRate)
      .toDecimalPlaces(decimalPlaces, Prisma.Decimal.ROUND_HALF_UP);
  }

  validateCurrencyPrecision(
    lines: JournalAmountLine[],
    currency: string,
    decimalPlaces: number,
  ): void {
    for (const [index, line] of lines.entries()) {
      for (const amount of [line.debit ?? 0, line.credit ?? 0]) {
        if (new Prisma.Decimal(amount).decimalPlaces() > decimalPlaces) {
          throw new BadRequestException(
            `Journal line ${index + 1} exceeds ${currency} precision of ${decimalPlaces} decimal places`,
          );
        }
      }
    }
  }
}
