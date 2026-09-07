import { PrismaClient, PermissionAction } from '../../prisma/generated/client';
import { RESOURCES } from './resource-definitions';

type LoggerLike = {
  log(message: string): void;
  warn?(message: string): void;
};

type PermissionResourceMap = Record<string, PermissionAction[]>;
type SystemPermissionSetName = string;

type SystemPermissionSetDefinition = {
  name: SystemPermissionSetName;
  permissions: PermissionResourceMap;
};

type DefaultPermissionTemplateName = string;

type DefaultPermissionTemplateDefinition = {
  name: DefaultPermissionTemplateName;
  description: string;
  permissions: PermissionResourceMap;
};

const ACTIVE_SYSTEM_PERMISSION_SET_NAMES = new Set<SystemPermissionSetName>();
const BASIC_EMPLOYEE_TEMPLATE_NAME = 'Employee';
const BASIC_EMPLOYEE_LEGACY_NAME = 'Basic Employee';
const DEFAULT_PERMISSION_TEMPLATE_DEFINITIONS: readonly DefaultPermissionTemplateDefinition[] =
  [
    {
      name: BASIC_EMPLOYEE_TEMPLATE_NAME,
      description:
        'Starter baseline for employee self-service access after invite acceptance.',
      permissions: {
        employees: [PermissionAction.VIEW],
        'employee-profile': [PermissionAction.VIEW],
        'leave-self': [PermissionAction.VIEW, PermissionAction.CREATE],
        attendance: [PermissionAction.CREATE],
        'time-corrections': [PermissionAction.CREATE],
        'payslip-self': [PermissionAction.VIEW],
        'self-appraisals': [PermissionAction.VIEW, PermissionAction.EDIT],
        resignations: [PermissionAction.CREATE, PermissionAction.DELETE],
        announcements: [PermissionAction.VIEW],
        schedules: [PermissionAction.VIEW],
      },
    },
    {
      name: 'Manager',
      description:
        'Starter template for line managers who approve people workflows without full HR administration.',
      permissions: {
        'employee-profile': [PermissionAction.VIEW],
        'leave-self': [PermissionAction.VIEW, PermissionAction.CREATE],
        attendance: [PermissionAction.CREATE, PermissionAction.VIEW],
        'time-corrections': [PermissionAction.CREATE, PermissionAction.APPROVE],
        'payslip-self': [PermissionAction.VIEW],
        'self-appraisals': [PermissionAction.VIEW, PermissionAction.EDIT],
        resignations: [PermissionAction.CREATE, PermissionAction.DELETE],
        announcements: [PermissionAction.VIEW],
        employees: [PermissionAction.VIEW],
        leave: [PermissionAction.VIEW, PermissionAction.APPROVE],
        timesheets: [PermissionAction.VIEW, PermissionAction.APPROVE],
        schedules: [PermissionAction.APPROVE],
        appraisals: [PermissionAction.VIEW],
        'appraisal-reviews': [PermissionAction.EDIT],
        assets: [PermissionAction.VIEW],
        projects: [PermissionAction.VIEW],
        'project-tasks': [PermissionAction.VIEW, PermissionAction.EDIT],
      },
    },
    {
      name: 'CEO',
      description:
        'Editable high-access template for executive users who should operate near tenant-admin capability while remaining employee-role users.',
      permissions: {
        users: [
          PermissionAction.CREATE,
          PermissionAction.VIEW,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
        ],
        'user-security': [PermissionAction.EDIT],
        'permission-sets': [PermissionAction.VIEW, PermissionAction.ASSIGN],
        'audit-logs': [PermissionAction.VIEW],
        employees: [
          PermissionAction.CREATE,
          PermissionAction.VIEW,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
          PermissionAction.EXPORT,
        ],
        'employee-profile': [PermissionAction.VIEW],
        offboarding: [PermissionAction.EDIT],
        resignations: [PermissionAction.CREATE, PermissionAction.DELETE],
        documents: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
        ],
        departments: [
          PermissionAction.CREATE,
          PermissionAction.VIEW,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
        ],
        branches: [
          PermissionAction.CREATE,
          PermissionAction.VIEW,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
        ],
        'hr-settings': [PermissionAction.VIEW, PermissionAction.EDIT],
        leave: [PermissionAction.VIEW, PermissionAction.APPROVE],
        'leave-self': [PermissionAction.VIEW, PermissionAction.CREATE],
        'leave-settings': [PermissionAction.EDIT],
        attendance: [PermissionAction.CREATE, PermissionAction.VIEW],
        'time-corrections': [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.APPROVE,
        ],
        timesheets: [PermissionAction.VIEW, PermissionAction.APPROVE],
        schedules: [PermissionAction.EDIT, PermissionAction.APPROVE],
        payroll: [
          PermissionAction.VIEW,
          PermissionAction.EDIT,
          PermissionAction.RUN,
          PermissionAction.APPROVE,
        ],
        'payslip-self': [PermissionAction.VIEW],
        appraisals: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.APPROVE,
        ],
        'appraisal-settings': [PermissionAction.EDIT],
        'self-appraisals': [PermissionAction.VIEW, PermissionAction.EDIT],
        'appraisal-reviews': [PermissionAction.EDIT],
        assets: [
          PermissionAction.VIEW,
          PermissionAction.EDIT,
          PermissionAction.ASSIGN,
        ],
        projects: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
          PermissionAction.ASSIGN,
        ],
        'project-tasks': [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
          PermissionAction.ASSIGN,
        ],
        announcements: [PermissionAction.VIEW, PermissionAction.EDIT],
      },
    },
  ] as const;

