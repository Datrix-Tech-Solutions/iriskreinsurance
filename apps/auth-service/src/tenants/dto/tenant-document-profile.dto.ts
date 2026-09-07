import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export const SUPPORTED_DOCUMENT_CURRENCIES = [
  'GHS',
  'USD',
  'EUR',
  'GBP',
  'NGN',
  'KES',
  'ZAR',
  'XOF',
  'XAF',
] as const;

const currencyTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpsertTenantDocumentProfileDto {
  @ApiPropertyOptional({ example: 'Acme Reinsurance Brokers' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Acme Reinsurance Brokers Limited' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: 'CS123456789', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string | null;

  @ApiPropertyOptional({ example: 'C0012345678', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxNumber?: string | null;

  @ApiPropertyOptional({
    example: '12 Independence Avenue, Accra',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  physicalAddress?: string | null;

  @ApiPropertyOptional({ example: 'P.O. Box GP 123, Accra', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  postalAddress?: string | null;

  @ApiPropertyOptional({ example: '+233302000001', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'operations@acme.example', nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({
    example: 'https://www.acme.example',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  website?: string | null;

  @ApiPropertyOptional({
    example: 'Licensed insurance broker. All correspondence is confidential.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  footerText?: string | null;

  @ApiPropertyOptional({
    enum: SUPPORTED_DOCUMENT_CURRENCIES,
    example: 'GHS',
  })
  @IsOptional()
  @Transform(currencyTransform)
  @IsIn(SUPPORTED_DOCUMENT_CURRENCIES)
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: 'Ama Mensah', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  authorizedSignatoryName?: string | null;

  @ApiPropertyOptional({ example: 'Managing Director', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  authorizedSignatoryTitle?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTenantBankAccountDto {
  @ApiProperty({ example: 'GCB Bank PLC' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  bankName!: string;

  @ApiPropertyOptional({ example: 'High Street Branch', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  branchName?: string | null;

  @ApiProperty({ example: 'Acme Reinsurance Brokers Limited' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  accountName!: string;

  @ApiProperty({ example: '1036000007232' })
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  accountNumber!: string;

  @ApiProperty({
    enum: SUPPORTED_DOCUMENT_CURRENCIES,
    example: 'GHS',
  })
  @Transform(currencyTransform)
  @IsIn(SUPPORTED_DOCUMENT_CURRENCIES)
  currency!: string;

  @ApiPropertyOptional({ example: 'GHCBGHAC', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  swiftCode?: string | null;

  @ApiPropertyOptional({ example: '040101', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  sortCode?: string | null;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTenantBankAccountDto extends PartialType(
  CreateTenantBankAccountDto,
) {}

export class TenantBankAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty()
  bankName!: string;

  @ApiPropertyOptional({ nullable: true })
  branchName!: string | null;

  @ApiProperty()
  accountName!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  swiftCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sortCode!: string | null;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class TenantDocumentProfileResponseDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Null until the tenant saves a document profile.',
  })
  id!: string | null;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  legalName!: string;

  @ApiPropertyOptional({ nullable: true })
  registrationNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  taxNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  physicalAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true })
  footerText!: string | null;

  @ApiProperty({ example: 'GHS' })
  defaultCurrency!: string;

  @ApiPropertyOptional({ nullable: true })
  logoObjectKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoMimeType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoFileName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoSizeBytes!: number | null;

  @ApiPropertyOptional({ nullable: true })
  signatureObjectKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  signatureMimeType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  signatureFileName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  signatureSizeBytes!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Short-lived signed URL for reading the signature image.',
  })
  signatureUrl!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  signatureUrlExpiresAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  authorizedSignatoryName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  authorizedSignatoryTitle!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({
    description:
      'Monotonic version for profile, asset and bank-account changes.',
  })
  version!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  createdAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  updatedAt!: Date | null;

  @ApiProperty({
    description:
      'True when the response is derived from Tenant because no profile row exists.',
  })
  defaultsApplied!: boolean;

  @ApiProperty({ type: [TenantBankAccountResponseDto] })
  bankAccounts!: TenantBankAccountResponseDto[];
}
