import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PostingDirection,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePostingRuleDto,
  CreatePostingRuleLineDto,
  PostingRuleLineInputDto,
  QueryPostingRulesDto,
  UpdatePostingRuleDto,
  UpdatePostingRuleLineDto,
} from './dto/posting.dto';

const postingRuleInclude = {
  lines: {
    include: {
      glAccount: {
        select: { id: true, code: true, name: true, status: true },
      },
    },
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.PostingRuleInclude;

@Injectable()
export class PostingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: QueryPostingRulesDto) {
    return this.prisma.postingRule.findMany({
      where: {
        tenantId,
        ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
        ...(query.sourceEventType
          ? { sourceEventType: query.sourceEventType }
          : {}),
        ...(query.active !== undefined ? { active: query.active } : {}),
      },
      include: postingRuleInclude,
      orderBy: [
        { sourceModule: 'asc' },
        { sourceEventType: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  async findOne(tenantId: string, ruleId: string) {
    const rule = await this.prisma.postingRule.findFirst({
      where: { id: ruleId, tenantId },
      include: postingRuleInclude,
    });
    if (!rule) throw new NotFoundException('Posting rule not found');
    return rule;
  }

  async create(user: RequestUser, dto: CreatePostingRuleDto) {
    this.assertEffectiveDates(dto.effectiveFrom, dto.effectiveTo);
    if (dto.lines) {
      await this.assertLines(user.tenantId, dto.lines);
    }
    if (dto.active) {
      this.assertActivatable(dto.lines ?? []);
    }

    try {
      return await this.prisma.postingRule.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          sourceModule: dto.sourceModule,
          sourceEventType: dto.sourceEventType,
          version: dto.version,
          active: dto.active ?? false,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          ...(dto.lines
            ? {
                lines: {
                  create: dto.lines.map((line) => this.lineCreateData(line)),
                },
              }
            : {}),
        },
        include: postingRuleInclude,
      });
    } catch (error) {
      this.rethrowUnique(
        error,
        'Posting rule version already exists for this source event',
      );
    }
  }

  async update(user: RequestUser, ruleId: string, dto: UpdatePostingRuleDto) {
    const rule = await this.findOne(user.tenantId, ruleId);
    const used = await this.isUsed(user.tenantId, rule.id);
    const changesDefinition =
      dto.name !== undefined ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveTo !== undefined;

    if (used && (changesDefinition || dto.active !== false)) {
      throw new ConflictException(
        'Used posting rules are immutable; create a new rule version instead',
      );
    }
    if (rule.active && changesDefinition && dto.active !== false) {
      throw new ConflictException(
        'Deactivate the posting rule before changing its definition',
      );
    }

    const effectiveFrom = dto.effectiveFrom ?? rule.effectiveFrom.toISOString();
    const effectiveTo =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
        : rule.effectiveTo?.toISOString();
    this.assertEffectiveDates(effectiveFrom, effectiveTo);

    if (dto.active === true && !rule.active) {
      this.assertActivatable(rule.lines);
    }

    return this.prisma.postingRule.update({
      where: {
        id_tenantId: { id: rule.id, tenantId: user.tenantId },
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.effectiveFrom
          ? { effectiveFrom: new Date(dto.effectiveFrom) }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? {
              effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
            }
          : {}),
        updatedByUserId: user.id,
      },
      include: postingRuleInclude,
    });
  }

  async deactivate(user: RequestUser, ruleId: string) {
    const rule = await this.findOne(user.tenantId, ruleId);
    if (!rule.active) return rule;
    return this.prisma.postingRule.update({
      where: {
        id_tenantId: { id: rule.id, tenantId: user.tenantId },
      },
      data: { active: false, updatedByUserId: user.id },
      include: postingRuleInclude,
    });
  }

  async createLine(
    user: RequestUser,
    ruleId: string,
    dto: CreatePostingRuleLineDto,
  ) {
    const rule = await this.findOne(user.tenantId, ruleId);
    await this.assertLineMutable(user.tenantId, rule);
    await this.assertLines(user.tenantId, [dto]);

    try {
      return await this.prisma.postingRuleLine.create({
        data: {
          tenantId: user.tenantId,
          postingRuleId: rule.id,
          ...this.lineCreateData(dto),
        },
        include: {
          glAccount: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Posting rule line sequence already exists');
    }
  }

  async updateLine(
    user: RequestUser,
    ruleId: string,
    lineId: string,
    dto: UpdatePostingRuleLineDto,
  ) {
    const rule = await this.findOne(user.tenantId, ruleId);
    await this.assertLineMutable(user.tenantId, rule);
    const line = rule.lines.find((candidate) => candidate.id === lineId);
    if (!line) throw new NotFoundException('Posting rule line not found');

    const merged: PostingRuleLineInputDto = {
      sequence: dto.sequence ?? line.sequence,
      direction: dto.direction ?? line.direction,
      glAccountId: dto.glAccountId ?? line.glAccountId,
      subledgerType:
        dto.subledgerType !== undefined
          ? dto.subledgerType
          : (line.subledgerType ?? undefined),
      subledgerExternalRefSource:
        dto.subledgerExternalRefSource !== undefined
          ? dto.subledgerExternalRefSource
          : (line.subledgerExternalRefSource ?? undefined),
      amountSource: dto.amountSource ?? line.amountSource,
      currencySource: dto.currencySource ?? line.currencySource,
      descriptionTemplate: dto.descriptionTemplate ?? line.descriptionTemplate,
    };
    await this.assertLines(user.tenantId, [merged]);

    try {
      return await this.prisma.postingRuleLine.update({
        where: {
          id_tenantId: { id: line.id, tenantId: user.tenantId },
        },
        data: {
          ...this.lineUpdateData(dto),
        },
        include: {
          glAccount: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Posting rule line sequence already exists');
    }
  }

  async deleteLine(user: RequestUser, ruleId: string, lineId: string) {
    const rule = await this.findOne(user.tenantId, ruleId);
    await this.assertLineMutable(user.tenantId, rule);
    const line = rule.lines.find((candidate) => candidate.id === lineId);
    if (!line) throw new NotFoundException('Posting rule line not found');

    await this.prisma.postingRuleLine.delete({
      where: {
        id_tenantId: { id: line.id, tenantId: user.tenantId },
      },
    });
    return { deleted: true, id: line.id };
  }

  private async assertLineMutable(
    tenantId: string,
    rule: Awaited<ReturnType<PostingRulesService['findOne']>>,
  ) {
    if (rule.active) {
      throw new ConflictException(
        'Deactivate the posting rule before changing its lines',
      );
    }
    if (await this.isUsed(tenantId, rule.id)) {
      throw new ConflictException(
        'Used posting rule lines are immutable; create a new rule version instead',
      );
    }
  }

  private async isUsed(tenantId: string, ruleId: string) {
    return (
      (await this.prisma.sourceEventInbox.count({
        where: { tenantId, postingRuleId: ruleId },
      })) > 0
    );
  }

  private async assertLines(
    tenantId: string,
    lines: PostingRuleLineInputDto[],
  ) {
    for (const line of lines) {
      if (
        Boolean(line.subledgerType) !== Boolean(line.subledgerExternalRefSource)
      ) {
        throw new BadRequestException(
          'subledgerType and subledgerExternalRefSource must be configured together',
        );
      }
    }

    const accountIds = [...new Set(lines.map((line) => line.glAccountId))];
    const accounts = await this.prisma.gLAccount.findMany({
      where: { tenantId, id: { in: accountIds } },
      include: { _count: { select: { childAccounts: true } } },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException(
        'Posting rule GL accounts must belong to this tenant',
      );
    }
    if (
      accounts.some(
        (account) =>
          account.status !== RecordStatus.ACTIVE ||
          !account.allowPosting ||
          account._count.childAccounts > 0,
      )
    ) {
      throw new BadRequestException(
        'Posting rules require active leaf posting-enabled GL accounts',
      );
    }
  }

  private assertActivatable(
    lines: Array<Pick<PostingRuleLineInputDto, 'direction'>>,
  ) {
    if (lines.length < 2) {
      throw new BadRequestException(
        'Active posting rules require at least two lines',
      );
    }
    const directions = new Set(lines.map((line) => line.direction));
    if (
      !directions.has(PostingDirection.DR) ||
      !directions.has(PostingDirection.CR)
    ) {
      throw new BadRequestException(
        'Active posting rules require both debit and credit lines',
      );
    }
  }

  private assertEffectiveDates(from: string, to?: string | null) {
    if (to && new Date(from) > new Date(to)) {
      throw new BadRequestException(
        'Posting rule effectiveTo must follow effectiveFrom',
      );
    }
  }

  private lineCreateData(
    line: PostingRuleLineInputDto,
  ): Prisma.PostingRuleLineUncheckedCreateWithoutPostingRuleInput {
    return {
      sequence: line.sequence,
      direction: line.direction,
      glAccountId: line.glAccountId,
      subledgerType: line.subledgerType,
      subledgerExternalRefSource:
        line.subledgerExternalRefSource?.trim() || null,
      amountSource: line.amountSource,
      currencySource: line.currencySource,
      descriptionTemplate: line.descriptionTemplate,
    };
  }

  private lineUpdateData(
    dto: UpdatePostingRuleLineDto,
  ): Prisma.PostingRuleLineUncheckedUpdateInput {
    return {
      ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
      ...(dto.direction !== undefined ? { direction: dto.direction } : {}),
      ...(dto.glAccountId !== undefined
        ? { glAccountId: dto.glAccountId }
        : {}),
      ...(dto.subledgerType !== undefined
        ? { subledgerType: dto.subledgerType }
        : {}),
      ...(dto.subledgerExternalRefSource !== undefined
        ? {
            subledgerExternalRefSource:
              dto.subledgerExternalRefSource.trim() || null,
          }
        : {}),
      ...(dto.amountSource !== undefined
        ? { amountSource: dto.amountSource }
        : {}),
      ...(dto.currencySource !== undefined
        ? { currencySource: dto.currencySource }
        : {}),
      ...(dto.descriptionTemplate !== undefined
        ? { descriptionTemplate: dto.descriptionTemplate }
        : {}),
    };
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
