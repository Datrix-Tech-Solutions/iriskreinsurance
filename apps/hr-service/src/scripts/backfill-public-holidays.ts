import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveService } from '../leave/leave.service';
import type { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';

type TenantCountryMap = Record<string, string>;
type YearRange = {
  gte: Date;
  lt: Date;
};

const logger = new Logger('BackfillPublicHolidays');

function parseCsv(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function parseYears(value: string | undefined): number[] {
  const currentYear = new Date().getFullYear();
  const fallbackYears = [currentYear];
  const rawYears = parseCsv(value);

  if (rawYears.length === 0) {
    return fallbackYears;
  }

  const years = rawYears.map((year) => Number(year));
  if (years.some((year) => !Number.isInteger(year) || year < 2000)) {
    throw new Error('HOLIDAY_BACKFILL_YEARS must be comma-separated years.');
  }

  return Array.from(new Set(years));
}

function parseTenantCountryMap(value: string | undefined): TenantCountryMap {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('HOLIDAY_BACKFILL_TENANT_COUNTRIES must be a JSON object.');
  }

  return Object.entries(parsed).reduce<TenantCountryMap>(
    (accumulator, [tenantId, country]) => {
      if (typeof country === 'string' && country.trim()) {
        accumulator[tenantId] = country.trim();
      }
      return accumulator;
    },
    {},
  );
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

function buildYearRanges(years: number[]): YearRange[] {
  return years.map((year) => ({
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
  }));
}

async function loadTenantIds(prisma: PrismaService): Promise<string[]> {
  const [tenantConfigs, employees, leaveTypes, holidays] = await Promise.all([
    prisma.tenantConfig.findMany({ select: { tenantId: true } }),
    prisma.employee.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    }),
    prisma.leaveType.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    }),
    prisma.publicHoliday.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    }),
  ]);

  return Array.from(
    new Set(
      [...tenantConfigs, ...employees, ...leaveTypes, ...holidays].map(
        (item) => item.tenantId,
      ),
    ),
  ).sort();
}

async function pruneSeededHolidaysOutsideYears(
  prisma: PrismaService,
  tenantId: string,
  years: number[],
  dryRun: boolean,
): Promise<number> {
  const yearRanges = buildYearRanges(years);
  const where = {
    tenantId,
    source: { not: 'MANUAL' },
    NOT: {
      OR: yearRanges.map((range) => ({
        date: {
          gte: range.gte,
          lt: range.lt,
        },
      })),
    },
  };

  if (dryRun) {
    return prisma.publicHoliday.count({ where });
  }

  const result = await prisma.publicHoliday.deleteMany({ where });
  return result.count;
}

async function main() {
  const prisma = new PrismaService();
  const leaveService = new LeaveService(prisma, {} as RabbitMQPublisher);
  const years = parseYears(process.env.HOLIDAY_BACKFILL_YEARS);
  const tenantCountryMap = parseTenantCountryMap(
    process.env.HOLIDAY_BACKFILL_TENANT_COUNTRIES,
  );
  const defaultCountry = process.env.HOLIDAY_BACKFILL_COUNTRY?.trim() || 'GH';
  const tenantIdFilter = new Set(
    parseCsv(process.env.HOLIDAY_BACKFILL_TENANT_IDS),
  );
  const dryRun = parseBoolean(process.env.HOLIDAY_BACKFILL_DRY_RUN, false);
  const pruneOutsideYears = parseBoolean(
    process.env.HOLIDAY_BACKFILL_PRUNE_OUTSIDE_YEARS,
    true,
  );

  await prisma.$connect();

  try {
    const tenantIds = (await loadTenantIds(prisma)).filter(
      (tenantId) => tenantIdFilter.size === 0 || tenantIdFilter.has(tenantId),
    );

    if (tenantIds.length === 0) {
      logger.warn('No tenants found for public holiday backfill.');
      return;
    }

    logger.log(
      `Backfilling public holidays for ${tenantIds.length} tenant(s), years ${years.join(
        ', ',
      )}, default country ${defaultCountry}${dryRun ? ' (dry run)' : ''}.`,
    );

    let completed = 0;
    for (const tenantId of tenantIds) {
      const country = tenantCountryMap[tenantId] ?? defaultCountry;

      if (dryRun) {
        logger.log(`Would seed tenant ${tenantId} using country ${country}.`);
      } else {
        await leaveService.seedPublicHolidaysForTenant(
          tenantId,
          country,
          years,
        );
        completed += 1;
        logger.log(
          `Seeded public holidays for tenant ${tenantId} (${country}).`,
        );
      }

      if (pruneOutsideYears) {
        const prunedCount = await pruneSeededHolidaysOutsideYears(
          prisma,
          tenantId,
          years,
          dryRun,
        );
        logger.log(
          `${dryRun ? 'Would remove' : 'Removed'} ${prunedCount} seeded holiday(s) outside selected years for tenant ${tenantId}.`,
        );
      }
    }

    logger.log(`Public holiday backfill complete for ${completed} tenant(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  logger.error(
    error instanceof Error ? error.message : 'Public holiday backfill failed.',
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
