import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankReconciliationStatus,
  BankStatementLineStatus,
} from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateBankReconciliationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashAccountId!: string;

  @ApiProperty({ example: 'ECOBANK-2026-08' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  statementReference!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  statementStartDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  statementEndDate!: string;

  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  openingBalance!: number;

  @ApiProperty({ example: 1250 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  closingBalance!: number;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;
}

export class QueryBankReconciliationsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: BankReconciliationStatus })
  @IsOptional()
  @IsEnum(BankReconciliationStatus)
  status?: BankReconciliationStatus;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class MatchBankStatementLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashbookTransactionId!: string;
}

export class QueryBankStatementLinesDto {
  @ApiPropertyOptional({ enum: BankStatementLineStatus })
  @IsOptional()
  @IsEnum(BankStatementLineStatus)
  status?: BankStatementLineStatus;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
