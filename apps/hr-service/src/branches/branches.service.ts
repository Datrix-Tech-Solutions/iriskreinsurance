import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSingleHeadOffice(
    tenantId: string,
    isHeadOffice?: boolean,
    excludeBranchId?: string,
  ) {
    if (!isHeadOffice) return;

    const existingHeadOffice = await this.prisma.branch.findFirst({
      where: {
        tenantId,
        isActive: true,
        isHeadOffice: true,
        ...(excludeBranchId ? { id: { not: excludeBranchId } } : {}),
      },
      select: { id: true, name: true },
    });

    if (existingHeadOffice) {
      throw new ConflictException(
        `A head office already exists (${existingHeadOffice.name}). Remove that designation before assigning another head office.`,
      );
    }
  }

  async create(tenantId: string, dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException('A branch with this name already exists');

    await this.assertSingleHeadOffice(tenantId, dto.isHeadOffice);

    return this.prisma.branch.create({
      data: { tenantId, ...dto },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOptions(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            employmentStatus: true,
          },
        },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.assertSingleHeadOffice(tenantId, dto.isHeadOffice, id);

    return this.prisma.branch.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { employees: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch._count.employees > 0) {
      throw new ConflictException(
        'This branch has employees assigned to it and cannot be deleted. Reassign employees before deleting.',
      );
    }

    return this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
