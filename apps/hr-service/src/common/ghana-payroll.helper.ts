import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const EMPLOYEE_TIER1_RATE = '0.005';
export const EMPLOYEE_TIER2_RATE = '0.05';
export const EMPLOYEE_SSNIT_RATE = '0.055';
export const EMPLOYER_SSNIT_RATE = '0.13';
export const MAX_INSURABLE_EARNINGS = '69000';

const MONTHLY_PAYE_TIERS = [
  { limit: '490', rate: '0' },
  { limit: '110', rate: '0.05' },
  { limit: '130', rate: '0.10' },
  { limit: '3166.67', rate: '0.175' },
  { limit: '16000', rate: '0.25' },
  { limit: '30520', rate: '0.30' },
  { limit: '999999999', rate: '0.35' },
];

export function calculateSSNIT(basicSalary: string): {
  employeeSSNIT: string;
  employerSSNIT: string;
} {
  const insurable = Decimal.min(
    new Decimal(basicSalary),
    new Decimal(MAX_INSURABLE_EARNINGS),
  );
  const tier1Employee = insurable.times(EMPLOYEE_TIER1_RATE);
  const tier2Employee = insurable.times(EMPLOYEE_TIER2_RATE);
  return {
    employeeSSNIT: tier1Employee
      .plus(tier2Employee)
      .toDecimalPlaces(2)
      .toString(),
    employerSSNIT: insurable
      .times(EMPLOYER_SSNIT_RATE)
      .toDecimalPlaces(2)
      .toString(),
  };
}

export function calculateTier1Employee(basicSalary: string): string {
  const insurable = Decimal.min(
    new Decimal(basicSalary),
    new Decimal(MAX_INSURABLE_EARNINGS),
  );
  return insurable.times(EMPLOYEE_TIER1_RATE).toDecimalPlaces(2).toString();
}

export function calculateTier2(basicSalary: string): string {
  const insurable = Decimal.min(
    new Decimal(basicSalary),
    new Decimal(MAX_INSURABLE_EARNINGS),
  );
  return insurable.times(EMPLOYEE_TIER2_RATE).toDecimalPlaces(2).toString();
}

export function calculateTier3Contribution(
  basicSalary: string,
  tier3RatePercent?: string | number | null,
): string {
  if (tier3RatePercent == null) return '0';

  const ratePercent = new Decimal(tier3RatePercent);
  if (ratePercent.lte(0)) return '0';

  return new Decimal(basicSalary)
    .times(ratePercent.div(100))
    .toDecimalPlaces(2)
    .toString();
}

export function calculateMonthlyPAYE(monthlyTaxableIncome: string): string {
  let taxableIncome = new Decimal(monthlyTaxableIncome);
  let totalTax = new Decimal(0);

  for (const tier of MONTHLY_PAYE_TIERS) {
    if (taxableIncome.lte(0)) break;
    const tierLimitDec = new Decimal(tier.limit);
    const tierLimit = taxableIncome.lt(tierLimitDec)
      ? taxableIncome
      : tierLimitDec;
    totalTax = totalTax.plus(tierLimit.times(new Decimal(tier.rate)));
    taxableIncome = taxableIncome.minus(tierLimit);
  }

  return totalTax.toDecimalPlaces(2).toString();
}

export function calculatePayrollGross(
  basicSalary: string,
  totalAllowances: string,
  transportAmount: string,
  otherDeductions: string,
): string {
  return Decimal.max(
    new Decimal(0),
    new Decimal(basicSalary)
      .plus(new Decimal(totalAllowances))
      .plus(new Decimal(transportAmount))
      .minus(new Decimal(otherDeductions)),
  )
    .toDecimalPlaces(2)
    .toString();
}

export function calculateTaxableIncome(
  grossSalary: string,
  employeeSSNIT: string,
  transportAmount: string,
  tier3Employee: string = '0',
): string {
  return Decimal.max(
    new Decimal(0),
    new Decimal(grossSalary)
      .minus(new Decimal(employeeSSNIT))
      .minus(new Decimal(transportAmount))
      .minus(new Decimal(tier3Employee)),
  )
    .toDecimalPlaces(2)
    .toString();
}

export function calculatePayrollNetIncome(
  taxableIncome: string,
  payeTax: string,
): string {
  return Decimal.max(
    new Decimal(0),
    new Decimal(taxableIncome).minus(new Decimal(payeTax)),
  )
    .toDecimalPlaces(2)
    .toString();
}

export function calculateTotalPayrollDeductions(
  otherDeductions: string,
  employeeSSNIT: string,
  payeTax: string,
  tier3Employee: string = '0',
): string {
  return new Decimal(otherDeductions)
    .plus(new Decimal(employeeSSNIT))
    .plus(new Decimal(tier3Employee))
    .plus(new Decimal(payeTax))
    .toDecimalPlaces(2)
    .toString();
}
