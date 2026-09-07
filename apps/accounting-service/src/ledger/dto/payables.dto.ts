import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AccountingPayableStatus,
  AccountingSettlementMethod,
} from '../../../prisma/generated/client';

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePayableBillDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vendorId!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  documentDate!: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ example: 1000, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 1.25, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'Posting-enabled expense, asset or other offset account debited when the bill is posted.',
  })
  @IsUUID()
  offsetGlAccountId!: string;

  @ApiPropertyOptional({ example: 'Vendor bill' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'EXT-BILL-1001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ example: 'PROCUREMENT' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'source-bill-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string;
}

export class CreatePayableCreditNoteDto extends PartialType(
  CreatePayableBillDto,
) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vendorId!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  documentDate!: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ example: 250, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'Posting-enabled expense, asset or other offset account credited when the vendor credit is posted.',
  })
  @IsUUID()
  offsetGlAccountId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional posted bill this credit note applies to. Bill-specific credits cannot exceed bill outstanding.',
  })
  @IsOptional()
  @IsUUID()
  originalBillId?: string;
}

export class CreatePayablePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vendorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashAccountId!: string;

  @ApiProperty({ example: 1000, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  paymentDate!: string;

  @ApiProperty({ enum: AccountingSettlementMethod })
  @IsEnum(AccountingSettlementMethod)
  settlementMethod!: AccountingSettlementMethod;

  @ApiPropertyOptional({ example: 'BANK-PAY-001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'Vendor payment' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1.25, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: 'EXT-PAY-1001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ example: 'PROCUREMENT' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'source-payment-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string;
}

export class QueryPayableDocumentsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ enum: AccountingPayableStatus })
  @IsOptional()
  @IsEnum(AccountingPayableStatus)
  status?: AccountingPayableStatus;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({ example: 'BILL-20260811' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryPayableAgingDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optionally limit the aging to one vendor.',
  })
  @IsOptional()
  @IsUUID()
  vendorId?: string;
}

export class QueryPayablePaymentsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: AccountingPayableStatus })
  @IsOptional()
  @IsEnum(AccountingPayableStatus)
  status?: AccountingPayableStatus;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: 'APP-20260811' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreatePaymentAllocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  billId!: string;

  @ApiProperty({ example: 500, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;
}

export class CreateVendorCreditAllocationDto extends CreatePaymentAllocationDto {}

export class ReversePayableDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  reversalDate!: string;

  @ApiProperty({ example: 'Correction approved by finance' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ReversePayableAllocationDto {
  @ApiProperty({ example: 'Allocation applied to wrong bill' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}
