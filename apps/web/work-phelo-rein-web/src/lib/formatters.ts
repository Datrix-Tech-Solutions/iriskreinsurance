/**
 * Format an ISO date string to "DD Mon YYYY" (e.g. "02 Apr 2025")
 */
export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime string to time only (e.g. "02:30 PM")
 */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a duration in minutes to a human-readable string (e.g. "2h 30m")
 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Format two ISO date strings as a range: "02 Apr 2025 – 10 Apr 2025"
 */
export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/**
 * Parse a holiday date string (MM-DD or legacy YYYY-MM-DD) into zero-based month and day.
 */
function parseHolidayParts(date: string): { month: number; day: number } {
  if (date.length === 5 && date[2] === '-') {
    return { month: parseInt(date.slice(0, 2), 10) - 1, day: parseInt(date.slice(3), 10) };
  }
  const d = new Date(date);
  return { month: d.getMonth(), day: d.getDate() };
}

/**
 * Resolve the year for a recurring holiday: current year if not yet passed, next year otherwise.
 */
function resolveYear(month: number, day: number): number {
  const today = new Date();
  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const candidate = new Date(today.getFullYear(), month, day);
  return candidate >= todayNorm ? today.getFullYear() : today.getFullYear() + 1;
}

/**
 * Format a holiday date as "25 December" (no year) or "25 December 2026" (with computed year).
 */
export function formatHolidayDate(date: string, withYear = false): string {
  const isSpecific = date.length === 10;
  const { month, day } = parseHolidayParts(date);
  if (withYear || isSpecific) {
    const year = isSpecific ? new Date(date).getFullYear() : resolveYear(month, day);
    return new Date(year, month, day).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return new Date(2000, month, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Returns the next upcoming Date for a holiday (for sorting and filtering on the dashboard).
 */
export function resolveHolidayUpcomingDate(date: string): Date {
  if (date.length === 5 && date[2] === '-') {
    const { month, day } = parseHolidayParts(date);
    return new Date(resolveYear(month, day), month, day);
  }
  return new Date(date);
}

/**
 * Backend journal number prefixes, shortened for display. The prefix marks
 * how the journal was created (see accounting-service journals.service.ts
 * #journalNumber): JE — entered via the New Journal Entry form, AUTO —
 * auto-posted by the source-event posting engine, REV — a reversal of
 * another journal.
 */
const JOURNAL_NUMBER_PREFIX_CODES: Record<string, string> = {
  JE: 'JE',
  AUTO: 'AU',
  REV: 'RE',
};

/**
 * Shortens a journal number's origin prefix for display
 * (e.g. "AUTO-20260816-4BB70E8D" -> "AU-20260816-4BB70E8D"). Unrecognized
 * prefixes pass through unchanged.
 */
export function formatJournalNumber(journalNumber: string): string {
  const [prefix, ...rest] = journalNumber.split('-');
  const shortPrefix = JOURNAL_NUMBER_PREFIX_CODES[prefix];
  return shortPrefix ? [shortPrefix, ...rest].join('-') : journalNumber;
}

/**
 * Returns a time-of-day greeting string.
 */
export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