type SyncUserSystemPermissionSetParams = {
  tenantId: string;
  userId: string;
  role: string;
  grantedBy: string;
  seededSetIds?: Record<string, string>;
};
const SYSTEM_PERMISSION_SET_DEFINITIONS: readonly SystemPermissionSetDefinition[] =
  [] as const;

type AuthPrisma = Pick<
  PrismaClient,
  | 'resource'
  | 'tenant'
  | 'permissionSet'
  | 'permissionSetResource'
  | 'user'
  | 'userPermissionSet'
>;

function getLogger(logger?: LoggerLike) {
  return {
    log: logger?.log?.bind(logger) ?? (() => undefined),
    warn: logger?.warn?.bind(logger) ?? (() => undefined),
  };
}

async function buildLegacyPermissionSetName(
  prisma: AuthPrisma,
  tenantId: string,
  currentName: string,
): Promise<string> {
  const preferredName = `Legacy ${currentName}`;
  let candidateName = preferredName;
  let suffix = new Date().getFullYear();

  while (
    await prisma.permissionSet.findUnique({
      where: { tenantId_name: { tenantId, name: candidateName } },
      select: { id: true },
    })
  ) {
    candidateName = `${preferredName} (${suffix})`;
    suffix += 1;
  }

  return candidateName;
}

async function reconcileLegacySystemPermissionSets(
  prisma: AuthPrisma,
  tenantId: string,
  logger?: LoggerLike,
) {
  const log = getLogger(logger);
  const legacySets = await prisma.permissionSet.findMany({
    where: {
      tenantId,
      isSystem: true,
      name: {
        notIn: Array.from(ACTIVE_SYSTEM_PERMISSION_SET_NAMES),
      },
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      description: true,
      _count: { select: { users: true } },
    },
  });

  for (const set of legacySets) {
    if (set.name === 'Company Admin Set') {
      await prisma.permissionSet.update({
        where: { id: set.id },
        data: {
          isSystem: false,
          isActive: false,
          description:
            set.description ??
            'Retired legacy company admin system permission set from a pre-migration RBAC model.',
        },
      });
      log.warn(
        `Retired legacy Company Admin Set for tenant ${tenantId}; ${set._count.users} user assignment(s) will be removed during system permission sync.`,
      );
      continue;
    }

    if (set._count.users === 0) {
      await prisma.permissionSet.update({
        where: { id: set.id },
        data: {
          isSystem: false,
          isActive: false,
          description:
            set.description ??
            'Auto-deactivated legacy system permission set from a pre-migration RBAC model.',
        },
      });
      log.warn(
        `Deactivated legacy system permission set "${set.name}" for tenant ${tenantId} because it has no assigned users.`,
      );
      continue;
    }

    const legacyName =
      set.name.startsWith('Legacy ') || set.name.endsWith('(Legacy)')
        ? set.name
        : await buildLegacyPermissionSetName(prisma, tenantId, set.name);

    await prisma.permissionSet.update({
      where: { id: set.id },
      data: {
        name: legacyName,
        isSystem: false,
        description:
          set.description ??
          'Legacy permission set preserved during RBAC system-set migration.',
      },
    });
    log.warn(
      `Converted legacy system permission set "${set.name}" to custom set "${legacyName}" for tenant ${tenantId}; ${set._count.users} user(s) remain assigned.`,
    );
  }
}

export async function ensurePermissionResources(
  prisma: AuthPrisma,
): Promise<Record<string, string>> {
  const resourceIds: Record<string, string> = {};

  for (const resource of RESOURCES) {
    const created = await prisma.resource.upsert({
      where: { name: resource.name },
      update: { module: resource.module, description: resource.description },
      create: {
        name: resource.name,
        module: resource.module,
        description: resource.description,
      },
      select: { id: true, name: true },
    });
    resourceIds[created.name] = created.id;
  }

  return resourceIds;
}

