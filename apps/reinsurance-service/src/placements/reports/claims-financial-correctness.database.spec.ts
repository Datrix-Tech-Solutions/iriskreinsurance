import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementClaimRecoveryReceiptsService } from '../claims/recoveries/recovery-receipts.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceClaimRowStateService } from '../worklists/claim-row-state.service';
import { ReinsuranceClaimsWorklistService } from '../worklists/claims-worklist.service';
import { ReinsuranceRecoveriesWorklistService } from '../worklists/recoveries-worklist.service';
import { ClaimsReportService } from './claims-report.service';
import {
  createFinancialReportFixture,
  financialDatabaseDescribe,
  FinancialReportFixture,
} from './testing/financial-report-database.fixture';

const confirmedAt = new Date('2026-03-01T00:00:00.000Z');
type ReceiptCase = {
  amount: Prisma.Decimal.Value;
  recorded?: boolean;
  reverse?: boolean;
};
type Position = {
  cashCallId: string;
  reinsurerId: string;
  liability: Prisma.Decimal;
  paid: Prisma.Decimal;
  reversed: Prisma.Decimal;
  recorded: Prisma.Decimal;
};

// The disposable test harness provisions the full current schema. This suite only creates
// synthetic tenant data through the guarded, disposable-database fixture.
financialDatabaseDescribe('Claims financial correctness (PostgreSQL)', () => {
  let f: FinancialReportFixture;
  const fixtures: FinancialReportFixture[] = [];

  beforeEach(async () => {
    f = await createFinancialReportFixture();
    fixtures.push(f);
  });

  afterEach(async () => {
    await Promise.all(
      fixtures.splice(0).map((fixture) => fixture.disconnect()),
    );
  });

  it.each<{ name: string; receipts: ReceiptCase[]; paid: string }>([
    { name: 'fully confirmed', receipts: [{ amount: 1000 }], paid: '1000' },
    { name: 'partially confirmed', receipts: [{ amount: 400 }], paid: '400' },
    {
      name: 'RECORDED only',
      receipts: [{ amount: 1000, recorded: true }],
      paid: '0',
    },
    {
      name: 'confirmed then reversed',
      receipts: [{ amount: 1000, reverse: true }],
      paid: '0',
    },
    {
      name: 'RECORDED then reversed',
      receipts: [{ amount: 1000, recorded: true, reverse: true }],
      paid: '0',
    },
    {
      name: 'mixed confirmed and reversed cash',
      receipts: [{ amount: 750 }, { amount: 250, reverse: true }],
      paid: '750',
    },
    {
      name: 'confirmed cash and reversed RECORDED receipt',
      receipts: [
        { amount: 750 },
        { amount: 250, recorded: true, reverse: true },
      ],
      paid: '750',
    },
    {
      name: 'multiple confirmed receipts',
      receipts: [{ amount: 400 }, { amount: 600 }],
      paid: '1000',
    },
    {
      name: 'fractional receipts with a positive linked reversal',
      receipts: [
        { amount: '0.10' },
        { amount: '0.20' },
        { amount: '999.70', reverse: true },
      ],
      paid: '0.30',
    },
    {
      name: 'replacement after reversal',
      receipts: [{ amount: 1000, reverse: true }, { amount: 1000 }],
      paid: '1000',
    },
  ])(
    '$name agrees across report SQL, row state, worklist and exports',
    async ({ receipts, paid }) => {
      const { placement, claim } = await seedClaim(f);
      const position = await seedPosition(
        f,
        placement.id,
        claim.id,
        1000,
        receipts,
      );
      expect(position.paid.equals(new Prisma.Decimal(paid))).toBe(true);
      await assertReads(f, claim.id, [position]);
    },
  );

  it('does not multiply claim totals across multiple reinsurers or receipt reversals', async () => {
    const { placement, claim } = await seedClaim(f);
    const first = await seedPosition(f, placement.id, claim.id, 600, [
      { amount: 300 },
      { amount: 300, recorded: true },
    ]);
    const second = await seedPosition(f, placement.id, claim.id, 400, [
      { amount: 400, reverse: true },
    ]);
    await assertReads(f, claim.id, [first, second]);
  });

  it('isolates report totals, exports, worklists and requested row states by tenant', async () => {
    const own = await seedClaim(f);
    const ownPosition = await seedPosition(
      f,
      own.placement.id,
      own.claim.id,
      1000,
      [{ amount: 400 }],
    );
    const other = await createFinancialReportFixture();
    fixtures.push(other);
    const foreign = await seedClaim(other);
    const foreignPosition = await seedPosition(
      other,
      foreign.placement.id,
      foreign.claim.id,
      1000,
      [{ amount: 1000 }],
    );

    await assertReads(f, own.claim.id, [ownPosition]);
    await assertReads(other, foreign.claim.id, [foreignPosition]);
    const states = await new ReinsuranceClaimRowStateService(
      f.prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    ).findRowState(f.tenantId, { claimIds: [own.claim.id, foreign.claim.id] });
    expect(states.items.map((row) => row.claimId)).toEqual([own.claim.id]);
    const report = new ClaimsReportService(
      f.prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
    expect(await report.exportClaimsCsv(f.tenantId, {})).not.toContain(
      foreign.claim.claimNumber,
    );
    expect(await report.exportClaimsExcel(f.tenantId, {})).not.toContain(
      foreign.claim.claimNumber,
    );
  });
});

async function seedClaim(f: FinancialReportFixture) {
  const placement = await f.placement({ facultativeOffer: '100' });
  const claim = await f.claim(placement.id, {
    estimatedLossAmount: '1000',
    finalLossAmount: '1000',
  });
  return { placement, claim };
}

async function seedPosition(
  f: FinancialReportFixture,
  placementId: string,
  claimId: string,
  liability: number,
  receipts: ReceiptCase[],
): Promise<Position> {
  const [claim, placement] = await Promise.all([
    f.prisma.placementClaim.findUniqueOrThrow({ where: { id: claimId } }),
    f.prisma.placement.findUniqueOrThrow({ where: { id: placementId } }),
  ]);
  const basisAmount = new Prisma.Decimal(claim.finalLossAmount!);
  const share = new Prisma.Decimal(liability).dividedBy(basisAmount);
  const signedLinePercent = share.times(100);
  const grossPremium = new Prisma.Decimal(placement.premium!).times(share);
  const commissionAmount = grossPremium.times('0.10');
  const brokerageAmount = grossPremium.times('0.10');
  const reinsurer = await f.counterparty();
  const participant = await f.participant(placementId, reinsurer.id, {
    signedLinePercent,
    sharePercent: signedLinePercent,
  });
  const closing = await f.closing(placementId, participant.id, {
    signedLinePercent,
    sharePercent: signedLinePercent,
    sumInsuredSnapshot: new Prisma.Decimal(placement.sumInsured!).times(share),
    grossPremium,
    commissionAmount,
    brokerageAmount,
    netPremium: grossPremium.minus(commissionAmount).minus(brokerageAmount),
  });
  const allocation = await f.allocation(placementId, claimId, reinsurer.id, {
    participantId: participant.id,
    placementClosingId: closing.id,
    basisAmount,
    signedLinePercent,
    allocatedEstimatedLossAmount: liability,
    allocatedFinalLossAmount: liability,
    cashCallAmount: liability,
  });
  const cashCall = await f.cashCall(
    placementId,
    claimId,
    allocation.id,
    reinsurer.id,
    { amount: liability, basisAmount, signedLinePercent },
  );
  const lifecycle = new PlacementClaimRecoveryReceiptsService(
    f.prisma as unknown as PrismaService,
    new ReinsuranceMoneyHelper(),
  );
  const actor: Parameters<PlacementClaimRecoveryReceiptsService['reverse']>[0] =
    {
      id: f.actorId,
      tenantId: f.tenantId,
      email: 'synthetic@example.com',
      role: 'EMPLOYEE',
      tenantSlug: 'synthetic',
      tenantName: 'Synthetic',
      firstName: 'Synthetic',
      moduleConfig: { operations: true },
      featureConfig: { operations: { reinsurance: true } },
      permissions: [],
    };
  for (const entry of receipts) {
    const original = await f.receipt(
      placementId,
      claimId,
      allocation.id,
      cashCall.id,
      reinsurer.id,
      {
        amount: entry.amount,
        status: entry.recorded ? 'RECORDED' : 'BANK_CONFIRMED',
        bankConfirmedAt: entry.recorded ? null : confirmedAt,
        bankConfirmedByUserId: entry.recorded ? null : f.actorId,
      },
    );
    if (!entry.reverse) continue;
    const reversal = await lifecycle.reverse(
      actor,
      placementId,
      claimId,
      original.id,
      {},
    );
    expect(reversal.reversalOfReceiptId).toBe(original.id);
    expect(reversal.amount.equals(new Prisma.Decimal(entry.amount))).toBe(true);
    expect(reversal).toMatchObject({
      tenantId: f.tenantId,
      placementId,
      claimId,
      allocationId: allocation.id,
      cashCallId: cashCall.id,
      counterpartyId: reinsurer.id,
      currency: 'GHS',
      status: entry.recorded ? 'RECORDED' : 'BANK_CONFIRMED',
    });
    expect(
      entry.recorded
        ? reversal.bankConfirmedAt === null
        : reversal.bankConfirmedAt !== null,
    ).toBe(true);
    const stored =
      await f.prisma.placementClaimRecoveryReceipt.findUniqueOrThrow({
        where: { id: original.id },
      });
    expect(stored.status).toBe('REVERSED');
    expect(stored.bankConfirmedAt).toEqual(original.bankConfirmedAt);
    await expect(
      lifecycle.reverse(actor, placementId, claimId, original.id, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      await f.prisma.placementClaimRecoveryReceipt.count({
        where: { tenantId: f.tenantId, reversalOfReceiptId: original.id },
      }),
    ).toBe(1);
  }
  return {
    cashCallId: cashCall.id,
    reinsurerId: reinsurer.id,
    liability: new Prisma.Decimal(liability),
    paid: receipts
      .filter((r) => !r.recorded && !r.reverse)
      .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0)),
    reversed: receipts
      .filter((r) => r.reverse)
      .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0)),
    recorded: receipts
      .filter((r) => r.recorded && !r.reverse)
      .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0)),
  };
}

