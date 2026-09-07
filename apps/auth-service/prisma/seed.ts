import { PrismaClient } from '../prisma/generated/client';
import * as bcrypt from 'bcrypt';
import { seedResources } from './seed-resources';
import {
  backfillSystemPermissionState,
  seedDefaultPermissionTemplates,
  seedSystemPermissionSets,
  syncUserSystemPermissionSet,
} from '../src/permissions/system-permission-sets';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

// ── Platform seed — runs in all environments ───────────────────────────────

async function seedPlatform(
  _resources: Record<string, string>,
  options: { isProd: boolean },
) {
  console.log('\nCreating Datrix internal tenant...');
  const datrixTenant = await prisma.tenant.upsert({
    where: { slug: 'datrix-internal' },
    update: {},
    create: {
      name: 'Datrix Tech Solutions',
      slug: 'datrix-internal',
      email: 'internal@datrix.com',
      phone: '+233244000000',
      country: 'GH',
      status: 'ACTIVE',
      industry: 'Technology',
      size: '10-50',
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
    },
  });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars are required',
    );
  }

  const existingSuperAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: {
      id: true,
      email: true,
      tenantId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (options.isProd && existingSuperAdmins.length > 1) {
    throw new Error(
      [
        'Production seed aborted: multiple SUPER_ADMIN users already exist.',
        'Expected exactly one SUPER_ADMIN under the datrix-internal tenant.',
        'Please clean up duplicate super-admin accounts before rerunning the seed.',
        `Found: ${existingSuperAdmins.map((user) => `${user.email} (${user.tenantId})`).join(', ')}`,
      ].join(' '),
    );
  }

  const hashedSuperAdminPassword = await hash(superAdminPassword);
  const existingSuperAdmin = existingSuperAdmins[0];

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        tenantId: datrixTenant.id,
        email: superAdminEmail,
        password: hashedSuperAdminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        tenantId: datrixTenant.id,
        email: superAdminEmail,
        password: hashedSuperAdminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
  }

  console.log(`  SuperAdmin: ${superAdminEmail}`);

  const datrixSets = await seedSystemPermissionSets(prisma, datrixTenant.id);
  await seedDefaultPermissionTemplates(prisma, datrixTenant.id);
  await syncUserSystemPermissionSet(prisma, {
    tenantId: datrixTenant.id,
    userId: (
      await prisma.user.findUniqueOrThrow({
        where: {
          tenantId_email: {
            tenantId: datrixTenant.id,
            email: superAdminEmail,
          },
        },
        select: { id: true },
      })
    ).id,
    role: 'SUPER_ADMIN',
    grantedBy: 'seed-system',
    seededSetIds: datrixSets,
  });
}

// ── Demo seed — dev and staging only ──────────────────────────────────────

