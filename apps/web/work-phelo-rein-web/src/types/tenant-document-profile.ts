export const DOCUMENT_PROFILE_CURRENCIES = [
  'GHS',
  'USD',
  'EUR',
  'GBP',
  'NGN',
  'KES',
  'ZAR',
  'XOF',
  'XAF',
] as const;

export type DocumentProfileCurrency = (typeof DOCUMENT_PROFILE_CURRENCIES)[number];

export interface TenantBankAccount {
  id: string;
  tenantId: string;
  bankName: string;
  branchName: string | null;
  accountName: string;
  accountNumber: string;
  currency: string;
  swiftCode: string | null;
  sortCode: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantDocumentProfile {
  id: string | null;
  tenantId: string;
  displayName: string;
  legalName: string;
  registrationNumber: string | null;
  taxNumber: string | null;
  physicalAddress: string | null;
  postalAddress: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  footerText: string | null;
  defaultCurrency: string;
  logoObjectKey: string | null;
  logoMimeType: string | null;
  logoFileName: string | null;
  logoSizeBytes: number | null;
  signatureObjectKey: string | null;
  signatureMimeType: string | null;
  signatureFileName: string | null;
  signatureSizeBytes: number | null;
  /** Short-lived signed URL for the uploaded signature image. */
  signatureUrl?: string | null;
  signatureUrlExpiresAt?: string | null;
  authorizedSignatoryName: string | null;
  authorizedSignatoryTitle: string | null;
  isActive: boolean;
  version: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  defaultsApplied: boolean;
  bankAccounts: TenantBankAccount[];
}

export interface UpsertTenantDocumentProfilePayload {
  displayName?: string;
  legalName?: string;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  physicalAddress?: string | null;
  postalAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  footerText?: string | null;
  defaultCurrency?: string;
  authorizedSignatoryName?: string | null;
  authorizedSignatoryTitle?: string | null;
}

export interface TenantBankAccountPayload {
  bankName: string;
  branchName?: string | null;
  accountName: string;
  accountNumber: string;
  currency: string;
  swiftCode?: string | null;
  sortCode?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}
