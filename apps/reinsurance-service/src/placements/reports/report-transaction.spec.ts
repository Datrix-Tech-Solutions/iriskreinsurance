import { performance } from 'node:perf_hooks';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  reportTransaction,
  ReportQueryReader,
  REPORT_TRANSACTION_OPTIONS,
} from './report-transaction';

jest.mock('node:perf_hooks', () => ({ performance: { now: jest.fn() } }));

describe('Report transaction deadlines', () => {
  const now = jest.spyOn(performance, 'now');
  function fixture() {
    const tx = {
      $executeRaw: jest
        .fn<Promise<number>, [Prisma.Sql]>()
        .mockResolvedValue(1),
      $queryRaw: jest
        .fn<Promise<unknown>, [Prisma.Sql]>()
        .mockResolvedValue([]),
    };
    const transaction = jest.fn(
      async (read: (reader: typeof tx) => Promise<unknown>) => read(tx),
    );
    const db = { $transaction: transaction } as unknown as PrismaService;
    return { tx, transaction, db };
  }
  beforeEach(() => {
    now.mockReset().mockReturnValue(0);
  });

  it('keeps a repeatable-read snapshot with one shrinking SQL budget', async () => {
    const { tx, transaction, db } = fixture();
    now
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1_000);
    const query = Prisma.sql`SELECT 1`;
    await reportTransaction(db, async (reader) => {
      await reader.$queryRaw(query);
      await reader.$queryRaw(query);
    });
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      REPORT_TRANSACTION_OPTIONS,
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(
      tx.$executeRaw.mock.calls.every(([sql]) =>
        sql.sql.includes("set_config('jit', 'off', true)"),
      ),
    ).toBe(true);
    expect(
      tx.$executeRaw.mock.calls.every(([sql]) =>
        sql.sql.includes(
          "set_config('plan_cache_mode', 'force_custom_plan', true)",
        ),
      ),
    ).toBe(true);
    expect(tx.$executeRaw.mock.calls.map(([sql]) => sql.values)).toEqual([
      ['15000ms'],
      ['14000ms'],
    ]);
    expect(
      tx.$executeRaw.mock.calls.every(([sql]) =>
        sql.sql.includes("set_config('statement_timeout', ?, true)"),
      ),
    ).toBe(true);
  });

  it('does not start another query after the deadline', async () => {
    const { tx, db } = fixture();
    now.mockReturnValueOnce(0).mockReturnValue(15_001);
    await expect(
      reportTransaction(db, (reader: ReportQueryReader) =>
        reader.$queryRaw(Prisma.sql`SELECT 1`),
      ),
    ).rejects.toMatchObject({
      response: { code: 'REPORT_EXECUTION_DEADLINE_EXCEEDED' },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it.each(['P2010', 'P2028', 'P2024'])(
    'returns a sanitized bounded failure for %s',
    async (code) => {
      const { tx, db } = fixture();
      tx.$queryRaw.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('private query diagnostics', {
          code,
          clientVersion: '5.22.0',
          meta: { code: '57014' },
        }),
      );
      await expect(
        reportTransaction(db, (reader) =>
          reader.$queryRaw(Prisma.sql`SELECT 1`),
        ),
      ).rejects.toMatchObject({
        status: 503,
        response: { code: 'REPORT_EXECUTION_DEADLINE_EXCEEDED' },
      });
    },
  );

  it('does not mask financial conflicts or other SQL errors', async () => {
    const { tx, db } = fixture();
    const error = new Error('Financial attribution conflict');
    tx.$queryRaw.mockRejectedValueOnce(error);
    await expect(
      reportTransaction(db, (reader) => reader.$queryRaw(Prisma.sql`SELECT 1`)),
    ).rejects.toBe(error);
  });
});
