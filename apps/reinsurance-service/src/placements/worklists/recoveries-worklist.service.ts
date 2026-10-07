import { Injectable } from '@nestjs/common';
import {
  PlacementClaimCashCallStatus,
  Prisma,
} from '../../../prisma/generated/client';
import {
  RecoveriesWorklistCurrencySummaryDto,
  RecoveriesWorklistResponseDto,
  RecoveriesWorklistRowDto,
} from '../dto/recoveries-worklist-response.dto';
import { QueryRecoveriesWorklistDto } from '../dto/query-recoveries-worklist.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';

type RecoveriesWorklistRawRow = {
  id: string;
  placementId: string;
  policyNumber: string | null;
  insuredTitle: string;
  riskType: string | null;
  claimId: string;
  claimNumber: string;
  cashCallId: string;
  cashCallNumber: string;
  cashCallStatus: PlacementClaimCashCallStatus;
  allocationId: string;
  reinsurerId: string;
  reinsurerName: string;
  currency: string;
  calledAmount: Prisma.Decimal | string | number | null;
  recordedAmount: Prisma.Decimal | string | number | null;
  confirmedAmount: Prisma.Decimal | string | number | null;
  reversedAmount: Prisma.Decimal | string | number | null;
  outstandingAmount: Prisma.Decimal | string | number | null;
  recoveredAmount: Prisma.Decimal | string | number | null;
  recoveryStatus: 'UNRECOVERED' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED';
  occurrenceDate: Date | string;
  totalCount: bigint | number | string;
  summaryByCurrency: unknown;
};

