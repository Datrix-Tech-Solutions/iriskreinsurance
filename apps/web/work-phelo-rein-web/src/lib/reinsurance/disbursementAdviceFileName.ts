function slugifyName(value: string): string {
  return value
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** `advice_<reinsurer>_<name of insured>` — used for both the single disbursement advice
 *  download and each receipt bundled into the "Download all receipts" zip, so the two stay
 *  consistent. */
export function disbursementAdviceFileName(reinsurerName: string, insured: string): string {
  const party = slugifyName(reinsurerName) || 'reinsurer';
  const insuredSlug = slugifyName(insured) || 'insured';
  return `advice_${party}_${insuredSlug}`;
}

/** `advice_<cedant>_<name of insured>` — the zip archive's own file name. */
export function disbursementAdviceZipFileName(cedantName: string, insured: string): string {
  const cedant = slugifyName(cedantName) || 'cedant';
  const insuredSlug = slugifyName(insured) || 'insured';
  return `advice_${cedant}_${insuredSlug}`;
}
