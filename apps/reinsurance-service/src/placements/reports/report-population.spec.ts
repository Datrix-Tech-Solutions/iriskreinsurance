import {
  assertReportExportLimit,
  reportPopulationTotal,
} from './report-population';
import { Prisma } from '../../../prisma/generated/client';

describe('Report population contract', () => {
  it('reuses the window count on nonempty pages without another SQL query', async () => {
    const reader = { $queryRaw: jest.fn() };
    expect(
      await reportPopulationTotal(
        reader,
        [{ totalCount: 51n }],
        Prisma.sql`WITH filtered AS (SELECT 1)`,
        Prisma.sql`filtered`,
      ),
    ).toBe(51);
    expect(reader.$queryRaw).not.toHaveBeenCalled();
  });
  it('counts the filtered population, not the empty page', async () => {
    const reader = { $queryRaw: jest.fn().mockResolvedValue([{ total: 51n }]) };
    expect(
      await reportPopulationTotal(
        reader,
        [],
        Prisma.sql`WITH filtered AS (SELECT 1)`,
        Prisma.sql`filtered`,
      ),
    ).toBe(51);
    expect(reader.$queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({ values: [] }),
    );
  });
  it('rejects silently truncated or over-expanded exports', () => {
    expect(() => assertReportExportLimit([{ totalCount: 50_001n }])).toThrow(
      'Export exceeds 50,000 rows',
    );
    expect(() =>
      assertReportExportLimit([{ totalCount: 50n }], 50_001),
    ).toThrow('Export exceeds 50,000 rows');
    expect(() =>
      assertReportExportLimit([{ totalCount: 50_000n }], 50_000),
    ).not.toThrow();
    expect(() => assertReportExportLimit([])).not.toThrow();
  });
});
