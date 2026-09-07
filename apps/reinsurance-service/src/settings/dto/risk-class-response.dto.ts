import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../../prisma/generated/client';

export class RiskTypeFieldResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  riskTypeId!: string;

  @ApiProperty({ enum: RiskTypeFieldSection })
  section!: RiskTypeFieldSection;

  @ApiProperty({ example: 'vessel_name' })
  fieldKey!: string;

  @ApiProperty({ example: 'Vessel Name' })
  label!: string;

  @ApiProperty({ enum: RiskTypeFieldType })
  fieldType!: RiskTypeFieldType;

  @ApiProperty({ example: false })
  required!: boolean;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['Bulk Carrier', 'Tanker'],
  })
  options!: string[] | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  validationRules!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'e.g. MV Ocean Pioneer',
  })
  placeholder!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  helpText!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class RiskTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  riskClassId!: string;

  @ApiProperty({ example: 'Marine Cargo' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ type: [RiskTypeFieldResponseDto] })
  fields!: RiskTypeFieldResponseDto[];

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'uuid' })
  updatedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class RiskClassResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'Marine' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ type: [RiskTypeResponseDto] })
  riskTypes!: RiskTypeResponseDto[];

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'uuid' })
  updatedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class RiskClassesPageMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ example: 5, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 0 })
  totalPages!: number;
}

export class PaginatedRiskClassesResponseDto {
  @ApiProperty({ type: [RiskClassResponseDto] })
  items!: RiskClassResponseDto[];

  @ApiProperty({ type: RiskClassesPageMetaDto })
  meta!: RiskClassesPageMetaDto;
}

export class PaginatedRiskTypesResponseDto {
  @ApiProperty({ type: [RiskTypeResponseDto] })
  items!: RiskTypeResponseDto[];

  @ApiProperty({ type: RiskClassesPageMetaDto })
  meta!: RiskClassesPageMetaDto;
}

export class RiskTypeFormSchemaFieldDto {
  @ApiProperty({ example: 'vessel_name' })
  fieldKey!: string;

  @ApiProperty({ example: 'Vessel Name' })
  label!: string;

  @ApiProperty({ enum: RiskTypeFieldType })
  fieldType!: RiskTypeFieldType;

  @ApiProperty({ example: false })
  required!: boolean;

  @ApiPropertyOptional({ type: [String], nullable: true })
  options!: string[] | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  validationRules!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  placeholder!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  helpText!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;
}

export class RiskTypeFormSchemaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Marine Cargo' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [RiskTypeFormSchemaFieldDto] })
  businessDetails!: RiskTypeFormSchemaFieldDto[];

  @ApiProperty({ type: [RiskTypeFormSchemaFieldDto] })
  offerDetails!: RiskTypeFormSchemaFieldDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Risk class not found' },
      { type: 'array', items: { type: 'string' } },
    ],
  })
  message!: string | string[];
}
