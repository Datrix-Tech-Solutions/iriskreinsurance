import Decimal from 'decimal.js';
import {
  PayrollCountry,
  PayrollTaxPolicy,
} from '../../prisma/generated/client';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

type EditablePayrollValues = {
  basicSalary: string;
  commissionAmount: string;
  totalAllowances: string;
  transportAmount: string;
  otherDeductions: string;
};

export type PayrollCountryCode = keyof typeof PayrollCountry;

export type PayrollCalculationSettings = {
  payrollCountry: PayrollCountry;
  tier3Enabled: boolean;
  tier3Rate: string | null;
  taxPolicy?: PayrollTaxPolicy;
  fixedTaxAmount?: string | null;
  commissionTaxable?: boolean;
  compensationType?: 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION';
};

export type CalculatedCountryPayrollValues = EditablePayrollValues & {
  overtimePay: string;
  bonus: string;
  thirteenthMonth: string;
  grossSalary: string;
  employeeSSNIT: string;
  employerSSNIT: string;
  tier1Contribution: string;
  tier2Contribution: string;
  tier3Employee: string;
  taxableIncome: string;
  payeTax: string;
  totalDeductions: string;
  netSalary: string;
};

const PAYROLL_CURRENCY: Record<PayrollCountry, string> = {
  [PayrollCountry.GH]: 'GHS',
  [PayrollCountry.NG]: 'NGN',
  [PayrollCountry.KE]: 'KES',
};

const GHANA = {
  employeeTier1Rate: new Decimal('0.005'),
  employeeTier2Rate: new Decimal('0.05'),
  employerTier1Rate: new Decimal('0.13'),
  maxInsurableEarnings: new Decimal('69000'),
  payeBands: [
    { limit: new Decimal('490'), rate: new Decimal('0') },
    { limit: new Decimal('110'), rate: new Decimal('0.05') },
    { limit: new Decimal('130'), rate: new Decimal('0.10') },
    { limit: new Decimal('3166.67'), rate: new Decimal('0.175') },
    { limit: new Decimal('16000'), rate: new Decimal('0.25') },
    { limit: new Decimal('30520'), rate: new Decimal('0.30') },
    { limit: new Decimal('999999999'), rate: new Decimal('0.35') },
  ],
};

const NIGERIA = {
  employeePensionRate: new Decimal('0.08'),
  employerPensionRate: new Decimal('0.10'),
  minimumTaxRate: new Decimal('0.01'),
  annualPayeBands: [
    { threshold: new Decimal('300000'), rate: new Decimal('0.07') },
    { threshold: new Decimal('600000'), rate: new Decimal('0.11') },
    { threshold: new Decimal('1100000'), rate: new Decimal('0.15') },
    { threshold: new Decimal('1600000'), rate: new Decimal('0.19') },
    { threshold: new Decimal('3200000'), rate: new Decimal('0.21') },
    { threshold: new Decimal('999999999999'), rate: new Decimal('0.24') },
  ],
};

const KENYA = {
  nssfLowerLimit: new Decimal('9000'),
  nssfUpperLimit: new Decimal('108000'),
  nssfRate: new Decimal('0.06'),
  personalRelief: new Decimal('2400'),
  payeBands: [
    { limit: new Decimal('24000'), rate: new Decimal('0.10') },
    { limit: new Decimal('8333'), rate: new Decimal('0.25') },
    { limit: new Decimal('467667'), rate: new Decimal('0.30') },
    { limit: new Decimal('300000'), rate: new Decimal('0.325') },
    { limit: new Decimal('999999999'), rate: new Decimal('0.35') },
  ],
};

function money(value: string | number | decimal.Decimal): string {
  return new Decimal(value).toDecimalPlaces(2).toString();
}

function maxZero(value: decimal.Decimal): decimal.Decimal {
  return Decimal.max(new Decimal(0), value);
}

