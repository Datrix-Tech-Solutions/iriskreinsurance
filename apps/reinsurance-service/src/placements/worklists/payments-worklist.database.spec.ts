import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PlacementEffectiveViewService } from '../placement-effective-view.service';
import {
  createFinancialReportFixture,
  financialDatabaseDescribe,
  FinancialReportFixture,
} from '../reports/testing/financial-report-database.fixture';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsurancePaymentsWorklistService } from './payments-worklist.service';

financialDatabaseDescribe('Payments worklist SQL (PostgreSQL)', () => {
  let f: FinancialReportFixture;
  let service: ReinsurancePaymentsWorklistService;

  beforeEach(async () => {
    f = await createFinancialReportFixture();
    service = new ReinsurancePaymentsWorklistService(
      f.prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
      {
        getEffectiveView: jest
          .fn()
          .mockRejectedValue(new Error('No endorsement')),
      } as unknown as PlacementEffectiveViewService,
    );
  });

  afterEach(async () => f?.disconnect());

  async function placementWithClosing() {
    const reinsurer = await f.counterparty();
    const placement = await f.placement();
    const participant = await f.participant(placement.id, reinsurer.id);
    await f.closing(placement.id, participant.id);
    return placement;
  }

  it('executes the complete list and status-selector SQL for an empty tenant', async () => {
    const result = await service.findPayments(f.tenantId, {
      page: 1,
      limit: 10,
    });
    expect(result).toEqual({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    await expect(
      service.findPlacementIdsByPaymentStatus(f.tenantId, ['Outstanding']),
    ).resolves.toEqual([]);
  });

  it.each([
    {
      status: null,
      amount: '0',
      expected: 'Outstanding',
      paid: 0,
      outstanding: 800,
    },
    {
      status: 'RECORDED',
      amount: '300',
      expected: 'Pending',
      paid: 0,
      outstanding: 800,
    },
    {
      status: 'BANK_CONFIRMED',
      amount: '300',
      expected: 'Part Payment',
      paid: 300,
      outstanding: 500,
    },
    {
      status: 'BANK_CONFIRMED',
      amount: '800',
      expected: 'Paid',
      paid: 800,
      outstanding: 0,
    },
  ] as const)(
    'returns $expected using actual premium cash with deductions',
    async (test) => {
      const placement = await placementWithClosing();
      if (test.status) {
        await f.payment(placement.id, f.cedant.id, {
          type: 'PREMIUM_RECEIVED',
          direction: 'INBOUND',
          participantId: null,
          closingId: null,
          amount: test.amount,
          status: test.status,
        });
      }
      const result = await service.findPayments(f.tenantId, {
        page: 1,
        limit: 10,
        status: test.expected,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        placementId: placement.id,
        paymentStatus: test.expected,
        currentObligation: 900,
        mandatoryDeductions: 100,
        paidAmount: test.paid,
        outstandingAmount: test.outstanding,
        acceptedParticipantCount: 1,
      });
      await expect(
        service.findPlacementIdsByPaymentStatus(f.tenantId, [test.expected]),
      ).resolves.toEqual([placement.id]);
    },
  );

  it('keeps pagination, tenant isolation and parameterized filters in the executed query', async () => {
    const first = await placementWithClosing();
    const second = await placementWithClosing();
    const page = await service.findPayments(f.tenantId, { page: 2, limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    const filtered = await service.findPayments(f.tenantId, {
      page: 1,
      limit: 10,
      placementIds: [first.id],
      cedantId: f.cedant.id,
      search: first.reference,
      status: 'Closed',
    });
    expect(filtered.items.map((row) => row.placementId)).toEqual([first.id]);
    expect(filtered.items.some((row) => row.placementId === second.id)).toBe(
      false,
    );
    const injection = await service.findPayments(f.tenantId, {
      page: 1,
      limit: 10,
      search: "' OR TRUE --",
    });
    expect(injection.items).toEqual([]);
    const foreign = await service.findPayments(randomUUID(), {
      page: 1,
      limit: 10,
      placementIds: [first.id],
    });
    expect(foreign.items).toEqual([]);
    await expect(
      service.findPlacementIdsByPaymentStatus(randomUUID(), ['Outstanding']),
    ).resolves.toEqual([]);
  });
});
