import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmploymentType,
  Gender,
  HrImportEntityType,
  HrImportJobStatus,
  HrImportRowStatus,
  MaritalStatus,
  Prisma,
} from '../../prisma/generated/client';
import {
  EmployeeImportDryRunResponseDto,
  EmployeeImportDryRunRowDto,
  EmployeeImportRowIssueDto,
} from './dto/employee-import-dry-run.dto';
import {
  buildEmployeeImportTemplateCsv,
  EMPLOYEE_IMPORT_COLUMNS,
  EMPLOYEE_IMPORT_REQUIRED_COLUMNS,
  type EmployeeImportColumn,
} from './employee-import-columns';

type ImportFile = Pick<
  Express.Multer.File,
  'buffer' | 'originalname' | 'size' | 'mimetype'
>;

type ParsedCsvRow = {
  rowNumber: number;
  rawData: Record<string, string>;
  values: Partial<Record<EmployeeImportColumn, string>>;
};

type ValidatedRow = EmployeeImportDryRunRowDto & {
  rawData: Record<string, string>;
  normalizedData?: Prisma.InputJsonObject;
};

type ExistingEmployee = {
  id: string;
  email: string;
  employeeNumber: string;
};

const MAX_CSV_BYTES = 1024 * 1024;
const MAX_CSV_ROWS = 1000;

const COLUMN_LOOKUP = new Map<string, EmployeeImportColumn>(
  EMPLOYEE_IMPORT_COLUMNS.map((column) => [column.toLowerCase(), column]),
);

const EMPLOYMENT_TYPES = new Set<string>(Object.values(EmploymentType));
const GENDERS = new Set<string>(Object.values(Gender));
const MARITAL_STATUSES = new Set<string>(Object.values(MaritalStatus));

@Injectable()
export class HrEmployeeImportsService {
  constructor(private readonly prisma: PrismaService) {}

  getEmployeeCsvTemplate() {
    return buildEmployeeImportTemplateCsv();
  }

