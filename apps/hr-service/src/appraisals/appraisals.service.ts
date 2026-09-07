import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PermissionRecipient, RequestUser } from '@work-phelo/types';
import { EmploymentStatus, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppraisalCycleDto } from './dto/create-cycle.dto';
import { UpdateAppraisalCycleDto } from './dto/update-cycle.dto';
import { SubmitReviewDto, KpiScoreDto } from './dto/submit-review.dto';
import { CreateAppraisalTemplateDto } from './dto/create-template.dto';
import { CreateAppraisalKpiDto } from './dto/create-kpi.dto';
import { FinalizeAppraisalDto } from './dto/finalize-appraisal.dto';
import {
  ReopenAppraisalDto,
  ReopenAppraisalTarget,
} from './dto/reopen-appraisal.dto';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { NotificationsService } from '../notifications/notifications.service';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

type FinalRating =
  | 'Outstanding'
  | 'Very Good'
  | 'Good'
  | 'Satisfactory'
  | 'Needs Improvement';

type PerformanceBandConfig = {
  outstandingThreshold: number;
  veryGoodThreshold: number;
  goodThreshold: number;
  satisfactoryThreshold: number;
};

type AppraisalFinalizerRecipient = {
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: 'FINALIZER' | 'TENANT_ADMIN_ESCALATION';
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

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function differenceInCalendarDays(target: Date, now: Date): number {
  const targetDate = new Date(`${normalizeDateOnly(target)}T00:00:00.000Z`);
  const nowDate = new Date(`${normalizeDateOnly(now)}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (targetDate.getTime() - nowDate.getTime()) / millisecondsPerDay,
  );
}

function scoreToRating(
  score: number | null,
  bands: PerformanceBandConfig,
): FinalRating {
  if (score === null || score === undefined) return 'Needs Improvement';
  if (score >= bands.outstandingThreshold) return 'Outstanding';
  if (score >= bands.veryGoodThreshold) return 'Very Good';
  if (score >= bands.goodThreshold) return 'Good';
  if (score >= bands.satisfactoryThreshold) return 'Satisfactory';
  return 'Needs Improvement';
}

function deriveOverallStatus(appraisal: {
  status?: string;
  selfStatus: string;
  managerStatus: string;
  finalScore: number | null;
}): string {
  if (appraisal.status === 'PENDING_FINALIZATION') return 'PendingFinalization';
  if (appraisal.managerStatus === 'SUBMITTED' && appraisal.finalScore !== null)
    return 'Finalized';
  if (appraisal.managerStatus === 'SUBMITTED') return 'ManagerSubmitted';
  if (appraisal.selfStatus === 'SUBMITTED') return 'SelfSubmitted';
  return 'NotStarted';
}

function calcWeightedScore(
  kpiScores: { score: number; kpi: { weight: number; maxScore: number } }[],
): number {
  const totalWeight = kpiScores.reduce((s, k) => s + k.kpi.weight, 0);
  if (!totalWeight) return 0;
  return roundToTwoDecimals(
    kpiScores.reduce((sum, item) => {
      if (!item.kpi.maxScore) return sum;
      return (
        sum +
        roundToTwoDecimals(
          (item.score / item.kpi.maxScore) *
            (item.kpi.weight / totalWeight) *
            100,
        )
      );
    }, 0),
  );
}

function calcFinalScore(
  selfScore: number | null,
  managerScore: number,
  selfWeight: number,
  managerWeight: number,
): number {
  if (selfScore === null) return managerScore;
  return roundToTwoDecimals(
    selfScore * (selfWeight / 100) + managerScore * (managerWeight / 100),
  );
}

function buildPersonName(person: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
}

function validateTemplatePayload(
  dto: Pick<
    CreateAppraisalTemplateDto,
    'kpis' | 'selfAssessmentWeight' | 'managerAssessmentWeight'
  >,
) {
  const selfWeight = dto.selfAssessmentWeight ?? 40;
  const managerWeight = dto.managerAssessmentWeight ?? 60;
  const assessmentTotal = selfWeight + managerWeight;

  if (assessmentTotal !== 100) {
    throw new BadRequestException(
      `Self and manager weightings must total 100%. Current total is ${assessmentTotal}%`,
    );
  }

  const kpis = dto.kpis ?? [];
  const totalKpiWeight = kpis.reduce((sum, kpi) => sum + kpi.weight, 0);

  if (totalKpiWeight !== 100) {
    throw new BadRequestException(
      `KPI weights must total 100%. Current total is ${totalKpiWeight}%`,
    );
  }
}

@Injectable()
export class AppraisalsService {
  private readonly logger = new Logger(AppraisalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMQPublisher,
    private readonly notificationsService: NotificationsService,
  ) {}

  private buildAppraisalSelfAssessmentLink(
    tenantSlug: string,
    cycleId: string,
    appraisalId: string,
  ) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/appraisal/cycles/${encodeURIComponent(cycleId)}/self-assessment/${encodeURIComponent(appraisalId)}`;
  }

  private buildAppraisalManagerReviewLink(
    tenantSlug: string,
    cycleId: string,
    appraisalId: string,
  ) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/appraisal/cycles/${encodeURIComponent(cycleId)}/manager-review/${encodeURIComponent(appraisalId)}`;
  }

  private buildAppraisalResultLink(
    tenantSlug: string,
    cycleId: string,
    appraisalId: string,
  ) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/appraisal/cycles/${encodeURIComponent(cycleId)}/results/${encodeURIComponent(appraisalId)}`;
  }

  private buildAppraisalFinalizationLink(
    tenantSlug: string,
    cycleId: string,
    appraisalId: string,
  ) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/appraisal/cycles/${encodeURIComponent(cycleId)}/employee/${encodeURIComponent(appraisalId)}`;
  }

  private emitNotificationEvent(promise: Promise<void>, context: string) {
    void promise.catch((error) =>
      this.logger.error(
        `[appraisal] Failed to publish ${context} notification event`,
        error,
      ),
    );
  }

  private dedupeAppraisalFinalizers(
    recipients: AppraisalFinalizerRecipient[],
  ): AppraisalFinalizerRecipient[] {
    const seen = new Set<string>();
    return recipients.filter((recipient) => {
      const key = recipient.userId || recipient.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async resolveAppraisalFinalizers(
    tenantId: string,
    excludingUserIds: string[] = [],
  ): Promise<AppraisalFinalizerRecipient[]> {
    const mapRecipient = (
      recipient: PermissionRecipient,
      source: AppraisalFinalizerRecipient['source'],
    ): AppraisalFinalizerRecipient => ({
      userId: recipient.userId,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      source,
    });

    const finalizers = await this.publisher.authResolvePermissionRecipients({
      tenantId,
      resource: 'appraisals',
      action: 'APPROVE',
      activeOnly: true,
    });

    const explicit = this.dedupeAppraisalFinalizers(
      finalizers
        .filter((recipient) => recipient.email)
        .filter((recipient) => !excludingUserIds.includes(recipient.userId))
        .map((recipient) => mapRecipient(recipient, 'FINALIZER')),
    );

    if (explicit.length > 0) return explicit;

    const escalated = await this.publisher.authResolvePermissionRecipients({
      tenantId,
      resource: 'appraisals',
      action: 'APPROVE',
      includeTenantAdmins: true,
      activeOnly: true,
    });

    return this.dedupeAppraisalFinalizers(
      escalated
        .filter((recipient) => recipient.email)
        .filter((recipient) => recipient.role === 'TENANT_ADMIN')
        .filter((recipient) => !excludingUserIds.includes(recipient.userId))
        .map((recipient) => mapRecipient(recipient, 'TENANT_ADMIN_ESCALATION')),
    );
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

  private async loadAppraisalEligibleStatuses(
    tenantId: string,
    cycleEmploymentStatuses?: string[] | null,
  ): Promise<EmploymentStatus[]> {
    const cycleStatuses = this.normalizeAppraisalEligibleStatuses(
      cycleEmploymentStatuses,
    );

    if ((cycleEmploymentStatuses ?? []).length > 0) {
      return cycleStatuses;
    }

    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { appraisalEligibleStatuses: true },
    });

    return this.normalizeAppraisalEligibleStatuses(
      config?.appraisalEligibleStatuses,
    );
  }

  private async loadPerformanceBands(
    tenantId: string,
  ): Promise<PerformanceBandConfig> {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        outstandingThreshold: true,
        veryGoodThreshold: true,
        goodThreshold: true,
        satisfactoryThreshold: true,
      },
    });

    return {
      outstandingThreshold: config?.outstandingThreshold ?? 90,
      veryGoodThreshold: config?.veryGoodThreshold ?? 80,
      goodThreshold: config?.goodThreshold ?? 70,
      satisfactoryThreshold: config?.satisfactoryThreshold ?? 60,
    };
  }

  private validateCycleDates(params: {
    startDate: Date;
    endDate: Date;
    selfAssessmentDeadline: Date;
    managerReviewDeadline: Date;
  }) {
    const {
      startDate,
      endDate,
      selfAssessmentDeadline,
      managerReviewDeadline,
    } = params;

    if (endDate < startDate) {
      throw new BadRequestException(
        'Cycle end date cannot be before cycle start date',
      );
    }

    if (
      selfAssessmentDeadline < startDate ||
      selfAssessmentDeadline > endDate
    ) {
      throw new BadRequestException(
        'Self assessment deadline must fall within the cycle start and end dates',
      );
    }

    if (
      managerReviewDeadline <= selfAssessmentDeadline ||
      managerReviewDeadline > endDate
    ) {
      throw new BadRequestException(
        'Manager review deadline must be after self assessment deadline and within the cycle end date',
      );
    }
  }

  private async ensureUniqueTemplateName(
    tenantId: string,
    name: string,
    excludeTemplateId?: string,
  ) {
    const existing = await this.prisma.appraisalTemplate.findFirst({
      where: {
        tenantId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeTemplateId ? { id: { not: excludeTemplateId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }
  }

  private async ensureUniqueCycleTitle(
    tenantId: string,
    title: string,
    excludeCycleId?: string,
  ) {
    const existing = await this.prisma.appraisalCycle.findFirst({
      where: {
        tenantId,
        title: { equals: title.trim(), mode: 'insensitive' },
        ...(excludeCycleId ? { id: { not: excludeCycleId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'An appraisal cycle with this name already exists',
      );
    }
  }

  private async ensureTemplateExists(tenantId: string, templateId: string) {
    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { kpis: true },
    });

    if (!template) {
      throw new BadRequestException(
        'Selected appraisal template does not exist',
      );
    }

    return template;
  }

  private async ensureTemplateIsNotAssignedToActiveCycle(
    tenantId: string,
    templateId: string,
    action: 'updated' | 'deleted',
  ) {
    const activeCycle = await this.prisma.appraisalCycle.findFirst({
      where: {
        tenantId,
        templateId,
        status: 'IN_PROGRESS',
      },
      select: { id: true },
    });

    if (activeCycle) {
      throw new BadRequestException(
        action === 'deleted'
          ? 'This template is assigned to an active cycle and cannot be deleted'
          : 'This template is assigned to an active cycle and cannot be updated',
      );
    }
  }

  private assertCycleConfigurable(cycle: { status: string; title: string }) {
    if (cycle.status === 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cycle "${cycle.title}" is already in progress and its KPIs can no longer be changed`,
      );
    }
    if (cycle.status === 'COMPLETED' || cycle.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cycle "${cycle.title}" is no longer editable`,
      );
    }
  }

  private async seedCycleKpisFromTemplate(
    tenantId: string,
    cycleId: string,
    template: {
      kpis: {
        title: string;
        description: string | null;
        weight: number;
        maxScore: number;
      }[];
      selfAssessmentWeight: number;
      managerAssessmentWeight: number;
    },
  ) {
    if (!template.kpis.length) {
      throw new BadRequestException('Template has no KPIs to seed from');
    }

    return this.prisma.$transaction(
      template.kpis.map((kpi) =>
        this.prisma.appraisalKpi.create({
          data: {
            tenantId,
            cycleId,
            title: kpi.title,
            description: kpi.description,
            weight: kpi.weight,
            maxScore: kpi.maxScore,
            selfWeight: template.selfAssessmentWeight,
            managerWeight: template.managerAssessmentWeight,
          },
        }),
      ),
    );
  }

  private async resolveCycleEmployees(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    const eligibleEmploymentStatuses = await this.loadAppraisalEligibleStatuses(
      tenantId,
      cycle.employmentStatuses,
    );

    const employeeWhere: Record<string, unknown> = {
      tenantId,
      employmentStatus: { in: eligibleEmploymentStatuses },
    };

    if (cycle.employeeIds.length > 0) {
      employeeWhere.id = { in: cycle.employeeIds };
    } else {
      if (cycle.departmentIds.length > 0) {
        employeeWhere.departmentId = { in: cycle.departmentIds };
      }
      if (cycle.employmentTypes.length > 0) {
        employeeWhere.employmentType = { in: cycle.employmentTypes };
      }
    }

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        userId: true,
        email: true,
        managerId: true,
        firstName: true,
        lastName: true,
      },
    });

    return { cycle, employees, eligibleEmploymentStatuses };
  }

  private async activateCycle(
    tenantId: string,
    cycleId: string,
    actor?: RequestUser,
  ) {
    const { cycle, employees, eligibleEmploymentStatuses } =
      await this.resolveCycleEmployees(tenantId, cycleId);

    if (cycle.status !== 'UPCOMING') {
      return {
        message: `Appraisal cycle ${cycle.title} is already ${cycle.status.toLowerCase()}`,
      };
    }

    if (!employees.length) {
      throw new BadRequestException(
        `No employees match this cycle's targeting rules. Eligible employment statuses currently in effect: ${eligibleEmploymentStatuses.join(', ')}`,
      );
    }

    if (cycle.templateId) {
      const existingKpis = await this.prisma.appraisalKpi.count({
        where: { tenantId, cycleId },
      });

      if (!existingKpis) {
        const template = await this.ensureTemplateExists(
          tenantId,
          cycle.templateId,
        );
        await this.seedCycleKpisFromTemplate(tenantId, cycleId, template);
      }
    }

    const appraisalLinks: {
      appraisalId: string;
      employeeId: string;
      userId: string | null;
      email: string | null;
      firstName: string;
      lastName: string;
      selfAssessmentLink: string;
    }[] = [];

    for (const emp of employees) {
      const appraisal = await this.prisma.appraisal.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId: emp.id } },
        update: {
          status: 'IN_PROGRESS',
          managerId: emp.managerId,
        },
        create: {
          tenantId,
          cycleId,
          employeeId: emp.id,
          managerId: emp.managerId,
          status: 'IN_PROGRESS',
        },
      });

      const selfAssessmentLink = actor?.tenantSlug
        ? this.buildAppraisalSelfAssessmentLink(
            actor.tenantSlug,
            cycleId,
            appraisal.id,
          )
        : `/hr/appraisal/cycles/${cycleId}/self-assessment/${appraisal.id}`;

      appraisalLinks.push({
        appraisalId: appraisal.id,
        employeeId: emp.id,
        userId: emp.userId,
        email: emp.email,
        firstName: emp.firstName,
        lastName: emp.lastName,
        selfAssessmentLink,
      });
    }

    await this.prisma.appraisalCycle.update({
      where: { id: cycleId },
      data: {
        status: 'IN_PROGRESS',
        isActive: true,
        activatedAt: new Date(),
      },
    });

    const managerIds = Array.from(
      new Set(
        employees
          .map((emp) => emp.managerId)
          .filter((managerId): managerId is string => Boolean(managerId)),
      ),
    );
    const managers = managerIds.length
      ? await this.prisma.employee.findMany({
          where: { tenantId, id: { in: managerIds } },
          select: { userId: true },
        })
      : [];

    const notifications = appraisalLinks
      .filter((emp) => emp.userId)
      .map((emp) => ({
        tenantId,
        userId: emp.userId as string,
        type: 'APPRAISAL_CYCLE_STARTED',
        message: `Your appraisal cycle "${cycle.title}" is now active.`,
        link: `/hr/appraisal/cycles/${cycleId}/self-assessment/${emp.appraisalId}`,
      }))
      .concat(
        managers
          .filter((manager) => manager.userId)
          .map((manager) => ({
            tenantId,
            userId: manager.userId as string,
            type: 'APPRAISAL_CYCLE_STARTED',
            message: `An appraisal cycle "${cycle.title}" is now active for your team.`,
            link: `/hr/appraisal/cycles/${cycleId}`,
          })),
      );

    if (notifications.length) {
      await this.notificationsService.createMany(notifications);
    }

    for (const appraisal of appraisalLinks) {
      if (!appraisal.email || !actor?.tenantSlug) continue;

      this.emitNotificationEvent(
        this.publisher.notificationAppraisalCycleStarted({
          tenantId,
          appraisalId: appraisal.appraisalId,
          cycleId,
          cycleTitle: cycle.title,
          employeeEmail: appraisal.email,
          employeeFirstName: appraisal.firstName,
          selfAssessmentLink: appraisal.selfAssessmentLink,
        }),
        `appraisal-cycle-started for ${appraisal.appraisalId}`,
      );
    }

    return {
      message: `Appraisal cycle started for ${employees.length} employees`,
    };
  }

  // ── Cycles ─────────────────────────────────────────────────────────────────

  async createCycle(
    tenantId: string,
    createdBy: string,
    dto: CreateAppraisalCycleDto,
  ) {
    const template = await this.ensureTemplateExists(tenantId, dto.templateId);
    await this.ensureUniqueCycleTitle(tenantId, dto.title);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const selfAssessmentDeadline = new Date(dto.selfAssessmentDeadline!);
    const managerReviewDeadline = new Date(dto.managerReviewDeadline!);

    this.validateCycleDates({
      startDate,
      endDate,
      selfAssessmentDeadline,
      managerReviewDeadline,
    });

    const cycleData: Prisma.AppraisalCycleCreateInput = {
      tenantId,
      createdBy,
      title: dto.title.trim(),
      description: dto.description,
      startDate,
      endDate,
      selfAssessmentDeadline,
      managerReviewDeadline,
      frequency: dto.frequency,
      departmentIds: dto.departmentIds ?? [],
      employmentTypes: dto.employmentTypes ?? [],
      employmentStatuses: (dto.employmentStatuses?.length
        ? dto.employmentStatuses
        : []) as EmploymentStatus[],
      employeeIds: dto.employeeIds ?? [],
      template: { connect: { id: dto.templateId } },
      selfAssessmentWeight: template.selfAssessmentWeight,
      managerAssessmentWeight: template.managerAssessmentWeight,
      status: 'UPCOMING',
      isActive: false,
    };

    return this.prisma.appraisalCycle.create({
      data: cycleData,
      include: { _count: { select: { appraisals: true } } },
    });
  }

  async getCycles(tenantId: string) {
    return this.prisma.appraisalCycle.findMany({
      where: { tenantId },
      include: { _count: { select: { appraisals: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async getCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { _count: { select: { appraisals: true } } },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    return cycle;
  }

  async updateCycle(
    tenantId: string,
    cycleId: string,
    dto: UpdateAppraisalCycleDto,
  ) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { kpis: true },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    if (dto.title && dto.title.trim() !== cycle.title) {
      await this.ensureUniqueCycleTitle(tenantId, dto.title, cycleId);
    }

    const nextStartDate = dto.startDate
      ? new Date(dto.startDate)
      : cycle.startDate;
    const nextEndDate = dto.endDate ? new Date(dto.endDate) : cycle.endDate;
    const nextSelfAssessmentDeadline =
      dto.selfAssessmentDeadline !== undefined
        ? new Date(dto.selfAssessmentDeadline)
        : cycle.selfAssessmentDeadline;
    const nextManagerReviewDeadline =
      dto.managerReviewDeadline !== undefined
        ? new Date(dto.managerReviewDeadline)
        : cycle.managerReviewDeadline;

    if (!nextSelfAssessmentDeadline || !nextManagerReviewDeadline) {
      throw new BadRequestException(
        'Self assessment deadline and manager review deadline are required',
      );
    }

    this.validateCycleDates({
      startDate: nextStartDate,
      endDate: nextEndDate,
      selfAssessmentDeadline: nextSelfAssessmentDeadline,
      managerReviewDeadline: nextManagerReviewDeadline,
    });

    if (cycle.status === 'IN_PROGRESS') {
      const allowedKeys = ['selfAssessmentDeadline', 'managerReviewDeadline'];
      const incomingKeys = Object.keys(dto);
      if (incomingKeys.some((key) => !allowedKeys.includes(key))) {
        throw new BadRequestException(
          'Editing an in-progress cycle is restricted to deadline extensions only',
        );
      }

      if (
        dto.selfAssessmentDeadline &&
        cycle.selfAssessmentDeadline &&
        new Date(dto.selfAssessmentDeadline) < cycle.selfAssessmentDeadline
      ) {
        throw new BadRequestException(
          'Self assessment deadline can only be extended for an in-progress cycle',
        );
      }

      if (
        dto.managerReviewDeadline &&
        cycle.managerReviewDeadline &&
        new Date(dto.managerReviewDeadline) < cycle.managerReviewDeadline
      ) {
        throw new BadRequestException(
          'Manager review deadline can only be extended for an in-progress cycle',
        );
      }
    } else if (cycle.status !== 'UPCOMING') {
      throw new BadRequestException('Only upcoming cycles can be edited');
    }

    let templateUpdate:
      | {
          template: { connect: { id: string } };
          selfAssessmentWeight: number;
          managerAssessmentWeight: number;
        }
      | undefined;

    if (dto.templateId !== undefined) {
      if (cycle.kpis.length > 0 && dto.templateId !== cycle.templateId) {
        throw new BadRequestException(
          'Cannot change the appraisal template after cycle KPIs have been configured',
        );
      }

      const template = await this.ensureTemplateExists(
        tenantId,
        dto.templateId,
      );
      templateUpdate = {
        template: { connect: { id: template.id } },
        selfAssessmentWeight: template.selfAssessmentWeight,
        managerAssessmentWeight: template.managerAssessmentWeight,
      };
    }

    const updateData: Prisma.AppraisalCycleUpdateInput = {
      ...(dto.title && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.startDate && { startDate: nextStartDate }),
      ...(dto.endDate && { endDate: nextEndDate }),
      ...(dto.selfAssessmentDeadline !== undefined && {
        selfAssessmentDeadline: nextSelfAssessmentDeadline,
      }),
      ...(dto.managerReviewDeadline !== undefined && {
        managerReviewDeadline: nextManagerReviewDeadline,
      }),
      ...(dto.frequency !== undefined && { frequency: dto.frequency }),
      ...(dto.departmentIds && { departmentIds: dto.departmentIds }),
      ...(dto.employmentTypes && { employmentTypes: dto.employmentTypes }),
      ...(dto.employmentStatuses !== undefined && {
        employmentStatuses: (dto.employmentStatuses?.length
          ? dto.employmentStatuses
          : []) as EmploymentStatus[],
      }),
      ...(dto.employeeIds && { employeeIds: dto.employeeIds }),
      ...(templateUpdate ?? {}),
    };

    return this.prisma.appraisalCycle.update({
      where: { id: cycleId },
      data: updateData,
      include: { _count: { select: { appraisals: true } } },
    });
  }

  async deleteCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    if (cycle.status === 'IN_PROGRESS') {
      throw new BadRequestException('In-progress cycles cannot be deleted');
    }
    await this.prisma.appraisalCycle.delete({ where: { id: cycleId } });
    return { message: 'Cycle deleted' };
  }

  async startCycle(tenantId: string, cycleId: string, actor: RequestUser) {
    return this.activateCycle(tenantId, cycleId, actor);
  }

  async cancelCycle(tenantId: string, cycleId: string, reason: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: {
        appraisals: {
          select: {
            employee: { select: { userId: true } },
            manager: { select: { userId: true } },
          },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    if (cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only in-progress cycles can be cancelled');
    }

    await this.prisma.$transaction([
      this.prisma.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          status: 'CANCELLED',
          isActive: false,
          cancelledAt: new Date(),
          cancelledReason: reason,
        },
      }),
      this.prisma.appraisal.updateMany({
        where: { tenantId, cycleId, status: 'IN_PROGRESS' },
        data: { status: 'CANCELLED' },
      }),
    ]);

    const notifications = cycle.appraisals.flatMap((appraisal) => {
      const recipients = [
        appraisal.employee.userId,
        appraisal.manager?.userId ?? null,
      ].filter(Boolean) as string[];

      return recipients.map((userId) => ({
        tenantId,
        userId,
        type: 'APPRAISAL_CYCLE_CANCELLED',
        message: `The appraisal cycle "${cycle.title}" was cancelled. Reason: ${reason}`,
        link: `/hr/appraisal/cycles/${cycleId}`,
      }));
    });

    if (notifications.length) {
      await this.notificationsService.createMany(notifications);
    }

    return { message: 'Cycle cancelled' };
  }

  async completeExpiredCycles() {
    await this.prisma.appraisalCycle.updateMany({
      where: {
        status: 'IN_PROGRESS',
        endDate: { lt: new Date() },
      },
      data: {
        status: 'COMPLETED',
        isActive: false,
      },
    });
  }

  async sendPendingActionReminders() {
    const now = new Date();
    const appraisals = await this.prisma.appraisal.findMany({
      where: {
        status: 'IN_PROGRESS',
        cycle: { status: 'IN_PROGRESS' },
      },
      include: {
        cycle: {
          select: {
            title: true,
            selfAssessmentDeadline: true,
            managerReviewDeadline: true,
          },
        },
        employee: {
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        manager: {
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        reminderLogs: {
          select: { reminderType: true },
        },
      },
    });

    for (const appraisal of appraisals) {
      if (
        appraisal.selfStatus === 'PENDING' &&
        appraisal.cycle.selfAssessmentDeadline &&
        appraisal.employee.userId
      ) {
        const daysUntil = differenceInCalendarDays(
          appraisal.cycle.selfAssessmentDeadline,
          now,
        );
        const reminderType =
          daysUntil === 7
            ? 'SELF_7_DAYS'
            : daysUntil === 3
              ? 'SELF_3_DAYS'
              : daysUntil === 0
                ? 'SELF_DUE'
                : null;

        if (
          reminderType &&
          !appraisal.reminderLogs.some(
            (log) => log.reminderType === reminderType,
          )
        ) {
          await this.prisma.appraisalReminderLog.create({
            data: {
              tenantId: appraisal.tenantId,
              appraisalId: appraisal.id,
              reminderType,
            },
          });
          void this.publisher
            .notificationInAppCreate({
              tenantId: appraisal.tenantId,
              recipientUserId: appraisal.employee.userId,
              type: 'APPRAISAL_SELF_REMINDER',
              title: 'Appraisal Reminder',
              message:
                daysUntil === 0
                  ? `Your self assessment for "${appraisal.cycle.title}" is due today.`
                  : `Your self assessment for "${appraisal.cycle.title}" is due in ${daysUntil} days.`,
              link: `/hr/appraisal/cycles/${appraisal.cycleId}/self-assessment/${appraisal.id}`,
              entityType: 'appraisal',
              entityId: appraisal.id,
              sourceService: 'hr-service',
            })
            .catch((error) =>
              this.logger.error(
                `Failed to publish self appraisal reminder for appraisal ${appraisal.id}`,
                error instanceof Error ? error.stack : String(error),
              ),
            );

          if (appraisal.employee.email) {
            this.publisher
              .notificationAppraisalSelfReminder({
                tenantId: appraisal.tenantId,
                appraisalId: appraisal.id,
                cycleId: appraisal.cycleId,
                cycleTitle: appraisal.cycle.title,
                employeeEmail: appraisal.employee.email,
                employeeFirstName: appraisal.employee.firstName,
                deadline: normalizeDateOnly(
                  appraisal.cycle.selfAssessmentDeadline,
                ),
                daysRemaining: daysUntil,
              })
              .catch((error) =>
                this.logger.error(
                  `[appraisal] Failed to publish self reminder for ${appraisal.id}`,
                  error,
                ),
              );
          }
        }
      }

      if (
        appraisal.selfStatus === 'SUBMITTED' &&
        appraisal.managerStatus === 'PENDING' &&
        appraisal.cycle.managerReviewDeadline &&
        appraisal.manager?.userId
      ) {
        const daysUntil = differenceInCalendarDays(
          appraisal.cycle.managerReviewDeadline,
          now,
        );
        const reminderType =
          daysUntil === 7
            ? 'MANAGER_7_DAYS'
            : daysUntil === 3
              ? 'MANAGER_3_DAYS'
              : daysUntil === 0
                ? 'MANAGER_DUE'
                : null;

        if (
          reminderType &&
          !appraisal.reminderLogs.some(
            (log) => log.reminderType === reminderType,
          )
        ) {
          await this.prisma.appraisalReminderLog.create({
            data: {
              tenantId: appraisal.tenantId,
              appraisalId: appraisal.id,
              reminderType,
            },
          });
          void this.publisher
            .notificationInAppCreate({
              tenantId: appraisal.tenantId,
              recipientUserId: appraisal.manager.userId,
              type: 'APPRAISAL_MANAGER_REMINDER',
              title: 'Manager Review Reminder',
              message:
                daysUntil === 0
                  ? `${appraisal.employee.firstName} ${appraisal.employee.lastName}'s manager review for "${appraisal.cycle.title}" is due today.`
                  : `${appraisal.employee.firstName} ${appraisal.employee.lastName}'s manager review for "${appraisal.cycle.title}" is due in ${daysUntil} days.`,
              link: `/hr/appraisal/cycles/${appraisal.cycleId}/manager-review/${appraisal.id}`,
              entityType: 'appraisal',
              entityId: appraisal.id,
              sourceService: 'hr-service',
            })
            .catch((error) =>
              this.logger.error(
                `Failed to publish manager appraisal reminder for appraisal ${appraisal.id}`,
                error instanceof Error ? error.stack : String(error),
              ),
            );

          if (appraisal.manager.email) {
            this.publisher
              .notificationAppraisalManagerReminder({
                tenantId: appraisal.tenantId,
                appraisalId: appraisal.id,
                cycleId: appraisal.cycleId,
                cycleTitle: appraisal.cycle.title,
                managerEmail: appraisal.manager.email,
                managerFirstName: appraisal.manager.firstName,
                employeeFirstName: appraisal.employee.firstName,
                employeeLastName: appraisal.employee.lastName,
                deadline: normalizeDateOnly(
                  appraisal.cycle.managerReviewDeadline,
                ),
                daysRemaining: daysUntil,
              })
              .catch((error) =>
                this.logger.error(
                  `[appraisal] Failed to publish manager reminder for ${appraisal.id}`,
                  error,
                ),
              );
          }
        }
      }
    }
  }

  async getCycleResults(tenantId: string, cycleId: string) {
    const bands = await this.loadPerformanceBands(tenantId);
    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, cycleId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    const totalEmployees = appraisals.length;
    const reviewed = appraisals.filter((a) => a.managerStatus === 'SUBMITTED');
    const reviewedCount = reviewed.length;
    const completionRate =
      totalEmployees > 0
        ? Math.round((reviewedCount / totalEmployees) * 100)
        : 0;

    const ratingLabels: FinalRating[] = [
      'Outstanding',
      'Very Good',
      'Good',
      'Satisfactory',
      'Needs Improvement',
    ];

    const results = appraisals.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
      department: a.employee.department?.name ?? '',
      jobTitle: a.employee.jobTitle ?? '',
      managerName: a.manager
        ? `${a.manager.firstName} ${a.manager.lastName}`
        : '',
      selfScore: a.selfScore ?? undefined,
      managerScore: a.managerScore ?? undefined,
      overallScore: a.finalScore ?? 0,
      finalRating: scoreToRating(a.finalScore, bands),
      reviewCompletedAt: a.completedAt?.toISOString() ?? '',
    }));

    const ratingDistribution = ratingLabels.map((rating) => {
      const count = results.filter((r) => r.finalRating === rating).length;
      return {
        rating,
        count,
        percentage:
          totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0,
      };
    });

    return {
      totalEmployees,
      reviewedCount,
      completionRate,
      ratingDistribution,
      results,
    };
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────

  async getCycleKpis(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    return this.prisma.appraisalKpi.findMany({
      where: { cycleId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCycleKpi(
    tenantId: string,
    cycleId: string,
    actor: RequestUser,
    dto: CreateAppraisalKpiDto,
  ) {
    assertHrAccess(
      isCompanyAdminUser(actor) ||
        hasPermissionRule(actor, 'appraisal-settings:EDIT'),
    );

    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    this.assertCycleConfigurable(cycle);

    return this.prisma.appraisalKpi.create({
      data: {
        tenantId,
        cycleId,
        title: dto.title,
        description: dto.description,
        weight: dto.weight,
        maxScore: dto.maxScore ?? 5,
        selfWeight: dto.selfWeight ?? cycle.selfAssessmentWeight,
        managerWeight: dto.managerWeight ?? cycle.managerAssessmentWeight,
      },
    });
  }

  async updateCycleKpi(
    tenantId: string,
    cycleId: string,
    kpiId: string,
    actor: RequestUser,
    dto: Partial<CreateAppraisalKpiDto>,
  ) {
    assertHrAccess(
      isCompanyAdminUser(actor) ||
        hasPermissionRule(actor, 'appraisal-settings:EDIT'),
    );

    const kpi = await this.prisma.appraisalKpi.findFirst({
      where: { id: kpiId, cycleId, tenantId },
      include: { cycle: true },
    });
    if (!kpi) throw new NotFoundException('KPI not found');
    this.assertCycleConfigurable(kpi.cycle);

    return this.prisma.appraisalKpi.update({
      where: { id: kpiId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.selfWeight !== undefined && { selfWeight: dto.selfWeight }),
        ...(dto.managerWeight !== undefined && {
          managerWeight: dto.managerWeight,
        }),
      },
    });
  }

  async seedCycleFromTemplate(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { kpis: true },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');
    this.assertCycleConfigurable(cycle);
    if (!cycle.templateId)
      throw new BadRequestException('Cycle has no linked template');
    if (cycle.kpis.length > 0)
      throw new ConflictException(
        'Cycle already has KPIs. Remove existing KPIs before re-seeding.',
      );

    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: cycle.templateId, tenantId },
      include: { kpis: true },
    });
    if (!template) throw new NotFoundException('Linked template not found');
    const seeded = await this.seedCycleKpisFromTemplate(
      tenantId,
      cycleId,
      template,
    );

    return { seeded: seeded.length, kpis: seeded };
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  async getTemplates(tenantId: string, page = 1, search?: string) {
    const pageSize = 20;
    const skip = (page - 1) * pageSize;
    const where: Prisma.AppraisalTemplateWhereInput = {
      tenantId,
      ...(search?.trim()
        ? { name: { contains: search.trim(), mode: 'insensitive' } }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.appraisalTemplate.count({ where }),
      this.prisma.appraisalTemplate.findMany({
        where,
        include: { kpis: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      page,
    };
  }

  async createTemplate(tenantId: string, dto: CreateAppraisalTemplateDto) {
    validateTemplatePayload(dto);
    await this.ensureUniqueTemplateName(tenantId, dto.name);
    const templateKpis = dto.kpis ?? [];

    return this.prisma.appraisalTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        selfAssessmentWeight: dto.selfAssessmentWeight ?? 40,
        managerAssessmentWeight: dto.managerAssessmentWeight ?? 60,
        kpis: {
          create: templateKpis.map((k) => ({
            title: k.title,
            weight: k.weight,
            maxScore: k.maxScore ?? 5,
            description: k.description,
          })),
        },
      },
      include: { kpis: true },
    });
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    dto: Partial<CreateAppraisalTemplateDto>,
  ) {
    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { kpis: true },
    });
    if (!template) throw new NotFoundException('Template not found');
    await this.ensureTemplateIsNotAssignedToActiveCycle(
      tenantId,
      templateId,
      'updated',
    );

    if (dto.name && dto.name.trim() !== template.name) {
      await this.ensureUniqueTemplateName(tenantId, dto.name, templateId);
    }

    const nextTemplate = {
      selfAssessmentWeight:
        dto.selfAssessmentWeight ?? template.selfAssessmentWeight,
      managerAssessmentWeight:
        dto.managerAssessmentWeight ?? template.managerAssessmentWeight,
      kpis:
        dto.kpis ??
        template.kpis.map((kpi) => ({
          title: kpi.title,
          weight: kpi.weight,
          maxScore: kpi.maxScore,
          description: kpi.description ?? undefined,
        })),
    };

    validateTemplatePayload(nextTemplate);

    const updated = await this.prisma.appraisalTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.selfAssessmentWeight !== undefined && {
          selfAssessmentWeight: dto.selfAssessmentWeight,
        }),
        ...(dto.managerAssessmentWeight !== undefined && {
          managerAssessmentWeight: dto.managerAssessmentWeight,
        }),
        ...(dto.kpis !== undefined && {
          kpis: {
            deleteMany: {},
            create: dto.kpis.map((k) => ({
              title: k.title,
              weight: k.weight,
              maxScore: k.maxScore ?? 5,
              description: k.description,
            })),
          },
        }),
      },
      include: { kpis: true },
    });

    return updated;
  }

  async deleteTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.appraisalTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    await this.ensureTemplateIsNotAssignedToActiveCycle(
      tenantId,
      templateId,
      'deleted',
    );
    await this.prisma.appraisalTemplate.delete({ where: { id: templateId } });
    return { message: 'Template deleted' };
  }

  // ── Appraisals ─────────────────────────────────────────────────────────────

  async getAppraisals(tenantId: string, actor: RequestUser, cycleId: string) {
    const where: Prisma.AppraisalWhereInput = { tenantId, cycleId };

    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(
        hasPermissionRule(actor, 'appraisals:VIEW') ||
          hasPermissionRule(actor, 'appraisals:CREATE') ||
          hasPermissionRule(actor, 'appraisal-settings:EDIT'),
      );
    }

    const appraisals = await this.prisma.appraisal.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            avatarUrl: true,
          },
        },
        manager: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        cycle: { select: { title: true } },
      },
    });

    return appraisals.map((a) => ({
      ...a,
      employeeName: buildPersonName(a.employee),
      managerName: a.manager ? buildPersonName(a.manager) : null,
    }));
  }

  async getAppraisal(
    tenantId: string,
    appraisalId: string,
    actor: RequestUser,
  ) {
    const bands = await this.loadPerformanceBands(tenantId);
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            userId: true,
          },
        },
        cycle: {
          select: {
            title: true,
            startDate: true,
            endDate: true,
            managerReviewDeadline: true,
          },
        },
        kpiScores: {
          include: {
            kpi: { select: { title: true, weight: true, maxScore: true } },
          },
        },
        revisionLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');

    if (!isCompanyAdminUser(actor)) {
      const canViewAll =
        hasPermissionRule(actor, 'appraisals:VIEW') ||
        hasPermissionRule(actor, 'appraisals:CREATE') ||
        hasPermissionRule(actor, 'appraisal-settings:EDIT');
      const canViewOwn =
        hasPermissionRule(actor, 'self-appraisals:VIEW') &&
        appraisal.employee.userId === actor.id;

      let canReviewAsManager = false;
      if (hasPermissionRule(actor, 'appraisal-reviews:EDIT')) {
        const actorEmployee = await this.prisma.employee.findFirst({
          where: { tenantId, userId: actor.id },
          select: { id: true },
        });
        canReviewAsManager = actorEmployee?.id === appraisal.managerId;
      }

      assertHrAccess(canViewAll || canViewOwn || canReviewAsManager);
    }

    const overallStatus = deriveOverallStatus(appraisal);

    const toKpiScoreShape = (reviewType: string) =>
      appraisal.kpiScores
        .filter((ks) => ks.reviewType === reviewType)
        .map((ks) => ({
          kpiId: ks.kpiId,
          title: ks.kpi.title,
          weight: ks.kpi.weight,
          maxScore: ks.kpi.maxScore,
          score: ks.score,
          comment: ks.comment ?? undefined,
        }));

    const selfResponse =
      appraisal.selfStatus === 'SUBMITTED'
        ? {
            status: 'Submitted',
            kpiScores: toKpiScoreShape('SELF'),
            submittedAt: appraisal.selfSubmittedAt?.toISOString(),
            score: appraisal.selfScore,
            comment: appraisal.selfComment,
          }
        : null;

    const managerResponse =
      appraisal.managerStatus === 'SUBMITTED'
        ? {
            status: 'Submitted',
            kpiScores: toKpiScoreShape('MANAGER'),
            submittedAt: appraisal.managerSubmittedAt?.toISOString(),
            score: appraisal.managerScore,
            comment: appraisal.managerComment,
          }
        : null;

    const finalizedAppraisal =
      appraisal.finalScore !== null
        ? {
            overallScore: appraisal.finalScore,
            finalRating: scoreToRating(appraisal.finalScore, bands),
            finalComment: appraisal.finalComment,
            finalizedBy: appraisal.finalizedBy,
            finalizedAt: appraisal.completedAt?.toISOString(),
          }
        : null;
    const employee = {
      firstName: appraisal.employee.firstName,
      lastName: appraisal.employee.lastName,
      jobTitle: appraisal.employee.jobTitle,
    };

    return {
      ...appraisal,
      employee,
      overallStatus,
      selfResponse,
      managerResponse,
      finalizedAppraisal,
    };
  }

  async getMyAppraisals(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, employeeId: employee.id },
      include: {
        cycle: {
          select: {
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            selfAssessmentDeadline: true,
            managerReviewDeadline: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return appraisals.map((a) => ({
      ...a,
      cycleName: a.cycle?.title ?? '',
      cycleStatus: a.cycle?.status ?? 'UPCOMING',
      overallStatus: deriveOverallStatus(a),
      selfAssessmentDeadline:
        a.cycle?.selfAssessmentDeadline?.toISOString() ?? null,
    }));
  }

  async getTeamAppraisals(tenantId: string, userId: string) {
    const managerEmployee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!managerEmployee) return [];

    const appraisals = await this.prisma.appraisal.findMany({
      where: { tenantId, managerId: managerEmployee.id },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        cycle: {
          select: {
            title: true,
            managerReviewDeadline: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return appraisals.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
      cycleId: a.cycleId,
      cycleName: a.cycle?.title ?? '',
      selfSubmittedAt: a.selfSubmittedAt?.toISOString() ?? null,
      managerReviewDeadline:
        a.cycle?.managerReviewDeadline?.toISOString() ?? null,
      overallStatus: deriveOverallStatus(a),
    }));
  }

  async submitSelfAssessment(
    tenantId: string,
    appraisalId: string,
    actor: RequestUser,
    dto: SubmitReviewDto,
  ) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: {
        employee: {
          select: {
            userId: true,
            managerId: true,
            firstName: true,
            lastName: true,
          },
        },
        cycle: {
          select: {
            title: true,
            selfAssessmentDeadline: true,
            status: true,
          },
        },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.employee.userId !== actor.id)
      throw new BadRequestException(
        'You can only submit your own self-assessment',
      );
    if (appraisal.selfStatus === 'SUBMITTED')
      throw new BadRequestException('Self-assessment already submitted');
    if (appraisal.cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'This appraisal cycle is not currently active',
      );
    }
    if (
      appraisal.cycle.selfAssessmentDeadline &&
      new Date() > appraisal.cycle.selfAssessmentDeadline &&
      !appraisal.reopenedAt
    ) {
      throw new BadRequestException('The self assessment deadline has passed');
    }
    if (!dto.score && (!dto.kpiScores || !dto.kpiScores.length))
      throw new BadRequestException('Provide either a score or kpiScores');

    let selfScore = dto.score ?? 0;

    if (dto.kpiScores?.length) {
      await this.saveKpiScores(tenantId, appraisalId, dto.kpiScores, 'SELF');
      const kpisWithDetails = await this.loadKpiScoresWithKpi(
        appraisalId,
        'SELF',
      );
      selfScore = calcWeightedScore(kpisWithDetails);
    }

    const updated = await this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        selfScore,
        selfComment: dto.comment,
        selfStatus: 'SUBMITTED',
        selfSubmittedAt: new Date(),
      },
    });

    if (appraisal.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: appraisal.managerId, tenantId },
        select: { userId: true, email: true, firstName: true },
      });
      const managerReviewLink = this.buildAppraisalManagerReviewLink(
        actor.tenantSlug,
        appraisal.cycleId,
        appraisalId,
      );
      if (manager?.userId) {
        void this.publisher
          .notificationInAppCreate({
            tenantId,
            recipientUserId: manager.userId,
            type: 'APPRAISAL_SELF_SUBMITTED',
            title: 'Self Assessment Submitted',
            message: `${appraisal.employee.firstName} ${appraisal.employee.lastName} submitted their self-assessment for "${appraisal.cycle.title}".`,
            link: `/hr/appraisal/cycles/${appraisal.cycleId}/manager-review/${appraisalId}`,
            entityType: 'appraisal',
            entityId: appraisalId,
            sourceService: 'hr-service',
          })
          .catch((error) =>
            this.logger.error(
              `Failed to publish self submitted notification for appraisal ${appraisalId}`,
              error instanceof Error ? error.stack : String(error),
            ),
          );
      }
      if (manager?.email) {
        this.emitNotificationEvent(
          this.publisher.notificationAppraisalSelfSubmitted({
            tenantId,
            appraisalId,
            cycleId: appraisal.cycleId,
            cycleTitle: appraisal.cycle.title,
            employeeFirstName: appraisal.employee.firstName,
            employeeLastName: appraisal.employee.lastName,
            managerEmail: manager.email,
            managerFirstName: manager.firstName,
            managerReviewLink,
          }),
          `appraisal-self-submitted for ${appraisalId}`,
        );
      }
    }

    return updated;
  }

  async submitManagerReview(
    tenantId: string,
    appraisalId: string,
    reviewer: RequestUser,
    dto: SubmitReviewDto,
  ) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: {
        employee: {
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        cycle: {
          select: {
            title: true,
            status: true,
            managerReviewDeadline: true,
            selfAssessmentWeight: true,
            managerAssessmentWeight: true,
          },
        },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.selfStatus !== 'SUBMITTED')
      throw new BadRequestException(
        'Employee has not submitted their self-assessment yet',
      );
    if (appraisal.managerStatus === 'SUBMITTED')
      throw new BadRequestException('Manager review already submitted');
    if (appraisal.cycle.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'This appraisal cycle is not currently active',
      );
    }
    if (
      appraisal.cycle.managerReviewDeadline &&
      new Date() > appraisal.cycle.managerReviewDeadline &&
      !appraisal.reopenedAt
    ) {
      throw new BadRequestException('The manager review deadline has passed');
    }
    if (!dto.score && (!dto.kpiScores || !dto.kpiScores.length))
      throw new BadRequestException('Provide either a score or kpiScores');

    const reviewerEmployee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: reviewer.id },
      select: { id: true },
    });
    const canReviewThisAppraisal =
      isCompanyAdminUser(reviewer) ||
      hasPermissionRule(reviewer, 'appraisals:APPROVE') ||
      (hasPermissionRule(reviewer, 'appraisal-reviews:EDIT') &&
        reviewerEmployee?.id === appraisal.managerId);

    assertHrAccess(canReviewThisAppraisal);

    let managerScore = dto.score ?? 0;

    if (dto.kpiScores?.length) {
      await this.saveKpiScores(tenantId, appraisalId, dto.kpiScores, 'MANAGER');
      const kpisWithDetails = await this.loadKpiScoresWithKpi(
        appraisalId,
        'MANAGER',
      );
      managerScore = calcWeightedScore(kpisWithDetails);
    }

    const selfWeight = appraisal.cycle.selfAssessmentWeight ?? 40;
    const managerWeight = appraisal.cycle.managerAssessmentWeight ?? 60;
    const finalScore = calcFinalScore(
      appraisal.selfScore,
      managerScore,
      selfWeight,
      managerWeight,
    );
    const bands = await this.loadPerformanceBands(tenantId);

    const updated = await this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        managerScore,
        managerComment: dto.comment,
        managerStatus: 'SUBMITTED',
        managerSubmittedAt: new Date(),
        status: 'PENDING_FINALIZATION',
      },
    });

    const finalizers = await this.resolveAppraisalFinalizers(tenantId, [
      reviewer.id,
    ]);
    const employeeName = buildPersonName(appraisal.employee);
    const finalizationLink = this.buildAppraisalFinalizationLink(
      reviewer.tenantSlug,
      appraisal.cycleId,
      appraisalId,
    );

    const finalizerNotifications = finalizers
      .filter((recipient) => recipient.userId)
      .map((recipient) => ({
        tenantId,
        userId: recipient.userId as string,
        type: 'APPRAISAL_PENDING_FINALIZATION',
        message: `${employeeName}'s appraisal for "${appraisal.cycle.title}" is ready for finalization.`,
        link: `/hr/appraisal/cycles/${appraisal.cycleId}/employee/${appraisalId}`,
      }));

    if (finalizerNotifications.length) {
      await this.notificationsService.createMany(finalizerNotifications);
    }

    return {
      ...updated,
      provisionalFinalScore: finalScore,
      provisionalFinalRating: scoreToRating(finalScore, bands),
      finalizationLink,
    };
  }

  async finalizeAppraisal(
    tenantId: string,
    appraisalId: string,
    actor: RequestUser,
    dto: FinalizeAppraisalDto,
  ) {
    assertHrAccess(
      isCompanyAdminUser(actor) ||
        hasPermissionRule(actor, 'appraisals:APPROVE'),
    );

    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: {
        employee: {
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        cycle: {
          select: {
            title: true,
            selfAssessmentWeight: true,
            managerAssessmentWeight: true,
          },
        },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.status === 'COMPLETED') {
      throw new BadRequestException(
        'This appraisal has already been finalized',
      );
    }
    if (appraisal.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled appraisals cannot be finalized');
    }
    if (appraisal.selfStatus !== 'SUBMITTED') {
      throw new BadRequestException('Self-assessment must be submitted first');
    }
    if (appraisal.managerStatus !== 'SUBMITTED') {
      throw new BadRequestException('Manager review must be submitted first');
    }
    if (appraisal.managerScore === null) {
      throw new BadRequestException('Manager score is required to finalize');
    }

    const selfWeight = appraisal.cycle.selfAssessmentWeight ?? 40;
    const managerWeight = appraisal.cycle.managerAssessmentWeight ?? 60;
    const computedFinalScore = calcFinalScore(
      appraisal.selfScore,
      appraisal.managerScore,
      selfWeight,
      managerWeight,
    );
    const finalScore = dto.finalScore ?? computedFinalScore;
    const finalizationNote = dto.note ?? appraisal.finalizationNote;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.appraisal.update({
        where: { id: appraisalId },
        data: {
          finalScore,
          finalComment: finalizationNote,
          finalizationNote,
          finalizedBy: actor.id,
          finalizedAt: new Date(),
          completedAt: new Date(),
          status: 'COMPLETED',
        },
      });

      await tx.appraisalRevisionHistory.create({
        data: {
          tenantId,
          appraisalId,
          revisionNumber: appraisal.revisionNumber,
          actorId: actor.id,
          action:
            dto.finalScore === undefined ? 'FINALIZED' : 'FINAL_SCORE_OVERRIDE',
          target: 'FINAL',
          note: finalizationNote,
          previousStatus: appraisal.status,
          previousSelfStatus: appraisal.selfStatus,
          previousManagerStatus: appraisal.managerStatus,
          previousSelfScore: appraisal.selfScore,
          previousManagerScore: appraisal.managerScore,
          previousFinalScore: appraisal.finalScore,
        },
      });

      return next;
    });

    const bands = await this.loadPerformanceBands(tenantId);
    const finalRating = scoreToRating(finalScore, bands);
    const resultLink = this.buildAppraisalResultLink(
      actor.tenantSlug,
      appraisal.cycleId,
      appraisalId,
    );

    if (appraisal.employee.userId) {
      void this.publisher
        .notificationInAppCreate({
          tenantId,
          recipientUserId: appraisal.employee.userId,
          type: 'APPRAISAL_FINALIZED',
          title: 'Appraisal Finalized',
          message: `Your appraisal for "${appraisal.cycle.title}" has been finalized.`,
          link: `/hr/appraisal/cycles/${appraisal.cycleId}/results/${appraisalId}`,
          entityType: 'appraisal',
          entityId: appraisalId,
          sourceService: 'hr-service',
        })
        .catch((error) =>
          this.logger.error(
            `Failed to publish finalized notification for appraisal ${appraisalId}`,
            error instanceof Error ? error.stack : String(error),
          ),
        );
    }

    if (appraisal.employee.email) {
      this.emitNotificationEvent(
        this.publisher.notificationAppraisalManagerReviewed({
          tenantId,
          appraisalId,
          cycleId: appraisal.cycleId,
          cycleTitle: appraisal.cycle.title,
          employeeEmail: appraisal.employee.email,
          employeeFirstName: appraisal.employee.firstName,
          finalScore,
          finalRating,
          platformLink: resultLink,
        }),
        `appraisal-finalized for ${appraisalId}`,
      );
    }

    return {
      ...updated,
      finalRating,
    };
  }

  async reopenAppraisal(
    tenantId: string,
    appraisalId: string,
    actor: RequestUser,
    dto: ReopenAppraisalDto,
  ) {
    const target: ReopenAppraisalTarget = dto.target ?? 'SELF';
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: {
        employee: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
          },
        },
        manager: { select: { userId: true } },
        cycle: { select: { title: true, status: true } },
      },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled appraisals cannot be reopened');
    }
    if (appraisal.cycle.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled cycles cannot be reopened');
    }

    const actorEmployee = await this.prisma.employee.findFirst({
      where: { tenantId, userId: actor.id },
      select: { id: true },
    });
    const canForceRedo =
      isCompanyAdminUser(actor) ||
      hasPermissionRule(actor, 'appraisals:APPROVE');
    const canManagerRequestRedo =
      hasPermissionRule(actor, 'appraisal-reviews:EDIT') &&
      actorEmployee?.id === appraisal.managerId &&
      target === 'SELF';

    assertHrAccess(canForceRedo || canManagerRequestRedo);

    const nextRevisionNumber = appraisal.revisionNumber + 1;
    const resetSelf = target === 'SELF' || target === 'FULL';
    const resetManager = resetSelf || target === 'MANAGER' || target === 'FULL';

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.appraisalRevisionHistory.create({
        data: {
          tenantId,
          appraisalId,
          revisionNumber: appraisal.revisionNumber,
          action: canForceRedo ? 'FORCE_REDO' : 'MANAGER_REDO_REQUEST',
          target,
          actorId: actor.id,
          note: dto.reason,
          previousStatus: appraisal.status,
          previousSelfStatus: appraisal.selfStatus,
          previousManagerStatus: appraisal.managerStatus,
          previousSelfScore: appraisal.selfScore,
          previousManagerScore: appraisal.managerScore,
          previousFinalScore: appraisal.finalScore,
        },
      });

      return tx.appraisal.update({
        where: { id: appraisalId },
        data: {
          status: 'IN_PROGRESS',
          ...(resetSelf && {
            selfStatus: 'PENDING',
            selfSubmittedAt: null,
            selfScore: null,
            selfComment: null,
          }),
          ...(resetManager && {
            managerStatus: 'PENDING',
            managerSubmittedAt: null,
            managerScore: null,
            managerComment: null,
          }),
          finalScore: null,
          finalComment: null,
          completedAt: null,
          finalizedBy: null,
          finalizedAt: null,
          finalizationNote: null,
          reopenedAt: new Date(),
          reopenedBy: actor.id,
          reopenReason: dto.reason,
          revisionNumber: nextRevisionNumber,
        },
      });
    });

    const employeeLink = `/hr/appraisal/cycles/${appraisal.cycleId}/self-assessment/${appraisalId}`;
    const managerLink = `/hr/appraisal/cycles/${appraisal.cycleId}/manager-review/${appraisalId}`;
    const notifications = [
      ...(resetSelf && appraisal.employee.userId
        ? [
            {
              tenantId,
              userId: appraisal.employee.userId,
              type: 'APPRAISAL_REOPENED',
              message: `Your appraisal for "${appraisal.cycle.title}" was reopened for redo.`,
              link: employeeLink,
            },
          ]
        : []),
      ...(resetManager && appraisal.manager?.userId
        ? [
            {
              tenantId,
              userId: appraisal.manager.userId,
              type: 'APPRAISAL_REOPENED',
              message: `${buildPersonName(appraisal.employee)}'s appraisal for "${appraisal.cycle.title}" was reopened for manager review redo.`,
              link: managerLink,
            },
          ]
        : []),
    ];

    if (notifications.length) {
      await this.notificationsService.createMany(notifications);
    }

    return updated;
  }

  private async saveKpiScores(
    tenantId: string,
    appraisalId: string,
    kpiScores: KpiScoreDto[],
    reviewType: 'SELF' | 'MANAGER',
  ) {
    const uniqueKpiIds = [...new Set(kpiScores.map((ks) => ks.kpiId))];
    if (uniqueKpiIds.length !== kpiScores.length) {
      throw new BadRequestException(
        'Duplicate KPI scores are not allowed in a single submission',
      );
    }

    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      select: { cycleId: true },
    });
    if (!appraisal) throw new NotFoundException('Appraisal not found');

    const allowedKpis = await this.prisma.appraisalKpi.findMany({
      where: {
        tenantId,
        cycleId: appraisal.cycleId,
        id: { in: uniqueKpiIds },
      },
      select: { id: true, title: true, maxScore: true },
    });

    if (allowedKpis.length !== uniqueKpiIds.length) {
      throw new BadRequestException(
        'One or more submitted KPIs are invalid for this appraisal',
      );
    }

    const kpiById = new Map(allowedKpis.map((kpi) => [kpi.id, kpi]));
    for (const submitted of kpiScores) {
      const kpi = kpiById.get(submitted.kpiId);
      if (!kpi) {
        throw new BadRequestException(
          'One or more submitted KPIs are invalid for this appraisal',
        );
      }

      if (submitted.score > kpi.maxScore) {
        throw new BadRequestException(
          `Score for "${kpi.title}" cannot exceed its maximum of ${kpi.maxScore}`,
        );
      }
    }

    await this.prisma.$transaction(
      kpiScores.map((ks) =>
        this.prisma.appraisalKpiScore.upsert({
          where: {
            appraisalId_kpiId_reviewType: {
              appraisalId,
              kpiId: ks.kpiId,
              reviewType,
            },
          },
          update: { score: ks.score, comment: ks.comment },
          create: {
            tenantId,
            appraisalId,
            kpiId: ks.kpiId,
            reviewType,
            score: ks.score,
            comment: ks.comment,
          },
        }),
      ),
    );
  }

  private async loadKpiScoresWithKpi(appraisalId: string, reviewType: string) {
    return this.prisma.appraisalKpiScore.findMany({
      where: { appraisalId, reviewType },
      include: { kpi: { select: { weight: true, maxScore: true } } },
    });
  }
}
