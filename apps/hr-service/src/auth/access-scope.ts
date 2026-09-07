import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';

export const HR_PERMISSION_DENY_MESSAGE =
  "You don't have permission to access this. Contact your administrator.";

export function hasPermissionRule(user: RequestUser, rule: string): boolean {
  return (user.permissions ?? []).includes(rule);
}

export function isCompanyAdminUser(user: RequestUser): boolean {
  return user.role === 'TENANT_ADMIN';
}

export function isEmployeeSelfServiceUser(user: RequestUser): boolean {
  return user.role === 'EMPLOYEE';
}

export function assertHrAccess(condition: unknown): asserts condition {
  if (!condition) {
    throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
  }
}

export async function getActorEmployee(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
) {
  const employee = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { id: true, departmentId: true },
  });

  if (!employee) {
    throw new NotFoundException('Employee profile not found');
  }

  return employee;
}

export async function getManagedEmployeeIds(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
): Promise<Set<string>> {
  const actorEmployee = await getActorEmployee(prisma, tenantId, userId);
  const managedDepartments = await prisma.department.findMany({
    where: { tenantId, managerId: actorEmployee.id },
    select: { id: true },
  });

  const managedDepartmentIds = managedDepartments.map((dept) => dept.id);
  const teamMembers = await prisma.employee.findMany({
    where: {
      tenantId,
      OR: [
        { managerId: actorEmployee.id },
        ...(managedDepartmentIds.length > 0
          ? [{ departmentId: { in: managedDepartmentIds } }]
          : []),
      ],
    },
    select: { id: true },
  });

  return new Set(teamMembers.map((employee) => employee.id));
}
