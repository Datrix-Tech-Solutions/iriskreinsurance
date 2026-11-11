import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';

/** Existing window counts are reused. Empty pages count the same filtered CTE,
 * in the caller's repeatable-read snapshot, without sorting or pagination. */
export async function reportPopulationTotal(
  reader: Pick<Prisma.TransactionClient, '$queryRaw'>,
  rows: ReadonlyArray<{ totalCount: bigint | number | string }>,
  ctes: Prisma.Sql,
  relation: Prisma.Sql,
): Promise<number> {
  if (rows.length) return Number(rows[0].totalCount);
  const counts = await reader.$queryRaw<Array<{ total: bigint }>>(
    Prisma.sql`${ctes} SELECT COUNT(*) AS "total" FROM ${relation}`,
  );
  return Number(counts[0]?.total ?? 0);
}

export const REPORT_EXPORT_LIMIT = 50_000;

/** Refuse an incomplete export; never present a truncated file as complete. */
export function assertReportExportLimit(
  rows: ReadonlyArray<{ totalCount: bigint | number | string }>,
  exportedRows = rows.length,
): void {
  if (
    Number(rows[0]?.totalCount ?? 0) > REPORT_EXPORT_LIMIT ||
    exportedRows > REPORT_EXPORT_LIMIT
  ) {
    throw new BadRequestException({
      code: 'REPORT_EXPORT_LIMIT_EXCEEDED',
      message:
        'Export exceeds 50,000 rows. Narrow the applied report filters and retry.',
    });
  }
}
