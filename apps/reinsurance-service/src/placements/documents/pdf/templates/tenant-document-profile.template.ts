type UnknownRecord = Record<string, unknown>;

export type TenantDocumentProfileView = {
  identity: UnknownRecord | null;
  contact: UnknownRecord | null;
  footer: UnknownRecord | null;
  branding: UnknownRecord | null;
  banking: UnknownRecord | null;
  signatory: UnknownRecord | null;
};

export function tenantDocumentProfile(
  value: unknown,
): TenantDocumentProfileView | null {
  const profile = record(value);
  if (!profile) return null;
  return {
    identity: record(profile.identity),
    contact: record(profile.contact),
    footer: record(profile.footer),
    branding: record(profile.branding),
    banking: record(profile.banking),
    signatory: record(profile.signatory),
  };
}

export function profileAssetDataUri(
  branding: UnknownRecord | null,
  assetName: 'logo' | 'signature',
): string | null {
  const asset = record(branding?.[assetName]);
  const dataUri = asset?.dataUri;
  return typeof dataUri === 'string' && dataUri.startsWith('data:image/')
    ? dataUri
    : null;
}

export function profileColor(
  branding: UnknownRecord | null,
  key: string,
  fallback: string,
): string {
  const colors = record(branding?.colors);
  const color = colors?.[key];
  return typeof color === 'string' && /^#[\dA-F]{6}$/i.test(color)
    ? color
    : fallback;
}

export function profileContactParts(contact: UnknownRecord | null): string[] {
  return [
    contact?.physicalAddress,
    contact?.postalAddress,
    contact?.phone,
    contact?.email,
    contact?.website,
  ].filter((value): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export function profileDefaultAccounts(
  banking: UnknownRecord | null,
): UnknownRecord[] {
  return Array.isArray(banking?.defaultAccounts)
    ? banking.defaultAccounts
        .map(record)
        .filter((account): account is UnknownRecord => account !== null)
    : [];
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object'
    ? (value as UnknownRecord)
    : null;
}
