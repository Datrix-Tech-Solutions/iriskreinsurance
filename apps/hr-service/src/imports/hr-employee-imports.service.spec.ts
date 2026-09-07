import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { HrEmployeeImportsService } from './hr-employee-imports.service';
import {
  HrImportEntityType,
  HrImportJobStatus,
  HrImportRowStatus,
} from '../../prisma/generated/client';
import {
  EMPLOYEE_IMPORT_COLUMNS,
  EMPLOYEE_IMPORT_OPTIONAL_COLUMNS,
  EMPLOYEE_IMPORT_REQUIRED_COLUMNS,
} from './employee-import-columns';

describe('HrEmployeeImportsService', () => {
  const tenantId = 'tenant-1';
  const createdByUserId = 'user-1';

  const tx = {
    hrImportJob: {
      create: jest.fn(),
    },
    hrImportRow: {
      createMany: jest.fn(),
    },
  };

  const prisma = {
    department: {
      findMany: jest.fn(),
    },
    branch: {
      findMany: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    hrImportJob: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  let service: HrEmployeeImportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HrEmployeeImportsService(prisma as never);

    prisma.hrImportJob.findUnique.mockResolvedValue(null);
    prisma.department.findMany.mockResolvedValue([
      { id: 'dept-1', name: 'Engineering' },
    ]);
    prisma.branch.findMany.mockResolvedValue([
      { id: 'branch-1', name: 'Accra' },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'manager-1',
        email: 'manager@acme.com',
        employeeNumber: 'EMP-0001',
      },
    ]);
    tx.hrImportJob.create.mockResolvedValue({
      id: 'job-1',
      tenantId,
      entityType: HrImportEntityType.EMPLOYEE,
      status: HrImportJobStatus.DRY_RUN_COMPLETED,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    tx.hrImportRow.createMany.mockResolvedValue({ count: 1 });
  });

  function csvFile(csv: string, name = 'employees.csv') {
    const buffer = Buffer.from(csv, 'utf8');
    return {
      originalname: name,
      mimetype: 'text/csv',
      size: buffer.length,
      buffer,
    } as Express.Multer.File;
  }

  it('generates a template whose columns match the dry-run accepted columns', () => {
    const template = service.getEmployeeCsvTemplate();
    const [header, sample] = template.trim().split('\n');
    const columns = header.split(',');

    expect(columns).toEqual([...EMPLOYEE_IMPORT_COLUMNS]);
    expect(columns).toEqual(
      expect.arrayContaining([...EMPLOYEE_IMPORT_REQUIRED_COLUMNS]),
    );
    expect(columns).toEqual(
      expect.arrayContaining([...EMPLOYEE_IMPORT_OPTIONAL_COLUMNS]),
    );
    expect(sample.split(',')).toHaveLength(columns.length);
    expect(sample).toContain('Human Resources');
    expect(sample).toContain('Head Office');
  });

  it('validates a valid CSV and persists valid row results', async () => {
    const result = await service.dryRunEmployees(
      tenantId,
      createdByUserId,
      csvFile(`firstName,lastName,email,department,jobTitle,employmentType,hireDate,branch,managerEmail,basicSalary
Kofi,Boateng,KOFI@ACME.COM,Engineering,Developer,FULL_TIME,2026-01-05,Accra,manager@acme.com,3500`),
    );

    expect(result).toMatchObject({
      jobId: 'job-1',
      entityType: 'EMPLOYEE',
      status: 'DRY_RUN_COMPLETED',
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'VALID',
      errors: [],
    });
    expect(prisma.department.findMany).toHaveBeenCalledWith({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });
    expect(tx.hrImportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest matchers are intentionally dynamic in these mock call assertions.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          tenantId,
          createdByUserId,
          entityType: HrImportEntityType.EMPLOYEE,
        }),
      }),
    );
    expect(tx.hrImportRow.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId,
          jobId: 'job-1',
          rowNumber: 2,
          status: HrImportRowStatus.VALID,
          // Jest matchers are intentionally dynamic in these mock call assertions.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          normalizedData: expect.objectContaining({
            email: 'kofi@acme.com',
            departmentId: 'dept-1',
            branchId: 'branch-1',
            managerId: 'manager-1',
          }),
        }),
      ],
    });
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it('returns row errors for missing required columns and blank values', async () => {
    const result = await service.dryRunEmployees(
      tenantId,
      createdByUserId,
      csvFile(`firstName,email,department,jobTitle,employmentType,hireDate
,kofi@acme.com,Engineering,Developer,FULL_TIME,2026-01-05`),
    );

    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'firstName', code: 'REQUIRED' }),
        expect.objectContaining({ field: 'lastName', code: 'REQUIRED' }),
      ]),
    );
  });

  it('validates email, dates, enums, and basic salary', async () => {
    const result = await service.dryRunEmployees(
      tenantId,
      createdByUserId,
      csvFile(`firstName,lastName,email,department,jobTitle,employmentType,hireDate,gender,maritalStatus,dateOfBirth,probationEndsAt,contractEndDate,basicSalary
Kofi,Boateng,not-email,Engineering,Developer,BAD_TYPE,2026-02-31,BAD,BAD,2020-01-01,2025-12-31,2025-12-31,-1`),
    );

    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' }),
        expect.objectContaining({
          field: 'employmentType',
          code: 'INVALID_ENUM',
        }),
        expect.objectContaining({ field: 'gender', code: 'INVALID_ENUM' }),
        expect.objectContaining({
          field: 'maritalStatus',
          code: 'INVALID_ENUM',
        }),
        expect.objectContaining({ field: 'hireDate', code: 'INVALID_DATE' }),
        expect.objectContaining({ field: 'dateOfBirth', code: 'MINIMUM_AGE' }),
        expect.objectContaining({
          field: 'basicSalary',
          code: 'INVALID_NUMBER',
        }),
      ]),
    );
  });

  it('rejects duplicate email and employee number values in the file', async () => {
    const result = await service.dryRunEmployees(
      tenantId,
      createdByUserId,
      csvFile(`employeeNumber,firstName,lastName,email,department,jobTitle,employmentType,hireDate
EMP-0100,Kofi,Boateng,kofi@acme.com,Engineering,Developer,FULL_TIME,2026-01-05
EMP-0100,Ama,Mensah,KOFI@ACME.COM,Engineering,Developer,FULL_TIME,2026-01-05`),
    );

    expect(result.invalidRows).toBe(2);
    expect(result.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email', code: 'DUPLICATE_IN_FILE' }),
        expect.objectContaining({
          field: 'employeeNumber',
          code: 'DUPLICATE_IN_FILE',
        }),
      ]),
    );
  });

  it('rejects existing same-tenant employee conflicts', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'existing-1',
        email: 'kofi@acme.com',
        employeeNumber: 'EMP-0100',
      },
    ]);

    const result = await service.dryRunEmployees(
      tenantId,
      createdByUserId,
      csvFile(`employeeNumber,firstName,lastName,email,department,jobTitle,employmentType,hireDate
EMP-0100,Kofi,Boateng,kofi@acme.com,Engineering,Developer,FULL_TIME,2026-01-05`),
    );

    expect(result.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email', code: 'EXISTS_IN_TENANT' }),
        expect.objectContaining({
          field: 'employeeNumber',
          code: 'EXISTS_IN_TENANT',
        }),
      ]),
    );
  });

  it('rejects department, branch, and manager references outside the tenant', async () => {
    prisma.department.findMany.mockResolvedValue([]);
    prisma.branch.findMany.mockResolvedValue([]);
    prisma.employee.findMany.mockResolvedValue([]);

    const result = await service.dryRunEmployees(
      tenantId,
      createdByUserId,
      csvFile(`firstName,lastName,email,department,jobTitle,employmentType,hireDate,branch,managerEmail,managerEmployeeNumber
Kofi,Boateng,kofi@acme.com,Wrong Dept,Developer,FULL_TIME,2026-01-05,Wrong Branch,manager@other.com,EMP-9999`),
    );

    expect(result.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'department', code: 'NOT_FOUND' }),
        expect.objectContaining({ field: 'branch', code: 'NOT_FOUND' }),
        expect.objectContaining({ field: 'managerEmail', code: 'NOT_FOUND' }),
        expect.objectContaining({
          field: 'managerEmployeeNumber',
          code: 'NOT_FOUND',
        }),
      ]),
    );
  });

  it('reuses an idempotent dry-run result for the same file', async () => {
    const file = csvFile(
      `firstName,lastName,email,department,jobTitle,employmentType,hireDate
Kofi,Boateng,kofi@acme.com,Engineering,Developer,FULL_TIME,2026-01-05`,
    );
    const fileHash = `sha256:${createHash('sha256')
      .update(file.buffer)
      .digest('hex')}`;
    prisma.hrImportJob.findUnique.mockResolvedValue({
      id: 'existing-job',
      tenantId,
      entityType: HrImportEntityType.EMPLOYEE,
      status: HrImportJobStatus.DRY_RUN_COMPLETED,
      fileHash,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [
        {
          rowNumber: 2,
          status: HrImportRowStatus.VALID,
          errors: [],
          warnings: [],
        },
      ],
    });

    const result = await service.dryRunEmployees(
      tenantId,
      createdByUserId,
      file,
      'same-file',
    );

    expect(result.jobId).toBe('existing-job');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects idempotency key reuse for a different file', async () => {
    prisma.hrImportJob.findUnique.mockResolvedValue({
      fileHash: 'sha256:different',
      rows: [],
    });

    await expect(
      service.dryRunEmployees(
        tenantId,
        createdByUserId,
        csvFile(`firstName,lastName,email,department,jobTitle,employmentType,hireDate
Kofi,Boateng,kofi@acme.com,Engineering,Developer,FULL_TIME,2026-01-05`),
        'same-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
