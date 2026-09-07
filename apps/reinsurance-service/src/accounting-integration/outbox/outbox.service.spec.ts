import {
  Prisma,
  ReinsuranceAccountingOutboxStatus,
} from '../../../prisma/generated/client';
import {
  ReinsuranceAccountingClient,
  ReinsuranceAccountingClientError,
} from '../client/accounting.client';
import { ReinsuranceAccountingEventBuilder } from '../events/accounting-event.builder';
import {
  ReinsuranceAccountingOutboxService,
  RETIRED_REINSURANCE_ACCOUNTING_EVENT_TYPES,
} from './outbox.service';

type Row = Prisma.ReinsuranceAccountingOutboxGetPayload<object>;

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'outbox-1',
    tenantId: 'tenant-1',
    sourceEventType: 'LEGACY_TEST_EVENT',
    sourceRecordType: 'PlacementPayment',
    sourceRecordId: 'payment-1',
    sourceDocumentId: null,
    idempotencyKey: 'reinsurance:legacy-test:payment-1:v1',
    occurredAt: new Date('2026-07-29T10:00:00.000Z'),
    currency: 'GHS',
    payload: { amounts: { amount: 1000 } },
    status: ReinsuranceAccountingOutboxStatus.PENDING,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastError: null,
    accountingSourceEventId: null,
    createdAt: new Date('2026-07-29T10:00:00.000Z'),
    updatedAt: new Date('2026-07-29T10:00:00.000Z'),
    deliveredAt: null,
    ...overrides,
  };
}

function makePrisma(rows: Row[]) {
  const delegate = {
    create: jest.fn(
      ({
        data,
      }: {
        data: Prisma.ReinsuranceAccountingOutboxUncheckedCreateInput;
      }) => {
        const row = makeRow({
          ...data,
          sourceDocumentId: data.sourceDocumentId ?? null,
          status: data.status ?? ReinsuranceAccountingOutboxStatus.PENDING,
          attemptCount: data.attemptCount ?? 0,
          lastAttemptAt: data.lastAttemptAt ?? null,
          nextAttemptAt: data.nextAttemptAt ?? null,
          lastError: data.lastError ?? null,
          accountingSourceEventId: data.accountingSourceEventId ?? null,
          deliveredAt: data.deliveredAt ?? null,
        } as Partial<Row>);
        rows.push(row);
        return Promise.resolve(row);
      },
    ),
    findUnique: jest.fn(
      ({
        where,
      }: {
        where: {
          tenantId_idempotencyKey: { tenantId: string; idempotencyKey: string };
        };
      }) =>
        Promise.resolve(
          rows.find(
            (row) =>
              row.tenantId === where.tenantId_idempotencyKey.tenantId &&
              row.idempotencyKey ===
                where.tenantId_idempotencyKey.idempotencyKey,
          ) ?? null,
        ),
    ),
    findMany: jest.fn(
      ({
        where,
        take,
      }: {
        where: {
          tenantId?: string;
          sourceEventType?: { notIn?: string[] };
          OR?: Array<{ attemptCount?: { lt?: number } }>;
        };
        take?: number;
      }) =>
        Promise.resolve(
          rows
            .filter((row) => !where.tenantId || row.tenantId === where.tenantId)
            .filter(
              (row) =>
                !where.sourceEventType?.notIn?.includes(row.sourceEventType),
            )
            .filter((row) => {
              const maxAttempts = where.OR?.find(
                (item) => item.attemptCount?.lt != null,
              )?.attemptCount?.lt;
              const underLimit =
                maxAttempts == null || row.attemptCount < maxAttempts;
              return (
                row.status === ReinsuranceAccountingOutboxStatus.PENDING ||
                (underLimit &&
                  row.status === ReinsuranceAccountingOutboxStatus.FAILED &&
                  row.nextAttemptAt !== null &&
                  row.nextAttemptAt <= new Date()) ||
                (underLimit &&
                  row.status === ReinsuranceAccountingOutboxStatus.PROCESSING &&
                  row.lastAttemptAt !== null &&
                  row.lastAttemptAt <= new Date(Date.now() - 15 * 60 * 1000))
              );
            })
            .slice(0, take)
            .map((row) => ({ id: row.id, tenantId: row.tenantId })),
        ),
    ),
    findFirst: jest.fn(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        Promise.resolve(
          rows.find(
            (row) => row.id === where.id && row.tenantId === where.tenantId,
          ) ?? null,
        ),
    ),
    updateMany: jest.fn(
      ({
        where,
        data,
      }: {
        where: {
          id: string;
          tenantId: string;
          status?: ReinsuranceAccountingOutboxStatus;
          sourceEventType?: { notIn?: string[] };
          OR?: Array<{ attemptCount?: { lt?: number } }>;
        };
        data: Record<string, unknown>;
      }) => {
        const maxAttempts = where.OR?.find(
          (item) => item.attemptCount?.lt != null,
        )?.attemptCount?.lt;
        const row = rows.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.tenantId === where.tenantId &&
            (!where.status || candidate.status === where.status) &&
            !where.sourceEventType?.notIn?.includes(
              candidate.sourceEventType,
            ) &&
            (maxAttempts == null || candidate.attemptCount < maxAttempts),
        );
        if (!row) return Promise.resolve({ count: 0 });
        if (
          row.status !== ReinsuranceAccountingOutboxStatus.PENDING &&
          row.status !== ReinsuranceAccountingOutboxStatus.FAILED &&
          !(
            row.status === ReinsuranceAccountingOutboxStatus.PROCESSING &&
            row.lastAttemptAt !== null &&
            row.lastAttemptAt <= new Date(Date.now() - 15 * 60 * 1000)
          )
        ) {
          return Promise.resolve({ count: 0 });
        }
        Object.assign(row, {
          ...data,
          attemptCount:
            typeof data.attemptCount === 'object' && data.attemptCount !== null
              ? row.attemptCount + 1
              : (data.attemptCount ?? row.attemptCount),
        });
        return Promise.resolve({ count: 1 });
      },
    ),
    update: jest.fn(
      ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) return Promise.reject(new Error('Row not found'));
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    ),
  };

  return {
    reinsuranceAccountingOutbox: delegate,
  } as unknown as Prisma.TransactionClient;
}