async function seedDemo(resources: Record<string, string>) {
  // ── ACME GHANA ─────────────────────────────────────────────────────────────
  console.log('\nCreating Acme Ghana Ltd...');
  const acmeTenant = await prisma.tenant.upsert({
    where: { slug: 'acme-ghana' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Acme Ghana Ltd',
      slug: 'acme-ghana',
      email: 'admin@acmeghana.com',
      phone: '+233302000001',
      country: 'GH',
      status: 'ACTIVE',
      industry: 'Manufacturing',
      size: '100-500',
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
    },
  });

  const acmeSets = await seedSystemPermissionSets(prisma, acmeTenant.id);
  await seedDefaultPermissionTemplates(prisma, acmeTenant.id);

  const acmeAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: acmeTenant.id, email: 'admin@acmeghana.com' },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'admin@acmeghana.com',
      password: await hash('Admin123!'),
      firstName: 'Abena',
      lastName: 'Mensah',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111001',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeAdmin.id,
    role: acmeAdmin.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  const acmeManager = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'hr.manager@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'hr.manager@acmeghana.com',
      password: await hash('Manager123!'),
      firstName: 'Kwame',
      lastName: 'Asante',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111002',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeManager.id,
    role: acmeManager.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  const acmeEmp1 = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'kofi.boateng@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'kofi.boateng@acmeghana.com',
      password: await hash('Employee123!'),
      firstName: 'Kofi',
      lastName: 'Boateng',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111003',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeEmp1.id,
    role: acmeEmp1.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  const acmeEmp2 = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'ama.owusu@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'ama.owusu@acmeghana.com',
      password: await hash('Employee123!'),
      firstName: 'Ama',
      lastName: 'Owusu',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111004',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeEmp2.id,
    role: acmeEmp2.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  const acmeAccountant = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'accountant@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'accountant@acmeghana.com',
      password: await hash('Accountant123!'),
      firstName: 'Yaw',
      lastName: 'Darko',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111005',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeAccountant.id,
    role: acmeAccountant.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  const acmeNewUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'newuser@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'newuser@acmeghana.com',
      password: await hash('TempPass123!'),
      firstName: 'New',
      lastName: 'User',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      forcePasswordReset: true,
      phone: '+233244111010',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeNewUser.id,
    role: acmeNewUser.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  const acmeMfaUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'mfa.user@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'mfa.user@acmeghana.com',
      password: await hash('MfaUser123!'),
      firstName: 'Mfa',
      lastName: 'User',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111011',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeMfaUser.id,
    role: acmeMfaUser.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  const acmeInvitedUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'invited@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'invited@acmeghana.com',
      firstName: 'Invited',
      lastName: 'Employee',
      role: 'EMPLOYEE',
      status: 'PENDING_VERIFICATION',
      forcePasswordReset: true,
      inviteToken: 'demo-invite-token-acme-ghana-2026',
      inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: acmeTenant.id,
    userId: acmeInvitedUser.id,
    role: acmeInvitedUser.role,
    grantedBy: acmeAdmin.id,
    seededSetIds: acmeSets,
  });

  console.log('  admin@acmeghana.com / Admin123! (TENANT_ADMIN)');
  console.log('  hr.manager@acmeghana.com / Manager123!');
  console.log('  kofi.boateng@acmeghana.com / Employee123!');
  console.log('  ama.owusu@acmeghana.com / Employee123!');
  console.log('  accountant@acmeghana.com / Accountant123!');
  console.log('  newuser@acmeghana.com / TempPass123! (force reset)');
  console.log('  mfa.user@acmeghana.com / MfaUser123!');

  // ── STELLAR TECH ───────────────────────────────────────────────────────────
  console.log('\nCreating Stellar Tech Ghana...');
  const stellarTenant = await prisma.tenant.upsert({
    where: { slug: 'stellar-tech' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Stellar Tech Ghana',
      slug: 'stellar-tech',
      email: 'admin@stellartech.com.gh',
      phone: '+233302000002',
      country: 'GH',
      status: 'ACTIVE',
      industry: 'Technology',
      size: '10-50',
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
    },
  });

  const stellarSets = await seedSystemPermissionSets(prisma, stellarTenant.id);
  await seedDefaultPermissionTemplates(prisma, stellarTenant.id);

  const stellarAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: stellarTenant.id,
        email: 'admin@stellartech.com.gh',
      },
    },
    update: {},
    create: {
      tenantId: stellarTenant.id,
      email: 'admin@stellartech.com.gh',
      password: await hash('Admin123!'),
      firstName: 'Efua',
      lastName: 'Amponsah',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222001',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: stellarTenant.id,
    userId: stellarAdmin.id,
    role: stellarAdmin.role,
    grantedBy: stellarAdmin.id,
    seededSetIds: stellarSets,
  });

  const stellarManager = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: stellarTenant.id,
        email: 'manager@stellartech.com.gh',
      },
    },
    update: {},
    create: {
      tenantId: stellarTenant.id,
      email: 'manager@stellartech.com.gh',
      password: await hash('Manager123!'),
      firstName: 'Nana',
      lastName: 'Osei',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222002',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: stellarTenant.id,
    userId: stellarManager.id,
    role: stellarManager.role,
    grantedBy: stellarAdmin.id,
    seededSetIds: stellarSets,
  });

  const stellarEmployee = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: stellarTenant.id,
        email: 'dev@stellartech.com.gh',
      },
    },
    update: {},
    create: {
      tenantId: stellarTenant.id,
      email: 'dev@stellartech.com.gh',
      password: await hash('Employee123!'),
      firstName: 'Adjoa',
      lastName: 'Boakye',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222003',
    },
  });
  await syncUserSystemPermissionSet(prisma, {
    tenantId: stellarTenant.id,
    userId: stellarEmployee.id,
    role: stellarEmployee.role,
    grantedBy: stellarAdmin.id,
    seededSetIds: stellarSets,
  });

  console.log('  admin@stellartech.com.gh / Admin123!');
  console.log('  manager@stellartech.com.gh / Manager123!');
  console.log('  dev@stellartech.com.gh / Employee123!');

  // ── GOLDEN HARVEST (PENDING) ───────────────────────────────────────────────
  console.log('\nCreating Golden Harvest Foods (pending)...');
  const pendingTenant = await prisma.tenant.upsert({
    where: { slug: 'golden-harvest' },
    update: {},
    create: {
      name: 'Golden Harvest Foods',
      slug: 'golden-harvest',
      email: 'admin@goldenharvestfoods.com',
      country: 'GH',
      status: 'PENDING',
      industry: 'Food & Beverage',
      size: '50-100',
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
    },
  });
  const pendingAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: pendingTenant.id,
        email: 'admin@goldenharvestfoods.com',
      },
    },
    update: {},
    create: {
      tenantId: pendingTenant.id,
      email: 'admin@goldenharvestfoods.com',
      password: await hash('Admin123!'),
      firstName: 'Kwabena',
      lastName: 'Frimpong',
      role: 'TENANT_ADMIN',
      status: 'PENDING_VERIFICATION',
    },
  });
  const pendingSets = await seedSystemPermissionSets(prisma, pendingTenant.id);
  await seedDefaultPermissionTemplates(prisma, pendingTenant.id);
  await syncUserSystemPermissionSet(prisma, {
    tenantId: pendingTenant.id,
    userId: pendingAdmin.id,
    role: pendingAdmin.role,
    grantedBy: pendingAdmin.id,
    seededSetIds: pendingSets,
  });
  console.log('  PENDING — approve via: PATCH /tenants/{id}/approve');

  // ── SUNRISE IMPORTS (SUSPENDED) ───────────────────────────────────────────
  console.log('\nCreating Sunrise Imports (suspended)...');
  const suspendedTenant = await prisma.tenant.upsert({
    where: { slug: 'sunrise-imports' },
    update: {},
    create: {
      name: 'Sunrise Imports Ltd',
      slug: 'sunrise-imports',
      email: 'admin@sunriseimports.com',
      country: 'GH',
      status: 'SUSPENDED',
      industry: 'Import/Export',
      size: '10-50',
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
    },
  });
  const suspendedAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: suspendedTenant.id,
        email: 'admin@sunriseimports.com',
      },
    },
    update: {},
    create: {
      tenantId: suspendedTenant.id,
      email: 'admin@sunriseimports.com',
      password: await hash('Admin123!'),
      firstName: 'Esi',
      lastName: 'Amoah',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  const suspendedSets = await seedSystemPermissionSets(
    prisma,
    suspendedTenant.id,
  );
  await seedDefaultPermissionTemplates(prisma, suspendedTenant.id);
  await syncUserSystemPermissionSet(prisma, {
    tenantId: suspendedTenant.id,
    userId: suspendedAdmin.id,
    role: suspendedAdmin.role,
    grantedBy: suspendedAdmin.id,
    seededSetIds: suspendedSets,
  });
  console.log('  SUSPENDED — login returns 403');
}

// ── Entry point ────────────────────────────────────────────────────────────

async function main() {
  const isProd = process.env.NODE_ENV === 'production';

  console.log('Starting seed...');
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}\n`);

  console.log('Seeding platform resources...');
  const resources = await seedResources();

  await seedPlatform(resources, { isProd });

  if (!isProd) {
    console.log('\nSeeding demo tenants (non-production)...');
    await seedDemo(resources);
  } else {
    console.log('\nProduction environment — skipping demo tenants.');
  }

  await backfillSystemPermissionState(prisma);

  console.log('\n' + '='.repeat(65));
  console.log(' SEED COMPLETE');
  console.log('='.repeat(65));
  console.log(`Resources:   ${Object.keys(resources).length}`);
  console.log(`SuperAdmin:  ${process.env.SUPER_ADMIN_EMAIL}`);
  if (!isProd) {
    console.log(
      'Demo tenants: acme-ghana, stellar-tech, golden-harvest, sunrise-imports',
    );
  }
  console.log('='.repeat(65));
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
