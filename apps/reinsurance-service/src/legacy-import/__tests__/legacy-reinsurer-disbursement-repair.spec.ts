import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PrismaClient,
} from '../../../prisma/generated/client';
import { LegacyReinsurerDisbursementRepairPlanner } from '../legacy-reinsurer-disbursement-repair';

const DATABASE_URL =
  'postgresql://irisk_local:local@127.0.0.1:55433/irisk_local?schema=reinsurance';

describe('LegacyReinsurerDisbursementRepairPlanner', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = DATABASE_URL;
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('classifies a historical old-formula disbursement as repairable', async () => {
    const plan = await buildPlan([
      candidate({
        amount: '550.00',
        notes: notes([
          row({
            paidFacPremium: '700.00',
            paidCommission: '100.00',
            brokeragePaid: '50.00',
          }),
        ]),
      }),
    ]);

    expect(plan.counts.REPAIRABLE).toBe(1);
    expect(plan.records[0]).toMatchObject({
      classification: 'REPAIRABLE',
      previousFormulaAmount: '550.00',
      correctedAmount: '700.00',
      delta: '150.00',
    });
    expect(plan.totalsByCurrency.GHS).toMatchObject({
      repairableCount: 1,
      existingAmount: '550.00',
      correctedAmount: '700.00',
      delta: '150.00',
    });
  });

  it('classifies a corrected historical disbursement as already correct', async () => {
    const plan = await buildPlan([
      candidate({
        amount: '700.00',
        notes: notes([
          row({
            paidFacPremium: '700.00',
            paidCommission: '100.00',
            brokeragePaid: '50.00',
          }),
        ]),
      }),
    ]);

    expect(plan.counts.ALREADY_CORRECT).toBe(1);
    expect(plan.records[0]).toMatchObject({
      classification: 'ALREADY_CORRECT',
      correctedAmount: '700.00',
    });
  });

  it('preserves partial-payment evidence instead of replacing with full payable', async () => {
    const plan = await buildPlan([
      candidate({
        amount: '100.00',
        notes: notes([
          row({
            paidFacPremium: '125.25',
            paidCommission: '25.25',
            brokeragePaid: '0',
          }),
        ]),
      }),
    ]);

    expect(plan.records[0]).toMatchObject({
      classification: 'REPAIRABLE',
      previousFormulaAmount: '100.00',
      correctedAmount: '125.25',
      delta: '25.25',
    });
  });

  it('aggregates contributing rows before classifying the repair amount', async () => {
    const plan = await buildPlan([
      candidate({
        amount: '750.00',
        notes: notes([
          row({
            paidFacPremium: '700.00',
            paidCommission: '100.00',
            brokeragePaid: '50.00',
          }),
          row({
            paidFacPremium: '300.00',
            paidCommission: '75.00',
            brokeragePaid: '25.00',
          }),
        ]),
      }),
    ]);

    expect(plan.records[0]).toMatchObject({
      classification: 'REPAIRABLE',
      previousFormulaAmount: '750.00',
      correctedAmount: '1000.00',
      delta: '250.00',
    });
  });

  it('classifies manually edited amounts as conflicts', async () => {
    const plan = await buildPlan([
      candidate({
        amount: '600.00',
        notes: notes([
          row({
            paidFacPremium: '700.00',
            paidCommission: '100.00',
            brokeragePaid: '50.00',
          }),
        ]),
      }),
    ]);

    expect(plan.records[0]).toMatchObject({
      classification: 'CONFLICT',
      reasons: ['amount-matches-neither-old-nor-corrected-formula'],
    });
  });

  it('excludes reversed imported payments', async () => {
    const plan = await buildPlan([
      candidate({
        amount: '550.00',
        reversalOfPaymentId: 'payment-original',
        notes: notes([
          row({
            paidFacPremium: '700.00',
            paidCommission: '100.00',
            brokeragePaid: '50.00',
          }),
        ]),
      }),
    ]);

    expect(plan.records[0]).toMatchObject({
      classification: 'EXCLUDED',
      reasons: ['payment-has-reversal-link'],
    });
  });

  it('blocks hard-rejected source offers even if a stale payment exists', async () => {
    const plan = await buildPlan([
      candidate({
        legacyOfferId: '5273',
        amount: '550.00',
        notes: notes([
          row({
            paidFacPremium: '700.00',
            paidCommission: '100.00',
            brokeragePaid: '50.00',
          }),
        ]),
      }),
    ]);

    expect(plan.records[0]).toMatchObject({
      classification: 'BLOCKED',
      legacyOfferId: '5273',
      reasons: ['source-offer-hard-rejected'],
    });
  });

  it('does not expose write delegates in the repair workflow', async () => {
    const prisma = prismaMock([
      candidate({
        amount: '700.00',
        notes: notes([row({ paidFacPremium: '700.00' })]),
      }),
    ]);

    await new LegacyReinsurerDisbursementRepairPlanner(prisma).buildPlan({
      tenantId: '23837e4d-53b7-42c9-874e-f0b25dbb0ab7',
      tenantSlug: 'stellar-tech',
    });

    const mocked = prisma as unknown as MockRepairPrisma;
    expect(mocked.legacyImportMap.findMany.mock.calls).toHaveLength(2);
    expect(mocked.placementPayment.findMany.mock.calls).toHaveLength(1);
    expect(mocked.reinsuranceAccountingOutbox.findMany.mock.calls).toHaveLength(
      1,
    );
  });

  it('applies repairable rows with conditional updates and writes an audit artifact', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-repair-'));
    const auditFile = path.join(dir, 'audit.json');
    const { prisma, tx } = applyPrismaMock([
      candidate({
        amount: '550.00',
        notes: notes([
          row({
            paidFacPremium: '700.00',
            paidCommission: '100.00',
            brokeragePaid: '50.00',
          }),
        ]),
      }),
    ]);

    const result = await new LegacyReinsurerDisbursementRepairPlanner(
      prisma,
    ).apply({
      tenantId: '23837e4d-53b7-42c9-874e-f0b25dbb0ab7',
      tenantSlug: 'stellar-tech',
      auditFile,
    });

    expect(result.correctedPayments).toBe(1);
    const updateCall = tx.placementPayment.updateMany.mock.calls[0] as [
      {
        where: { id: string; amount: string };
        data: { amount: string };
      },
    ];
    expect(updateCall[0].where.id).toBe('payment-1');
    expect(updateCall[0].where.amount).toBe('550.00');
    expect(updateCall[0].data.amount).toBe('700.00');
    expect(JSON.parse(fs.readFileSync(auditFile, 'utf8'))).toMatchObject({
      tenantSlug: 'stellar-tech',
      correctedPayments: 1,
      records: [
        expect.objectContaining({
          paymentId: 'payment-1',
          beforeAmount: '550.00',
          afterAmount: '700.00',
        }),
      ],
    });
  });

  it('stops apply when the conditional update no longer matches the old amount', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-repair-'));
    const { prisma, tx } = applyPrismaMock(
      [
        candidate({
          amount: '550.00',
          notes: notes([
            row({
              paidFacPremium: '700.00',
              paidCommission: '100.00',
              brokeragePaid: '50.00',
            }),
          ]),
        }),
      ],
      { updateCount: 0 },
    );

    await expect(
      new LegacyReinsurerDisbursementRepairPlanner(prisma).apply({
        tenantId: '23837e4d-53b7-42c9-874e-f0b25dbb0ab7',
        tenantSlug: 'stellar-tech',
        auditFile: path.join(dir, 'audit.json'),
      }),
    ).rejects.toThrow('Conditional update changed 0 rows');

    expect(tx.placementPayment.updateMany).toHaveBeenCalledTimes(1);
  });
});