describe('ReinsuranceAccountingOutboxService', () => {
  const builder = new ReinsuranceAccountingEventBuilder();
  let client: jest.Mocked<ReinsuranceAccountingClient>;

  beforeEach(() => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-07-29T12:00:00.000Z').getTime());
    client = {
      enqueueSourceEvent: jest.fn(),
    } as unknown as jest.Mocked<ReinsuranceAccountingClient>;
  });

  afterEach(() => jest.restoreAllMocks());

  it('enqueues a pending event through the supplied transaction client', async () => {
    const rows: Row[] = [];
    const prisma = makePrisma(rows);
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const row = await service.enqueueAccountingEvent(prisma, {
      tenantId: 'tenant-1',
      sourceEventType: 'LEGACY_TEST_EVENT',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-1',
      idempotencyKey: 'reinsurance:legacy-test:payment-1:v1',
      occurredAt: '2026-07-29T10:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { amount: 1000 } },
    });

    expect(row.status).toBe(ReinsuranceAccountingOutboxStatus.PENDING);
    expect(rows).toHaveLength(1);
  });

  it('returns the existing logical event when the idempotency key already exists', async () => {
    const existing = makeRow();
    const prisma = makePrisma([existing]);
    const delegate = prisma.reinsuranceAccountingOutbox as unknown as {
      create: jest.Mock;
    };
    delegate.create.mockRejectedValueOnce(uniqueConstraintError());
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const row = await service.enqueueAccountingEvent(prisma, {
      tenantId: existing.tenantId,
      sourceEventType: existing.sourceEventType,
      sourceRecordType: existing.sourceRecordType,
      sourceRecordId: existing.sourceRecordId,
      idempotencyKey: existing.idempotencyKey,
      occurredAt: existing.occurredAt,
      currency: existing.currency,
      payload: existing.payload as Record<string, unknown>,
    });

    expect(row).toBe(existing);
  });

  it('delivers pending events and stores the Accounting source-event id', async () => {
    const rows = [makeRow()];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockResolvedValueOnce({
      id: 'accounting-event-1',
    });
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const result = await service.processPending(prisma, {
      tenantId: 'tenant-1',
    });

    expect(result.deliveredCount).toBe(1);
    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.DELIVERED);
    expect(rows[0].accountingSourceEventId).toBe('accounting-event-1');
    expect(client.enqueueSourceEvent.mock.calls).toHaveLength(1);
  });

  it('skips every retired Reinsurance Accounting outbox row during automatic dispatch', async () => {
    const rows = [
      ...RETIRED_REINSURANCE_ACCOUNTING_EVENT_TYPES.map((sourceEventType) =>
        makeRow({
          id: `outbox-${sourceEventType}`,
          sourceEventType,
          sourceRecordType: 'RetiredReinsuranceEvent',
          sourceRecordId: sourceEventType,
          idempotencyKey: `reinsurance:retired:${sourceEventType}:v1`,
        }),
      ),
    ];
    const prisma = makePrisma(rows);
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const result = await service.processPending(prisma, {
      tenantId: 'tenant-1',
    });

    expect(result.processedCount).toBe(0);
    expect(result.deliveredCount).toBe(0);
    expect(rows.every((row) => row.status === 'PENDING')).toBe(true);
    expect(client.enqueueSourceEvent.mock.calls).toHaveLength(0);
  });

  it('refuses manual retry for retired Reinsurance Accounting outbox rows', async () => {
    const rows = [
      makeRow({
        sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
        sourceRecordType: 'PlacementPayment',
        sourceRecordId: 'payment-1',
        idempotencyKey: 'reinsurance:reinsurer-disbursement:payment-1:v1',
        status: ReinsuranceAccountingOutboxStatus.FAILED,
        attemptCount: 1,
        nextAttemptAt: null,
      }),
    ];
    const prisma = makePrisma(rows);
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const result = await service.retryFailedEvent(
      prisma,
      'tenant-1',
      'outbox-1',
    );

    expect(result).toBeNull();
    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.FAILED);
    expect(rows[0].nextAttemptAt).toBeNull();
  });

  it('marks retryable failures with a next attempt date', async () => {
    const rows = [makeRow()];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockRejectedValueOnce(
      new ReinsuranceAccountingClientError('Accounting unavailable', true, 503),
    );
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const result = await service.processPending(prisma, {
      tenantId: 'tenant-1',
    });

    expect(result.failedCount).toBe(1);
    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.FAILED);
    expect(rows[0].nextAttemptAt).toEqual(new Date('2026-07-29T12:01:00.000Z'));
  });

  it('uses the configured retry delay as the exponential backoff base', async () => {
    const rows = [makeRow({ attemptCount: 1 })];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockRejectedValueOnce(
      new ReinsuranceAccountingClientError('Accounting unavailable', true, 503),
    );
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    await service.processPending(prisma, {
      tenantId: 'tenant-1',
      retryDelayMs: 5000,
    });

    expect(rows[0].nextAttemptAt).toEqual(new Date('2026-07-29T12:00:10.000Z'));
  });

  it('does not retry failed rows that reached the configured attempt limit', async () => {
    const rows = [
      makeRow({
        status: ReinsuranceAccountingOutboxStatus.FAILED,
        attemptCount: 3,
        nextAttemptAt: new Date('2026-07-29T11:59:00.000Z'),
      }),
    ];
    const prisma = makePrisma(rows);
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const result = await service.processPending(prisma, {
      tenantId: 'tenant-1',
      maxAttempts: 3,
    });

    expect(result.processedCount).toBe(0);
    expect(client.enqueueSourceEvent.mock.calls).toHaveLength(0);
  });

  it('leaves retryable failures parked when the final attempt fails', async () => {
    const rows = [makeRow({ attemptCount: 2 })];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockRejectedValueOnce(
      new ReinsuranceAccountingClientError('Accounting unavailable', true, 503),
    );
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    await service.processPending(prisma, {
      tenantId: 'tenant-1',
      maxAttempts: 3,
    });

    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.FAILED);
    expect(rows[0].attemptCount).toBe(3);
    expect(rows[0].nextAttemptAt).toBeNull();
  });

  it('marks permanent validation failures without scheduling infinite retries', async () => {
    const rows = [makeRow()];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockRejectedValueOnce(
      new ReinsuranceAccountingClientError('Malformed payload', false, 400),
    );
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    await service.processPending(prisma, { tenantId: 'tenant-1' });

    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.FAILED);
    expect(rows[0].nextAttemptAt).toBeNull();
  });

  it('preserves events with clear diagnostics when delivery configuration is missing', async () => {
    const rows = [makeRow()];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockRejectedValueOnce(
      new ReinsuranceAccountingClientError(
        'ACCOUNTING_SERVICE_URL is not configured',
        false,
      ),
    );
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    await service.processPending(prisma, { tenantId: 'tenant-1' });

    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.FAILED);
    expect(rows[0].lastError).toBe('ACCOUNTING_SERVICE_URL is not configured');
    expect(rows[0].nextAttemptAt).toBeNull();
    expect(rows[0].idempotencyKey).toBe('reinsurance:legacy-test:payment-1:v1');
  });

  it('retries eligible failures and treats Accounting idempotent responses as delivery', async () => {
    const rows = [
      makeRow({
        status: ReinsuranceAccountingOutboxStatus.FAILED,
        attemptCount: 1,
        nextAttemptAt: new Date('2026-07-29T11:59:00.000Z'),
      }),
    ];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockResolvedValueOnce({ id: 'existing-event-1' });
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const result = await service.processPending(prisma, {
      tenantId: 'tenant-1',
    });

    expect(result.deliveredCount).toBe(1);
    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.DELIVERED);
    expect(rows[0].accountingSourceEventId).toBe('existing-event-1');
  });

  it('does not double-deliver when two processors race for the same row', async () => {
    const rows = [makeRow()];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockResolvedValue({ id: 'accounting-event-1' });
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const results = await Promise.all([
      service.processOne(prisma, 'tenant-1', 'outbox-1'),
      service.processOne(prisma, 'tenant-1', 'outbox-1'),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'DELIVERED',
      'SKIPPED',
    ]);
    expect(client.enqueueSourceEvent.mock.calls).toHaveLength(1);
  });

  it('reclaims stale processing rows for retry', async () => {
    const rows = [
      makeRow({
        status: ReinsuranceAccountingOutboxStatus.PROCESSING,
        attemptCount: 1,
        lastAttemptAt: new Date('2026-07-29T11:30:00.000Z'),
      }),
    ];
    const prisma = makePrisma(rows);
    client.enqueueSourceEvent.mockResolvedValue({ id: 'accounting-event-1' });
    const service = new ReinsuranceAccountingOutboxService(client, builder);

    const result = await service.processPending(prisma, {
      tenantId: 'tenant-1',
    });

    expect(result.deliveredCount).toBe(1);
    expect(rows[0].status).toBe(ReinsuranceAccountingOutboxStatus.DELIVERED);
    expect(rows[0].attemptCount).toBe(2);
  });
});
