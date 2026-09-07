import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceAccountingOutboxDispatcher } from './outbox-dispatcher.service';
import { ReinsuranceAccountingOutboxService } from './outbox.service';

function setEnv(name: string, value: string | undefined) {
  if (value == null) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('ReinsuranceAccountingOutboxDispatcher', () => {
  const originalEnv = process.env;
  let prisma: PrismaService;
  let outbox: jest.Mocked<ReinsuranceAccountingOutboxService>;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...originalEnv };
    prisma = {} as PrismaService;
    outbox = {
      processPending: jest.fn().mockResolvedValue({
        processedCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount: 0,
        events: [],
      }),
    } as unknown as jest.Mocked<ReinsuranceAccountingOutboxService>;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('is dormant by default after Reinsurance Accounting decoupling', async () => {
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    await dispatcher.processBatch('manual');

    expect(outbox.processPending.mock.calls).toHaveLength(0);
    expect(dispatcher.status()).toMatchObject({
      enabled: false,
      running: false,
      inFlight: false,
    });
  });

  it('starts automatically and processes pending events with configured options', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'true');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS', '2000');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_BATCH_SIZE', '7');
    setEnv(
      'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_PROCESSING_TIMEOUT_MS',
      '30000',
    );
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_RETRY_DELAY_MS', '4000');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_MAX_ATTEMPTS', '4');
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    await Promise.resolve();

    expect(outbox.processPending.mock.calls[0]).toEqual([
      prisma,
      {
        limit: 7,
        maxAttempts: 4,
        processingTimeoutMs: 30000,
        retryDelayMs: 4000,
      },
    ]);
    expect(dispatcher.status()).toMatchObject({
      enabled: true,
      running: true,
      lastError: null,
    });

    await dispatcher.onModuleDestroy();
  });

  it('falls back or clamps unsafe configuration values', () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'maybe');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS', '-1');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_BATCH_SIZE', '500');
    setEnv(
      'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_PROCESSING_TIMEOUT_MS',
      'not-a-number',
    );
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_RETRY_DELAY_MS', '0');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_MAX_ATTEMPTS', '-5');
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    expect(dispatcher.status().config).toEqual({
      enabled: false,
      pollIntervalMs: 1000,
      batchSize: 100,
      processingTimeoutMs: 900000,
      retryDelayMs: 1000,
      maxAttempts: 1,
    });
  });

  it('does not create a second timer if bootstrap is called twice', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'true');
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    dispatcher.onApplicationBootstrap();
    await Promise.resolve();

    expect(jest.getTimerCount()).toBe(1);
    expect(outbox.processPending.mock.calls).toHaveLength(1);

    await dispatcher.onModuleDestroy();
  });

  it('does not start or process when disabled', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'false');
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    await dispatcher.processBatch('manual');

    expect(outbox.processPending.mock.calls).toHaveLength(0);
    expect(dispatcher.status()).toMatchObject({
      enabled: false,
      running: false,
      inFlight: false,
    });
  });

  it('skips overlapping runs so one worker instance does not double process', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'true');
    let resolveBatch!: () => void;
    outbox.processPending.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = () =>
          resolve({
            processedCount: 1,
            deliveredCount: 1,
            failedCount: 0,
            skippedCount: 0,
            events: [],
          });
      }),
    );
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    const first = dispatcher.processBatch('manual');
    const second = dispatcher.processBatch('manual');

    expect(outbox.processPending.mock.calls).toHaveLength(1);
    resolveBatch();
    await Promise.all([first, second]);
  });

  it('records batch errors without stopping future batches', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'true');
    outbox.processPending
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({
        processedCount: 1,
        deliveredCount: 1,
        failedCount: 0,
        skippedCount: 0,
        events: [],
      });
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    await dispatcher.processBatch('manual');
    expect(dispatcher.status().lastError).toBe(
      'Last dispatcher batch failed; see service logs.',
    );

    await dispatcher.processBatch('manual');
    expect(dispatcher.status()).toMatchObject({
      lastError: null,
      lastResult: {
        processedCount: 1,
        deliveredCount: 1,
        failedCount: 0,
        skippedCount: 0,
      },
    });
  });

  it('continues polling after a failed scheduled tick', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'true');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS', '2000');
    outbox.processPending
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue({
        processedCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount: 0,
        events: [],
      });
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    expect(outbox.processPending.mock.calls).toHaveLength(2);
    expect(dispatcher.status().lastError).toBeNull();

    await dispatcher.onModuleDestroy();
  });

  it('clears the interval and waits for in-flight work during shutdown', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'true');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS', '2000');
    let resolveBatch!: () => void;
    outbox.processPending.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = () =>
          resolve({
            processedCount: 1,
            deliveredCount: 1,
            failedCount: 0,
            skippedCount: 0,
            events: [],
          });
      }),
    );
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    const shutdown = dispatcher.onModuleDestroy();
    expect(dispatcher.status().inFlight).toBe(true);

    resolveBatch();
    await shutdown;

    expect(dispatcher.status()).toMatchObject({
      running: false,
      inFlight: false,
    });

    jest.advanceTimersByTime(2000);
    expect(outbox.processPending.mock.calls).toHaveLength(1);
  });
});
