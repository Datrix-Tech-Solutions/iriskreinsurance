import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { QueryReinsurerPlacementsWorklistDto } from '../dto/query-reinsurer-placements-worklist.dto';
import { ReinsuranceReinsurerPlacementsWorklistService } from './reinsurer-placements-worklist.service';

describe('ReinsuranceReinsurerPlacementsWorklistService', () => {
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
      service: new ReinsuranceReinsurerPlacementsWorklistService(
        prisma,
        new ReinsuranceMoneyHelper(),
      ),
      prisma: prisma as unknown as { $queryRaw: jest.Mock },
    };
  }

  it('returns paginated reinsurer placements and filter counts from a tenant-scoped set query', async () => {
    const { service, prisma } = serviceWithRows([
      [
        {
          id: 'placement-1',
          reference: 'FAC-ST-2026-001',
          policyNumber: 'POL-001',
          title: 'Warehouse',
          cedant: 'Stellar Cedant',
          role: 'LEAD_REINSURER',
          sharePercent: '40',
          participantStatus: 'ACCEPTED',
          placementStatus: 'PLACED',
          inceptionDate: new Date('2026-01-01T00:00:00.000Z'),
          expiryDate: null,
          currency: 'GHS',
          premium: '1000.555',
          riskType: 'Fire',
          totalCount: 101n,
          summary: {
            all: 130,
            accepted: 70,
            pending: 20,
            closed: 80,
            declined: 3,
          },
        },
      ],
    ]);

    const result = await service.findPlacements('tenant-1', {
      reinsurerId: '11111111-1111-4111-8111-111111111111',
      filter: 'closed',
      search: 'POL',
      page: 2,
      limit: 25,
    });

    expect(result).toEqual({
      items: [
        {
          id: 'placement-1',
          reference: 'POL-001',
          policyNumber: 'POL-001',
          title: 'Warehouse',
          cedant: 'Stellar Cedant',
          role: 'LEAD_REINSURER',
          sharePercent: '40',
          participantStatus: 'ACCEPTED',
          placementStatus: 'PLACED',
          offerType: 'Facultative',
          inceptionDate: '2026-01-01T00:00:00.000Z',
          expiryDate: null,
          currency: 'GHS',
          premium: 1000.56,
          riskType: 'Fire',
        },
      ],
      summary: {
        all: 130,
        accepted: 70,
        pending: 20,
        closed: 80,
        declined: 3,
      },
      meta: { page: 2, limit: 25, total: 101, totalPages: 5 },
    });

    const queryText = sqlText(
      (
        service as unknown as {
          reinsurerPlacementsCte: (
            tenantId: string,
            query: { reinsurerId: string; search?: string },
          ) => unknown;
        }
      ).reinsurerPlacementsCte('tenant-1', {
        reinsurerId: '11111111-1111-4111-8111-111111111111',
        search: 'POL',
      }),
    );
    const firstCall = sqlText(prisma.$queryRaw.mock.calls[0] as [unknown]);
    expect(queryText).toContain('FROM "reinsurance"."PlacementParticipant" pp');
    expect(queryText).toContain('pp."tenantId" =');
    expect(queryText).toContain('pp."counterpartyId" =');
    expect(queryText).toContain('ROW_NUMBER() OVER');
    expect(queryText).toContain('WHERE "rowRank" = 1');
    expect(firstCall).toContain('"placementStatus"::text IN');
    expect(firstCall).toContain('LIMIT');
    expect(firstCall).toContain('OFFSET');
  });

  it('returns summary counts for empty out-of-range pages', async () => {
    const { service, prisma } = serviceWithRows([
      [],
      [
        {
          totalCount: 120n,
          summary: {
            all: 120,
            accepted: 100,
            pending: 8,
            closed: 90,
            declined: 5,
          },
        },
      ],
    ]);

    const result = await service.findPlacements('tenant-1', {
      reinsurerId: '11111111-1111-4111-8111-111111111111',
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
      accepted: 100,
      pending: 8,
      closed: 90,
      declined: 5,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('validates reinsurer id, filter and pagination input', async () => {
    const dto = plainToInstance(QueryReinsurerPlacementsWorklistDto, {
      reinsurerId: 'not-a-uuid',
      filter: 'maybe',
      page: 0,
      limit: 101,
    });

    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining(['reinsurerId', 'filter', 'page', 'limit']),
    );
  });
});
