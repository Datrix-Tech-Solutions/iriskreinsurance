/**
 * Builds the standard print-to-PDF document name, hyphen-separated:
 *   documentname-policynumber-risktype-insured-to recipientname
 * Empty parts are dropped and filesystem-unsafe characters are stripped.
 */
export function buildDocumentFileName(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => !!part && part.trim().length > 0)
    .map((part) => part.trim().replace(/[\\/:*?"<>|]/g, ''))
    .join('-');
}
