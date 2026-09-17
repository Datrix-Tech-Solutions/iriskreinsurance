import type { SearchSelectOption } from '@/components/atoms/SearchSelect';

/** Top-level country/territory options for counterparty location. */
export const COUNTRY_OPTIONS: SearchSelectOption[] = [
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Europe', label: 'Europe' },
  { value: 'Asia', label: 'Asia' },
  { value: 'USA', label: 'USA' },
  { value: 'Rest of the World', label: 'Rest of the World' },
];

/** Maps form label → 2-char API code (API enforces max 2 characters). */
const LABEL_TO_CODE: Record<string, string> = {
  Ghana: 'GH',
  Africa: 'AF',
  Europe: 'EU',
  Asia: 'AS',
  USA: 'US',
  'Rest of the World': 'RW',
};

const CODE_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(LABEL_TO_CODE).map(([label, code]) => [code, label]),
);

/** Convert a form country label (e.g. "Africa") to a 2-char API code (e.g. "AF"). */
export function countryToCode(label: string): string {
  return LABEL_TO_CODE[label] ?? label;
}

/** Convert a 2-char API code (e.g. "AF") back to the form label (e.g. "Africa"). */
export function codeToCountry(code: string): string {
  return CODE_TO_LABEL[code] ?? code;
}

export const GHANA_REGIONS: SearchSelectOption[] = [
  { value: 'Greater Accra', label: 'Greater Accra' },
  { value: 'Ashanti', label: 'Ashanti' },
  { value: 'Western', label: 'Western' },
  { value: 'Western North', label: 'Western North' },
  { value: 'Eastern', label: 'Eastern' },
  { value: 'Central', label: 'Central' },
  { value: 'Volta', label: 'Volta' },
  { value: 'Oti', label: 'Oti' },
  { value: 'Bono', label: 'Bono' },
  { value: 'Bono East', label: 'Bono East' },
  { value: 'Ahafo', label: 'Ahafo' },
  { value: 'Northern', label: 'Northern' },
  { value: 'Savannah', label: 'Savannah' },
  { value: 'North East', label: 'North East' },
  { value: 'Upper East', label: 'Upper East' },
  { value: 'Upper West', label: 'Upper West' },
];