function calculateProgressiveTax(
  taxableIncome: decimal.Decimal,
  bands: Array<{ limit: decimal.Decimal; rate: decimal.Decimal }>,
): decimal.Decimal {
  let remaining = Decimal.max(new Decimal(0), taxableIncome);
  let totalTax = new Decimal(0);

  for (const band of bands) {
    if (remaining.lte(0)) break;
    const taxableInBand = Decimal.min(remaining, band.limit);
    totalTax = totalTax.plus(taxableInBand.times(band.rate));
    remaining = remaining.minus(taxableInBand);
  }

  return totalTax;
}

function calculateNigeriaMonthlyPaye(
  monthlyTaxableIncome: decimal.Decimal,
  monthlyGrossSalary: decimal.Decimal,
): decimal.Decimal {
  const annualGross = monthlyGrossSalary.times(12);
  const annualConsolidatedRelief = Decimal.max(
    new Decimal('200000'),
    annualGross.times(NIGERIA.minimumTaxRate),
  ).plus(annualGross.times('0.20'));
  const annualTaxableIncome = maxZero(
    monthlyTaxableIncome.times(12).minus(annualConsolidatedRelief),
  );
  let totalTax = new Decimal(0);
  let previousThreshold = new Decimal(0);

  for (const band of NIGERIA.annualPayeBands) {
    if (annualTaxableIncome.lte(previousThreshold)) break;
    const taxableInBand = Decimal.min(
      annualTaxableIncome,
      band.threshold,
    ).minus(previousThreshold);
    if (taxableInBand.gt(0)) {
      totalTax = totalTax.plus(taxableInBand.times(band.rate));
    }
    previousThreshold = band.threshold;
  }

  return Decimal.max(
    totalTax.div(12),
    monthlyGrossSalary.times(NIGERIA.minimumTaxRate),
  );
}

function calculateKenyaNssf(basicSalary: decimal.Decimal): decimal.Decimal {
  const tier1 = Decimal.min(basicSalary, KENYA.nssfLowerLimit);
  const tier2 = Decimal.max(
    new Decimal(0),
    Decimal.min(basicSalary, KENYA.nssfUpperLimit).minus(KENYA.nssfLowerLimit),
  );
  return tier1.plus(tier2).times(KENYA.nssfRate);
}

export function normalizePayrollCountry(
  value: string | null | undefined,
): PayrollCountry {
  const normalized = value?.trim().toLowerCase() ?? '';

  if (['gh', 'gha', 'ghana', 'republic of ghana'].includes(normalized)) {
    return PayrollCountry.GH;
  }

  if (['ng', 'nga', 'nigeria'].includes(normalized)) {
    return PayrollCountry.NG;
  }

  if (['ke', 'ken', 'kenya'].includes(normalized)) {
    return PayrollCountry.KE;
  }

  return PayrollCountry.GH;
}

export function defaultPayrollCurrency(country: PayrollCountry): string {
  return PAYROLL_CURRENCY[country];
}

export function normalizePayrollCurrency(
  value: string | null | undefined,
  country: PayrollCountry,
): string {
  return value?.trim().toUpperCase() || defaultPayrollCurrency(country);
}

