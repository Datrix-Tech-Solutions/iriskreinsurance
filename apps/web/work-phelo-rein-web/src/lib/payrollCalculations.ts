export type Country = 'GH' | 'NG' | 'KE';

export interface AllowanceItem {
  name: string;
  amount: number;
  type?: string;
}

export interface GhanaPensionConfig {
  tier2FundName?: string;
  providentFundEmployeeRate?: number;
  providentFundEmployerRate?: number;
  providentFundName?: string;
}

export interface NigeriaPensionConfig {
  voluntaryEmployeeRate?: number;
  voluntaryEmployerRate?: number;
  pfaName?: string;
}

export interface KenyaPensionConfig {
  occupationalEmployeeRate?: number;
  occupationalEmployerRate?: number;
  schemeName?: string;
}

export interface PayrollInput {
  country: Country;
  basicSalary: number;
  allowances: AllowanceItem[];
  otherDeductions?: number;
  rentRelief?: number;
  ghanaPension?: GhanaPensionConfig;
  nigeriaPension?: NigeriaPensionConfig;
  kenyaPension?: KenyaPensionConfig;
}

export interface PayrollResult {
  basicSalary: number;
  allowances: AllowanceItem[];
  totalAllowances: number;
  grossSalary: number;

  employeeStatutoryContrib: number;
  employerStatutoryContrib: number;

  tier1Contribution?: number;
  tier2Contribution?: number;
  tier2FundName?: string;

  voluntaryPensionEmployee?: number;
  voluntaryPensionEmployer?: number;
  voluntaryPensionName?: string;

  taxableIncome: number;
  paye: number;
  netSalary: number;
  totalEmployerCost: number;
  currency: string;
}

export class PayrollValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayrollValidationError';
  }
}

/* ── 2026 Statutory Rates ── */
const PAYROLL_CONFIG = {
  GH: {
    currency: 'GHS' as const,
    tier1EmployeeRate: 0.005,
    tier1EmployerRate: 0.13,
    tier2EmployeeRate: 0.05,
    maxInsurableEarnings: 69_000, // SSNIT contribution cap per month
  },
  NG: {
    currency: 'NGN' as const,
    statutoryEmployeeRate: 0.08,
    statutoryEmployerRate: 0.1,
  },
  KE: {
    currency: 'KES' as const,
    nssfLowerLimit: 9_000,
    nssfUpperLimit: 108_000,
    personalRelief: 2_400,
    occupationalExemptCap: 20_000,
  },
} as const;

function isTransportAllowance(item: AllowanceItem): boolean {
  const label = `${item.type ?? ''} ${item.name ?? ''}`.toLowerCase();
  return label.includes('transport');
}

