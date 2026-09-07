import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  ReinsuranceChargeCalculationBasis,
  ReinsuranceChargeCode,
  ReinsuranceChargeConfiguration,
  ReinsuranceChargeDirection,
  ReinsuranceChargeRateType,
  ReinsuranceChargeRoundingMode,
  ReinsuranceChargeType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReinsuranceChargeConfigurationDto,
  PreviewReinsuranceChargeCalculationDto,
  QueryReinsuranceChargeConfigurationsDto,
  ReinsuranceChargeTemplateDto,
  UpdateReinsuranceChargeConfigurationDto,
} from './dto/reinsurance-charge-configuration.dto';

export type ChargeCalculationInput = {
  currency: string;
  grossAmount: number;
  commissionAmount?: number | null;
  brokerageAmount?: number | null;
  effectiveAt?: Date;
  /**
   * Whether the reinsurer receiving this premium is non-resident. NIC Levy and
   * Withholding Tax are foreign-cession levies — they only apply when premium
   * leaves the country to a non-resident reinsurer. When false (or omitted),
   * those two charge codes are excluded regardless of currency.
   */
  isForeignReinsurer?: boolean;
};

/**
 * Charge codes that only apply to cessions to non-resident reinsurers. Kept as a
 * code constant rather than per-configuration data because every code in the
 * enum today is a foreign-cession levy by definition; revisit if a
 * resident-applicable charge code is ever added.
 */
const FOREIGN_REINSURER_ONLY_CODES: ReadonlySet<ReinsuranceChargeCode> =
  new Set([
    ReinsuranceChargeCode.NIC_LEVY,
    ReinsuranceChargeCode.WITHHOLDING_TAX,
  ]);

export type AppliedChargeSnapshot = {
  configurationId: string;
  code: ReinsuranceChargeCode;
  name: string;
  chargeType: ReinsuranceChargeType;
  rateType: ReinsuranceChargeRateType;
  rate: string;
  calculationBasis: ReinsuranceChargeCalculationBasis;
  direction: ReinsuranceChargeDirection;
  currency: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  roundingMode: ReinsuranceChargeRoundingMode;
  decimalPlaces: number;
  basisAmount: number;
  amount: number;
};

export type ChargeCalculationResult = {
  currency: string;
  effectiveAt: string;
  grossAmount: number;
  commissionAmount: number;
  brokerageAmount: number;
  netBeforeCharges: number;
  additions: number;
  deductions: number;
  netAmount: number;
  charges: AppliedChargeSnapshot[];
};

