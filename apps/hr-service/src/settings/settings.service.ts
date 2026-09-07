import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AppraisalCycleRecipientGroup,
  EmploymentStatus,
  PayrollCountry,
} from '../../prisma/generated/client';
import {
  defaultPayrollCurrency,
  normalizePayrollCountry,
  normalizePayrollCurrency,
} from '../common/payroll-calculator.helper';

const DEFAULT_NOTICE_PERIOD_DAYS = 30;
const DEFAULT_PROBATION_PERIOD_MONTHS: number | null = null;
const DEFAULT_PAYROLL_TIER3_ENABLED = false;
const DEFAULT_PAYROLL_TIER3_RATE: number | null = null;
const DEFAULT_PAYROLL_TIER3_SCHEME_NAME: string | null = null;
const DEFAULT_PAYROLL_COUNTRY = PayrollCountry.GH;
const DEFAULT_APPRAISAL_CYCLE_RECIPIENTS = [
  AppraisalCycleRecipientGroup.ALL,
] as const;
const DEFAULT_APPRAISAL_THRESHOLDS = {
  outstandingThreshold: 90,
  veryGoodThreshold: 80,
  goodThreshold: 70,
  satisfactoryThreshold: 60,
};
const DEFAULT_APPRAISAL_ELIGIBLE_STATUSES = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
] as const;
const APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
  EmploymentStatus.SUSPENDED,
] as const;
type CompanyPolicyProbationOption = '3' | '4' | '5' | '6' | 'undefined';
type CompanyPolicyResignationWindow =
  | '1w'
  | '2w'
  | '1m'
  | '2m'
  | '3m'
  | '6m'
  | '1y'
  | '2y';
type CompanyPolicyCycleRecipient =
  | 'all'
  | 'permanent'
  | 'contractual'
  | 'probation'
  | 'interns';
const RESIGNATION_WINDOW_TO_DAYS: Record<
  CompanyPolicyResignationWindow,
  number
> = {
  '1w': 7,
  '2w': 14,
  '1m': 30,
  '2m': 60,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '2y': 730,
};
const DAYS_TO_RESIGNATION_WINDOW = Object.fromEntries(
  Object.entries(RESIGNATION_WINDOW_TO_DAYS).map(([window, days]) => [
    days,
    window,
  ]),
) as Record<number, CompanyPolicyResignationWindow>;
const CYCLE_RECIPIENT_API_TO_DB: Record<
  CompanyPolicyCycleRecipient,
  AppraisalCycleRecipientGroup
> = {
  all: AppraisalCycleRecipientGroup.ALL,
  permanent: AppraisalCycleRecipientGroup.PERMANENT,
  contractual: AppraisalCycleRecipientGroup.CONTRACTUAL,
  probation: AppraisalCycleRecipientGroup.PROBATION,
  interns: AppraisalCycleRecipientGroup.INTERNS,
};
const CYCLE_RECIPIENT_DB_TO_API: Record<
  AppraisalCycleRecipientGroup,
  CompanyPolicyCycleRecipient