@Injectable()
export class ReinsuranceRecoveriesWorklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findRecoveries(
    tenantId: string,
    query: QueryRecoveriesWorklistDto,
  ): Promise<RecoveriesWorklistResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filters = this.filters(query);

    const rows = await this.prisma.$queryRaw<RecoveriesWorklistRawRow[]>`
      ${this.recoveriesCte(tenantId, query)}
      , filtered AS (
        SELECT *
        FROM recovery_rows
        WHERE TRUE
          ${filters}
      ),
      summarized AS (
        SELECT COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'currency', totals."currency",
                'calledAmount', totals."calledAmount",
                'recordedAmount', totals."recordedAmount",
                'confirmedAmount', totals."confirmedAmount",
                'outstandingAmount', totals."outstandingAmount",
                'overdueCount', totals."overdueCount"
              )
              ORDER BY totals."currency"
            )
            FROM (
              SELECT
                "currency",
                SUM("calledAmount") AS "calledAmount",
                SUM("recordedAmount") AS "recordedAmount",
                SUM("confirmedAmount") AS "confirmedAmount",
                SUM("outstandingAmount") AS "outstandingAmount",
                COUNT(*) FILTER (
                  WHERE "outstandingAmount" > 0.0001
                    AND "occurrenceDate" < NOW() - INTERVAL '90 days'
                ) AS "overdueCount"
              FROM filtered
              GROUP BY "currency"
            ) totals
          ),
          '[]'::jsonb
        ) AS "summaryByCurrency"
      ),
      counted AS (
        SELECT
          filtered.*,
          COUNT(*) OVER() AS "totalCount"
        FROM filtered
      )
      SELECT counted.*, summarized."summaryByCurrency"
      FROM counted
      CROSS JOIN summarized
      ORDER BY counted."occurrenceDate" DESC, counted."cashCallId" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    if (!rows.length) {
      const summaryRows = await this.prisma.$queryRaw<
        { totalCount: bigint | number | string; summaryByCurrency: unknown }[]
      >`
        ${this.recoveriesCte(tenantId, query)}
        , filtered AS (
          SELECT *
          FROM recovery_rows
          WHERE TRUE
            ${filters}
        )
        SELECT
          COUNT(*) AS "totalCount",
          COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'currency', totals."currency",
                'calledAmount', totals."calledAmount",
                'recordedAmount', totals."recordedAmount",
                'confirmedAmount', totals."confirmedAmount",
                'outstandingAmount', totals."outstandingAmount",
                'overdueCount', totals."overdueCount"
              )
              ORDER BY totals."currency"
            )
            FROM (
              SELECT
                "currency",
                SUM("calledAmount") AS "calledAmount",
                SUM("recordedAmount") AS "recordedAmount",
                SUM("confirmedAmount") AS "confirmedAmount",
                SUM("outstandingAmount") AS "outstandingAmount",
                COUNT(*) FILTER (
                  WHERE "outstandingAmount" > 0.0001
                    AND "occurrenceDate" < NOW() - INTERVAL '90 days'
                ) AS "overdueCount"
              FROM filtered
              GROUP BY "currency"
            ) totals
          ),
          '[]'::jsonb
        ) AS "summaryByCurrency"
        FROM filtered
      `;
      const total = this.toInteger(summaryRows[0]?.totalCount ?? 0);

      return {
        items: [],
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        summary: {
          byCurrency: this.toCurrencySummary(summaryRows[0]?.summaryByCurrency),
        },
      };
    }

    const total = this.toInteger(rows[0].totalCount);
    return {
      items: rows.map((row) => this.toDto(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        byCurrency: this.toCurrencySummary(rows[0].summaryByCurrency),
      },
    };
  }

  private recoveriesCte(
    tenantId: string,
    query: Pick<
      QueryRecoveriesWorklistDto,
      'search' | 'reinsurerId' | 'cedantId' | 'currency' | 'since' | 'until'
    >,
  ) {
    const searchPredicate = this.searchPredicate(query.search);
    const reinsurerPredicate = query.reinsurerId
      ? Prisma.sql`AND cc."counterpartyId" = ${query.reinsurerId}`
      : Prisma.empty;
    const cedantPredicate = query.cedantId
      ? Prisma.sql`AND p."cedantId" = ${query.cedantId}`
      : Prisma.empty;
    const currencyPredicate = query.currency
      ? Prisma.sql`AND cc."currency" = ${query.currency.toUpperCase()}`
      : Prisma.empty;
    const sincePredicate = query.since
      ? Prisma.sql`AND pc."occurrenceDate" >= ${new Date(query.since)}`
      : Prisma.empty;
    const untilPredicate = query.until
      ? Prisma.sql`AND pc."occurrenceDate" < ${new Date(query.until)}`
      : Prisma.empty;

    return Prisma.sql`
      WITH base_cash_calls AS (
        SELECT
          cc."id" AS "cashCallId",
          cc."placementId",
          cc."claimId",
          cc."allocationId",
          cc."counterpartyId",
          cc."cashCallNumber",
          cc."status" AS "cashCallStatus",
          cc."currency",
          cc."amount" AS "cashCallAmount",
          p."policyNumber",
          p."title" AS "insuredTitle",
          p."classOfBusiness" AS "riskType",
          p."cedantId",
          pc."claimNumber",
          pc."occurrenceDate",
          reinsurer."name" AS "reinsurerName"
        FROM "reinsurance"."PlacementClaimCashCall" cc
        JOIN "reinsurance"."PlacementClaim" pc
          ON pc."id" = cc."claimId"
         AND pc."tenantId" = cc."tenantId"
        JOIN "reinsurance"."Placement" p
          ON p."id" = cc."placementId"
         AND p."tenantId" = cc."tenantId"
        JOIN "reinsurance"."Counterparty" reinsurer
          ON reinsurer."id" = cc."counterpartyId"
         AND reinsurer."tenantId" = cc."tenantId"
        WHERE cc."tenantId" = ${tenantId}
          AND p."archivedAt" IS NULL
          ${searchPredicate}
          ${reinsurerPredicate}
          ${cedantPredicate}
          ${currencyPredicate}
          ${sincePredicate}
          ${untilPredicate}
      ),
      receipt_totals AS (
        SELECT
          r."cashCallId",
          SUM(r."amount") FILTER (
            WHERE r."status"::text = 'RECORDED'
              AND r."reversalOfReceiptId" IS NULL
          ) AS "recordedAmount",
          SUM(r."amount") FILTER (
            WHERE r."status"::text = 'BANK_CONFIRMED'
              AND r."reversalOfReceiptId" IS NULL
          ) AS "confirmedAmount",
          SUM(ABS(r."amount")) FILTER (
            WHERE r."reversalOfReceiptId" IS NOT NULL
          ) AS "reversedAmount"
        FROM "reinsurance"."PlacementClaimRecoveryReceipt" r
        JOIN base_cash_calls bcc ON bcc."cashCallId" = r."cashCallId"
        WHERE r."tenantId" = ${tenantId}
        GROUP BY r."cashCallId"
      ),
      approval_totals AS (
        SELECT
          bcc."cashCallId",
          SUM(ra."approvedAmount") AS "approvedAmount"
        FROM base_cash_calls bcc
        JOIN "reinsurance"."PlacementClaimRecoveryApproval" ra
          ON ra."allocationId" = bcc."allocationId"
         AND ra."tenantId" = ${tenantId}
         AND ra."currency" = bcc."currency"
         AND ra."counterpartyId" = bcc."counterpartyId"
         AND (ra."cashCallId" IS NULL OR ra."cashCallId" = bcc."cashCallId")
        GROUP BY bcc."cashCallId"
      ),
      recovery_rows AS (
        SELECT
          bcc."cashCallId" AS "id",
          bcc."placementId",
          bcc."policyNumber",
          bcc."insuredTitle",
          bcc."riskType",
          bcc."claimId",
          bcc."claimNumber",
          bcc."cashCallId",
          bcc."cashCallNumber",
          bcc."cashCallStatus",
          bcc."allocationId",
          bcc."counterpartyId" AS "reinsurerId",
          bcc."reinsurerName",
          bcc."currency",
          bcc."cashCallAmount" AS "calledAmount",
          COALESCE(rt."recordedAmount", 0) AS "recordedAmount",
          COALESCE(rt."confirmedAmount", 0) AS "confirmedAmount",
          COALESCE(rt."reversedAmount", 0) AS "reversedAmount",
          GREATEST(
            0,
            CASE
              WHEN bcc."cashCallStatus"::text IN ('ISSUED', 'PAID') THEN
                COALESCE(NULLIF(at."approvedAmount", 0), bcc."cashCallAmount")
                  - COALESCE(rt."confirmedAmount", 0)
              ELSE 0
            END
          ) AS "outstandingAmount",
          COALESCE(rt."confirmedAmount", 0) AS "recoveredAmount",
          CASE
            WHEN COALESCE(rt."confirmedAmount", 0) <= 0 THEN 'UNRECOVERED'
            WHEN GREATEST(
              0,
              CASE
                WHEN bcc."cashCallStatus"::text IN ('ISSUED', 'PAID') THEN
                  COALESCE(NULLIF(at."approvedAmount", 0), bcc."cashCallAmount")
                    - COALESCE(rt."confirmedAmount", 0)
                ELSE 0
              END
            ) <= 0.0001 THEN 'FULLY_RECOVERED'
            ELSE 'PARTIALLY_RECOVERED'
          END AS "recoveryStatus",
          bcc."occurrenceDate"
        FROM base_cash_calls bcc
        LEFT JOIN receipt_totals rt ON rt."cashCallId" = bcc."cashCallId"
        LEFT JOIN approval_totals at ON at."cashCallId" = bcc."cashCallId"
      )
    `;
  }

  private filters(query: QueryRecoveriesWorklistDto) {
    const statusPredicate = query.recoveryStatus
      ? Prisma.sql`AND "recoveryStatus" = ${query.recoveryStatus}`
      : Prisma.empty;
    const cashCallStatusPredicate = query.cashCallStatus
      ? Prisma.sql`AND "cashCallStatus"::text = ${query.cashCallStatus}`
      : Prisma.empty;
    return Prisma.sql`${statusPredicate} ${cashCallStatusPredicate}`;
  }

  private searchPredicate(search?: string) {
    const trimmed = search?.trim();
    if (!trimmed) return Prisma.empty;
    const pattern = `%${trimmed}%`;
    return Prisma.sql`
      AND (
        p."policyNumber" ILIKE ${pattern}
        OR p."title" ILIKE ${pattern}
        OR p."classOfBusiness" ILIKE ${pattern}
        OR pc."claimNumber" ILIKE ${pattern}
        OR cc."cashCallNumber" ILIKE ${pattern}
        OR reinsurer."name" ILIKE ${pattern}
      )
    `;
  }

  private toDto(row: RecoveriesWorklistRawRow): RecoveriesWorklistRowDto {
    return {
      id: row.id,
      placementId: row.placementId,
      policyNumber: row.policyNumber,
      insuredTitle: row.insuredTitle,
      riskType: row.riskType,
      claimId: row.claimId,
      claimNumber: row.claimNumber,
      cashCallId: row.cashCallId,
      cashCallNumber: row.cashCallNumber,
      cashCallStatus: row.cashCallStatus,
      allocationId: row.allocationId,
      reinsurerId: row.reinsurerId,
      reinsurerName: row.reinsurerName,
      currency: row.currency,
      calledAmount: this.toMoneyNumber(row.calledAmount),
      recordedAmount: this.toMoneyNumber(row.recordedAmount),
      confirmedAmount: this.toMoneyNumber(row.confirmedAmount),
      reversedAmount: this.toMoneyNumber(row.reversedAmount),
      outstandingAmount: this.toMoneyNumber(row.outstandingAmount),
      recoveredAmount: this.toMoneyNumber(row.recoveredAmount),
      recoveryStatus: row.recoveryStatus,
      occurrenceDate: this.toIso(row.occurrenceDate),
    };
  }

  private toCurrencySummary(
    value: unknown,
  ): RecoveriesWorklistCurrencySummaryDto[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const item = row as {
          currency?: unknown;
          calledAmount?: unknown;
          recordedAmount?: unknown;
          confirmedAmount?: unknown;
          outstandingAmount?: unknown;
          overdueCount?: unknown;
        };
        if (typeof item.currency !== 'string') return null;
        return {
          currency: item.currency,
          calledAmount: this.toMoneyNumber(item.calledAmount ?? 0),
          recordedAmount: this.toMoneyNumber(item.recordedAmount ?? 0),
          confirmedAmount: this.toMoneyNumber(item.confirmedAmount ?? 0),
          outstandingAmount: this.toMoneyNumber(item.outstandingAmount ?? 0),
          overdueCount: this.toInteger(item.overdueCount ?? 0),
        };
      })
      .filter((row): row is RecoveriesWorklistCurrencySummaryDto => !!row);
  }

  private toMoneyNumber(value: unknown): number {
    return this.money.roundMoney(
      this.money.toNumber(value as Prisma.Decimal | string | number),
    );
  }

  private toInteger(value: unknown): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }

  private toIso(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
