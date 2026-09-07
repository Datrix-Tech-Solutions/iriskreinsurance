import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Asset,
  AssetCondition,
  AssetStatus,
  AssetType,
  EmploymentStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

const ASSET_NUMBER_PREFIX: Record<AssetType, string> = {
  [AssetType.LAPTOP]: 'LAP',
  [AssetType.PHONE]: 'PHN',
  [AssetType.TABLET]: 'TAB',
  [AssetType.PRINTER]: 'PRN',
  [AssetType.MONITOR]: 'MON',
  [AssetType.VEHICLE]: 'VEH',
  [AssetType.FURNITURE]: 'FUR',
  [AssetType.SOFTWARE_LICENSE]: 'LIC',
  [AssetType.OTHER]: 'AST',
};

type AssetWithAssignee = Asset & {
  assignedEmployee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeAsset(asset: AssetWithAssignee) {
    const assignedEmployeeName = asset.assignedEmployee
      ? `${asset.assignedEmployee.firstName} ${asset.assignedEmployee.lastName}`
      : undefined;

    return {
      ...asset,
      purchaseCost:
        asset.purchaseCost instanceof Prisma.Decimal
          ? asset.purchaseCost.toNumber()
          : asset.purchaseCost,
      assignedTo: asset.assignedEmployeeId ?? undefined,
      assignedEmployeeName,
    };
  }

  private normalizeCurrency(currency?: string) {
    return currency?.trim().toUpperCase() || 'GHS';
  }

  private mapCreateAssetData(
    dto: CreateAssetDto,
  ): Omit<Prisma.AssetUncheckedCreateInput, 'tenantId' | 'assetNumber'> {
    return {
      name: dto.name.trim(),
      type: dto.type,
      customType:
        dto.type === AssetType.OTHER ? dto.customType?.trim() || null : null,
      serialNumber: dto.serialNumber?.trim() || null,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      purchaseCost: dto.purchaseCost,
      currency: this.normalizeCurrency(dto.currency),
      condition: dto.condition ?? AssetCondition.GOOD,
      notes: dto.notes?.trim() || null,
      branchId: dto.branchId ?? null,
    };
  }

  private mapUpdateAssetData(
    dto: UpdateAssetDto,
  ): Prisma.AssetUncheckedUpdateInput {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.type !== undefined
        ? {
            type: dto.type,
            customType:
              dto.type === AssetType.OTHER
                ? dto.customType?.trim() || null
                : null,
          }
        : dto.customType !== undefined
          ? { customType: dto.customType?.trim() || null }
          : {}),
      ...(dto.serialNumber !== undefined
        ? { serialNumber: dto.serialNumber.trim() || null }
        : {}),
      ...(dto.purchaseDate !== undefined
        ? { purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null }
        : {}),
      ...(dto.purchaseCost !== undefined
        ? { purchaseCost: dto.purchaseCost }
        : {}),
      ...(dto.currency !== undefined
        ? { currency: this.normalizeCurrency(dto.currency) }
        : {}),
      ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId || null } : {}),
    };
  }

  private async generateAssetNumber(tenantId: string, type: AssetType) {
    const prefix = ASSET_NUMBER_PREFIX[type];
    let sequence =
      (await this.prisma.asset.count({
        where: { tenantId, type },
      })) + 1;

    for (;;) {
      const assetNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;
      const existing = await this.prisma.asset.findUnique({
        where: {
          tenantId_assetNumber: {
            tenantId,
            assetNumber,
          },
        },
        select: { id: true },
      });

      if (!existing) return assetNumber;
      sequence += 1;
    }
  }

  private async getAssetOrThrow(tenantId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId, isActive: true },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  private async assertAssetUpdatable(tenantId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId, isActive: true },
      select: {
        id: true,
        status: true,
        assignedEmployeeId: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async findAll(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, isActive: true },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return assets.map((asset) => this.serializeAsset(asset));
  }

  async findAvailable(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        isActive: true,
        status: AssetStatus.AVAILABLE,
      },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return assets.map((asset) => this.serializeAsset(asset));
  }

  async findById(tenantId: string, id: string) {
    const asset = await this.getAssetOrThrow(tenantId, id);
    return this.serializeAsset(asset);
  }

  private async assertBranchBelongsToTenant(
    tenantId: string,
    branchId: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  async create(tenantId: string, dto: CreateAssetDto) {
    if (dto.branchId) {
      await this.assertBranchBelongsToTenant(tenantId, dto.branchId);
    }

    const assetNumber = await this.generateAssetNumber(tenantId, dto.type);

    const asset = await this.prisma.asset.create({
      data: {
        tenantId,
        assetNumber,
        status: AssetStatus.AVAILABLE,
        ...this.mapCreateAssetData(dto),
      },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return this.serializeAsset(asset);
  }

  async update(tenantId: string, id: string, dto: UpdateAssetDto) {
    await this.assertAssetUpdatable(tenantId, id);

    if (dto.branchId) {
      await this.assertBranchBelongsToTenant(tenantId, dto.branchId);
    }

    const asset = await this.prisma.asset.update({
      where: { id },
      data: this.mapUpdateAssetData(dto),
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return this.serializeAsset(asset);
  }

  async assign(tenantId: string, id: string, employeeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({
        where: { id, tenantId, isActive: true },
        include: {
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }

      if (asset.status === AssetStatus.RETIRED) {
        throw new BadRequestException('Retired assets cannot be assigned');
      }

      if (asset.status === AssetStatus.MAINTENANCE) {
        throw new BadRequestException(
          'Assets in maintenance cannot be assigned',
        );
      }

      if (asset.assignedEmployeeId === employeeId) {
        throw new ConflictException(
          'This asset is already assigned to the selected employee',
        );
      }

      const employee = await tx.employee.findFirst({
        where: {
          id: employeeId,
          tenantId,
          employmentStatus: {
            in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
          },
        },
        select: { id: true },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const now = new Date();

      await tx.assetAssignment.updateMany({
        where: { assetId: asset.id, returnedAt: null },
        data: { returnedAt: now },
      });

      await tx.assetAssignment.create({
        data: {
          tenantId,
          assetId: asset.id,
          employeeId,
          assignedAt: now,
        },
      });

      const updated = await tx.asset.update({
        where: { id: asset.id },
        data: {
          assignedEmployeeId: employeeId,
          assignedAt: now,
          status: AssetStatus.ASSIGNED,
        },
        include: {
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return this.serializeAsset(updated);
    });
  }

  async unassign(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({
        where: { id, tenantId, isActive: true },
        select: {
          id: true,
          assignedEmployeeId: true,
          status: true,
        },
      });

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }

      if (!asset.assignedEmployeeId || asset.status !== AssetStatus.ASSIGNED) {
        throw new BadRequestException('This asset is not currently assigned');
      }

      const now = new Date();

      await tx.assetAssignment.updateMany({
        where: { assetId: asset.id, returnedAt: null },
        data: { returnedAt: now },
      });

      const updated = await tx.asset.update({
        where: { id: asset.id },
        data: {
          assignedEmployeeId: null,
          assignedAt: null,
          status: AssetStatus.AVAILABLE,
        },
        include: {
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return this.serializeAsset(updated);
    });
  }

  async retire(tenantId: string, id: string) {
    const asset = await this.assertAssetUpdatable(tenantId, id);

    if (asset.assignedEmployeeId) {
      throw new BadRequestException('Unassign this asset before retiring it');
    }

    if (asset.status === AssetStatus.RETIRED) {
      throw new ConflictException('This asset is already retired');
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        status: AssetStatus.RETIRED,
        assignedAt: null,
      },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return this.serializeAsset(updated);
  }

  async remove(tenantId: string, id: string) {
    const asset = await this.assertAssetUpdatable(tenantId, id);

    if (asset.assignedEmployeeId) {
      throw new BadRequestException('Unassign this asset before deleting it');
    }

    await this.prisma.asset.delete({ where: { id } });

    return { success: true };
  }
}
