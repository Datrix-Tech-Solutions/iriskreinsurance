import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// NSSF Act 2013 — tiered 6% each side
export const NSSF_RATE = '0.06';
export const NSSF_LOWER_LIMIT = '9000'; // KES 9,000/month
export const NSSF_UPPER_LIMIT = '108000'; // KES 108,000/month

// KRA personal relief credit applied after computing gross tax
export const PERSONAL_RELIEF_MONTHLY = '2400'; // KES 2,400/month

// Occupational pension: employee contributions exempt up to KES 20,000/month
export const OCCUPATIONAL_EXEMPT_CAP = '20000';

// Monthly PAYE bands (KES)
const MONTHLY_PAYE_BANDS = [
  { limit: '24000', rate: '0.10' },
  { limit: '8333', rate: '0.25' },
  { limit: '467667', rate: '0.30' },
  { limit: '300000', rate: '0.325' },
  { limit: '999999999999', rate: '0.35' },
];

/** NSSF contributions — tiered 6% employee and employer. */
export function calculateNSSF_KE(basicSalary: string): {
  employeeNSSF: string;
  employerNSSF: string;
} {
  const salary = new Decimal(basicSalary);
  const lowerLimit = new Decimal(NSSF_LOWER_LIMIT);
  const upperLimit = new Decimal(NSSF_UPPER_LIMIT);
  const rate = new Decimal(NSSF_RATE);

  const tier1 = Decimal.min(salary, lowerLimit);
  const tier2 = Decimal.max(
    new Decimal(0),
    Decimal.min(salary, upperLimit).minus(lowerLimit),
  );
  const contrib = tier1.plus(tier2).times(rate).toDecimalPlaces(2).toString();

  return { employeeNSSF: contrib, employerNSSF: contrib };
}

/**
 * Occupational (employer-sponsored) pension contribution.
 * ratePercent is a percentage value (e.g. 5 = 5%).
 * The deductible portion is capped at KES 20,000/month.
 */
export function calculateOccupationalPension_KE(
  basicSalary: string,
  ratePercent?: string | number | null,
): { employeeContrib: string; deductibleAmount: string } {
  if (ratePercent == null)
    return { employeeContrib: '0', deductibleAmount: '0' };
  const rate = new Decimal(ratePercent);
  if (rate.lte(0)) return { employeeContrib: '0', deductibleAmount: '0' };

  const employeeContrib = new Decimal(basicSalary)
    .times(rate.div(100))
    .toDecimalPlaces(2);

  const deductibleAmount = Decimal.min(
    employeeContrib,
    new Decimal(OCCUPATIONAL_EXEMPT_CAP),
  ).toDecimalPlaces(2);

  return {
    employeeContrib: employeeContrib.toString(),
    deductibleAmount: deductibleAmount.toString(),
  };
}

/**
 * Kenya PAYE — monthly progressive bands with personal relief credit.
 * personalRelief defaults to KES 2,400/month.
 */
export function calculateMonthlyPAYE_KE(
  monthlyTaxable: string,
  personalRelief: string = PERSONAL_RELIEF_MONTHLY,
): string {
  let remaining = new Decimal(monthlyTaxable);
  let grossTax = new Decimal(0);

  for (const band of MONTHLY_PAYE_BANDS) {
    if (remaining.lte(0)) break;
    const bandWidth = new Decimal(band.limit);
    const inBand = Decimal.min(remaining, bandWidth);
    grossTax = grossTax.plus(inBand.times(band.rate));
    remaining = remaining.minus(inBand);
  }

  return Decimal.max(
    new Decimal(0),
    grossTax.minus(new Decimal(personalRelief)),
  )
    .toDecimalPlaces(2)
    .toString();
}

/** Gross = basic + allowances + transport − other deductions. */
export function calculatePayrollGross_KE(
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

/**
 * Taxable income = gross − NSSF − deductible occupational pension.
 * Transport is NOT tax-exempt in Kenya, so it is not subtracted here.
 */
export function calculateTaxableIncome_KE(
  grossSalary: string,
  employeeNSSF: string,
  deductibleOccupational: string = '0',
): string {
  return Decimal.max(
    new Decimal(0),
    new Decimal(grossSalary)
      .minus(new Decimal(employeeNSSF))
      .minus(new Decimal(deductibleOccupational)),
  )
    .toDecimalPlaces(2)
    .toString();
}

export function calculatePayrollNetIncome_KE(
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

export function calculateTotalPayrollDeductions_KE(
  otherDeductions: string,
  employeeNSSF: string,
  occupationalContrib: string = '0',
  payeTax: string,
): string {
  return new Decimal(otherDeductions)
    .plus(new Decimal(employeeNSSF))
    .plus(new Decimal(occupationalContrib))
    .plus(new Decimal(payeTax))
    .toDecimalPlaces(2)
    .toString();
}
