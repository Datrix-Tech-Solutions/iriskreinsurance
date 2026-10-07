import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QueryReinsurerPlacementsWorklistDto,
  ReinsurerPlacementFilter,
} from '../dto/query-reinsurer-placements-worklist.dto';
import {
  ReinsurerPlacementsWorklistResponseDto,
  ReinsurerPlacementsWorklistRowDto,
  ReinsurerPlacementsWorklistSummaryDto,
} from '../dto/reinsurer-placements-worklist-response.dto';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type ReinsurerPlacementRawRow = {
  id: string;
  reference: string;
  policyNumber: string | null;
  title: string;
  cedant: string;
  role: string;
  sharePercent: Prisma.Decimal | string | number | null;
  participantStatus: string;
  placementStatus: string;
  inceptionDate: Date | string | null;
  expiryDate: Date | string | null;
  currency: string | null;
  premium: Prisma.Decimal | string | number | null;
  riskType: string | null;
  totalCount: bigint | number | string;
  summary: unknown;
};

@Injectable()
export class ReinsuranceReinsurerPlacementsWorklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findPlacements(
    tenantId: string,
    query: QueryReinsurerPlacementsWorklistDto,
  ): Promise<ReinsurerPlacementsWorklistResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filterPredicate = this.filterPredicate(query.filter ?? 'all');

    const rows = await this.prisma.$queryRaw<ReinsurerPlacementRawRow[]>`
      ${this.reinsurerPlacementsCte(tenantId, query)}
      , filtered AS (
        SELECT *
        FROM base_rows
        WHERE TRUE
          ${filterPredicate}
      ),
      summarized AS (
        SELECT jsonb_build_object(
          'all', COUNT(*),
          'accepted', COUNT(*) FILTER (WHERE "participantStatus"::text = 'ACCEPTED'),
          'pending', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('DRAFT', 'MARKETING')),
          'closed', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('PARTIALLY_PLACED', 'PLACED', 'CLOSED')),
          'declined', COUNT(*) FILTER (WHERE "participantStatus"::text = 'DECLINED')
        ) AS "summary"
        FROM base_rows
      ),
      counted AS (
        SELECT filtered.*, COUNT(*) OVER() AS "totalCount"
        FROM filtered
      )
      SELECT counted.*, summarized."summary"
      FROM counted
      CROSS JOIN summarized
      ORDER BY counted."createdAt" DESC, counted."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    if (!rows.length) {
      const summaryRows = await this.prisma.$queryRaw<
        { totalCount: bigint | number | string; summary: unknown }[]
      >`
        ${this.reinsurerPlacementsCte(tenantId, query)}
        , filtered AS (
          SELECT *
          FROM base_rows
          WHERE TRUE
            ${filterPredicate}
        )
        SELECT
          COUNT(*) AS "totalCount",
          (
            SELECT jsonb_build_object(
              'all', COUNT(*),
              'accepted', COUNT(*) FILTER (WHERE "participantStatus"::text = 'ACCEPTED'),
              'pending', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('DRAFT', 'MARKETING')),
              'closed', COUNT(*) FILTER (WHERE "placementStatus"::text IN ('PARTIALLY_PLACED', 'PLACED', 'CLOSED')),
              'declined', COUNT(*) FILTER (WHERE "participantStatus"::text = 'DECLINED')
            )
            FROM base_rows
          ) AS "summary"
        FROM filtered
      `;
      const total = this.toInteger(summaryRows[0]?.totalCount ?? 0);
      return {
        items: [],
        summary: this.toSummary(summaryRows[0]?.summary),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    const total = this.toInteger(rows[0].totalCount);
    return {
      items: rows.map((row) => this.toDto(row)),
      summary: this.toSummary(rows[0].summary),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private reinsurerPlacementsCte(
    tenantId: string,
    query: Pick<QueryReinsurerPlacementsWorklistDto, 'reinsurerId' | 'search'>,
  ) {
    const searchPredicate = this.searchPredicate(query.search);

    return Prisma.sql`
      WITH participant_rows AS (
        SELECT
          p."id",
          p."reference",
          p."policyNumber",
          p."title",
          cedant."name" AS "cedant",
          pp."role",
          pp."sharePercent",
          pp."status" AS "participantStatus",
          p."status" AS "placementStatus",
          p."inceptionDate",
          p."expiryDate",
          p."currency",
          p."premium",
          COALESCE(rt."name", p."classOfBusiness") AS "riskType",
          p."createdAt",
          ROW_NUMBER() OVER (
            PARTITION BY p."id"
            ORDER BY
              CASE pp."role"::text
                WHEN 'LEAD_REINSURER' THEN 1
                WHEN 'REINSURER' THEN 2
                WHEN 'CO_REINSURER' THEN 3
                ELSE 4
              END,
              pp."createdAt" ASC,
              pp."id" ASC
          ) AS "rowRank"
        FROM "reinsurance"."PlacementParticipant" pp
        JOIN "reinsurance"."Placement" p
          ON p."id" = pp."placementId"
         AND p."tenantId" = pp."tenantId"
        JOIN "reinsurance"."Counterparty" cedant
          ON cedant."id" = p."cedantId"
         AND cedant."tenantId" = p."tenantId"
        LEFT JOIN "reinsurance"."RiskType" rt
          ON rt."id" = p."riskTypeId"
         AND rt."tenantId" = p."tenantId"
        WHERE pp."tenantId" = ${tenantId}
          AND pp."counterpartyId" = ${query.reinsurerId}
          AND p."archivedAt" IS NULL
          ${searchPredicate}
      ),
      base_rows AS (
        SELECT *
        FROM participant_rows
        WHERE "rowRank" = 1
      )
    `;
  }

  private searchPredicate(search?: string) {
    const trimmed = search?.trim();
    if (!trimmed) return Prisma.empty;
    const pattern = `%${trimmed}%`;

    return Prisma.sql`
      AND (
        p."reference" ILIKE ${pattern}
        OR p."policyNumber" ILIKE ${pattern}
        OR p."title" ILIKE ${pattern}
        OR p."classOfBusiness" ILIKE ${pattern}
        OR cedant."name" ILIKE ${pattern}
      )
    `;
  }

  private filterPredicate(filter: ReinsurerPlacementFilter) {
    switch (filter) {
      case 'accepted':
        return Prisma.sql`AND "participantStatus"::text = 'ACCEPTED'`;
      case 'pending':
        return Prisma.sql`AND "placementStatus"::text IN ('DRAFT', 'MARKETING')`;
      case 'closed':
        return Prisma.sql`AND "placementStatus"::text IN ('PARTIALLY_PLACED', 'PLACED', 'CLOSED')`;
      case 'declined':
        return Prisma.sql`AND "participantStatus"::text = 'DECLINED'`;
      case 'all':
      default:
        return Prisma.empty;
    }
  }

  private toDto(
    row: ReinsurerPlacementRawRow,
  ): ReinsurerPlacementsWorklistRowDto {
    return {
      id: row.id,
      reference: row.policyNumber ?? row.reference,
      policyNumber: row.policyNumber,
      title: row.title,
      cedant: row.cedant,
      role: row.role as ReinsurerPlacementsWorklistRowDto['role'],
      sharePercent:
        row.sharePercent == null
          ? null
          : String(
              this.money.roundMoney(this.money.toNumber(row.sharePercent)),
            ),
      participantStatus:
        row.participantStatus as ReinsurerPlacementsWorklistRowDto['participantStatus'],
      placementStatus:
        row.placementStatus as ReinsurerPlacementsWorklistRowDto['placementStatus'],
      offerType: 'Facultative',
      inceptionDate: this.toIsoOrNull(row.inceptionDate),
      expiryDate: this.toIsoOrNull(row.expiryDate),
      currency: row.currency,
      premium: row.premium == null ? null : this.toMoneyNumber(row.premium),
      riskType: row.riskType,
    };
  }

  private toSummary(value: unknown): ReinsurerPlacementsWorklistSummaryDto {
    if (!value || typeof value !== 'object') {
      return { all: 0, accepted: 0, pending: 0, closed: 0, declined: 0 };
    }
    const item = value as Record<string, unknown>;
    return {
      all: this.toInteger(item.all ?? 0),
      accepted: this.toInteger(item.accepted ?? 0),
      pending: this.toInteger(item.pending ?? 0),
      closed: this.toInteger(item.closed ?? 0),
      declined: this.toInteger(item.declined ?? 0),
    };
  }

  private toMoneyNumber(value: Prisma.Decimal | string | number): number {
    return this.money.roundMoney(this.money.toNumber(value));
  }

  private toInteger(value: unknown): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }

  private toIsoOrNull(value: Date | string | null): string | null {
    if (value == null) return null;
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
