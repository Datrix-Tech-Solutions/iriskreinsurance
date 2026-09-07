import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Currency, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { QueryCurrenciesDto } from './dto/query-currencies.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrencySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryCurrenciesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CurrencyWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.currency.findMany({
        where,
        orderBy: [
          { isBaseCurrency: 'desc' },
          { displayOrder: 'asc' },
          { isoCode: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.currency.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string): Promise<Currency> {
    const currency = await this.prisma.currency.findFirst({
      where: { id, tenantId, archivedAt: null },
    });
    if (!currency) throw new NotFoundException('Currency not found');
    return currency;
  }

  async create(user: RequestUser, dto: CreateCurrencyDto): Promise<Currency> {
    const isBase = dto.isBaseCurrency ?? false;

    this.assertRateForNonBase(isBase, dto.exchangeRateToBase);

    if (isBase) {
      await this.assertNoExistingBaseCurrency(user.tenantId);
    }

    try {
      return await this.prisma.currency.create({
        data: {
          tenantId: user.tenantId,
          isoCode: dto.isoCode,
          name: dto.name,
          symbol: dto.symbol?.trim() || null,
          exchangeRateToBase: isBase ? 1 : dto.exchangeRateToBase,
          isBaseCurrency: isBase,
          isActive: dto.isActive ?? true,
          displayOrder: dto.displayOrder ?? 0,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Currency '${dto.isoCode}' already exists for this tenant`,
        );
      }
      throw error;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateCurrencyDto,
  ): Promise<Currency> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const existing = await this.findOne(user.tenantId, id);

    if (
      dto.isBaseCurrency !== undefined ||
      dto.exchangeRateToBase !== undefined
    ) {
      const effectiveIsBase = dto.isBaseCurrency ?? existing.isBaseCurrency;
      const effectiveRate =
        dto.exchangeRateToBase !== undefined
          ? dto.exchangeRateToBase
          : existing.exchangeRateToBase;
      this.assertRateForNonBase(effectiveIsBase, effectiveRate);
    }

    if (dto.isBaseCurrency === true && !existing.isBaseCurrency) {
      await this.demoteExistingBaseCurrency(user.tenantId, id);
    }

    const promotingToBase = dto.isBaseCurrency === true;

    return this.prisma.currency.update({
      where: {
        id_tenantId: { id, tenantId: user.tenantId },
        archivedAt: null,
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.symbol !== undefined
          ? { symbol: dto.symbol?.trim() || null }
          : {}),
        ...(dto.isBaseCurrency !== undefined
          ? {
              isBaseCurrency: dto.isBaseCurrency,
              exchangeRateToBase: promotingToBase
                ? 1
                : (dto.exchangeRateToBase ?? existing.exchangeRateToBase),
            }
          : dto.exchangeRateToBase !== undefined
            ? { exchangeRateToBase: dto.exchangeRateToBase }
            : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
        updatedByUserId: user.id,
      },
    });
  }

  async archive(user: RequestUser, id: string): Promise<Currency> {
    const currency = await this.findOne(user.tenantId, id);

    const activePlacementCount = await this.prisma.placement.count({
      where: {
        tenantId: user.tenantId,
        currency: currency.isoCode,
        archivedAt: null,
      },
    });

    if (activePlacementCount > 0) {
      throw new BadRequestException(
        `Cannot archive currency '${currency.isoCode}': ${activePlacementCount} active placement(s) reference it`,
      );
    }

    return this.prisma.currency.update({
      where: {
        id_tenantId: { id, tenantId: user.tenantId },
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        updatedByUserId: user.id,
      },
    });
  }

  private assertRateForNonBase(
    isBase: boolean,
    rate: number | Prisma.Decimal | null | undefined,
  ): void {
    if (!isBase && (rate === undefined || rate === null)) {
      throw new BadRequestException(
        'exchangeRateToBase is required for non-base currencies',
      );
    }
  }

  private async assertNoExistingBaseCurrency(tenantId: string): Promise<void> {
    const existing = await this.prisma.currency.findFirst({
      where: { tenantId, isBaseCurrency: true, archivedAt: null },
      select: { isoCode: true },
    });
    if (existing) {
      throw new ConflictException(
        `A base currency ('${existing.isoCode}') already exists for this tenant. Update the existing base currency to change the base.`,
      );
    }
  }

  private async demoteExistingBaseCurrency(
    tenantId: string,
    excludeId: string,
  ): Promise<void> {
    await this.prisma.currency.updateMany({
      where: {
        tenantId,
        isBaseCurrency: true,
        archivedAt: null,
        id: { not: excludeId },
      },
      data: { isBaseCurrency: false },
    });
  }
}
