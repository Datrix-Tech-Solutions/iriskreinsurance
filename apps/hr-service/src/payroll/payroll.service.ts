import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import {
  calculatePayrollForCountry,
  defaultPayrollCurrency,
} from '../common/payroll-calculator.helper';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { UpdatePayrollItemDto } from './dto/update-payroll-item.dto';
import { PayrollDecisionDto } from './dto/payroll-decision.dto';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';
import { NotificationsService } from '../notifications/notifications.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import {
  EmploymentStatus,
  EmployeeCompensationType,
  PayrollCountry,
  PayrollItem,
  PayrollTaxPolicy,
  Prisma,
} from '../../prisma/generated/client';

type PayrollSettingsSnapshot = {
  payrollCountry: PayrollCountry;
  payrollCurrency: string;
  tier3Enabled: boolean;
  tier3Rate: string | null;
  tier3SchemeName: string | null;
  country: string;
};

type EditablePayrollValues = {
  basicSalary: string;
  commissionAmount: string;
  totalAllowances: string;
  transportAmount: string;
  otherDeductions: string;
};

type PayrollAllowanceLineItem = {
  name: string;
  type?: string | null;
  amount: string;
};

type PayrollDeductionLineItem = {
  employeeDeductionId?: string | null;
  name: string;
  amount: string;
};

type CalculatedPayrollValues = EditablePayrollValues & {
  overtimePay: string;
  bonus: string;
  thirteenthMonth: string;
  grossSalary: string;
  employeeSSNIT: string;
  employerSSNIT: string;
  tier1Contribution: string;
  tier2Contribution: string;
  tier3Employee: string;
  taxableIncome: string;
  payeTax: string;
  totalDeductions: string;
  netSalary: string;
};

type PayrollItemSeed = CalculatedPayrollValues & {
  allowanceItems: PayrollAllowanceLineItem[];
  deductionItems: PayrollDeductionLineItem[];
  fixedTaxAmount: string | null;
  taxPolicySnapshot: PayrollTaxPolicy;
  compensationTypeSnapshot: EmployeeCompensationType;
  commissionTaxableSnapshot: boolean;
};