type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ReinsuranceChargeSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  templates(): ReinsuranceChargeTemplateDto[] {
    return [
      {
        code: ReinsuranceChargeCode.NIC_LEVY,
        name: 'NIC Levy',
        chargeType: ReinsuranceChargeType.LEVY,
        rateType: ReinsuranceChargeRateType.PERCENTAGE,
        calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
        direction: ReinsuranceChargeDirection.DEDUCTION,
        description:
          'Template only. Configure the tenant-approved NIC levy rate before enabling.',
      },
      {
        code: ReinsuranceChargeCode.WITHHOLDING_TAX,
        name: 'Withholding Tax',
        chargeType: ReinsuranceChargeType.TAX,
        rateType: ReinsuranceChargeRateType.PERCENTAGE,
        calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
        direction: ReinsuranceChargeDirection.DEDUCTION,
        description:
          'Template only. Configure the tenant-approved withholding tax rate before enabling.',
      },
    ];
  }

  async findAll(
    tenantId: string,
    query: QueryReinsuranceChargeConfigurationsDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const effectiveAt = query.effectiveAt ? new Date(query.effectiveAt) : null;
    const where: Prisma.ReinsuranceChargeConfigurationWhereInput = {
      tenantId,
      ...(query.code ? { code: query.code } : {}),
      ...(query.currency !== undefined ? { currency: query.currency } : {}),
      ...(query.isEnabled !== undefined ? { isEnabled: query.isEnabled } : {}),
      ...(effectiveAt
        ? {
            effectiveFrom: { lte: effectiveAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.reinsuranceChargeConfiguration.findMany({
        where,
        orderBy: [
          { displayOrder: 'asc' },
          { code: 'asc' },
          { currency: 'asc' },
          { effectiveFrom: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.reinsuranceChargeConfiguration.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    tenantId: string,
    id: string,
    client: PrismaLike = this.prisma,
  ): Promise<ReinsuranceChargeConfiguration> {
    const config = await client.reinsuranceChargeConfiguration.findFirst({
      where: { id, tenantId },
    });
    if (!config) {
      throw new NotFoundException('Reinsurance charge configuration not found');
    }
    return config;
  }

  async create(
    user: RequestUser,
    dto: CreateReinsuranceChargeConfigurationDto,
  ): Promise<ReinsuranceChargeConfiguration> {
    const period = this.parsePeriod(dto.effectiveFrom, dto.effectiveTo);
    const currency = dto.currency ?? null;

    return this.prisma.$transaction(async (tx) => {
      await this.acquireConfigurationScopeLock(
        tx,
        user.tenantId,
        dto.code,
        currency,
      );
      await this.assertNoOverlap(tx, user.tenantId, dto.code, currency, period);

      return tx.reinsuranceChargeConfiguration.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          chargeType: dto.chargeType,
          rateType: dto.rateType,
          rate: dto.rate,
          calculationBasis: dto.calculationBasis,
          direction: dto.direction,
          currency,
          effectiveFrom: period.effectiveFrom,
          effectiveTo: period.effectiveTo,
          roundingMode:
            dto.roundingMode ?? ReinsuranceChargeRoundingMode.HALF_UP,
          decimalPlaces: dto.decimalPlaces ?? 2,
          isEnabled: dto.isEnabled ?? true,
          displayOrder: dto.displayOrder ?? 0,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    });
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateReinsuranceChargeConfigurationDto,
  ): Promise<ReinsuranceChargeConfiguration> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findOne(user.tenantId, id, tx);
      const effectiveFrom = dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : existing.effectiveFrom;
      const effectiveTo =
        dto.effectiveTo !== undefined
          ? dto.effectiveTo
            ? new Date(dto.effectiveTo)
            : null
          : existing.effectiveTo;
      this.assertValidPeriod(effectiveFrom, effectiveTo);

      const code = existing.code;
      const currency =
        dto.currency !== undefined ? (dto.currency ?? null) : existing.currency;
      await this.acquireConfigurationScopeLock(
        tx,
        user.tenantId,
        code,
        currency,
      );
      await this.assertNoOverlap(
        tx,
        user.tenantId,
        code,
        currency,
        { effectiveFrom, effectiveTo },
        id,
      );

      return tx.reinsuranceChargeConfiguration.update({
        where: { id_tenantId: { id, tenantId: user.tenantId } },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.chargeType !== undefined
            ? { chargeType: dto.chargeType }
            : {}),
          ...(dto.rateType !== undefined ? { rateType: dto.rateType } : {}),
          ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
          ...(dto.calculationBasis !== undefined
            ? { calculationBasis: dto.calculationBasis }
            : {}),
          ...(dto.direction !== undefined ? { direction: dto.direction } : {}),
          ...(dto.currency !== undefined ? { currency } : {}),
          ...(dto.effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
          ...(dto.roundingMode !== undefined
            ? { roundingMode: dto.roundingMode }
            : {}),
          ...(dto.decimalPlaces !== undefined
            ? { decimalPlaces: dto.decimalPlaces }
            : {}),
          ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          updatedByUserId: user.id,
        },
      });
    });
  }

  async activate(
    user: RequestUser,
    id: string,
  ): Promise<ReinsuranceChargeConfiguration> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findOne(user.tenantId, id, tx);
      await this.acquireConfigurationScopeLock(
        tx,
        user.tenantId,
        existing.code,
        existing.currency,
      );
      await this.assertNoOverlap(
        tx,
        user.tenantId,
        existing.code,
        existing.currency,
        {
          effectiveFrom: existing.effectiveFrom,
          effectiveTo: existing.effectiveTo,
        },
        id,
      );
      return tx.reinsuranceChargeConfiguration.update({
        where: { id_tenantId: { id, tenantId: user.tenantId } },
        data: { isEnabled: true, updatedByUserId: user.id },
      });
    });
  }

  async deactivate(
    user: RequestUser,
    id: string,
  ): Promise<ReinsuranceChargeConfiguration> {
    await this.findOne(user.tenantId, id);
    return this.prisma.reinsuranceChargeConfiguration.update({
      where: { id_tenantId: { id, tenantId: user.tenantId } },
      data: { isEnabled: false, updatedByUserId: user.id },
    });
  }

  async preview(
    tenantId: string,
    dto: PreviewReinsuranceChargeCalculationDto,
  ): Promise<ChargeCalculationResult> {
    return this.calculateCharges(tenantId, {
      currency: dto.currency,
      grossAmount: dto.grossAmount,
      commissionAmount: dto.commissionAmount ?? 0,
      brokerageAmount: dto.brokerageAmount ?? 0,
      effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : undefined,
      // Preview is a "what charges would apply" tool; default to showing the
      // foreign-cession levies unless the caller explicitly narrows to a
      // resident reinsurer.
      isForeignReinsurer: dto.isForeignReinsurer ?? true,
    });
  }

  async calculateCharges(
    tenantId: string,
    input: ChargeCalculationInput,
    client: PrismaLike = this.prisma,
  ): Promise<ChargeCalculationResult> {
    const effectiveAt = input.effectiveAt ?? new Date();
    const currency = input.currency.toUpperCase();
    const effectiveConfigs = await this.findEffectiveConfigurations(
      client,
      tenantId,
      currency,
      effectiveAt,
    );
    const configs = input.isForeignReinsurer
      ? effectiveConfigs
      : effectiveConfigs.filter(
          (config) => !FOREIGN_REINSURER_ONLY_CODES.has(config.code),
        );
    const grossAmount = this.round(input.grossAmount, 2);
    const commissionAmount = this.round(input.commissionAmount ?? 0, 2);
    const brokerageAmount = this.round(input.brokerageAmount ?? 0, 2);
    const netBeforeCharges = this.round(
      grossAmount - commissionAmount - brokerageAmount,
      2,
    );

    const charges = configs.map((config) => {
      const basisAmount = this.basisAmount(config.calculationBasis, {
        grossAmount,
        commissionAmount,
        brokerageAmount,
        netBeforeCharges,
      });
      const rawAmount =
        config.rateType === ReinsuranceChargeRateType.PERCENTAGE
          ? basisAmount * (this.toNumber(config.rate) / 100)
          : this.toNumber(config.rate);
      return {
        configurationId: config.id,
        code: config.code,
        name: config.name,
        chargeType: config.chargeType,
        rateType: config.rateType,
        rate: config.rate.toString(),
        calculationBasis: config.calculationBasis,
        direction: config.direction,
        currency: config.currency,
        effectiveFrom: config.effectiveFrom.toISOString(),
        effectiveTo: config.effectiveTo?.toISOString() ?? null,
        roundingMode: config.roundingMode,
        decimalPlaces: config.decimalPlaces,
        basisAmount,
        amount: this.round(
          rawAmount,
          config.decimalPlaces,
          config.roundingMode,
        ),
      };
    });

    const additions = this.round(
      charges
        .filter(
          (charge) => charge.direction === ReinsuranceChargeDirection.ADDITION,
        )
        .reduce((total, charge) => total + charge.amount, 0),
      2,
    );
    const deductions = this.round(
      charges
        .filter(
          (charge) => charge.direction === ReinsuranceChargeDirection.DEDUCTION,
        )
        .reduce((total, charge) => total + charge.amount, 0),
      2,
    );

    return {
      currency,
      effectiveAt: effectiveAt.toISOString(),
      grossAmount,
      commissionAmount,
      brokerageAmount,
      netBeforeCharges,
      additions,
      deductions,
      netAmount: this.round(netBeforeCharges + additions - deductions, 2),
      charges,
    };
  }

  private async findEffectiveConfigurations(
    client: PrismaLike,
    tenantId: string,
    currency: string,
    effectiveAt: Date,
  ): Promise<ReinsuranceChargeConfiguration[]> {
    const configs = await client.reinsuranceChargeConfiguration.findMany({
      where: {
        tenantId,
        isEnabled: true,
        effectiveFrom: { lte: effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }],
        AND: [{ OR: [{ currency }, { currency: null }] }],
      },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }, { currency: 'desc' }],
    });

    const byCode = new Map<
      ReinsuranceChargeCode,
      ReinsuranceChargeConfiguration
    >();
    for (const config of configs.filter((candidate) =>
      this.isConfigurationApplicable(candidate, currency, effectiveAt),
    )) {
      const existing = byCode.get(config.code);
      if (!existing || (!existing.currency && config.currency === currency)) {
        byCode.set(config.code, config);
      }
    }
    return [...byCode.values()].sort((left, right) => {
      if (left.displayOrder !== right.displayOrder) {
        return left.displayOrder - right.displayOrder;
      }
      return left.code.localeCompare(right.code);
    });
  }

  private async assertNoOverlap(
    client: PrismaLike,
    tenantId: string,
    code: ReinsuranceChargeCode,
    currency: string | null,
    period: { effectiveFrom: Date; effectiveTo: Date | null },
    excludeId?: string,
  ): Promise<void> {
    this.assertValidPeriod(period.effectiveFrom, period.effectiveTo);
    const where: Prisma.ReinsuranceChargeConfigurationWhereInput = {
      tenantId,
      code,
      currency,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(period.effectiveTo
        ? { effectiveFrom: { lte: period.effectiveTo } }
        : {}),
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: period.effectiveFrom } },
      ],
    };
    const overlap = await client.reinsuranceChargeConfiguration.findFirst({
      where,
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException(
        `A ${code} charge configuration already exists for this currency and effective period`,
      );
    }
  }

  private async acquireConfigurationScopeLock(
    client: Prisma.TransactionClient,
    tenantId: string,
    code: ReinsuranceChargeCode,
    currency: string | null,
  ): Promise<void> {
    const scope = `${tenantId}:${code}:${currency ?? 'ALL'}`;
    const [namespace, key] = this.advisoryLockKeys(scope);
    await client.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(${namespace}::integer, ${key}::integer)`,
    );
  }

  private advisoryLockKeys(scope: string): [number, number] {
    return [
      this.hashToSignedInt(`reinsurance-charge:${scope}`),
      this.hashToSignedInt(scope),
    ];
  }

  private hashToSignedInt(value: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash | 0;
  }

  private isConfigurationApplicable(
    config: ReinsuranceChargeConfiguration,
    currency: string,
    effectiveAt: Date,
  ): boolean {
    return (
      config.isEnabled &&
      config.effectiveFrom <= effectiveAt &&
      (!config.effectiveTo || config.effectiveTo >= effectiveAt) &&
      (config.currency === currency || config.currency === null)
    );
  }

  private parsePeriod(effectiveFrom: string, effectiveTo?: string | null) {
    const period = {
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
    };
    this.assertValidPeriod(period.effectiveFrom, period.effectiveTo);
    return period;
  }

  private assertValidPeriod(
    effectiveFrom: Date,
    effectiveTo: Date | null,
  ): void {
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom must be a valid date');
    }
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      throw new BadRequestException('effectiveTo must be a valid date');
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }
  }

  private basisAmount(
    basis: ReinsuranceChargeCalculationBasis,
    amounts: {
      grossAmount: number;
      commissionAmount: number;
      brokerageAmount: number;
      netBeforeCharges: number;
    },
  ): number {
    switch (basis) {
      case ReinsuranceChargeCalculationBasis.GROSS_AMOUNT:
        return amounts.grossAmount;
      case ReinsuranceChargeCalculationBasis.COMMISSION_AMOUNT:
        return amounts.commissionAmount;
      case ReinsuranceChargeCalculationBasis.BROKERAGE_AMOUNT:
        return amounts.brokerageAmount;
      case ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES:
      default:
        return amounts.netBeforeCharges;
    }
  }

  private round(
    value: number,
    decimalPlaces: number,
    mode: ReinsuranceChargeRoundingMode = ReinsuranceChargeRoundingMode.HALF_UP,
  ): number {
    const factor = 10 ** decimalPlaces;
    const scaled = value * factor;
    if (mode === ReinsuranceChargeRoundingMode.UP) {
      return Math.ceil(scaled) / factor;
    }
    if (mode === ReinsuranceChargeRoundingMode.DOWN) {
      return Math.floor(scaled) / factor;
    }
    return Math.round(scaled) / factor;
  }

  private toNumber(value: Prisma.Decimal | number | string): number {
    const parsed = typeof value === 'number' ? value : Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