  async dryRunEmployees(
    tenantId: string,
    createdByUserId: string | undefined,
    file: ImportFile | undefined,
    idempotencyKey?: string,
  ): Promise<EmployeeImportDryRunResponseDto> {
    if (!file) {
      throw new BadRequestException('CSV file is required.');
    }

    if (file.size > MAX_CSV_BYTES) {
      throw new BadRequestException(
        `CSV file must be ${MAX_CSV_BYTES} bytes or smaller.`,
      );
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are supported.');
    }

    const csv = file.buffer.toString('utf8');
    const fileHash = this.hashBuffer(file.buffer);
    const cleanIdempotencyKey = idempotencyKey?.trim() || undefined;

    if (cleanIdempotencyKey) {
      const existing = await this.prisma.hrImportJob.findUnique({
        where: {
          tenantId_entityType_idempotencyKey: {
            tenantId,
            entityType: HrImportEntityType.EMPLOYEE,
            idempotencyKey: cleanIdempotencyKey,
          },
        },
        include: { rows: { orderBy: { rowNumber: 'asc' } } },
      });

      if (existing) {
        if (existing.fileHash !== fileHash) {
          throw new ConflictException(
            'Idempotency key has already been used for a different file.',
          );
        }

        return {
          jobId: existing.id,
          entityType: existing.entityType,
          status: existing.status,
          totalRows: existing.totalRows,
          validRows: existing.validRows,
          invalidRows: existing.invalidRows,
          rows: existing.rows.map((row) => ({
            rowNumber: row.rowNumber,
            status: row.status,
            errors: this.asIssues(row.errors),
            warnings: this.asIssues(row.warnings),
          })),
        };
      }
    }

    const parsedRows = this.parseEmployeeCsv(csv);
    const validatedRows = await this.validateRows(tenantId, parsedRows);
    const validRows = validatedRows.filter((row) => row.status === 'VALID');
    const invalidRows = validatedRows.length - validRows.length;

    const job = await this.prisma.$transaction(async (tx) => {
      const createdJob = await tx.hrImportJob.create({
        data: {
          tenantId,
          entityType: HrImportEntityType.EMPLOYEE,
          status: HrImportJobStatus.DRY_RUN_COMPLETED,
          fileName: file.originalname,
          fileHash,
          idempotencyKey: cleanIdempotencyKey,
          totalRows: validatedRows.length,
          validRows: validRows.length,
          invalidRows,
          createdByUserId,
        },
      });

      if (validatedRows.length > 0) {
        await tx.hrImportRow.createMany({
          data: validatedRows.map((row) => ({
            tenantId,
            jobId: createdJob.id,
            rowNumber: row.rowNumber,
            status:
              row.status === 'VALID'
                ? HrImportRowStatus.VALID
                : HrImportRowStatus.INVALID,
            rawData: row.rawData as Prisma.InputJsonObject,
            normalizedData: row.normalizedData,
            errors: row.errors as unknown as Prisma.InputJsonArray,
            warnings: row.warnings as unknown as Prisma.InputJsonArray,
          })),
        });
      }

      return createdJob;
    });

    return {
      jobId: job.id,
      entityType: job.entityType,
      status: job.status,
      totalRows: validatedRows.length,
      validRows: validRows.length,
      invalidRows,
      rows: validatedRows.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status,
        errors: row.errors,
        warnings: row.warnings,
      })),
    };
  }

  private hashBuffer(buffer: Buffer) {
    return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
  }

  private parseEmployeeCsv(csv: string): ParsedCsvRow[] {
    const rows = this.parseCsvRows(csv.replace(/^\uFEFF/, ''));

    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty.');
    }

    const headers = rows[0].map((header) => header.trim());
    if (headers.every((header) => !header)) {
      throw new BadRequestException('CSV header row is empty.');
    }

    const dataRows = rows
      .slice(1)
      .map((cells, index) => ({ cells, rowNumber: index + 2 }))
      .filter(({ cells }) => cells.some((cell) => cell.trim() !== ''));

    if (dataRows.length > MAX_CSV_ROWS) {
      throw new BadRequestException(
        `CSV file can contain at most ${MAX_CSV_ROWS} employee rows.`,
      );
    }

    return dataRows.map(({ cells, rowNumber }) => {
      const rawData: Record<string, string> = {};
      const values: Partial<Record<EmployeeImportColumn, string>> = {};

      headers.forEach((header, index) => {
        const value = cells[index]?.trim() ?? '';
        rawData[header] = value;

        const canonical = COLUMN_LOOKUP.get(header.toLowerCase());
        if (canonical) {
          values[canonical] = value;
        }
      });

      return { rowNumber, rawData, values };
    });
  }

  private parseCsvRows(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let inQuotes = false;

    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      const next = csv[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        row.push(value);
        rows.push(row);
        row = [];
        value = '';

        if (char === '\r' && next === '\n') {
          index += 1;
        }
        continue;
      }

      value += char;
    }

    if (inQuotes) {
      throw new BadRequestException(
        'CSV contains an unterminated quoted value.',
      );
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value);
      rows.push(row);
    }

    return rows.filter((parsedRow) =>
      parsedRow.some((cell) => cell.trim() !== ''),
    );
  }

  private async validateRows(
    tenantId: string,
    rows: ParsedCsvRow[],
  ): Promise<ValidatedRow[]> {
    const [departments, branches, existingEmployees] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.branch.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.employee.findMany({
        where: { tenantId },
        select: { id: true, email: true, employeeNumber: true },
      }),
    ]);

    const departmentByName = new Map(
      departments.map((department) => [
        this.normalizeLookup(department.name),
        department,
      ]),
    );
    const branchByName = new Map(
      branches.map((branch) => [this.normalizeLookup(branch.name), branch]),
    );
    const existingEmailSet = new Set(
      existingEmployees.map((employee) => this.normalizeLookup(employee.email)),
    );
    const existingEmployeeNumberSet = new Set(
      existingEmployees.map((employee) =>
        this.normalizeLookup(employee.employeeNumber),
      ),
    );
    const existingEmployeesByEmail = new Map(
      existingEmployees.map((employee) => [
        this.normalizeLookup(employee.email),
        employee,
      ]),
    );
    const existingEmployeesByNumber = new Map(
      existingEmployees.map((employee) => [
        this.normalizeLookup(employee.employeeNumber),
        employee,
      ]),
    );

    const emailCounts = this.countColumn(rows, 'email', true);
    const employeeNumberCounts = this.countColumn(
      rows,
      'employeeNumber',
      false,
    );

    return rows.map((row) =>
      this.validateRow(row, {
        departmentByName,
        branchByName,
        existingEmailSet,
        existingEmployeeNumberSet,
        existingEmployeesByEmail,
        existingEmployeesByNumber,
        emailCounts,
        employeeNumberCounts,
      }),
    );
  }

  private validateRow(
    row: ParsedCsvRow,
    context: {
      departmentByName: Map<string, { id: string; name: string }>;
      branchByName: Map<string, { id: string; name: string }>;
      existingEmailSet: Set<string>;
      existingEmployeeNumberSet: Set<string>;
      existingEmployeesByEmail: Map<string, ExistingEmployee>;
      existingEmployeesByNumber: Map<string, ExistingEmployee>;
      emailCounts: Map<string, number>;
      employeeNumberCounts: Map<string, number>;
    },
  ): ValidatedRow {
    const errors: EmployeeImportRowIssueDto[] = [];
    const warnings: EmployeeImportRowIssueDto[] = [];
    const values = row.values;

    for (const column of EMPLOYEE_IMPORT_REQUIRED_COLUMNS) {
      if (!values[column]?.trim()) {
        errors.push({
          field: column,
          code: 'REQUIRED',
          message: `${column} is required.`,
        });
      }
    }

    const email = values.email?.trim().toLowerCase();
    if (email) {
      if (!this.isValidEmail(email)) {
        errors.push({
          field: 'email',
          code: 'INVALID_EMAIL',
          message: 'Email must be a valid email address.',
        });
      }

      if ((context.emailCounts.get(email) ?? 0) > 1) {
        errors.push({
          field: 'email',
          code: 'DUPLICATE_IN_FILE',
          message: 'Email appears more than once in this file.',
        });
      }

      if (context.existingEmailSet.has(email)) {
        errors.push({
          field: 'email',
          code: 'EXISTS_IN_TENANT',
          message: 'An employee with this email already exists.',
        });
      }
    }

    const employeeNumber = values.employeeNumber?.trim();
    const normalizedEmployeeNumber = employeeNumber
      ? this.normalizeLookup(employeeNumber)
      : undefined;
    if (
      normalizedEmployeeNumber &&
      (context.employeeNumberCounts.get(normalizedEmployeeNumber) ?? 0) > 1
    ) {
      errors.push({
        field: 'employeeNumber',
        code: 'DUPLICATE_IN_FILE',
        message: 'Employee number appears more than once in this file.',
      });
    }

    if (
      normalizedEmployeeNumber &&
      context.existingEmployeeNumberSet.has(normalizedEmployeeNumber)
    ) {
      errors.push({
        field: 'employeeNumber',
        code: 'EXISTS_IN_TENANT',
        message: 'An employee with this employee number already exists.',
      });
    }

    const employmentType = values.employmentType?.trim().toUpperCase();
    if (employmentType && !EMPLOYMENT_TYPES.has(employmentType)) {
      errors.push({
        field: 'employmentType',
        code: 'INVALID_ENUM',
        message: `employmentType must be one of: ${Array.from(
          EMPLOYMENT_TYPES,
        ).join(', ')}.`,
      });
    }

    const gender = values.gender?.trim().toUpperCase();
    if (gender && !GENDERS.has(gender)) {
      errors.push({
        field: 'gender',
        code: 'INVALID_ENUM',
        message: `gender must be one of: ${Array.from(GENDERS).join(', ')}.`,
      });
    }

    const maritalStatus = values.maritalStatus?.trim().toUpperCase();
    if (maritalStatus && !MARITAL_STATUSES.has(maritalStatus)) {
      errors.push({
        field: 'maritalStatus',
        code: 'INVALID_ENUM',
        message: `maritalStatus must be one of: ${Array.from(
          MARITAL_STATUSES,
        ).join(', ')}.`,
      });
    }

    const hireDate = this.validateDate(values.hireDate, 'hireDate', errors);
    const dateOfBirth = this.validateDate(
      values.dateOfBirth,
      'dateOfBirth',
      errors,
    );
    const probationEndsAt = this.validateDate(
      values.probationEndsAt,
      'probationEndsAt',
      errors,
    );
    const contractEndDate = this.validateDate(
      values.contractEndDate,
      'contractEndDate',
      errors,
    );

    if (dateOfBirth && this.getAge(dateOfBirth) < 18) {
      errors.push({
        field: 'dateOfBirth',
        code: 'MINIMUM_AGE',
        message: 'Employees must be at least 18 years old.',
      });
    }

    if (hireDate && probationEndsAt && probationEndsAt < hireDate) {
      errors.push({
        field: 'probationEndsAt',
        code: 'DATE_BEFORE_HIRE_DATE',
        message: 'Probation end date cannot be before hireDate.',
      });
    }

    if (hireDate && contractEndDate && contractEndDate < hireDate) {
      errors.push({
        field: 'contractEndDate',
        code: 'DATE_BEFORE_HIRE_DATE',
        message: 'Contract end date cannot be before hireDate.',
      });
    }

    const departmentName = values.department?.trim();
    const department = departmentName
      ? context.departmentByName.get(this.normalizeLookup(departmentName))
      : undefined;
    if (departmentName && !department) {
      errors.push({
        field: 'department',
        code: 'NOT_FOUND',
        message: 'Department must exist and be active in this tenant.',
      });
    }

    const branchName = values.branch?.trim();
    const branch = branchName
      ? context.branchByName.get(this.normalizeLookup(branchName))
      : undefined;
    if (branchName && !branch) {
      errors.push({
        field: 'branch',
        code: 'NOT_FOUND',
        message: 'Branch must exist and be active in this tenant.',
      });
    }

    const managerByEmail = values.managerEmail?.trim().toLowerCase()
      ? context.existingEmployeesByEmail.get(
          this.normalizeLookup(values.managerEmail),
        )
      : undefined;
    const managerByNumber = values.managerEmployeeNumber?.trim()
      ? context.existingEmployeesByNumber.get(
          this.normalizeLookup(values.managerEmployeeNumber),
        )
      : undefined;

    if (values.managerEmail?.trim() && !managerByEmail) {
      errors.push({
        field: 'managerEmail',
        code: 'NOT_FOUND',
        message: 'Manager email must resolve to an existing tenant employee.',
      });
    }

    if (values.managerEmployeeNumber?.trim() && !managerByNumber) {
      errors.push({
        field: 'managerEmployeeNumber',
        code: 'NOT_FOUND',
        message:
          'Manager employee number must resolve to an existing tenant employee.',
      });
    }

    if (
      managerByEmail &&
      managerByNumber &&
      managerByEmail.id !== managerByNumber.id
    ) {
      errors.push({
        field: 'managerEmail',
        code: 'MANAGER_REFERENCE_MISMATCH',
        message:
          'managerEmail and managerEmployeeNumber must refer to the same employee.',
      });
    }

    const basicSalary = values.basicSalary?.trim();
    if (basicSalary) {
      const salary = Number(basicSalary);
      if (!Number.isFinite(salary) || salary < 0) {
        errors.push({
          field: 'basicSalary',
          code: 'INVALID_NUMBER',
          message: 'basicSalary must be a number greater than or equal to 0.',
        });
      }
    }

    const normalizedData =
      errors.length === 0
        ? this.buildNormalizedData(values, {
            email,
            employeeNumber,
            employmentType,
            gender,
            maritalStatus,
            departmentId: department?.id,
            branchId: branch?.id,
            managerId: managerByEmail?.id ?? managerByNumber?.id,
          })
        : undefined;

    return {
      rowNumber: row.rowNumber,
      status: errors.length === 0 ? 'VALID' : 'INVALID',
      rawData: row.rawData,
      normalizedData,
      errors,
      warnings,
    };
  }

  private buildNormalizedData(
    values: Partial<Record<EmployeeImportColumn, string>>,
    resolved: {
      email?: string;
      employeeNumber?: string;
      employmentType?: string;
      gender?: string;
      maritalStatus?: string;
      departmentId?: string;
      branchId?: string;
      managerId?: string;
    },
  ): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries({
        employeeNumber: resolved.employeeNumber,
        firstName: values.firstName?.trim(),
        lastName: values.lastName?.trim(),
        email: resolved.email,
        phone: values.phone?.trim(),
        gender: resolved.gender,
        dateOfBirth: values.dateOfBirth?.trim(),
        maritalStatus: resolved.maritalStatus,
        nationality: values.nationality?.trim(),
        address: values.address?.trim(),
        city: values.city?.trim(),
        region: values.region?.trim(),
        departmentId: resolved.departmentId,
        branchId: resolved.branchId,
        managerId: resolved.managerId,
        jobTitle: values.jobTitle?.trim(),
        employmentType: resolved.employmentType,
        hireDate: values.hireDate?.trim(),
        probationEndsAt: values.probationEndsAt?.trim(),
        contractEndDate: values.contractEndDate?.trim(),
        basicSalary: values.basicSalary?.trim()
          ? Number(values.basicSalary.trim())
          : undefined,
        nationalId: values.nationalId?.trim(),
        bankName: values.bankName?.trim(),
        bankAccountNumber: values.bankAccountNumber?.trim(),
        bankBranch: values.bankBranch?.trim(),
        ssnit: values.ssnit?.trim(),
        tinNumber: values.tinNumber?.trim(),
        emergencyName: values.emergencyName?.trim(),
        emergencyPhone: values.emergencyPhone?.trim(),
        emergencyRelation: values.emergencyRelation?.trim(),
      }).filter(([, value]) => value !== undefined && value !== ''),
    );
  }

  private countColumn(
    rows: ParsedCsvRow[],
    column: EmployeeImportColumn,
    lowercase: boolean,
  ) {
    const counts = new Map<string, number>();

    for (const row of rows) {
      const value = row.values[column]?.trim();
      if (!value) {
        continue;
      }

      const normalized = lowercase
        ? value.toLowerCase()
        : this.normalizeLookup(value);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return counts;
  }

  private validateDate(
    value: string | undefined,
    field: string,
    errors: EmployeeImportRowIssueDto[],
  ) {
    if (!value?.trim()) {
      return undefined;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      errors.push({
        field,
        code: 'INVALID_DATE',
        message: `${field} must use YYYY-MM-DD format.`,
      });
      return undefined;
    }

    const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({
        field,
        code: 'INVALID_DATE',
        message: `${field} must be a valid calendar date.`,
      });
      return undefined;
    }

    const [year, month, day] = value.trim().split('-').map(Number);
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      errors.push({
        field,
        code: 'INVALID_DATE',
        message: `${field} must be a valid calendar date.`,
      });
      return undefined;
    }

    return parsed;
  }

  private getAge(dateOfBirth: Date) {
    const today = new Date();
    let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDelta = today.getUTCMonth() - dateOfBirth.getUTCMonth();

    if (
      monthDelta < 0 ||
      (monthDelta === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())
    ) {
      age -= 1;
    }

    return age;
  }

  private isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private normalizeLookup(value: string | undefined) {
    return value?.trim().toLowerCase() ?? '';
  }

  private asIssues(value: unknown): EmployeeImportRowIssueDto[] {
    return Array.isArray(value) ? (value as EmployeeImportRowIssueDto[]) : [];
  }
}
