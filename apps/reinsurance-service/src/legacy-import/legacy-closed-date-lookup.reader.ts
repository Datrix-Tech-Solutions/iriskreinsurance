import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import {
  LegacyClosedDateLookup,
  LegacyClosedDateLookupEntry,
} from './legacy-import.types';

export type LegacyClosedDateLookupFile = {
  sourceFilePath: string;
  sourceFileHash: string;
  entries: LegacyClosedDateLookup;
  ignoredLookupOnlyIds: string[];
};

export class LegacyClosedDateLookupReader {
  async read(
    sourceFilePath: string,
    allowedLegacyOfferIds?: Iterable<string>,
  ): Promise<LegacyClosedDateLookupFile> {
    const body = await readFile(sourceFilePath, 'utf8');
    const parsed = JSON.parse(body) as unknown;
    const allowed = allowedLegacyOfferIds
      ? new Set([...allowedLegacyOfferIds].map(String))
      : null;
    const entries = new Map<string, LegacyClosedDateLookupEntry>();
    const ignoredLookupOnlyIds: string[] = [];

    for (const raw of normalizeLookupRows(parsed)) {
      const legacyOfferId = clean(
        raw.legacyOfferId ?? raw.offer_id ?? raw.offerId,
      );
      if (!legacyOfferId) {
        throw new Error('Closed-date lookup row is missing legacyOfferId.');
      }
      if (allowed && !allowed.has(legacyOfferId)) {
        ignoredLookupOnlyIds.push(legacyOfferId);
        continue;
      }
      const closedDate = parseLegacyClosedDateOnly(
        clean(
          raw.closedDate ??
            raw.closed_date ??
            raw.dateClosed ??
            raw['Date Closed'],
        ),
      );
      if (entries.has(legacyOfferId)) {
        const existing = entries.get(legacyOfferId)!;
        if (existing.closedDate.getTime() !== closedDate.getTime()) {
          throw new Error(
            `Conflicting closed-date lookup values for legacy offer ${legacyOfferId}.`,
          );
        }
        continue;
      }
      entries.set(legacyOfferId, {
        legacyOfferId,
        closedDate,
        sourceFile: clean(raw.sourceFile ?? raw.source_file) ?? undefined,
        sourceRow: parseOptionalInteger(raw.sourceRow ?? raw.source_row),
        evidence:
          raw.evidence &&
          typeof raw.evidence === 'object' &&
          !Array.isArray(raw.evidence)
            ? (raw.evidence as Record<string, unknown>)
            : undefined,
      });
    }

    ignoredLookupOnlyIds.sort((left, right) => Number(left) - Number(right));
    return {
      sourceFilePath,
      sourceFileHash: createHash('sha256').update(body).digest('hex'),
      entries,
      ignoredLookupOnlyIds,
    };
  }
}

// Parses legacy report date-only values as UTC midnight; never rely on host local timezone.
export function parseLegacyClosedDateOnly(value: string | null): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `Invalid legacy closed date '${value ?? ''}'. Expected YYYY-MM-DD.`,
    );
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid legacy closed date '${value}'.`);
  }
  return parsed;
}

function normalizeLookupRows(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) {
    return parsed.filter(isRecord);
  }
  if (isRecord(parsed)) {
    return Object.entries(parsed).map(([key, value]) => {
      if (isRecord(value)) return { legacyOfferId: key, ...value };
      return { legacyOfferId: key, closedDate: value };
    });
  }
  throw new Error('Closed-date lookup source must be a JSON object or array.');
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'bigint'
  ) {
    return null;
  }
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function parseOptionalInteger(value: unknown): number | undefined {
  const cleaned = clean(value);
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