export async function seedSystemPermissionSets(
  prisma: AuthPrisma,
  tenantId: string,
  logger?: LoggerLike,
): Promise<Record<string, string>> {
  const log = getLogger(logger);
  const resources = await ensurePermissionResources(prisma);
  const seeded: Record<string, string> = {};

  for (const set of SYSTEM_PERMISSION_SET_DEFINITIONS) {
    const entries: { resourceId: string; action: PermissionAction }[] = [];

    for (const [resourceName, actions] of Object.entries(set.permissions)) {
      const resourceId = resources[resourceName];
      if (!resourceId) {
        throw new Error(
          `Resource "${resourceName}" is not seeded but is required by ${set.name}`,
        );
      }

      for (const action of actions) {
        entries.push({ resourceId, action });
      }
    }

    const existing = await prisma.permissionSet.findUnique({
      where: { tenantId_name: { tenantId, name: set.name } },
      select: { id: true },
    });

    if (existing) {
      await prisma.permissionSet.update({
        where: { id: existing.id },
        data: { isSystem: true, isActive: true },
      });
      await prisma.permissionSetResource.deleteMany({
        where: { permissionSetId: existing.id },
      });
      await prisma.permissionSetResource.createMany({
        data: entries.map((entry) => ({
          permissionSetId: existing.id,
          resourceId: entry.resourceId,
          action: entry.action,
        })),
        skipDuplicates: true,
      });
      seeded[set.name] = existing.id;
      continue;
    }

    const created = await prisma.permissionSet.create({
      data: {
        tenantId,
        name: set.name,
        isSystem: true,
        resources: {
          create: entries.map((entry) => ({
            resourceId: entry.resourceId,
            action: entry.action,
          })),
        },
      },
      select: { id: true },
    });
    seeded[set.name] = created.id;
  }

  log.log(
    `Ensured system permission sets for tenant ${tenantId}: ${Object.keys(seeded).join(', ')}`,
  );

  return seeded;
}

export async function seedDefaultPermissionTemplates(
  prisma: AuthPrisma,
  tenantId: string,
  logger?: LoggerLike,
): Promise<Record<string, string>> {
  const log = getLogger(logger);
  const resources = await ensurePermissionResources(prisma);
  const seeded: Record<string, string> = {};

  // Migrate "Basic Employee" → "Employee" if the old name still exists
  const legacyBasicEmployee = await prisma.permissionSet.findUnique({
    where: { tenantId_name: { tenantId, name: BASIC_EMPLOYEE_LEGACY_NAME } },
    select: {
      id: true,
      isActive: true,
      description: true,
      _count: { select: { users: true } },
    },
  });
  if (legacyBasicEmployee) {
    const currentEmployee = await prisma.permissionSet.findUnique({
      where: {
        tenantId_name: { tenantId, name: BASIC_EMPLOYEE_TEMPLATE_NAME },
      },
      select: { id: true },
    });

    if (!currentEmployee) {
      await prisma.permissionSet.update({
        where: { id: legacyBasicEmployee.id },
        data: { name: BASIC_EMPLOYEE_TEMPLATE_NAME },
      });
      log.log(`Renamed "Basic Employee" → "Employee" for tenant ${tenantId}`);
    } else if (currentEmployee.id !== legacyBasicEmployee.id) {
      const legacyName = await buildLegacyPermissionSetName(
        prisma,
        tenantId,
        BASIC_EMPLOYEE_LEGACY_NAME,
      );
      await prisma.permissionSet.update({
        where: { id: legacyBasicEmployee.id },
        data: {
          name: legacyName,
          isSystem: false,
          isActive:
            legacyBasicEmployee._count.users > 0
              ? legacyBasicEmployee.isActive
              : false,
          description:
            legacyBasicEmployee.description ??
            'Legacy Basic Employee permission template preserved during Employee template migration.',
        },
      });
      log.warn(
        `Preserved conflicting "Basic Employee" template as "${legacyName}" for tenant ${tenantId}; canonical "Employee" already exists.`,
      );
    }
  }

  for (const template of DEFAULT_PERMISSION_TEMPLATE_DEFINITIONS) {
    const entries: { resourceId: string; action: PermissionAction }[] = [];

    for (const [resourceName, actions] of Object.entries(
      template.permissions,
    )) {
      const resourceId = resources[resourceName];
      if (!resourceId) {
        throw new Error(
          `Resource "${resourceName}" is not seeded but is required by ${template.name}`,
        );
      }

      for (const action of actions) {
        entries.push({ resourceId, action });
      }
    }

    const existing = await prisma.permissionSet.findUnique({
      where: { tenantId_name: { tenantId, name: template.name } },
      select: { id: true, isSystem: true, isActive: true },
    });

    if (existing) {
      // Always sync name, description, and active state
      await prisma.permissionSet.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          isSystem: false,
          description: template.description,
        },
      });

      // Sync permissions: add any missing resource:action pairs
      const existingResources = await prisma.permissionSetResource.findMany({
        where: { permissionSetId: existing.id },
        select: { resourceId: true, action: true },
      });
      const existingKeys = new Set(
        existingResources.map((r) => `${r.resourceId}:${r.action}`),
      );
      const missing = entries.filter(
        (e) => !existingKeys.has(`${e.resourceId}:${e.action}`),
      );
      if (missing.length > 0) {
        await prisma.permissionSetResource.createMany({
          data: missing.map((entry) => ({
            permissionSetId: existing.id,
            resourceId: entry.resourceId,
            action: entry.action,
          })),
          skipDuplicates: true,
        });
        log.log(
          `Added ${missing.length} missing permission(s) to "${template.name}" for tenant ${tenantId}`,
        );
      }

      seeded[template.name] = existing.id;
      continue;
    }

    const created = await prisma.permissionSet.create({
      data: {
        tenantId,
        name: template.name,
        description: template.description,
        isSystem: false,
        resources: {
          create: entries.map((entry) => ({
            resourceId: entry.resourceId,
            action: entry.action,
          })),
        },
      },
      select: { id: true },
    });
    seeded[template.name] = created.id;
  }

  log.log(
    `Ensured editable permission templates for tenant ${tenantId}: ${Object.keys(seeded).join(', ')}`,
  );

  return seeded;
}

