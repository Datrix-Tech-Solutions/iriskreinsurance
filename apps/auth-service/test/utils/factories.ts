import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UserRole, UserStatus } from '../../prisma/generated/client';

type TenantOverrides = {
  id?: string;
  slug?: string;
  name?: string;
  email?: string;
  country?: string;
  currency?: string;
};

type UserOverrides = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
};

export async function createTenant(
  prisma: PrismaService,
  overrides: TenantOverrides = {},
) {
  const id = overrides.id ?? randomUUID();
  const slug = overrides.slug ?? `tenant-${id}`;

  return prisma.tenant.create({
    data: {
      id,
      slug,
      name: overrides.name ?? 'Test Tenant',
      email: overrides.email ?? `${slug}@example.test`,
      country: overrides.country ?? 'GH',
      currency: overrides.currency ?? 'GHS',
    },
  });
}

export async function createUser(
  prisma: PrismaService,
  tenantId: string,
  overrides: UserOverrides = {},
) {
  const id = overrides.id ?? randomUUID();

  return prisma.user.create({
    data: {
      id,
      tenantId,
      email: overrides.email ?? `user-${id}@example.test`,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
      role: overrides.role ?? UserRole.EMPLOYEE,
      status: overrides.status ?? UserStatus.ACTIVE,
    },
  });
}
