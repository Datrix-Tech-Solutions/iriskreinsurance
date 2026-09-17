export const COUNTRY_OPTIONS = [
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Kenya', label: 'Kenya' },
];

export interface CountryConfig {
  dialCode: string;
  currency: string;
}

export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  Ghana: { dialCode: '+233', currency: 'GHS' },
  Nigeria: { dialCode: '+234', currency: 'NGN' },
  Kenya: { dialCode: '+254', currency: 'KES' },
};

const KNOWN_DIAL_CODES = Object.values(COUNTRY_CONFIG).map((c) => c.dialCode);

export function swapDialCode(phone: string, newCode: string): string {
  const matched = KNOWN_DIAL_CODES.find((c) => phone.startsWith(c));
  const number = matched ? phone.slice(matched.length) : phone.replace(/^\+\d+/, '');
  return newCode + number;
}

export const GHANA_REGION_OPTIONS = [
  { value: 'Ahafo', label: 'Ahafo' },
  { value: 'Ashanti', label: 'Ashanti' },
  { value: 'Bono', label: 'Bono' },
  { value: 'Bono East', label: 'Bono East' },
  { value: 'Central', label: 'Central' },
  { value: 'Eastern', label: 'Eastern' },
  { value: 'Greater Accra', label: 'Greater Accra' },
  { value: 'North East', label: 'North East' },
  { value: 'Northern', label: 'Northern' },
  { value: 'Oti', label: 'Oti' },
  { value: 'Savannah', label: 'Savannah' },
  { value: 'Upper East', label: 'Upper East' },
  { value: 'Upper West', label: 'Upper West' },
  { value: 'Volta', label: 'Volta' },
  { value: 'Western', label: 'Western' },
  { value: 'Western North', label: 'Western North' },
];

export const REGION_OPTIONS_BY_COUNTRY: Record<string, { value: string; label: string }[]> = {
  Ghana: GHANA_REGION_OPTIONS,
};

export const CURRENCY_OPTIONS = [
  { value: 'GHS', label: 'GHS – Ghana Cedi' },
  { value: 'NGN', label: 'NGN – Nigerian Naira' },
  { value: 'KES', label: 'KES – Kenyan Shilling' },
];

export const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1 – 10 employees' },
  { value: '11-50', label: '11 – 50 employees' },
  { value: '51-200', label: '51 – 200 employees' },
  { value: '201-500', label: '201 – 500 employees' },
  { value: '500+', label: '500+ employees' },
];

export const INDUSTRY_OPTIONS = [
  { value: 'Agriculture', label: 'Agriculture' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Logistics', label: 'Logistics' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Hospitality', label: 'Hospitality' },
  { value: 'Other', label: 'Other' },
];
