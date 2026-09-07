import { RequestUser } from '@work-phelo/types';
import { validate } from 'class-validator';
import { PayrollTaxPolicy } from '../../prisma/generated/client';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

const ACTOR: RequestUser = {
  id: 'admin-user-id',
  email: 'admin@acmeghana.com',
  role: 'TENANT_ADMIN',
  tenantId: 'tenant-uuid',
  tenantSlug: 'acme-ghana',
  tenantName: 'Acme Ghana Ltd',
  firstName: 'Admin',
  moduleConfig: {},
  featureConfig: {},
  permissions: [],
};

const EMPLOYEE_ACTOR: RequestUser = {
  ...ACTOR,
  id: 'employee-user-id',
  email: 'employee@acmeghana.com',
  role: 'EMPLOYEE',
};

function makePrismaMock() {
  return {
    employee: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    branch: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    appraisal: { updateMany: jest.fn() },
  };
}

function makeEncryptionMock() {
  return {
    encryptEmployeeFields: jest.fn((obj: Record<string, unknown>) => obj),
    decryptEmployeeFields: jest.fn((obj: Record<string, unknown>) => obj),
    hmac: jest.fn((value: string) => `hmac:${value}`),
    encrypt: jest.fn((value: string | undefined) => value ?? null),
  };
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let encryption: ReturnType<typeof makeEncryptionMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    encryption = makeEncryptionMock();

    service = new EmployeesService(
      prisma as never,
      {} as never,
      { ensurePublicHolidaysSeededForEmployee: jest.fn() } as never,
      {} as never,
      encryption as never,
      {} as never,
    );
  });

  function getLastEmployeeUpdateData() {
    const calls = prisma.employee.update.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    return calls.at(-1)?.[0].data ?? {};
  }

  it('clears employee fixedTaxAmount when tax policy changes away from FIXED_AMOUNT', async () => {
    const existing = {
      id: 'employee-uuid',
      tenantId: 'tenant-uuid',
      hireDate: new Date('2026-01-01'),
      probationEndsAt: null,
      contractEndDate: null,
      employmentStatus: 'ACTIVE',
      taxPolicy: PayrollTaxPolicy.FIXED_AMOUNT,
      fixedTaxAmount: '150',
    };

    prisma.employee.findFirst.mockResolvedValue(existing);
    prisma.employee.update.mockResolvedValue({
      ...existing,
      taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
      fixedTaxAmount: null,
    });

    await service.update(
      'tenant-uuid',
      'employee-uuid',
      { taxPolicy: PayrollTaxPolicy.STANDARD_PAYE },
      ACTOR,
    );

    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-uuid' },
      }),
    );
    expect(getLastEmployeeUpdateData()).toEqual(
      expect.objectContaining({
        taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
        fixedTaxAmount: null,
      }),
    );
  });

  it('preserves existing hire date when update omits hireDate', async () => {
    const existing = {
      id: 'employee-uuid',
      tenantId: 'tenant-uuid',
      hireDate: new Date('2026-01-01'),
      probationEndsAt: null,
      contractEndDate: null,
      employmentStatus: 'ACTIVE',
      taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
      fixedTaxAmount: null,
    };

    prisma.employee.findFirst.mockResolvedValue(existing);
    prisma.employee.update.mockResolvedValue({
      ...existing,
      firstName: 'Ama',
    });

    await service.update(
      'tenant-uuid',
      'employee-uuid',
      { firstName: 'Ama' },
      ACTOR,
    );

    expect(getLastEmployeeUpdateData()).not.toHaveProperty('hireDate');
  });

  it('persists a valid updated hire date for full HR/admin edits', async () => {
    const existing = {
      id: 'employee-uuid',
      tenantId: 'tenant-uuid',
      hireDate: new Date('2026-01-01'),
      probationEndsAt: null,
      contractEndDate: null,
      employmentStatus: 'ACTIVE',
      taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
      fixedTaxAmount: null,
    };

    prisma.employee.findFirst.mockResolvedValue(existing);
    prisma.employee.update.mockResolvedValue({
      ...existing,
      hireDate: new Date('2026-02-01'),
    });

    await service.update(
      'tenant-uuid',
      'employee-uuid',
      { hireDate: '2026-02-01' },
      ACTOR,
    );

    expect(getLastEmployeeUpdateData().hireDate).toEqual(
      new Date('2026-02-01'),
    );
  });

  it('rejects invalid hireDate values through update DTO validation', async () => {
    const dto = Object.assign(new UpdateEmployeeDto(), {
      hireDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'hireDate',
        }),
      ]),
    );
  });

  it('validates related employment dates against the newly supplied hire date', async () => {
    const existing = {
      id: 'employee-uuid',
      tenantId: 'tenant-uuid',
      hireDate: new Date('2026-01-01'),
      probationEndsAt: null,
      contractEndDate: null,
      employmentStatus: 'ACTIVE',
      taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
      fixedTaxAmount: null,
    };

    prisma.employee.findFirst.mockResolvedValue(existing);

    await expect(
      service.update(
        'tenant-uuid',
        'employee-uuid',
        {
          hireDate: '2026-03-01',
          probationEndsAt: '2026-02-15',
        },
        ACTOR,
      ),
    ).rejects.toThrow('Probation end date cannot be before the hire date.');

    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('does not allow self-service updates to change hireDate', async () => {
    const existing = {
      id: 'employee-uuid',
      tenantId: 'tenant-uuid',
      userId: EMPLOYEE_ACTOR.id,
      hireDate: new Date('2026-01-01'),
      probationEndsAt: null,
      contractEndDate: null,
      employmentStatus: 'ACTIVE',
      taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
      fixedTaxAmount: null,
    };

    prisma.employee.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: existing.id, departmentId: null });
    prisma.employee.update.mockResolvedValue({
      ...existing,
      firstName: 'Self',
    });

    await service.update(
      'tenant-uuid',
      'employee-uuid',
      { firstName: 'Self', hireDate: '2026-02-01' },
      EMPLOYEE_ACTOR,
    );

    expect(getLastEmployeeUpdateData()).not.toHaveProperty('hireDate');
  });
});