type MockRepairPrisma = {
  legacyImportMap: { findMany: jest.Mock };
  placementPayment: { findMany: jest.Mock };
  reinsuranceAccountingOutbox: { findMany: jest.Mock };
};

type MockApplyTx = {
  placementPayment: {
    findFirst: jest.Mock;
    updateMany: jest.Mock;
  };
  reinsuranceAccountingOutbox: {
    count: jest.Mock;
  };
};

function applyPrismaMock(
  candidates: Candidate[],
  options: { updateCount?: number } = {},
) {
  const prisma = prismaMock(candidates) as unknown as MockRepairPrisma & {
    $transaction: jest.Mock;
  };
  const tx: MockApplyTx = {
    placementPayment: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'payment-1',
        notes: candidates[0].notes,
        _count: {
          allocations: 0,
          settledNotes: 0,
          reversalPayments: 0,
          attachments: 0,
        },
      }),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.updateCount ?? 1 }),
    },
    reinsuranceAccountingOutbox: {
      count: jest.fn().mockResolvedValue(0),
    },
  };
  prisma.$transaction = jest.fn((callback: (tx: MockApplyTx) => unknown) =>
    callback(tx),
  );
  return {
    prisma: prisma as unknown as PrismaClient,
    tx,
  };
}

type Candidate = {
  legacyParticipantId?: string;
  legacyOfferId?: string;
  paymentId?: string;
  placementId?: string;
  amount: string;
  currency?: string;
  notes: string;
  status?: PlacementPaymentStatus;
  reversalOfPaymentId?: string | null;
  counts?: {
    allocations?: number;
    settledNotes?: number;
    reversalPayments?: number;
    attachments?: number;
  };
};

