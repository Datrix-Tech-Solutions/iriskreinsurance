import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  LegacyClosedDateLookupReader,
  parseLegacyClosedDateOnly,
} from '../legacy-closed-date-lookup.reader';

describe('LegacyClosedDateLookupReader', () => {
  it('parses date-only closed dates as deterministic UTC midnight', () => {
    expect(parseLegacyClosedDateOnly('2026-09-11').toISOString()).toBe(
      '2026-09-11T00:00:00.000Z',
    );
  });

  it('filters lookup-only IDs to keep the source file authoritative', async () => {
    const source = await writeLookup({
      '6740': { closedDate: '2026-09-11' },
      'lookup-only': { closedDate: '2026-09-12' },
    });

    const result = await new LegacyClosedDateLookupReader().read(source, [
      '6740',
    ]);

    expect([...result.entries.keys()]).toEqual(['6740']);
    expect(result.ignoredLookupOnlyIds).toEqual(['lookup-only']);
  });

  it('rejects malformed closed dates instead of guessing', async () => {
    const source = await writeLookup({
      '6740': { closedDate: '09/11/2026' },
    });

    await expect(
      new LegacyClosedDateLookupReader().read(source, ['6740']),
    ).rejects.toThrow('Invalid legacy closed date');
  });
});

async function writeLookup(value: unknown) {
  const dir = await mkdtemp(join(tmpdir(), 'legacy-closed-dates-'));
  const path = join(dir, 'lookup.json');
  await writeFile(path, JSON.stringify(value), 'utf8');
  return path;
}
