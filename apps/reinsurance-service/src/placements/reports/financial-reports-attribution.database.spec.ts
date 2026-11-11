import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ClosingSnapshotReader } from '../closings/closing-snapshot.reader';
import { PlacementFinancialPositionService } from '../finance/financial-position.service';
import { PlacementEffectivePositionService } from '../placement-effective-position.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { FacultativeReportService } from './facultative-report.service';
import { PremiumsReportService } from './premiums-report.service';
import { ReinsurersReportService } from './reinsurers-report.service';
import {
  createFinancialReportFixture,
  financialDatabaseDescribe,
  FinancialReportFixture,
} from './testing/financial-report-database.fixture';

// Opt-in only. The disposable test harness provisions the full current Prisma schema in
// a disposable local database. These tests never provision or access archives.
financialDatabaseDescribe(
  'Financial report payment attribution (PostgreSQL)',
  () => {
    let f: FinancialReportFixture;
    let premiums: PremiumsReportService;
    let facultative: FacultativeReportService;
    let reinsurers: ReinsurersReportService;

    beforeEach(async () => {
      f = await createFinancialReportFixture();
      const prisma = f.prisma as unknown as PrismaService;
      const money = new ReinsuranceMoneyHelper();
      premiums = new PremiumsReportService(prisma, money);
      facultative = new FacultativeReportService(prisma, money);
      reinsurers = new ReinsurersReportService(prisma, money);
    });

    afterEach(async () => {
      await f?.disconnect();
    });

    async function line() {
      const cp = await f.counterparty();
      const placement = await f.placement();
      const participant = await f.participant(placement.id, cp.id);
      const closing = await f.closing(placement.id, participant.id);
      return { cp, placement, participant, closing };
    }

    async function allocation(
      placementId: string,
      paymentId: string,
      noteId: string,
      amount: string,
      overrides: {
        allocatedCurrency?: string;
        obligationCurrency?: string;
        obligationAmount?: string;
      } = {},
    ) {
      return f.prisma.placementPaymentAllocation.create({
        data: {
          tenantId: f.tenantId,
          placementId,
          paymentId,
          noteId,
          allocatedAmount: amount,
          allocatedCurrency: 'GHS',
          obligationAmount: amount,
          obligationCurrency: 'GHS',
          createdByUserId: f.actorId,
          ...overrides,
        },
      });
    }

    async function reports() {
      const premium = await premiums.findPremiums(f.tenantId, {});
      const fac = await facultative.findFacultative(f.tenantId, {});
      const re = await reinsurers.findReinsurers(f.tenantId, {});
      return { premium, fac, re };
    }

    async function expectAllListsConflict() {
      // Empty pages must still run the guard, rather than silently returning [].
      for (const read of [
        () => premiums.findPremiums(f.tenantId, { page: 999 }),
        () => facultative.findFacultative(f.tenantId, { page: 999 }),
        () => reinsurers.findReinsurers(f.tenantId, { page: 999 }),
      ])
        await expect(read()).rejects.toBeInstanceOf(ConflictException);
    }

    it('attributes a null-participant closing payment once when a counterparty has two current roots', async () => {
      const { cp, placement, closing } = await line();
      const second = await f.participant(placement.id, cp.id, {
        role: 'CO_REINSURER',
      });
      const secondClosing = await f.closing(placement.id, second.id);
      await f.payment(placement.id, cp.id, { closingId: closing.id });

      const { premium, fac, re } = await reports();
      expect(premium.items[0].reinsurers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            closingId: closing.id,
            netPremium: 800,
            paidAmount: 300,
            outstandingAmount: 500,
          }),
          expect.objectContaining({
            closingId: secondClosing.id,
            netPremium: 800,
            paidAmount: 0,
            outstandingAmount: 800,
          }),
        ]),
      );
      expect(
        fac.items[0].reinsurers.map((row) => row.netPremiumPaid).sort(),
      ).toEqual([0, 300]);
      expect(
        fac.items[0].reinsurers.map((row) => row.closingId).sort(),
      ).toEqual([closing.id, secondClosing.id].sort());
      expect(re.items[0]).toMatchObject({
        participantCount: 2,
        payable: 1600,
        disbursed: 300,
        outstanding: 1300,
      });
      expect(premium.summary.totalsByCurrency[0]).toMatchObject({
        participantCount: 2,
        reinsurerPayable: 1600,
        reinsurerDisbursed: 300,
      });
    }, 30000);

    it.each([false, true])(
      'uses original/endorsement allocation pieces once (header source present: %s)',
      async (withHeader) => {
        const { cp, placement, closing } = await line();
        const end = await f.endorsement(placement.id);
        const ep = await f.endorsementParticipant(
          placement.id,
          end.id,
          cp.id,
          null,
        );
        const ec = await f.endorsementClosing(placement.id, end.id, ep.id);
        const originalNote = await f.note(placement.id, cp.id, {
          closingId: closing.id,
        });
        const endorsementNote = await f.note(placement.id, cp.id, {
          type: 'ENDORSEMENT_CREDIT_NOTE',
          endorsementClosingId: ec.id,
          endorsementId: end.id,
          endorsementParticipantId: ep.id,
        });
        const payment = await f.payment(
          placement.id,
          cp.id,
          withHeader ? { closingId: closing.id } : {},
        );
        await allocation(placement.id, payment.id, originalNote.id, '100');
        await allocation(placement.id, payment.id, endorsementNote.id, '200');

        const { premium, fac, re } = await reports();
        expect(premium.items[0].reinsurers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              closingId: closing.id,
              paidAmount: 100,
              outstandingAmount: 700,
            }),
            expect.objectContaining({
              closingId: ec.id,
              paidAmount: 200,
              outstandingAmount: 1000,
            }),
          ]),
        );
        expect(
          fac.items[0].reinsurers.map((row) => row.netPremiumPaid).sort(),
        ).toEqual([100, 200]);
        expect(re.items[0]).toMatchObject({
          participantCount: 2,
          payable: 2000,
          disbursed: 300,
          outstanding: 1700,
        });
      },
      30000,
    );

    it('combines original and successive endorsement installments on one current root', async () => {
      const { cp, placement, participant, closing } = await line();
      const first = await f.endorsement(placement.id);
      const firstEp = await f.endorsementParticipant(
        placement.id,
        first.id,
        cp.id,
        participant.id,
      );
      const firstClosing = await f.endorsementClosing(
        placement.id,
        first.id,
        firstEp.id,
      );
      const second = await f.endorsement(placement.id, {
        effectiveDate: new Date('2026-03-01T00:00:00Z'),
      });
      const secondEp = await f.endorsementParticipant(
        placement.id,
        second.id,
        cp.id,
        participant.id,
      );
      const current = await f.endorsementClosing(
        placement.id,
        second.id,
        secondEp.id,
        {
          premiumSnapshot: '1750',
          commissionAmount: '175',
          brokerageAmount: '175',
          netPremium: '1400',
        },
      );
      await f.payment(placement.id, cp.id, {
        closingId: closing.id,
        amount: '100',
      });
      await f.payment(placement.id, cp.id, {
        endorsementClosingId: firstClosing.id,
        amount: '200',
      });
      await f.payment(placement.id, cp.id, {
        endorsementClosingId: current.id,
        amount: '50',
      });

      const { premium, fac, re } = await reports();
      expect(premium.items[0].reinsurers).toHaveLength(1);
      expect(premium.items[0].reinsurers[0]).toMatchObject({
        closingId: current.id,
        netPremium: 1400,
        paidAmount: 350,
        outstandingAmount: 1050,
      });
      expect(fac.items[0].reinsurers).toHaveLength(1);
      expect(fac.items[0].reinsurers[0]).toMatchObject({
        netPremiumDueReinsurer: 1400,
        netPremiumPaid: 350,
      });
      expect(re.items[0]).toMatchObject({
        participantCount: 1,
        payable: 1400,
        disbursed: 350,
        outstanding: 1050,
      });
    }, 30000);

    it.each([false, true])(
      'preserves retired A credit separately from current B (participant supplied: %s)',
      async (withParticipant) => {
        const { cp: a, placement, participant, closing } = await line();
        const b = await f.counterparty('Replacement B');
        const end = await f.endorsement(placement.id);
        const ep = await f.endorsementParticipant(
          placement.id,
          end.id,
          b.id,
          participant.id,
        );
        const current = await f.endorsementClosing(placement.id, end.id, ep.id);
        await f.payment(placement.id, a.id, {
          closingId: closing.id,
          participantId: withParticipant ? participant.id : null,
        });
        const { premium, fac, re } = await reports();

        expect(re.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reinsurerId: a.id,
              participantCount: 0,
              payable: 0,
              disbursed: 300,
              outstanding: -300,
            }),
            expect.objectContaining({
              reinsurerId: b.id,
              participantCount: 1,
              payable: 1200,
              disbursed: 0,
              outstanding: 1200,
            }),
          ]),
        );
        expect(re.summary.totalParticipants).toBe(1);
        const paidOnly = await reinsurers.findReinsurers(f.tenantId, {
          paymentStatus: ['Paid'],
        });
        expect(paidOnly.items).toHaveLength(1);
        expect(paidOnly.items[0]).toMatchObject({
          reinsurerId: a.id,
          payable: 0,
          disbursed: 300,
          outstanding: -300,
          participantCount: 0,
        });
        expect(paidOnly.summary.totalParticipants).toBe(0);
        expect(premium.items[0].reinsurers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reinsurerId: a.id,
              closingId: closing.id,
              rowKind: 'SETTLEMENT_ONLY',
              grossPremium: 0,
              brokerageAmount: 0,
              netPremium: 0,
              paidAmount: 300,
              outstandingAmount: -300,
            }),
            expect.objectContaining({
              reinsurerId: b.id,
              closingId: current.id,
              netPremium: 1200,
              paidAmount: 0,
            }),
          ]),
        );
        expect(premium.summary.totalsByCurrency[0]).toMatchObject({
          participantCount: 1,
          grossPremium: 1500,
          brokerage: 150,
          reinsurerPayable: 1200,
          reinsurerDisbursed: 300,
          reinsurerOutstanding: 900,
        });
        expect(premium.summary.settlementCounts).toEqual({
          paid: 0,
          part: 0,
          outstanding: 1,
        });
        expect(
          fac.items[0].reinsurers.find((row) => row.reinsurerId === a.id),
        ).toMatchObject({
          rowKind: 'SETTLEMENT_ONLY',
          closingId: closing.id,
          facPremium: 0,
          brokerage: 0,
          netPremiumDueReinsurer: 0,
          netPremiumPaid: 300,
        });

        // Filtering a retired counterparty must retain its credit while counting no
        // current participants or contractual financial amounts.
        const selectedA = await facultative.findFacultative(f.tenantId, {
          reinsurerId: [a.id],
          scope: 'reinsurer',
        });
        expect(selectedA.items).toHaveLength(1);
        expect(selectedA.items[0].reinsurers).toHaveLength(1);
        expect(selectedA.summary.totalsByCurrency[0]).toMatchObject({
          participantCount: 0,
          premium: 0,
          brokerage: 0,
          commission: 0,
        });

        // PR51: selected B alone, receipt-date range, and paid brokerage cards.
        await f.payment(placement.id, f.cedant.id, {
          type: 'PREMIUM_RECEIVED',
          direction: 'INBOUND',
          amount: '1350',
          paymentDate: new Date('2026-03-02T00:00:00Z'),
        });
        const selectedB = await facultative.findFacultative(f.tenantId, {
          reinsurerId: [b.id],
          scope: 'reinsurer',
          dateField: 'premiumPaid',
          dateFrom: '2026-03-02',
          dateTo: '2026-03-02',
        });
        expect(selectedB.items).toHaveLength(1);
        expect(selectedB.items[0].reinsurers).toHaveLength(1);
        expect(selectedB.items[0].reinsurers[0]).toMatchObject({
          reinsurerId: b.id,
          brokeragePaid: 150,
        });
        expect(selectedB.summary.totalsByCurrency[0]).toMatchObject({
          participantCount: 1,
          premium: 1500,
          brokerage: 150,
        });
      },
      30000,
    );

    it('uses endorsement number before reversed IDs when effective and creation dates tie', async () => {
      const { cp: a, placement, participant, closing } = await line();
      const b = await f.counterparty('E001 reinsurer');
      const c = await f.counterparty('E002 reinsurer');
      const tiedDate = new Date('2026-02-01T00:00:00Z');
      const first = await f.endorsement(placement.id, {
        id: `f${randomUUID().slice(1)}`,
        endorsementNumber: 'E001',
        effectiveDate: tiedDate,
        createdAt: tiedDate,
      });
      const second = await f.endorsement(placement.id, {
        id: `0${randomUUID().slice(1)}`,
        endorsementNumber: 'E002',
        effectiveDate: tiedDate,
        createdAt: tiedDate,
      });
      expect(first.id > second.id).toBe(true);
      const firstEp = await f.endorsementParticipant(
        placement.id,
        first.id,
        b.id,
        participant.id,
      );
      const firstClosing = await f.endorsementClosing(
        placement.id,
        first.id,
        firstEp.id,
        { createdAt: tiedDate },
      );
      const secondEp = await f.endorsementParticipant(
        placement.id,
        second.id,
        c.id,
        participant.id,
      );
      const current = await f.endorsementClosing(
        placement.id,
        second.id,
        secondEp.id,
        {
          createdAt: tiedDate,
          premiumSnapshot: '2000',
          commissionAmount: '200',
          brokerageAmount: '200',
          netPremium: '1600',
        },
      );
      await f.payment(placement.id, a.id, {
        closingId: closing.id,
        amount: '300',
      });
      await f.payment(placement.id, b.id, {
        endorsementClosingId: firstClosing.id,
        amount: '200',
      });
      await f.payment(placement.id, c.id, {
        endorsementClosingId: current.id,
        amount: '400',
      });

      const asOf = new Date('2026-06-01T00:00:00Z');
      const money = new ReinsuranceMoneyHelper();
      const effective = new PlacementEffectivePositionService(
        new ClosingSnapshotReader(money),
      );
      const canonical = await f.prisma.$transaction((tx) =>
        effective.getEffectivePositionAtDate(
          tx,
          f.tenantId,
          placement.id,
          asOf,
        ),
      );
      expect(canonical.snapshots).toHaveLength(1);
      expect(canonical.snapshots[0]).toMatchObject({
        closingId: current.id,
        counterpartyId: c.id,
        netPremium: 1600,
      });
      const financial = new PlacementFinancialPositionService(
        f.prisma as unknown as PrismaService,
        money,
      );
      const position = await financial.getFinancialPosition(
        f.tenantId,
        placement.id,
        asOf,
      );
      expect(position.reinsurers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            counterpartyId: a.id,
            currentEffectivePayable: 0,
            paid: 300,
            outstanding: -300,
          }),
          expect.objectContaining({
            counterpartyId: b.id,
            currentEffectivePayable: 0,
            paid: 200,
            outstanding: -200,
          }),
          expect.objectContaining({
            counterpartyId: c.id,
            currentEffectivePayable: 1600,
            paid: 400,
            outstanding: 1200,
          }),
        ]),
      );

      const { premium, fac, re } = await reports();
      const currentRows = premium.items[0].reinsurers.filter(
        (row) => row.rowKind !== 'SETTLEMENT_ONLY',
      );
      expect(currentRows).toHaveLength(1);
      expect(currentRows[0]).toMatchObject({
        reinsurerId: c.id,
        closingId: current.id,
        netPremium: 1600,
        paidAmount: 400,
        outstandingAmount: 1200,
      });
      expect(
        premium.items[0].reinsurers.find((row) => row.reinsurerId === b.id),
      ).toMatchObject({
        closingId: firstClosing.id,
        rowKind: 'SETTLEMENT_ONLY',
        netPremium: 0,
        paidAmount: 200,
        outstandingAmount: -200,
      });
      expect(
        fac.items[0].reinsurers.filter(
          (row) => row.rowKind !== 'SETTLEMENT_ONLY',
        ),
      ).toEqual([
        expect.objectContaining({
          reinsurerId: c.id,
          closingId: current.id,
          netPremiumDueReinsurer: 1600,
          netPremiumPaid: 400,
        }),
      ]);
      for (const expected of position.reinsurers) {
        expect(
          re.items.find((row) => row.reinsurerId === expected.counterpartyId),
        ).toMatchObject({
          payable: expected.currentEffectivePayable,
          disbursed: expected.paid,
          outstanding: expected.outstanding,
        });
      }
      expect(re.summary.totalParticipants).toBe(1);
    }, 30000);

    it.each([
      ['future', false],
      ['future', true],
      ['unclosed', false],
      ['unclosed', true],
      ['void', false],
      ['void', true],
    ] as const)(
      'retains %s confirmed closing cash as settlement only (allocations: %s)',
      async (lifecycle, allocated) => {
        const { cp: a, placement, participant, closing } = await line();
        const b = await f.counterparty('Noncurrent cash payee');
        const endorsement = await f.endorsement(placement.id, {
          status:
            lifecycle === 'future'
              ? 'CLOSED'
              : lifecycle === 'void'
                ? 'VOID'
                : 'CLOSING',
          effectiveDate: new Date(
            lifecycle === 'future'
              ? '2099-02-01T00:00:00Z'
              : '2026-02-01T00:00:00Z',
          ),
        });
        // The operational payment source remains CONFIRMED even when its parent
        // is not a current obligation (including a subsequently void parent).
        const ep = await f.endorsementParticipant(
          placement.id,
          endorsement.id,
          b.id,
          participant.id,
        );
        const source = await f.endorsementClosing(
          placement.id,
          endorsement.id,
          ep.id,
        );
        const payment = await f.payment(
          placement.id,
          b.id,
          allocated ? {} : { endorsementClosingId: source.id },
        );
        if (allocated) {
          const note = await f.note(placement.id, b.id, {
            type: 'ENDORSEMENT_CREDIT_NOTE',
            endorsementId: endorsement.id,
            endorsementParticipantId: ep.id,
            endorsementClosingId: source.id,
          });
          await allocation(placement.id, payment.id, note.id, '300');
        }
        await f.payment(placement.id, b.id, {
          endorsementClosingId: source.id,
          status: 'RECORDED',
          amount: '100',
          bankConfirmedAt: null,
        });

        const financial = new PlacementFinancialPositionService(
          f.prisma as unknown as PrismaService,
          new ReinsuranceMoneyHelper(),
        );
        const position = await financial.getFinancialPosition(
          f.tenantId,
          placement.id,
          new Date('2026-06-01T00:00:00Z'),
        );
        expect(position.reinsurers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              counterpartyId: a.id,
              currentEffectivePayable: 800,
              paid: 0,
              outstanding: 800,
            }),
            expect.objectContaining({
              counterpartyId: b.id,
              currentEffectivePayable: 0,
              paid: 300,
              outstanding: -300,
            }),
          ]),
        );
        const { premium, fac, re } = await reports();
        expect(premium.items[0].reinsurers).toHaveLength(2);
        expect(premium.items[0].reinsurers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reinsurerId: a.id,
              closingId: closing.id,
              netPremium: 800,
              paidAmount: 0,
              outstandingAmount: 800,
            }),
            expect.objectContaining({
              reinsurerId: b.id,
              closingId: source.id,
              rowKind: 'SETTLEMENT_ONLY',
              grossPremium: 0,
              netPremium: 0,
              paidAmount: 300,
              outstandingAmount: -300,
            }),
          ]),
        );
        expect(premium.summary.totalsByCurrency[0]).toMatchObject({
          participantCount: 1,
          grossPremium: 1000,
          reinsurerPayable: 800,
          reinsurerDisbursed: 300,
          reinsurerOutstanding: 500,
        });
        expect(
          fac.items[0].reinsurers.find((row) => row.reinsurerId === b.id),
        ).toMatchObject({
          closingId: source.id,
          rowKind: 'SETTLEMENT_ONLY',
          facPremium: 0,
          brokerage: 0,
          netPremiumDueReinsurer: 0,
          netPremiumPaid: 300,
        });
        expect(re.items.find((row) => row.reinsurerId === b.id)).toMatchObject({
          participantCount: 0,
          payable: 0,
          disbursed: 300,
          pending: 100,
          outstanding: -300,
        });
        expect(re.items.find((row) => row.reinsurerId === a.id)).toMatchObject({
          participantCount: 1,
          payable: 800,
          disbursed: 0,
          outstanding: 800,
        });
        expect(re.summary.totalParticipants).toBe(1);
        const scoped = await facultative.findFacultative(f.tenantId, {
          reinsurerId: [b.id],
        });
        expect(scoped.items).toHaveLength(1);
        expect(scoped.items[0].reinsurers).toHaveLength(1);
        expect(scoped.items[0].reinsurers[0].closingId).toBe(source.id);
        expect(scoped.summary.totalsByCurrency[0]).toMatchObject({
          participantCount: 0,
          premium: 0,
          brokerage: 0,
        });
      },
      30000,
    );

    it('preserves historical overpayment as a negative balance', async () => {
      const { cp, placement, closing } = await line();
      await f.payment(placement.id, cp.id, {
        closingId: closing.id,
        amount: '1000',
      });
      const { premium, fac, re } = await reports();
      expect(re.items[0]).toMatchObject({
        payable: 800,
        disbursed: 1000,
        outstanding: -200,
      });
      expect(premium.items[0].reinsurers[0]).toMatchObject({
        paidAmount: 1000,
        outstandingAmount: -200,
      });
      expect(fac.items[0].reinsurers[0].netPremiumPaid).toBe(1000);
    }, 30000);

    it('keeps pending-only retired sources Pending and out of current participant counts', async () => {
      const { cp: a, placement, participant, closing } = await line();
      const b = await f.counterparty('Replacement with pending A');
      const end = await f.endorsement(placement.id);
      const ep = await f.endorsementParticipant(
        placement.id,
        end.id,
        b.id,
        participant.id,
      );
      await f.endorsementClosing(placement.id, end.id, ep.id);
      await f.payment(placement.id, a.id, {
        closingId: closing.id,
        status: 'RECORDED',
        bankConfirmedAt: null,
      });
      const pending = await reinsurers.findReinsurers(f.tenantId, {
        paymentStatus: ['Pending'],
      });
      expect(pending.items).toHaveLength(1);
      expect(pending.items[0]).toMatchObject({
        reinsurerId: a.id,
        participantCount: 0,
        payable: 0,
        disbursed: 0,
        pending: 300,
        outstanding: 0,
      });
      expect(pending.summary.totalParticipants).toBe(0);
      const paid = await reinsurers.findReinsurers(f.tenantId, {
        paymentStatus: ['Paid'],
      });
      expect(paid.items).toHaveLength(0);
      const outstanding = await reinsurers.findReinsurers(f.tenantId, {
        paymentStatus: ['Outstanding'],
      });
      expect(outstanding.items).toHaveLength(1);
      expect(outstanding.items[0]).toMatchObject({
        reinsurerId: b.id,
        participantCount: 1,
        payable: 1200,
        disbursed: 0,
      });
    }, 30000);

    it('separates pending cash and ignores reversals, cancellation and failure', async () => {
      const { cp, placement, closing } = await line();
      await f.payment(placement.id, cp.id, {
        closingId: closing.id,
        amount: '100',
      });
      await f.payment(placement.id, cp.id, {
        closingId: closing.id,
        amount: '200',
        status: 'RECORDED',
        bankConfirmedAt: null,
      });
      const reversed = await f.payment(placement.id, cp.id, {
        closingId: closing.id,
        amount: '300',
        status: 'REVERSED',
      });
      await f.payment(placement.id, cp.id, {
        closingId: closing.id,
        amount: '-300',
        status: 'RECORDED',
        reversalOfPaymentId: reversed.id,
      });
      await f.payment(placement.id, cp.id, {
        amount: '400',
        status: 'CANCELLED',
      });
      await f.payment(placement.id, cp.id, { amount: '500', status: 'FAILED' });
      const { premium, fac, re } = await reports();
      expect(re.items[0]).toMatchObject({
        payable: 800,
        disbursed: 100,
        pending: 200,
        outstanding: 700,
      });
      expect(premium.items[0].reinsurers[0]).toMatchObject({
        paidAmount: 100,
        outstandingAmount: 700,
      });
      expect(fac.items[0].reinsurers[0].netPremiumPaid).toBe(100);
    }, 30000);

    it('rejects conflicting closing sources at the database constraint before any report can use them', async () => {
      const { cp, placement, participant, closing } = await line();
      const end = await f.endorsement(placement.id);
      const ep = await f.endorsementParticipant(
        placement.id,
        end.id,
        cp.id,
        participant.id,
      );
      const ec = await f.endorsementClosing(placement.id, end.id, ep.id);
      await expect(
        f.payment(placement.id, cp.id, {
          closingId: closing.id,
          endorsementClosingId: ec.id,
        }),
      ).rejects.toThrow('PlacementPayment_one_closing_source_check');
      expect(
        await f.prisma.placementPayment.count({
          where: { tenantId: f.tenantId, placementId: placement.id },
        }),
      ).toBe(0);
      const { premium, fac, re } = await reports();
      expect(premium.items[0].reinsurers[0]).toMatchObject({
        closingId: ec.id,
        netPremium: 1200,
        paidAmount: 0,
      });
      expect(fac.items[0].reinsurers[0]).toMatchObject({
        closingId: ec.id,
        netPremiumDueReinsurer: 1200,
        netPremiumPaid: 0,
      });
      expect(re.items[0]).toMatchObject({
        payable: 1200,
        disbursed: 0,
        outstanding: 1200,
      });
    }, 30000);

    it.each([
      'unresolved',
      'ambiguous-participant',
      'counterparty-mismatch',
      'cross-placement',
      'source-fx',
      'settlement-fx',
      'allocation-mismatch',
      'allocation-fx',
      'unresolved-note',
    ] as const)(
      'fails closed for %s without inventing an allocation',
      async (kind) => {
        const { cp, placement, participant, closing } = await line();
        if (kind === 'unresolved') await f.payment(placement.id, cp.id);
        if (kind === 'ambiguous-participant') {
          await f.closing(placement.id, participant.id);
          await f.payment(placement.id, cp.id, {
            participantId: participant.id,
          });
        }
        if (kind === 'counterparty-mismatch') {
          const other = await f.counterparty('Other payee');
          await f.payment(placement.id, other.id, { closingId: closing.id });
        }
        if (kind === 'cross-placement') {
          const other = await f.placement();
          await f.payment(other.id, cp.id, { closingId: closing.id });
        }
        if (kind === 'source-fx' || kind === 'settlement-fx') {
          await f.payment(placement.id, cp.id, {
            closingId: closing.id,
            ...(kind === 'source-fx'
              ? { currency: 'USD' }
              : { settlementCurrency: 'USD' }),
            agreedExchangeRate: '10',
          });
        }
        if (
          kind === 'allocation-mismatch' ||
          kind === 'allocation-fx' ||
          kind === 'unresolved-note'
        ) {
          const note = await f.note(
            placement.id,
            cp.id,
            kind === 'unresolved-note' ? {} : { closingId: closing.id },
          );
          const payment = await f.payment(placement.id, cp.id, {
            closingId: closing.id,
          });
          await allocation(
            placement.id,
            payment.id,
            note.id,
            kind === 'allocation-mismatch' ? '100' : '300',
            kind === 'allocation-fx'
              ? { obligationCurrency: 'USD', obligationAmount: '30' }
              : {},
          );
        }
        await expectAllListsConflict();
        if (kind === 'unresolved') {
          for (const exportReport of [
            () => premiums.exportPremiumsCsv(f.tenantId, {}),
            () => facultative.exportFacultativeCsv(f.tenantId, {}),
            () => reinsurers.exportReinsurersCsv(f.tenantId, {}),
            () => premiums.exportPremiumsExcel(f.tenantId, {}),
            () => facultative.exportFacultativeExcel(f.tenantId, {}),
            () => reinsurers.exportReinsurersExcel(f.tenantId, {}),
          ])
            await expect(exportReport()).rejects.toBeInstanceOf(
              ConflictException,
            );
        }
      },
      30000,
    );

    it.each(['BANK_CONFIRMED', 'RECORDED'] as const)(
      'rejects foreign %s receipts only in reports that sum cedant cash',
      async (status) => {
        const { placement } = await line();
        await f.payment(placement.id, f.cedant.id, {
          type: 'PREMIUM_RECEIVED',
          direction: 'INBOUND',
          currency: 'USD',
          amount: '30',
          status,
          agreedExchangeRate: '10',
        });
        await expect(
          premiums.findPremiums(f.tenantId, {}),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(
          facultative.findFacultative(f.tenantId, {}),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(
          reinsurers.findReinsurers(f.tenantId, {}),
        ).resolves.toMatchObject({
          items: [expect.objectContaining({ payable: 800, disbursed: 0 })],
        });
      },
      30000,
    );

    it.each(['original', 'endorsement'] as const)(
      'rejects a USD current %s obligation under a GHS placement without any cash',
      async (sourceType) => {
        const cp = await f.counterparty();
        const placement = await f.placement();
        const participant = await f.participant(placement.id, cp.id);
        await f.closing(placement.id, participant.id, {
          currency: sourceType === 'original' ? 'USD' : 'GHS',
        });
        if (sourceType === 'endorsement') {
          const end = await f.endorsement(placement.id);
          const ep = await f.endorsementParticipant(
            placement.id,
            end.id,
            cp.id,
            participant.id,
          );
          await f.endorsementClosing(placement.id, end.id, ep.id, {
            currency: 'USD',
          });
        }
        expect(
          await f.prisma.placementPayment.count({
            where: { tenantId: f.tenantId },
          }),
        ).toBe(0);
        await expectAllListsConflict();
      },
      30000,
    );

    it('ignores ineffective foreign receipts and does not fail empty reports', async () => {
      const { placement } = await line();
      const reversed = await f.payment(placement.id, f.cedant.id, {
        type: 'PREMIUM_RECEIVED',
        direction: 'INBOUND',
        currency: 'USD',
        status: 'REVERSED',
      });
      await f.payment(placement.id, f.cedant.id, {
        type: 'PREMIUM_RECEIVED',
        direction: 'INBOUND',
        currency: 'USD',
        amount: '-300',
        status: 'RECORDED',
        reversalOfPaymentId: reversed.id,
      });
      await f.payment(placement.id, f.cedant.id, {
        type: 'PREMIUM_RECEIVED',
        direction: 'INBOUND',
        currency: 'USD',
        status: 'CANCELLED',
      });
      const { premium, fac } = await reports();
      expect(premium.items[0].paid).toBe(0);
      expect(fac.items[0].cedantFinancials.netPremiumDueIriskPaid).toBe(0);
      await expect(
        premiums.findPremiums(f.tenantId, { search: 'no-such-placement' }),
      ).resolves.toMatchObject({ items: [] });
    }, 30000);
  },
);
