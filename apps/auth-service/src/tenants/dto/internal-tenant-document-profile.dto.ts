import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InternalTenantDocumentAssetDto {
  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({ example: 'broker-logo.png' })
  fileName!: string;

  @ApiProperty({ example: 48321 })
  sizeBytes!: number;

  @ApiProperty({
    description: 'Short-lived signed URL for reading the private asset.',
  })
  readUrl!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class InternalTenantBankAccountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  bankName!: string;

  @ApiPropertyOptional({ nullable: true })
  branchName!: string | null;

  @ApiProperty()
  accountName!: string;

  @ApiProperty({
    description:
      'Full account number. This is returned only by the service-authenticated internal endpoint because official payment documents require exact remittance instructions.',
  })
  accountNumber!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  swiftCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sortCode!: string | null;
}

export class InternalTenantDocumentProfileDto {
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

  @ApiProperty({ example: 2 })
  version!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    description:
      'True when values were resolved from the tenant record because no document profile exists.',
  })
  defaultsApplied!: boolean;

  @ApiPropertyOptional({ nullable: true })
  authorizedSignatoryName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  authorizedSignatoryTitle!: string | null;

  @ApiPropertyOptional({
    type: InternalTenantDocumentAssetDto,
    nullable: true,
  })
  logo!: InternalTenantDocumentAssetDto | null;

  @ApiPropertyOptional({
    type: InternalTenantDocumentAssetDto,
    nullable: true,
  })
  signature!: InternalTenantDocumentAssetDto | null;

  @ApiProperty({ type: [InternalTenantBankAccountDto] })
  bankAccounts!: InternalTenantBankAccountDto[];
}
