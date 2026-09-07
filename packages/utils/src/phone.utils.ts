import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function formatGhanaPhone(phone: string): string {
  try {
    const parsed = parsePhoneNumber(phone, 'GH');
    return parsed.formatInternational();
  } catch {
    return phone;
  }
}

export function isValidPhone(phone: string, country = 'GH'): boolean {
  try {
    return isValidPhoneNumber(phone, country as any);
  } catch {
    return false;
  }
}
