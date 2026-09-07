import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveService } from '../leave/leave.service';
import type { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import {
  normalizePayrollCountry,
  normalizePayrollCurrency,
} from '../common/payroll-calculator.helper';

type AuthTenantRow = {
  id: string;
  slug: string;
  email: string;
  country: string | null;
  currency: string | null;
  status: string;
  moduleConfig: unknown;
  featureConfig: unknown;
  adminUserId: string | null;
};

type HrEvidenceRow = {
  tenantId: string;
};

export type HrBaselineBootstrapOptions = {
  allEligible: boolean;
  tenantSlugs: string[];
};

export type HrBaselineTenantSummary = {
  tenantId: string;
  slug: string;
  employeesProcessed: number;
  leaveTypes: number;
  publicHolidays: number;
  leaveBalances: number;
};

type BootstrapLogger = Pick<Logger, 'log' | 'warn' | 'error'>;

const INTERNAL_TENANT_SLUGS = new Set(['datrix-internal']);
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function booleanAtPath(value: unknown, path: string[]): boolean {
  let current = parseJsonLike(value);

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current === true;
}

function hasEnabledHrFeature(value: unknown): boolean {
  const parsed = parseJsonLike(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }

  const hr = (parsed as Record<string, unknown>).hr;
  if (hr === true) return true;
  if (!hr || typeof hr !== 'object' || Array.isArray(hr)) return false;

  return Object.values(hr).some((flag) => flag === true);
}

function validateTenantSlugs(slugs: string[]) {
  for (const slug of slugs) {
    if (!TENANT_SLUG_PATTERN.test(slug)) {
      throw new Error(
        `Invalid tenant slug "${slug}". Use lowercase letters, numbers, and hyphens only.`,
      );
    }
  }
}

export function parseBootstrapArgs(argv: string[]): HrBaselineBootstrapOptions {
  const tenantSlugs: string[] = [];
  let allEligible = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--all-eligible') {
      allEligible = true;
      continue;
    }

    if (arg === '--tenant') {
      const value = argv[index + 1];
      if (!value) throw new Error('--tenant requires a tenant slug.');
      tenantSlugs.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--tenant=')) {
      tenantSlugs.push(arg.slice('--tenant='.length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!allEligible && tenantSlugs.length === 0) {
    allEligible = true;
  }

  validateTenantSlugs(tenantSlugs);
  return { allEligible, tenantSlugs: Array.from(new Set(tenantSlugs)) };
}

export class HrBaselineBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveService: Pick<
      LeaveService,
      | 'seedDefaultLeaveTypes'
      | 'seedPublicHolidaysForTenant'
      | 'initializeLeaveBalances'
    >,
    private readonly logger: BootstrapLogger = new Logger(
      'HrBaselineBootstrap',
    ),
  ) {}

  async run(
    options: HrBaselineBootstrapOptions,
  ): Promise<HrBaselineTenantSummary[]> {
    const tenants = await this.loadAuthTenants(options.tenantSlugs);
    const hrEvidenceTenantIds = await this.loadHrEvidenceTenantIds();
    const explicitSlugs = new Set(options.tenantSlugs);

    const eligibleTenants = tenants.filter((tenant) =>
      this.isTenantEligible(
        tenant,
        hrEvidenceTenantIds,
        explicitSlugs,
        options,
      ),
    );

    if (eligibleTenants.length === 0) {
      this.logger.warn('No eligible HR tenants found for baseline bootstrap.');
      return [];
    }

    this.logger.log(
      `HR baseline bootstrap starting for ${eligibleTenants.length} tenant(s): ${eligibleTenants
        .map((tenant) => tenant.slug)
        .join(', ')}`,
    );

    const summaries: HrBaselineTenantSummary[] = [];
    const failures: string[] = [];

    for (const tenant of eligibleTenants) {
      try {
        summaries.push(await this.bootstrapTenant(tenant));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${tenant.slug}: ${message}`);
        this.logger.error(
          `HR baseline bootstrap failed for ${tenant.slug}: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `HR baseline bootstrap failed for ${failures.length} tenant(s): ${failures.join('; ')}`,
      );
    }

    this.logger.log(
      `HR baseline bootstrap complete for ${summaries.length} tenant(s).`,
    );
    return summaries;
  }

  private async loadAuthTenants(tenantSlugs: string[]) {
    const slugFilter =
      tenantSlugs.length > 0
        ? Prisma.sql`AND t.slug IN (${Prisma.join(tenantSlugs)})`
        : Prisma.empty;

    return this.prisma.$queryRaw<AuthTenantRow[]>(Prisma.sql`
      SELECT
        t.id,
        t.slug,
        t.email,
        t.country,
        t.currency,
        t.status,
        t."moduleConfig" AS "moduleConfig",
        t."featureConfig" AS "featureConfig",
        admin_user.id AS "adminUserId"
      FROM w_auth."Tenant" t
      LEFT JOIN LATERAL (
        SELECT u.id
        FROM w_auth."User" u
        WHERE u."tenantId" = t.id AND u.role = 'TENANT_ADMIN'
        ORDER BY u."createdAt" ASC
        LIMIT 1
      ) admin_user ON true
      WHERE t.slug <> 'datrix-internal'
      ${slugFilter}
      ORDER BY t.slug
    `);
  }

  private async loadHrEvidenceTenantIds() {
    const rows = await this.prisma.$queryRaw<HrEvidenceRow[]>(Prisma.sql`
      SELECT DISTINCT "tenantId" FROM hr."Employee"
      UNION
      SELECT DISTINCT "tenantId" FROM hr."LeaveType"
      UNION
      SELECT DISTINCT "tenantId" FROM hr."TenantConfig"
      UNION
      SELECT DISTINCT "tenantId" FROM hr."PublicHoliday"
    `);

    return new Set(rows.map((row) => row.tenantId));
  }

  private isTenantEligible(
    tenant: AuthTenantRow,
    hrEvidenceTenantIds: Set<string>,
    explicitSlugs: Set<string>,
    options: HrBaselineBootstrapOptions,
  ) {
    if (tenant.status !== 'ACTIVE') {
      this.logger.warn(
        `Skipping ${tenant.slug}: tenant status is ${tenant.status}, not ACTIVE.`,
      );
      return false;
    }

    if (INTERNAL_TENANT_SLUGS.has(tenant.slug)) {
      this.logger.warn(`Skipping ${tenant.slug}: internal platform tenant.`);
      return false;
    }

    if (explicitSlugs.has(tenant.slug)) {
      return true;
    }

    if (!options.allEligible) {
      return false;
    }

    return (
      hrEvidenceTenantIds.has(tenant.id) ||
      booleanAtPath(tenant.moduleConfig, ['hr']) ||
      hasEnabledHrFeature(tenant.featureConfig)
    );
  }

  private async bootstrapTenant(
    tenant: AuthTenantRow,
  ): Promise<HrBaselineTenantSummary> {
    const payrollCountry = normalizePayrollCountry(tenant.country);
    const payrollCurrency = normalizePayrollCurrency(
      tenant.currency,
      payrollCountry,
    );

    await this.leaveService.seedDefaultLeaveTypes(tenant.id);
    await this.leaveService.seedPublicHolidaysForTenant(
      tenant.id,
      tenant.country,
    );

    await this.prisma.tenantConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        adminEmail: tenant.email,
        adminUserId: tenant.adminUserId ?? undefined,
        payrollCountry,
        payrollCurrency,
      },
      update: {
        adminEmail: tenant.email,
        adminUserId: tenant.adminUserId ?? undefined,
        payrollCountry,
        payrollCurrency,
      },
    });

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId: tenant.id,
        employmentStatus: { not: 'OFFBOARDED' },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const employee of employees) {
      await this.leaveService.initializeLeaveBalances(tenant.id, employee.id);
    }

    const [leaveTypes, publicHolidays, leaveBalances] = await Promise.all([
      this.prisma.leaveType.count({ where: { tenantId: tenant.id } }),
      this.prisma.publicHoliday.count({ where: { tenantId: tenant.id } }),
      this.prisma.leaveBalance.count({ where: { tenantId: tenant.id } }),
    ]);

    const summary = {
      tenantId: tenant.id,
      slug: tenant.slug,
      employeesProcessed: employees.length,
      leaveTypes,
      publicHolidays,
      leaveBalances,
    };

    this.logger.log(
      `${tenant.slug}: TenantConfig ensured, ${leaveTypes} leave type(s), ${publicHolidays} public holiday row(s), ${employees.length} employee(s) processed, ${leaveBalances} leave balance row(s).`,
    );

    return summary;
  }
}

async function main() {
  const options = parseBootstrapArgs(process.argv.slice(2));
  const prisma = new PrismaService();
  const leaveService = new LeaveService(prisma, {} as RabbitMQPublisher);
  const logger = new Logger('HrBaselineBootstrap');
  const bootstrap = new HrBaselineBootstrap(prisma, leaveService, logger);

  await prisma.$connect();
  try {
    await bootstrap.run(options);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const logger = new Logger('HrBaselineBootstrap');
    logger.error(
      error instanceof Error ? error.message : 'HR baseline bootstrap failed.',
      error instanceof Error ? error.stack : undefined,
    );
    process.exitCode = 1;
  });
}
