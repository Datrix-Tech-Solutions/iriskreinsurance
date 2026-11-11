import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { FacultativeReportService } from './facultative-report.service';
import { PremiumsReportService } from './premiums-report.service';
import { ReinsurersReportService } from './reinsurers-report.service';
import { assertPaymentAttribution } from './payment-attribution.sql';

describe('Payment attribution failure contract', () => {
  it('keeps a retired premium credit on its actual closing ID with a signed balance', async () => {
    const reader = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    reader.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'placement-1',
        placementId: 'placement-1',
        totalCount: 1,
        reinsurers: [
          {
            reinsurerId: 'A',
            reinsurerName: 'Retired A',
            closingId: 'proven-original-closing-A',
            rowKind: 'SETTLEMENT_ONLY',
            netPremium: '0',
            paidAmount: '300',
            outstandingAmount: '-300',
          },
          {
            reinsurerId: 'B',
            reinsurerName: 'Current B',
            closingId: 'endorsement-closing-B',
            netPremium: '1200',
            paidAmount: '0',
            outstandingAmount: '1200',
          },
        ],
      },
    ]);
    const transaction = jest.fn(
      async (run: (tx: typeof reader) => Promise<unknown>) => run(reader),
    );
    const service = new PremiumsReportService(
      { ...reader, $transaction: transaction } as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
    const result = await service.findPremiums('tenant-1', {});
    expect(result.items[0].reinsurers).toMatchObject([
      {
        reinsurerId: 'A',
        closingId: 'proven-original-closing-A',
        rowKind: 'SETTLEMENT_ONLY',
        netPremium: 0,
        paidAmount: 300,
        outstandingAmount: -300,
      },
      {
        reinsurerId: 'B',
        closingId: 'endorsement-closing-B',
        netPremium: 1200,
        paidAmount: 0,
        outstandingAmount: 1200,
      },
    ]);
    expect(result.items[0].reinsurers[1]).not.toHaveProperty('rowKind');
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('accepts a reconciled report with no attribution errors', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await expect(
      assertPaymentAttribution(
        prisma,
        Prisma.sql`WITH attribution_errors AS (
      SELECT NULL::text AS "paymentId", NULL::text AS "reason" WHERE FALSE
    )`,
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    'Unresolved source, ambiguous attribution or FX',
    'Allocations do not reconcile to payment header',
  ])('returns HTTP 409 for %s', async (reason) => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ paymentId: 'payment-1', reason }]),
    };
    await expect(
      assertPaymentAttribution(prisma, Prisma.sql``),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it.each(['reinsurers', 'premiums', 'facultative'] as const)(
    '%s refuses list and export before emitting any rows, including empty pages',
    async (kind) => {
      const queryRaw = jest
        .fn<
          Promise<Array<{ paymentId: string; reason: string }>>,
          [Prisma.Sql]
        >()
        .mockResolvedValue([
          {
            paymentId: 'payment-1',
            reason: 'Unresolved source, ambiguous attribution or FX',
          },
        ]);
      const reader = { $queryRaw: queryRaw };
      const prisma = {
        ...reader,
        $transaction: async (run: (tx: typeof reader) => Promise<unknown>) =>
          run(reader),
      } as unknown as PrismaService;
      const money = new ReinsuranceMoneyHelper();
      const service =
        kind === 'reinsurers'
          ? new ReinsurersReportService(prisma, money)
          : kind === 'premiums'
            ? new PremiumsReportService(prisma, money)
            : new FacultativeReportService(prisma, money);
      const list =
        service instanceof ReinsurersReportService
          ? () => service.findReinsurers('tenant-1', { page: 999 })
          : service instanceof PremiumsReportService
            ? () => service.findPremiums('tenant-1', { page: 999 })
            : () => service.findFacultative('tenant-1', { page: 999 });
      const csv =
        service instanceof ReinsurersReportService
          ? () => service.exportReinsurersCsv('tenant-1', {})
          : service instanceof PremiumsReportService
            ? () => service.exportPremiumsCsv('tenant-1', {})
            : () => service.exportFacultativeCsv('tenant-1', {});
      const excel =
        service instanceof ReinsurersReportService
          ? () => service.exportReinsurersExcel('tenant-1', {})
          : service instanceof PremiumsReportService
            ? () => service.exportPremiumsExcel('tenant-1', {})
            : () => service.exportFacultativeExcel('tenant-1', {});
      for (const call of [list, csv, excel]) {
        queryRaw.mockClear();
        await expect(call()).rejects.toBeInstanceOf(ConflictException);
        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(queryRaw.mock.calls[0][0].sql).toContain(
          'FROM attribution_errors LIMIT 1',
        );
      }
    },
  );
});
