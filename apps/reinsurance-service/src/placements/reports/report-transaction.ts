import { ServiceUnavailableException } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReportQueryReader {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
}

// Per-report limits only. The SQL deadline precedes Prisma's rollback deadline,
// and pool acquisition + both deadlines remain below the gateway's 30 seconds.
export const REPORT_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 2_000,
  timeout: 18_000,
} as const;
export const REPORT_SQL_BUDGET_MS = 15_000;

export async function reportTransaction<T>(
  prisma: Pick<PrismaService, '$transaction'>,
  read: (reader: ReportQueryReader) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(async (tx) => {
      const deadline = performance.now() + REPORT_SQL_BUDGET_MS;
      const reader: ReportQueryReader = {
        async $queryRaw<R>(query: Prisma.Sql): Promise<R> {
          const remaining = Math.floor(deadline - performance.now());
          if (remaining <= 0) throw reportDeadlineExceeded();
          // Transaction-local settings are safe with transaction/session pooling.
          // Recompute for every query, rather than granting each another 15s.
          // Tenant/date skew makes a cached generic plan unsafe for latency;
          // use measured parameter-specific plans only within this transaction.
          // PostgreSQL 16 JIT compilation alone took 2.5s on the scale guard.
          await tx.$executeRaw(
            Prisma.sql`SELECT
              set_config('statement_timeout', ${`${remaining}ms`}, true),
              set_config('plan_cache_mode', 'force_custom_plan', true),
              set_config('jit', 'off', true)`,
          );
          return tx.$queryRaw<R>(query);
        },
      };
      return read(reader);
    }, REPORT_TRANSACTION_OPTIONS);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2028' ||
        error.code === 'P2024' ||
        (error.code === 'P2010' && error.meta?.code === '57014'))
    ) {
      throw reportDeadlineExceeded();
    }
    throw error;
  }
}

function reportDeadlineExceeded(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'REPORT_EXECUTION_DEADLINE_EXCEEDED',
    message:
      'Report execution exceeded its deadline. Narrow the filters and retry.',
  });
}
