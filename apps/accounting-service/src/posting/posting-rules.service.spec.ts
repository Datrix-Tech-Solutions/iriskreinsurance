import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  GLAccountCategory,
  NormalBalance,
  PostingDirection,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostingRuleDto } from './dto/posting.dto';
import { PostingRulesService } from './posting-rules.service';

describe('PostingRulesService', () => {
  const actor = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'accountant@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Amina',
    moduleConfig: { accounting: true },
    featureConfig: {},
    permissions: [],
  } as RequestUser;

  const lines = [
    {
      sequence: 1,
      direction: PostingDirection.DR,
      glAccountId: 'account-dr',
      amountSource: 'amount',
      currencySource: 'currency',
      descriptionTemplate: 'Debit {{sourceRecordId}}',
    },
    {
      sequence: 2,
      direction: PostingDirection.CR,
      glAccountId: 'account-cr',
      amountSource: 'amount',
      currencySource: 'currency',
      descriptionTemplate: 'Credit {{sourceRecordId}}',
    },
  ];
  const dto: CreatePostingRuleDto = {
    name: 'Receipt issued',
    sourceModule: 'OPERATIONS',
    sourceEventType: 'RECEIPT_ISSUED',
    version: 1,
    active: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    lines,
  };

  const account = (id: string) => ({
    id,
    tenantId: actor.tenantId,
    code: id,
    name: id,
    category: GLAccountCategory.ASSET,
    normalBalance: NormalBalance.DEBIT,
    allowPosting: true,
    status: RecordStatus.ACTIVE,
    _count: { childAccounts: 0 },
  });

  function setup() {
    const createPostingRule = jest
      .fn<Promise<unknown>, [Prisma.PostingRuleCreateArgs]>()
      .mockResolvedValue({ id: 'rule-1', ...dto });
    const prisma = {
      postingRule: {
        create: createPostingRule,
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      postingRuleLine: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sourceEventInbox: {
        count: jest.fn().mockResolvedValue(0),
      },
      gLAccount: {
        findMany: jest
          .fn()
          .mockResolvedValue([account('account-dr'), account('account-cr')]),
      },
    };
    const service = new PostingRulesService(prisma as unknown as PrismaService);
    return { prisma, service };
  }

  it('creates an active versioned rule with debit and credit lines', async () => {
    const { prisma, service } = setup();

    await service.create(actor, dto);

    const createCall = prisma.postingRule.create.mock.calls[0]?.[0];
    if (!createCall) throw new Error('Posting rule create was not called');
    expect(createCall.data).toMatchObject({
      tenantId: actor.tenantId,
      version: 1,
      active: true,
    });
    expect(createCall.data.lines?.create).toEqual([
      expect.objectContaining({
        direction: PostingDirection.DR,
        glAccountId: 'account-dr',
      }),
      expect.objectContaining({
        direction: PostingDirection.CR,
        glAccountId: 'account-cr',
      }),
    ]);
  });

  it('rejects activation without both debit and credit lines', async () => {
    const { service } = setup();

    await expect(
      service.create(actor, { ...dto, lines: [lines[0]] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes posting rule lookup to the tenant', async () => {
    const { prisma, service } = setup();
    prisma.postingRule.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('tenant-other', 'rule-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.postingRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rule-1', tenantId: 'tenant-other' },
      }),
    );
  });

  it('requires a new version instead of editing a used rule', async () => {
    const { prisma, service } = setup();
    prisma.postingRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      tenantId: actor.tenantId,
      name: dto.name,
      active: false,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: null,
      lines,
    });
    prisma.sourceEventInbox.count.mockResolvedValue(1);

    await expect(
      service.update(actor, 'rule-1', { name: 'Changed' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires an inactive rule before changing its lines', async () => {
    const { prisma, service } = setup();
    prisma.postingRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      tenantId: actor.tenantId,
      active: true,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: null,
      lines,
    });

    await expect(
      service.createLine(actor, 'rule-1', lines[0]),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
