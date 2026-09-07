import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  AccountingCashAccountKind,
  AccountingSettlementMethod,
  CashbookTransactionStatus,
  CashbookTransactionType,
  CashbookDirection,
} from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateCashAccountDto {
  @ApiProperty({ example: 'Ecobank Current Account' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: AccountingCashAccountKind })
  @IsEnum(AccountingCashAccountKind)
  accountKind!: AccountingCashAccountKind;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Active, posting-enabled tenant GL asset account used by cashbook journals.',
  })
  @IsUUID()
  glAccountId!: string;

  @ApiPropertyOptional({ example: 'Ecobank Ghana' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  bankName?: string;

  @ApiPropertyOptional({
    example: '****1234',
    description:
      'Masked public account identifier only. Do not store raw secrets or credentials.',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Accra Main' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  branch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateCashAccountDto extends PartialType(CreateCashAccountDto) {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryCashAccountsDto {
  @ApiPropertyOptional({ enum: AccountingCashAccountKind })
  @IsOptional()
  @IsEnum(AccountingCashAccountKind)
  accountKind?: AccountingCashAccountKind;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}

export class CashbookEntryDto {
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
  transactionDate!: string;

  @ApiProperty({ enum: AccountingSettlementMethod })
  @IsEnum(AccountingSettlementMethod)
  settlementMethod!: AccountingSettlementMethod;

  @ApiPropertyOptional({ example: 'BNK-REF-001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'CUSTOMER' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  counterpartyType?: string;

  @ApiPropertyOptional({ example: 'customer-uuid-or-external-ref' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  counterpartyId?: string;

  @ApiPropertyOptional({ example: 'source-system-reference' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiProperty({ example: 'Manual receipt from customer' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Accounting-selected posting-enabled offset GL account. Receipt credits this account; payment/charge debits it.',
  })
  @IsUUID()
  offsetGlAccountId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional subledger account for offset control-account postings such as customer AR receipts.',
  })
  @IsOptional()
  @IsUUID()
  offsetSubledgerAccountId?: string;

  @ApiPropertyOptional({
    example: 1.25,
    minimum: 0.00000001,
    description:
      'Agreed FX rate used when the cashbook transaction currency differs from the tenant base currency.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: 'CRM' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'source-record-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceRecordId?: string;
}

export class CreateCashbookReceiptDto extends CashbookEntryDto {}

export class CreateCashbookPaymentDto extends CashbookEntryDto {}

export class CreateCashbookChargeDto extends CashbookEntryDto {}

export class CreateCashbookAdjustmentDto extends CashbookEntryDto {
  @ApiProperty({
    enum: [CashbookDirection.INFLOW, CashbookDirection.OUTFLOW],
    description:
      'Whether this adjustment increases or reduces the cash account.',
  })
  @IsIn([CashbookDirection.INFLOW, CashbookDirection.OUTFLOW])
  direction!: CashbookDirection;
}

export class CreateCashbookTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashAccountId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  destinationCashAccountId!: string;

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
  transactionDate!: string;

  @ApiPropertyOptional({
    example: 1.25,
    minimum: 0.00000001,
    description:
      'Required for cross-currency transfers. This is the agreed persisted rate; no live FX lookup is performed.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: 'TRF-001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty({ example: 'Transfer between Ecobank and mobile money wallet' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ example: 'TREASURY' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'source-record-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceRecordId?: string;
}

export class QueryCashbookDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: CashbookTransactionType })
  @IsOptional()
  @IsEnum(CashbookTransactionType)
  transactionType?: CashbookTransactionType;

  @ApiPropertyOptional({ enum: CashbookTransactionStatus })
  @IsOptional()
  @IsEnum(CashbookTransactionStatus)
  status?: CashbookTransactionStatus;

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

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}

export class ReverseCashbookTransactionDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  reversalDate!: string;

  @ApiProperty({ example: 'Duplicate transaction captured in error' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}
