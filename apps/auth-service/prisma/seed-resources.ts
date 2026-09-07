import { PrismaClient } from '../prisma/generated/client';

const prisma = new PrismaClient();

export const RESOURCES = [
  // ── AUTH module ────────────────────────────────────────────────
  {
    name: 'users',
    module: 'AUTH',
    description: 'User accounts and invitations',
  },
  {
    name: 'user-security',
    module: 'AUTH',
    description: 'User security actions such as forced password resets',
  },
  { name: 'tenants', module: 'AUTH', description: 'Company tenants' },
  {
    name: 'permission-sets',
    module: 'AUTH',
    description: 'Permission set bundles',
  },
  { name: 'audit-logs', module: 'AUTH', description: 'Audit trail' },

  // ── HR module ──────────────────────────────────────────────────
  { name: 'employees', module: 'HR', description: 'Employee profiles' },
  {
    name: 'employee-profile',
    module: 'HR',
    description: 'Employee self-service profile access',
  },
  {
    name: 'offboarding',
    module: 'HR',
    description: 'Employee offboarding and exit workflows',
  },
  { name: 'resignations', module: 'HR', description: 'Employee resignations' },
  { name: 'departments', module: 'HR', description: 'Department management' },
  { name: 'branches', module: 'HR', description: 'Branch locations' },
  { name: 'hr-settings', module: 'HR', description: 'HR workspace settings' },
  {
    name: 'leave',
    module: 'HR',
    description: 'Company-wide leave requests and approvals',
  },
  {
    name: 'leave-self',
    module: 'HR',
    description: 'Employee self-service leave access',
  },
  {
    name: 'leave-settings',
    module: 'HR',
    description: 'Leave types, public holidays and balance administration',
  },
  { name: 'attendance', module: 'HR', description: 'Clock-in/out records' },
  { name: 'timesheets', module: 'HR', description: 'Weekly timesheets' },
  {
    name: 'time-corrections',
    module: 'HR',
    description: 'Time correction requests',
  },
  { name: 'schedules', module: 'HR', description: 'Shift schedules' },
  { name: 'payroll', module: 'HR', description: 'Payroll runs and approvals' },
  {
    name: 'payslip-self',
    module: 'HR',
    description: 'Employee self-service payslip access',
  },
  {
    name: 'appraisals',
    module: 'HR',
    description: 'Company appraisal records and cycle-generated reviews',
  },
  {
    name: 'appraisal-settings',
    module: 'HR',
    description: 'Appraisal cycles, templates and KPI configuration',
  },
  {
    name: 'self-appraisals',
    module: 'HR',
    description: 'Employee self-service appraisal access and submissions',
  },
  {
    name: 'appraisal-reviews',
    module: 'HR',
    description: 'Manager appraisal review workflows',
  },
  { name: 'assets', module: 'HR', description: 'Company asset management' },
  {
    name: 'projects',
    module: 'HR',
    description: 'Company projects and project membership',
  },
  {
    name: 'project-tasks',
    module: 'HR',
    description: 'Project task assignment and task execution',
  },
  { name: 'announcements', module: 'HR', description: 'Company announcements' },
  { name: 'documents', module: 'HR', description: 'Employee documents' },
  { name: 'allowances', module: 'HR', description: 'Employee allowances' },

  // ── FINANCE module ─────────────────────────────────────────────
  {
    name: 'payroll-reports',
    module: 'FINANCE',
    description: 'Payroll financial reports',
  },
  {
    name: 'expense-reports',
    module: 'FINANCE',
    description: 'Expense reports',
  },

  // ── ACCOUNTING module ──────────────────────────────────────────
  {
    name: 'accounting.settings',
    module: 'ACCOUNTING',
    description: 'Accounting configuration, currencies and fiscal periods',
  },
  {
    name: 'accounting.accounts',
    module: 'ACCOUNTING',
    description: 'Chart of accounts, cost centres and subledger accounts',
  },
  {
    name: 'accounting.account-classifications',
    module: 'ACCOUNTING',
    description: 'Accounting account hierarchy classifications',
  },
  {
    name: 'accounting.account-groups',
    module: 'ACCOUNTING',
    description: 'Accounting account hierarchy groups',
  },
  {
    name: 'accounting.customers',
    module: 'ACCOUNTING',
    description: 'Accounting customer master records and AR subledgers',
  },
  {
    name: 'accounting.vendors',
    module: 'ACCOUNTING',
    description: 'Accounting vendor master records and AP subledgers',
  },
  {
    name: 'accounting.cash-accounts',
    module: 'ACCOUNTING',
    description: 'Accounting-owned cash, bank and wallet account masters',
  },
  {
    name: 'accounting.cashbook',
    module: 'ACCOUNTING',
    description: 'Standalone Accounting cashbook transaction workflows',
  },
  {
    name: 'accounting.receivables',
    module: 'ACCOUNTING',
    description:
      'Standalone Accounting accounts receivable documents, receipts and allocations',
  },
  {
    name: 'accounting.payables',
    module: 'ACCOUNTING',
    description:
      'Standalone Accounting accounts payable documents, payments and allocations',
  },
  {
    name: 'accounting.journals',
    module: 'ACCOUNTING',
    description: 'Draft, post and reverse journal entries',
  },
  {
    name: 'accounting.ledger',
    module: 'ACCOUNTING',
    description: 'Posted general-ledger activity',
  },

  // ── OPERATIONS / REINSURANCE module ───────────────────────────
  {
    name: 'operations.reinsurance.dashboard',
    module: 'OPERATIONS',
    description: 'Reinsurance operations dashboard',
  },
  {
    name: 'operations.reinsurance.accounting-operations',
    module: 'OPERATIONS',
    description: 'Reinsurance Accounting integration operational diagnostics and support actions',
  },
  {
    name: 'operations.reinsurance.placements',
    module: 'OPERATIONS',
    description: 'Reinsurance placement workflows',
  },
  {
    name: 'operations.reinsurance.facultative-offers.create-offer',
    module: 'OPERATIONS',
    description: 'Create new Reinsurance facultative offers',
  },
  {
    name: 'operations.reinsurance.facultative-offers.edit-offer',
    module: 'OPERATIONS',
    description: 'Edit material Reinsurance facultative offer details',
  },
  {
    name: 'operations.reinsurance.facultative-offers.partial-edit',
    module: 'OPERATIONS',
    description:
      'Apply non-material Reinsurance facultative offer edits such as policy number changes',
  },
  {
    name: 'operations.reinsurance.facultative-offers.reopen-offer',
    module: 'OPERATIONS',
    description:
      'Reopen unpaid closed Reinsurance facultative offers into the closing workflow',
  },
  {
    name: 'operations.reinsurance.facultative-offers.force-close',
    module: 'OPERATIONS',
    description:
      'Force close Reinsurance facultative offers using agreed closing capacity',
  },
  {
    name: 'operations.reinsurance.facultative-offers.endorse-offer',
    module: 'OPERATIONS',
    description:
      'Initiate and manage Reinsurance facultative endorsement workflows',
  },
  {
    name: 'operations.reinsurance.facultative-offers.archive-offer',
    module: 'OPERATIONS',
    description:
      'Archive Reinsurance facultative offers while preserving history',
  },
  {
    name: 'operations.reinsurance.premiums.receive-from-cedant',
    module: 'OPERATIONS',
    description: 'Record inbound Reinsurance premium receipts from cedants',
  },
  {
    name: 'operations.reinsurance.premiums.disburse-to-reinsurer',
    module: 'OPERATIONS',
    description:
      'Record outbound Reinsurance premium disbursements to reinsurers',
  },
  {
    name: 'operations.reinsurance.premiums.reverse-payment',
    module: 'OPERATIONS',
    description: 'Reverse Reinsurance premium receipts or disbursements',
  },
  {
    name: 'operations.reinsurance.counterparties',
    module: 'OPERATIONS',
    description: 'Reinsurance counterparties and contacts',
  },
  {
    name: 'operations.reinsurance.claims',
    module: 'OPERATIONS',
    description: 'Reinsurance claims workflows',
  },
  {
    name: 'operations.reinsurance.claims.add-claim',
    module: 'OPERATIONS',
    description: 'Create Reinsurance claim loss events',
  },
  {
    name: 'operations.reinsurance.claims.create-notification',
    module: 'OPERATIONS',
    description: 'Move Reinsurance claims into notified status',
  },
  {
    name: 'operations.reinsurance.claims.record-recovery',
    module: 'OPERATIONS',
    description: 'Record actual Reinsurance recovery receipts from reinsurers',
  },
  {
    name: 'operations.reinsurance.claims.void-claim',
    module: 'OPERATIONS',
    description: 'Void Reinsurance claims while preserving audit history',
  },
  {
    name: 'operations.reinsurance.email',
    module: 'OPERATIONS',
    description: 'Broker correspondence and linked email threads',
  },
  {
    name: 'operations.reinsurance.email-settings',
    module: 'OPERATIONS',
    description: 'Broker mailbox integration settings',
  },
  {
    name: 'operations.reinsurance.reports',
    module: 'OPERATIONS',
    description: 'Reinsurance operational reports',
  },
  {
    name: 'operations.reinsurance.settings',
    module: 'OPERATIONS',
    description: 'Reinsurance module configuration',
  },
  {
    name: 'operations.reinsurance.taxes-levies',
    module: 'OPERATIONS',
    description: 'Reinsurance taxes, levies and charge configuration',
  },

  // ── PLATFORM module ────────────────────────────────────────────
  {
    name: 'platform-settings',
    module: 'PLATFORM',
    description: 'Platform configuration',
  },
  {
    name: 'subscriptions',
    module: 'PLATFORM',
    description: 'Subscription management',
  },
];

export async function seedResources() {
  console.log('  Seeding resources...');
  const results: Record<string, string> = {};

  for (const resource of RESOURCES) {
    const r = await prisma.resource.upsert({
      where: { name: resource.name },
      update: { module: resource.module, description: resource.description },
      create: resource,
    });
    results[resource.name] = r.id;
  }

  console.log(`  ${Object.keys(results).length} resources seeded`);
  return results;
}

if (require.main === module) {
  seedResources()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