> = {
  [AppraisalCycleRecipientGroup.ALL]: 'all',
  [AppraisalCycleRecipientGroup.PERMANENT]: 'permanent',
  [AppraisalCycleRecipientGroup.CONTRACTUAL]: 'contractual',
  [AppraisalCycleRecipientGroup.PROBATION]: 'probation',
  [AppraisalCycleRecipientGroup.INTERNS]: 'interns',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCompanyPolicyProbationPeriod(
    probationPeriod?: string | null,
  ): number | null {
    if (!probationPeriod || probationPeriod === 'undefined') {
      return DEFAULT_PROBATION_PERIOD_MONTHS;
    }

    return Number(probationPeriod);
  }

  private serializeCompanyPolicyProbationPeriod(
    months?: number | null,
  ): CompanyPolicyProbationOption {
    switch (months) {
      case 3:
        return '3';
      case 4:
        return '4';
      case 5:
        return '5';
      case 6:
        return '6';
      default:
        return 'undefined';
    }
  }

  private normalizeCompanyPolicyResignationWindow(
    resignationWindow?: string | null,
  ) {
    if (!resignationWindow) {
      return DEFAULT_NOTICE_PERIOD_DAYS;
    }

    return RESIGNATION_WINDOW_TO_DAYS[
      resignationWindow as CompanyPolicyResignationWindow
    ];
  }

  private serializeCompanyPolicyResignationWindow(days?: number | null) {
    return (
      DAYS_TO_RESIGNATION_WINDOW[days ?? DEFAULT_NOTICE_PERIOD_DAYS] ?? '1m'
    );
  }

  private normalizeCompanyPolicyCycleRecipients(
    cycleRecipients?: string[] | null,
  ): AppraisalCycleRecipientGroup[] {
    const normalized = Array.from(new Set(cycleRecipients ?? []))
      .map(
        (recipient) =>
          CYCLE_RECIPIENT_API_TO_DB[recipient as CompanyPolicyCycleRecipient],
      )
      .filter(
        (recipient): recipient is AppraisalCycleRecipientGroup =>
          recipient !== undefined,
      );

    return normalized.length
      ? normalized
      : [...DEFAULT_APPRAISAL_CYCLE_RECIPIENTS];
  }

  private serializeCompanyPolicyCycleRecipients(
    cycleRecipients?: AppraisalCycleRecipientGroup[] | null,
  ): CompanyPolicyCycleRecipient[] {
    const normalized = cycleRecipients?.length
      ? cycleRecipients
      : [...DEFAULT_APPRAISAL_CYCLE_RECIPIENTS];

    return normalized.map((recipient) => CYCLE_RECIPIENT_DB_TO_API[recipient]);
  }

  private deriveAppraisalEligibleStatusesFromCycleRecipients(
    cycleRecipients: AppraisalCycleRecipientGroup[],
  ): EmploymentStatus[] {
    const includeActive =
      cycleRecipients.includes(AppraisalCycleRecipientGroup.ALL) ||
      cycleRecipients.includes(AppraisalCycleRecipientGroup.PERMANENT) ||
      cycleRecipients.includes(AppraisalCycleRecipientGroup.CONTRACTUAL) ||
      cycleRecipients.includes(AppraisalCycleRecipientGroup.INTERNS);
    const includeProbation =
      cycleRecipients.includes(AppraisalCycleRecipientGroup.ALL) ||
      cycleRecipients.includes(AppraisalCycleRecipientGroup.PROBATION);

    const statuses: EmploymentStatus[] = [];

    if (includeActive) {
      statuses.push(EmploymentStatus.ACTIVE);
    }

    if (includeProbation) {
      statuses.push(EmploymentStatus.PROBATION);
    }

    return statuses.length
      ? statuses
      : [...DEFAULT_APPRAISAL_ELIGIBLE_STATUSES];
  }

  private normalizeAppraisalEligibleStatuses(
    statuses?: string[] | null,
  ): EmploymentStatus[] {
    const allowed = new Set(APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES);
    const normalized = Array.from(new Set(statuses ?? [])).filter((status) =>
      allowed.has(
        status as (typeof APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES)[number],
      ),
    ) as EmploymentStatus[];

    return normalized.length
      ? normalized
      : [...DEFAULT_APPRAISAL_ELIGIBLE_STATUSES];
  }

  async getResignationSettings(
    tenantId: string,
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    if (adminUserId || adminEmail) {
      await this.prisma.tenantConfig.updateMany({
        where: {
          tenantId,
          OR: [
            ...(adminUserId ? [{ adminUserId: null }] : []),
            ...(adminEmail ? [{ adminEmail: '' }] : []),
          ],
        },
        data: {
          ...(adminUserId ? { adminUserId } : {}),
          ...(adminEmail ? { adminEmail } : {}),
        },
      });
    }

    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { resignationNoticePeriodDays: true },
    });

    return {
      resignationNoticePeriodDays:
        config?.resignationNoticePeriodDays ?? DEFAULT_NOTICE_PERIOD_DAYS,
    };
  }

  async getAttendanceSettings(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { lateArrivalThresholdMinutes: true },
    });
    return {
      lateArrivalThresholdMinutes: config?.lateArrivalThresholdMinutes ?? 0,
    };
  }

  async getPayrollSettings(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        payrollCountry: true,
        payrollCurrency: true,
        payrollTier2FundName: true,
        payrollTier3Enabled: true,
        payrollTier3Rate: true,
        payrollTier3SchemeName: true,
      },
    });

    const payrollCountry = config?.payrollCountry ?? DEFAULT_PAYROLL_COUNTRY;
    return {
      payrollCountry,
      payrollCurrency:
        config?.payrollCurrency ?? defaultPayrollCurrency(payrollCountry),
      payrollTier2FundName: config?.payrollTier2FundName ?? null,
      payrollTier3Enabled:
        config?.payrollTier3Enabled ?? DEFAULT_PAYROLL_TIER3_ENABLED,
      payrollTier3Rate:
        config?.payrollTier3Rate != null
          ? Number(config.payrollTier3Rate.toString())
          : DEFAULT_PAYROLL_TIER3_RATE,
      payrollTier3SchemeName:
        config?.payrollTier3SchemeName ?? DEFAULT_PAYROLL_TIER3_SCHEME_NAME,
    };
  }

  async getAppraisalSettings(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        appraisalEligibleStatuses: true,
        outstandingThreshold: true,
        veryGoodThreshold: true,
        goodThreshold: true,
        satisfactoryThreshold: true,
      },
    });

    return {
      appraisalEligibleStatuses: this.normalizeAppraisalEligibleStatuses(
        config?.appraisalEligibleStatuses,
      ),
      outstandingThreshold:
        config?.outstandingThreshold ??
        DEFAULT_APPRAISAL_THRESHOLDS.outstandingThreshold,
      veryGoodThreshold:
        config?.veryGoodThreshold ??
        DEFAULT_APPRAISAL_THRESHOLDS.veryGoodThreshold,
      goodThreshold:
        config?.goodThreshold ?? DEFAULT_APPRAISAL_THRESHOLDS.goodThreshold,
      satisfactoryThreshold:
        config?.satisfactoryThreshold ??
        DEFAULT_APPRAISAL_THRESHOLDS.satisfactoryThreshold,
    };
  }

  async getCompanyPoliciesSettings(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        defaultProbationPeriodMonths: true,
        resignationNoticePeriodDays: true,
        appraisalCycleRecipients: true,
      },
    });

    const resignationNoticePeriodDays =
      config?.resignationNoticePeriodDays ?? DEFAULT_NOTICE_PERIOD_DAYS;
    const defaultProbationPeriodMonths =
      config?.defaultProbationPeriodMonths ?? DEFAULT_PROBATION_PERIOD_MONTHS;

    return {
      probationPeriod: this.serializeCompanyPolicyProbationPeriod(
        defaultProbationPeriodMonths,
      ),
      resignationWindow: this.serializeCompanyPolicyResignationWindow(
        resignationNoticePeriodDays,
      ),
      cycleRecipients: this.serializeCompanyPolicyCycleRecipients(
        config?.appraisalCycleRecipients,
      ),
      defaultProbationPeriodMonths,
      resignationNoticePeriodDays,
    };
  }

  async updateAttendanceSettings(
    tenantId: string,
    lateArrivalThresholdMinutes: number,
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        lateArrivalThresholdMinutes,
      },
      update: {
        lateArrivalThresholdMinutes,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: { lateArrivalThresholdMinutes: true },
    });
    return {
      message: 'Attendance settings updated successfully',
      lateArrivalThresholdMinutes: config.lateArrivalThresholdMinutes,
    };
  }

  async updateResignationSettings(
    tenantId: string,
    resignationNoticePeriodDays: number,
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        resignationNoticePeriodDays,
      },
      update: {
        resignationNoticePeriodDays,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: { resignationNoticePeriodDays: true },
    });

    return {
      message: 'Resignation settings updated successfully',
      resignationNoticePeriodDays: config.resignationNoticePeriodDays,
    };
  }

  async updatePayrollSettings(
    tenantId: string,
    payrollSettings: {
      payrollCountry?: string;
      payrollCurrency?: string;
      payrollTier2FundName?: string;
      payrollTier3Enabled?: boolean;
      payrollTier3Rate?: number;
      payrollTier3SchemeName?: string;
    },
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    const existing = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        payrollCountry: true,
        payrollCurrency: true,
        payrollTier2FundName: true,
        payrollTier3Enabled: true,
        payrollTier3Rate: true,
        payrollTier3SchemeName: true,
      },
    });
    const payrollCountryProvided = payrollSettings.payrollCountry !== undefined;
    const payrollCountry = payrollCountryProvided
      ? normalizePayrollCountry(payrollSettings.payrollCountry)
      : (existing?.payrollCountry ?? DEFAULT_PAYROLL_COUNTRY);
    const payrollCurrency =
      payrollSettings.payrollCurrency !== undefined
        ? normalizePayrollCurrency(
            payrollSettings.payrollCurrency,
            payrollCountry,
          )
        : payrollCountryProvided
          ? defaultPayrollCurrency(payrollCountry)
          : (existing?.payrollCurrency ??
            defaultPayrollCurrency(payrollCountry));
    const normalizedTier2FundName =
      payrollSettings.payrollTier2FundName !== undefined
        ? payrollSettings.payrollTier2FundName?.trim() || null
        : (existing?.payrollTier2FundName ?? null);
    const tier3Enabled =
      payrollSettings.payrollTier3Enabled ??
      existing?.payrollTier3Enabled ??
      DEFAULT_PAYROLL_TIER3_ENABLED;
    const normalizedTier3Rate =
      payrollSettings.payrollTier3Rate !== undefined
        ? payrollSettings.payrollTier3Rate == null
          ? null
          : Number(payrollSettings.payrollTier3Rate)
        : existing?.payrollTier3Rate != null
          ? Number(existing.payrollTier3Rate.toString())
          : null;
    const normalizedTier3SchemeName =
      payrollSettings.payrollTier3SchemeName !== undefined
        ? payrollSettings.payrollTier3SchemeName?.trim() || null
        : (existing?.payrollTier3SchemeName ?? null);

    if (tier3Enabled) {
      if (normalizedTier3Rate == null) {
        throw new BadRequestException(
          'Tier 3 rate is required when Tier 3 payroll support is enabled.',
        );
      }

      if (!normalizedTier3SchemeName) {
        throw new BadRequestException(
          'Tier 3 scheme name is required when Tier 3 payroll support is enabled.',
        );
      }
    }

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        payrollCountry,
        payrollCurrency,
        payrollTier2FundName: normalizedTier2FundName,
        payrollTier3Enabled: tier3Enabled,
        payrollTier3Rate: tier3Enabled ? normalizedTier3Rate : null,
        payrollTier3SchemeName: tier3Enabled ? normalizedTier3SchemeName : null,
      },
      update: {
        payrollCountry,
        payrollCurrency,
        payrollTier2FundName: normalizedTier2FundName,
        payrollTier3Enabled: tier3Enabled,
        payrollTier3Rate: tier3Enabled ? normalizedTier3Rate : null,
        payrollTier3SchemeName: tier3Enabled ? normalizedTier3SchemeName : null,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: {
        payrollCountry: true,
        payrollCurrency: true,
        payrollTier2FundName: true,
        payrollTier3Enabled: true,
        payrollTier3Rate: true,
        payrollTier3SchemeName: true,
      },
    });

    return {
      message: 'Payroll settings updated successfully',
      payrollCountry: config.payrollCountry,
      payrollCurrency: config.payrollCurrency,
      payrollTier2FundName: config.payrollTier2FundName,
      payrollTier3Enabled: config.payrollTier3Enabled,
      payrollTier3Rate:
        config.payrollTier3Rate != null
          ? Number(config.payrollTier3Rate.toString())
          : null,
      payrollTier3SchemeName: config.payrollTier3SchemeName,
    };
  }

  async updateCompanyPoliciesSettings(
    tenantId: string,
    policies: {
      probationPeriod?: string;
      resignationWindow?: string;
      cycleRecipients?: string[];
    },
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    const existing = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        defaultProbationPeriodMonths: true,
        resignationNoticePeriodDays: true,
        appraisalCycleRecipients: true,
      },
    });

    const appraisalCycleRecipients =
      policies.cycleRecipients !== undefined
        ? this.normalizeCompanyPolicyCycleRecipients(policies.cycleRecipients)
        : existing?.appraisalCycleRecipients?.length
          ? existing.appraisalCycleRecipients
          : [...DEFAULT_APPRAISAL_CYCLE_RECIPIENTS];

    const defaultProbationPeriodMonths =
      policies.probationPeriod !== undefined
        ? this.normalizeCompanyPolicyProbationPeriod(policies.probationPeriod)
        : (existing?.defaultProbationPeriodMonths ??
          DEFAULT_PROBATION_PERIOD_MONTHS);

    const resignationNoticePeriodDays =
      policies.resignationWindow !== undefined
        ? this.normalizeCompanyPolicyResignationWindow(
            policies.resignationWindow,
          )
        : (existing?.resignationNoticePeriodDays ?? DEFAULT_NOTICE_PERIOD_DAYS);

    const appraisalEligibleStatuses =
      this.deriveAppraisalEligibleStatusesFromCycleRecipients(
        appraisalCycleRecipients,
      );

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        defaultProbationPeriodMonths,
        resignationNoticePeriodDays,
        appraisalCycleRecipients,
        appraisalEligibleStatuses,
      },
      update: {
        defaultProbationPeriodMonths,
        resignationNoticePeriodDays,
        appraisalCycleRecipients,
        appraisalEligibleStatuses,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: {
        defaultProbationPeriodMonths: true,
        resignationNoticePeriodDays: true,
        appraisalCycleRecipients: true,
      },
    });

    return {
      message: 'Company policy settings updated successfully',
      probationPeriod: this.serializeCompanyPolicyProbationPeriod(
        config.defaultProbationPeriodMonths,
      ),
      resignationWindow: this.serializeCompanyPolicyResignationWindow(
        config.resignationNoticePeriodDays,
      ),
      cycleRecipients: this.serializeCompanyPolicyCycleRecipients(
        config.appraisalCycleRecipients,
      ),
      defaultProbationPeriodMonths: config.defaultProbationPeriodMonths,
      resignationNoticePeriodDays: config.resignationNoticePeriodDays,
    };
  }

  async updateAppraisalSettings(
    tenantId: string,
    thresholds: {
      outstandingThreshold: number;
      veryGoodThreshold: number;
      goodThreshold: number;
      satisfactoryThreshold: number;
      appraisalEligibleStatuses: string[];
    },
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    if (
      !(
        thresholds.outstandingThreshold > thresholds.veryGoodThreshold &&
        thresholds.veryGoodThreshold > thresholds.goodThreshold &&
        thresholds.goodThreshold > thresholds.satisfactoryThreshold
      )
    ) {
      throw new BadRequestException(
        'Performance band thresholds must descend strictly from Outstanding to Satisfactory.',
      );
    }

    const appraisalEligibleStatuses = this.normalizeAppraisalEligibleStatuses(
      thresholds.appraisalEligibleStatuses,
    );
    const thresholdValues = {
      outstandingThreshold: thresholds.outstandingThreshold,
      veryGoodThreshold: thresholds.veryGoodThreshold,
      goodThreshold: thresholds.goodThreshold,
      satisfactoryThreshold: thresholds.satisfactoryThreshold,
    };

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        appraisalEligibleStatuses,
        ...thresholdValues,
      },
      update: {
        appraisalEligibleStatuses,
        ...thresholdValues,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: {
        appraisalEligibleStatuses: true,
        outstandingThreshold: true,
        veryGoodThreshold: true,
        goodThreshold: true,
        satisfactoryThreshold: true,
      },
    });

    return {
      message: 'Appraisal settings updated successfully',
      ...config,
    };
  }
}
