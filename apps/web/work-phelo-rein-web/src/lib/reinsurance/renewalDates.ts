const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shifts a placement's cover period forward by its own duration, so a renewal
 * starts the day after the original expires and runs for the same length of time.
 */
export function computeRenewalPeriod(
  inceptionDate: string | null,
  expiryDate: string | null,
): { periodFrom: string; periodTo: string } {
  if (!inceptionDate || !expiryDate) return { periodFrom: '', periodTo: '' };

  const inception = new Date(inceptionDate);
  const expiry = new Date(expiryDate);
  const durationMs = expiry.getTime() - inception.getTime();

  const newInception = new Date(expiry.getTime() + DAY_MS);
  const newExpiry = new Date(newInception.getTime() + durationMs);

  const toISODate = (d: Date) => d.toISOString().slice(0, 10);
  return { periodFrom: toISODate(newInception), periodTo: toISODate(newExpiry) };
}
