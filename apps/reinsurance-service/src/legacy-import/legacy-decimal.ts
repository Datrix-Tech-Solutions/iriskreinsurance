const SCALE = 8n;
const FACTOR = 100000000n;

export class LegacyDecimal {
  private constructor(private readonly units: bigint) {}

  static zero(): LegacyDecimal {
    return new LegacyDecimal(0n);
  }

  static from(value: unknown): LegacyDecimal {
    if (value instanceof LegacyDecimal) return value;
    if (value === null || value === undefined || value === '') {
      return LegacyDecimal.zero();
    }
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'bigint'
    ) {
      return LegacyDecimal.zero();
    }
    const raw = String(value).trim().replace(/,/g, '');
    const match = raw.match(/^(-)?(\d+)(?:\.(\d+))?$/);
    if (!match) return LegacyDecimal.zero();
    const [, negative, integer, fraction = ''] = match;
    const padded = fraction.padEnd(Number(SCALE), '0').slice(0, Number(SCALE));
    const sign = negative ? -1n : 1n;
    return new LegacyDecimal(
      sign * (BigInt(integer) * FACTOR + BigInt(padded)),
    );
  }

  add(other: LegacyDecimal): LegacyDecimal {
    return new LegacyDecimal(this.units + other.units);
  }

  subtract(other: LegacyDecimal): LegacyDecimal {
    return new LegacyDecimal(this.units - other.units);
  }

  abs(): LegacyDecimal {
    return new LegacyDecimal(this.units < 0n ? -this.units : this.units);
  }

  gt(other: LegacyDecimal): boolean {
    return this.units > other.units;
  }

  toNumber(): number {
    return Number(this.units) / Number(FACTOR);
  }

  toString(): string {
    const sign = this.units < 0n ? '-' : '';
    const value = this.units < 0n ? -this.units : this.units;
    const integer = value / FACTOR;
    const fraction = (value % FACTOR).toString().padStart(Number(SCALE), '0');
    const trimmed = fraction.replace(/0+$/, '');
    return `${sign}${integer.toString()}${trimmed ? `.${trimmed}` : ''}`;
  }
}

export function sumDecimals(values: unknown[]): LegacyDecimal {
  return values.reduce<LegacyDecimal>(
    (sum, value) => sum.add(LegacyDecimal.from(value)),
    LegacyDecimal.zero(),
  );
}