export function calculatePayrollForCountry(
  values: EditablePayrollValues,
  settings: PayrollCalculationSettings,
): CalculatedCountryPayrollValues {
  const basicSalary = new Decimal(values.basicSalary);
  const commissionAmount = new Decimal(values.commissionAmount);
  const totalAllowances = new Decimal(values.totalAllowances);
  const transportAmount = new Decimal(values.transportAmount);
  const otherDeductions = new Decimal(values.otherDeductions);

  const grossSalary = basicSalary
    .plus(commissionAmount)
    .plus(totalAllowances)
    .plus(transportAmount);

  // For SALARY_PLUS_COMMISSION, always exclude commission from the PAYE base —
  // it is taxed separately at a flat 10% rate below.
  const excludedCommission =
    settings.compensationType === 'SALARY_PLUS_COMMISSION' ||
    settings.commissionTaxable === false
      ? commissionAmount
      : new Decimal(0);

  let employeeStatutory = new Decimal(0);
  let employerStatutory = new Decimal(0);
  let tier1Contribution = new Decimal(0);
  let tier2Contribution = new Decimal(0);
  let tier3Employee = new Decimal(0);
  let taxableIncome = new Decimal(0);
  let payeTax = new Decimal(0);

  switch (settings.payrollCountry) {
    case PayrollCountry.NG: {
      employeeStatutory = basicSalary.times(NIGERIA.employeePensionRate);
      employerStatutory = basicSalary.times(NIGERIA.employerPensionRate);
      // otherDeductions (loans, advances) are post-tax — do not reduce the PAYE base
      taxableIncome = maxZero(
        grossSalary.minus(excludedCommission).minus(employeeStatutory),
      );
      payeTax = calculateNigeriaMonthlyPaye(taxableIncome, grossSalary);
      break;
    }

    case PayrollCountry.KE: {
      employeeStatutory = calculateKenyaNssf(basicSalary);
      employerStatutory = employeeStatutory;
      // otherDeductions (loans, advances) are post-tax — do not reduce the PAYE base
      taxableIncome = maxZero(
        grossSalary.minus(excludedCommission).minus(employeeStatutory),
      );
      payeTax = Decimal.max(
        new Decimal(0),
        calculateProgressiveTax(taxableIncome, KENYA.payeBands).minus(
          KENYA.personalRelief,
        ),
      );
      break;
    }

    case PayrollCountry.GH:
    default: {
      const insurable = Decimal.min(basicSalary, GHANA.maxInsurableEarnings);
      tier1Contribution = insurable.times(GHANA.employeeTier1Rate);
      tier2Contribution = insurable.times(GHANA.employeeTier2Rate);
      employeeStatutory = tier1Contribution.plus(tier2Contribution);
      employerStatutory = insurable.times(GHANA.employerTier1Rate);

      tier3Employee =
        settings.tier3Enabled && settings.tier3Rate
          ? basicSalary.times(new Decimal(settings.tier3Rate).div(100))
          : new Decimal(0);

      // otherDeductions (loans, advances) are post-tax — do not reduce the PAYE base.
      // Transport allowance is PAYE-exempt so it is excluded from taxableIncome,
      // but remains in gross and therefore in netSalary.
      taxableIncome = maxZero(
        grossSalary
          .minus(excludedCommission)
          .minus(employeeStatutory)
          .minus(tier3Employee)
          .minus(transportAmount),
      );
      payeTax = calculateProgressiveTax(taxableIncome, GHANA.payeBands);
      break;
    }
  }

  // For SALARY_PLUS_COMMISSION, add flat 10% on commission on top of salary PAYE
  if (settings.compensationType === 'SALARY_PLUS_COMMISSION') {
    payeTax = payeTax.plus(commissionAmount.times(new Decimal('0.10')));
  }

  if (settings.taxPolicy === PayrollTaxPolicy.FIXED_AMOUNT) {
    payeTax = Decimal.max(
      new Decimal(0),
      new Decimal(settings.fixedTaxAmount ?? 0),
    );
  }

  if (settings.taxPolicy === PayrollTaxPolicy.EXEMPT) {
    payeTax = new Decimal(0);
  }

  const totalDeductions = otherDeductions
    .plus(employeeStatutory)
    .plus(tier3Employee)
    .plus(payeTax);
  const netSalary = maxZero(grossSalary.minus(totalDeductions));

  return {
    ...values,
    overtimePay: '0',
    bonus: '0',
    thirteenthMonth: '0',
    grossSalary: money(grossSalary),
    employeeSSNIT: money(employeeStatutory),
    employerSSNIT: money(employerStatutory),
    tier1Contribution: money(tier1Contribution),
    tier2Contribution: money(tier2Contribution),
    tier3Employee: money(tier3Employee),
    taxableIncome: money(taxableIncome),
    payeTax: money(payeTax),
    totalDeductions: money(totalDeductions),
    netSalary: money(netSalary),
  };
}
