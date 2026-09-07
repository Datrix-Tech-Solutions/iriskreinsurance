import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException('A department with this name already exists');

    return this.prisma.department.create({
      data: { tenantId, ...dto },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOptions(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
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
        children: true,
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findById(tenantId, id);

    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.managerId, tenantId },
      });
      if (!manager) throw new NotFoundException('Manager not found');
    }

    if (dto.parentId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, tenantId, isActive: true },
      });
      if (!parent) throw new NotFoundException('Parent department not found');
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    const dept = await this.findById(tenantId, id);
    if (dept.employees.length > 0) {
      throw new ConflictException(
        'This department has employees assigned to it and cannot be deleted. Reassign employees before deleting.',
      );
    }
    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