/* ── Validation ── */
function validateInput(input: PayrollInput): void {
  const {
    country,
    basicSalary,
    allowances,
    otherDeductions = 0,
    rentRelief = 0,
    ghanaPension,
    nigeriaPension,
    kenyaPension,
  } = input;

  if (!Number.isFinite(basicSalary) || basicSalary < 0)
    throw new PayrollValidationError('Basic salary must be a non-negative number');

  if (!Array.isArray(allowances)) throw new PayrollValidationError('Allowances must be an array');

  for (const item of allowances) {
    if (!item.name?.trim())
      throw new PayrollValidationError('Each allowance must have a non-empty name');
    if (!Number.isFinite(item.amount) || item.amount < 0)
      throw new PayrollValidationError(`Allowance "${item.name}" amount must be non-negative`);
  }

  // FIX: restore Number.isFinite guards — a NaN or Infinity here corrupts taxableIncome
  if (!Number.isFinite(otherDeductions) || otherDeductions < 0)
    throw new PayrollValidationError('Other deductions must be a non-negative number');
  if (!Number.isFinite(rentRelief) || rentRelief < 0)
    throw new PayrollValidationError('Rent relief must be a non-negative number');

  if (rentRelief > 0 && country !== 'NG')
    throw new PayrollValidationError('Rent relief is only applicable for Nigeria');

  const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
  if (otherDeductions > basicSalary + totalAllowances)
    throw new PayrollValidationError('Other deductions cannot exceed gross salary');

  if (ghanaPension && country !== 'GH')
    throw new PayrollValidationError('ghanaPension is only applicable for Ghana');
  if (nigeriaPension && country !== 'NG')
    throw new PayrollValidationError('nigeriaPension is only applicable for Nigeria');
  if (kenyaPension && country !== 'KE')
    throw new PayrollValidationError('kenyaPension is only applicable for Kenya');

  if (country === 'GH' && ghanaPension) {
    const { providentFundEmployeeRate = 0, providentFundEmployerRate = 0 } = ghanaPension;
    if (
      !Number.isFinite(providentFundEmployeeRate) ||
      providentFundEmployeeRate < 0 ||
      providentFundEmployeeRate > 1
    )
      throw new PayrollValidationError('providentFundEmployeeRate must be between 0 and 1');
    if (
      !Number.isFinite(providentFundEmployerRate) ||
      providentFundEmployerRate < 0 ||
      providentFundEmployerRate > 1
    )
      throw new PayrollValidationError('providentFundEmployerRate must be between 0 and 1');
  }

  if (country === 'NG' && nigeriaPension) {
    const { voluntaryEmployeeRate = 0, voluntaryEmployerRate = 0 } = nigeriaPension;
    if (
      !Number.isFinite(voluntaryEmployeeRate) ||
      voluntaryEmployeeRate < 0 ||
      voluntaryEmployeeRate > 1
    )
      throw new PayrollValidationError('voluntaryEmployeeRate must be between 0 and 1');
    if (
      !Number.isFinite(voluntaryEmployerRate) ||
      voluntaryEmployerRate < 0 ||
      voluntaryEmployerRate > 1
    )
      throw new PayrollValidationError('voluntaryEmployerRate must be between 0 and 1');
  }

  if (country === 'KE' && kenyaPension) {
    const { occupationalEmployeeRate = 0, occupationalEmployerRate = 0 } = kenyaPension;
    if (
      !Number.isFinite(occupationalEmployeeRate) ||
      occupationalEmployeeRate < 0 ||
      occupationalEmployeeRate > 1
    )
      throw new PayrollValidationError('occupationalEmployeeRate must be between 0 and 1');
    if (
      !Number.isFinite(occupationalEmployerRate) ||
      occupationalEmployerRate < 0 ||
      occupationalEmployerRate > 1
    )
      throw new PayrollValidationError('occupationalEmployerRate must be between 0 and 1');
  }
}

/** Round to 2 decimal places — matches backend Decimal.toDecimalPlaces(2, ROUND_HALF_UP). */
function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

/* ── PAYE Calculators ── */

/**
 * Ghana PAYE — monthly 2026 progressive bands.
 * The first GHS 490 zero-rate band IS the personal allowance.
 * Do NOT subtract 490 from taxableIncome before calling this function —
 * it is handled internally. Doing so would double-count the relief.
 */
function calculatePAYE_GH(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let r = taxableIncome;

  if (r <= 490) return 0;
  r -= 490;

  const b2 = Math.min(r, 110);
  tax += b2 * 0.05;
  r -= b2;
  const b3 = Math.min(r, 130);
  tax += b3 * 0.1;
  r -= b3;
  const b4 = Math.min(r, 3_166.67);
  tax += b4 * 0.175;
  r -= b4;
  const b5 = Math.min(r, 16_000);
  tax += b5 * 0.25;
  r -= b5;
  const b6 = Math.min(r, 30_520);
  tax += b6 * 0.3;
  r -= b6;
  if (r > 0) tax += r * 0.35;

  return r2(tax);
}

/** Nigeria PAYE — PITA 2011 annual bands applied to post-CRA taxable income. Returns annual tax. */
function calculatePAYE_NG(annualTaxable: number): number {
  if (annualTaxable <= 0) return 0;

  const bands = [
    { threshold: 300_000, rate: 0.07 },
    { threshold: 600_000, rate: 0.11 },
    { threshold: 1_100_000, rate: 0.15 },
    { threshold: 1_600_000, rate: 0.19 },
    { threshold: 3_200_000, rate: 0.21 },
    { threshold: Infinity, rate: 0.24 },
  ];

  let tax = 0,
    prev = 0;
  for (const band of bands) {
    const inBand = Math.min(annualTaxable, band.threshold) - prev;
    if (inBand > 0) tax += inBand * band.rate;
    prev = band.threshold;
    if (annualTaxable <= band.threshold) break;
  }

  return r2(tax);
}

