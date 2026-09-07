import process from 'process';
import { PrismaClient } from '../prisma/generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== HR SERVICE SEED ===\n');

  // Look up auth tenant/user IDs so HR records link correctly
  // We query the same postgres DB using raw SQL via a second Prisma instance
  // (auth schema is a separate schema in the same DB)
  const authPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL!.replace('schema=hr', 'schema=w_auth'),
      },
    },
  });

  const acmeTenant: any[] = await (authPrisma as any).$queryRawUnsafe(
    `SELECT id, name FROM w_auth."Tenant" WHERE slug = 'acme-ghana' LIMIT 1`,
  );

  const stellarTenant: any[] = await (authPrisma as any).$queryRawUnsafe(
    `SELECT id, name FROM w_auth."Tenant" WHERE slug = 'stellar-tech' LIMIT 1`,
  );

  if (!acmeTenant.length || !stellarTenant.length) {
    console.log('Auth tenants not found — run auth-service seed first.');
    return;
  }

  const acmeId: string = acmeTenant[0].id;
  const stellarId: string = stellarTenant[0].id;

  const acmeUsers: any[] = await (authPrisma as any).$queryRawUnsafe(
    `SELECT id, email, "firstName", "lastName" FROM w_auth."User"
     WHERE "tenantId" = '${acmeId}' AND role = 'EMPLOYEE'`,
  );

  const stellarUsers: any[] = await (authPrisma as any).$queryRawUnsafe(
    `SELECT id, email, "firstName", "lastName" FROM w_auth."User"
     WHERE "tenantId" = '${stellarId}' AND role = 'EMPLOYEE'`,
  );

  await authPrisma.$disconnect();

  // ── ACME GHANA DEPARTMENTS ─────────────────────────────────────────────────
  console.log('Creating Acme Ghana departments...');

  const engineeringDept = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: acmeId, name: 'Engineering' } },
    update: {},
    create: {
      tenantId: acmeId,
      name: 'Engineering',
      description: 'Software & Systems',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: acmeId, name: 'Human Resources' } },
    update: {},
    create: {
      tenantId: acmeId,
      name: 'Human Resources',
      description: 'People & Culture',
    },
  });

  const financeDept = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: acmeId, name: 'Finance' } },
    update: {},
    create: {
      tenantId: acmeId,
      name: 'Finance',
      description: 'Finance & Accounting',
    },
  });

  // ── ACME GHANA EMPLOYEES ───────────────────────────────────────────────────
  console.log('Creating Acme Ghana employees...');

  const employeeMap: Record<
    string,
    {
      dept: typeof engineeringDept;
      jobTitle: string;
      salary: number;
      number: string;
    }
  > = {
    'kofi.boateng@acmeghana.com': {
      dept: engineeringDept,
      jobTitle: 'Software Engineer',
      salary: 5000,
      number: 'ACM-001',
    },
    'hr.manager@acmeghana.com': {
      dept: hrDept,
      jobTitle: 'HR Manager',
      salary: 6500,
      number: 'ACM-002',
    },
    'ama.owusu@acmeghana.com': {
      dept: engineeringDept,
      jobTitle: 'Frontend Developer',
      salary: 4500,
      number: 'ACM-003',
    },
    'accountant@acmeghana.com': {
      dept: financeDept,
      jobTitle: 'Accountant',
      salary: 5500,
      number: 'ACM-004',
    },
    'newuser@acmeghana.com': {
      dept: engineeringDept,
      jobTitle: 'Junior Developer',
      salary: 3500,
      number: 'ACM-005',
    },
    'mfa.user@acmeghana.com': {
      dept: hrDept,
      jobTitle: 'HR Associate',
      salary: 4000,
      number: 'ACM-006',
    },
    'invited@acmeghana.com': {
      dept: engineeringDept,
      jobTitle: 'Intern',
      salary: 1500,
      number: 'ACM-007',
    },
  };

  let managerId: string | undefined;

  for (const authUser of acmeUsers) {
    const cfg = employeeMap[authUser.email];
    if (!cfg) continue;

    const emp = await prisma.employee.upsert({
      where: { tenantId_email: { tenantId: acmeId, email: authUser.email } },
      update: { userId: authUser.id },
      create: {
        tenantId: acmeId,
        userId: authUser.id,
        employeeNumber: cfg.number,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        email: authUser.email,
        jobTitle: cfg.jobTitle,
        departmentId: cfg.dept.id,
        basicSalary: cfg.salary,
        hireDate: new Date('2024-01-15'),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        gender: 'MALE',
        nationality: 'Ghanaian',
      },
    });

    if (authUser.email === 'hr.manager@acmeghana.com') managerId = emp.id;
    console.log(`  ${authUser.email} → Employee #${cfg.number}`);
  }

  // Make hr.manager the department head of HR
  if (managerId) {
    await prisma.department.update({
      where: { id: hrDept.id },
      data: { managerId },
    });
  }

  // ── STELLAR TECH DEPARTMENTS ───────────────────────────────────────────────
  console.log('\nCreating Stellar Tech departments...');

  const stellarEngDept = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: stellarId, name: 'Engineering' } },
    update: {},
    create: {
      tenantId: stellarId,
      name: 'Engineering',
      description: 'Product & Engineering',
    },
  });

  // ── STELLAR TECH EMPLOYEES ─────────────────────────────────────────────────
  console.log('Creating Stellar Tech employees...');

  const stellarMap: Record<
    string,
    {
      dept: typeof stellarEngDept;
      jobTitle: string;
      salary: number;
      number: string;
    }
  > = {
    'manager@stellartech.com.gh': {
      dept: stellarEngDept,
      jobTitle: 'Engineering Manager',
      salary: 7000,
      number: 'STL-001',
    },
    'dev@stellartech.com.gh': {
      dept: stellarEngDept,
      jobTitle: 'Software Developer',
      salary: 5000,
      number: 'STL-002',
    },
  };

  for (const authUser of stellarUsers) {
    const cfg = stellarMap[authUser.email];
    if (!cfg) continue;

    await prisma.employee.upsert({
      where: { tenantId_email: { tenantId: stellarId, email: authUser.email } },
      update: { userId: authUser.id },
      create: {
        tenantId: stellarId,
        userId: authUser.id,
        employeeNumber: cfg.number,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        email: authUser.email,
        jobTitle: cfg.jobTitle,
        departmentId: cfg.dept.id,
        basicSalary: cfg.salary,
        hireDate: new Date('2024-03-01'),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        nationality: 'Ghanaian',
      },
    });

    console.log(`  ${authUser.email} → Employee #${cfg.number}`);
  }

  console.log('\n=== HR SEED COMPLETE ===\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