type PayrollNotificationRecipient = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  source: 'APPROVER' | 'TENANT_ADMIN_ESCALATION' | 'STAKEHOLDER';
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly encryption: FieldEncryptionService,
  ) {}

  private canReadPayroll(actor: RequestUser) {
    return (
      hasPermissionRule(actor, 'payroll:VIEW') ||
      hasPermissionRule(actor, 'payroll:RUN') ||
      hasPermissionRule(actor, 'payroll:APPROVE') ||
      hasPermissionRule(actor, 'payroll:EDIT')
    );
  }

  private getMonthBounds(
    month: number,
    year: number,
  ): { start: Date; end: Date } {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private async getPayrollSettingsSnapshot(
    tenantId: string,
  ): Promise<PayrollSettingsSnapshot> {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        payrollCountry: true,
        payrollCurrency: true,
        payrollTier3Enabled: true,
        payrollTier3Rate: true,
        payrollTier3SchemeName: true,
      },
    });

    const payrollCountry = config?.payrollCountry ?? PayrollCountry.GH;
    return {
      payrollCountry,
      payrollCurrency:
        config?.payrollCurrency ?? defaultPayrollCurrency(payrollCountry),
      tier3Enabled: config?.payrollTier3Enabled ?? false,
      tier3Rate:
        config?.payrollTier3Rate != null
          ? config.payrollTier3Rate.toString()
          : null,
      tier3SchemeName: config?.payrollTier3SchemeName ?? null,
      country: payrollCountry,
    };
  }

  private calculatePayrollItemValues(
    values: EditablePayrollValues,
    settings: PayrollSettingsSnapshot & {
      taxPolicy?: PayrollTaxPolicy;
      fixedTaxAmount?: string | null;
      commissionTaxable?: boolean;
      compensationType?: 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION';
    },
  ): CalculatedPayrollValues {
    return calculatePayrollForCountry(values, settings);
  }

  private assertValidPayrollTaxPolicy(input: {
    taxPolicy?: PayrollTaxPolicy;
    fixedTaxAmount?: string | null;
  }) {
    if (
      input.taxPolicy === PayrollTaxPolicy.FIXED_AMOUNT &&
      input.fixedTaxAmount == null
    ) {
      throw new BadRequestException(
        'fixedTaxAmount is required when taxPolicy is FIXED_AMOUNT.',
      );
    }
  }

  private isTransportAllowanceLine(item: {
    name?: string | null;
    type?: string | null;
  }) {
    return (
      item.type === 'TRANSPORT' ||
      `${item.type ?? ''} ${item.name ?? ''}`
        .toLowerCase()
        .includes('transport')
    );
  }

  private sumLineItems(items: Array<{ amount: string }>) {
    return items.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
  }

  private normalizeAllowanceLineItems(
    items: Array<{ name: string; type?: string | null; amount: number }>,
  ): PayrollAllowanceLineItem[] {
    return items
      .map((item) => ({
        name: item.name.trim(),
        type: item.type?.trim() || null,
        amount: new Decimal(item.amount).toFixed(2),
      }))
      .filter((item) => item.name && new Decimal(item.amount).gt(0));
  }

  private normalizeDeductionLineItems(
    items: Array<{
      employeeDeductionId?: string | null;
      name: string;
      amount: number;
    }>,
  ): PayrollDeductionLineItem[] {
    return items
      .map((item) => ({
        employeeDeductionId: item.employeeDeductionId ?? null,
        name: item.name.trim(),
        amount: new Decimal(item.amount).toFixed(2),
      }))
      .filter((item) => item.name && new Decimal(item.amount).gt(0));
  }

  private buildEditableValuesFromLineItems(
    basicSalary: string,
    commissionAmount: string,
    allowanceItems: PayrollAllowanceLineItem[],
    deductionItems: PayrollDeductionLineItem[],
  ): EditablePayrollValues {
    const transportAmount = this.sumLineItems(
      allowanceItems.filter((item) => this.isTransportAllowanceLine(item)),
    );
    const totalAllowances = this.sumLineItems(
      allowanceItems.filter((item) => !this.isTransportAllowanceLine(item)),
    );
    const otherDeductions = this.sumLineItems(deductionItems);

    return {
      basicSalary,
      commissionAmount,
      totalAllowances: totalAllowances.toString(),
      transportAmount: transportAmount.toString(),
      otherDeductions: otherDeductions.toString(),
    };
  }

  private buildSeedFromEmployee(
    employee: {
      basicSalary: { toString(): string };
      commissionAmount?: { toString(): string } | string | number | null;
      fixedTaxAmount?: { toString(): string } | string | number | null;
      taxPolicy: PayrollTaxPolicy;
      compensationType: EmployeeCompensationType;
      commissionTaxable: boolean;
      allowances: Array<{
        amount: { toString(): string };
        type: string;
        name?: string | null;
      }>;
      deductions?: Array<{
        id: string;
        name: string;
        totalAmount: { toString(): string };
        monthlyRate: { toString(): string };
        amountPaid: { toString(): string };
        startDate: Date;
      }>;
    },
    deductionCutoff: Date,
  ): {
    values: EditablePayrollValues;
    allowanceItems: PayrollAllowanceLineItem[];
    deductionItems: PayrollDeductionLineItem[];
    fixedTaxAmount: string | null;
    taxPolicySnapshot: PayrollTaxPolicy;
    compensationTypeSnapshot: EmployeeCompensationType;
    commissionTaxableSnapshot: boolean;
  } {
    const allowanceItems = employee.allowances
      .map((allowance) => ({
        name: allowance.name || allowance.type,
        type: allowance.type,
        amount: new Decimal(allowance.amount.toString()).toFixed(2),
      }))
      .filter((allowance) => new Decimal(allowance.amount).gt(0));

    const deductionItems = (employee.deductions ?? [])
      .filter((deduction) => deduction.startDate <= deductionCutoff)
      .map((deduction) => {
        const balance = Decimal.max(
          new Decimal(0),
          new Decimal(deduction.totalAmount.toString()).minus(
            deduction.amountPaid.toString(),
          ),
        );
        return {
          employeeDeductionId: deduction.id,
          name: deduction.name,
          amount: Decimal.min(balance, deduction.monthlyRate.toString())
            .toDecimalPlaces(2)
            .toString(),
        };
      })
      .filter((deduction) => new Decimal(deduction.amount).gt(0));

    return {
      values: this.buildEditableValuesFromLineItems(
        // Commission-only employees have no basic salary — zero it out regardless of
        // what may be stored on the employee record from a prior compensation type.
        employee.compensationType === 'COMMISSION'
          ? '0'
          : employee.basicSalary.toString(),
        employee.commissionAmount?.toString() ?? '0',
        allowanceItems,
        deductionItems,
      ),
      allowanceItems,
      deductionItems,
      fixedTaxAmount: employee.fixedTaxAmount?.toString() ?? null,
      taxPolicySnapshot: employee.taxPolicy,
      compensationTypeSnapshot: employee.compensationType,
      commissionTaxableSnapshot: employee.commissionTaxable,
    };
  }

  private calculateRunTotals(
    items: Array<{
      grossSalary: { toString(): string } | string | number;
      netSalary: { toString(): string } | string | number;
      employeeSSNIT: { toString(): string } | string | number;
      employerSSNIT: { toString(): string } | string | number;
      tier1Contribution: { toString(): string } | string | number;
      tier2Contribution: { toString(): string } | string | number;
      tier3Employee: { toString(): string } | string | number;
      payeTax: { toString(): string } | string | number;
    }>,
  ) {
    return items.reduce(
      (acc, item) => {
        acc.totalGross = acc.totalGross.plus(item.grossSalary.toString());
        acc.totalNet = acc.totalNet.plus(item.netSalary.toString());
        acc.totalSSNIT = acc.totalSSNIT
          .plus(item.employeeSSNIT.toString())
          .plus(item.employerSSNIT.toString());
        acc.totalTier1 = acc.totalTier1.plus(item.tier1Contribution.toString());
        acc.totalTier2 = acc.totalTier2.plus(item.tier2Contribution.toString());
        acc.totalTier3 = acc.totalTier3.plus(item.tier3Employee.toString());
        acc.totalPAYE = acc.totalPAYE.plus(item.payeTax.toString());
        acc.totalEmployerCost = acc.totalEmployerCost
          .plus(item.grossSalary.toString())
          .plus(item.employerSSNIT.toString());
        return acc;
      },
      {
        totalGross: new Decimal(0),
        totalNet: new Decimal(0),
        totalSSNIT: new Decimal(0),
        totalTier1: new Decimal(0),
        totalTier2: new Decimal(0),
        totalTier3: new Decimal(0),
        totalPAYE: new Decimal(0),
        totalEmployerCost: new Decimal(0),
      },
    );
  }

  private async getEditableRunOrThrow(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        items: {
          include: {
            allowanceItems: true,
            deductionItems: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'DRAFT') {
      throw new BadRequestException('Only draft payroll runs can be edited.');
    }

    return run;
  }

  private async getPayrollCurrency(tenantId: string): Promise<string> {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { payrollCurrency: true },
    });
    return config?.payrollCurrency ?? 'GHS';
  }

  private formatPayrollAmount(
    amount: { toString(): string },
    currency: string,
  ): string {
    const num = parseFloat(amount.toString());
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${currency} ${formatted}`;
  }

  private buildPayrollApprovalLink(tenantSlug: string, runId: string) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/payroll/approve/${encodeURIComponent(runId)}`;
  }

  private buildPayrollRunHistoryLink(tenantSlug: string, runId: string) {
    const baseUrl = process.env.FRONTEND_BASE_URL!;
    return `${baseUrl}/${tenantSlug}/hr/payroll/history/${encodeURIComponent(runId)}`;
  }

  private dedupePayrollRecipients(
    recipients: PayrollNotificationRecipient[],
  ): PayrollNotificationRecipient[] {
    const seen = new Set<string>();
    return recipients.filter((recipient) => {
      const key = recipient.userId || recipient.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async resolvePayrollApprovalRecipients(
    tenantId: string,
    excludingUserId?: string,
  ): Promise<PayrollNotificationRecipient[]> {
    const explicitApprovers =
      await this.rabbitmq.authResolvePermissionRecipients({
        tenantId,
        resource: 'payroll',
        action: 'APPROVE',
        activeOnly: true,
      });

    const approvers = this.dedupePayrollRecipients(
      explicitApprovers
        .filter((recipient) => recipient.email)
        .filter((recipient) => recipient.userId !== excludingUserId)
        .map((recipient) => ({
          userId: recipient.userId,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          source: 'APPROVER' as const,
        })),
    );

    if (approvers.length > 0) {
      return approvers;
    }

    const escalatedRecipients =
      await this.rabbitmq.authResolvePermissionRecipients({
        tenantId,
        resource: 'payroll',
        action: 'APPROVE',
        includeTenantAdmins: true,
        activeOnly: true,
      });

    return this.dedupePayrollRecipients(
      escalatedRecipients
        .filter((recipient) => recipient.role === 'TENANT_ADMIN')
        .filter((recipient) => recipient.userId !== excludingUserId)
        .map((recipient) => ({
          userId: recipient.userId,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          source: 'TENANT_ADMIN_ESCALATION' as const,
        })),
    );
  }

  private async resolvePayrollStakeholders(
    tenantId: string,
    excludingUserIds: string[] = [],
  ): Promise<PayrollNotificationRecipient[]> {
    const recipients = await this.rabbitmq.authResolvePermissionRecipients({
      tenantId,
      resource: 'payroll',
      action: 'RUN',
      activeOnly: true,
    });

    return this.dedupePayrollRecipients(
      recipients
        .filter((recipient) => recipient.email)
        .filter((recipient) => !excludingUserIds.includes(recipient.userId))
        .map((recipient) => ({
          userId: recipient.userId,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          source: 'STAKEHOLDER' as const,
        })),
    );
  }

  private async notifyPayrollApprovalRequested(
    tenantId: string,
    actor: RequestUser,
    run: {
      id: string;
      month: number;
      year: number;
      totalGross: { toString(): string };
      totalNet: { toString(): string };
      notes: string | null;
    },
  ) {
    const recipients = await this.resolvePayrollApprovalRecipients(
      tenantId,
      actor.id,
    );

    if (recipients.length === 0) {
      return { recipientCount: 0, escalated: false };
    }

    const reviewLink = this.buildPayrollApprovalLink(actor.tenantSlug, run.id);
    const currency = await this.getPayrollCurrency(tenantId);
    const periodLabel = `${run.month}/${run.year}`;
    const submittedByName = actor.firstName?.trim() || actor.email;
    const escalated = recipients.some(
      (recipient) => recipient.source === 'TENANT_ADMIN_ESCALATION',
    );

    await this.notificationsService.createMany(
      recipients.map((recipient) => ({
        tenantId,
        userId: recipient.userId,
        type: 'PAYROLL_APPROVAL_REQUESTED',
        message:
          recipient.source === 'TENANT_ADMIN_ESCALATION'
            ? `Payroll for ${periodLabel} is awaiting approval and has been escalated to you because no explicit payroll approver is configured.`
            : `Payroll for ${periodLabel} is awaiting your approval. Submitted by ${submittedByName}.`,
        link: `/hr/payroll/approve/${encodeURIComponent(run.id)}`,
      })),
    );

    await this.rabbitmq.notificationPayrollApprovalRequested({
      tenantId,
      payrollRunId: run.id,
      month: run.month,
      year: run.year,
      submittedByName,
      totalGross: this.formatPayrollAmount(run.totalGross, currency),
      totalNet: this.formatPayrollAmount(run.totalNet, currency),
      notes: run.notes ?? undefined,
      reviewLink,
      recipients: recipients.map((recipient) => ({
        userId: recipient.userId,
        email: recipient.email,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        source: recipient.source as 'APPROVER' | 'TENANT_ADMIN_ESCALATION',
      })),
    });

    return { recipientCount: recipients.length, escalated };
  }

  private async notifyPayrollDecision(
    tenantId: string,
    actor: RequestUser,
    run: {
      id: string;
      month: number;
      year: number;
      totalGross: { toString(): string };
      totalNet: { toString(): string };
    },
    decision: 'APPROVED' | 'RETURNED_TO_DRAFT',
    note: string,
  ) {
    const recipients = await this.resolvePayrollStakeholders(tenantId, [
      actor.id,
    ]);

    if (recipients.length === 0) {
      return { recipientCount: 0 };
    }

    const reviewerName = actor.firstName?.trim() || actor.email;
    const runHistoryLink = this.buildPayrollRunHistoryLink(
      actor.tenantSlug,
      run.id,
    );
    const currency = await this.getPayrollCurrency(tenantId);
    const periodLabel = `${run.month}/${run.year}`;

    await this.notificationsService.createMany(
      recipients.map((recipient) => ({
        tenantId,
        userId: recipient.userId,
        type: 'PAYROLL_DECISION',
        message:
          decision === 'APPROVED'
            ? `Payroll for ${periodLabel} was approved by ${reviewerName}. Note: ${note}`
            : `Payroll for ${periodLabel} was returned to draft by ${reviewerName}. Note: ${note}`,
        link: '/hr/payroll?tab=manage',
      })),
    );

    await this.rabbitmq.notificationPayrollDecision({
      tenantId,
      payrollRunId: run.id,
      month: run.month,
      year: run.year,
      decision,
      reviewerName,
      decisionNote: note,
      totalGross: this.formatPayrollAmount(run.totalGross, currency),
      totalNet: this.formatPayrollAmount(run.totalNet, currency),
      detailLink: runHistoryLink,
      recipients: recipients.map((recipient) => ({
        userId: recipient.userId,
        email: recipient.email,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
      })),
    });

    return { recipientCount: recipients.length };
  }

  async runPayroll(tenantId: string, runBy: string, dto: RunPayrollDto) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        tenantId_month_year: { tenantId, month: dto.month, year: dto.year },
      },
    });

    if (existing && existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Payroll for this month has already been processed',
      );
    }

    const { start, end } = this.getMonthBounds(dto.month, dto.year);
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        employmentStatus: {
          in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
        },
      },
      include: {
        allowances: {
          where: {
            isRecurring: true,
            effectiveFrom: { lte: end },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
          },
        },
        deductions: {
          where: {
            startDate: { lte: end },
          },
        },
      },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No payroll-eligible employees found');
    }

    // Exclude employees whose linked user account is still pending verification
    const userIds = employees
      .map((e) => e.userId)
      .filter((id): id is string => id !== null && id !== undefined);

    const verifiedEmployees =
      userIds.length > 0
        ? await (async () => {
            const statusMap = await this.rabbitmq.authGetUserStatuses({
              tenantId,
              userIds,
            });
            const verifiedIds = new Set(
              statusMap
                .filter((s) => s.status !== 'PENDING_VERIFICATION')
                .map((s) => s.userId),
            );
            return employees.filter(
              (e) =>
                e.userId === null ||
                e.userId === undefined ||
                verifiedIds.has(e.userId),
            );
          })()
        : employees;

    if (verifiedEmployees.length === 0) {
      throw new BadRequestException('No payroll-eligible employees found');
    }

    const settings = await this.getPayrollSettingsSnapshot(tenantId);
    const payrollItems: PayrollItemSeed[] = verifiedEmployees.map(
      (employee) => {
        const seed = this.buildSeedFromEmployee(employee, end);
        this.assertValidPayrollTaxPolicy({
          taxPolicy: seed.taxPolicySnapshot,
          fixedTaxAmount: seed.fixedTaxAmount,
        });
        return {
          ...this.calculatePayrollItemValues(seed.values, {
            ...settings,
            taxPolicy: seed.taxPolicySnapshot,
            fixedTaxAmount: seed.fixedTaxAmount,
            commissionTaxable: seed.commissionTaxableSnapshot,
            compensationType: seed.compensationTypeSnapshot,
          }),
          allowanceItems: seed.allowanceItems,
          deductionItems: seed.deductionItems,
          fixedTaxAmount: seed.fixedTaxAmount,
          taxPolicySnapshot: seed.taxPolicySnapshot,
          compensationTypeSnapshot: seed.compensationTypeSnapshot,
          commissionTaxableSnapshot: seed.commissionTaxableSnapshot,
        };
      },
    );
    const totals = this.calculateRunTotals(payrollItems);

    return this.prisma.payrollRun.upsert({
      where: {
        tenantId_month_year: { tenantId, month: dto.month, year: dto.year },
      },
      update: {
        status: 'DRAFT',
        totalGross: totals.totalGross.toString(),
        totalNet: totals.totalNet.toString(),
        totalSSNIT: totals.totalSSNIT.toString(),
        totalTier1: totals.totalTier1.toString(),
        totalTier2: totals.totalTier2.toString(),
        totalTier3: totals.totalTier3.toString(),
        totalPAYE: totals.totalPAYE.toString(),
        totalEmployerCost: totals.totalEmployerCost.toString(),
        runBy,
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        paidAt: null,
        notes: dto.notes,
        payrollCountry: settings.payrollCountry,
        payrollCurrency: settings.payrollCurrency,
        tier3Enabled: settings.tier3Enabled,
        tier3Rate: settings.tier3Rate,
        tier3SchemeName: settings.tier3SchemeName,
        items: {
          deleteMany: {},
          create: payrollItems.map(
            ({ allowanceItems, deductionItems, ...item }, index) => ({
              tenantId,
              employeeId: verifiedEmployees[index].id,
              ...item,
              allowanceItems: {
                create: allowanceItems.map((allowance) => ({
                  tenantId,
                  ...allowance,
                })),
              },
              deductionItems: {
                create: deductionItems.map((deduction) => ({
                  tenantId,
                  ...deduction,
                })),
              },
            }),
          ),
        },
      },
      create: {
        tenantId,
        month: dto.month,
        year: dto.year,
        status: 'DRAFT',
        totalGross: totals.totalGross.toString(),
        totalNet: totals.totalNet.toString(),
        totalSSNIT: totals.totalSSNIT.toString(),
        totalTier1: totals.totalTier1.toString(),
        totalTier2: totals.totalTier2.toString(),
        totalTier3: totals.totalTier3.toString(),
        totalPAYE: totals.totalPAYE.toString(),
        totalEmployerCost: totals.totalEmployerCost.toString(),
        runBy,
        notes: dto.notes,
        payrollCountry: settings.payrollCountry,
        payrollCurrency: settings.payrollCurrency,
        tier3Enabled: settings.tier3Enabled,
        tier3Rate: settings.tier3Rate,
        tier3SchemeName: settings.tier3SchemeName,
        items: {
          create: payrollItems.map(
            ({ allowanceItems, deductionItems, ...item }, index) => ({
              tenantId,
              employeeId: verifiedEmployees[index].id,
              ...item,
              allowanceItems: {
                create: allowanceItems.map((allowance) => ({
                  tenantId,
                  ...allowance,
                })),
              },
              deductionItems: {
                create: deductionItems.map((deduction) => ({
                  tenantId,
                  ...deduction,
                })),
              },
            }),
          ),
        },
      },
      include: {
        items: {
          include: {
            allowanceItems: true,
            deductionItems: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobTitle: true,
              },
            },
          },
        },
      },
    });
  }

  async updatePayrollItem(
    tenantId: string,
    runId: string,
    itemId: string,
    dto: UpdatePayrollItemDto,
  ) {
    const run = await this.getEditableRunOrThrow(tenantId, runId);
    const currentItem = run.items.find((item) => item.id === itemId);

    if (!currentItem) {
      throw new NotFoundException('Payroll item not found');
    }

    await this.getPayrollSettingsSnapshot(tenantId);
    const settings: PayrollSettingsSnapshot = {
      payrollCountry: run.payrollCountry,
      payrollCurrency: run.payrollCurrency,
      tier3Enabled: run.tier3Enabled,
      tier3Rate: run.tier3Rate?.toString() ?? null,
      tier3SchemeName: run.tier3SchemeName,
      country: run.payrollCountry,
    };
    const taxPolicySnapshot = dto.taxPolicy ?? currentItem.taxPolicySnapshot;
    const fixedTaxAmount =
      taxPolicySnapshot === PayrollTaxPolicy.FIXED_AMOUNT
        ? dto.fixedTaxAmount != null
          ? new Decimal(dto.fixedTaxAmount).toFixed(2)
          : (currentItem.fixedTaxAmount?.toString() ?? null)
        : null;
    const commissionTaxableSnapshot =
      dto.commissionTaxable ?? currentItem.commissionTaxableSnapshot;
    const commissionAmount =
      dto.commissionAmount != null
        ? new Decimal(dto.commissionAmount).toFixed(2)
        : currentItem.commissionAmount.toString();
    this.assertValidPayrollTaxPolicy({
      taxPolicy: taxPolicySnapshot,
      fixedTaxAmount,
    });
    const allowanceItems =
      dto.allowanceItems != null
        ? this.normalizeAllowanceLineItems(dto.allowanceItems)
        : currentItem.allowanceItems.map((item) => ({
            name: item.name,
            type: item.type,
            amount: item.amount.toString(),
          }));
    const deductionItems =
      dto.deductionItems != null
        ? this.normalizeDeductionLineItems(dto.deductionItems)
        : currentItem.deductionItems.map((item) => ({
            employeeDeductionId: item.employeeDeductionId,
            name: item.name,
            amount: item.amount.toString(),
          }));

    const recalculatedItem = this.calculatePayrollItemValues(
      dto.allowanceItems != null || dto.deductionItems != null
        ? this.buildEditableValuesFromLineItems(
            dto.basicSalary != null
              ? new Decimal(dto.basicSalary).toFixed(2)
              : currentItem.basicSalary.toString(),
            commissionAmount,
            dto.allowanceItems != null
              ? allowanceItems
              : [
                  ...allowanceItems.filter((item) =>
                    this.isTransportAllowanceLine(item),
                  ),
                  {
                    name: 'Allowances',
                    type: null,
                    amount:
                      dto.totalAllowances != null
                        ? new Decimal(dto.totalAllowances).toFixed(2)
                        : currentItem.totalAllowances.toString(),
                  },
                ].filter((item) => new Decimal(item.amount).gt(0)),
            dto.deductionItems != null
              ? deductionItems
              : [
                  {
                    name: 'Deductions',
                    amount:
                      dto.otherDeductions != null
                        ? new Decimal(dto.otherDeductions).toFixed(2)
                        : currentItem.otherDeductions.toString(),
                  },
                ].filter((item) => new Decimal(item.amount).gt(0)),
          )
        : {
            basicSalary:
              dto.basicSalary != null
                ? new Decimal(dto.basicSalary).toFixed(2)
                : currentItem.basicSalary.toString(),
            commissionAmount,
            totalAllowances:
              dto.totalAllowances != null
                ? new Decimal(dto.totalAllowances).toFixed(2)
                : currentItem.totalAllowances.toString(),
            transportAmount:
              dto.transportAmount != null
                ? new Decimal(dto.transportAmount).toFixed(2)
                : currentItem.transportAmount.toString(),
            otherDeductions:
              dto.otherDeductions != null
                ? new Decimal(dto.otherDeductions).toFixed(2)
                : currentItem.otherDeductions.toString(),
          },
      {
        ...settings,
        taxPolicy: taxPolicySnapshot,
        fixedTaxAmount,
        commissionTaxable: commissionTaxableSnapshot,
        compensationType: currentItem.compensationTypeSnapshot,
      },
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.payrollItem.update({
        where: { id: itemId },
        data: {
          ...recalculatedItem,
          fixedTaxAmount,
          taxPolicySnapshot,
          commissionTaxableSnapshot,
        },
      });

      if (dto.allowanceItems != null) {
        await tx.payrollItemAllowance.deleteMany({
          where: { payrollItemId: itemId, tenantId },
        });
        if (allowanceItems.length > 0) {
          await tx.payrollItemAllowance.createMany({
            data: allowanceItems.map((item) => ({
              tenantId,
              payrollItemId: itemId,
              ...item,
            })),
          });
        }
      }

      if (dto.deductionItems != null) {
        await tx.payrollItemDeduction.deleteMany({
          where: { payrollItemId: itemId, tenantId },
        });
        if (deductionItems.length > 0) {
          await tx.payrollItemDeduction.createMany({
            data: deductionItems.map((item) => ({
              tenantId,
              payrollItemId: itemId,
              ...item,
            })),
          });
        }
      }

      const items = await tx.payrollItem.findMany({
        where: { payrollRunId: runId, tenantId },
      });
      const totals = this.calculateRunTotals(items);

      await tx.payrollRun.update({
        where: { id: runId },
        data: {
          totalGross: totals.totalGross.toString(),
          totalNet: totals.totalNet.toString(),
          totalSSNIT: totals.totalSSNIT.toString(),
          totalTier1: totals.totalTier1.toString(),
          totalTier2: totals.totalTier2.toString(),
          totalTier3: totals.totalTier3.toString(),
          totalPAYE: totals.totalPAYE.toString(),
          totalEmployerCost: totals.totalEmployerCost.toString(),
        },
      });

      return tx.payrollRun.findFirst({
        where: { id: runId, tenantId },
        include: {
          items: {
            include: {
              allowanceItems: true,
              deductionItems: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  jobTitle: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async submitPayrollForApproval(
    tenantId: string,
    runId: string,
    actor: RequestUser,
  ) {
    const run = await this.getEditableRunOrThrow(tenantId, runId);

    if (run.items.length === 0) {
      throw new BadRequestException(
        'Draft payroll run has no payroll items to submit.',
      );
    }

    const submittedRun = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'PENDING_APPROVAL',
        submittedBy: actor.id,
        submittedAt: new Date(),
        approvedBy: null,
        approvedAt: null,
        approvalNote: null,
        returnToDraftNote: null,
      },
    });

    const notificationSummary = await this.notifyPayrollApprovalRequested(
      tenantId,
      actor,
      submittedRun,
    );

    return {
      ...submittedRun,
      notificationSummary,
    };
  }

  async returnPayrollToDraft(
    tenantId: string,
    id: string,
    actor: RequestUser,
    dto: PayrollDecisionDto,
  ) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'Only payroll runs pending approval can be returned to draft.',
      );
    }

    const note = dto.note.trim();
    if (!note) {
      throw new BadRequestException(
        'A reviewer note is required when returning payroll to draft.',
      );
    }

    const updatedRun = await this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'DRAFT',
        approvedBy: null,
        approvedAt: null,
        approvalNote: null,
        returnToDraftNote: note,
      },
    });

    const notificationSummary = await this.notifyPayrollDecision(
      tenantId,
      actor,
      updatedRun,
      'RETURNED_TO_DRAFT',
      note,
    );

    return {
      ...updatedRun,
      notificationSummary,
    };
  }

  async approvePayroll(
    tenantId: string,
    id: string,
    actor: RequestUser,
    dto: PayrollDecisionDto,
  ) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Payroll is not pending approval');
    }
    const note = dto.note.trim();
    if (!note) {
      throw new BadRequestException(
        'A reviewer note is required when approving payroll.',
      );
    }

    const updatedRun = await this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: actor.id,
        approvedAt: new Date(),
        approvalNote: note,
        returnToDraftNote: null,
      },
    });

    const notificationSummary = await this.notifyPayrollDecision(
      tenantId,
      actor,
      updatedRun,
      'APPROVED',
      note,
    );

    return {
      ...updatedRun,
      notificationSummary,
    };
  }

  private async applyPaidPayrollDeductions(
    tx: Prisma.TransactionClient,
    tenantId: string,
    items: Array<
      Pick<PayrollItem, 'employeeId' | 'otherDeductions'> & {
        deductionItems: Array<{
          employeeDeductionId: string | null;
          amount: { toString(): string };
        }>;
      }
    >,
  ) {
    for (const item of items) {
      for (const itemDeduction of item.deductionItems) {
        if (!itemDeduction.employeeDeductionId) continue;

        const deduction = await tx.employeeDeduction.findFirst({
          where: {
            id: itemDeduction.employeeDeductionId,
            tenantId,
            employeeId: item.employeeId,
          },
        });
        if (!deduction) continue;
        const balance = Decimal.max(
          new Decimal(0),
          new Decimal(deduction.totalAmount.toString()).minus(
            deduction.amountPaid.toString(),
          ),
        );
        if (balance.lte(0)) continue;

        const applied = Decimal.min(balance, itemDeduction.amount.toString());

        if (applied.lte(0)) continue;

        await tx.employeeDeduction.update({
          where: { id: deduction.id },
          data: {
            amountPaid: new Decimal(deduction.amountPaid.toString())
              .plus(applied)
              .toDecimalPlaces(2)
              .toString(),
          },
        });
      }
    }
  }

  async markAsPaid(tenantId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            deductionItems: true,
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'APPROVED') {
      throw new BadRequestException('Payroll must be approved first');
    }

    const paidRun = await this.prisma.$transaction(async (tx) => {
      const updatedRun = await tx.payrollRun.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      await this.applyPaidPayrollDeductions(tx, tenantId, run.items);

      return updatedRun;
    });

    await this.notifyPayslipsPaid(
      tenantId,
      run.id,
      run.month,
      run.year,
      run.items,
    );

    return paidRun;
  }

  private async notifyPayslipsPaid(
    tenantId: string,
    payrollRunId: string,
    month: number,
    year: number,
    items: { employeeId: string }[],
  ) {
    const employeeIds = [...new Set(items.map((item) => item.employeeId))];
    if (employeeIds.length === 0) return;

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, userId: { not: null } },
      select: { id: true, userId: true },
    });

    if (employees.length === 0) return;

    const periodLabel = `${month}/${year}`;
    await this.notificationsService.createMany(
      employees.map((employee) => ({
        tenantId,
        userId: employee.userId!,
        type: 'PAYSLIP_PAID',
        title: 'Payslip Available',
        message: `Your payslip for ${periodLabel} is ready.`,
        link: '/hr',
        entityType: 'payrollRun',
        entityId: payrollRunId,
      })),
    );
  }

  async getPayrollRuns(tenantId: string, actor: RequestUser) {
    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(this.canReadPayroll(actor));
    }

    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPayrollRunById(tenantId: string, id: string, actor: RequestUser) {
    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(this.canReadPayroll(actor));
    }

    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            allowanceItems: true,
            deductionItems: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobTitle: true,
                bankName: true,
                bankAccountNumber: true,
              },
            },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return {
      ...run,
      items: run.items.map((item) => ({
        ...item,
        employee: item.employee
          ? {
              ...item.employee,
              // bankName is intentionally returned decrypted (not masked): payroll
              // admins need the full bank name to validate payment instructions.
              // bankAccountNumber is masked — last 4 digits are sufficient for
              // reconciliation and prevents bulk account number exposure.
              bankName: this.encryption.decrypt(item.employee.bankName) as
                | string
                | null,
              bankAccountNumber: this.encryption.mask(
                this.encryption.decrypt(item.employee.bankAccountNumber),
              ),
            }
          : item.employee,
      })),
    };
  }

  async getMyPayslips(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    return this.prisma.payrollItem.findMany({
      where: {
        employeeId: employee.id,
        tenantId,
        payrollRun: {
          status: { in: ['APPROVED', 'PAID'] },
        },
      },
      include: {
        allowanceItems: true,
        deductionItems: true,
        payrollRun: {
          select: {
            month: true,
            year: true,
            status: true,
            paidAt: true,
            payrollCountry: true,
            payrollCurrency: true,
            tier3Enabled: true,
            tier3Rate: true,
            tier3SchemeName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
