import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRiskTypeDto } from './dto/create-risk-type.dto';
import { CreateRiskTypeFieldDto } from './dto/create-risk-type-field.dto';
import { QueryRiskClassesDto } from './dto/query-risk-classes.dto';
import { UpdateRiskTypeDto } from './dto/update-risk-type.dto';
import { UpdateRiskTypeFieldDto } from './dto/update-risk-type-field.dto';

const fieldOrderBy = [
  { section: 'asc' as const },
  { displayOrder: 'asc' as const },
  { fieldKey: 'asc' as const },
];

const riskTypeInclude = {
  fields: { orderBy: fieldOrderBy },
} satisfies Prisma.RiskTypeInclude;

type RiskTypeRecord = Prisma.RiskTypeGetPayload<{
  include: typeof riskTypeInclude;
}>;

@Injectable()
export class RiskTypeSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryRiskClassesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.RiskTypeWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.riskType.findMany({
        where,
        include: riskTypeInclude,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.riskType.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string): Promise<RiskTypeRecord> {
    const rt = await this.prisma.riskType.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: riskTypeInclude,
    });

    if (!rt) throw new NotFoundException('Risk type not found');
    return rt;
  }

  async create(
    user: RequestUser,
    dto: CreateRiskTypeDto,
  ): Promise<RiskTypeRecord> {
    // FK existence check (CLAUDE.md pattern)
    const riskClass = await this.prisma.riskClass.findFirst({
      where: { id: dto.riskClassId, tenantId: user.tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!riskClass) throw new NotFoundException('Risk class not found');

    try {
      return await this.prisma.riskType.create({
        data: {
          tenantId: user.tenantId,
          riskClassId: dto.riskClassId,
          name: dto.name,
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
          displayOrder: dto.displayOrder ?? 0,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: riskTypeInclude,
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateRiskTypeDto,
  ): Promise<RiskTypeRecord> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    await this.assertExists(user.tenantId, id);

    try {
      return await this.prisma.riskType.update({
        where: {
          id_tenantId: { id, tenantId: user.tenantId },
          archivedAt: null,
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          updatedByUserId: user.id,
        },
        include: riskTypeInclude,
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async archive(user: RequestUser, id: string): Promise<RiskTypeRecord> {
    await this.assertExists(user.tenantId, id);

    const activePlacementCount = await this.prisma.placement.count({
      where: { tenantId: user.tenantId, riskTypeId: id, archivedAt: null },
    });

    if (activePlacementCount > 0) {
      throw new BadRequestException(
        `Cannot archive risk type: ${activePlacementCount} active placement(s) reference it`,
      );
    }

    return this.prisma.riskType.update({
      where: {
        id_tenantId: { id, tenantId: user.tenantId },
        archivedAt: null,
      },
      data: { archivedAt: new Date(), updatedByUserId: user.id },
      include: riskTypeInclude,
    });
  }

  async createField(
    user: RequestUser,
    riskTypeId: string,
    dto: CreateRiskTypeFieldDto,
  ) {
    await this.assertExists(user.tenantId, riskTypeId);
    this.assertSelectHasOptions(dto.fieldType, dto.options);

    try {
      return await this.prisma.riskTypeField.create({
        data: {
          tenantId: user.tenantId,
          riskTypeId,
          section: dto.section,
          fieldKey: dto.fieldKey,
          label: dto.label,
          fieldType: dto.fieldType,
          required: dto.required ?? false,
          options: dto.options
            ? (dto.options as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          validationRules: dto.validationRules
            ? (dto.validationRules as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          placeholder: dto.placeholder?.trim() || null,
          helpText: dto.helpText?.trim() || null,
          displayOrder: dto.displayOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Field key '${dto.fieldKey}' already exists in section ${dto.section} for this risk type`,
        );
      }
      throw error;
    }
  }

  async updateField(
    user: RequestUser,
    riskTypeId: string,
    fieldId: string,
    dto: UpdateRiskTypeFieldDto,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    await this.assertFieldExists(user.tenantId, riskTypeId, fieldId);

    if (
      dto.fieldType === RiskTypeFieldType.SELECT ||
      dto.options !== undefined
    ) {
      const current = await this.prisma.riskTypeField.findFirst({
        where: { id: fieldId, tenantId: user.tenantId, riskTypeId },
        select: { fieldType: true, options: true },
      });
      if (current) {
        const effectiveType = dto.fieldType ?? current.fieldType;
        const effectiveOptions =
          dto.options ?? (current.options as string[] | null);
        this.assertSelectHasOptions(
          effectiveType,
          effectiveOptions ?? undefined,
        );
      }
    }

    return this.prisma.riskTypeField.update({
      where: { id: fieldId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.fieldType !== undefined ? { fieldType: dto.fieldType } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.options !== undefined
          ? {
              options: dto.options
                ? (dto.options as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(dto.validationRules !== undefined
          ? {
              validationRules: dto.validationRules
                ? (dto.validationRules as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(dto.placeholder !== undefined
          ? { placeholder: dto.placeholder?.trim() || null }
          : {}),
        ...(dto.helpText !== undefined
          ? { helpText: dto.helpText?.trim() || null }
          : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteField(
    user: RequestUser,
    riskTypeId: string,
    fieldId: string,
  ): Promise<void> {
    await this.assertFieldExists(user.tenantId, riskTypeId, fieldId);
    await this.prisma.riskTypeField.delete({ where: { id: fieldId } });
  }

  async getFormSchema(tenantId: string, id: string) {
    const rt = await this.findOne(tenantId, id);
    const activeFields = rt.fields.filter((f) => f.isActive);

    return {
      id: rt.id,
      name: rt.name,
      description: rt.description,
      businessDetails: activeFields
        .filter((f) => f.section === RiskTypeFieldSection.BUSINESS_DETAILS)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((f) => this.toFormSchemaField(f)),
      offerDetails: activeFields
        .filter((f) => f.section === RiskTypeFieldSection.OFFER_DETAILS)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((f) => this.toFormSchemaField(f)),
    };
  }

  private toFormSchemaField(field: RiskTypeRecord['fields'][number]) {
    return {
      fieldKey: field.fieldKey,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      options: (field.options as string[] | null) ?? null,
      validationRules:
        (field.validationRules as Record<string, unknown> | null) ?? null,
      placeholder: field.placeholder,
      helpText: field.helpText,
      displayOrder: field.displayOrder,
    };
  }

  private async assertExists(
    tenantId: string,
    id: string,
  ): Promise<RiskTypeRecord> {
    const rt = await this.prisma.riskType.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: riskTypeInclude,
    });
    if (!rt) throw new NotFoundException('Risk type not found');
    return rt;
  }

  private async assertFieldExists(
    tenantId: string,
    riskTypeId: string,
    fieldId: string,
  ) {
    const field = await this.prisma.riskTypeField.findFirst({
      where: { id: fieldId, tenantId, riskTypeId },
    });
    if (!field) throw new NotFoundException('Risk type field not found');
    return field;
  }

  private assertSelectHasOptions(
    fieldType: RiskTypeFieldType,
    options?: string[],
  ): void {
    if (
      fieldType === RiskTypeFieldType.SELECT &&
      (!options || options.length === 0)
    ) {
      throw new BadRequestException(
        'SELECT fields must define at least one option',
      );
    }
  }

  private rethrowWriteError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A risk type with this name already exists for this class',
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Risk type not found');
    }
  }
}
