import { createHash } from 'crypto';

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function riskFieldDefinitionHash(input: {
  classId: string;
  key: string;
  normalizedKey: string;
}): string {
  return sha256({
    classId: input.classId,
    key: input.key,
    normalizedKey: input.normalizedKey,
  });
}