function candidate(input: Candidate): Candidate {
  return input;
}

async function buildPlan(candidates: Candidate[]) {
  return new LegacyReinsurerDisbursementRepairPlanner(
    prismaMock(candidates),
  ).buildPlan({
    tenantId: '23837e4d-53b7-42c9-874e-f0b25dbb0ab7',
    tenantSlug: 'stellar-tech',
  });
}

function prismaMock(candidates: Candidate[]) {
  const maps = candidates.map((item, index) => ({
    legacyId: item.legacyParticipantId ?? `participant-${index + 1}`,
    currentId: item.paymentId ?? `payment-${index + 1}`,
    currentModel: 'PlacementPayment',
    createdByImport: true,
    rawHash: `hash-${index + 1}`,
    importRunId: `run-${index + 1}`,
  }));
  const payments = candidates.map((item, index) => ({
    id: item.paymentId ?? `payment-${index + 1}`,
    tenantId: '23837e4d-53b7-42c9-874e-f0b25dbb0ab7',
    placementId: item.placementId ?? `placement-${index + 1}`,
    participantId: `participant-current-${index + 1}`,
    closingId: `closing-${index + 1}`,
    type: PlacementPaymentType.REINSURER_DISBURSEMENT,
    direction: PlacementPaymentDirection.OUTBOUND,
    amount: item.amount,
    currency: item.currency ?? 'GHS',
    status: item.status ?? PlacementPaymentStatus.BANK_CONFIRMED,
    paymentDate: new Date('2026-01-15T00:00:00.000Z'),
    bankConfirmedAt: new Date('2026-01-15T00:00:00.000Z'),
    bankConfirmedByUserId: 'user-1',
    settlementMethod: 'OTHER',
    reference: `LEGACY-IRISK-DISBURSEMENT-${index + 1}`,
    notes: item.notes,
    reversalOfPaymentId: item.reversalOfPaymentId ?? null,
    _count: {
      allocations: item.counts?.allocations ?? 0,
      settledNotes: item.counts?.settledNotes ?? 0,
      reversalPayments: item.counts?.reversalPayments ?? 0,
      attachments: item.counts?.attachments ?? 0,
    },
  }));
  const offerMaps = candidates.map((item, index) => ({
    legacyId: item.legacyOfferId ?? `offer-${index + 1}`,
    currentId: item.placementId ?? `placement-${index + 1}`,
  }));
  return {
    legacyImportMap: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(maps)
        .mockResolvedValueOnce(offerMaps),
    },
    placementPayment: {
      findMany: jest.fn().mockResolvedValue(payments),
    },
    reinsuranceAccountingOutbox: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient;
}

function notes(rows: Array<Record<string, string>>) {
  return [
    'Historical legacy iRisk reinsurer disbursement.',
    `contributingRows=${JSON.stringify(rows)}`,
    'sourceSystem=legacy-irisk-graphql',
    'historicalMigration=true',
  ].join('\n');
}

function row(input: {
  paidFacPremium: string;
  paidCommission?: string;
  brokeragePaid?: string;
  paidWht?: string;
  paidNic?: string;
}) {
  return {
    paidFacPremium: input.paidFacPremium,
    paidCommission: input.paidCommission ?? '0',
    brokeragePaid: input.brokeragePaid ?? '0',
    paidWht: input.paidWht ?? '0',
    paidNic: input.paidNic ?? '0',
  };
}
