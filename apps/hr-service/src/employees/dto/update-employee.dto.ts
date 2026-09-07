import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsUUID,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmployeeCompensationType,
  EmploymentType,
  EmploymentStatus,
  Gender,
  MaritalStatus,
  PayrollTaxPolicy,
} from '../../../prisma/generated/client';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'Updated first name', example: 'Kofi' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Updated last name', example: 'Boateng' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Updated phone number',
    example: '+233201234567',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Updated gender', example: 'MALE' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Updated birth date. Employees must be at least 18 years old.',
    example: '1990-05-18',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Updated marital status',
    example: 'MARRIED',
  })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ description: 'Updated nationality', example: 'Ghana' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({
    description: 'Updated street address',
    example: '321 Tema Road',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Updated city', example: 'Accra' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Updated region',
    example: 'Greater Accra',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Updated emergency contact name',
    example: 'Ama Mensah',
  })
  @IsOptional()
  @IsString()
  emergencyName?: string;

  @ApiPropertyOptional({
    description: 'Updated emergency contact phone',
    example: '+233245678901',
  })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional({
    description: 'Updated emergency contact relation',
    example: 'Spouse',
  })
  @IsOptional()
  @IsString()
  emergencyRelation?: string;

  @ApiPropertyOptional({
    description: 'Updated department ID',
    example: 'dept-456',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Branch ID of the employee',
    example: 'branch-789',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Employee ID of the reporting manager',
    example: 'emp-123',
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Updated official hire date',
    example: '2026-01-05',
  })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional({
    description: 'Probation end date',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  probationEndsAt?: string;

  @ApiPropertyOptional({
    description: 'Contract end date (CONTRACT employment type)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({
    description: 'Updated job title',
    example: 'HR Manager',
  })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({
    description: 'Updated employment type',
    example: 'FULL_TIME',
  })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({
    description: 'Updated employment status',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({
    description: 'National ID number',
    example: 'GHA-000000000-0',
  })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({
    description: 'Updated bank name',
    example: 'GCB Bank',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Updated bank account number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({
    description: 'Updated bank branch',
    example: 'Accra Main Branch',
  })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({
    description: 'Updated SSNIT number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  ssnit?: string;

  @ApiPropertyOptional({ description: 'Updated TIN', example: 'TIN123456789' })
  @IsOptional()
  @IsString()
  tinNumber?: string;

  @ApiPropertyOptional({
    description: 'Profile image URL',
    example: 'https://example.com/avatar.png',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Updated basic salary amount',
    example: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basicSalary?: number;

  @ApiPropertyOptional({
    description: 'Updated payroll compensation model',
    enum: EmployeeCompensationType,
    example: EmployeeCompensationType.SALARY_PLUS_COMMISSION,
  })
  @IsOptional()
  @IsEnum(EmployeeCompensationType)
  compensationType?: EmployeeCompensationType;

  @ApiPropertyOptional({
    description: 'Updated payroll tax handling policy',
    enum: PayrollTaxPolicy,
    example: PayrollTaxPolicy.STANDARD_PAYE,
  })
  @IsOptional()
  @IsEnum(PayrollTaxPolicy)
  taxPolicy?: PayrollTaxPolicy;

  @ApiPropertyOptional({
    description: 'Fixed tax amount used when taxPolicy is FIXED_AMOUNT',
    example: 250,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fixedTaxAmount?: number;

  @ApiPropertyOptional({
    description:
      'Whether commission earnings should be included in PAYE taxable income',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  commissionTaxable?: boolean;
}