/** Kenya NSSF — tiered 6% each side. */
function calculateNSSF_KE(basicSalary: number): { employee: number; employer: number } {
  const { nssfLowerLimit, nssfUpperLimit } = PAYROLL_CONFIG.KE;
  const tier1 = Math.min(basicSalary, nssfLowerLimit);
  const tier2 = Math.max(0, Math.min(basicSalary, nssfUpperLimit) - nssfLowerLimit);
  const contrib = r2((tier1 + tier2) * 0.06);
  return { employee: contrib, employer: contrib };
}

/** Kenya PAYE — monthly progressive bands with KRA personal relief credit. */
function calculatePAYE_KE(taxableIncome: number, personalRelief: number): number {
  if (taxableIncome <= 0) return 0;

  let grossTax = 0;
  let r = taxableIncome;

  const b1 = Math.min(r, 24_000);
  grossTax += b1 * 0.1;
  r -= b1;
  const b2 = Math.min(r, 8_333);
  grossTax += b2 * 0.25;
  r -= b2;
  const b3 = Math.min(r, 467_667);
  grossTax += b3 * 0.3;
  r -= b3;
  const b4 = Math.min(r, 300_000);
  grossTax += b4 * 0.325;
  r -= b4;
  if (r > 0) grossTax += r * 0.35;

  return r2(Math.max(0, grossTax - personalRelief));
}

/* ── Main Payroll Calculator ── */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  validateInput(input);

  const {
    country,
    basicSalary,
    allowances,
    otherDeductions = 0,
    // rentRelief = 0,
    ghanaPension = {},
    nigeriaPension = {},
    kenyaPension = {},
  } = input;

  const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
  const transportAllowance = allowances
    .filter(isTransportAllowance)
    .reduce((sum, a) => sum + a.amount, 0);
  const grossSalary = basicSalary + totalAllowances;

  let employeeStatutoryContrib = 0;
  let employerStatutoryContrib = 0;
  let tier1Contribution: number | undefined;
  let tier2Contribution: number | undefined;
  let tier2FundName: string | undefined;
  let voluntaryPensionEmployee: number | undefined;
  let voluntaryPensionEmployer: number | undefined;
  let voluntaryPensionName: string | undefined;
  let paye = 0;
  let taxableIncome = 0;
  let taxExemptTransport = 0;

  switch (country) {
    case 'GH': {
      const cfg = PAYROLL_CONFIG.GH;
      const insurable = Math.min(basicSalary, cfg.maxInsurableEarnings);

      // Tier 1 — SSNIT (employee 0.5%, employer 13%)
      const tier1Employee = r2(insurable * cfg.tier1EmployeeRate);
      employerStatutoryContrib = r2(insurable * cfg.tier1EmployerRate);
      tier1Contribution = tier1Employee;

      // Tier 2 — employee occupational pension (5%)
      tier2Contribution = r2(insurable * cfg.tier2EmployeeRate);
      tier2FundName = ghanaPension.tier2FundName;
      employeeStatutoryContrib = r2(tier1Employee + tier2Contribution);

      // Tier 3 — voluntary provident fund (both sides tax-deductible for employee)
      const pfEmployee = r2(basicSalary * (ghanaPension.providentFundEmployeeRate ?? 0));
      const pfEmployer = r2(basicSalary * (ghanaPension.providentFundEmployerRate ?? 0));

      if (pfEmployee > 0 || pfEmployer > 0) {
        voluntaryPensionEmployee = pfEmployee;
        voluntaryPensionEmployer = pfEmployer;
        voluntaryPensionName = ghanaPension.providentFundName;
      }

      // Taxable: gross minus SSNIT employee and Tier 3 employee (both pre-tax); transport is exempt
      // otherDeductions (loans, advances) are post-tax and do not reduce the PAYE base
      taxExemptTransport = transportAllowance;
      taxableIncome = Math.max(
        0,
        grossSalary - employeeStatutoryContrib - pfEmployee - taxExemptTransport,
      );
      paye = calculatePAYE_GH(taxableIncome);
      break;
    }

    case 'NG': {
      const cfg = PAYROLL_CONFIG.NG;
      employeeStatutoryContrib = r2(basicSalary * cfg.statutoryEmployeeRate);
      employerStatutoryContrib = r2(basicSalary * cfg.statutoryEmployerRate);

      const volEmployee = r2(basicSalary * (nigeriaPension.voluntaryEmployeeRate ?? 0));
      const volEmployer = r2(basicSalary * (nigeriaPension.voluntaryEmployerRate ?? 0));

      if (volEmployee > 0 || volEmployer > 0) {
        voluntaryPensionEmployee = volEmployee;
        voluntaryPensionEmployer = volEmployer;
        voluntaryPensionName = nigeriaPension.pfaName;
      }

      // taxableIncome for net salary: transport stays in (taxable in Nigeria)
      // otherDeductions (loans, advances) are post-tax and do not reduce the PAYE base
      taxableIncome = Math.max(0, grossSalary - employeeStatutoryContrib - volEmployee);
      // CRA (Consolidated Relief Allowance) reduces the PAYE tax base only, not take-home
      const annualGross = grossSalary * 12;
      const annualCRA = Math.max(200_000, annualGross * 0.01) + annualGross * 0.2;
      const annualTaxBase = Math.max(0, taxableIncome * 12 - annualCRA);
      const computedAnnualPAYE = calculatePAYE_NG(annualTaxBase);
      // Minimum tax: 1% of monthly gross (applies when income is very low)
      const minimumMonthlyPAYE = r2(grossSalary * 0.01);
      paye = Math.max(r2(computedAnnualPAYE / 12), minimumMonthlyPAYE);
      break;
    }

    case 'KE': {
      const nssf = calculateNSSF_KE(basicSalary);
      employeeStatutoryContrib = nssf.employee;
      employerStatutoryContrib = nssf.employer;

      const occEmployeeRaw = r2(basicSalary * (kenyaPension.occupationalEmployeeRate ?? 0));
      const occEmployer = r2(basicSalary * (kenyaPension.occupationalEmployerRate ?? 0));
      // Cap the deductible portion at the KES 20,000/month statutory exempt limit
      const occEmployeeDeductible = Math.min(
        occEmployeeRaw,
        PAYROLL_CONFIG.KE.occupationalExemptCap,
      );

      if (occEmployeeRaw > 0 || occEmployer > 0) {
        voluntaryPensionEmployee = occEmployeeRaw;
        voluntaryPensionEmployer = occEmployer;
        voluntaryPensionName = kenyaPension.schemeName;
      }

      // otherDeductions (loans, advances) are post-tax and do not reduce the PAYE base
      taxableIncome = Math.max(0, grossSalary - employeeStatutoryContrib - occEmployeeDeductible);
      paye = calculatePAYE_KE(taxableIncome, PAYROLL_CONFIG.KE.personalRelief);
      break;
    }
  }

  const netSalary = r2(taxableIncome + taxExemptTransport - paye - otherDeductions);
  const totalEmployerCost = r2(
    grossSalary + employerStatutoryContrib + (voluntaryPensionEmployer ?? 0),
  );

  return {
    basicSalary,
    allowances,
    totalAllowances,
    grossSalary,
    employeeStatutoryContrib,
    employerStatutoryContrib,
    tier1Contribution,
    tier2Contribution,
    tier2FundName,
    voluntaryPensionEmployee,
    voluntaryPensionEmployer,
    voluntaryPensionName,
    taxableIncome,
    paye,
    netSalary,
    totalEmployerCost,
    currency: PAYROLL_CONFIG[country].currency,
  };
}

