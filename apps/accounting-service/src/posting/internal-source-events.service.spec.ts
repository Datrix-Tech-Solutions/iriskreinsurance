import { NotFoundException } from '@nestjs/common';
import { Prisma, SourceEventStatus } from '../../prisma/generated/client';
import { CashbookService } from '../ledger/cashbook.service';
import { JournalsService } from '../ledger/journals.service';
import { PrismaService } from '../prisma/prisma.service';
import { InternalSourceEventDto } from './dto/posting.dto';
import { SourceEventsService } from './source-events.service';

describe('SourceEventsService internal ingestion', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const dto: InternalSourceEventDto = {
    tenantId,
    sourceModule: 'REINSURANCE',
    sourceEventType: 'DEBIT_NOTE_ISSUED',
    sourceRecordId: 'note-1',
    sourceDocumentId: 'document-1',
    idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
    occurredAt: '2026-07-05T10:30:00.000Z',
    currency: 'GHS',
    payload: {
      amounts: { netPremium: 12500 },
      policyNumber: 'POL-001',
      transactionDate: 'untrusted-value',
      currency: 'USD',
    },
  };

  function eventFor(input: InternalSourceEventDto) {
    return {
      id: `event-${input.tenantId}`,
      tenantId: input.tenantId,
      sourceModule: input.sourceModule,
      sourceEventType: input.sourceEventType,
      sourceRecordId: input.sourceRecordId,
      sourceDocumentId: input.sourceDocumentId ?? null,
      idempotencyKey: input.idempotencyKey,
      payload: {
        ...input.payload,
        transactionDate: input.occurredAt,
        currency: input.currency,
      },
      status: SourceEventStatus.RECEIVED,
      failureReason: null,
      postingRuleId: null,
      journalEntryId: null,
      retryCount: 0,
      receivedByUserId: 'service:reinsurance-service',
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null,
    };
  }

  function setup() {
    const createSourceEvent = jest
      .fn<
        Promise<ReturnType<typeof eventFor>>,
        [Prisma.SourceEventInboxCreateArgs]
      >()
      .mockImplementation(({ data }) =>
        Promise.resolve({
          ...eventFor(dto),
          ...data,
        } as ReturnType<typeof eventFor>),
      );
    const prisma = {
      accountingTenantConfig: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { tenantId: string } }) =>
            Promise.resolve({ tenantId: where.tenantId }),
          ),
      },
      sourceEventInbox: {
        create: createSourceEvent,
        findUnique: jest.fn(),
      },
    };
    const journals = {
      createPostedInTransaction: jest.fn(),
    };
    const cashbook = {
      createPostedSourceEventTransactionInTransaction: jest.fn(),
    };
    const service = new SourceEventsService(
      prisma as unknown as PrismaService,
      cashbook as unknown as CashbookService,
      journals as unknown as JournalsService,
    );
    return { journals, prisma, service };
  }

  it('enqueues a canonical RECEIVED event without processing it', async () => {
    const { journals, prisma, service } = setup();

    const result = await service.enqueueInternal('reinsurance-service', dto);

    expect(result.status).toBe(SourceEventStatus.RECEIVED);
    expect(result.payload).toMatchObject({
      transactionDate: dto.occurredAt,
      currency: dto.currency,
      amounts: { netPremium: 12500 },
    });
    const createCall = prisma.sourceEventInbox.create.mock.calls[0]?.[0];
    if (!createCall) throw new Error('Source event create was not called');
    expect(createCall.data).toMatchObject({
      tenantId,
      receivedByUserId: 'service:reinsurance-service',
      status: SourceEventStatus.RECEIVED,
    });
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('rejects an event for an unconfigured tenant', async () => {
    const { prisma, service } = setup();
    prisma.accountingTenantConfig.findUnique.mockResolvedValue(null);

    await expect(
      service.enqueueInternal('reinsurance-service', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.sourceEventInbox.create).not.toHaveBeenCalled();
  });

  it('returns the existing tenant event for a duplicate idempotency key', async () => {
    const { prisma, service } = setup();
    const existing = eventFor(dto);
    prisma.sourceEventInbox.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );
    prisma.sourceEventInbox.findUnique.mockResolvedValue(existing);

    await expect(
      service.enqueueInternal('reinsurance-service', dto),
    ).resolves.toEqual(existing);
    expect(prisma.sourceEventInbox.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      }),
    );
  });

  it('keeps equal idempotency keys isolated by tenant', async () => {
    const { prisma, service } = setup();
    const otherTenantDto = {
      ...dto,
      tenantId: '22222222-2222-4222-8222-222222222222',
    };

    await service.enqueueInternal('reinsurance-service', dto);
    await service.enqueueInternal('reinsurance-service', otherTenantDto);

    const createCalls = prisma.sourceEventInbox.create.mock.calls.map(
      ([argument]) =>
        (
          argument as {
            data: Prisma.SourceEventInboxUncheckedCreateInput;
          }
        ).data.tenantId,
    );
    expect(createCalls).toEqual([tenantId, otherTenantDto.tenantId]);
  });

  it('returns one inbox record under concurrent duplicate requests', async () => {
    const { prisma, service } = setup();
    const existing = eventFor(dto);
    prisma.sourceEventInbox.create
      .mockResolvedValueOnce(existing)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );
    prisma.sourceEventInbox.findUnique.mockResolvedValue(existing);

    const results = await Promise.all([
      service.enqueueInternal('reinsurance-service', dto),
      service.enqueueInternal('reinsurance-service', dto),
    ]);

    expect(results).toEqual([existing, existing]);
  });
});
