import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { reportTransaction } from './report-transaction';
import {
  createFinancialReportFixture,
  financialDatabaseDescribe,
} from './testing/financial-report-database.fixture';

financialDatabaseDescribe('Report transaction reliability (PostgreSQL)', () => {
  it('cancels SQL before Prisma expires, rolls back and releases the connection', async () => {
    const f = await createFinancialReportFixture();
    try {
      const start = Date.now();
      await expect(
        reportTransaction(f.prisma as unknown as PrismaService, (reader) =>
          reader.$queryRaw(Prisma.sql`SELECT pg_sleep(30)::text`),
        ),
      ).rejects.toMatchObject({
        status: 503,
        response: { code: 'REPORT_EXECUTION_DEADLINE_EXCEEDED' },
      });
      expect(Date.now() - start).toBeLessThan(20_000);
      const [settings] = await f.prisma.$queryRaw<
        Array<{ timeout: string; plan: string; jit: string }>
      >(
        Prisma.sql`SELECT current_setting('statement_timeout') AS timeout, current_setting('plan_cache_mode') AS plan, current_setting('jit') AS jit`,
      );
      expect(settings.timeout).toBe('0');
      expect(settings.plan).toBe('auto');
      expect(settings.jit).toBe('on');
      // The connection is usable after the aborted, rolled-back transaction.
      await expect(
        f.prisma.placement.count({ where: { tenantId: f.tenantId } }),
      ).resolves.toBe(0);
    } finally {
      await f.disconnect();
    }
  }, 25_000);

  it('holds rows and counts in one snapshot while another connection writes a synthetic fixture', async () => {
    const f = await createFinancialReportFixture();
    try {
      await reportTransaction(
        f.prisma as unknown as PrismaService,
        async (reader) => {
          expect(
            await reader.$queryRaw(Prisma.sql`
            SELECT current_setting('plan_cache_mode') AS plan, current_setting('jit') AS jit
          `),
          ).toEqual([{ plan: 'force_custom_plan', jit: 'off' }]);
          const count = () =>
            reader.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS count FROM reinsurance."Placement" WHERE "tenantId"=${f.tenantId}
        `);
          expect(await count()).toEqual([{ count: 0n }]);
          await f.placement();
          expect(await count()).toEqual([{ count: 0n }]);
        },
      );
      expect(
        await f.prisma.placement.count({ where: { tenantId: f.tenantId } }),
      ).toBe(1);
    } finally {
      await f.disconnect();
    }
  });
});
