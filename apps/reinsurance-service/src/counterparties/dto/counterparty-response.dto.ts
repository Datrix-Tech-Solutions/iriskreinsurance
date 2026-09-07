import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyOrigin,
  CounterpartyType,
} from '../../../prisma/generated/client';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({
    example: 'You do not have permission to access this resource',
  })
  message!: string;
}

export class CounterpartyContactResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'c5ea43b3-a74a-4846-8642-7eaac8386ef5',
  })
  id!: string;

  @ApiProperty({ example: 'Ama Mensah' })
  fullName!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Treaty Manager',
  })
  jobTitle!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'ama@example.com',
  })
  email!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+233201234567',
  })
  phone!: string | null;

  @ApiProperty({ example: true })
  isPrimary!: boolean;
}

export class CounterpartyAddressResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '623673a9-9a1c-4695-a514-8ef9e6957f53',
  })
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Head Office' })
  label!: string | null;

  @ApiProperty({ example: '1 Independence Avenue' })
  line1!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Ridge' })
  line2!: string | null;

  @ApiProperty({ example: 'Accra' })
  city!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Greater Accra',
  })
  state!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GA-123-4567' })
  postalCode!: string | null;

  @ApiProperty({ example: 'GH', minLength: 2, maxLength: 2 })
  country!: string;

  @ApiProperty({ example: true })
  isPrimary!: boolean;
}

export class CounterpartyResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'b9ab5ff4-77c9-4620-bf17-e04f91b4ad19',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    example: 'bda1cb0d-ebf9-4683-b993-b6d350c8c6b2',
  })
  tenantId!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.CEDANT })
  type!: CounterpartyType;

  @ApiProperty({
    enum: CounterpartyOrigin,
    example: CounterpartyOrigin.LOCAL,
    description:
      'LOCAL for domestically registered entities; FOREIGN for overseas companies.',
  })
  origin!: CounterpartyOrigin;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiProperty({ example: 'acme insurance ltd' })
  normalizedName!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'C-00123' })
  registrationNumber!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'GH',
    description:
      'ISO 3166-1 alpha-2 country code. Required for FOREIGN counterparties.',
  })
  country!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'TIN-0042024' })
  taxId!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'NIC/2024/001',
  })
  licenseNumber!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'operations@acme.example',
  })
  email!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+233201234567',
  })
  phone!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://acme.example',
  })
  website!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Priority cedant account',
  })
  notes!: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 5.0,
    description: 'Brokerage fee as a percentage (0–100)',
  })
  brokerageFee!: number | null;

  @ApiProperty({ type: [CounterpartyContactResponseDto] })
  contacts!: CounterpartyContactResponseDto[];

  @ApiProperty({ type: [CounterpartyAddressResponseDto] })
  addresses!: CounterpartyAddressResponseDto[];

  @ApiProperty({
    format: 'uuid',
    description: 'User who created the counterparty.',
  })
  createdByUserId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'User who most recently updated the counterparty.',
  })
  updatedByUserId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'User who archived the counterparty.',
  })
  archivedByUserId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CounterpartiesPageMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ example: 34, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  totalPages!: number;
}

export class PaginatedCounterpartiesResponseDto {
  @ApiProperty({ type: [CounterpartyResponseDto] })
  items!: CounterpartyResponseDto[];

  @ApiProperty({ type: CounterpartiesPageMetaDto })
  meta!: CounterpartiesPageMetaDto;
}
