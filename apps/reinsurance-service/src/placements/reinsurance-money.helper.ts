import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';

export type ReinsuranceNumericValue =
  | Prisma.Decimal
  | number
  | string
  | null
  | undefined;

@Injectable()
export class ReinsuranceMoneyHelper {
  toNumber(value: ReinsuranceNumericValue): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  toOptionalNumber(value: ReinsuranceNumericValue): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  percentOf(amount: ReinsuranceNumericValue, percent: ReinsuranceNumericValue) {
    return (this.toNumber(amount) * this.toNumber(percent)) / 100;
  }
}
