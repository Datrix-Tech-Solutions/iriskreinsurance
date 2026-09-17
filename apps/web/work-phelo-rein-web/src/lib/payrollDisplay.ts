export type PayrollCountry = 'GH' | 'NG' | 'KE';

export const PAYROLL_COUNTRY_OPTIONS: Array<{
  value: PayrollCountry;
  label: string;
  currency: string;
  dialCode: string;
}> = [
  { value: 'GH', label: 'Ghana', currency: 'GHS', dialCode: '+233' },
  { value: 'NG', label: 'Nigeria', currency: 'NGN', dialCode: '+234' },
  { value: 'KE', label: 'Kenya', currency: 'KES', dialCode: '+254' },
];

const DEFAULT_PAYROLL_COUNTRY: PayrollCountry = 'GH';

const COUNTRY_ALIASES: Record<string, PayrollCountry> = {
  gh: 'GH',
  gha: 'GH',
  ghana: 'GH',
  ng: 'NG',
  nga: 'NG',
  nigeria: 'NG',
  ke: 'KE',
  ken: 'KE',
  kenya: 'KE',
};

const DEFAULT_CURRENCY: Record<PayrollCountry, string> = {
  GH: 'GHS',
  NG: 'NGN',
  KE: 'KES',
};

const STATUTORY_LABELS: Record<
  PayrollCountry,
  {
    tabLabel: string;
    idLabel: string;
    employeeLabel: string;
    employerLabel: string;
    totalLabel: string;
    summaryLabel: string;
    tier2Label: string;
    missingIdLabel: string;
  }
> = {
  GH: {
    tabLabel: 'SSNIT',
    idLabel: 'SSNIT Number',
    employeeLabel: 'Employee SSNIT',
    employerLabel: 'Employer SSNIT',
    totalLabel: 'Total SSNIT',
    summaryLabel: 'Total SSNIT',
    tier2Label: 'Tier 2',
    missingIdLabel: 'missing SSNIT #',
  },
  NG: {
    tabLabel: 'Pension',
    idLabel: 'Pension ID',
    employeeLabel: 'Employee Pension',
    employerLabel: 'Employer Pension',
    totalLabel: 'Total Pension',
    summaryLabel: 'Total Pension',
    tier2Label: 'Additional Pension',
    missingIdLabel: 'missing pension ID',
  },
  KE: {
    tabLabel: 'NSSF',
    idLabel: 'NSSF Number',
    employeeLabel: 'Employee NSSF',
    employerLabel: 'Employer NSSF',
    totalLabel: 'Total NSSF',
    summaryLabel: 'Total NSSF',
    tier2Label: 'Additional Statutory',
    missingIdLabel: 'missing NSSF #',
  },
};

export function normalizePayrollCountry(value?: string | null): PayrollCountry {
  const normalized = value?.trim().toLowerCase() ?? '';
  return COUNTRY_ALIASES[normalized] ?? DEFAULT_PAYROLL_COUNTRY;
}

export function defaultPayrollCurrency(country?: string | null): string {
  return DEFAULT_CURRENCY[normalizePayrollCountry(country)];
}

export function resolvePayrollCurrency(currency?: string | null, country?: string | null): string {
  return currency?.trim().toUpperCase() || defaultPayrollCurrency(country);
}

export function formatPayrollMoney(
  value: string | number | null | undefined,
  currency?: string | null,
  country?: string | null,
) {
  if (value == null) return '—';
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(amount)) return '—';

  return `${resolvePayrollCurrency(currency, country)} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getPayrollLabels(country?: string | null) {
  return STATUTORY_LABELS[normalizePayrollCountry(country)];
}