/* ── UI Metadata ── */
export const COUNTRY_META: Record<
  Country,
  {
    label: string;
    flag: string;
    statutoryLabel: string;
    employeeRate: string;
    employerRate: string;
    tier2Label?: string;
    voluntaryLabel?: string;
    note?: string;
  }
> = {
  GH: {
    label: 'Ghana',
    flag: '🇬🇭',
    statutoryLabel: 'SSNIT Tier 1',
    employeeRate: '0.5%',
    employerRate: '13%',
    tier2Label: 'Tier 2 employee (5%)',
    voluntaryLabel: 'Tier 3 (provident fund)',
    note: 'Max insurable: GHS 69,000/month · Tier 2 is a 5% employee deduction on the payroll breakdown',
  },
  NG: {
    label: 'Nigeria',
    flag: '🇳🇬',
    statutoryLabel: 'Pension (PRA 2014)',
    employeeRate: '8%',
    employerRate: '10%',
    voluntaryLabel: 'Voluntary top-up',
    note: 'PAYE calculated annually then divided by 12',
  },
  KE: {
    label: 'Kenya',
    flag: '🇰🇪',
    statutoryLabel: 'NSSF',
    employeeRate: '6% (tiered)',
    employerRate: '6% (tiered)',
    voluntaryLabel: 'Occupational pension',
    note: 'Occupational pension exempt up to KES 20,000/month · Personal relief KES 2,400/month',
  },
};
