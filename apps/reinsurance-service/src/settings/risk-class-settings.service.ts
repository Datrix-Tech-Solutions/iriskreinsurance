import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRiskClassDto } from './dto/create-risk-class.dto';
import { QueryRiskClassesDto } from './dto/query-risk-classes.dto';
import { UpdateRiskClassDto } from './dto/update-risk-class.dto';

const riskClassInclude = {
  riskTypes: {
    where: { archivedAt: null },
    include: {
      fields: {
        orderBy: [
          { displayOrder: 'asc' as const },
          { fieldKey: 'asc' as const },
        ],
      },
    },
    orderBy: [{ displayOrder: 'asc' as const }, { name: 'asc' as const }],
  },
} satisfies Prisma.RiskClassInclude;

type RiskClassRecord = Prisma.RiskClassGetPayload<{
  include: typeof riskClassInclude;
}>;

@Injectable()
export class RiskClassSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryRiskClassesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.RiskClassWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.riskClass.findMany({
        where,
        include: riskClassInclude,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.riskClass.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<RiskClassRecord> {
    const rc = await this.prisma.riskClass.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: riskClassInclude,
    });

    if (!rc) throw new NotFoundException('Risk class not found');
    return rc;
  }

  async create(
    user: RequestUser,
    dto: CreateRiskClassDto,
  ): Promise<RiskClassRecord> {
    try {
      return await this.prisma.riskClass.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
          displayOrder: dto.displayOrder ?? 0,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: riskClassInclude,
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateRiskClassDto,
  ): Promise<RiskClassRecord> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    await this.assertExists(user.tenantId, id);

    try {
      return await this.prisma.riskClass.update({
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
        include: riskClassInclude,
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async archive(user: RequestUser, id: string): Promise<RiskClassRecord> {
    const rc = await this.assertExists(user.tenantId, id);

    // Check if any active placements reference a RiskType under this RiskClass
    const riskTypeIds = rc.riskTypes.map((rt) => rt.id);
    if (riskTypeIds.length > 0) {
      const activePlacementCount = await this.prisma.placement.count({
        where: {
          tenantId: user.tenantId,
          riskTypeId: { in: riskTypeIds },
          archivedAt: null,
        },
      });

      if (activePlacementCount > 0) {
        throw new BadRequestException(
          `Cannot archive risk class '${rc.name}': ${activePlacementCount} active placement(s) reference it`,
        );
      }
    }

    return this.prisma.riskClass.update({
      where: {
        id_tenantId: { id, tenantId: user.tenantId },
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        updatedByUserId: user.id,
      },
      include: riskClassInclude,
    });
  }

  private async assertExists(
    tenantId: string,
    id: string,
  ): Promise<RiskClassRecord> {
    const rc = await this.prisma.riskClass.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: riskClassInclude,
    });
    if (!rc) throw new NotFoundException('Risk class not found');
    return rc;
  }

  private rethrowWriteError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A risk class with this name already exists for this tenant',
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Risk class not found');
    }
  }
}