export function resolveSystemPermissionSetName(
  role: string,
): SystemPermissionSetName | null {
  void role;
  return null;
}

export async function syncUserSystemPermissionSet(
  prisma: AuthPrisma,
  params: SyncUserSystemPermissionSetParams,
  logger?: LoggerLike,
): Promise<SystemPermissionSetName | null> {
  const log = getLogger(logger);
  const targetSetName = resolveSystemPermissionSetName(params.role);

  const seededSetIds =
    params.seededSetIds ??
    (await seedSystemPermissionSets(prisma, params.tenantId, logger));

  if (!targetSetName) {
    await prisma.userPermissionSet.deleteMany({
      where: {
        userId: params.userId,
        permissionSetId: {
          in: Object.values(seededSetIds),
        },
      },
    });
    await prisma.userPermissionSet.deleteMany({
      where: {
        userId: params.userId,
        permissionSet: {
          tenantId: params.tenantId,
          isActive: false,
        },
      },
    });
    return null;
  }
  const targetSetId = seededSetIds[targetSetName];

  await prisma.userPermissionSet.deleteMany({
    where: {
      userId: params.userId,
      permissionSetId: {
        in: Object.values(seededSetIds).filter((id) => id !== targetSetId),
      },
    },
  });

  await prisma.userPermissionSet.upsert({
    where: {
      userId_permissionSetId: {
        userId: params.userId,
        permissionSetId: targetSetId,
      },
    },
    update: { grantedBy: params.grantedBy, grantedAt: new Date() },
    create: {
      userId: params.userId,
      permissionSetId: targetSetId,
      grantedBy: params.grantedBy,
    },
  });

  log.log(
    `Synced ${targetSetName} for user ${params.userId} in tenant ${params.tenantId}`,
  );

  return targetSetName;
}

export async function backfillSystemPermissionState(
  prisma: AuthPrisma,
  logger?: LoggerLike,
) {
  const log = getLogger(logger);
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let usersProcessed = 0;

  for (const tenant of tenants) {
    const seededSetIds = await seedSystemPermissionSets(
      prisma,
      tenant.id,
      logger,
    );
    await seedDefaultPermissionTemplates(prisma, tenant.id, logger);
    await reconcileLegacySystemPermissionSets(prisma, tenant.id, logger);
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, role: true },
    });

    for (const user of users) {
      await syncUserSystemPermissionSet(
        prisma,
        {
          tenantId: tenant.id,
          userId: user.id,
          role: user.role,
          grantedBy: 'system-backfill',
          seededSetIds,
        },
        logger,
      );
      usersProcessed += 1;
    }
  }

  log.log(
    `System permission state backfill complete for ${tenants.length} tenant(s) and ${usersProcessed} user(s)`,
  );
}
