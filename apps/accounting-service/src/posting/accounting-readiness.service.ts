import { Injectable } from '@nestjs/common';
import {
  FiscalPeriodStatus,
  PostingDirection,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { InternalReinsuranceAccountingReadinessDto } from './dto/posting.dto';
import {
  isCashbookSettlementMethod,
  REINSURANCE_ACCOUNTING_EVENT_BY_TYPE,
  ReinsuranceAccountingEventReadinessDefinition,
  ReinsuranceReadinessBlockerCode,
} from './reinsurance-accounting-readiness.catalog';

const postingRuleReadinessInclude = {
  lines: {
    include: {
      glAccount: {
        select: {
          id: true,
          status: true,
          allowPosting: true,
          _count: { select: { childAccounts: true } },
        },
      },
    },
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.PostingRuleInclude;

type PostingRuleForReadiness = Prisma.PostingRuleGetPayload<{
  include: typeof postingRuleReadinessInclude;
}>;

export type AccountingReadinessBlocker = {
  code: ReinsuranceReadinessBlockerCode;
  message: string;
};

@Injectable()
export class AccountingReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async checkReinsuranceReadiness(
    dto: InternalReinsuranceAccountingReadinessDto,
  ) {
    const checkedAt = new Date();
    const businessDate = dto.businessDate
      ? new Date(dto.businessDate)
      : checkedAt;
    const currency = dto.currency?.trim().toUpperCase();
    const eventTypes = [
      ...new Set(dto.eventTypes.map((event) => event.trim().toUpperCase())),
    ];

    const [tenantConfig, currencyRecord, fiscalPeriod, suppliedCashAccount] =
      await Promise.all([
        this.prisma.accountingTenantConfig.findUnique({
          where: { tenantId: dto.tenantId },
          select: { tenantId: true },
        }),
        currency
          ? this.prisma.accountingCurrency.findUnique({
              where: {
                tenantId_code: { tenantId: dto.tenantId, code: currency },
              },
              select: { code: true, isActive: true },
            })
          : Promise.resolve(null),
        this.prisma.fiscalPeriod.findFirst({
          where: {
            tenantId: dto.tenantId,
            startDate: { lte: businessDate },
            endDate: { gte: businessDate },
          },
          select: { id: true, status: true },
          orderBy: { startDate: 'desc' },
        }),
        dto.accountingCashAccountId
          ? this.prisma.accountingCashAccount.findFirst({
              where: {
                id: dto.accountingCashAccountId,
                tenantId: dto.tenantId,
              },
              select: { id: true, isActive: true, currency: true },
            })
          : Promise.resolve(null),
      ]);

    const eventResults = await Promise.all(
      eventTypes.map(async (eventType) => {
        const blockers: AccountingReadinessBlocker[] = [];
        const definition = REINSURANCE_ACCOUNTING_EVENT_BY_TYPE.get(eventType);

        if (!tenantConfig) {
          blockers.push({
            code: 'ACCOUNTING_INTEGRATION_DISABLED',
            message: 'Accounting tenant configuration is missing.',
          });
        }
        if (!definition) {
          blockers.push({
            code: 'POSTING_RULE_MISSING',
            message: `Unsupported Reinsurance accounting event ${eventType}.`,
          });
        }

        if (currency && !currencyRecord) {
          blockers.push({
            code: 'CURRENCY_MISSING',
            message: `Accounting currency ${currency} is not configured.`,
          });
        } else if (currencyRecord && !currencyRecord.isActive) {
          blockers.push({
            code: 'CURRENCY_INACTIVE',
            message: `Accounting currency ${currency} is inactive.`,
          });
        }

        if (!fiscalPeriod) {
          blockers.push({
            code: 'FISCAL_PERIOD_MISSING',
            message: 'No fiscal period contains the event business date.',
          });
        } else if (fiscalPeriod.status !== FiscalPeriodStatus.OPEN) {
          blockers.push({
            code: 'FISCAL_PERIOD_CLOSED',
            message: `Fiscal period for the event business date is ${fiscalPeriod.status}.`,
          });
        }

        if (definition) {
          blockers.push(
            ...(await this.postingRuleBlockers(
              dto.tenantId,
              eventType,
              businessDate,
              definition,
            )),
          );
          blockers.push(
            ...(await this.cashAccountBlockers(
              dto.tenantId,
              definition.kind,
              currency,
              dto.settlementMethod,
              dto.accountingCashAccountId,
              suppliedCashAccount,
            )),
          );
        }

        return {
          eventType,
          kind: definition?.kind ?? null,
          controlDimension: definition?.controlDimension ?? null,
          requiredSubledgerType: definition?.requiredSubledgerType ?? null,
          reversalDependsOnOriginalRecognition:
            definition?.reversalDependsOnOriginalRecognition ?? false,
          ready: blockers.length === 0,
          blockers,
        };
      }),
    );

    return {
      ready: eventResults.every((result) => result.ready),
      checkedAt: checkedAt.toISOString(),
      eventResults,
    };
  }

  private async postingRuleBlockers(
    tenantId: string,
    eventType: string,
    businessDate: Date,
    definition: ReinsuranceAccountingEventReadinessDefinition,
  ): Promise<AccountingReadinessBlocker[]> {
    const blockers: AccountingReadinessBlocker[] = [];
    const effectiveRule = await this.prisma.postingRule.findFirst({
      where: {
        tenantId,
        sourceModule: 'REINSURANCE',
        sourceEventType: eventType,
        active: true,
        effectiveFrom: { lte: businessDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: businessDate } }],
      },
      include: postingRuleReadinessInclude,
      orderBy: { version: 'desc' },
    });
    if (effectiveRule) {
      return this.validateRule(effectiveRule, definition);
    }

    const configuredRule = await this.prisma.postingRule.findFirst({
      where: {
        tenantId,
        sourceModule: 'REINSURANCE',
        sourceEventType: eventType,
      },
      include: postingRuleReadinessInclude,
      orderBy: { version: 'desc' },
    });
    if (!configuredRule) {
      return [
        {
          code: 'POSTING_RULE_MISSING',
          message: `No PostingRule is configured for ${eventType}.`,
        },
      ];
    }
    if (!configuredRule.active) {
      blockers.push({
        code: 'POSTING_RULE_INACTIVE',
        message: `The latest PostingRule for ${eventType} is inactive.`,
      });
    } else {
      blockers.push({
        code: 'POSTING_RULE_INVALID',
        message: `No active PostingRule for ${eventType} is effective on the event business date.`,
      });
    }
    blockers.push(...this.validateRule(configuredRule, definition));
    return blockers;
  }

  private validateRule(
    rule: PostingRuleForReadiness,
    definition: ReinsuranceAccountingEventReadinessDefinition,
  ): AccountingReadinessBlocker[] {
    const blockers: AccountingReadinessBlocker[] = [];
    if (rule.lines.length < 2) {
      blockers.push({
        code: 'POSTING_RULE_INVALID',
        message: 'PostingRule requires at least two lines.',
      });
    }
    const directions = new Set(rule.lines.map((line) => line.direction));
    if (
      !directions.has(PostingDirection.DR) ||
      !directions.has(PostingDirection.CR)
    ) {
      blockers.push({
        code: 'POSTING_RULE_INVALID',
        message: 'PostingRule requires both debit and credit lines.',
      });
    }

    for (const line of rule.lines) {
      if (line.glAccount.status !== RecordStatus.ACTIVE) {
        blockers.push({
          code: 'CONTROL_ACCOUNT_INACTIVE',
          message: `PostingRule line ${line.sequence} references an inactive GL account.`,
        });
      }
      if (
        !line.glAccount.allowPosting ||
        line.glAccount._count.childAccounts > 0
      ) {
        blockers.push({
          code: 'CONTROL_ACCOUNT_NOT_POSTABLE',
          message: `PostingRule line ${line.sequence} references a non-postable GL account.`,
        });
      }
      if (
        Boolean(line.subledgerType) !== Boolean(line.subledgerExternalRefSource)
      ) {
        blockers.push({
          code: 'POSTING_RULE_INVALID',
          message: `PostingRule line ${line.sequence} has incomplete subledger configuration.`,
        });
      }
    }

    const hasExpectedSubledger = rule.lines.some(
      (line) => line.subledgerType === definition.requiredSubledgerType,
    );
    if (!hasExpectedSubledger) {
      blockers.push({
        code: 'CONTROL_ACCOUNT_MISSING',
        message: `${definition.eventType} must preserve ${definition.controlDimension} using a ${definition.requiredSubledgerType} subledger line.`,
      });
    }

    return blockers;
  }

  private async cashAccountBlockers(
    tenantId: string,
    eventKind: 'CASH' | 'NON_CASH',
    currency: string | undefined,
    settlementMethod: string | undefined,
    accountingCashAccountId: string | undefined,
    suppliedCashAccount: {
      id: string;
      isActive: boolean;
      currency: string;
    } | null,
  ): Promise<AccountingReadinessBlocker[]> {
    if (eventKind !== 'CASH' || !isCashbookSettlementMethod(settlementMethod)) {
      return [];
    }
    if (accountingCashAccountId) {
      if (!suppliedCashAccount) {
        return [
          {
            code: 'CASH_ACCOUNT_INVALID',
            message:
              'Selected Accounting cash account does not exist for this tenant.',
          },
        ];
      }
      const blockers: AccountingReadinessBlocker[] = [];
      if (!suppliedCashAccount.isActive) {
        blockers.push({
          code: 'CASH_ACCOUNT_INVALID',
          message: 'Selected Accounting cash account is inactive.',
        });
      }
      if (currency && suppliedCashAccount.currency !== currency) {
        blockers.push({
          code: 'CASH_ACCOUNT_INVALID',
          message:
            'Selected Accounting cash account currency does not match the event currency.',
        });
      }
      return blockers;
    }

    if (!currency) {
      const activeCashAccount =
        await this.prisma.accountingCashAccount.findFirst({
          where: { tenantId, isActive: true },
          select: { id: true },
        });
      if (activeCashAccount) return [];
      return [
        {
          code: 'CASH_ACCOUNT_REQUIRED',
          message:
            'No active Accounting cash account is configured for cash-impact Reinsurance events.',
        },
      ];
    }

    const activeCashAccount = await this.prisma.accountingCashAccount.findFirst(
      {
        where: { tenantId, currency, isActive: true },
        select: { id: true },
      },
    );
    if (!activeCashAccount) {
      return [
        {
          code: 'CASH_ACCOUNT_REQUIRED',
          message: `No active Accounting cash account is configured for ${currency}.`,
        },
      ];
    }
    return [];
  }
}
