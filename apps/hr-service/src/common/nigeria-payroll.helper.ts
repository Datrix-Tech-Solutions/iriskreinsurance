import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// PRA 2014 mandatory pension rates
export const EMPLOYEE_PENSION_RATE = '0.08'; // 8%
export const EMPLOYER_PENSION_RATE = '0.10'; // 10%

// PITA 2011 annual PAYE bands (NGN) — cumulative upper limits
const ANNUAL_PAYE_BANDS = [
  { limit: '300000', rate: '0.07' },
  { limit: '600000', rate: '0.11' },
  { limit: '1100000', rate: '0.15' },
  { limit: '1600000', rate: '0.19' },
  { limit: '3200000', rate: '0.21' },
  { limit: '999999999999', rate: '0.24' },
];

/** Mandatory pension contributions under PRA 2014. */
export function calculatePension_NG(basicSalary: string): {
  employeePension: string;
  employerPension: string;
} {
  const basic = new Decimal(basicSalary);
  return {
    employeePension: basic
      .times(EMPLOYEE_PENSION_RATE)
      .toDecimalPlaces(2)
      .toString(),
    employerPension: basic
      .times(EMPLOYER_PENSION_RATE)
      .toDecimalPlaces(2)
      .toString(),
  };
}

/** Optional voluntary pension top-up; ratePercent is a percentage value (e.g. 2 = 2%). */
export function calculateVoluntaryPension_NG(
  basicSalary: string,
  ratePercent?: string | number | null,
): string {
  if (ratePercent == null) return '0';
  const rate = new Decimal(ratePercent);
  if (rate.lte(0)) return '0';
  return new Decimal(basicSalary)
    .times(rate.div(100))
    .toDecimalPlaces(2)
    .toString();
}

/**
 * Nigeria PAYE — PITA 2011 bands with CRA and minimum tax.
 * monthlyTaxable: gross - pension (pre-CRA); monthlyGross: used for CRA and minimum tax floor.
 */
export function calculateMonthlyPAYE_NG(
  monthlyTaxable: string,
  monthlyGross: string,
): string {
  const annualGross = new Decimal(monthlyGross).times(12);
  // CRA = max(200,000, 1% of annual gross) + 20% of annual gross
  const annualCRA = Decimal.max('200000', annualGross.times('0.01')).plus(
    annualGross.times('0.2'),
  );
  const annualTaxable = Decimal.max(
    new Decimal(0),
    new Decimal(monthlyTaxable).times(12).minus(annualCRA),
  );

  let totalTax = new Decimal(0);
  let prev = new Decimal(0);

  for (const band of ANNUAL_PAYE_BANDS) {
    if (annualTaxable.lte(prev)) break;
    const bandCap = new Decimal(band.limit);
    const inBand = Decimal.min(annualTaxable, bandCap).minus(prev);
    if (inBand.gt(0)) {
      totalTax = totalTax.plus(inBand.times(band.rate));
    }
    prev = bandCap;
  }

  const computedMonthly = totalTax.div(12);
  // Minimum tax: 1% of monthly gross
  const minimumMonthly = new Decimal(monthlyGross).times('0.01');
  return Decimal.max(computedMonthly, minimumMonthly)
    .toDecimalPlaces(2)
    .toString();
}

/** Gross = basic + allowances + transport − other deductions. */
export function calculatePayrollGross_NG(
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
 * Taxable income = gross − employee pension − voluntary pension.
 * Transport is NOT tax-exempt in Nigeria, so it is not subtracted here.
 */
export function calculateTaxableIncome_NG(
  grossSalary: string,
  employeePension: string,
  voluntaryPension: string = '0',
): string {
  return Decimal.max(
    new Decimal(0),
    new Decimal(grossSalary)
      .minus(new Decimal(employeePension))
      .minus(new Decimal(voluntaryPension)),
  )
    .toDecimalPlaces(2)
    .toString();
}

export function calculatePayrollNetIncome_NG(
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

export function calculateTotalPayrollDeductions_NG(
  otherDeductions: string,
  employeePension: string,
  voluntaryPension: string = '0',
  payeTax: string,
): string {
  return new Decimal(otherDeductions)
    .plus(new Decimal(employeePension))
    .plus(new Decimal(voluntaryPension))
    .plus(new Decimal(payeTax))
    .toDecimalPlaces(2)
    .toString();
}
