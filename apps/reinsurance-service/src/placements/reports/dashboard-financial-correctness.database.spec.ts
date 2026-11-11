import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClosingSnapshotReader } from '../closings/closing-snapshot.reader';
import { ReinsuranceDashboardService } from '../dashboard/dashboard.service';
import { QueryDashboardPeriodDto } from '../dashboard/query-dashboard-period.dto';
import { PlacementFinancialPositionService } from '../finance/financial-position.service';
import { PlacementEffectivePositionService } from '../placement-effective-position.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import {
  createFinancialReportFixture,
  financialDatabaseDescribe,
  FinancialReportFixture,
} from './testing/financial-report-database.fixture';

// Opt-in against the parent's preprovisioned current Prisma schema. The shared
// fixture validates FINANCIAL_REPORTS_TEST_DATABASE_URL; no setup or cleanup DDL.
financialDatabaseDescribe(
  'Dashboard financial correctness real PostgreSQL',
  () => {
    let f: FinancialReportFixture;
    let dashboard: ReinsuranceDashboardService;
    let effective: PlacementEffectivePositionService;
    let financial: PlacementFinancialPositionService;

    beforeEach(async () => {
      f = await createFinancialReportFixture();
      const prisma = f.prisma as unknown as PrismaService;
      const money = new ReinsuranceMoneyHelper();
      dashboard = new ReinsuranceDashboardService(prisma, money);
      effective = new PlacementEffectivePositionService(
        new ClosingSnapshotReader(money),
      );
      financial = new PlacementFinancialPositionService(prisma, money);
    });

    afterEach(async () => {
      await f?.disconnect();
    });

    type Money = Prisma.Decimal | string | number;
    const decimal = (value: Money) => new Prisma.Decimal(value);
    const amounts = (gross: Money, currency = 'GHS') => ({
      netPremium: decimal(gross).times('0.8').toDecimalPlaces(2),
      commissionAmount: decimal(gross).times('0.1').toDecimalPlaces(2),
      brokerageAmount: decimal(gross).times('0.1').toDecimalPlaces(2),
      currency,
    });

    async function original(
      gross: Money = 1000,
      currency = 'GHS',
      data: Partial<Prisma.PlacementUncheckedCreateInput> = {},
    ) {
      const placement = await f.placement({ currency, ...data });
      const counterparty = await f.counterparty(`Reinsurer ${randomUUID()}`);
      const participant = await f.participant(placement.id, counterparty.id);
      const closing = await f.closing(placement.id, participant.id, {
        grossPremium: gross,
        ...amounts(gross, currency),
      });
      return { placement, counterparty, participant, closing };
    }

    async function endorse(
      base: Awaited<ReturnType<typeof original>>,
      gross: Money,
      originalParticipantId: string | null = base.participant.id,
      data: Partial<Prisma.PlacementEndorsementUncheckedCreateInput> = {},
      closingData: Partial<Prisma.PlacementEndorsementClosingUncheckedCreateInput> = {},
    ) {
      const endorsement = await f.endorsement(base.placement.id, {
        effectiveDate: new Date('2020-02-01T00:00:00Z'),
        ...data,
      });
      // Same counterparty for additive coverage: identity, not counterparty, must
      // determine whether the original snapshot is replaced.
      const participant = await f.endorsementParticipant(
        base.placement.id,
        endorsement.id,
        base.counterparty.id,
        originalParticipantId,
      );
      const closing = await f.endorsementClosing(
        base.placement.id,
        endorsement.id,
        participant.id,
        {
          premiumSnapshot: gross,
          ...amounts(gross, base.placement.currency!),
          ...closingData,
        },
      );
      return { endorsement, participant, closing };
    }

    async function expectCanonical(
      placementIds: string[],
      query: QueryDashboardPeriodDto = {},
    ) {
      const asOf = new Date();
      const positions = await Promise.all(
        placementIds.map((id) =>
          effective.getEffectivePositionAtDate(f.prisma, f.tenantId, id, asOf),
        ),
      );
      const financialPositions = await Promise.all(
        placementIds.map((id) =>
          financial.getFinancialPosition(f.tenantId, id, asOf),
        ),
      );
      // Canonical services select the effective closing identities. Build the
      // money oracle from their persisted Decimal snapshots, not JS sums of
      // numbers returned by either the dashboard or the canonical services.
      const [originalClosings, endorsementClosings] = await Promise.all([
        f.prisma.placementClosing.findMany({
          where: {
            tenantId: f.tenantId,
            id: {
              in: positions.flatMap(
                (position) => position.sourcePlacementClosingIds,
              ),
            },
          },
          select: {
            grossPremium: true,
            netPremium: true,
            brokerageAmount: true,
            commissionAmount: true,
            currency: true,
          },
        }),
        f.prisma.placementEndorsementClosing.findMany({
          where: {
            tenantId: f.tenantId,
            id: {
              in: positions.flatMap(
                (position) => position.sourceEndorsementClosingIds,
              ),
            },
          },
          select: {
            premiumSnapshot: true,
            netPremium: true,
            brokerageAmount: true,
            commissionAmount: true,
            currency: true,
          },
        }),
      ]);
      const snapshots = [
        ...originalClosings.map((closing) => ({
          ...closing,
          premium: closing.grossPremium,
        })),
        ...endorsementClosings.map((closing) => ({
          ...closing,
          premium: closing.premiumSnapshot,
        })),
      ];
      const byCurrency = (
        field:
          | 'premium'
          | 'netPremium'
          | 'brokerageAmount'
          | 'commissionAmount',
      ) => {
        const totals = new Map<string, Prisma.Decimal>();
        for (const snapshot of snapshots) {
          const currency = snapshot.currency ?? 'UNKNOWN';
          totals.set(
            currency,
            (totals.get(currency) ?? decimal(0)).plus(snapshot[field] ?? 0),
          );
        }
        return [...totals]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([currency, amount]) => ({
            currency,
            amount: amount.toNumber(),
          }));
      };
      const sum = (
        field:
          | 'premium'
          | 'netPremium'
          | 'brokerageAmount'
          | 'commissionAmount',
      ) =>
        snapshots.reduce(
          (total, snapshot) => total.plus(snapshot[field] ?? 0),
          decimal(0),
        );
      const result = await dashboard.getFinancials(f.tenantId, query);
      expect(result).toMatchObject({
        grossPremium: sum('premium').toNumber(),
        netPremium: sum('netPremium').toNumber(),
        brokerage: sum('brokerageAmount').toNumber(),
        commission: sum('commissionAmount').toNumber(),
        outstanding: sum('netPremium').minus(decimal(result.paid)).toNumber(),
        grossPremiumByCurrency: byCurrency('premium'),
        netPremiumByCurrency: byCurrency('netPremium'),
        brokerageByCurrency: byCurrency('brokerageAmount'),
      });
      expect(result.netPremium).toBe(
        financialPositions
          .reduce(
            (total, position) =>
              position.reinsurers.reduce(
                (subtotal, reinsurer) =>
                  subtotal.plus(decimal(reinsurer.currentEffectivePayable)),
                total,
              ),
            decimal(0),
          )
          .toNumber(),
      );
      // Cedant obligation excludes commission; dashboard gross includes it.
      expect(
        decimal(result.grossPremium)
          .minus(decimal(result.commission))
          .toNumber(),
      ).toBe(
        financialPositions
          .reduce(
            (total, position) =>
              total.plus(decimal(position.cedant.currentObligation)),
            decimal(0),
          )
          .toNumber(),
      );
      return { result, positions };
    }

    it('uses original confirmed snapshots and ignores unconfirmed originals', async () => {
      const base = await original();
      await f.closing(base.placement.id, base.participant.id, {
        status: 'DRAFT',
        grossPremium: 99999,
      });
      const { result, positions } = await expectCanonical([base.placement.id]);
      expect(result).toMatchObject({
        grossPremium: 1000,
        netPremium: 800,
        brokerage: 100,
        commission: 100,
      });
      expect(positions[0].sourcePlacementClosingIds).toEqual([base.closing.id]);
    });

    it('replaces the affected original and preserves an unaffected participant', async () => {
      const base = await original();
      const other = await f.counterparty(`Unaffected ${randomUUID()}`);
      const participant = await f.participant(base.placement.id, other.id);
      const untouched = await f.closing(base.placement.id, participant.id, {
        grossPremium: 400,
        ...amounts(400),
      });
      const replacement = await endorse(base, 1500);
      const { result, positions } = await expectCanonical([base.placement.id]);
      expect(result).toMatchObject({ grossPremium: 1900, netPremium: 1520 });
      expect(positions[0].sourcePlacementClosingIds).toEqual([untouched.id]);
      expect(positions[0].sourceEndorsementClosingIds).toEqual([
        replacement.closing.id,
      ]);
    });

    it.each([
      [
        'future CLOSED',
        { status: 'CLOSED', effectiveDate: new Date('2099-01-01T00:00:00Z') },
        {},
      ],
      ['nonclosed', { status: 'DRAFT' }, {}],
      ['VOID endorsement', { status: 'VOID' }, {}],
      ['unconfirmed closing', { status: 'CLOSED' }, { status: 'DRAFT' }],
      ['VOID closing', { status: 'CLOSED' }, { status: 'VOID' }],
    ] as Array<
      [
        string,
        Partial<Prisma.PlacementEndorsementUncheckedCreateInput>,
        Partial<Prisma.PlacementEndorsementClosingUncheckedCreateInput>,
      ]
    >)('excludes %s', async (_label, endorsementData, closingData) => {
      const base = await original();
      await endorse(
        base,
        99999,
        base.participant.id,
        endorsementData,
        closingData,
      );
      const { result, positions } = await expectCanonical([base.placement.id]);
      expect(result.grossPremium).toBe(1000);
      expect(positions[0].sourceEndorsementClosingIds).toEqual([]);
    });

    it('adds a new participant without replacing the same counterparty original', async () => {
      const base = await original();
      const additive = await endorse(base, 300, null);
      const { result, positions } = await expectCanonical([base.placement.id]);
      expect(result).toMatchObject({ grossPremium: 1300, netPremium: 1040 });
      expect(positions[0].sourcePlacementClosingIds).toEqual([base.closing.id]);
      expect(positions[0].sourceEndorsementClosingIds).toEqual([
        additive.closing.id,
      ]);
    });

    it('applies sequential replacements by effective date despite reverse insertion order', async () => {
      const base = await original();
      const latest = await endorse(base, 1800, base.participant.id, {
        effectiveDate: new Date('2020-04-01T00:00:00Z'),
      });
      await endorse(base, 1500, base.participant.id, {
        effectiveDate: new Date('2020-02-01T00:00:00Z'),
      });
      const additive = await endorse(base, 200, null, {
        effectiveDate: new Date('2020-03-01T00:00:00Z'),
      });
      const { result, positions } = await expectCanonical([base.placement.id]);
      expect(result).toMatchObject({ grossPremium: 2000, netPremium: 1600 });
      expect(positions[0].sourcePlacementClosingIds).toEqual([]);
      expect(positions[0].sourceEndorsementClosingIds).toEqual([
        additive.closing.id,
        latest.closing.id,
      ]);
    });

    it('uses deterministic endorsement and closing tie breakers', async () => {
      const base = await original();
      const ids = [randomUUID(), randomUUID()].sort();
      const sameTime = new Date('2020-02-01T00:00:00Z');
      const latest = await endorse(base, 1800, base.participant.id, {
        id: ids[1],
        endorsementNumber: 'SYNTHETIC-B',
        createdAt: sameTime,
        effectiveDate: sameTime,
      });
      await endorse(base, 1500, base.participant.id, {
        id: ids[0],
        endorsementNumber: 'SYNTHETIC-A',
        createdAt: sameTime,
        effectiveDate: sameTime,
      });
      const closingIds = [randomUUID(), randomUUID()].sort();
      // Two confirmed closings for one endorsement participant are legal; the
      // later (createdAt, id) closing replaces the earlier one deterministically.
      const closingTime = new Date('2020-03-01T00:00:00Z');
      for (const [id, gross] of [
        [closingIds[1], 2100],
        [closingIds[0], 2000],
      ] as const) {
        await f.endorsementClosing(
          base.placement.id,
          latest.endorsement.id,
          latest.participant.id,
          {
            id,
            createdAt: closingTime,
            premiumSnapshot: gross,
            ...amounts(gross),
          },
        );
      }
      // Ensure the initial closing sorts before the additional tied closings.
      await f.prisma.placementEndorsementClosing.update({
        where: { id: latest.closing.id },
        data: { createdAt: sameTime },
      });
      const { result, positions } = await expectCanonical([base.placement.id]);
      expect(result).toMatchObject({ grossPremium: 2100, netPremium: 1680 });
      expect(positions[0].sourceEndorsementClosingIds).toEqual([closingIds[1]]);
    });

    it('keeps multiple currencies separate across originals and replacements', async () => {
      const ghs = await original();
      const usd = await original(500, 'USD');
      await endorse(ghs, 1500);
      await endorse(usd, 200, null);
      const { result } = await expectCanonical([
        ghs.placement.id,
        usd.placement.id,
      ]);
      expect(result.grossPremiumByCurrency).toEqual([
        { currency: 'GHS', amount: 1500 },
        { currency: 'USD', amount: 700 },
      ]);
      expect(result.outstandingByCurrency).toEqual([
        { currency: 'GHS', amount: 1200 },
        { currency: 'USD', amount: 560 },
      ]);
      expect(result.warnings).toContain(
        'Multiple currencies are present. Use the byCurrency fields for reliable financial reporting.',
      );
    });

    it('matches the exact Decimal oracle for fractional replacements, additions and payments', async () => {
      const base = await original('1000.10');
      const small = await original('0.10');
      await endorse(base, '1500.30');
      await endorse(base, '0.20', null, {
        effectiveDate: new Date('2020-03-01T00:00:00Z'),
      });
      for (const amount of ['0.10', '0.20']) {
        await f.payment(base.placement.id, f.cedant.id, {
          type: 'PREMIUM_RECEIVED',
          direction: 'INBOUND',
          amount,
        });
      }
      const { result } = await expectCanonical([
        base.placement.id,
        small.placement.id,
      ]);
      const gross = decimal('1500.30').plus('0.20').plus('0.10');
      const paid = decimal('0.10').plus('0.20');
      const net = gross.times('0.8');
      expect(result).toMatchObject({
        grossPremium: gross.toNumber(),
        netPremium: net.toNumber(),
        commission: gross.times('0.1').toNumber(),
        brokerage: gross.times('0.1').toNumber(),
        paid: paid.toNumber(),
        outstanding: net.minus(paid).toNumber(),
        outstandingByCurrency: [
          { currency: 'GHS', amount: net.minus(paid).toNumber() },
        ],
      });
    });

    it('filters the placement-createdAt cohort while applying its current effective position', async () => {
      const included = await original(1000, 'GHS', {
        createdAt: new Date('2020-01-15T00:00:00Z'),
      });
      const excluded = await original(99999, 'GHS', {
        createdAt: new Date('2020-02-15T00:00:00Z'),
      });
      const archived = await original(99999, 'GHS', {
        createdAt: new Date('2020-01-15T00:00:00Z'),
        archivedAt: new Date('2020-03-01T00:00:00Z'),
      });
      await endorse(included, 1500, included.participant.id, {
        effectiveDate: new Date('2020-06-01T00:00:00Z'),
      });
      await endorse(excluded, 99999);
      await endorse(archived, 99999);
      for (const [base, amount] of [
        [included, 100],
        [excluded, 9999],
        [archived, 9999],
      ] as const) {
        await f.payment(base.placement.id, f.cedant.id, {
          type: 'PREMIUM_RECEIVED',
          direction: 'INBOUND',
          amount,
          paymentDate: new Date('2020-07-01T00:00:00Z'),
          bankConfirmedAt: new Date('2020-07-01T00:00:00Z'),
        });
        await f.note(base.placement.id, base.counterparty.id);
      }
      const { result } = await expectCanonical([included.placement.id], {
        since: '2020-01-01T00:00:00Z',
        until: '2020-01-31T23:59:59.999Z',
      });
      expect(result).toMatchObject({
        grossPremium: 1500,
        netPremium: 1200,
        paid: 100,
        outstanding: 1100,
        noteCounts: { draft: 0, issued: 1, void: 0 },
      });
      expect(
        (await dashboard.getFinancials(f.tenantId, { since: '2099-01-01' }))
          .grossPremium,
      ).toBe(0);
    });

    it('counts only original BANK_CONFIRMED premium payments in the current balance', async () => {
      const base = await original();
      const paymentData = {
        type: 'PREMIUM_RECEIVED',
        direction: 'INBOUND',
      } as const;
      await f.payment(base.placement.id, f.cedant.id, {
        ...paymentData,
        amount: 300,
      });
      await f.payment(base.placement.id, f.cedant.id, {
        ...paymentData,
        amount: 999,
        status: 'RECORDED',
      });
      const reversed = await f.payment(base.placement.id, f.cedant.id, {
        ...paymentData,
        amount: 100,
        status: 'REVERSED',
      });
      await f.payment(base.placement.id, f.cedant.id, {
        ...paymentData,
        amount: '-100',
        status: 'RECORDED',
        bankConfirmedAt: null,
        bankConfirmedByUserId: null,
        reversalOfPaymentId: reversed.id,
      });
      await f.payment(base.placement.id, base.counterparty.id, { amount: 999 });
      const result = await dashboard.getFinancials(f.tenantId);
      expect(result).toMatchObject({ paid: 300, outstanding: 500 });
      expect(result.paidByCurrency).toEqual([{ currency: 'GHS', amount: 300 }]);
    });

    it('retains T1 recovery activity after a T2 reversal without subtracting twice from current balance', async () => {
      const base = await original();
      const claim = await f.claim(base.placement.id);
      const allocation = await f.allocation(
        base.placement.id,
        claim.id,
        base.counterparty.id,
        {
          placementClosingId: base.closing.id,
          participantId: base.participant.id,
        },
      );
      const cashCall = await f.cashCall(
        base.placement.id,
        claim.id,
        allocation.id,
        base.counterparty.id,
      );
      const receipt = (
        data: Partial<Prisma.PlacementClaimRecoveryReceiptUncheckedCreateInput>,
      ) =>
        f.receipt(
          base.placement.id,
          claim.id,
          allocation.id,
          cashCall.id,
          base.counterparty.id,
          data,
        );
      const t1 = new Date('2026-01-15T00:00:00Z');
      const t2 = new Date('2026-02-15T00:00:00Z');
      const originalAmount = decimal('100.10');
      const remainingAmount = decimal('80.20');
      const usdAmount = decimal('25.05');
      const originalReceipt = await receipt({
        amount: originalAmount,
        bankConfirmedAt: t1,
        paymentDate: t1,
      });
      await receipt({ amount: remainingAmount, bankConfirmedAt: t1 });
      await receipt({
        amount: usdAmount,
        currency: 'USD',
        bankConfirmedAt: t1,
      });
      const january = {
        since: '2026-01-01',
        until: '2026-01-31T23:59:59.999Z',
      };
      const february = {
        since: '2026-02-01',
        until: '2026-02-28T23:59:59.999Z',
      };
      const before = await dashboard.getClaims(f.tenantId, january);
      expect(before.recoveriesByCurrency).toEqual([
        {
          currency: 'GHS',
          amount: originalAmount.plus(remainingAmount).toNumber(),
        },
        { currency: 'USD', amount: usdAmount.toNumber() },
      ]);

      await f.prisma.placementClaimRecoveryReceipt.update({
        where: { id: originalReceipt.id },
        data: { status: 'REVERSED' },
      });
      await receipt({
        amount: originalAmount,
        status: 'BANK_CONFIRMED',
        reversalOfReceiptId: originalReceipt.id,
        bankConfirmedAt: t2,
        paymentDate: t2,
      });
      // Reversing an unconfirmed original leaves both bank confirmations null
      // and creates exactly one RECORDED child, as the live workflow does.
      const unconfirmedOriginal = await receipt({
        amount: 999,
        status: 'REVERSED',
        bankConfirmedAt: null,
        bankConfirmedByUserId: null,
      });
      await receipt({
        amount: 999,
        status: 'RECORDED',
        bankConfirmedAt: null,
        bankConfirmedByUserId: null,
        reversalOfReceiptId: unconfirmedOriginal.id,
      });

      const current = await dashboard.getClaims(f.tenantId);
      expect(current.recoveriesByCurrency).toEqual([
        { currency: 'GHS', amount: remainingAmount.toNumber() },
        { currency: 'USD', amount: usdAmount.toNumber() },
      ]);
      expect(
        (await dashboard.getClaims(f.tenantId, january)).recoveriesByCurrency,
      ).toEqual(before.recoveriesByCurrency);
      expect(
        (await dashboard.getClaims(f.tenantId, february)).recoveriesByCurrency,
      ).toEqual([
        { currency: 'GHS', amount: originalAmount.negated().toNumber() },
      ]);
      expect(
        (
          await dashboard.getClaims(f.tenantId, {
            since: january.since,
            until: february.until,
          })
        ).recoveriesByCurrency,
      ).toEqual(current.recoveriesByCurrency);
      expect(
        (await dashboard.getClaims(f.tenantId, { until: january.until }))
          .recoveriesByCurrency,
      ).toEqual(before.recoveriesByCurrency);
      expect(
        (await dashboard.getClaims(f.tenantId, { since: february.since }))
          .recoveriesByCurrency,
      ).toEqual([
        { currency: 'GHS', amount: originalAmount.negated().toNumber() },
      ]);
    });
  },
);
