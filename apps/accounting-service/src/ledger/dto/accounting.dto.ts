import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  RecordStatus,
  SubledgerType,
} from '../../../prisma/generated/client';

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return value;
};

export class UpdateAccountingTenantConfigDto {
  @ApiPropertyOptional({ example: 'GHS', minLength: 3, maxLength: 3 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  decimalPlaces?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Default posting-enabled asset control account for customers.',
  })
  @IsOptional()
  @IsUUID()
  accountsReceivableControlAccountId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Default posting-enabled liability control account for vendors.',
  })
  @IsOptional()
  @IsUUID()
  accountsPayableControlAccountId?: string;
}

export class CreateAccountingCurrencyDto {
  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  code!: string;

  @ApiProperty({ example: 'Ghana Cedi' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'GH₵' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(10)
  symbol?: string;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  decimalPlaces?: number;
}

export class UpdateAccountingCurrencyDto extends PartialType(
  CreateAccountingCurrencyDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExchangeRateDto {
  @ApiProperty({ example: 'USD' })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  fromCurrency!: string;

  @ApiProperty({ example: 'GHS' })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  toCurrency!: string;

  @ApiProperty({ example: 15.45, minimum: 0.00000001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  rate!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  effectiveAt!: string;
}

export class UpdateExchangeRateDto {
  @ApiPropertyOptional({ example: 15.45, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  rate?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFiscalPeriodDto {
  @ApiProperty({ example: '2026-07' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  endDate!: string;
}

export class QueryFiscalPeriodsDto {
  @ApiPropertyOptional({ enum: FiscalPeriodStatus })
  @IsOptional()
  @IsEnum(FiscalPeriodStatus)
  status?: FiscalPeriodStatus;
}

export class CreateGLAccountDto {
  @ApiProperty({ example: '1100' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Cash at Bank' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    enum: GLAccountCategory,
    description:
      'Legacy/unclassified account category. Derived from accountGroupId when provided.',
  })
  @IsOptional()
  @IsEnum(GLAccountCategory)
  category?: GLAccountCategory;

  @ApiPropertyOptional({
    enum: NormalBalance,
    description:
      'Optional override. Defaults from the derived category and must match it.',
  })
  @IsOptional()
  @IsEnum(NormalBalance)
  normalBalance?: NormalBalance;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Official reporting hierarchy group. New posting accounts should provide this.',
  })
  @IsOptional()
  @IsUUID()
  accountGroupId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowPosting?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateGLAccountDto extends PartialType(CreateGLAccountDto) {}

export class QueryGLAccountsDto {
  @ApiPropertyOptional({ enum: GLAccountCategory })
  @IsOptional()
  @IsEnum(GLAccountCategory)
  category?: GLAccountCategory;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountGroupId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  classificationId?: string;
}

export class QueryAccountHierarchyDto {
  @ApiPropertyOptional({ enum: GLAccountCategory })
  @IsOptional()
  @IsEnum(GLAccountCategory)
  category?: GLAccountCategory;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Current' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['code', 'name', 'displayOrder', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsIn(['code', 'name', 'displayOrder', 'createdAt', 'updatedAt'])
  sortBy?: 'code' | 'name' | 'displayOrder' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class QueryAccountGroupsDto extends QueryAccountHierarchyDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  classificationId?: string;
}

export class CreateAccountClassificationDto {
  @ApiProperty({ example: 'CURRENT_ASSET' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Current Assets' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: GLAccountCategory })
  @IsEnum(GLAccountCategory)
  category!: GLAccountCategory;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSystemTemplate?: boolean;
}

export class UpdateAccountClassificationDto extends PartialType(
  CreateAccountClassificationDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAccountGroupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  classificationId!: string;

  @ApiProperty({ example: 'BANK_ACCOUNTS' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Bank Accounts' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateAccountGroupDto extends PartialType(CreateAccountGroupDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCostCentreDto {
  @ApiProperty({ example: 'ACC' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Accra Branch' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Source module branch or department ID.',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;
}

export class UpdateCostCentreDto extends PartialType(CreateCostCentreDto) {}

export class CreateSubledgerAccountDto {
  @ApiProperty({ example: 'CED-0001' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Acme Insurance Company' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: SubledgerType })
  @IsEnum(SubledgerType)
  type!: SubledgerType;

  @ApiPropertyOptional({ description: 'Tenant-owned source record ID.' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  controlAccountId!: string;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class UpdateSubledgerAccountDto extends PartialType(
  CreateSubledgerAccountDto,
) {}

export class QuerySubledgerAccountsDto {
  @ApiPropertyOptional({ enum: SubledgerType })
  @IsOptional()
  @IsEnum(SubledgerType)
  type?: SubledgerType;

  @ApiPropertyOptional({ example: 'reinsurance-counterparty-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Filters balances to the Accounting control account / obligation dimension.',
  })
  @IsOptional()
  @IsUUID()
  controlAccountId?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class EnsureInternalSubledgerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ enum: [SubledgerType.CEDANT, SubledgerType.REINSURER] })
  @IsIn([SubledgerType.CEDANT, SubledgerType.REINSURER])
  type!: SubledgerType;

  @ApiProperty({ example: 'reinsurance-counterparty-id' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef!: string;

  @ApiProperty({ example: 'Acme Insurance Company' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description:
      'Optional source metadata retained by callers; not persisted in Phase 1.',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class QueryAccountingPartiesDto {
  @ApiPropertyOptional({ example: 'Acme' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'GHS', minLength: 3, maxLength: 3 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'REINSURANCE' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'cedant-123' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['code', 'legalName', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsIn(['code', 'legalName', 'createdAt', 'updatedAt'])
  sortBy?: 'code' | 'legalName' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class CreateAccountingCustomerDto {
  @ApiProperty({ example: 'CUS-0001' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Acme Insurance Company Limited' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(180)
  legalName!: string;

  @ApiPropertyOptional({ example: 'Acme Insurance' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(180)
  tradingName?: string;

  @ApiPropertyOptional({ example: 'Ama Mensah' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  primaryContactName?: string;

  @ApiPropertyOptional({ example: 'billing@example.com' })
  @IsOptional()
  @Transform(trimmed)
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ example: '+233 20 000 0000' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'No. 1 Independence Avenue, Accra' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  billingAddress?: string;

  @ApiPropertyOptional({ example: 'GH', minLength: 2, maxLength: 2 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiPropertyOptional({ example: 30, minimum: 0, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;

  @ApiPropertyOptional({ example: 100000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: 'TIN-123456' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'cedant-123' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @ApiPropertyOptional({ example: 'REINSURANCE' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateAccountingCustomerDto extends PartialType(
  CreateAccountingCustomerDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAccountingVendorDto {
  @ApiProperty({ example: 'VEN-0001' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Office Supplies Limited' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(180)
  legalName!: string;

  @ApiPropertyOptional({ example: 'Office Supplies' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(180)
  tradingName?: string;

  @ApiPropertyOptional({ example: 'Kojo Boateng' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  primaryContactName?: string;

  @ApiPropertyOptional({ example: 'accounts@supplier.example' })
  @IsOptional()
  @Transform(trimmed)
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ example: '+233 24 000 0000' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'North Industrial Area, Accra' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  billingAddress?: string;

  @ApiPropertyOptional({ example: 'GH', minLength: 2, maxLength: 2 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiPropertyOptional({ example: 30, minimum: 0, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;

  @ApiPropertyOptional({ example: 'TIN-654321' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'supplier-123' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @ApiPropertyOptional({ example: 'HR' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  defaultExpenseAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateAccountingVendorDto extends PartialType(
  CreateAccountingVendorDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class JournalLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  glAccountId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subledgerAccountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  costCentreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 100, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  debit?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  credit?: number;
}

export class CreateJournalDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  transactionDate!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fiscalPeriodId!: string;

  @ApiProperty({ example: 'GHS' })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  transactionCurrency!: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 0.00000001,
    description:
      'Required when transaction currency differs from base currency.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  sourceRecordType?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceRecordId?: string;

  @ApiProperty({ type: [JournalLineDto], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class UpdateDraftJournalDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  transactionCurrency?: string;

  @ApiPropertyOptional({ example: 1, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ type: [JournalLineDto], minItems: 2 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines?: JournalLineDto[];
}

export class ReverseJournalDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  reversalDate!: string;

  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class QueryJournalsDto {
  @ApiPropertyOptional({ enum: JournalStatus })
  @IsOptional()
  @IsEnum(JournalStatus)
  status?: JournalStatus;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
