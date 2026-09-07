import { PermissionAction } from '../../prisma/generated/client';
import { seedDefaultPermissionTemplates } from './system-permission-sets';

type MockFn = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

function makePrisma() {
  const resources = new Map<string, string>();
  const permissionSets = new Map<
    string,
    {
      id: string;
      tenantId: string;
      name: string;
      description: string | null;
      isSystem: boolean;
      isActive: boolean;
      userCount: number;
    }
  >();

  return {
    resource: {
      upsert: jest.fn(async ({ where, update, create, select }) => {
        const name = where.name as string;
        const id = resources.get(name) ?? `resource-${resources.size + 1}`;
        resources.set(name, id);
        void update;
        void create;
        void select;
        return { id, name };
      }) as MockFn,
    },
    permissionSet: {
      findUnique: jest.fn(async ({ where }) => {
        const key = `${where.tenantId_name.tenantId}:${where.tenantId_name.name}`;
        const set = permissionSets.get(key);
        if (!set) return null;
        return {
          id: set.id,
          isSystem: set.isSystem,
          isActive: set.isActive,
          description: set.description,
          _count: { users: set.userCount },
        };
      }) as MockFn,
      update: jest.fn(async ({ where, data }) => {
        const current = Array.from(permissionSets.values()).find(
          (set) => set.id === where.id,
        );
        if (!current) throw new Error(`Missing permission set ${where.id}`);
        permissionSets.delete(`${current.tenantId}:${current.name}`);
        Object.assign(current, data);
        permissionSets.set(`${current.tenantId}:${current.name}`, current);
        return current;
      }) as MockFn,
      create: jest.fn(async ({ data }) => {
        const id = `permission-set-${permissionSets.size + 1}`;
        const set = {
          id,
          tenantId: data.tenantId as string,
          name: data.name as string,
          description: (data.description as string | undefined) ?? null,
          isSystem: (data.isSystem as boolean | undefined) ?? false,
          isActive: true,
          userCount: 0,
        };
        permissionSets.set(`${set.tenantId}:${set.name}`, set);
        return { id };
      }) as MockFn,
    },
    permissionSetResource: {
      findMany: jest.fn().mockResolvedValue([]) as MockFn,
      createMany: jest.fn().mockResolvedValue({ count: 0 }) as MockFn,
    },
    __permissionSets: permissionSets,
  };
}

describe('seedDefaultPermissionTemplates', () => {
  it('preserves legacy Basic Employee when Employee already exists', async () => {
    const prisma = makePrisma();
    prisma.__permissionSets.set('tenant-1:Basic Employee', {
      id: 'legacy-basic',
      tenantId: 'tenant-1',
      name: 'Basic Employee',
      description: null,
      isSystem: false,
      isActive: true,
      userCount: 1,
    });
    prisma.__permissionSets.set('tenant-1:Employee', {
      id: 'employee',
      tenantId: 'tenant-1',
      name: 'Employee',
      description: 'Current employee template',
      isSystem: false,
      isActive: true,
      userCount: 0,
    });

    await seedDefaultPermissionTemplates(prisma as never, 'tenant-1');

    expect(prisma.__permissionSets.has('tenant-1:Basic Employee')).toBe(false);
    expect(prisma.__permissionSets.has('tenant-1:Employee')).toBe(true);
    expect(
      prisma.__permissionSets.get('tenant-1:Legacy Basic Employee'),
    ).toEqual(
      expect.objectContaining({
        id: 'legacy-basic',
        isActive: true,
        description:
          'Legacy Basic Employee permission template preserved during Employee template migration.',
      }),
    );
    expect(prisma.permissionSet.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'legacy-basic' },
        data: { name: 'Employee' },
      }),
    );
    expect(prisma.permissionSetResource.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ action: PermissionAction.VIEW }),
        ]),
        skipDuplicates: true,
      }),
    );
  });
});
