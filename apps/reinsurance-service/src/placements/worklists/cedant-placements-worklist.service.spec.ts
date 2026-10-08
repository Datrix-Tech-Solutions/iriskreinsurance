import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryCedantPlacementsWorklistDto } from '../dto/query-cedant-placements-worklist.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceCedantPlacementsWorklistService } from './cedant-placements-worklist.service';

describe('ReinsuranceCedantPlacementsWorklistService', () => {
  function sqlText(value: unknown): string {
    if (value && typeof value === 'object' && 'strings' in value) {
      const strings = (value as { strings?: unknown }).strings;
      if (Array.isArray(strings)) return strings.join('?');
    }
    return String(value);
  }

  function serviceWithRows(rows: unknown[][]) {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(rows[0] ?? []))
        .mockImplementationOnce(() => Promise.resolve(rows[1] ?? [])),
    } as unknown as PrismaService;
    return {
      service: new ReinsuranceCedantPlacementsWorklistService(
        prisma,
        new ReinsuranceMoneyHelper(),
      ),
      prisma: prisma as unknown as { $queryRaw: jest.Mock },
    };
  }

  it('returns paginated cedant placements with backend payment state and filter counts', async () => {
    const { service, prisma } = serviceWithRows([
      [
        {
          id: 'placement-1',
          reference: 'FAC-ST-2026-001',
          policyNumber: 'POL-001',
          title: 'Warehouse',
          classOfBusiness: 'Fire',
          riskTypeId: 'risk-type-1',
          cedantId: 'cedant-1',
          cedantName: 'Stellar Cedant',
          businessDetails: { location: 'Accra' },
          offerDetails: null,
          description: null,
          sumInsured: '1000000',
          rate: '2.5',
          commission: '10',
          facultativeOffer: '80',
          premium: '1000.555',
          currency: 'GHS',
          inceptionDate: new Date('2026-01-01T00:00:00.000Z'),
          expiryDate: null,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-03T00:00:00.000Z'),
          archivedByUserId: null,
          archiveReason: null,
          archivedAt: null,
          closeMode: null,
          forceClosedAt: null,
          forceClosedByUserId: null,
          status: 'CLOSED',
          participants: [
            {
              id: 'participant-1',
              counterpartyId: 'reinsurer-1',
              role: 'LEAD_REINSURER',
              status: 'CLOSED',
              sharePercent: '50',
              signedLinePercent: '40',
              brokerageFee: '5',
              notes: null,
              createdAt: '2026-01-02T00:00:00.000Z',
              counterparty: { id: 'reinsurer-1', name: 'Glico Re' },
            },
          ],
          totalOfferedPercent: '50',
          totalAcceptedPercent: '40',
          remainingPercent: '40',
          closingStatus: 'CONFIRMED',
          paymentStatus: 'Part Payment',
          hasRecordedPayment: false,
          hasNonVoidEndorsement: true,
          acceptedParticipantCount: 1n,
          participantCount: 1n,
          currentObligation: '900',
          bankConfirmedCash: '400',
          pendingCash: '0',
          mandatoryDeductions: '50',
          effectiveSettlementCredit: '450',
          outstandingAmount: '450',
          totalCount: 101n,
          summary: {
            all: 130,
            pending: 20,
            closed: 80,
            unpaid: 30,
            paid: 50,
          },
        },
      ],
    ]);

    const result = await service.findPlacements('tenant-1', {
      cedantId: '11111111-1111-4111-8111-111111111111',
      filter: 'unpaid',
      search: 'POL',
      page: 2,
      limit: 25,
    });

    expect(result.items[0]).toMatchObject({
      id: 'placement-1',
      policyNumber: 'POL-001',
      title: 'Warehouse',
      cedant: { id: 'cedant-1', name: 'Stellar Cedant' },
      sumInsured: 1000000,
      premium: 1000.56,
      totalOfferedPercent: 50,
      totalAcceptedPercent: 40,
      remainingPercent: 40,
      closingStatus: 'CONFIRMED',
      paymentStatus: 'Part Payment',
      hasRecordedPayment: false,
      hasNonVoidEndorsement: true,
      currentObligation: 900,
      bankConfirmedCash: 400,
      pendingCash: 0,
      mandatoryDeductions: 50,
      effectiveSettlementCredit: 450,
      outstandingAmount: 450,
    });
    expect(result.items[0].participants).toEqual([
      {
        id: 'participant-1',
        counterpartyId: 'reinsurer-1',
        role: 'LEAD_REINSURER',
        status: 'CLOSED',
        sharePercent: '50',
        signedLinePercent: '40',
        brokerageFee: '5',
        notes: null,
        createdAt: '2026-01-02T00:00:00.000Z',
        counterparty: { id: 'reinsurer-1', name: 'Glico Re' },
      },
    ]);
    expect(result.summary).toEqual({
      all: 130,
      pending: 20,
      closed: 80,
      unpaid: 30,
      paid: 50,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 25,
      total: 101,
      totalPages: 5,
    });

    const queryText = sqlText(
      (
        service as unknown as {
          cedantPlacementsCte: (
            tenantId: string,
            query: { cedantId: string; search?: string },
          ) => unknown;
        }
      ).cedantPlacementsCte('tenant-1', {
        cedantId: '11111111-1111-4111-8111-111111111111',
        search: 'POL',
      }),
    );
    const firstCall = sqlText(prisma.$queryRaw.mock.calls[0] as [unknown]);
    expect(queryText).toContain('p."cedantId" =');
    expect(queryText).toContain('"PlacementPayment" pay');
    expect(queryText).toContain('"PlacementClosing" pc');
    expect(firstCall).toContain('"paymentStatus" <>');
    expect(firstCall).toContain('LIMIT');
    expect(firstCall).toContain('OFFSET');
  });

  it('does not classify deduction-only placements as part payment', () => {
    const queryText = sqlText(
      (
        new ReinsuranceCedantPlacementsWorklistService(
          {} as PrismaService,
          new ReinsuranceMoneyHelper(),
        ) as unknown as {
          cedantPlacementsCte: (
            tenantId: string,
            query: { cedantId: string; search?: string },
          ) => unknown;
        }
      ).cedantPlacementsCte('tenant-1', {
        cedantId: '11111111-1111-4111-8111-111111111111',
      }),
    );

    expect(queryText).toContain(
      'WHEN COALESCE(pt."bankConfirmedCash", 0) > 0.0001',
    );
    expect(queryText).not.toContain('mandatoryDeductions", 0) > 0.0001');
  });

  it('returns summary counts for empty out-of-range pages', async () => {
    const { service, prisma } = serviceWithRows([
      [],
      [
        {
          totalCount: 120n,
          summary: {
            all: 120,
            pending: 8,
            closed: 90,
            unpaid: 40,
            paid: 80,
          },
        },
      ],
    ]);

    const result = await service.findPlacements('tenant-1', {
      cedantId: '11111111-1111-4111-8111-111111111111',
      filter: 'all',
      page: 99,
      limit: 10,
    });

    expect(result.items).toEqual([]);
    expect(result.meta).toEqual({
      page: 99,
      limit: 10,
      total: 120,
      totalPages: 12,
    });
    expect(result.summary).toEqual({
      all: 120,
      pending: 8,
      closed: 90,
      unpaid: 40,
      paid: 80,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('validates cedant id, filter and pagination input', async () => {
    const dto = plainToInstance(QueryCedantPlacementsWorklistDto, {
      cedantId: 'not-a-uuid',
      filter: 'maybe',
      page: 0,
      limit: 101,
    });

    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining(['cedantId', 'filter', 'page', 'limit']),
    );
  });
});