async function assertReads(
  f: FinancialReportFixture,
  claimId: string,
  positions: Position[],
) {
  const prisma = f.prisma as unknown as PrismaService;
  const money = new ReinsuranceMoneyHelper();
  const report = new ClaimsReportService(prisma, money);
  const paid = positions.reduce(
    (sum, p) => sum.plus(p.paid),
    new Prisma.Decimal(0),
  );
  const liability = positions.reduce(
    (sum, p) => sum.plus(p.liability),
    new Prisma.Decimal(0),
  );
  const outstanding = liability.minus(paid);
  const bucket = outstanding.isZero() ? 'closed' : 'open';
  const recoveredAt = paid.greaterThan(0) ? confirmedAt.toISOString() : null;
  const claimsWorklist = new ReinsuranceClaimsWorklistService(prisma, money);
  for (const tab of ['notification', 'open', 'closed'] as const) {
    const claims = await claimsWorklist.findClaims(f.tenantId, {
      tab,
      page: 1,
      limit: 50,
    });
    expect(claims.meta.total).toBe(tab === bucket ? 1 : 0);
    expect(claims.items).toEqual(
      tab === bucket
        ? [
            expect.objectContaining({
              claimId,
              bucket,
              recoveredAmount: paid.toNumber(),
              recoveredAt,
              claimShare: liability.toNumber(),
              isFullyRecovered: outstanding.isZero(),
            }),
          ]
        : [],
    );
  }
  // These existing summary currency metrics intentionally cover open claims.
  const summary = await claimsWorklist.summarizeClaims(f.tenantId);
  expect(summary).toMatchObject({
    totalClaims: 1,
    notificationClaims: 0,
    openClaims: bucket === 'open' ? 1 : 0,
    closedClaims: bucket === 'closed' ? 1 : 0,
    openFinalizedClaims: bucket === 'open' ? 1 : 0,
    recoveredByCurrency:
      bucket === 'open' ? [{ code: 'GHS', amount: paid.toNumber() }] : [],
    outstandingRecoveredByCurrency:
      bucket === 'open'
        ? [{ code: 'GHS', amount: outstanding.toNumber() }]
        : [],
    claimsByCurrency:
      bucket === 'open' ? [{ code: 'GHS', amount: liability.toNumber() }] : [],
  });
  for (const scope of ['general', 'cedant', 'reinsurer'] as const) {
    // Execute each public query, including its summary/KPI queries, on PostgreSQL.
    const result = await report.findClaims(f.tenantId, { scope });
    expect(result.items).toHaveLength(
      scope === 'cedant' ? 1 : positions.length,
    );
    for (const row of result.items) {
      expect(row).toMatchObject({
        claimId,
        bucket,
        recoveredAmount: paid.toNumber(),
        recoveredAt,
        iriskSharePaid: paid.toNumber(),
        iriskShareOutstanding: outstanding.toNumber(),
      });
      if (scope !== 'cedant') {
        const position = positions.find(
          (p) => p.reinsurerId === row.reinsurerId,
        )!;
        expect(row).toMatchObject({
          reinsurerShareAmount: position.liability.toNumber(),
          reinsurerPaidAmount: position.paid.toNumber(),
          reinsurerOutstandingAmount: position.liability
            .minus(position.paid)
            .toNumber(),
        });
      }
    }
    expect(result.summary).toMatchObject({
      claimCount: 1,
      reinsurerCount: positions.length,
      openCount: bucket === 'open' ? 1 : 0,
      closedCount: bucket === 'closed' ? 1 : 0,
      recoveryCounts: {
        outstanding: paid.isZero() ? 1 : 0,
        part: paid.greaterThan(0) && outstanding.greaterThan(0) ? 1 : 0,
        full: outstanding.isZero() ? 1 : 0,
      },
    });
    expect(result.summary.totalsByCurrency).toEqual([
      expect.objectContaining({
        currency: 'GHS',
        claimCount: 1,
        claimAmount: 1000,
        iriskShareAmount: liability.toNumber(),
        bankConfirmedRecovery: paid.toNumber(),
        outstandingRecovery: outstanding.toNumber(),
        reinsurerShareAmount: liability.toNumber(),
        reinsurerPaidAmount: paid.toNumber(),
        reinsurerOutstandingAmount: outstanding.toNumber(),
      }),
    ]);
    const csv = await report.exportClaimsCsv(f.tenantId, { scope });
    const lines = csv.trim().split('\n').slice(1);
    expect(lines).toHaveLength(result.items.length);
    const excel = await report.exportClaimsExcel(f.tenantId, { scope });
    const excelRows = [...excel.matchAll(/<tr>(.*?)<\/tr>/g)].slice(1);
    expect(excelRows).toHaveLength(lines.length);
    lines.forEach((line, index) => {
      // Fixture strings contain no CSV delimiters or HTML-sensitive characters.
      const cells = line.split(',');
      expect(cells[12]).toBe(String(paid));
      expect(cells[13]).toBe(String(outstanding));
      if (scope !== 'cedant') {
        // Compare export financial cells directly with the corresponding SQL row.
        const row = result.items[index];
        expect(cells[14]).toBe(row.reinsurerName);
        const expected = positions.find(
          (p) => p.reinsurerId === row.reinsurerId,
        )!;
        expect(cells.slice(16, 19)).toEqual([
          expected.liability.toString(),
          expected.paid.toString(),
          expected.liability.minus(expected.paid).toString(),
        ]);
      }
      const excelCells = [
        ...excelRows[index][1].matchAll(/<td>(.*?)<\/td>/g),
      ].map((match) => match[1]);
      expect(excelCells).toEqual(cells);
    });
  }
  const states = await new ReinsuranceClaimRowStateService(
    prisma,
    money,
  ).findRowState(f.tenantId, { claimIds: [claimId] });
  expect(states.items).toEqual([
    expect.objectContaining({
      claimId,
      bucket,
      recoveredAmount: paid.toFixed(2),
      recoveredAt,
      isFullyRecovered: outstanding.isZero(),
    }),
  ]);
  const worklist = await new ReinsuranceRecoveriesWorklistService(
    prisma,
    money,
  ).findRecoveries(f.tenantId, { page: 1, limit: 50 });
  expect(worklist.items).toHaveLength(positions.length);
  for (const position of positions) {
    expect(
      worklist.items.find((row) => row.cashCallId === position.cashCallId),
    ).toMatchObject({
      claimId,
      confirmedAmount: position.paid.toNumber(),
      recoveredAmount: position.paid.toNumber(),
      outstandingAmount: position.liability.minus(position.paid).toNumber(),
      reversedAmount: position.reversed.toNumber(),
      recordedAmount: position.recorded.toNumber(),
    });
  }
  expect(worklist.summary.byCurrency).toEqual([
    expect.objectContaining({
      currency: 'GHS',
      calledAmount: liability.toNumber(),
      confirmedAmount: paid.toNumber(),
      outstandingAmount: outstanding.toNumber(),
    }),
  ]);
}
