import {
  FiscalPeriodStatus,
  PostingDirection,
  RecordStatus,
  SubledgerType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingReadinessService } from './accounting-readiness.service';

describe('AccountingReadinessService', () => {
  const tenantId = 'tenant-1';
  const businessDate = '2026-07-30T12:00:00.000Z';

  const postableAccount = (overrides: Record<string, unknown> = {}) => ({
    id: 'account-1',
    status: RecordStatus.ACTIVE,
    allowPosting: true,
    _count: { childAccounts: 0 },
    ...overrides,
  });

  const validRule = (overrides: Record<string, unknown> = {}) => ({
    id: 'rule-1',
    tenantId,
    sourceModule: 'REINSURANCE',
    sourceEventType: 'CLAIM_PAYABLE_APPROVED',
    active: true,
    version: 1,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    lines: [
      {
        id: 'line-1',
        tenantId,
        postingRuleId: 'rule-1',
        sequence: 1,
        direction: PostingDirection.DR,
        glAccountId: 'account-dr',
        subledgerType: SubledgerType.CEDANT,
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.approvedPayableAmount',
        currencySource: 'currency',
        descriptionTemplate: 'Claim payable {{sourceRecordId}}',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        glAccount: postableAccount({ id: 'account-dr' }),
      },
      {
        id: 'line-2',
        tenantId,
        postingRuleId: 'rule-1',
        sequence: 2,
        direction: PostingDirection.CR,
        glAccountId: 'account-cr',
        subledgerType: null,
        subledgerExternalRefSource: null,
        amountSource: 'amounts.approvedPayableAmount',
        currencySource: 'currency',
        descriptionTemplate: 'Claim payable {{sourceRecordId}}',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        glAccount: postableAccount({ id: 'account-cr' }),
      },
    ],
    ...overrides,
  });

  const setup = () => {
    const prisma = {
      accountingTenantConfig: {
        findUnique: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
          tenantId,
        }),
      },
      accountingCurrency: {
        findUnique: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
          code: 'GHS',
          isActive: true,
        }),
      },
      fiscalPeriod: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
          id: 'period-1',
          status: FiscalPeriodStatus.OPEN,
        }),
      },
      accountingCashAccount: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
          id: 'cash-1',
          isActive: true,
          currency: 'GHS',
        }),
      },
      postingRule: {
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(validRule()),
      },
    };
    const service = new AccountingReadinessService(
      prisma as unknown as PrismaService,
    );
    return { prisma, service };
  };

  const check = async (
    service: AccountingReadinessService,
    overrides: Record<string, unknown> = {},
  ) =>
    service.checkReinsuranceReadiness({
      tenantId,
      eventTypes: ['CLAIM_PAYABLE_APPROVED'],
      currency: 'GHS',
      businessDate,
      ...overrides,
    });

  it('returns ready when tenant config, open period, active currency and rule are valid', async () => {
    const { service } = setup();

    const result = await check(service);

    expect(result.ready).toBe(true);
    expect(result.eventResults).toEqual([
      expect.objectContaining({
        eventType: 'CLAIM_PAYABLE_APPROVED',
        kind: 'NON_CASH',
        controlDimension: 'CEDANT_CLAIMS_AP',
        requiredSubledgerType: SubledgerType.CEDANT,
        ready: true,
        blockers: [],
      }),
    ]);
  });

  it('reports missing and inactive PostingRules without leaking internals', async () => {
    const { prisma, service } = setup();
    prisma.postingRule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    let result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'POSTING_RULE_MISSING' }),
    );

    prisma.postingRule.findFirst.mockReset();
    prisma.postingRule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(validRule({ active: false }));

    result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'POSTING_RULE_INACTIVE' }),
    );
  });

  it('reports invalid GL and subledger control shape', async () => {
    const { prisma, service } = setup();
    prisma.postingRule.findFirst.mockResolvedValue(
      validRule({
        lines: [
          {
            ...validRule().lines[0],
            subledgerType: SubledgerType.REINSURER,
            glAccount: postableAccount({
              status: RecordStatus.INACTIVE,
              allowPosting: false,
              _count: { childAccounts: 1 },
            }),
          },
          validRule().lines[1],
        ],
      }),
    );

    const result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CONTROL_ACCOUNT_INACTIVE' }),
        expect.objectContaining({ code: 'CONTROL_ACCOUNT_NOT_POSTABLE' }),
        expect.objectContaining({ code: 'CONTROL_ACCOUNT_MISSING' }),
      ]),
    );
  });

  it('reports missing, closed and open fiscal periods by business date', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null);

    let result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'FISCAL_PERIOD_MISSING' }),
    );

    prisma.fiscalPeriod.findFirst.mockResolvedValueOnce({
      id: 'period-1',
      status: FiscalPeriodStatus.CLOSED,
    });

    result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'FISCAL_PERIOD_CLOSED' }),
    );
  });

  it('reports missing and inactive currency setup', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValueOnce(null);

    let result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'CURRENCY_MISSING' }),
    );

    prisma.accountingCurrency.findUnique.mockResolvedValueOnce({
      code: 'GHS',
      isActive: false,
    });

    result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'CURRENCY_INACTIVE' }),
    );
  });

  it('requires active matching cash accounts for cash-impact transaction readiness', async () => {
    const { prisma, service } = setup();
    prisma.postingRule.findFirst.mockResolvedValue(
      validRule({
        sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      }),
    );
    prisma.accountingCashAccount.findFirst.mockResolvedValueOnce(null);

    let result = await check(service, {
      eventTypes: ['PREMIUM_PAYMENT_RECEIVED'],
      settlementMethod: 'BANK_TRANSFER',
      accountingCashAccountId: undefined,
    });

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'CASH_ACCOUNT_REQUIRED' }),
    );

    prisma.accountingCashAccount.findFirst.mockResolvedValueOnce({
      id: 'cash-1',
      isActive: true,
      currency: 'USD',
    });

    result = await check(service, {
      eventTypes: ['PREMIUM_PAYMENT_RECEIVED'],
      settlementMethod: 'BANK_TRANSFER',
      accountingCashAccountId: 'cash-1',
    });

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'CASH_ACCOUNT_INVALID' }),
    );
  });

  it('does not require cash account readiness for non-cash or journal settlement methods', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(null);

    let result = await check(service);

    expect(result.ready).toBe(true);

    prisma.postingRule.findFirst.mockResolvedValue(
      validRule({
        sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      }),
    );

    result = await check(service, {
      eventTypes: ['PREMIUM_PAYMENT_RECEIVED'],
      settlementMethod: 'JOURNAL',
      accountingCashAccountId: undefined,
    });

    expect(result.ready).toBe(true);
  });

  it('reports disabled tenant Accounting integration separately from event configuration', async () => {
    const { prisma, service } = setup();
    prisma.accountingTenantConfig.findUnique.mockResolvedValue(null);

    const result = await check(service);

    expect(result.ready).toBe(false);
    expect(result.eventResults[0].blockers).toContainEqual(
      expect.objectContaining({ code: 'ACCOUNTING_INTEGRATION_DISABLED' }),
    );
  });
});
