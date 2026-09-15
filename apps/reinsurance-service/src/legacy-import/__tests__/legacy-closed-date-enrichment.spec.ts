import {
  LEGACY_CLOSED_DATE_ENRICHMENT_TRANSACTION_OPTIONS,
  LegacyClosedDateEnrichment,
} from '../legacy-closed-date-enrichment';
import { parseLegacyClosedDateOnly } from '../legacy-closed-date-lookup.reader';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyClosedDateEnrichment', () => {
  it('plans updates for imported closings with null confirmedAt', async () => {
    const { prisma } = prismaMock({ confirmedAt: null });

    const plan = await new LegacyClosedDateEnrichment(prisma).plan({
      tenantId: 'tenant-1',
      sourceOffers: [offer()],
      closedDateLookup: lookup([['6740', '2026-09-11']]),
    });

    expect(plan.counts).toEqual({
      update: 1,
      skip: 0,
      conflict: 0,
      no_action: 0,
    });
    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        legacyOfferId: '6740',
        action: 'update',
        closedDate: '2026-09-11',
        closingIds: ['closing-17763'],
      }),
    );
  });

  it('skips imported closings that already have the same date', async () => {
    const { prisma } = prismaMock({
      confirmedAt: parseLegacyClosedDateOnly('2026-09-11'),
    });

    const plan = await new LegacyClosedDateEnrichment(prisma).plan({
      tenantId: 'tenant-1',
      sourceOffers: [offer()],
      closedDateLookup: lookup([['6740', '2026-09-11']]),
    });

    expect(plan.counts.skip).toBe(1);
    expect(plan.records[0].reasons).toEqual(['confirmed-at-match']);
  });

  it('conflicts when an imported closing already has a different date', async () => {
    const { prisma } = prismaMock({
      confirmedAt: parseLegacyClosedDateOnly('2026-09-10'),
    });

    const plan = await new LegacyClosedDateEnrichment(prisma).plan({
      tenantId: 'tenant-1',
      sourceOffers: [offer()],
      closedDateLookup: lookup([['6740', '2026-09-11']]),
    });

    expect(plan.counts.conflict).toBe(1);
    expect(plan.records[0].reasons).toEqual([
      'existing-confirmed-at-differs-from-lookup',
    ]);
  });

  it('takes no action for source offers without a lookup date', async () => {
    const { prisma } = prismaMock({ confirmedAt: null });

    const plan = await new LegacyClosedDateEnrichment(prisma).plan({
      tenantId: 'tenant-1',
      sourceOffers: [offer({ offer_id: '6557' })],
      closedDateLookup: lookup([]),
    });

    expect(plan.counts.no_action).toBe(1);
    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        legacyOfferId: '6557',
        action: 'no_action',
        reasons: ['no-closed-date-lookup'],
      }),
    );
  });

  it('ignores lookup-only IDs because the source file remains authoritative', async () => {
    const { prisma } = prismaMock({ confirmedAt: null });

    const plan = await new LegacyClosedDateEnrichment(prisma).plan({
      tenantId: 'tenant-1',
      sourceOffers: [offer()],
      closedDateLookup: lookup([
        ['6740', '2026-09-11'],
        ['lookup-only', '2026-09-12'],
      ]),
      ignoredLookupOnlyIds: ['lookup-only'],
    });

    expect(plan.records.map((record) => record.legacyOfferId)).toEqual([
      '6740',
    ]);
    expect(plan.ignoredLookupOnlyIds).toEqual(['lookup-only']);
  });

  it('updates only imported PlacementClosing.confirmedAt rows during apply', async () => {
    const { prisma, tx, transaction } = prismaMock({ confirmedAt: null });
    const enrichment = new LegacyClosedDateEnrichment(prisma);
    const closedDateLookup = lookup([['6740', '2026-09-11']]);
    const plan = await enrichment.plan({
      tenantId: 'tenant-1',
      sourceOffers: [offer()],
      closedDateLookup,
    });

    await enrichment.apply({ tenantId: 'tenant-1', plan, closedDateLookup });

    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      LEGACY_CLOSED_DATE_ENRICHMENT_TRANSACTION_OPTIONS,
    );
    expect(tx.placementClosing.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'closing-17763',
        tenantId: 'tenant-1',
        confirmedAt: null,
      },
      data: { confirmedAt: parseLegacyClosedDateOnly('2026-09-11') },
    });
    expect(tx.placement.create).not.toHaveBeenCalled();
    expect(tx.placementParticipant.create).not.toHaveBeenCalled();
    expect(tx.placementClosing.create).not.toHaveBeenCalled();
    expect(tx.legacyImportMap.create).not.toHaveBeenCalled();
  });

  it('aborts apply when the dry-run plan has conflicts', async () => {
    const { prisma, transaction } = prismaMock({
      confirmedAt: parseLegacyClosedDateOnly('2026-09-10'),
    });
    const enrichment = new LegacyClosedDateEnrichment(prisma);
    const closedDateLookup = lookup([['6740', '2026-09-11']]);
    const plan = await enrichment.plan({
      tenantId: 'tenant-1',
      sourceOffers: [offer()],
      closedDateLookup,
    });

    await expect(
      enrichment.apply({ tenantId: 'tenant-1', plan, closedDateLookup }),
    ).rejects.toThrow('Closed-date enrichment has conflicts');
    expect(transaction).not.toHaveBeenCalled();
  });
});

type MockOptions = { confirmedAt: Date | null };

function prismaMock(options: MockOptions) {
  const maps = [
    {
      entityType: 'offer',
      legacyId: '6740',
      currentModel: 'Placement',
      currentId: 'placement-6740',
      createdByImport: true,
    },
    {
      entityType: 'offer_participant_closing',
      legacyId: '17763',
      currentModel: 'PlacementClosing',
      currentId: 'closing-17763',
      createdByImport: true,
    },
  ];
  const tx = transactionMock();
  const transaction = jest.fn(
    async (
      callback: (tx: ReturnType<typeof transactionMock>) => Promise<unknown>,
      options?: unknown,
    ) => {
      void options;
      return callback(tx);
    },
  );
  const prisma = {
    legacyImportMap: {
      findMany: jest.fn((input: { where: { entityType: { in: string[] } } }) =>
        Promise.resolve(
          maps.filter((map) =>
            input.where.entityType.in.includes(map.entityType),
          ),
        ),
      ),
      create: jest.fn(),
    },
    placementClosing: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { id: 'closing-17763', confirmedAt: options.confirmedAt },
        ]),
      ),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: transaction,
  } as never;
  tx.placementClosing.updateMany.mockResolvedValue({ count: 1 });
  return { prisma, tx, transaction };
}

function transactionMock() {
  return {
    legacyImportMap: { create: jest.fn() },
    placement: { create: jest.fn() },
    placementParticipant: { create: jest.fn() },
    placementClosing: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function lookup(entries: Array<[string, string]>) {
  return new Map(
    entries.map(([legacyOfferId, closedDate]) => [
      legacyOfferId,
      {
        legacyOfferId,
        closedDate: parseLegacyClosedDateOnly(closedDate),
      },
    ]),
  );
}

function offer(overrides: Partial<LegacyOffer> = {}): LegacyOffer {
  return {
    offer_id: '6740',
    offer_status: 'CLOSED',
    offer_participant: [
      {
        offer_participant_id: '17763',
      },
    ],
    ...overrides,
  };
}
