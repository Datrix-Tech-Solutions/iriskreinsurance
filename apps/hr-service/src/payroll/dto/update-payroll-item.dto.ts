import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PayrollTaxPolicy } from '../../../prisma/generated/client';

export class PayrollAllowanceLineItemDto {
  @ApiPropertyOptional({ example: 'Transport Allowance' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'TRANSPORT' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ example: 250, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export class PayrollDeductionLineItemDto {
  @ApiPropertyOptional({
    description:
      'Source employee deduction ID when the line item comes from an employee balance',
  })
  @IsOptional()
  @IsString()
  employeeDeductionId?: string;

  @ApiPropertyOptional({ example: 'Staff Loan' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 250, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export class UpdatePayrollItemDto {
  @ApiPropertyOptional({
    description: 'Override basic salary for this payroll run item',
    example: 4500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basicSalary?: number;

  @ApiPropertyOptional({
    description: 'Commission earnings for this draft payroll item',
    example: 1800,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionAmount?: number;

  @ApiPropertyOptional({
    description: 'Override non-transport allowances for this payroll run item',
    example: 350,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAllowances?: number;

  @ApiPropertyOptional({
    description: 'Optional transport amount for this payroll run item',
    example: 120,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  transportAmount?: number;

  @ApiPropertyOptional({
    description: 'Optional deductions such as loans or employee balances owed',
    example: 250,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherDeductions?: number;

  @ApiPropertyOptional({
    description:
      'Optional payroll tax policy override for this draft payroll item',
    enum: PayrollTaxPolicy,
    example: PayrollTaxPolicy.FIXED_AMOUNT,
  })
  @IsOptional()
  @IsEnum(PayrollTaxPolicy)
  taxPolicy?: PayrollTaxPolicy;

  @ApiPropertyOptional({
    description: 'Fixed tax amount used when taxPolicy is FIXED_AMOUNT',
    example: 250,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedTaxAmount?: number;

  @ApiPropertyOptional({
    description:
      'Whether commission earnings should be included in PAYE taxable income for this draft item',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  commissionTaxable?: boolean;

  @ApiPropertyOptional({
    type: [PayrollAllowanceLineItemDto],
    description:
      'Optional itemized allowance snapshot. If provided, totals are derived from these line items.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollAllowanceLineItemDto)
  allowanceItems?: PayrollAllowanceLineItemDto[];

  @ApiPropertyOptional({
    type: [PayrollDeductionLineItemDto],
    description:
      'Optional itemized deduction snapshot. If provided, totals are derived from these line items.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollDeductionLineItemDto)
  deductionItems?: PayrollDeductionLineItemDto[];
}
